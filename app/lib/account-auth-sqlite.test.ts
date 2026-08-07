import { DatabaseSync } from "node:sqlite";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { AccountAuthService } from "./account-auth";
import { applyDatabaseSchema } from "./db/connection";
import {
  migrateLegacyAccountAuth,
  SqliteAccountAuthRepository,
  type AuthRecord,
} from "./account-auth-sqlite";

describe("SqliteAccountAuthRepository", () => {
  it("round-trips the complete account record", async () => {
    const database = new DatabaseSync(":memory:");
    applyDatabaseSchema(database);
    const repository = new SqliteAccountAuthRepository(database);
    const record: AuthRecord = {
      users: [
        {
          id: "user-1",
          username: "alice",
          passwordHash: "scrypt:salt:hash",
          displayName: "Alice",
          avatar: "https://example.com/avatar.png",
          role: "user",
          disabled: false,
          createdAt: "2026-08-07T00:00:00.000Z",
          lastLoginAt: "2026-08-07T01:00:00.000Z",
        },
      ],
      invitations: [
        {
          id: "invite-1",
          codeHash: "scrypt:salt:code",
          codeHint: "1234",
          label: "test",
          createdAt: "2026-08-07T00:00:00.000Z",
          createdByUserId: "admin-1",
          expiresAt: "2026-08-08T00:00:00.000Z",
          maxUses: 2,
          usedCount: 1,
          disabled: false,
        },
      ],
      sessions: [
        {
          id: "session-1",
          userId: "user-1",
          tokenHash: "token-hash",
          createdAt: "2026-08-07T00:00:00.000Z",
          expiresAt: "2026-09-07T00:00:00.000Z",
        },
      ],
      resetTokens: [
        {
          id: "reset-1",
          userId: "user-1",
          tokenHash: "reset-hash",
          createdAt: "2026-08-07T00:00:00.000Z",
          createdByUserId: "admin-1",
          expiresAt: "2026-08-07T00:15:00.000Z",
          usedAt: "2026-08-07T00:05:00.000Z",
        },
      ],
      auditLogs: [
        {
          id: "audit-1",
          action: "LOGIN_SUCCESS",
          createdAt: "2026-08-07T00:00:00.000Z",
          actorUserId: "user-1",
          actorUsername: "alice",
          targetUserId: "user-1",
          metadata: { source: "test", ok: true, value: null },
        },
      ],
    };

    await repository.write(record);

    await expect(repository.read()).resolves.toEqual(record);
  });

  it("migrates a legacy JSON record only when SQLite is empty", async () => {
    const database = new DatabaseSync(":memory:");
    applyDatabaseSchema(database);
    const record: AuthRecord = {
      users: [
        {
          id: "legacy-user",
          username: "legacy",
          passwordHash: "scrypt:salt:hash",
          role: "admin",
          disabled: false,
          createdAt: "2026-08-07T00:00:00.000Z",
        },
      ],
      invitations: [],
      sessions: [],
      resetTokens: [],
      auditLogs: [],
    };
    const directory = await mkdtemp(path.join(os.tmpdir(), "nextchat-auth-"));
    const filePath = path.join(directory, "accounts.json");
    await writeFile(filePath, JSON.stringify(record));

    await expect(migrateLegacyAccountAuth(database, filePath)).resolves.toBe(
      true,
    );
    await expect(
      new SqliteAccountAuthRepository(database).read(),
    ).resolves.toEqual(record);
    await expect(migrateLegacyAccountAuth(database, filePath)).resolves.toBe(
      false,
    );
  });

  it("deletes only the removed user's sync snapshot", async () => {
    const database = new DatabaseSync(":memory:");
    applyDatabaseSchema(database);
    const repository = new SqliteAccountAuthRepository(database);
    await repository.write({
      users: [
        {
          id: "admin-1",
          username: "admin",
          passwordHash: "unused",
          role: "admin",
          disabled: false,
          createdAt: "2026-08-07T00:00:00.000Z",
        },
        {
          id: "user-a",
          username: "alice",
          passwordHash: "unused",
          role: "user",
          disabled: false,
          createdAt: "2026-08-07T00:00:00.000Z",
        },
      ],
      invitations: [],
      sessions: [],
      resetTokens: [],
      auditLogs: [],
    });
    const insertSnapshot = database.prepare(
      `INSERT INTO user_sync_snapshots
        (user_id, state_ciphertext, revision, updated_at)
       VALUES (?, ?, 1, '2026-08-07T00:00:00.000Z')`,
    );
    insertSnapshot.run("admin-1", "admin-state");
    insertSnapshot.run("user-a", "user-state");

    const service = new AccountAuthService(repository, "session-secret");
    await service.deleteUser("admin-1", "user-a", "alice");

    expect(
      database
        .prepare("SELECT user_id FROM user_sync_snapshots ORDER BY user_id")
        .all(),
    ).toEqual([{ user_id: "admin-1" }]);
  });

  it("rolls back snapshot cleanup when a later account insert fails", async () => {
    const database = new DatabaseSync(":memory:");
    applyDatabaseSchema(database);
    const repository = new SqliteAccountAuthRepository(database);
    const user = {
      id: "user-a",
      username: "alice",
      passwordHash: "unused",
      role: "user" as const,
      disabled: false,
      createdAt: "2026-08-07T00:00:00.000Z",
    };
    const record: AuthRecord = {
      users: [user],
      invitations: [],
      sessions: [],
      resetTokens: [],
      auditLogs: [],
    };
    await repository.write(record);
    database
      .prepare(
        `INSERT INTO user_sync_snapshots
          (user_id, state_ciphertext, revision, updated_at)
         VALUES ('user-a', 'state', 1, '2026-08-07T00:00:00.000Z')`,
      )
      .run();

    await expect(
      repository.write(
        { ...record, users: [user, { ...user, username: "duplicate" }] },
        { deletedUserIds: ["user-a"] },
      ),
    ).rejects.toThrow();

    expect(
      database
        .prepare(
          "SELECT user_id FROM user_sync_snapshots WHERE user_id = 'user-a'",
        )
        .get(),
    ).toEqual({ user_id: "user-a" });
  });
});
