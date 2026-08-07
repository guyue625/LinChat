import { DatabaseSync } from "node:sqlite";
import { mkdir } from "node:fs/promises";
import path from "node:path";

let db: DatabaseSync | null = null;
let initPromise: Promise<DatabaseSync> | null = null;

export function getDatabaseFilePath() {
  return (
    process.env.ACCOUNT_DB_FILE ||
    path.join(process.cwd(), "data", "nextchat.sqlite")
  );
}

export function applyDatabaseSchema(database: DatabaseSync) {
  database.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;

    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT,
      avatar TEXT,
      role TEXT NOT NULL CHECK(role IN ('user','admin')),
      disabled INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      last_login_at TEXT
    );

    CREATE TABLE IF NOT EXISTS invitations (
      id TEXT PRIMARY KEY,
      code_hash TEXT NOT NULL,
      code_hint TEXT,
      label TEXT,
      created_at TEXT NOT NULL,
      created_by_user_id TEXT,
      expires_at TEXT,
      max_uses INTEGER NOT NULL,
      used_count INTEGER NOT NULL DEFAULT 0,
      disabled INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reset_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      created_by_user_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used_at TEXT
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      created_at TEXT NOT NULL,
      actor_user_id TEXT,
      actor_username TEXT,
      target_user_id TEXT,
      target_invitation_id TEXT,
      metadata_json TEXT
    );

    CREATE TABLE IF NOT EXISTS providers (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      base_url TEXT,
      api_key TEXT,
      api_secret TEXT,
      extra_json TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS media_objects (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      mime TEXT NOT NULL,
      size INTEGER NOT NULL,
      sha256 TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_sync_snapshots (
      user_id TEXT PRIMARY KEY,
      state_ciphertext TEXT NOT NULL,
      revision INTEGER NOT NULL CHECK (revision > 0),
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_media_user ON media_objects(user_id);
    CREATE INDEX IF NOT EXISTS idx_media_sha ON media_objects(user_id, sha256);
  `);
}

export async function getDb(): Promise<DatabaseSync> {
  if (db) return db;
  if (!initPromise) {
    initPromise = (async () => {
      const filePath = getDatabaseFilePath();
      await mkdir(path.dirname(filePath), { recursive: true });
      const database = new DatabaseSync(filePath);
      applyDatabaseSchema(database);
      db = database;
      return database;
    })();
  }
  return initPromise;
}

/** Test helper — force a fresh connection next call. */
export function resetDbForTests() {
  try {
    db?.close();
  } catch {
    // ignore
  }
  db = null;
  initPromise = null;
}
