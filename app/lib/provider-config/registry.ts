import { ServiceProvider } from "../../constant";
import { PROVIDER_IDS, type ProviderId } from "./types";

export { PROVIDER_IDS };

export type ProviderOptionDefinition = {
  key: string;
  label: string;
  runtimeKey: string;
};

export type ProviderDefinition = {
  id: ProviderId;
  label: string;
  providerName: ServiceProvider;
  modelProviderId: string;
  apiKeyLabel: string;
  supportsApiKey: boolean;
  apiSecretLabel?: string;
  supportsApiSecret: boolean;
  options: readonly ProviderOptionDefinition[];
  runtime: {
    baseUrlKey: string;
    apiKeyKey: string;
    apiSecretKey?: string;
    enabledKey?: string;
  };
};

const basic = (
  id: ProviderId,
  label: string,
  providerName: ServiceProvider,
  overrides: Partial<ProviderDefinition> = {},
): ProviderDefinition => ({
  id,
  label,
  providerName,
  modelProviderId: id,
  apiKeyLabel: "API Key",
  supportsApiKey: true,
  supportsApiSecret: false,
  options: [],
  runtime: {
    baseUrlKey: `${id}Url`,
    apiKeyKey: `${id}ApiKey`,
    enabledKey: `is${id[0].toUpperCase()}${id.slice(1)}`,
  },
  ...overrides,
});

export const PROVIDER_DEFINITIONS: readonly ProviderDefinition[] = [
  basic("openai", "OpenAI", ServiceProvider.OpenAI, {
    runtime: { baseUrlKey: "baseUrl", apiKeyKey: "apiKey" },
    options: [
      {
        key: "organizationId",
        label: "Organization ID",
        runtimeKey: "openaiOrgId",
      },
    ],
  }),
  basic("azure", "Azure OpenAI", ServiceProvider.Azure, {
    runtime: {
      baseUrlKey: "azureUrl",
      apiKeyKey: "azureApiKey",
      enabledKey: "isAzure",
    },
    options: [
      {
        key: "apiVersion",
        label: "API Version",
        runtimeKey: "azureApiVersion",
      },
    ],
  }),
  basic("google", "Google Gemini", ServiceProvider.Google, {
    runtime: {
      baseUrlKey: "googleUrl",
      apiKeyKey: "googleApiKey",
      enabledKey: "isGoogle",
    },
  }),
  basic("anthropic", "Anthropic", ServiceProvider.Anthropic, {
    runtime: {
      baseUrlKey: "anthropicUrl",
      apiKeyKey: "anthropicApiKey",
      enabledKey: "isAnthropic",
    },
    options: [
      {
        key: "apiVersion",
        label: "API Version",
        runtimeKey: "anthropicApiVersion",
      },
    ],
  }),
  basic("baidu", "百度文心", ServiceProvider.Baidu, {
    supportsApiSecret: true,
    apiSecretLabel: "Secret Key",
    runtime: {
      baseUrlKey: "baiduUrl",
      apiKeyKey: "baiduApiKey",
      apiSecretKey: "baiduSecretKey",
      enabledKey: "isBaidu",
    },
  }),
  basic("bytedance", "字节豆包", ServiceProvider.ByteDance, {
    runtime: {
      baseUrlKey: "bytedanceUrl",
      apiKeyKey: "bytedanceApiKey",
      enabledKey: "isBytedance",
    },
  }),
  basic("alibaba", "阿里通义", ServiceProvider.Alibaba, {
    runtime: {
      baseUrlKey: "alibabaUrl",
      apiKeyKey: "alibabaApiKey",
      enabledKey: "isAlibaba",
    },
  }),
  basic("tencent", "腾讯混元", ServiceProvider.Tencent, {
    apiKeyLabel: "Secret ID",
    supportsApiSecret: true,
    apiSecretLabel: "Secret Key",
    runtime: {
      baseUrlKey: "tencentUrl",
      apiKeyKey: "tencentSecretId",
      apiSecretKey: "tencentSecretKey",
      enabledKey: "isTencent",
    },
  }),
  basic("moonshot", "Moonshot", ServiceProvider.Moonshot, {
    runtime: {
      baseUrlKey: "moonshotUrl",
      apiKeyKey: "moonshotApiKey",
      enabledKey: "isMoonshot",
    },
  }),
  basic("iflytek", "讯飞星火", ServiceProvider.Iflytek, {
    supportsApiSecret: true,
    apiSecretLabel: "API Secret",
    runtime: {
      baseUrlKey: "iflytekUrl",
      apiKeyKey: "iflytekApiKey",
      apiSecretKey: "iflytekApiSecret",
      enabledKey: "isIflytek",
    },
  }),
  basic("deepseek", "DeepSeek", ServiceProvider.DeepSeek, {
    runtime: {
      baseUrlKey: "deepseekUrl",
      apiKeyKey: "deepseekApiKey",
      enabledKey: "isDeepSeek",
    },
  }),
  basic("xai", "xAI", ServiceProvider.XAI, {
    runtime: {
      baseUrlKey: "xaiUrl",
      apiKeyKey: "xaiApiKey",
      enabledKey: "isXAI",
    },
  }),
  basic("chatglm", "智谱 ChatGLM", ServiceProvider.ChatGLM, {
    runtime: {
      baseUrlKey: "chatglmUrl",
      apiKeyKey: "chatglmApiKey",
      enabledKey: "isChatGLM",
    },
  }),
  basic("siliconflow", "硅基流动", ServiceProvider.SiliconFlow, {
    runtime: {
      baseUrlKey: "siliconFlowUrl",
      apiKeyKey: "siliconFlowApiKey",
      enabledKey: "isSiliconFlow",
    },
  }),
  basic("302ai", "302.AI", ServiceProvider["302.AI"], {
    modelProviderId: "ai302",
    runtime: {
      baseUrlKey: "ai302Url",
      apiKeyKey: "ai302ApiKey",
      enabledKey: "isAI302",
    },
  }),
  basic("stability", "Stability AI", ServiceProvider.Stability, {
    runtime: {
      baseUrlKey: "stabilityUrl",
      apiKeyKey: "stabilityApiKey",
      enabledKey: "isStability",
    },
  }),
];

const PROVIDER_DEFINITION_MAP = new Map(
  PROVIDER_DEFINITIONS.map((definition) => [definition.id, definition]),
);

export function isProviderId(value: string): value is ProviderId {
  return PROVIDER_DEFINITION_MAP.has(value as ProviderId);
}

export function getProviderDefinition(
  value: string,
): ProviderDefinition | undefined {
  return PROVIDER_DEFINITION_MAP.get(value as ProviderId);
}
