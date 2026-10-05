import { readFile } from "node:fs/promises";
import type { DatabaseSync } from "node:sqlite";
import type {
  AccountAuthRepository,
  AccountAuthWriteOptions,
  AuthRecord,
} from "./account-auth";

export type { AuthRecord } from "./account-auth";

import {
  decodeUser,
  decodeInvitation,
  decodeSession,
  decodeResetToken,
  decodeAudit,
  type UserRow,
  type InvitationRow,
  type SessionRow,
  type ResetTokenRow,
  type AuditRow,
} from "./account-auth-codec";

export class SqliteAccountAuthRepository implements AccountAuthRepository {
  constructor(private readonly database: DatabaseSync) {}

  async read(): Promise<AuthRecord> {
    const users = this.database
      .prepare("SELECT * FROM users ORDER BY rowid")
      .all()
      .map((row) => decodeUser(row as UserRow));
    const invitations = this.database
      .prepare("SELECT * FROM invitations ORDER BY rowid")
      .all()
      .map((row) => decodeInvitation(row as InvitationRow));
    const sessions = this.database
      .prepare("SELECT * FROM sessions ORDER BY rowid")
      .all()
      .map((row) => decodeSession(row as SessionRow));
    const resetTokens = this.database
      .prepare("SELECT * FROM reset_tokens ORDER BY rowid")
      .all()
      .map((row) => decodeResetToken(row as ResetTokenRow));
    const auditLogs = this.database
      .prepare("SELECT * FROM audit_logs ORDER BY rowid")
      .all()
      .map((row) => decodeAudit(row as AuditRow));
    return { users, invitations, sessions, resetTokens, auditLogs };
  }

  async write(
    data: AuthRecord,
    options: AccountAuthWriteOptions = {},
  ): Promise<void> {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      this.database.exec(
        "DELETE FROM users; DELETE FROM invitations; DELETE FROM sessions; DELETE FROM reset_tokens; DELETE FROM audit_logs;",
      );
      const deleteSnapshot = this.database.prepare(
        "DELETE FROM user_sync_snapshots WHERE user_id = ?",
      );
      for (const userId of options.deletedUserIds ?? []) {
        deleteSnapshot.run(userId);
        this.database
          .prepare(
            "INSERT OR IGNORE INTO pending_sync_deletions (user_id) VALUES (?)",
          )
          .run(userId);
      }
      const insertUser = this.database.prepare(
        `INSERT INTO users
          (id, username, password_hash, display_name, avatar, role, disabled, created_at, last_login_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      for (const user of data.users) {
        insertUser.run(
          user.id,
          user.username,
          user.passwordHash,
          user.displayName ?? null,
          user.avatar ?? null,
          user.role,
          user.disabled ? 1 : 0,
          user.createdAt,
          user.lastLoginAt ?? null,
        );
      }
      const insertInvitation = this.database.prepare(
        `INSERT INTO invitations
          (id, code_hash, code_hint, label, created_at, created_by_user_id, expires_at, max_uses, used_count, disabled)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      for (const invitation of data.invitations) {
        insertInvitation.run(
          invitation.id,
          invitation.codeHash,
          invitation.codeHint ?? null,
          invitation.label ?? null,
          invitation.createdAt,
          invitation.createdByUserId ?? null,
          invitation.expiresAt ?? null,
          invitation.maxUses,
          invitation.usedCount,
          invitation.disabled ? 1 : 0,
        );
      }
      const insertSession = this.database.prepare(
        `INSERT INTO sessions
          (id, user_id, token_hash, created_at, expires_at)
         VALUES (?, ?, ?, ?, ?)`,
      );
      for (const session of data.sessions) {
        insertSession.run(
          session.id,
          session.userId,
          session.tokenHash,
          session.createdAt,
          session.expiresAt,
        );
      }
      const insertResetToken = this.database.prepare(
        `INSERT INTO reset_tokens
          (id, user_id, token_hash, created_at, created_by_user_id, expires_at, used_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      );
      for (const resetToken of data.resetTokens) {
        insertResetToken.run(
          resetToken.id,
          resetToken.userId,
          resetToken.tokenHash,
          resetToken.createdAt,
          resetToken.createdByUserId,
          resetToken.expiresAt,
          resetToken.usedAt ?? null,
        );
      }
      const insertAudit = this.database.prepare(
        `INSERT INTO audit_logs
          (id, action, created_at, actor_user_id, actor_username, target_user_id, target_invitation_id, metadata_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      for (const audit of data.auditLogs) {
        insertAudit.run(
          audit.id,
          audit.action,
          audit.createdAt,
          audit.actorUserId ?? null,
          audit.actorUsername ?? null,
          audit.targetUserId ?? null,
          audit.targetInvitationId ?? null,
          audit.metadata === undefined ? null : JSON.stringify(audit.metadata),
        );
      }
      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }
}

function normalizeLegacyRecord(value: unknown): AuthRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid legacy account data");
  }
  const record = value as Partial<AuthRecord>;
  return {
    users: Array.isArray(record.users) ? record.users : [],
    invitations: Array.isArray(record.invitations) ? record.invitations : [],
    sessions: Array.isArray(record.sessions) ? record.sessions : [],
    resetTokens: Array.isArray(record.resetTokens) ? record.resetTokens : [],
    auditLogs: Array.isArray(record.auditLogs) ? record.auditLogs : [],
  };
}

/** Import the legacy JSON repository once, without deleting the source file. */
export async function migrateLegacyAccountAuth(
  database: DatabaseSync,
  filePath: string,
): Promise<boolean> {
  const marker = database
    .prepare(
      "SELECT value FROM meta WHERE key = 'account_auth_legacy_migrated'",
    )
    .get() as { value?: string } | undefined;
  if (marker?.value === "1") return false;

  const counts = database
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM users) AS users,
         (SELECT COUNT(*) FROM invitations) AS invitations,
         (SELECT COUNT(*) FROM sessions) AS sessions,
         (SELECT COUNT(*) FROM reset_tokens) AS reset_tokens,
         (SELECT COUNT(*) FROM audit_logs) AS audit_logs`,
    )
    .get() as
    | {
        users: number;
        invitations: number;
        sessions: number;
        reset_tokens: number;
        audit_logs: number;
      }
    | undefined;
  if (
    !counts ||
    counts.users > 0 ||
    counts.invitations > 0 ||
    counts.sessions > 0 ||
    counts.reset_tokens > 0 ||
    counts.audit_logs > 0
  ) {
    return false;
  }

  let content: string;
  try {
    content = await readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
  const record = normalizeLegacyRecord(JSON.parse(content));
  await new SqliteAccountAuthRepository(database).write(record);
  database
    .prepare(
      `INSERT INTO meta (key, value) VALUES ('account_auth_legacy_migrated', '1')
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    )
    .run();
  return true;
}
