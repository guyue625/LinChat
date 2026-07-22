import type { NextRequest } from "next/server";
import { AccountAuthError } from "@/app/lib/account-auth";
import {
  getAccountAuthService,
  isAccountAuthEnabled,
} from "@/app/lib/account-auth-server";

const ACCOUNT_SESSION_COOKIE = "nextchat_session";

export function assertAccountAuthEnabled(enabled: boolean) {
  if (!enabled) {
    throw new AccountAuthError(
      "ACCOUNT_AUTH_DISABLED",
      "账号登录功能未启用",
      503,
    );
  }
}

export function assertAdminUser(
  user: { role: "user" | "admin"; disabled: boolean } | null,
) {
  if (!user) {
    throw new AccountAuthError("UNAUTHORIZED", "请先登录", 401);
  }
  if (user.disabled || user.role !== "admin") {
    throw new AccountAuthError("ADMIN_REQUIRED", "需要管理员权限", 403);
  }
}

export async function requireAdmin(request: NextRequest) {
  assertAccountAuthEnabled(isAccountAuthEnabled());
  const service = await getAccountAuthService();
  const token = request.cookies.get(ACCOUNT_SESSION_COOKIE)?.value ?? "";
  const user = await service.getUserBySession(token);
  assertAdminUser(user);
  return { service, user: user! };
}
