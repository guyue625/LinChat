import { GoogleSafetySettingsThreshold, ServiceProvider } from "../constant";
import {
  createProviderCredentialSnapshot,
  getProviderCredentialPatch,
  getProviderUpstreamSource,
  isProviderCredentialDirty,
  PROVIDER_CREDENTIAL_KEYS,
  validateProviderDraft,
  type ProviderCredentialSnapshot,
} from "./provider-config-draft";

type AccessState = Parameters<typeof createProviderCredentialSnapshot>[0];

const BASE_ACCESS_STATE = {
  openaiUrl: "https://api.openai.com",
  openaiApiKey: "saved-key",
  azureUrl: "https://azure.example.com",
  azureApiKey: "azure-key",
  azureApiVersion: "2024-10-21",
  googleUrl: "https://google.example.com",
  googleApiKey: "google-key",
  googleApiVersion: "v1",
  googleSafetySettings: GoogleSafetySettingsThreshold.BLOCK_ONLY_HIGH,
  anthropicUrl: "https://anthropic.example.com",
  anthropicApiKey: "anthropic-key",
  anthropicApiVersion: "2023-06-01",
  baiduUrl: "https://baidu.example.com",
  baiduApiKey: "baidu-key",
  baiduSecretKey: "baidu-secret",
  bytedanceUrl: "https://bytedance.example.com",
  bytedanceApiKey: "bytedance-key",
  alibabaUrl: "https://alibaba.example.com",
  alibabaApiKey: "alibaba-key",
  tencentUrl: "https://tencent.example.com",
  tencentSecretId: "tencent-id",
  tencentSecretKey: "tencent-secret",
  moonshotUrl: "https://moonshot.example.com",
  moonshotApiKey: "moonshot-key",
  stabilityUrl: "https://stability.example.com",
  stabilityApiKey: "stability-key",
  iflytekUrl: "https://iflytek.example.com",
  iflytekApiKey: "iflytek-key",
  iflytekApiSecret: "iflytek-secret",
  deepseekUrl: "https://deepseek.example.com",
  deepseekApiKey: "deepseek-key",
  xaiUrl: "https://xai.example.com",
  xaiApiKey: "xai-key",
  chatglmUrl: "https://chatglm.example.com",
  chatglmApiKey: "chatglm-key",
  siliconflowUrl: "https://siliconflow.example.com",
  siliconflowApiKey: "siliconflow-key",
  ai302Url: "https://302.example.com",
  ai302ApiKey: "302-key",
  accessCode: "server-only",
  update: jest.fn(),
} as unknown as AccessState;

function createAccessState(overrides: Partial<AccessState> = {}): AccessState {
  return {
    ...BASE_ACCESS_STATE,
    ...overrides,
  };
}

function createDraft(
  overrides: Partial<ProviderCredentialSnapshot> = {},
): ProviderCredentialSnapshot {
  return {
    ...createProviderCredentialSnapshot(createAccessState()),
    ...overrides,
  };
}

describe("provider credential draft", () => {
  it("maps every provider to an explicit credential field list", () => {
    expect(PROVIDER_CREDENTIAL_KEYS).toEqual({
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
    });
  });

  it("copies credential fields without store methods", () => {
    const draft = createProviderCredentialSnapshot(createAccessState());

    expect(draft.openaiApiKey).toBe("saved-key");
    expect(draft).not.toHaveProperty("update");
    expect(draft).not.toHaveProperty("accessCode");
  });

  it("only emits fields for the selected provider", () => {
    const draft = createDraft();

    expect(getProviderCredentialPatch(ServiceProvider.OpenAI, draft)).toEqual({
      openaiUrl: draft.openaiUrl,
      openaiApiKey: draft.openaiApiKey,
    });
  });

  it("rejects non-http endpoints but allows an empty key", () => {
    const errors = validateProviderDraft(ServiceProvider.OpenAI, {
      ...createDraft(),
      openaiUrl: "ftp://bad",
      openaiApiKey: "",
    });

    expect(errors).toHaveProperty("openaiUrl");
    expect(errors).not.toHaveProperty("openaiApiKey");
    expect(
      validateProviderDraft(ServiceProvider.OpenAI, {
        ...createDraft(),
        openaiUrl: "https://api.example.com/v1",
        openaiApiKey: "",
      }),
    ).toEqual({});
  });

  it("requires the current provider endpoint when any secret is present", () => {
    const errors = validateProviderDraft(ServiceProvider.Baidu, {
      ...createDraft(),
      baiduUrl: "  ",
      baiduApiKey: "",
      baiduSecretKey: "baidu-secret",
    });

    expect(errors).toHaveProperty("baiduUrl");
  });

  it("builds Azure and Tencent upstream sources from draft values", () => {
    const draft = createDraft();

    expect(getProviderUpstreamSource(ServiceProvider.Azure, draft)).toEqual({
      provider: ServiceProvider.Azure,
      baseUrl: draft.azureUrl,
      apiKey: draft.azureApiKey,
      apiVersion: draft.azureApiVersion,
    });
    expect(getProviderUpstreamSource(ServiceProvider.Tencent, draft)).toEqual({
      provider: ServiceProvider.Tencent,
      baseUrl: draft.tencentUrl,
      apiKey: draft.tencentSecretId,
    });
  });

  it("compares only current provider fields without trimming", () => {
    const saved = createDraft();

    expect(
      isProviderCredentialDirty(ServiceProvider.OpenAI, saved, {
        ...saved,
        azureApiKey: "changed-elsewhere",
      }),
    ).toBe(false);
    expect(
      isProviderCredentialDirty(ServiceProvider.OpenAI, saved, {
        ...saved,
        openaiApiKey: ` ${saved.openaiApiKey}`,
      }),
    ).toBe(true);
  });

  it("trims saved strings while preserving Google safety enum values", () => {
    const draft = createDraft({
      openaiUrl: "  https://api.example.com/v1  ",
      openaiApiKey: "  draft-key  ",
      googleSafetySettings:
        GoogleSafetySettingsThreshold.BLOCK_MEDIUM_AND_ABOVE,
    });

    expect(getProviderCredentialPatch(ServiceProvider.OpenAI, draft)).toEqual({
      openaiUrl: "https://api.example.com/v1",
      openaiApiKey: "draft-key",
    });

    const googlePatch = getProviderCredentialPatch(
      ServiceProvider.Google,
      draft,
    );
    const safety: GoogleSafetySettingsThreshold | undefined =
      googlePatch.googleSafetySettings;
    expect(safety).toBe(GoogleSafetySettingsThreshold.BLOCK_MEDIUM_AND_ABOVE);
  });
});
