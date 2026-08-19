import path from "node:path";
import ts from "typescript";

import {
  buildSettingsSearchEntries,
  DEFAULT_SETTINGS_SUBPAGES,
  SETTINGS_PROVIDER_SEARCH_DEFINITIONS,
  SETTINGS_SUBPAGES_BY_CATEGORY,
  resolveSettingsLocation,
  searchSettingsEntries,
  type SettingsSearchEntry,
} from "./settings-schema";

const localeSettings = {
  Category: {
    General: { Title: "General", SubTitle: "General preferences" },
    Model: { Title: "Models", SubTitle: "Model preferences" },
    Appearance: { Title: "Appearance", SubTitle: "Appearance preferences" },
    Voice: { Title: "Voice", SubTitle: "Voice preferences" },
    Assistants: { Title: "Assistants", SubTitle: "Assistant preferences" },
    Data: { Title: "Data", SubTitle: "Data preferences" },
  },
  Section: {
    Provider: "Provider access",
    DefaultModel: "Default model",
    Realtime: "Realtime voice",
    TTS: "Text-to-speech",
    Assistants: "Assistant preferences",
    Prompts: "Prompts",
    Sync: "Sync and backup",
    Danger: "Danger zone",
  },
  Theme: "Theme",
  Access: {
    Provider: {
      Title: "Model provider",
      SubTitle: "Provider configuration",
    },
    OpenAI: {
      ApiKey: {
        Title: "OpenAI API Key",
        SubTitle: "OpenAI interface credential",
      },
    },
    Azure: {
      ApiVerion: {
        Title: "Azure API Version",
        SubTitle: "Azure API version setting",
      },
    },
    Google: {
      GoogleSafetySettings: {
        Title: "Google Safety Settings",
        SubTitle: "Google content safety level",
      },
    },
    Baidu: {
      ApiKey: {
        Title: "   ",
        SubTitle: 42,
      },
    },
    Iflytek: {
      ApiSecret: {
        Title: "Iflytek API Secret",
        SubTitle: "Iflytek secret credential",
      },
    },
    AI302: {
      ApiKey: {
        Title: "302.AI API Key",
        SubTitle: "302.AI interface credential",
      },
    },
  },
};

function getReadonlyMutationDiagnostics() {
  const fileName = path.join(
    process.cwd(),
    "app/components/settings-schema-readonly-check.ts",
  );
  const source = `
    import {
      DEFAULT_SETTINGS_SUBPAGES,
      SETTINGS_PROVIDER_SEARCH_DEFINITIONS,
      SETTINGS_SUBPAGES_BY_CATEGORY,
    } from "./settings-schema";

    DEFAULT_SETTINGS_SUBPAGES.general = "appearance";
    SETTINGS_SUBPAGES_BY_CATEGORY.model = ["appearance"];
    SETTINGS_PROVIDER_SEARCH_DEFINITIONS[0].provider = "changed";
    SETTINGS_PROVIDER_SEARCH_DEFINITIONS[0].fields = [];
  `;
  const compilerOptions: ts.CompilerOptions = {
    module: ts.ModuleKind.CommonJS,
    moduleResolution: ts.ModuleResolutionKind.NodeJs,
    noEmit: true,
    skipLibCheck: true,
    strict: true,
    target: ts.ScriptTarget.ES2020,
  };
  const host = ts.createCompilerHost(compilerOptions);
  const getSourceFile = host.getSourceFile.bind(host);
  const isVirtualFile = (candidate: string) =>
    path.resolve(candidate) === path.resolve(fileName);

  host.fileExists = (candidate) =>
    isVirtualFile(candidate) || ts.sys.fileExists(candidate);
  host.readFile = (candidate) =>
    isVirtualFile(candidate) ? source : ts.sys.readFile(candidate);
  host.getSourceFile = (
    candidate,
    languageVersion,
    onError,
    shouldCreateNewSourceFile,
  ) =>
    isVirtualFile(candidate)
      ? ts.createSourceFile(candidate, source, languageVersion, true)
      : getSourceFile(
          candidate,
          languageVersion,
          onError,
          shouldCreateNewSourceFile,
        );

  const program = ts.createProgram([fileName], compilerOptions, host);
  return ts
    .getPreEmitDiagnostics(program)
    .filter(
      (diagnostic) =>
        diagnostic.file && isVirtualFile(diagnostic.file.fileName),
    )
    .map((diagnostic) =>
      ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
    );
}

const entries: SettingsSearchEntry[] = [
  {
    id: "provider-openai-api-key",
    category: "model",
    subpage: "model-providers",
    title: "API Key",
    description: "OpenAI 接口密钥",
    keywords: ["密钥", "openai"],
  },
  {
    id: "appearance-theme",
    category: "appearance",
    subpage: "appearance",
    title: "主题",
    description: "浅色、暗色或跟随系统",
    keywords: ["外观", "dark", "light"],
  },
];

describe("settings schema", () => {
  it("exposes deeply readonly schema constants", () => {
    const diagnostics = getReadonlyMutationDiagnostics();

    expect(diagnostics).toHaveLength(4);
    expect(diagnostics).toEqual(
      expect.arrayContaining([
        "Cannot assign to 'general' because it is a read-only property.",
        "Cannot assign to 'model' because it is a read-only property.",
        "Cannot assign to 'provider' because it is a read-only property.",
        "Cannot assign to 'fields' because it is a read-only property.",
      ]),
    );
  });

  it("falls back to the category default subpage", () => {
    expect(resolveSettingsLocation("model", "unknown")).toEqual({
      category: "model",
      subpage: DEFAULT_SETTINGS_SUBPAGES.model,
    });
  });

  it("rejects subpages that belong to another category", () => {
    expect(resolveSettingsLocation("voice", "data-danger")).toEqual({
      category: "voice",
      subpage: DEFAULT_SETTINGS_SUBPAGES.voice,
    });
    expect(resolveSettingsLocation(null, null)).toEqual({
      category: "general",
      subpage: DEFAULT_SETTINGS_SUBPAGES.general,
    });
  });

  it("matches titles and aliases and groups loose suggestions separately", () => {
    expect(searchSettingsEntries(entries, "密钥").results[0].id).toBe(
      "provider-openai-api-key",
    );
    expect(searchSettingsEntries(entries, "them").results[0].id).toBe(
      "appearance-theme",
    );
  });

  it("returns loose matches as suggestions only", () => {
    expect(searchSettingsEntries(entries, "tme")).toEqual({
      results: [],
      suggestions: [entries[1]],
    });
  });

  it("returns no matches for an empty query", () => {
    expect(searchSettingsEntries(entries, "  ")).toEqual({
      results: [],
      suggestions: [],
    });
  });

  it("builds the complete stable search registry from locale settings", () => {
    const registry = buildSettingsSearchEntries(localeSettings);
    const ids = registry.map(({ id }) => id);
    const expectedIds = [
      "general-avatar",
      "general-update",
      "general-send-key",
      "general-auto-title",
      "general-artifacts",
      "general-code-fold",
      "model-access-code",
      "model-custom-endpoint",
      "model-provider",
      "model-usage",
      "model-custom-models",
      "model-default",
      "model-temperature",
      "model-top-p",
      "model-max-tokens",
      "model-presence-penalty",
      "model-frequency-penalty",
      "model-system-prompt",
      "model-input-template",
      "model-history-count",
      "model-compress-threshold",
      "model-memory",
      "model-compress-model",
      "appearance-theme",
      "appearance-language",
      "appearance-font-size",
      "appearance-font-family",
      "voice-realtime-enable",
      "voice-realtime-provider",
      "voice-realtime-model",
      "voice-realtime-api-key",
      "voice-realtime-azure-endpoint",
      "voice-realtime-azure-deployment",
      "voice-realtime-voice",
      "voice-realtime-temperature",
      "voice-tts-enable",
      "voice-tts-engine",
      "voice-tts-model",
      "voice-tts-voice",
      "voice-tts-speed",
      "assistants-splash",
      "assistants-builtin",
      "prompts-autocomplete",
      "prompts-list",
      "data-cloud-sync",
      "data-local-transfer",
      "data-reset-settings",
      "data-clear-all",
      "provider-openai-endpoint",
      "provider-openai-api-key",
      "provider-azure-endpoint",
      "provider-azure-api-key",
      "provider-azure-api-version",
      "provider-google-endpoint",
      "provider-google-api-key",
      "provider-google-api-version",
      "provider-google-safety-settings",
      "provider-anthropic-endpoint",
      "provider-anthropic-api-key",
      "provider-anthropic-api-version",
      "provider-baidu-endpoint",
      "provider-baidu-api-key",
      "provider-baidu-secret-key",
      "provider-tencent-endpoint",
      "provider-tencent-api-key",
      "provider-tencent-secret-key",
      "provider-bytedance-endpoint",
      "provider-bytedance-api-key",
      "provider-alibaba-endpoint",
      "provider-alibaba-api-key",
      "provider-moonshot-endpoint",
      "provider-moonshot-api-key",
      "provider-deepseek-endpoint",
      "provider-deepseek-api-key",
      "provider-xai-endpoint",
      "provider-xai-api-key",
      "provider-chatglm-endpoint",
      "provider-chatglm-api-key",
      "provider-siliconflow-endpoint",
      "provider-siliconflow-api-key",
      "provider-stability-endpoint",
      "provider-stability-api-key",
      "provider-iflytek-endpoint",
      "provider-iflytek-api-key",
      "provider-iflytek-api-secret",
      "provider-302-ai-endpoint",
      "provider-302-ai-api-key",
    ];

    const providerFieldCount = SETTINGS_PROVIDER_SEARCH_DEFINITIONS.reduce(
      (count, provider) => count + provider.fields.length,
      0,
    );

    expect(ids).toHaveLength(87);
    expect(ids).toEqual(expectedIds);
    expect(new Set(ids).size).toBe(ids.length);
    expect(SETTINGS_PROVIDER_SEARCH_DEFINITIONS).toHaveLength(16);
    expect(providerFieldCount).toBe(39);
    expect(registry.find(({ id }) => id === "appearance-theme")).toMatchObject({
      title: localeSettings.Theme,
      description: localeSettings.Category.Appearance.SubTitle,
    });
    expect(
      registry.find(({ id }) => id === "provider-openai-api-key"),
    ).toMatchObject({
      title: localeSettings.Access.OpenAI.ApiKey.Title,
      description: localeSettings.Access.OpenAI.ApiKey.SubTitle,
    });
    registry.forEach((entry) => {
      expect(SETTINGS_SUBPAGES_BY_CATEGORY[entry.category]).toContain(
        entry.subpage,
      );
      expect(entry.title).not.toBe("");
      expect(entry.description).not.toBe("");
      expect(entry.keywords.length).toBeGreaterThan(0);
    });
  });

  it("resolves special provider locale paths", () => {
    const registry = buildSettingsSearchEntries(localeSettings);
    const entry = (id: string) => registry.find((item) => item.id === id);

    expect(entry("provider-azure-api-version")).toMatchObject({
      title: localeSettings.Access.Azure.ApiVerion.Title,
      description: localeSettings.Access.Azure.ApiVerion.SubTitle,
    });
    expect(entry("provider-google-safety-settings")).toMatchObject({
      title: localeSettings.Access.Google.GoogleSafetySettings.Title,
      description: localeSettings.Access.Google.GoogleSafetySettings.SubTitle,
    });
    expect(entry("provider-iflytek-api-secret")).toMatchObject({
      title: localeSettings.Access.Iflytek.ApiSecret.Title,
      description: localeSettings.Access.Iflytek.ApiSecret.SubTitle,
    });
    expect(entry("provider-302-ai-api-key")).toMatchObject({
      title: localeSettings.Access.AI302.ApiKey.Title,
      description: localeSettings.Access.AI302.ApiKey.SubTitle,
    });
  });

  it("falls back safely for blank or invalid locale values", () => {
    const entry = buildSettingsSearchEntries(localeSettings).find(
      ({ id }) => id === "provider-baidu-api-key",
    );

    expect(entry).toMatchObject({
      title: localeSettings.Section.Provider,
      description: localeSettings.Category.Model.SubTitle,
    });
  });
});
