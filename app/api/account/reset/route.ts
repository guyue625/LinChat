import { NextRequest, NextResponse } from "next/server";
import { getAccountAuthService } from "@/app/lib/account-auth-server";
import { accountErrorResponse } from "../_shared";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      token?: string;
      newPassword?: string;
    };
    const service = await getAccountAuthService();
    const result = await service.resetPassword({
      token: body.token ?? "",
      newPassword: body.newPassword ?? "",
    });
    return NextResponse.json(result);
  } catch (error) {
    return accountErrorResponse(error);
  }
}
