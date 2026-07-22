import { NextRequest, NextResponse } from "next/server";
import { getAccountAuthService } from "@/app/lib/account-auth-server";
import { accountErrorResponse, setSessionCookie } from "../_shared";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      username?: string;
      password?: string;
      invitationCode?: string;
    };
    const service = await getAccountAuthService();
    const result = await service.register({
      username: body.username ?? "",
      password: body.password ?? "",
      invitationCode: body.invitationCode ?? "",
    });
    const response = NextResponse.json({ user: result.user }, { status: 201 });
    setSessionCookie(response, result.sessionToken, request);
    return response;
  } catch (error) {
    return accountErrorResponse(error);
  }
}
