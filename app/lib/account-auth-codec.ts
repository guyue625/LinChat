import type {
  AccountSession,
  AccountUser,
  AuditLog,
  Invitation,
  PasswordResetToken,
} from "./account-auth";

export type UserRow = {
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

export type InvitationRow = {
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

export type SessionRow = {
  id: string;
  user_id: string;
  token_hash: string;
  created_at: string;
  expires_at: string;
};

export type ResetTokenRow = {
  id: string;
  user_id: string;
  token_hash: string;
  created_at: string;
  created_by_user_id: string;
  expires_at: string;
  used_at: string | null;
};

export type AuditRow = {
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

export function decodeUser(row: UserRow): AccountUser {
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

export function decodeInvitation(row: InvitationRow): Invitation {
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

export function decodeSession(row: SessionRow): AccountSession {
  return {
    id: row.id,
    userId: row.user_id,
    tokenHash: row.token_hash,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  };
}

export function decodeResetToken(row: ResetTokenRow): PasswordResetToken {
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

export function decodeAudit(row: AuditRow): AuditLog {
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
