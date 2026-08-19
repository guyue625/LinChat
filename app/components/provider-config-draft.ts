import { ServiceProvider } from "../constant";
import type { useAccessStore } from "../store/access";
import type { UpstreamModelSource } from "../utils/upstream-models";

export type ProviderCredentialKey =
  | "openaiUrl"
  | "openaiApiKey"
  | "azureUrl"
  | "azureApiKey"
  | "azureApiVersion"
  | "googleUrl"
  | "googleApiKey"
  | "googleApiVersion"
  | "googleSafetySettings"
  | "anthropicUrl"
  | "anthropicApiKey"
  | "anthropicApiVersion"
  | "baiduUrl"
  | "baiduApiKey"
  | "baiduSecretKey"
  | "bytedanceUrl"
  | "bytedanceApiKey"
  | "alibabaUrl"
  | "alibabaApiKey"
  | "tencentUrl"
  | "tencentSecretId"
  | "tencentSecretKey"
  | "moonshotUrl"
  | "moonshotApiKey"
  | "stabilityUrl"
  | "stabilityApiKey"
  | "iflytekUrl"
  | "iflytekApiKey"
  | "iflytekApiSecret"
  | "deepseekUrl"
  | "deepseekApiKey"
  | "xaiUrl"
  | "xaiApiKey"
  | "chatglmUrl"
  | "chatglmApiKey"
  | "siliconflowUrl"
  | "siliconflowApiKey"
  | "ai302Url"
  | "ai302ApiKey";

type AccessState = ReturnType<typeof useAccessStore.getState>;

export type ProviderCredentialSnapshot = Pick<
  AccessState,
  ProviderCredentialKey
>;
export type ProviderCredentialPatch = Partial<ProviderCredentialSnapshot>;
export type ProviderCredentialErrors = Partial<
  Record<ProviderCredentialKey, string>
>;

export const PROVIDER_CREDENTIAL_KEYS = {
  [ServiceProvider.OpenAI]: ["openaiUrl", "openaiApiKey"],
  [ServiceProvider.Azure]: ["azureUrl", "azureApiKey", "azureApiVersion"],
  [ServiceProvider.Google]: [
    "googleUrl",
    "googleApiKey",
    "googleApiVersion",
    "googleSafetySettings",
  ],
  [ServiceProvider.Anthropic]: [
    "anthropicUrl",
    "anthropicApiKey",
    "anthropicApiVersion",
  ],
  [ServiceProvider.Baidu]: ["baiduUrl", "baiduApiKey", "baiduSecretKey"],
  [ServiceProvider.ByteDance]: ["bytedanceUrl", "bytedanceApiKey"],
  [ServiceProvider.Alibaba]: ["alibabaUrl", "alibabaApiKey"],
  [ServiceProvider.Tencent]: [
    "tencentUrl",
    "tencentSecretId",
    "tencentSecretKey",
  ],
  [ServiceProvider.Moonshot]: ["moonshotUrl", "moonshotApiKey"],
  [ServiceProvider.Stability]: ["stabilityUrl", "stabilityApiKey"],
  [ServiceProvider.Iflytek]: [
    "iflytekUrl",
    "iflytekApiKey",
    "iflytekApiSecret",
  ],
  [ServiceProvider.DeepSeek]: ["deepseekUrl", "deepseekApiKey"],
  [ServiceProvider.XAI]: ["xaiUrl", "xaiApiKey"],
  [ServiceProvider.ChatGLM]: ["chatglmUrl", "chatglmApiKey"],
  [ServiceProvider.SiliconFlow]: ["siliconflowUrl", "siliconflowApiKey"],
  [ServiceProvider["302.AI"]]: ["ai302Url", "ai302ApiKey"],
} as const satisfies Record<ServiceProvider, readonly ProviderCredentialKey[]>;

const PROVIDER_ENDPOINT_KEYS = {
  [ServiceProvider.OpenAI]: "openaiUrl",
  [ServiceProvider.Azure]: "azureUrl",
  [ServiceProvider.Google]: "googleUrl",
  [ServiceProvider.Anthropic]: "anthropicUrl",
  [ServiceProvider.Baidu]: "baiduUrl",
  [ServiceProvider.ByteDance]: "bytedanceUrl",
  [ServiceProvider.Alibaba]: "alibabaUrl",
  [ServiceProvider.Tencent]: "tencentUrl",
  [ServiceProvider.Moonshot]: "moonshotUrl",
  [ServiceProvider.Stability]: "stabilityUrl",
  [ServiceProvider.Iflytek]: "iflytekUrl",
  [ServiceProvider.DeepSeek]: "deepseekUrl",
  [ServiceProvider.XAI]: "xaiUrl",
  [ServiceProvider.ChatGLM]: "chatglmUrl",
  [ServiceProvider.SiliconFlow]: "siliconflowUrl",
  [ServiceProvider["302.AI"]]: "ai302Url",
} as const satisfies Record<ServiceProvider, ProviderCredentialKey>;

const PROVIDER_SECRET_KEYS = {
  [ServiceProvider.OpenAI]: ["openaiApiKey"],
  [ServiceProvider.Azure]: ["azureApiKey"],
  [ServiceProvider.Google]: ["googleApiKey"],
  [ServiceProvider.Anthropic]: ["anthropicApiKey"],
  [ServiceProvider.Baidu]: ["baiduApiKey", "baiduSecretKey"],
  [ServiceProvider.ByteDance]: ["bytedanceApiKey"],
  [ServiceProvider.Alibaba]: ["alibabaApiKey"],
  [ServiceProvider.Tencent]: ["tencentSecretId", "tencentSecretKey"],
  [ServiceProvider.Moonshot]: ["moonshotApiKey"],
  [ServiceProvider.Stability]: ["stabilityApiKey"],
  [ServiceProvider.Iflytek]: ["iflytekApiKey", "iflytekApiSecret"],
  [ServiceProvider.DeepSeek]: ["deepseekApiKey"],
  [ServiceProvider.XAI]: ["xaiApiKey"],
  [ServiceProvider.ChatGLM]: ["chatglmApiKey"],
  [ServiceProvider.SiliconFlow]: ["siliconflowApiKey"],
  [ServiceProvider["302.AI"]]: ["ai302ApiKey"],
} as const satisfies Record<ServiceProvider, readonly ProviderCredentialKey[]>;

const ALL_PROVIDER_CREDENTIAL_KEYS = Object.values(
  PROVIDER_CREDENTIAL_KEYS,
).flat() as ProviderCredentialKey[];

export function createProviderCredentialSnapshot(
  accessState: AccessState,
): ProviderCredentialSnapshot {
  return Object.fromEntries(
    ALL_PROVIDER_CREDENTIAL_KEYS.map((key) => [key, accessState[key]]),
  ) as ProviderCredentialSnapshot;
}

export function isProviderCredentialDirty(
  provider: ServiceProvider,
  saved: ProviderCredentialSnapshot,
  draft: ProviderCredentialSnapshot,
): boolean {
  return PROVIDER_CREDENTIAL_KEYS[provider].some(
    (key) => saved[key] !== draft[key],
  );
}

export function getProviderCredentialPatch(
  provider: ServiceProvider,
  draft: ProviderCredentialSnapshot,
): ProviderCredentialPatch {
  return Object.fromEntries(
    PROVIDER_CREDENTIAL_KEYS[provider].map((key) => [
      key,
      key === "googleSafetySettings" ? draft[key] : draft[key].trim(),
    ]),
  ) as ProviderCredentialPatch;
}

function isHttpEndpoint(value: string): boolean {
  if (!/^https?:\/\//i.test(value)) return false;

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function validateProviderDraft(
  provider: ServiceProvider,
  draft: ProviderCredentialSnapshot,
): ProviderCredentialErrors {
  const errors: ProviderCredentialErrors = {};
  const endpointKey = PROVIDER_ENDPOINT_KEYS[provider];
  const endpoint = draft[endpointKey].trim();
  const hasSecret = PROVIDER_SECRET_KEYS[provider].some(
    (key) => draft[key].trim().length > 0,
  );

  if (endpoint && !isHttpEndpoint(endpoint)) {
    errors[endpointKey] = "Endpoint must be a valid HTTP or HTTPS URL.";
  } else if (!endpoint && hasSecret) {
    errors[endpointKey] = "Endpoint is required when credentials are present.";
  }

  return errors;
}

export function getProviderUpstreamSource(
  provider: ServiceProvider,
  draft: ProviderCredentialSnapshot,
): UpstreamModelSource {
  const common = { provider };

  switch (provider) {
    case ServiceProvider.Azure:
      return {
        ...common,
        baseUrl: draft.azureUrl,
        apiKey: draft.azureApiKey,
        apiVersion: draft.azureApiVersion,
      };
    case ServiceProvider.Google:
      return {
        ...common,
        baseUrl: draft.googleUrl,
        apiKey: draft.googleApiKey,
        apiVersion: draft.googleApiVersion,
      };
    case ServiceProvider.Anthropic:
      return {
        ...common,
        baseUrl: draft.anthropicUrl,
        apiKey: draft.anthropicApiKey,
        apiVersion: draft.anthropicApiVersion,
      };
    case ServiceProvider.Baidu:
      return {
        ...common,
        baseUrl: draft.baiduUrl,
        apiKey: draft.baiduApiKey,
      };
    case ServiceProvider.ByteDance:
      return {
        ...common,
        baseUrl: draft.bytedanceUrl,
        apiKey: draft.bytedanceApiKey,
      };
    case ServiceProvider.Alibaba:
      return {
        ...common,
        baseUrl: draft.alibabaUrl,
        apiKey: draft.alibabaApiKey,
      };
    case ServiceProvider.Tencent:
      return {
        ...common,
        baseUrl: draft.tencentUrl,
        apiKey: draft.tencentSecretId,
      };
    case ServiceProvider.Moonshot:
      return {
        ...common,
        baseUrl: draft.moonshotUrl,
        apiKey: draft.moonshotApiKey,
      };
    case ServiceProvider.Stability:
      return {
        ...common,
        baseUrl: draft.stabilityUrl,
        apiKey: draft.stabilityApiKey,
      };
    case ServiceProvider.Iflytek:
      return {
        ...common,
        baseUrl: draft.iflytekUrl,
        apiKey: draft.iflytekApiKey,
      };
    case ServiceProvider.DeepSeek:
      return {
        ...common,
        baseUrl: draft.deepseekUrl,
        apiKey: draft.deepseekApiKey,
      };
    case ServiceProvider.XAI:
      return {
        ...common,
        baseUrl: draft.xaiUrl,
        apiKey: draft.xaiApiKey,
      };
    case ServiceProvider.ChatGLM:
      return {
        ...common,
        baseUrl: draft.chatglmUrl,
        apiKey: draft.chatglmApiKey,
      };
    case ServiceProvider.SiliconFlow:
      return {
        ...common,
        baseUrl: draft.siliconflowUrl,
        apiKey: draft.siliconflowApiKey,
      };
    case ServiceProvider["302.AI"]:
      return {
        ...common,
        baseUrl: draft.ai302Url,
        apiKey: draft.ai302ApiKey,
      };
    default:
      return {
        ...common,
        baseUrl: draft.openaiUrl,
        apiKey: draft.openaiApiKey,
      };
  }
}
