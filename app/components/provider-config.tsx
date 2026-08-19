import {
  AI302,
  Alibaba,
  Anthropic,
  Azure,
  Baidu,
  ByteDance,
  ChatGLM,
  DeepSeek,
  Google,
  GoogleSafetySettingsThreshold,
  Iflytek,
  Moonshot,
  OPENAI_BASE_URL,
  ServiceProvider,
  SiliconFlow,
  Stability,
  Tencent,
  XAI,
} from "../constant";
import Locale from "../locales";
import {
  type ProviderCredentialKey,
  type ProviderCredentialSnapshot,
} from "./provider-config-draft";
import { SettingRow } from "./settings-controls";
import { Input, PasswordInput, Select } from "./ui-lib";

export type ProviderConfigProps = {
  provider: ServiceProvider;
  values: ProviderCredentialSnapshot;
  errors: Partial<Record<ProviderCredentialKey, string>>;
  onChange: <K extends ProviderCredentialKey>(
    key: K,
    value: ProviderCredentialSnapshot[K],
  ) => void;
};

type ProviderFieldDefinition = {
  key: ProviderCredentialKey;
  field: string;
  kind: "text" | "password" | "select";
  title: () => string;
  description: () => string;
  placeholder?: () => string;
};

const PROVIDER_FIELDS = {
  [ServiceProvider.OpenAI]: [
    {
      key: "openaiUrl",
      field: "endpoint",
      kind: "text",
      title: () => Locale.Settings.Access.OpenAI.Endpoint.Title,
      description: () => Locale.Settings.Access.OpenAI.Endpoint.SubTitle,
      placeholder: () => OPENAI_BASE_URL,
    },
    {
      key: "openaiApiKey",
      field: "api-key",
      kind: "password",
      title: () => Locale.Settings.Access.OpenAI.ApiKey.Title,
      description: () => Locale.Settings.Access.OpenAI.ApiKey.SubTitle,
      placeholder: () => Locale.Settings.Access.OpenAI.ApiKey.Placeholder,
    },
  ],
  [ServiceProvider.Azure]: [
    {
      key: "azureUrl",
      field: "endpoint",
      kind: "text",
      title: () => Locale.Settings.Access.Azure.Endpoint.Title,
      description: () =>
        Locale.Settings.Access.Azure.Endpoint.SubTitle + Azure.ExampleEndpoint,
      placeholder: () => Azure.ExampleEndpoint,
    },
    {
      key: "azureApiKey",
      field: "api-key",
      kind: "password",
      title: () => Locale.Settings.Access.Azure.ApiKey.Title,
      description: () => Locale.Settings.Access.Azure.ApiKey.SubTitle,
      placeholder: () => Locale.Settings.Access.Azure.ApiKey.Placeholder,
    },
    {
      key: "azureApiVersion",
      field: "api-version",
      kind: "text",
      title: () => Locale.Settings.Access.Azure.ApiVerion.Title,
      description: () => Locale.Settings.Access.Azure.ApiVerion.SubTitle,
      placeholder: () => "2023-08-01-preview",
    },
  ],
  [ServiceProvider.Google]: [
    {
      key: "googleUrl",
      field: "endpoint",
      kind: "text",
      title: () => Locale.Settings.Access.Google.Endpoint.Title,
      description: () =>
        Locale.Settings.Access.Google.Endpoint.SubTitle +
        Google.ExampleEndpoint,
      placeholder: () => Google.ExampleEndpoint,
    },
    {
      key: "googleApiKey",
      field: "api-key",
      kind: "password",
      title: () => Locale.Settings.Access.Google.ApiKey.Title,
      description: () => Locale.Settings.Access.Google.ApiKey.SubTitle,
      placeholder: () => Locale.Settings.Access.Google.ApiKey.Placeholder,
    },
    {
      key: "googleApiVersion",
      field: "api-version",
      kind: "text",
      title: () => Locale.Settings.Access.Google.ApiVersion.Title,
      description: () => Locale.Settings.Access.Google.ApiVersion.SubTitle,
      placeholder: () => "2023-08-01-preview",
    },
    {
      key: "googleSafetySettings",
      field: "safety-settings",
      kind: "select",
      title: () => Locale.Settings.Access.Google.GoogleSafetySettings.Title,
      description: () =>
        Locale.Settings.Access.Google.GoogleSafetySettings.SubTitle,
    },
  ],
  [ServiceProvider.Anthropic]: [
    {
      key: "anthropicUrl",
      field: "endpoint",
      kind: "text",
      title: () => Locale.Settings.Access.Anthropic.Endpoint.Title,
      description: () =>
        Locale.Settings.Access.Anthropic.Endpoint.SubTitle +
        Anthropic.ExampleEndpoint,
      placeholder: () => Anthropic.ExampleEndpoint,
    },
    {
      key: "anthropicApiKey",
      field: "api-key",
      kind: "password",
      title: () => Locale.Settings.Access.Anthropic.ApiKey.Title,
      description: () => Locale.Settings.Access.Anthropic.ApiKey.SubTitle,
      placeholder: () => Locale.Settings.Access.Anthropic.ApiKey.Placeholder,
    },
    {
      key: "anthropicApiVersion",
      field: "api-version",
      kind: "text",
      title: () => Locale.Settings.Access.Anthropic.ApiVerion.Title,
      description: () => Locale.Settings.Access.Anthropic.ApiVerion.SubTitle,
      placeholder: () => Anthropic.Vision,
    },
  ],
  [ServiceProvider.Baidu]: [
    {
      key: "baiduUrl",
      field: "endpoint",
      kind: "text",
      title: () => Locale.Settings.Access.Baidu.Endpoint.Title,
      description: () => Locale.Settings.Access.Baidu.Endpoint.SubTitle,
      placeholder: () => Baidu.ExampleEndpoint,
    },
    {
      key: "baiduApiKey",
      field: "api-key",
      kind: "password",
      title: () => Locale.Settings.Access.Baidu.ApiKey.Title,
      description: () => Locale.Settings.Access.Baidu.ApiKey.SubTitle,
      placeholder: () => Locale.Settings.Access.Baidu.ApiKey.Placeholder,
    },
    {
      key: "baiduSecretKey",
      field: "secret-key",
      kind: "password",
      title: () => Locale.Settings.Access.Baidu.SecretKey.Title,
      description: () => Locale.Settings.Access.Baidu.SecretKey.SubTitle,
      placeholder: () => Locale.Settings.Access.Baidu.SecretKey.Placeholder,
    },
  ],
  [ServiceProvider.ByteDance]: [
    {
      key: "bytedanceUrl",
      field: "endpoint",
      kind: "text",
      title: () => Locale.Settings.Access.ByteDance.Endpoint.Title,
      description: () =>
        Locale.Settings.Access.ByteDance.Endpoint.SubTitle +
        ByteDance.ExampleEndpoint,
      placeholder: () => ByteDance.ExampleEndpoint,
    },
    {
      key: "bytedanceApiKey",
      field: "api-key",
      kind: "password",
      title: () => Locale.Settings.Access.ByteDance.ApiKey.Title,
      description: () => Locale.Settings.Access.ByteDance.ApiKey.SubTitle,
      placeholder: () => Locale.Settings.Access.ByteDance.ApiKey.Placeholder,
    },
  ],
  [ServiceProvider.Alibaba]: [
    {
      key: "alibabaUrl",
      field: "endpoint",
      kind: "text",
      title: () => Locale.Settings.Access.Alibaba.Endpoint.Title,
      description: () =>
        Locale.Settings.Access.Alibaba.Endpoint.SubTitle +
        Alibaba.ExampleEndpoint,
      placeholder: () => Alibaba.ExampleEndpoint,
    },
    {
      key: "alibabaApiKey",
      field: "api-key",
      kind: "password",
      title: () => Locale.Settings.Access.Alibaba.ApiKey.Title,
      description: () => Locale.Settings.Access.Alibaba.ApiKey.SubTitle,
      placeholder: () => Locale.Settings.Access.Alibaba.ApiKey.Placeholder,
    },
  ],
  [ServiceProvider.Tencent]: [
    {
      key: "tencentUrl",
      field: "endpoint",
      kind: "text",
      title: () => Locale.Settings.Access.Tencent.Endpoint.Title,
      description: () => Locale.Settings.Access.Tencent.Endpoint.SubTitle,
      placeholder: () => Tencent.ExampleEndpoint,
    },
    {
      key: "tencentSecretId",
      field: "api-key",
      kind: "password",
      title: () => Locale.Settings.Access.Tencent.ApiKey.Title,
      description: () => Locale.Settings.Access.Tencent.ApiKey.SubTitle,
      placeholder: () => Locale.Settings.Access.Tencent.ApiKey.Placeholder,
    },
    {
      key: "tencentSecretKey",
      field: "secret-key",
      kind: "password",
      title: () => Locale.Settings.Access.Tencent.SecretKey.Title,
      description: () => Locale.Settings.Access.Tencent.SecretKey.SubTitle,
      placeholder: () => Locale.Settings.Access.Tencent.SecretKey.Placeholder,
    },
  ],
  [ServiceProvider.Moonshot]: [
    {
      key: "moonshotUrl",
      field: "endpoint",
      kind: "text",
      title: () => Locale.Settings.Access.Moonshot.Endpoint.Title,
      description: () =>
        Locale.Settings.Access.Moonshot.Endpoint.SubTitle +
        Moonshot.ExampleEndpoint,
      placeholder: () => Moonshot.ExampleEndpoint,
    },
    {
      key: "moonshotApiKey",
      field: "api-key",
      kind: "password",
      title: () => Locale.Settings.Access.Moonshot.ApiKey.Title,
      description: () => Locale.Settings.Access.Moonshot.ApiKey.SubTitle,
      placeholder: () => Locale.Settings.Access.Moonshot.ApiKey.Placeholder,
    },
  ],
  [ServiceProvider.Stability]: [
    {
      key: "stabilityUrl",
      field: "endpoint",
      kind: "text",
      title: () => Locale.Settings.Access.Stability.Endpoint.Title,
      description: () =>
        Locale.Settings.Access.Stability.Endpoint.SubTitle +
        Stability.ExampleEndpoint,
      placeholder: () => Stability.ExampleEndpoint,
    },
    {
      key: "stabilityApiKey",
      field: "api-key",
      kind: "password",
      title: () => Locale.Settings.Access.Stability.ApiKey.Title,
      description: () => Locale.Settings.Access.Stability.ApiKey.SubTitle,
      placeholder: () => Locale.Settings.Access.Stability.ApiKey.Placeholder,
    },
  ],
  [ServiceProvider.Iflytek]: [
    {
      key: "iflytekUrl",
      field: "endpoint",
      kind: "text",
      title: () => Locale.Settings.Access.Iflytek.Endpoint.Title,
      description: () =>
        Locale.Settings.Access.Iflytek.Endpoint.SubTitle +
        Iflytek.ExampleEndpoint,
      placeholder: () => Iflytek.ExampleEndpoint,
    },
    {
      key: "iflytekApiKey",
      field: "api-key",
      kind: "password",
      title: () => Locale.Settings.Access.Iflytek.ApiKey.Title,
      description: () => Locale.Settings.Access.Iflytek.ApiKey.SubTitle,
      placeholder: () => Locale.Settings.Access.Iflytek.ApiKey.Placeholder,
    },
    {
      key: "iflytekApiSecret",
      field: "api-secret",
      kind: "password",
      title: () => Locale.Settings.Access.Iflytek.ApiSecret.Title,
      description: () => Locale.Settings.Access.Iflytek.ApiSecret.SubTitle,
      placeholder: () => Locale.Settings.Access.Iflytek.ApiSecret.Placeholder,
    },
  ],
  [ServiceProvider.DeepSeek]: [
    {
      key: "deepseekUrl",
      field: "endpoint",
      kind: "text",
      title: () => Locale.Settings.Access.DeepSeek.Endpoint.Title,
      description: () =>
        Locale.Settings.Access.DeepSeek.Endpoint.SubTitle +
        DeepSeek.ExampleEndpoint,
      placeholder: () => DeepSeek.ExampleEndpoint,
    },
    {
      key: "deepseekApiKey",
      field: "api-key",
      kind: "password",
      title: () => Locale.Settings.Access.DeepSeek.ApiKey.Title,
      description: () => Locale.Settings.Access.DeepSeek.ApiKey.SubTitle,
      placeholder: () => Locale.Settings.Access.DeepSeek.ApiKey.Placeholder,
    },
  ],
  [ServiceProvider.XAI]: [
    {
      key: "xaiUrl",
      field: "endpoint",
      kind: "text",
      title: () => Locale.Settings.Access.XAI.Endpoint.Title,
      description: () =>
        Locale.Settings.Access.XAI.Endpoint.SubTitle + XAI.ExampleEndpoint,
      placeholder: () => XAI.ExampleEndpoint,
    },
    {
      key: "xaiApiKey",
      field: "api-key",
      kind: "password",
      title: () => Locale.Settings.Access.XAI.ApiKey.Title,
      description: () => Locale.Settings.Access.XAI.ApiKey.SubTitle,
      placeholder: () => Locale.Settings.Access.XAI.ApiKey.Placeholder,
    },
  ],
  [ServiceProvider.ChatGLM]: [
    {
      key: "chatglmUrl",
      field: "endpoint",
      kind: "text",
      title: () => Locale.Settings.Access.ChatGLM.Endpoint.Title,
      description: () =>
        Locale.Settings.Access.ChatGLM.Endpoint.SubTitle +
        ChatGLM.ExampleEndpoint,
      placeholder: () => ChatGLM.ExampleEndpoint,
    },
    {
      key: "chatglmApiKey",
      field: "api-key",
      kind: "password",
      title: () => Locale.Settings.Access.ChatGLM.ApiKey.Title,
      description: () => Locale.Settings.Access.ChatGLM.ApiKey.SubTitle,
      placeholder: () => Locale.Settings.Access.ChatGLM.ApiKey.Placeholder,
    },
  ],
  [ServiceProvider.SiliconFlow]: [
    {
      key: "siliconflowUrl",
      field: "endpoint",
      kind: "text",
      title: () => Locale.Settings.Access.SiliconFlow.Endpoint.Title,
      description: () =>
        Locale.Settings.Access.SiliconFlow.Endpoint.SubTitle +
        SiliconFlow.ExampleEndpoint,
      placeholder: () => SiliconFlow.ExampleEndpoint,
    },
    {
      key: "siliconflowApiKey",
      field: "api-key",
      kind: "password",
      title: () => Locale.Settings.Access.SiliconFlow.ApiKey.Title,
      description: () => Locale.Settings.Access.SiliconFlow.ApiKey.SubTitle,
      placeholder: () => Locale.Settings.Access.SiliconFlow.ApiKey.Placeholder,
    },
  ],
  [ServiceProvider["302.AI"]]: [
    {
      key: "ai302Url",
      field: "endpoint",
      kind: "text",
      title: () => Locale.Settings.Access.AI302.Endpoint.Title,
      description: () =>
        Locale.Settings.Access.AI302.Endpoint.SubTitle + AI302.ExampleEndpoint,
      placeholder: () => AI302.ExampleEndpoint,
    },
    {
      key: "ai302ApiKey",
      field: "api-key",
      kind: "password",
      title: () => Locale.Settings.Access.AI302.ApiKey.Title,
      description: () => Locale.Settings.Access.AI302.ApiKey.SubTitle,
      placeholder: () => Locale.Settings.Access.AI302.ApiKey.Placeholder,
    },
  ],
} as const satisfies Record<
  ServiceProvider,
  readonly ProviderFieldDefinition[]
>;

function providerFieldId(provider: ServiceProvider, field: string) {
  return `provider-${provider
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")}-${field}`;
}

export function ProviderConfig({
  provider,
  values,
  errors,
  onChange,
}: ProviderConfigProps) {
  const updateStringField = <K extends ProviderCredentialKey>(
    key: K,
    value: string,
  ) => onChange(key, value as ProviderCredentialSnapshot[K]);

  return (
    <>
      {PROVIDER_FIELDS[provider].map((field) => {
        const title = field.title();
        const value = values[field.key];

        return (
          <SettingRow
            key={field.key}
            id={providerFieldId(provider, field.field)}
            title={title}
            description={field.description()}
            error={errors[field.key]}
          >
            {field.kind === "select" ? (
              <Select
                aria-label={title}
                value={value}
                onChange={(event) =>
                  onChange(
                    field.key,
                    event.currentTarget
                      .value as ProviderCredentialSnapshot[typeof field.key],
                  )
                }
              >
                {Object.entries(GoogleSafetySettingsThreshold).map(
                  ([label, optionValue]) => (
                    <option value={optionValue} key={label}>
                      {label}
                    </option>
                  ),
                )}
              </Select>
            ) : field.kind === "password" ? (
              <PasswordInput
                aria={Locale.Settings.ShowPassword}
                aria-label={title}
                value={value}
                placeholder={field.placeholder?.()}
                onChange={(event) =>
                  updateStringField(field.key, event.currentTarget.value)
                }
              />
            ) : (
              <Input
                as="input"
                aria-label={title}
                type="text"
                value={value}
                placeholder={field.placeholder?.()}
                onChange={(event) =>
                  updateStringField(field.key, event.currentTarget.value)
                }
              />
            )}
          </SettingRow>
        );
      })}
    </>
  );
}
