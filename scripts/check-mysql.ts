import { loadEnvConfig } from "@next/env";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import type { RowDataPacket } from "mysql2/promise";
import { AccountAuthService } from "../app/lib/account-auth";
import { MysqlAccountAuthRepository } from "../app/lib/account-auth-mysql";
import { MysqlProviderConfigRepository } from "../app/lib/provider-config/mysql-repository";
import { MysqlAccountSyncRepository } from "../app/lib/account-sync/mysql-repository";
import { SyncConflictError } from "../app/lib/account-sync/repository";
import { getSyncEncryptionKey } from "../app/lib/account-sync/crypto";
import {
  getMysqlExecutor,
  withMysqlTransaction,
} from "../app/lib/db/mysql-transaction";
import { closeMysqlPool } from "../app/lib/db/mysql";
import { StoreKey } from "../app/constant";
import { readMcpConfig, writeMcpConfig } from "../app/mcp/config-storage";

const rollback = new Error("ROLLBACK_TEST_FIXTURES");

async function main() {
  loadEnvConfig(process.cwd());
  const repository = new MysqlAccountAuthRepository();
  try {
    const original = await repository.read();
    try {
      await withMysqlTransaction(async () => {
        const id = randomBytes(12).toString("hex");
        const password = randomBytes(16).toString("hex");
        const admin = {
          id,
          username: `test_${id.slice(0, 12)}`,
          passwordHash: await AccountAuthService.hashSecret(password),
          role: "admin" as const,
          disabled: false,
          createdAt: new Date().toISOString(),
        };
        await repository.write({
          ...original,
          users: [...original.users, admin],
        });
        const service = new AccountAuthService(
          repository,
          "mysql-integration-test-session-secret",
        );
        const invitationCode = randomBytes(16).toString("hex");
        await service.createInvitation(invitationCode, 1);
        const registered = await service.register({
          username: `user_${id.slice(0, 12)}`,
          password,
          invitationCode,
        });
        const login = await service.login({
          username: registered.user.username,
          password,
        });
        assert.equal(
          (await service.getUserBySession(login.sessionToken))?.id,
          registered.user.id,
        );
        const auditCount = (await repository.read()).auditLogs.length;
        await assert.rejects(
          service.login({
            username: registered.user.username,
            password: "incorrect-password",
          }),
        );
        assert.equal(
          (await repository.read()).auditLogs.length,
          auditCount + 1,
        );

        const key = getSyncEncryptionKey();
        const providers = new MysqlProviderConfigRepository(key);
        await providers.upsert("openai", {
          apiKey: "integration-test-secret",
          baseUrl: "https://example.com/v1",
        });
        await providers.upsert("openai", { label: "Integration test" });
        assert.equal(
          await providers.getSecret("openai", "apiKey"),
          "integration-test-secret",
        );
        assert.equal(
          (await providers.get("openai"))?.label,
          "Integration test",
        );
        const executor = await getMysqlExecutor();
        const [encrypted] = await executor.execute<RowDataPacket[]>(
          "SELECT api_key FROM nextchat_providers WHERE id = 'openai'",
        );
        assert.ok(!encrypted[0].api_key.includes("integration-test-secret"));

        const snapshots = new MysqlAccountSyncRepository(executor, key);
        const mcp = {
          mcpServers: {
            test: {
              command: "test-only-not-executed",
              args: [],
              env: { TOKEN: "mcp-test-secret" },
            },
          },
        };
        await writeMcpConfig(mcp);
        assert.deepEqual(await readMcpConfig(), mcp);
        const [mcpRows] = await executor.execute<RowDataPacket[]>(
          "SELECT ciphertext FROM nextchat_settings WHERE name = 'mcp'",
        );
        assert.ok(!mcpRows[0].ciphertext.includes("mcp-test-secret"));
        const state = {
          [StoreKey.Chat]: { sessions: [], lastInput: "中文测试" },
          [StoreKey.Plugin]: {
            plugins: { example: { authToken: "plugin-secret" } },
          },
          [StoreKey.SdList]: {
            draw: [
              { id: "drawing", img_data: "data:image/png;base64,aW1hZ2U=" },
            ],
          },
          "account-drafts": { drafts: { conversation: "unfinished" } },
        };
        await snapshots.write(registered.user.id, state, 0);
        await snapshots.write(registered.user.id, state, 1);
        assert.deepEqual(
          (await snapshots.read(registered.user.id))?.state,
          state,
        );
        await assert.rejects(
          snapshots.write(registered.user.id, state, 1),
          SyncConflictError,
        );
        await service.deleteUser(
          admin.id,
          registered.user.id,
          registered.user.username,
        );
        assert.equal(await snapshots.read(registered.user.id), null);
        await assert.rejects(
          snapshots.write(registered.user.id, state, 0),
          SyncConflictError,
        );
        throw rollback;
      }, "providers");
    } catch (error) {
      if (error !== rollback) throw error;
    }
    assert.deepEqual(await repository.read(), original);

    const order: number[] = [];
    let entered!: () => void;
    const ready = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const first = withMysqlTransaction(async () => {
      order.push(1);
      entered();
      await new Promise((resolve) => setTimeout(resolve, 100));
      order.push(2);
      throw rollback;
    }, "accounts").catch((error) => {
      if (error !== rollback) throw error;
    });
    await ready;
    const second = withMysqlTransaction(async () => {
      order.push(3);
      throw rollback;
    }, "accounts").catch((error) => {
      if (error !== rollback) throw error;
    });
    await Promise.all([first, second]);
    assert.deepEqual(order, [1, 2, 3]);
    console.log(
      "MySQL integration passed: registration, login, audit, encrypted providers, snapshots, conflicts, account deletion, rollback and concurrent locking. Test fixtures rolled back.",
    );
  } finally {
    await closeMysqlPool();
  }
}

main().catch((error) => {
  console.error(error.code || error.name || "MySQL integration failed");
  process.exitCode = 1;
});
