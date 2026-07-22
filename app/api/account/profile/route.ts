import { NextRequest, NextResponse } from "next/server";
import { AccountAuthError } from "@/app/lib/account-auth";
import {
  getAccountAuthService,
  isAccountAuthEnabled,
} from "@/app/lib/account-auth-server";
import { ACCOUNT_SESSION_COOKIE, accountErrorResponse } from "../_shared";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function requireCurrentUser(request: NextRequest) {
  if (!isAccountAuthEnabled()) {
    throw new AccountAuthError(
      "ACCOUNT_AUTH_DISABLED",
      "账号登录功能未启用",
      503,
    );
  }
  const service = await getAccountAuthService();
  const token = request.cookies.get(ACCOUNT_SESSION_COOKIE)?.value ?? "";
  const user = await service.getUserBySession(token);
  if (!user) {
    throw new AccountAuthError("UNAUTHORIZED", "请先登录", 401);
  }
  return { service, user };
}

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireCurrentUser(request);
    return NextResponse.json({ user });
  } catch (error) {
    return accountErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { service, user } = await requireCurrentUser(request);
    const body = (await request.json()) as {
      displayName?: string;
      avatar?: string;
    };
    const updated = await service.updateOwnProfile(user.id, {
      displayName: body.displayName,
      avatar: body.avatar,
    });
    return NextResponse.json({ user: updated });
  } catch (error) {
    return accountErrorResponse(error);
  }
}
