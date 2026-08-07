import type { DatabaseSync } from "node:sqlite";
import {
  getSyncEncryptionKey,
  parseSyncEncryptionKey,
} from "../account-sync/crypto";
import { getDb } from "../db/connection";
import { ProviderConfigRepository } from "./repository";

let repository: ProviderConfigRepository | null = null;
let mutationQueue: Promise<void> = Promise.resolve();

export function withProviderConfigMutationLock<T>(
  operation: () => Promise<T>,
): Promise<T> {
  const result = mutationQueue.then(operation, operation);
  mutationQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

export async function getProviderConfigRepository() {
  if (!repository) {
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
  return createRuntimeProviderRepository(
    await getDb(),
    process.env.ACCOUNT_SYNC_ENCRYPTION_KEY,
  );
}

export function resetProviderConfigRepositoryForTests() {
  repository = null;
  mutationQueue = Promise.resolve();
}
