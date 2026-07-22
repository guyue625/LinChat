import { NextRequest, NextResponse } from "next/server";
import { accountErrorResponse } from "../../_shared";
import { requireAdmin } from "../_shared";

export async function POST(request: NextRequest) {
  try {
    const { service, user } = await requireAdmin(request);
    const body = (await request.json()) as {
      label?: string;
      maxUses?: number;
      expiresAt?: string;
    };
    const result = await service.createAdminInvitation(user.id, {
      label: body.label,
      maxUses: Number(body.maxUses ?? 1),
      expiresAt: body.expiresAt || undefined,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return accountErrorResponse(error);
  }
}
