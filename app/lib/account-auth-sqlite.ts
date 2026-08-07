import { readFile } from "node:fs/promises";
import type { DatabaseSync } from "node:sqlite";
import type {
  AccountAuthRepository,
  AccountAuthWriteOptions,
  AccountSession,
  AccountUser,
  AuditLog,
  AuthRecord,
  Invitation,
  PasswordResetToken,
} from "./account-auth";

export type { AuthRecord } from "./account-auth";

type UserRow = {
  id: string;
  username: string;
  password_hash: string;
  display_name: string | null;
  avatar: string | null;
  role: "user" | "admin";
  disabled: number;
  created_at: string;
  last_login_at: string | null;
};

type InvitationRow = {
  id: string;
  code_hash: string;
  code_hint: string | null;
  label: string | null;
  created_at: string;
  created_by_user_id: string | null;
  expires_at: string | null;
  max_uses: number;
  used_count: number;
  disabled: number;
};

type SessionRow = {
  id: string;
  user_id: string;
  token_hash: string;
  created_at: string;
  expires_at: string;
};

type ResetTokenRow = {
  id: string;
  user_id: string;
  token_hash: string;
  created_at: string;
  created_by_user_id: string;
  expires_at: string;
  used_at: string | null;
};

type AuditRow = {
  id: string;
  action: string;
  created_at: string;
  actor_user_id: string | null;
  actor_username: string | null;
  target_user_id: string | null;
  target_invitation_id: string | null;
  metadata_json: string | null;
};

function optionalString(value: string | null) {
  return value ?? undefined;
}

function booleanColumn(value: number, field: string) {
  if (value !== 0 && value !== 1) throw new Error(`Invalid ${field} value`);
  return value === 1;
}

function decodeMetadata(value: string | null): AuditLog["metadata"] {
  if (value === null) return undefined;
  const parsed: unknown = JSON.parse(value);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Invalid audit metadata");
  }
  return parsed as AuditLog["metadata"];
}

function decodeUser(row: UserRow): AccountUser {
  if (row.role !== "user" && row.role !== "admin") {
    throw new Error("Invalid account role");
  }
  return {
    id: row.id,
    username: row.username,
    passwordHash: row.password_hash,
    displayName: optionalString(row.display_name),
    avatar: optionalString(row.avatar),
    role: row.role,
    disabled: booleanColumn(row.disabled, "user.disabled"),
    createdAt: row.created_at,
    lastLoginAt: optionalString(row.last_login_at),
  };
}

function decodeInvitation(row: InvitationRow): Invitation {
  return {
    id: row.id,
    codeHash: row.code_hash,
    codeHint: optionalString(row.code_hint),
    label: optionalString(row.label),
    createdAt: row.created_at,
    createdByUserId: optionalString(row.created_by_user_id),
    expiresAt: optionalString(row.expires_at),
    maxUses: row.max_uses,
    usedCount: row.used_count,
    disabled: booleanColumn(row.disabled, "invitation.disabled"),
  };
}

function decodeSession(row: SessionRow): AccountSession {
  return {
    id: row.id,
    userId: row.user_id,
    tokenHash: row.token_hash,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  };
}

function decodeResetToken(row: ResetTokenRow): PasswordResetToken {
  return {
    id: row.id,
    userId: row.user_id,
    tokenHash: row.token_hash,
    createdAt: row.created_at,
    createdByUserId: row.created_by_user_id,
    expiresAt: row.expires_at,
    usedAt: optionalString(row.used_at),
  };
}

function decodeAudit(row: AuditRow): AuditLog {
  return {
    id: row.id,
    action: row.action,
    createdAt: row.created_at,
    actorUserId: optionalString(row.actor_user_id),
    actorUsername: optionalString(row.actor_username),
    targetUserId: optionalString(row.target_user_id),
    targetInvitationId: optionalString(row.target_invitation_id),
    metadata: decodeMetadata(row.metadata_json),
  };
}

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
