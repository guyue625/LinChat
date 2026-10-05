import { getDb } from "../db/connection";
import { getChatStorageProvider, getMysqlPool } from "../db/mysql";
import { MysqlAccountSyncRepository } from "./mysql-repository";

let pending: Promise<void> | null = null;

/** Account deletion and this outbox are committed in the same SQLite transaction. */
export async function flushSyncDeletions() {
  if (getChatStorageProvider() !== "mysql") return;
  if (pending) return pending;
  pending = (async () => {
    const database = await getDb();
    const rows = database
      .prepare("SELECT user_id FROM pending_sync_deletions")
      .all();
    if (!rows.length) return;
    // Deletion never decrypts the payload, so it also works after key loss.
    const repository = new MysqlAccountSyncRepository(
      await getMysqlPool(),
      Buffer.alloc(32),
    );
    for (const row of rows) {
      const userId = row.user_id as string;
      await repository.delete(userId);
      database
        .prepare("DELETE FROM pending_sync_deletions WHERE user_id = ?")
        .run(userId);
    }
  })().finally(() => {
    pending = null;
  });
  return pending;
}
