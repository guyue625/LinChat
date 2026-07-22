import { NextRequest, NextResponse } from "next/server";
import {
  getAccountAuthService,
  isAccountAuthEnabled,
} from "@/app/lib/account-auth-server";
import { ACCOUNT_SESSION_COOKIE, accountErrorResponse } from "../_shared";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (!isAccountAuthEnabled()) {
    return NextResponse.json({ enabled: false, user: null });
  }
  try {
    const service = await getAccountAuthService();
    const token = request.cookies.get(ACCOUNT_SESSION_COOKIE)?.value ?? "";
    const user = await service.getUserBySession(token);
    return NextResponse.json({ enabled: true, user });
  } catch (error) {
    return accountErrorResponse(error);
  }
}
