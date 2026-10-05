import type { RowDataPacket } from "mysql2/promise";
import { AccountAuthError } from "./account-auth";
import type {
  AccountAuthRepository,
  AccountAuthWriteOptions,
  AuthRecord,
} from "./account-auth";
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

import { getMysqlExecutor, withMysqlTransaction } from "./db/mysql-transaction";

const TABLES = [
  "users",
  "invitations",
  "sessions",
  "reset_tokens",
  "audit_logs",
] as const;

export class MysqlAccountAuthRepository implements AccountAuthRepository {
  async withMutationLock<T>(operation: () => Promise<T>): Promise<T> {
    const outcome = await withMysqlTransaction(async () => {
      try {
        return { value: await operation() };
      } catch (error) {
        // Failed login attempts deliberately persist an audit record before
        // returning a domain error. Infrastructure errors still roll back.
        if (error instanceof AccountAuthError) return { error };
        throw error;
      }
    }, "accounts");
    if ("error" in outcome) throw outcome.error;
    return outcome.value;
  }

  async read(): Promise<AuthRecord> {
    return withMysqlTransaction(async () => {
      const executor = await getMysqlExecutor();
      const rows: RowDataPacket[][] = [];
      for (const name of TABLES) {
        const [result] = await executor.execute<RowDataPacket[]>(
          `SELECT * FROM nextchat_${name} ORDER BY sequence_id`,
        );
        rows.push(result);
      }
      return {
        users: rows[0].map((row) => decodeUser(row as UserRow)),
        invitations: rows[1].map((row) =>
          decodeInvitation(row as InvitationRow),
        ),
        sessions: rows[2].map((row) => decodeSession(row as SessionRow)),
        resetTokens: rows[3].map((row) =>
          decodeResetToken(row as ResetTokenRow),
        ),
        auditLogs: rows[4].map((row) => decodeAudit(row as AuditRow)),
      };
    }, "accounts");
  }

  async write(
    data: AuthRecord,
    options: AccountAuthWriteOptions = {},
  ): Promise<void> {
    return this.withMutationLock(async () => {
      const executor = await getMysqlExecutor();
      for (const name of TABLES)
        await executor.execute(`DELETE FROM nextchat_${name}`);
      for (const userId of options.deletedUserIds ?? []) {
        await executor.execute(
          `INSERT INTO nextchat_sync_snapshots
          (user_id, state_ciphertext, revision, updated_at, deleted) VALUES (?, '', 0, ?, 1)
          ON DUPLICATE KEY UPDATE state_ciphertext = '', revision = 0, deleted = 1`,
          [userId, new Date().toISOString()],
        );
      }
      const insertUser = async (...values: Array<string | number | null>) =>
        (await getMysqlExecutor()).execute(
          `INSERT INTO nextchat_users
          (id, username, password_hash, display_name, avatar, role, disabled, created_at, last_login_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          values,
        );
      for (const user of data.users) {
        await insertUser(
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
      const insertInvitation = async (
        ...values: Array<string | number | null>
      ) =>
        (await getMysqlExecutor()).execute(
          `INSERT INTO nextchat_invitations
          (id, code_hash, code_hint, label, created_at, created_by_user_id, expires_at, max_uses, used_count, disabled)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          values,
        );
      for (const invitation of data.invitations) {
        await insertInvitation(
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
      const insertSession = async (...values: Array<string | number | null>) =>
        (await getMysqlExecutor()).execute(
          `INSERT INTO nextchat_sessions
          (id, user_id, token_hash, created_at, expires_at)
         VALUES (?, ?, ?, ?, ?)`,
          values,
        );
      for (const session of data.sessions) {
        await insertSession(
          session.id,
          session.userId,
          session.tokenHash,
          session.createdAt,
          session.expiresAt,
        );
      }
      const insertResetToken = async (
        ...values: Array<string | number | null>
      ) =>
        (await getMysqlExecutor()).execute(
          `INSERT INTO nextchat_reset_tokens
          (id, user_id, token_hash, created_at, created_by_user_id, expires_at, used_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
          values,
        );
      for (const resetToken of data.resetTokens) {
        await insertResetToken(
          resetToken.id,
          resetToken.userId,
          resetToken.tokenHash,
          resetToken.createdAt,
          resetToken.createdByUserId,
          resetToken.expiresAt,
          resetToken.usedAt ?? null,
        );
      }
      const insertAudit = async (...values: Array<string | number | null>) =>
        (await getMysqlExecutor()).execute(
          `INSERT INTO nextchat_audit_logs
          (id, action, created_at, actor_user_id, actor_username, target_user_id, target_invitation_id, metadata_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          values,
        );
      for (const audit of data.auditLogs) {
        await insertAudit(
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
    });
  }
}
