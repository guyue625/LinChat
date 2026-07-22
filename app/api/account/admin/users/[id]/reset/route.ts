import { NextRequest, NextResponse } from "next/server";
import { accountErrorResponse } from "../../../../_shared";
import { requireAdmin } from "../../../_shared";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { service, user } = await requireAdmin(request);
    return NextResponse.json(
      await service.createPasswordReset(user.id, params.id),
      { status: 201 },
    );
  } catch (error) {
    return accountErrorResponse(error);
  }
}
