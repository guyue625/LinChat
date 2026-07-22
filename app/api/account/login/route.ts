import { NextRequest, NextResponse } from "next/server";
import { getAccountAuthService } from "@/app/lib/account-auth-server";
import { accountErrorResponse, setSessionCookie } from "../_shared";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      username?: string;
      password?: string;
    };
    const service = await getAccountAuthService();
    const result = await service.login({
      username: body.username ?? "",
      password: body.password ?? "",
    });
    const response = NextResponse.json({ user: result.user });
    setSessionCookie(response, result.sessionToken);
    return response;
  } catch (error) {
    return accountErrorResponse(error);
  }
}
