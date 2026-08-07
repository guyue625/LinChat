import {
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;
const RESET_LIFETIME_MS = 15 * 60 * 1000;
const MAX_AUDIT_LOGS = 2000;

export type AccountRole = "user" | "admin";

export interface AccountUser {
  id: string;
  username: string;
  passwordHash: string;
  displayName?: string;
  avatar?: string;
  role: AccountRole;
  disabled: boolean;
  createdAt: string;
  lastLoginAt?: string;
}

export interface Invitation {
  id: string;
  codeHash: string;
  codeHint?: string;
  label?: string;
  createdAt: string;
  createdByUserId?: string;
  expiresAt?: string;
  maxUses: number;
  usedCount: number;
  disabled: boolean;
}

export interface AccountSession {
  id: string;
  userId: string;
  tokenHash: string;
  createdAt: string;
  expiresAt: string;
}

export interface PasswordResetToken {
  id: string;
  userId: string;
  tokenHash: string;
  createdAt: string;
  createdByUserId: string;
  expiresAt: string;
  usedAt?: string;
}

export interface AuditLog {
  id: string;
  action: string;
  createdAt: string;
  actorUserId?: string;
  actorUsername?: string;
  targetUserId?: string;
  targetInvitationId?: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface AuthRecord {
  users: AccountUser[];
  invitations: Invitation[];
  sessions: AccountSession[];
  resetTokens: PasswordResetToken[];
  auditLogs: AuditLog[];
}

export type AccountAuthWriteOptions = {
  deletedUserIds?: readonly string[];
};

export interface AccountAuthRepository {
  read(): Promise<AuthRecord>;
  write(data: AuthRecord, options?: AccountAuthWriteOptions): Promise<void>;
}

export class AccountAuthError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "AccountAuthError";
  }
}

function normalizeRecord(record: Partial<AuthRecord>): AuthRecord {
  return {
    users: record.users ?? [],
    invitations: record.invitations ?? [],
    sessions: record.sessions ?? [],
    resetTokens: record.resetTokens ?? [],
    auditLogs: record.auditLogs ?? [],
  };
}

function publicUser(user: AccountUser) {
  const { passwordHash: _passwordHash, ...safeUser } = user;
  return safeUser;
}

function publicInvitation(invitation: Invitation) {
  const { codeHash: _codeHash, ...safeInvitation } = invitation;
  return safeInvitation;
}

export class AccountAuthService {
  private mutationQueue: Promise<void> = Promise.resolve();

  constructor(
    private readonly repository: AccountAuthRepository,
    private readonly sessionSecret: string,
  ) {
    if (!sessionSecret) throw new Error("ACCOUNT_SESSION_SECRET is required");
  }

  static async hashSecret(secret: string) {
    const salt = randomBytes(16).toString("hex");
    const derivedKey = (await scrypt(secret, salt, 64)) as Buffer;
    return `scrypt:${salt}:${derivedKey.toString("hex")}`;
  }

  static async verifySecret(secret: string, encoded: string) {
    const [algorithm, salt, storedHex] = encoded.split(":");
    if (algorithm !== "scrypt" || !salt || !storedHex) return false;
    const stored = Buffer.from(storedHex, "hex");
    const derived = (await scrypt(secret, salt, stored.length)) as Buffer;
    return stored.length === derived.length && timingSafeEqual(stored, derived);
  }

  private async readRecord() {
    return normalizeRecord(await this.repository.read());
  }

  private mutate<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.mutationQueue.then(operation, operation);
    this.mutationQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  private hashToken(token: string) {
    return createHash("sha256")
      .update(`${this.sessionSecret}:${token}`)
      .digest("hex");
  }

  private normalizeUsername(username: string) {
    const normalized = username.trim().toLowerCase();
    if (!/^[a-z0-9_.-]{3,32}$/.test(normalized)) {
      throw new AccountAuthError(
        "INVALID_USERNAME",
        "用户名需为 3-32 位字母、数字、点、下划线或短横线",
      );
    }
    return normalized;
  }

  private validatePassword(password: string) {
    if (password.length < 8 || password.length > 128) {
      throw new AccountAuthError("INVALID_PASSWORD", "密码长度需为 8-128 位");
    }
  }

  private ensureAdmin(data: AuthRecord, actorUserId: string) {
    const actor = data.users.find((user) => user.id === actorUserId);
    if (!actor || actor.disabled || actor.role !== "admin") {
      throw new AccountAuthError("ADMIN_REQUIRED", "需要管理员权限", 403);
    }
    return actor;
  }

  private ensureUser(data: AuthRecord, userId: string) {
    const user = data.users.find((candidate) => candidate.id === userId);
    if (!user) throw new AccountAuthError("USER_NOT_FOUND", "用户不存在", 404);
    return user;
  }

  private protectLastAdmin(
    data: AuthRecord,
    user: AccountUser,
    next: { role?: AccountRole; disabled?: boolean; deleting?: boolean },
  ) {
    const removesAdmin =
      user.role === "admin" &&
      !user.disabled &&
      (next.deleting || next.role === "user" || next.disabled === true);
    if (!removesAdmin) return;
    const enabledAdmins = data.users.filter(
      (candidate) => candidate.role === "admin" && !candidate.disabled,
    );
    if (enabledAdmins.length <= 1) {
      throw new AccountAuthError(
        "LAST_ADMIN_REQUIRED",
        "必须至少保留一名可用管理员",
        409,
      );
    }
  }

  private appendAudit(
    data: AuthRecord,
    entry: Omit<AuditLog, "id" | "createdAt">,
  ) {
    data.auditLogs.push({
      id: randomBytes(12).toString("hex"),
      createdAt: new Date().toISOString(),
      ...entry,
    });
    if (data.auditLogs.length > MAX_AUDIT_LOGS) {
      data.auditLogs = data.auditLogs.slice(-MAX_AUDIT_LOGS);
    }
  }

  private createSession(data: AuthRecord, userId: string) {
    const token = randomBytes(32).toString("base64url");
    const now = new Date();
    data.sessions = data.sessions.filter(
      (session) => new Date(session.expiresAt).getTime() > now.getTime(),
    );
    data.sessions.push({
      id: randomBytes(12).toString("hex"),
      userId,
      tokenHash: this.hashToken(token),
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + SESSION_LIFETIME_MS).toISOString(),
    });
    return token;
  }

  async createInitialAdmin(username: string, password: string) {
    return this.mutate(async () => {
      const normalizedUsername = this.normalizeUsername(username);
      this.validatePassword(password);
      const data = await this.readRecord();
      const existingAdmin = data.users.find((user) => user.role === "admin");
      if (existingAdmin) return publicUser(existingAdmin);
      const user: AccountUser = {
        id: randomBytes(12).toString("hex"),
        username: normalizedUsername,
        passwordHash: await AccountAuthService.hashSecret(password),
        role: "admin",
        disabled: false,
        createdAt: new Date().toISOString(),
      };
      data.users.push(user);
      this.appendAudit(data, {
        action: "INITIAL_ADMIN_CREATED",
        actorUserId: user.id,
        actorUsername: user.username,
        targetUserId: user.id,
      });
      await this.repository.write(data);
      return publicUser(user);
    });
  }

  async createInvitation(code: string, maxUses = 1, expiresAt?: string) {
    return this.mutate(async () => {
      const normalizedCode = code.trim();
      if (normalizedCode.length < 6 || normalizedCode.length > 128) {
        throw new AccountAuthError(
          "INVALID_INVITATION_CODE",
          "邀请码长度需为 6-128 位",
        );
      }
      if (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 10000) {
        throw new AccountAuthError(
          "INVALID_INVITATION_USES",
          "邀请码使用次数需为 1-10000",
        );
      }
      const data = await this.readRecord();
      for (const invitation of data.invitations) {
        if (
          await AccountAuthService.verifySecret(
            normalizedCode,
            invitation.codeHash,
          )
        ) {
          return publicInvitation(invitation);
        }
      }
      const invitation: Invitation = {
        id: randomBytes(12).toString("hex"),
        codeHash: await AccountAuthService.hashSecret(normalizedCode),
        codeHint: `••••${normalizedCode.slice(-4)}`,
        label: "部署初始化",
        createdAt: new Date().toISOString(),
        expiresAt,
        maxUses,
        usedCount: 0,
        disabled: false,
      };
      data.invitations.push(invitation);
      await this.repository.write(data);
      return publicInvitation(invitation);
    });
  }

  async register(input: {
    username: string;
    password: string;
    invitationCode: string;
  }) {
    return this.mutate(async () => {
      const username = this.normalizeUsername(input.username);
      this.validatePassword(input.password);
      if (!input.invitationCode.trim()) {
        throw new AccountAuthError("INVITATION_REQUIRED", "请输入邀请码");
      }
      const data = await this.readRecord();
      if (data.users.some((user) => user.username === username)) {
        throw new AccountAuthError("USERNAME_TAKEN", "用户名已被使用", 409);
      }
      let invitation: Invitation | undefined;
      for (const candidate of data.invitations) {
        if (
          await AccountAuthService.verifySecret(
            input.invitationCode.trim(),
            candidate.codeHash,
          )
        ) {
          invitation = candidate;
          break;
        }
      }
      if (!invitation || invitation.disabled) {
        throw new AccountAuthError("INVALID_INVITATION", "邀请码无效");
      }
      if (
        invitation.expiresAt &&
        new Date(invitation.expiresAt).getTime() <= Date.now()
      ) {
        throw new AccountAuthError("INVITATION_EXPIRED", "邀请码已过期");
      }
      if (invitation.usedCount >= invitation.maxUses) {
        throw new AccountAuthError(
          "INVITATION_EXHAUSTED",
          "邀请码使用次数已耗尽",
        );
      }
      const user: AccountUser = {
        id: randomBytes(12).toString("hex"),
        username,
        passwordHash: await AccountAuthService.hashSecret(input.password),
        role: "user",
        disabled: false,
        createdAt: new Date().toISOString(),
      };
      invitation.usedCount += 1;
      data.users.push(user);
      const sessionToken = this.createSession(data, user.id);
      this.appendAudit(data, {
        action: "USER_REGISTERED",
        actorUserId: user.id,
        actorUsername: user.username,
        targetUserId: user.id,
        targetInvitationId: invitation.id,
      });
      await this.repository.write(data);
      return { user: publicUser(user), sessionToken };
    });
  }

  async login(input: { username: string; password: string }) {
    return this.mutate(async () => {
      const username = this.normalizeUsername(input.username);
      const data = await this.readRecord();
      const user = data.users.find(
        (candidate) => candidate.username === username,
      );
      const passwordMatches =
        user &&
        (await AccountAuthService.verifySecret(
          input.password,
          user.passwordHash,
        ));
      if (!user || !passwordMatches) {
        this.appendAudit(data, {
          action: "LOGIN_FAILED",
          actorUsername: username,
          metadata: { reason: "invalid_credentials" },
        });
        await this.repository.write(data);
        throw new AccountAuthError(
          "INVALID_CREDENTIALS",
          "用户名或密码错误",
          401,
        );
      }
      if (user.disabled) {
        this.appendAudit(data, {
          action: "LOGIN_BLOCKED",
          actorUserId: user.id,
          actorUsername: user.username,
          targetUserId: user.id,
        });
        await this.repository.write(data);
        throw new AccountAuthError("ACCOUNT_DISABLED", "账号已被禁用", 403);
      }
      user.lastLoginAt = new Date().toISOString();
      const sessionToken = this.createSession(data, user.id);
      this.appendAudit(data, {
        action: "LOGIN_SUCCESS",
        actorUserId: user.id,
        actorUsername: user.username,
        targetUserId: user.id,
      });
      await this.repository.write(data);
      return { user: publicUser(user), sessionToken };
    });
  }

  async getUserBySession(token: string) {
    if (!token) return null;
    const data = await this.readRecord();
    const tokenHash = this.hashToken(token);
    const session = data.sessions.find(
      (candidate) =>
        candidate.tokenHash === tokenHash &&
        new Date(candidate.expiresAt).getTime() > Date.now(),
    );
    if (!session) return null;
    const user = data.users.find(
      (candidate) => candidate.id === session.userId,
    );
    if (!user || user.disabled) return null;
    return publicUser(user);
  }

  async logout(token: string) {
    if (!token) return;
    return this.mutate(async () => {
      const data = await this.readRecord();
      const tokenHash = this.hashToken(token);
      const session = data.sessions.find(
        (item) => item.tokenHash === tokenHash,
      );
      data.sessions = data.sessions.filter(
        (item) => item.tokenHash !== tokenHash,
      );
      if (session) {
        const user = data.users.find((item) => item.id === session.userId);
        this.appendAudit(data, {
          action: "LOGOUT",
          actorUserId: user?.id,
          actorUsername: user?.username,
          targetUserId: user?.id,
        });
      }
      await this.repository.write(data);
    });
  }

  async listAdminDashboard(actorUserId: string) {
    const data = await this.readRecord();
    this.ensureAdmin(data, actorUserId);
    const now = Date.now();
    const activeSessions = data.sessions.filter(
      (session) => new Date(session.expiresAt).getTime() > now,
    ).length;
    const usableInvitations = data.invitations.filter(
      (invitation) =>
        !invitation.disabled &&
        invitation.usedCount < invitation.maxUses &&
        (!invitation.expiresAt ||
          new Date(invitation.expiresAt).getTime() > now),
    ).length;
    return {
      stats: {
        totalUsers: data.users.length,
        activeUsers: data.users.filter((user) => !user.disabled).length,
        disabledUsers: data.users.filter((user) => user.disabled).length,
        adminUsers: data.users.filter((user) => user.role === "admin").length,
        activeSessions,
        invitations: data.invitations.length,
        usableInvitations,
        storageBytes: Buffer.byteLength(JSON.stringify(data), "utf8"),
      },
      users: data.users
        .map(publicUser)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      invitations: data.invitations
        .map(publicInvitation)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      auditLogs: [...data.auditLogs]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 300),
    };
  }

  async recordProviderConfigAudit(
    actorUserId: string,
    action: "PROVIDER_CONFIG_UPDATED" | "PROVIDER_CONFIG_DELETED",
    metadata: {
      providerId: string;
      changedFields: string;
      enabled?: boolean;
    },
  ) {
    return this.mutate(async () => {
      const data = await this.readRecord();
      const actor = this.ensureAdmin(data, actorUserId);
      this.appendAudit(data, {
        action,
        actorUserId: actor.id,
        actorUsername: actor.username,
        metadata: {
          providerId: metadata.providerId,
          changedFields: metadata.changedFields,
          ...(metadata.enabled === undefined
            ? {}
            : { enabled: metadata.enabled }),
        },
      });
      await this.repository.write(data);
    });
  }

  async createAdminInvitation(
    actorUserId: string,
    input: { label?: string; maxUses: number; expiresAt?: string },
  ) {
    return this.mutate(async () => {
      if (
        !Number.isInteger(input.maxUses) ||
        input.maxUses < 1 ||
        input.maxUses > 10000
      ) {
        throw new AccountAuthError(
          "INVALID_INVITATION_USES",
          "邀请码使用次数需为 1-10000",
        );
      }
      if (
        input.expiresAt &&
        new Date(input.expiresAt).getTime() <= Date.now()
      ) {
        throw new AccountAuthError(
          "INVALID_INVITATION_EXPIRY",
          "邀请码有效期必须晚于当前时间",
        );
      }
      const data = await this.readRecord();
      const actor = this.ensureAdmin(data, actorUserId);
      const code = `NC-${randomBytes(5)
        .toString("hex")
        .toUpperCase()}-${randomBytes(3).toString("hex").toUpperCase()}`;
      const invitation: Invitation = {
        id: randomBytes(12).toString("hex"),
        codeHash: await AccountAuthService.hashSecret(code),
        codeHint: `••••${code.slice(-4)}`,
        label: input.label?.trim().slice(0, 64) || "未命名邀请码",
        createdAt: new Date().toISOString(),
        createdByUserId: actor.id,
        expiresAt: input.expiresAt,
        maxUses: input.maxUses,
        usedCount: 0,
        disabled: false,
      };
      data.invitations.push(invitation);
      this.appendAudit(data, {
        action: "INVITATION_CREATED",
        actorUserId: actor.id,
        actorUsername: actor.username,
        targetInvitationId: invitation.id,
        metadata: {
          label: invitation.label ?? "",
          maxUses: invitation.maxUses,
          expiresAt: invitation.expiresAt ?? null,
        },
      });
      await this.repository.write(data);
      return { code, invitation: publicInvitation(invitation) };
    });
  }

  async setInvitationDisabled(
    actorUserId: string,
    invitationId: string,
    disabled: boolean,
  ) {
    return this.mutate(async () => {
      const data = await this.readRecord();
      const actor = this.ensureAdmin(data, actorUserId);
      const invitation = data.invitations.find(
        (item) => item.id === invitationId,
      );
      if (!invitation) {
        throw new AccountAuthError("INVITATION_NOT_FOUND", "邀请码不存在", 404);
      }
      invitation.disabled = disabled;
      this.appendAudit(data, {
        action: disabled ? "INVITATION_REVOKED" : "INVITATION_RESTORED",
        actorUserId: actor.id,
        actorUsername: actor.username,
        targetInvitationId: invitation.id,
      });
      await this.repository.write(data);
      return publicInvitation(invitation);
    });
  }

  async updateUser(
    actorUserId: string,
    targetUserId: string,
    patch: {
      displayName?: string;
      avatar?: string;
      role?: AccountRole;
      disabled?: boolean;
    },
  ) {
    return this.mutate(async () => {
      const data = await this.readRecord();
      const actor = this.ensureAdmin(data, actorUserId);
      const target = this.ensureUser(data, targetUserId);
      if (patch.role && patch.role !== "user" && patch.role !== "admin") {
        throw new AccountAuthError("INVALID_ROLE", "账号角色无效");
      }
      this.protectLastAdmin(data, target, patch);
      const profileChanged =
        patch.displayName !== undefined || patch.avatar !== undefined;
      if (patch.displayName !== undefined) {
        const displayName = patch.displayName.trim();
        if (displayName.length > 64) {
          throw new AccountAuthError(
            "INVALID_DISPLAY_NAME",
            "显示名称不能超过 64 个字符",
          );
        }
        target.displayName = displayName || undefined;
      }
      if (patch.avatar !== undefined) {
        const avatar = patch.avatar.trim();
        if (
          avatar.length > 500 ||
          (avatar && !/^(https?:\/\/|data:image\/)/i.test(avatar))
        ) {
          throw new AccountAuthError(
            "INVALID_AVATAR",
            "头像需为 HTTP(S) 地址或图片 Data URL",
          );
        }
        target.avatar = avatar || undefined;
      }
      if (profileChanged) {
        this.appendAudit(data, {
          action: "USER_PROFILE_UPDATED",
          actorUserId: actor.id,
          actorUsername: actor.username,
          targetUserId: target.id,
        });
      }
      if (patch.role && patch.role !== target.role) {
        const previousRole = target.role;
        target.role = patch.role;
        this.appendAudit(data, {
          action: "USER_ROLE_UPDATED",
          actorUserId: actor.id,
          actorUsername: actor.username,
          targetUserId: target.id,
          metadata: { previousRole, role: target.role },
        });
      }
      if (patch.disabled !== undefined && patch.disabled !== target.disabled) {
        target.disabled = patch.disabled;
        if (target.disabled) {
          data.sessions = data.sessions.filter(
            (session) => session.userId !== target.id,
          );
        }
        this.appendAudit(data, {
          action: target.disabled ? "USER_DISABLED" : "USER_RESTORED",
          actorUserId: actor.id,
          actorUsername: actor.username,
          targetUserId: target.id,
        });
      }
      await this.repository.write(data);
      return publicUser(target);
    });
  }

  async updateOwnProfile(
    userId: string,
    patch: { displayName?: string; avatar?: string },
  ) {
    return this.mutate(async () => {
      const data = await this.readRecord();
      const user = this.ensureUser(data, userId);
      if (user.disabled) {
        throw new AccountAuthError("ACCOUNT_DISABLED", "账号已被禁用", 403);
      }
      if (patch.displayName !== undefined) {
        const displayName = patch.displayName.trim();
        if (displayName.length > 64) {
          throw new AccountAuthError(
            "INVALID_DISPLAY_NAME",
            "显示名称不能超过 64 个字符",
          );
        }
        user.displayName = displayName || undefined;
      }
      if (patch.avatar !== undefined) {
        const avatar = patch.avatar.trim();
        if (
          avatar.length > 500 ||
          (avatar && !/^(https?:\/\/|data:image\/)/i.test(avatar))
        ) {
          throw new AccountAuthError(
            "INVALID_AVATAR",
            "头像需为 HTTP(S) 地址或图片 Data URL",
          );
        }
        user.avatar = avatar || undefined;
      }
      this.appendAudit(data, {
        action: "USER_PROFILE_UPDATED",
        actorUserId: user.id,
        actorUsername: user.username,
        targetUserId: user.id,
      });
      await this.repository.write(data);
      return publicUser(user);
    });
  }

  async createPasswordReset(actorUserId: string, targetUserId: string) {
    return this.mutate(async () => {
      const data = await this.readRecord();
      const actor = this.ensureAdmin(data, actorUserId);
      const target = this.ensureUser(data, targetUserId);
      const now = new Date();
      for (const reset of data.resetTokens) {
        if (reset.userId === target.id && !reset.usedAt) {
          reset.usedAt = now.toISOString();
        }
      }
      const token = `NCR-${randomBytes(24).toString("base64url")}`;
      const reset: PasswordResetToken = {
        id: randomBytes(12).toString("hex"),
        userId: target.id,
        tokenHash: await AccountAuthService.hashSecret(token),
        createdAt: now.toISOString(),
        createdByUserId: actor.id,
        expiresAt: new Date(now.getTime() + RESET_LIFETIME_MS).toISOString(),
      };
      data.resetTokens.push(reset);
      this.appendAudit(data, {
        action: "PASSWORD_RESET_CREATED",
        actorUserId: actor.id,
        actorUsername: actor.username,
        targetUserId: target.id,
        metadata: { expiresAt: reset.expiresAt },
      });
      await this.repository.write(data);
      return { token, expiresAt: reset.expiresAt, user: publicUser(target) };
    });
  }

  async resetPassword(input: { token: string; newPassword: string }) {
    return this.mutate(async () => {
      this.validatePassword(input.newPassword);
      const data = await this.readRecord();
      let reset: PasswordResetToken | undefined;
      for (const candidate of data.resetTokens) {
        if (
          !candidate.usedAt &&
          new Date(candidate.expiresAt).getTime() > Date.now() &&
          (await AccountAuthService.verifySecret(
            input.token,
            candidate.tokenHash,
          ))
        ) {
          reset = candidate;
          break;
        }
      }
      if (!reset) {
        throw new AccountAuthError(
          "INVALID_RESET_TOKEN",
          "密码重置凭证无效或已过期",
          400,
        );
      }
      const user = this.ensureUser(data, reset.userId);
      user.passwordHash = await AccountAuthService.hashSecret(
        input.newPassword,
      );
      reset.usedAt = new Date().toISOString();
      data.sessions = data.sessions.filter(
        (session) => session.userId !== user.id,
      );
      this.appendAudit(data, {
        action: "PASSWORD_RESET_USED",
        actorUserId: user.id,
        actorUsername: user.username,
        targetUserId: user.id,
      });
      await this.repository.write(data);
      return { user: publicUser(user) };
    });
  }

  async deleteUser(
    actorUserId: string,
    targetUserId: string,
    confirmation: string,
  ) {
    return this.mutate(async () => {
      const data = await this.readRecord();
      const actor = this.ensureAdmin(data, actorUserId);
      const target = this.ensureUser(data, targetUserId);
      if (confirmation.trim().toLowerCase() !== target.username) {
        throw new AccountAuthError(
          "DELETE_CONFIRMATION_REQUIRED",
          "请输入完整用户名确认删除",
          400,
        );
      }
      this.protectLastAdmin(data, target, { deleting: true });
      data.users = data.users.filter((user) => user.id !== target.id);
      data.sessions = data.sessions.filter(
        (session) => session.userId !== target.id,
      );
      data.resetTokens = data.resetTokens.filter(
        (reset) => reset.userId !== target.id,
      );
      this.appendAudit(data, {
        action: "USER_DELETED",
        actorUserId: actor.id,
        actorUsername: actor.username,
        targetUserId: target.id,
        metadata: { username: target.username },
      });
      await this.repository.write(data, { deletedUserIds: [target.id] });
      return { deleted: true, userId: target.id };
    });
  }
}
