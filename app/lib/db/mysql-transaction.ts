import { AsyncLocalStorage } from "node:async_hooks";
import type { PoolConnection } from "mysql2/promise";
import { getMysqlPool } from "./mysql";

const context = new AsyncLocalStorage<{
  connection: PoolConnection;
  locks: Set<string>;
}>();

export async function getMysqlExecutor() {
  return context.getStore()?.connection ?? (await getMysqlPool());
}

/** Nested account/provider operations share one transaction and its locks. */
export async function withMysqlTransaction<T>(
  operation: () => Promise<T>,
  lock?: "accounts" | "providers",
): Promise<T> {
  const current = context.getStore();
  if (current) {
    if (lock && !current.locks.has(lock)) {
      await current.connection.execute(
        "SELECT value FROM nextchat_meta WHERE name = ? FOR UPDATE",
        [lock],
      );
      current.locks.add(lock);
    }
    return operation();
  }
  const connection = await (await getMysqlPool()).getConnection();
  try {
    await connection.query("SET TRANSACTION ISOLATION LEVEL READ COMMITTED");
    await connection.beginTransaction();
    const result = await context.run({ connection, locks: new Set() }, () =>
      withMysqlTransaction(operation, lock),
    );
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
