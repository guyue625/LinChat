import { NextRequest, NextResponse } from "next/server";
import { getAccountAuthService } from "@/app/lib/account-auth-server";
import {
  ACCOUNT_SESSION_COOKIE,
  accountErrorResponse,
  clearSessionCookie,
} from "../_shared";

export async function POST(request: NextRequest) {
  try {
    const service = await getAccountAuthService();
    await service.logout(
      request.cookies.get(ACCOUNT_SESSION_COOKIE)?.value ?? "",
    );
    const response = NextResponse.json({ ok: true });
    clearSessionCookie(response, request);
    return response;
  } catch (error) {
    return accountErrorResponse(error);
  }
}
