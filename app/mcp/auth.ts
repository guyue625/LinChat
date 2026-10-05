import { cookies } from "next/headers";
import {
  getAccountAuthService,
  isAccountAuthEnabled,
} from "../lib/account-auth-server";
import { AccountAuthError } from "../lib/account-auth";

export async function requireMcpAccess(admin = false) {
  if (!isAccountAuthEnabled())
    throw new AccountAuthError(
      "ACCOUNT_AUTH_DISABLED",
      "使用 MCP 前请启用账号登录",
      503,
    );
  const service = await getAccountAuthService();
  const user = await service.getUserBySession(
    cookies().get("nextchat_session")?.value ?? "",
  );
  if (!user) throw new AccountAuthError("UNAUTHORIZED", "请先登录", 401);
  if (admin && user.role !== "admin")
    throw new AccountAuthError("ADMIN_REQUIRED", "需要管理员权限", 403);
}
