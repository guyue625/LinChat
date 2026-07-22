import { NextRequest, NextResponse } from "next/server";
import { accountErrorResponse } from "../../_shared";
import { requireAdmin } from "../_shared";

export async function GET(request: NextRequest) {
  try {
    const { service, user } = await requireAdmin(request);
    return NextResponse.json(await service.listAdminDashboard(user.id));
  } catch (error) {
    return accountErrorResponse(error);
  }
}
