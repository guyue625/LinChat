import path from "node:path";
import { getDb } from "../db/connection";
import { getSyncEncryptionKey } from "./crypto";
import { AccountSyncRepository } from "./repository";

let repositoryPromise: Promise<AccountSyncRepository> | null = null;

export function getLegacySyncDirectory() {
  return (
    process.env.ACCOUNT_SYNC_DIR || path.join(process.cwd(), "data", "sync")
  );
}

export async function getAccountSyncRepository() {
  if (!repositoryPromise) {
    repositoryPromise = (async () => {
      const database = await getDb();
      return new AccountSyncRepository(
        database,
        getSyncEncryptionKey(),
        getLegacySyncDirectory(),
      );
    })();
  }
  return repositoryPromise;
}

export function resetAccountSyncRepositoryForTests() {
  repositoryPromise = null;
}
