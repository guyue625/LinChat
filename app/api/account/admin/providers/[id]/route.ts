import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/app/api/account/admin/_shared";
import { isProviderId } from "@/app/lib/provider-config/registry";
import {
  getProviderConfigRepository,
  withProviderConfigMutationLock,
} from "@/app/lib/provider-config/server";
import { validateProviderPatch } from "@/app/lib/provider-config/validation";
import { InvalidProviderConfigError } from "@/app/lib/provider-config/validation";
import { providerConfigErrorResponse } from "../_shared";

type RouteContext = { params: { id: string } };

function providerId(value: string) {
  if (!isProviderId(value)) {
    throw new InvalidProviderConfigError("未知模型服务商");
  }
  return value;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { service, user } = await requireAdmin(request);
    const id = providerId(context.params.id);
    const patch = validateProviderPatch(id, await request.json());
    const provider = await withProviderConfigMutationLock(async () => {
      const repository = await getProviderConfigRepository();
      const snapshot = repository.snapshot(id);
      const nextProvider = repository.upsert(id, patch);
      try {
        await service.recordProviderConfigAudit(
          user.id,
          "PROVIDER_CONFIG_UPDATED",
          {
            providerId: id,
            changedFields: Object.keys(patch).sort().join(","),
            ...(patch.enabled === undefined ? {} : { enabled: patch.enabled }),
          },
        );
      } catch (error) {
        repository.restore(snapshot);
        throw error;
      }
      return nextProvider;
    });
    return NextResponse.json({ provider });
  } catch (error) {
    return providerConfigErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { service, user } = await requireAdmin(request);
    const id = providerId(context.params.id);
    await withProviderConfigMutationLock(async () => {
      const repository = await getProviderConfigRepository();
      const snapshot = repository.snapshot(id);
      repository.delete(id);
      try {
        await service.recordProviderConfigAudit(
          user.id,
          "PROVIDER_CONFIG_DELETED",
          { providerId: id, changedFields: "override" },
        );
      } catch (error) {
        repository.restore(snapshot);
        throw error;
      }
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return providerConfigErrorResponse(error);
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
