import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/app/api/account/admin/_shared";
import { PROVIDER_DEFINITIONS } from "@/app/lib/provider-config/registry";
import { getRuntimeServerSideConfig } from "@/app/lib/provider-config/runtime";
import { getProviderConfigRepository } from "@/app/lib/provider-config/server";
import { providerConfigErrorResponse } from "./_shared";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const repository = await getProviderConfigRepository();
    const records = new Map(
      repository.list().map((record) => [record.id, record]),
    );
    const runtime = await getRuntimeServerSideConfig();
    const runtimeValues = runtime as unknown as Record<string, unknown>;
    const providers = PROVIDER_DEFINITIONS.map((definition) => {
      const record = records.get(definition.id);
      const apiKeyConfigured = Boolean(
        record?.hasApiKey || runtimeValues[definition.runtime.apiKeyKey],
      );
      const apiSecretConfigured = definition.runtime.apiSecretKey
        ? Boolean(
            record?.hasApiSecret ||
              runtimeValues[definition.runtime.apiSecretKey],
          )
        : false;
      const options = Object.fromEntries(
        definition.options.flatMap((option) => {
          const value = runtimeValues[option.runtimeKey];
          return typeof value === "string" ? [[option.key, value]] : [];
        }),
      );
      return {
        id: definition.id,
        providerName: definition.providerName,
        label: record?.label ?? definition.label,
        configured: Boolean(record),
        enabled: runtime.providerEnabled[definition.id],
        baseUrl:
          (runtimeValues[definition.runtime.baseUrlKey] as
            | string
            | undefined) ?? null,
        hasApiKey: apiKeyConfigured,
        hasApiSecret: apiSecretConfigured,
        apiKeySource: record?.hasApiKey
          ? "database"
          : apiKeyConfigured
          ? "environment"
          : "none",
        apiSecretSource: record?.hasApiSecret
          ? "database"
          : apiSecretConfigured
          ? "environment"
          : "none",
        options,
        overrides: {
          baseUrl: record?.baseUrl ?? null,
          options: record?.extra.options ?? {},
        },
        models: record?.extra.models ?? null,
        updatedAt: record?.updatedAt ?? null,
        capabilities: {
          supportsApiKey: definition.supportsApiKey,
          supportsApiSecret: definition.supportsApiSecret,
          apiKeyLabel: definition.apiKeyLabel,
          apiSecretLabel: definition.apiSecretLabel ?? null,
          options: definition.options.map(({ key, label }) => ({ key, label })),
        },
      };
    });
    return NextResponse.json(
      { providers },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return providerConfigErrorResponse(error);
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
