import type { DatabaseSync } from "node:sqlite";
import {
  getSyncEncryptionKey,
  parseSyncEncryptionKey,
} from "../account-sync/crypto";
import { getDb } from "../db/connection";
import { ProviderConfigRepository } from "./repository";
import { MysqlProviderConfigRepository } from "./mysql-repository";
import { getDatabaseProvider } from "../db/mysql";
import {
  getMysqlExecutor,
  withMysqlTransaction,
} from "../db/mysql-transaction";
import type { RowDataPacket } from "mysql2/promise";

let repository:
  | ProviderConfigRepository
  | MysqlProviderConfigRepository
  | null = null;
let mutationQueue: Promise<void> = Promise.resolve();

export function withProviderConfigMutationLock<T>(
  operation: () => Promise<T>,
): Promise<T> {
  const run = () =>
    getDatabaseProvider() === "mysql"
      ? withMysqlTransaction(operation, "providers")
      : operation();
  const result = mutationQueue.then(run, run);
  mutationQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

export async function getProviderConfigRepository() {
  if (!repository) {
    if (getDatabaseProvider() === "mysql") {
      repository = new MysqlProviderConfigRepository(getSyncEncryptionKey());
      return repository;
    }
    repository = new ProviderConfigRepository(
      await getDb(),
      getSyncEncryptionKey(),
    );
  }
  return repository;
}

export function createRuntimeProviderRepository(
  database: DatabaseSync,
  encryptionKey: string | undefined,
) {
  const row = database
    .prepare("SELECT COUNT(*) AS count FROM providers")
    .get() as { count: number };
  if (row.count === 0) return null;
  return new ProviderConfigRepository(
    database,
    parseSyncEncryptionKey(encryptionKey),
  );
}

export async function getRuntimeProviderConfigRepository() {
  if (getDatabaseProvider() === "mysql") {
    const [rows] = await (
      await getMysqlExecutor()
    ).execute<RowDataPacket[]>(
      "SELECT COUNT(*) AS count FROM nextchat_providers",
    );
    return Number(rows[0].count) === 0
      ? null
      : new MysqlProviderConfigRepository(getSyncEncryptionKey());
  }
  return createRuntimeProviderRepository(
    await getDb(),
    process.env.ACCOUNT_SYNC_ENCRYPTION_KEY,
  );
}

export function resetProviderConfigRepositoryForTests() {
  repository = null;
  mutationQueue = Promise.resolve();
}
