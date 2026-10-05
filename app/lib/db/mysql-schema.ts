import type { Pool } from "mysql2/promise";

const tables = {
  settings: "name VARCHAR(191) PRIMARY KEY, ciphertext LONGTEXT NOT NULL",
  meta: "name VARCHAR(191) PRIMARY KEY, value LONGTEXT NOT NULL",
  users: `id VARCHAR(191) PRIMARY KEY, username VARCHAR(191) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL, display_name TEXT, avatar LONGTEXT,
    role VARCHAR(16) NOT NULL, disabled TINYINT NOT NULL DEFAULT 0,
    created_at VARCHAR(24) NOT NULL, last_login_at VARCHAR(24),
    sequence_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE`,
  invitations: `id VARCHAR(191) PRIMARY KEY, code_hash VARCHAR(191) NOT NULL,
    code_hint TEXT, label TEXT, created_at VARCHAR(24) NOT NULL,
    created_by_user_id VARCHAR(191), expires_at VARCHAR(24), max_uses INT NOT NULL,
    used_count INT NOT NULL DEFAULT 0, disabled TINYINT NOT NULL DEFAULT 0,
    sequence_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE`,
  sessions: `id VARCHAR(191) PRIMARY KEY, user_id VARCHAR(191) NOT NULL,
    token_hash VARCHAR(191) NOT NULL, created_at VARCHAR(24) NOT NULL,
    expires_at VARCHAR(24) NOT NULL, INDEX (token_hash), INDEX (user_id),
    sequence_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE`,
  reset_tokens: `id VARCHAR(191) PRIMARY KEY, user_id VARCHAR(191) NOT NULL,
    token_hash VARCHAR(191) NOT NULL, created_at VARCHAR(24) NOT NULL,
    created_by_user_id VARCHAR(191) NOT NULL, expires_at VARCHAR(24) NOT NULL,
    used_at VARCHAR(24), sequence_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE`,
  audit_logs: `id VARCHAR(191) PRIMARY KEY, action VARCHAR(191) NOT NULL,
    created_at VARCHAR(24) NOT NULL, actor_user_id VARCHAR(191), actor_username TEXT,
    target_user_id VARCHAR(191), target_invitation_id VARCHAR(191), metadata_json LONGTEXT,
    sequence_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE`,
  providers: `id VARCHAR(191) PRIMARY KEY, label TEXT NOT NULL,
    enabled TINYINT NOT NULL DEFAULT 1, base_url TEXT, api_key LONGTEXT,
    api_secret LONGTEXT, extra_json LONGTEXT, updated_at VARCHAR(24) NOT NULL`,
};

export async function applyMysqlSchema(pool: Pool) {
  for (const [name, columns] of Object.entries(tables)) {
    await pool.execute(`CREATE TABLE IF NOT EXISTS nextchat_${name} (${columns})
      ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`);
  }
  await pool.execute(
    "INSERT IGNORE INTO nextchat_meta (name, value) VALUES ('accounts', ''), ('providers', '')",
  );
}
