import path from "node:path";
import { getDb } from "../db/connection";
import { getSyncEncryptionKey } from "./crypto";
import { AccountSyncRepository } from "./repository";
import type { AccountSyncStorage } from "./repository";
import {
  getChatStorageProvider,
  getDatabaseProvider,
  getMysqlPool,
} from "../db/mysql";
import { MysqlAccountSyncRepository } from "./mysql-repository";
import { flushSyncDeletions } from "./deletions";

let repositoryPromise: Promise<AccountSyncStorage> | null = null;

export function getLegacySyncDirectory() {
  return (
    process.env.ACCOUNT_SYNC_DIR || path.join(process.cwd(), "data", "sync")
  );
}

export async function getAccountSyncRepository() {
  if (getDatabaseProvider() !== "mysql") await flushSyncDeletions();
  if (!repositoryPromise) {
    repositoryPromise = (async () => {
      if (getDatabaseProvider() === "mysql") {
        return new MysqlAccountSyncRepository(
          await getMysqlPool(),
          getSyncEncryptionKey(),
        );
      }
      const database = await getDb();
      const key = getSyncEncryptionKey();
      const sqlite = new AccountSyncRepository(
        database,
        key,
        getLegacySyncDirectory(),
      );
      return getChatStorageProvider() === "mysql"
        ? new MysqlAccountSyncRepository(await getMysqlPool(), key, sqlite)
        : sqlite;
    })().catch((error) => {
      repositoryPromise = null;
      throw error;
    });
  }
  return repositoryPromise;
}

export function resetAccountSyncRepositoryForTests() {
  repositoryPromise = null;
}
