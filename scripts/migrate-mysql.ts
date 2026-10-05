import { loadEnvConfig } from "@next/env";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import type { RowDataPacket } from "mysql2/promise";
import { SqliteAccountAuthRepository } from "../app/lib/account-auth-sqlite";
import { MysqlAccountAuthRepository } from "../app/lib/account-auth-mysql";
import { ProviderConfigRepository } from "../app/lib/provider-config/repository";
import { MysqlProviderConfigRepository } from "../app/lib/provider-config/mysql-repository";
import { AccountSyncRepository } from "../app/lib/account-sync/repository";
import { MysqlAccountSyncRepository } from "../app/lib/account-sync/mysql-repository";
import { getSyncEncryptionKey } from "../app/lib/account-sync/crypto";
import { closeMysqlPool } from "../app/lib/db/mysql";
import {
  getMysqlExecutor,
  withMysqlTransaction,
} from "../app/lib/db/mysql-transaction";

async function main() {
  loadEnvConfig(process.cwd());
  const file =
    process.env.ACCOUNT_DB_FILE ||
    path.join(process.cwd(), "data", "nextchat.sqlite");
  const source = new DatabaseSync(file, { readOnly: true });
  source.exec("BEGIN");
  try {
    const key = getSyncEncryptionKey();
    const accounts = await new SqliteAccountAuthRepository(source).read();
    const providers = new ProviderConfigRepository(source, key);
    const providerRecords = providers.list();
    const snapshots = new AccountSyncRepository(source, key);
    const users = source
      .prepare("SELECT user_id FROM user_sync_snapshots")
      .all();
    const counts = await withMysqlTransaction(async () => {
      await withMysqlTransaction(async () => undefined, "accounts");
      const executor = await getMysqlExecutor();
      const [markers] = await executor.execute<RowDataPacket[]>(
        "SELECT value FROM nextchat_meta WHERE name = 'sqlite_migrated'",
      );
      if (markers.length)
        throw new Error(
          "Migration has already completed; source data was not imported again",
        );
      for (const table of [
        "users",
        "invitations",
        "sessions",
        "reset_tokens",
        "audit_logs",
        "providers",
        "sync_snapshots",
      ]) {
        const [rows] = await executor.execute<RowDataPacket[]>(
          `SELECT COUNT(*) AS count FROM nextchat_${table}`,
        );
        if (Number(rows[0].count) !== 0)
          throw new Error(
            `Target table nextchat_${table} is not empty; refusing to overwrite it`,
          );
      }
      await new MysqlAccountAuthRepository().write(accounts);
      assert.deepEqual(await new MysqlAccountAuthRepository().read(), accounts);
      const targetProviders = new MysqlProviderConfigRepository(key);
      for (const record of providerRecords)
        await targetProviders.restore(providers.snapshot(record.id));
      const targetSnapshots = new MysqlAccountSyncRepository(executor, key);
      for (const row of users) {
        const userId = row.user_id as string;
        const snapshot = snapshots.read(userId);
        if (snapshot) await targetSnapshots.write(userId, snapshot.state, 0);
      }
      await executor.execute(
        "INSERT INTO nextchat_meta (name, value) VALUES ('sqlite_migrated', ?)",
        [new Date().toISOString()],
      );
      return {
        users: accounts.users.length,
        invitations: accounts.invitations.length,
        sessions: accounts.sessions.length,
        resetTokens: accounts.resetTokens.length,
        auditLogs: accounts.auditLogs.length,
        providers: providerRecords.length,
        snapshots: users.length,
      };
    }, "providers");
    console.log(JSON.stringify({ migrated: counts, sourceRetained: true }));
  } finally {
    source.close();
    await closeMysqlPool();
  }
}

main().catch((error) => {
  // Avoid dumping connection configuration, credentials or SQL parameters.
  console.error(error.code || error.message || "MySQL migration failed");
  process.exitCode = 1;
});
