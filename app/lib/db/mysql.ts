import { createPool, type Pool } from "mysql2/promise";
import { applyMysqlSchema } from "./mysql-schema";

let poolPromise: Promise<Pool> | null = null;

export function getChatStorageProvider(): "sqlite" | "mysql" {
  if (getDatabaseProvider() === "mysql") return "mysql";
  const provider = process.env.ACCOUNT_CHAT_STORAGE || "sqlite";
  if (provider !== "sqlite" && provider !== "mysql") {
    throw new Error("ACCOUNT_CHAT_STORAGE must be sqlite or mysql");
  }
  return provider;
}

export function getDatabaseProvider(): "sqlite" | "mysql" {
  const provider = process.env.ACCOUNT_DB_PROVIDER || "sqlite";
  if (provider !== "sqlite" && provider !== "mysql") {
    throw new Error("ACCOUNT_DB_PROVIDER must be sqlite or mysql");
  }
  return provider;
}

export async function getMysqlPool(): Promise<Pool> {
  if (!poolPromise) {
    poolPromise = (async () => {
      const uri = process.env.ACCOUNT_MYSQL_URL;
      if (!uri)
        throw new Error("ACCOUNT_MYSQL_URL is required for MySQL storage");
      const pool = createPool({
        uri,
        connectionLimit: 5,
        waitForConnections: true,
        queueLimit: 100,
        charset: "utf8mb4_bin",
        supportBigNumbers: true,
        bigNumberStrings: true,
      });
      try {
        await pool.execute(`CREATE TABLE IF NOT EXISTS nextchat_sync_snapshots (
          user_id VARCHAR(191) COLLATE utf8mb4_bin PRIMARY KEY,
          state_ciphertext LONGTEXT NOT NULL,
          revision BIGINT UNSIGNED NOT NULL,
          updated_at VARCHAR(24) NOT NULL,
          deleted TINYINT NOT NULL DEFAULT 0
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`);
        await applyMysqlSchema(pool);
        return pool;
      } catch (error) {
        await pool.end();
        throw error;
      }
    })().catch((error) => {
      poolPromise = null;
      throw error;
    });
  }
  return poolPromise;
}

export async function closeMysqlPool() {
  const pending = poolPromise;
  poolPromise = null;
  if (pending) await (await pending).end();
}
