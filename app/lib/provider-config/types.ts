export const PROVIDER_IDS = [
  "openai",
  "azure",
  "google",
  "anthropic",
  "baidu",
  "bytedance",
  "alibaba",
  "tencent",
  "moonshot",
  "iflytek",
  "deepseek",
  "xai",
  "chatglm",
  "siliconflow",
  "302ai",
  "stability",
] as const;

export type ProviderId = (typeof PROVIDER_IDS)[number];

export type ProviderModel = {
  name: string;
  alias?: string;
};

export type ProviderExtra = {
  version: 1;
  options: Record<string, string>;
  models: ProviderModel[] | null;
};

export type ProviderPatch = {
  label?: string;
  enabled?: boolean;
  baseUrl?: string | null;
  apiKey?: string;
  apiSecret?: string;
  clearApiKey?: boolean;
  clearApiSecret?: boolean;
  options?: Record<string, string>;
  models?: ProviderModel[] | null;
};

export type ValidatedProviderPatch = ProviderPatch;

export type ProviderRecord = {
  id: ProviderId;
  label: string;
  enabled: boolean;
  baseUrl: string | null;
  hasApiKey: boolean;
  hasApiSecret: boolean;
  extra: ProviderExtra;
  updatedAt: string;
};
