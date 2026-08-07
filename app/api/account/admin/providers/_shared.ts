import { NextResponse } from "next/server";
import { AccountAuthError } from "@/app/lib/account-auth";
import { accountErrorResponse } from "@/app/api/account/_shared";
import { CorruptProviderConfigError } from "@/app/lib/provider-config/repository";
import { InvalidProviderConfigError } from "@/app/lib/provider-config/validation";

export function providerConfigErrorResponse(error: unknown) {
  if (error instanceof AccountAuthError) return accountErrorResponse(error);
  if (
    error instanceof InvalidProviderConfigError ||
    error instanceof SyntaxError
  ) {
    return NextResponse.json(
      {
        error:
          error instanceof InvalidProviderConfigError
            ? error.message
            : "请求内容不是有效的 JSON",
        code: "INVALID_PROVIDER_CONFIG",
      },
      { status: 400 },
    );
  }
  if (error instanceof CorruptProviderConfigError) {
    console.error("[ProviderConfig] corrupt provider record", error.providerId);
    return NextResponse.json(
      { error: "模型服务商配置无法读取", code: "PROVIDER_CONFIG_CORRUPT" },
      { status: 500 },
    );
  }
  console.error("[ProviderConfig] unavailable", error);
  return NextResponse.json(
    { error: "模型服务商配置暂时不可用", code: "PROVIDER_CONFIG_UNAVAILABLE" },
    { status: 500 },
  );
}
