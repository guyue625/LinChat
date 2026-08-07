import { ServiceProvider } from "../../constant";
import { isModelNotavailableInServer } from "../../utils/model";
import type { ServerSideConfig } from "../../config/server";
import type { RuntimeProviderRecord } from "./runtime";
import { resolveProviderRuntimeConfig } from "./runtime";

function environment(
  overrides: Partial<ServerSideConfig> = {},
): ServerSideConfig {
  return {
    customModels: "",
    baseUrl: "https://env.openai.example",
    apiKey: "env-openai-key",
    openaiOrgId: "env-org",
    azureUrl: "https://env.azure.example",
    azureApiKey: "env-azure-key",
    azureApiVersion: "2024-01-01",
    isAzure: true,
    googleUrl: "https://env.google.example",
    googleApiKey: "env-google-key",
    isGoogle: true,
    anthropicUrl: "https://env.anthropic.example",
    anthropicApiKey: "env-anthropic-key",
    anthropicApiVersion: "2023-06-01",
    isAnthropic: true,
    deepseekUrl: "https://env.deepseek.example",
    deepseekApiKey: "env-deepseek-key",
    isDeepSeek: true,
    ...overrides,
  } as ServerSideConfig;
}

function record(
  input: Partial<RuntimeProviderRecord> & Pick<RuntimeProviderRecord, "id">,
): RuntimeProviderRecord {
  return {
    label: input.id,
    enabled: true,
    baseUrl: null,
    hasApiKey: false,
    hasApiSecret: false,
    extra: { version: 1, options: {}, models: null },
    updatedAt: "2026-08-07T00:00:00.000Z",
    ...input,
  };
}

describe("resolveProviderRuntimeConfig", () => {
  it("preserves the environment baseline when no database record exists", () => {
    const result = resolveProviderRuntimeConfig(environment(), []);

    expect(result.baseUrl).toBe("https://env.openai.example");
    expect(result.apiKey).toBe("env-openai-key");
    expect(result.deepseekApiKey).toBe("env-deepseek-key");
    expect(result.providerEnabled).toMatchObject({
      openai: true,
      azure: true,
      google: true,
      anthropic: true,
      deepseek: true,
    });
  });

  it("keeps providers administratively enabled when only the system key is missing", () => {
    const result = resolveProviderRuntimeConfig(
      environment({ isGoogle: false, googleApiKey: undefined }),
      [],
    );

    expect(result.isGoogle).toBe(false);
    expect(result.googleApiKey).toBeUndefined();
    expect(result.providerEnabled.google).toBe(true);
  });

  it("overrides supplied database fields and falls back field by field", () => {
    const result = resolveProviderRuntimeConfig(environment(), [
      record({
        id: "azure",
        label: "Azure DB",
        baseUrl: "https://db.azure.example",
        apiKey: "db-azure-key",
        extra: {
          version: 1,
          options: { apiVersion: "2025-01-01-preview" },
          models: null,
        },
      }),
    ]);

    expect(result.azureUrl).toBe("https://db.azure.example");
    expect(result.azureApiKey).toBe("db-azure-key");
    expect(result.azureApiVersion).toBe("2025-01-01-preview");
    expect(result.providerEnabled.azure).toBe(true);
    expect(result.apiKey).toBe("env-openai-key");
  });

  it("disables a provider, clears system credentials and hides its models", () => {
    const result = resolveProviderRuntimeConfig(environment(), [
      record({ id: "openai", enabled: false }),
    ]);

    expect(result.providerEnabled.openai).toBe(false);
    expect(result.apiKey).toBeUndefined();
    expect(
      isModelNotavailableInServer(
        result.customModels,
        "gpt-4o",
        ServiceProvider.OpenAI,
      ),
    ).toBe(true);
  });

  it("treats a model array as authoritative for only that provider", () => {
    const result = resolveProviderRuntimeConfig(
      environment({
        customModels:
          "+env-openai@openai=Env OpenAI,+env-google@google=Env Google",
      }),
      [
        record({
          id: "openai",
          extra: {
            version: 1,
            options: {},
            models: [
              { name: "gpt-4o", alias: "Allowed 4o" },
              { name: "db-only" },
            ],
          },
        }),
      ],
    );

    expect(
      isModelNotavailableInServer(
        result.customModels,
        "env-openai",
        ServiceProvider.OpenAI,
      ),
    ).toBe(true);
    expect(
      isModelNotavailableInServer(
        result.customModels,
        "gpt-4o",
        ServiceProvider.OpenAI,
      ),
    ).toBe(false);
    expect(
      isModelNotavailableInServer(
        result.customModels,
        "db-only",
        ServiceProvider.OpenAI,
      ),
    ).toBe(false);
    expect(
      isModelNotavailableInServer(
        result.customModels,
        "env-google",
        ServiceProvider.Google,
      ),
    ).toBe(false);
    expect(result.customModels).toContain("+gpt-4o@openai=Allowed 4o");
  });

  it("uses an empty model list to hide all and null to inherit", () => {
    const hidden = resolveProviderRuntimeConfig(environment(), [
      record({
        id: "google",
        extra: { version: 1, options: {}, models: [] },
      }),
    ]);
    expect(
      isModelNotavailableInServer(
        hidden.customModels,
        "gemini-2.5-pro",
        ServiceProvider.Google,
      ),
    ).toBe(true);

    const inherited = resolveProviderRuntimeConfig(environment(), [
      record({
        id: "google",
        extra: { version: 1, options: {}, models: null },
      }),
    ]);
    expect(
      isModelNotavailableInServer(
        inherited.customModels,
        "gemini-2.5-pro",
        ServiceProvider.Google,
      ),
    ).toBe(false);
  });
});
