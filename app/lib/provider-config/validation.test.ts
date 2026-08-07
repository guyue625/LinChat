import { PROVIDER_IDS, getProviderDefinition } from "./registry";
import { validateProviderPatch } from "./validation";

describe("provider config registry", () => {
  it("registers every current provider", () => {
    expect(PROVIDER_IDS).toEqual([
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
    ]);
    expect(PROVIDER_IDS.every((id) => getProviderDefinition(id))).toBe(true);
  });
});

describe("validateProviderPatch", () => {
  it("normalizes a valid patch and preserves secret intent", () => {
    expect(
      validateProviderPatch("azure", {
        label: "  Azure 主线路  ",
        enabled: true,
        baseUrl: "https://azure.example.com/openai",
        apiKey: "secret",
        options: { apiVersion: "2025-01-01-preview" },
        models: [{ name: "gpt-4o", alias: "GPT 4o" }],
      }),
    ).toEqual({
      label: "Azure 主线路",
      enabled: true,
      baseUrl: "https://azure.example.com/openai",
      apiKey: "secret",
      options: { apiVersion: "2025-01-01-preview" },
      models: [{ name: "gpt-4o", alias: "GPT 4o" }],
    });

    expect(validateProviderPatch("azure", { clearApiKey: true })).toEqual({
      clearApiKey: true,
    });
  });

  it("rejects unknown providers and fields", () => {
    expect(() => validateProviderPatch("unknown", { enabled: true })).toThrow(
      "未知模型服务商",
    );
    expect(() => validateProviderPatch("openai", { unexpected: true })).toThrow(
      "不支持的配置字段",
    );
  });

  it.each(["ftp://example.com", "example.com", "javascript:alert(1)"])(
    "rejects a non-http base URL: %s",
    (baseUrl) => {
      expect(() => validateProviderPatch("openai", { baseUrl })).toThrow(
        "Base URL",
      );
    },
  );

  it("rejects unsupported credentials and options", () => {
    expect(() =>
      validateProviderPatch("google", { apiSecret: "secret" }),
    ).toThrow("不支持 API Secret");
    expect(() =>
      validateProviderPatch("google", {
        options: { apiVersion: "v1" },
      }),
    ).toThrow("不支持的扩展字段");
  });

  it("rejects ambiguous or oversized secrets", () => {
    expect(() => validateProviderPatch("openai", { apiKey: "" })).toThrow(
      "API Key 不能为空",
    );
    expect(() =>
      validateProviderPatch("openai", {
        apiKey: "x",
        clearApiKey: true,
      }),
    ).toThrow("不能同时设置和清除 API Key");
    expect(() =>
      validateProviderPatch("openai", { apiKey: "x".repeat(16 * 1024 + 1) }),
    ).toThrow("API Key 不能超过");
  });

  it("rejects duplicate and unsafe model names", () => {
    expect(() =>
      validateProviderPatch("openai", {
        models: [{ name: "gpt-4o" }, { name: "gpt-4o" }],
      }),
    ).toThrow("模型名称不能重复");
    expect(() =>
      validateProviderPatch("openai", {
        models: [{ name: "bad,model" }],
      }),
    ).toThrow("模型名称无效");
    expect(() =>
      validateProviderPatch("openai", {
        models: [{ name: "bad=model" }],
      }),
    ).toThrow("模型名称无效");
  });

  it("accepts null models as inheritance and an empty list as replacement", () => {
    expect(validateProviderPatch("openai", { models: null })).toEqual({
      models: null,
    });
    expect(validateProviderPatch("openai", { models: [] })).toEqual({
      models: [],
    });
  });
});
