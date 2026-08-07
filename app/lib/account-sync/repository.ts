import type { DatabaseSync } from "node:sqlite";
import { decryptSyncPayload, encryptSyncPayload } from "./crypto";
import { readLegacySyncSnapshot } from "./legacy";
import { validateSyncState, type SyncState } from "./state";

type SnapshotRow = {
  state_ciphertext: string;
  revision: number;
  updated_at: string;
};

export type AccountSyncSnapshot = {
  state: SyncState;
  revision: number;
  updatedAt: string;
};

export class SyncConflictError extends Error {
  constructor(readonly current: AccountSyncSnapshot | null) {
    super("SYNC_CONFLICT");
    this.name = "SyncConflictError";
  }
}

export class InvalidSyncStateError extends Error {
  constructor(readonly reason: string) {
    super(reason);
    this.name = "InvalidSyncStateError";
  }
}

export class CorruptSyncSnapshotError extends Error {
  constructor() {
    super("同步快照无法读取");
    this.name = "CorruptSyncSnapshotError";
  }
}

export class AccountSyncRepository {
  constructor(
    private readonly database: DatabaseSync,
    private readonly encryptionKey: Buffer,
    private readonly legacyDirectory?: string,
  ) {}

  private readRow(userId: string): SnapshotRow | null {
    return (
      (this.database
        .prepare(
          `SELECT state_ciphertext, revision, updated_at
             FROM user_sync_snapshots
            WHERE user_id = ?`,
        )
        .get(userId) as SnapshotRow | undefined) ?? null
    );
  }

  private decodeRow(userId: string, row: SnapshotRow): AccountSyncSnapshot {
    try {
      const plaintext = decryptSyncPayload({
        encrypted: row.state_ciphertext,
        userId,
        revision: row.revision,
        key: this.encryptionKey,
      });
      const validation = validateSyncState(JSON.parse(plaintext));
      if (!validation.ok) throw new Error(validation.reason);
      return {
        state: validation.state,
        revision: row.revision,
        updatedAt: row.updated_at,
      };
    } catch {
      throw new CorruptSyncSnapshotError();
    }
  }

  read(userId: string): AccountSyncSnapshot | null {
    const row = this.readRow(userId);
    return row ? this.decodeRow(userId, row) : null;
  }

  async readWithLegacyMigration(
    userId: string,
  ): Promise<AccountSyncSnapshot | null> {
    const current = this.read(userId);
    if (current || !this.legacyDirectory) return current;

    const legacy = await readLegacySyncSnapshot(userId, this.legacyDirectory);
    if (!legacy) return null;

    this.database.exec("BEGIN IMMEDIATE");
    try {
      const existingRow = this.readRow(userId);
      if (existingRow) {
        const existing = this.decodeRow(userId, existingRow);
        this.database.exec("COMMIT");
        return existing;
      }

      const revision = 1;
      const updatedAt = legacy.updatedAt ?? new Date().toISOString();
      const stateCiphertext = encryptSyncPayload({
        plaintext: JSON.stringify(legacy.state),
        userId,
        revision,
        key: this.encryptionKey,
      });
      this.database
        .prepare(
          `INSERT INTO user_sync_snapshots
            (user_id, state_ciphertext, revision, updated_at)
           VALUES (?, ?, ?, ?)`,
        )
        .run(userId, stateCiphertext, revision, updatedAt);
      this.database.exec("COMMIT");
      return { state: legacy.state, revision, updatedAt };
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  write(
    userId: string,
    state: SyncState,
    expectedRevision: number,
  ): AccountSyncSnapshot {
    const validation = validateSyncState(state);
    if (!validation.ok) throw new InvalidSyncStateError(validation.reason);

    this.database.exec("BEGIN IMMEDIATE");
    try {
      const currentRow = this.readRow(userId);
      const current = currentRow ? this.decodeRow(userId, currentRow) : null;
      const currentRevision = current?.revision ?? 0;
      if (currentRevision !== expectedRevision) {
        throw new SyncConflictError(current);
      }

      const revision = currentRevision + 1;
      const updatedAt = new Date().toISOString();
      const stateCiphertext = encryptSyncPayload({
        plaintext: JSON.stringify(validation.state),
        userId,
        revision,
        key: this.encryptionKey,
      });

      if (currentRow) {
        this.database
          .prepare(
            `UPDATE user_sync_snapshots
                SET state_ciphertext = ?, revision = ?, updated_at = ?
              WHERE user_id = ? AND revision = ?`,
          )
          .run(stateCiphertext, revision, updatedAt, userId, expectedRevision);
      } else {
        this.database
          .prepare(
            `INSERT INTO user_sync_snapshots
              (user_id, state_ciphertext, revision, updated_at)
             VALUES (?, ?, ?, ?)`,
          )
          .run(userId, stateCiphertext, revision, updatedAt);
      }

      this.database.exec("COMMIT");
      return { state: validation.state, revision, updatedAt };
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }
}
