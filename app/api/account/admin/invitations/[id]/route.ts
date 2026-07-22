import { NextRequest, NextResponse } from "next/server";
import { accountErrorResponse } from "../../../_shared";
import { requireAdmin } from "../../_shared";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { service, user } = await requireAdmin(request);
    const body = (await request.json()) as { disabled?: boolean };
    if (typeof body.disabled !== "boolean") {
      return NextResponse.json(
        { error: "disabled 必须为布尔值", code: "INVALID_REQUEST" },
        { status: 400 },
      );
    }
    const invitation = await service.setInvitationDisabled(
      user.id,
      params.id,
      body.disabled,
    );
    return NextResponse.json({ invitation });
  } catch (error) {
    return accountErrorResponse(error);
  }
}
