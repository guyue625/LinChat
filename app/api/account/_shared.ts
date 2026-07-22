import { NextResponse } from "next/server";
import { AccountAuthError } from "@/app/lib/account-auth";

export const ACCOUNT_SESSION_COOKIE = "nextchat_session";

export function setSessionCookie(response: NextResponse, token: string) {
  response.cookies.set(ACCOUNT_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(ACCOUNT_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export function accountErrorResponse(error: unknown) {
  if (error instanceof AccountAuthError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status },
    );
  }
  console.error("[AccountAuth]", error);
  return NextResponse.json(
    { error: "账号服务暂时不可用", code: "ACCOUNT_SERVICE_UNAVAILABLE" },
    { status: 503 },
  );
}
