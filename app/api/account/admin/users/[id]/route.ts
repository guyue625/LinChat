import { NextRequest, NextResponse } from "next/server";
import { accountErrorResponse } from "../../../_shared";
import { requireAdmin } from "../../_shared";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { service, user } = await requireAdmin(request);
    const body = (await request.json()) as {
      displayName?: string;
      avatar?: string;
      role?: "user" | "admin";
      disabled?: boolean;
    };
    const updated = await service.updateUser(user.id, params.id, body);
    return NextResponse.json({ user: updated });
  } catch (error) {
    return accountErrorResponse(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { service, user } = await requireAdmin(request);
    const body = (await request.json()) as { confirmation?: string };
    const result = await service.deleteUser(
      user.id,
      params.id,
      body.confirmation ?? "",
    );
    return NextResponse.json(result);
  } catch (error) {
    return accountErrorResponse(error);
  }
}
