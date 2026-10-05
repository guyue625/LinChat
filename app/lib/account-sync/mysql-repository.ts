import type { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { decryptSyncPayload, encryptSyncPayload } from "./crypto";
import {
  type AccountSyncSnapshot,
  type AccountSyncStorage,
  CorruptSyncSnapshotError,
  InvalidSyncStateError,
  SyncConflictError,
} from "./repository";
import { validateSyncState, type SyncState } from "./state";

interface SnapshotRow extends RowDataPacket {
  state_ciphertext: string;
  revision: string | number;
  updated_at: string;
}

/** MySQL is authoritative once a snapshot has been imported or created. */
export class MysqlAccountSyncRepository implements AccountSyncStorage {
  constructor(
    private readonly pool: Pick<Pool, "execute">,
    private readonly encryptionKey: Buffer,
    private readonly legacy?: AccountSyncStorage,
  ) {}

  async read(userId: string): Promise<AccountSyncSnapshot | null> {
    const [rows] = await this.pool.execute<SnapshotRow[]>(
      `SELECT state_ciphertext, revision, updated_at
         FROM nextchat_sync_snapshots WHERE user_id = ? AND deleted = 0`,
      [userId],
    );
    const row = rows[0];
    if (!row) return null;
    try {
      const revision = Number(row.revision);
      if (!Number.isSafeInteger(revision) || revision < 1) throw new Error();
      const plaintext = decryptSyncPayload({
        encrypted: row.state_ciphertext,
        userId,
        revision,
        key: this.encryptionKey,
      });
      const validation = validateSyncState(JSON.parse(plaintext));
      if (!validation.ok) throw new Error(validation.reason);
      return { state: validation.state, revision, updatedAt: row.updated_at };
    } catch {
      throw new CorruptSyncSnapshotError();
    }
  }

  async readWithLegacyMigration(userId: string) {
    const current = await this.read(userId);
    if (current || !this.legacy) return current;
    const legacy = await this.legacy.readWithLegacyMigration(userId);
    if (!legacy) return null;
    try {
      return await this.write(userId, legacy.state, 0);
    } catch (error) {
      // Another request may have initialized this user while we read SQLite.
      if (error instanceof SyncConflictError) return error.current;
      throw error;
    }
  }

  async write(
    userId: string,
    state: SyncState,
    expectedRevision: number,
  ): Promise<AccountSyncSnapshot> {
    const validation = validateSyncState(state);
    if (!validation.ok) throw new InvalidSyncStateError(validation.reason);
    if (
      !Number.isSafeInteger(expectedRevision) ||
      expectedRevision < 0 ||
      expectedRevision >= Number.MAX_SAFE_INTEGER
    ) {
      throw new InvalidSyncStateError("同步版本超出有效范围");
    }
    const revision = expectedRevision + 1;
    const updatedAt = new Date().toISOString();
    const encrypted = encryptSyncPayload({
      plaintext: JSON.stringify(validation.state),
      userId,
      revision,
      key: this.encryptionKey,
    });

    // Each write is one atomic statement. A stale client cannot overwrite a
    // newer revision, including two clients creating the first snapshot.
    if (expectedRevision === 0) {
      try {
        await this.pool.execute(
          `INSERT INTO nextchat_sync_snapshots
             (user_id, state_ciphertext, revision, updated_at) VALUES (?, ?, ?, ?)`,
          [userId, encrypted, revision, updatedAt],
        );
      } catch (error) {
        if ((error as { code?: string }).code !== "ER_DUP_ENTRY") throw error;
        throw new SyncConflictError(await this.read(userId));
      }
    } else {
      const [result] = await this.pool.execute<ResultSetHeader>(
        `UPDATE nextchat_sync_snapshots
            SET state_ciphertext = ?, revision = ?, updated_at = ?
          WHERE user_id = ? AND revision = ? AND deleted = 0`,
        [encrypted, revision, updatedAt, userId, expectedRevision],
      );
      if (result.affectedRows !== 1) {
        throw new SyncConflictError(await this.read(userId));
      }
    }
    return { state: validation.state, revision, updatedAt };
  }

  async delete(userId: string) {
    // Keep an empty tombstone so an in-flight request cannot recreate data
    // after account deletion or import an obsolete SQLite snapshot again.
    await this.pool.execute(
      `INSERT INTO nextchat_sync_snapshots
         (user_id, state_ciphertext, revision, updated_at, deleted)
       VALUES (?, '', 0, ?, 1)
       ON DUPLICATE KEY UPDATE state_ciphertext = '', revision = 0, deleted = 1`,
      [userId, new Date().toISOString()],
    );
  }
}
