import { Path } from "../constant";

export type AccountRole = "user" | "admin";

export type AccountUserSummary = {
  id?: string;
  username: string;
  displayName?: string;
  avatar?: string;
  role: AccountRole;
  disabled: boolean;
};

export type AccountSnapshot = {
  enabled: boolean;
  user: AccountUserSummary | null;
};

export function normalizeAccountSession(value: unknown): AccountSnapshot {
  if (!value || typeof value !== "object") {
    return { enabled: false, user: null };
  }
  const payload = value as { enabled?: unknown; user?: unknown };
  const enabled = payload.enabled === true;
  const rawUser = payload.user;
  if (!rawUser || typeof rawUser !== "object") {
    return { enabled, user: null };
  }
  const user = rawUser as Partial<AccountUserSummary>;
  if (
    typeof user.username !== "string" ||
    (user.role !== "user" && user.role !== "admin") ||
    typeof user.disabled !== "boolean"
  ) {
    return { enabled, user: null };
  }
  return {
    enabled,
    user: {
      id: typeof user.id === "string" ? user.id : undefined,
      username: user.username,
      displayName:
        typeof user.displayName === "string" ? user.displayName : undefined,
      avatar: typeof user.avatar === "string" ? user.avatar : undefined,
      role: user.role,
      disabled: user.disabled,
    },
  };
}

export function shouldRequireLogin(account: AccountSnapshot) {
  return account.enabled && !account.user;
}

export function safeReturnPath(value: string | null | undefined) {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    /[\r\n]/.test(value)
  ) {
    return Path.Chat;
  }
  return value;
}

export function buildAuthPath(returnTo: string) {
  return `${Path.Auth}?returnTo=${encodeURIComponent(
    safeReturnPath(returnTo),
  )}`;
}

export function accountDisplayName(user: {
  displayName?: string;
  username: string;
}) {
  return user.displayName?.trim() || user.username;
}

export function accountInitial(value: string) {
  return Array.from(value.trim())[0]?.toLocaleUpperCase() || "?";
}

export function getAccountMenuItems(user: {
  role: AccountRole;
}): Array<"profile" | "admin" | "logout"> {
  return user.role === "admin"
    ? ["profile", "admin", "logout"]
    : ["profile", "logout"];
}
