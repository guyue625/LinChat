import Fuse, { type IFuseOptions } from "fuse.js";

export type SettingsCategory =
  | "general"
  | "model"
  | "appearance"
  | "voice"
  | "assistants"
  | "data";

export type SettingsSubpage =
  | "general"
  | "model-providers"
  | "model-catalog"
  | "model-defaults"
  | "appearance"
  | "voice-realtime"
  | "voice-tts"
  | "assistants"
  | "data-sync"
  | "data-transfer"
  | "data-danger";

export const DEFAULT_SETTINGS_SUBPAGES = {
  general: "general",
  model: "model-providers",
  appearance: "appearance",
  voice: "voice-realtime",
  assistants: "assistants",
  data: "data-sync",
} as const satisfies Readonly<Record<SettingsCategory, SettingsSubpage>>;

export const SETTINGS_SUBPAGES_BY_CATEGORY = {
  general: ["general"],
  model: ["model-providers", "model-catalog", "model-defaults"],
  appearance: ["appearance"],
  voice: ["voice-realtime", "voice-tts"],
  assistants: ["assistants"],
  data: ["data-sync", "data-transfer", "data-danger"],
} as const satisfies Readonly<
  Record<SettingsCategory, readonly SettingsSubpage[]>
>;

export interface SettingsSearchEntry {
  id: string;
  category: SettingsCategory;
  subpage: SettingsSubpage;
  title: string;
  description: string;
  keywords: string[];
}

export interface SettingsProviderSearchDefinition {
  readonly provider: string;
  readonly localeKey: string;
  readonly fields: readonly (readonly [field: string, localeKey: string])[];
}

export const SETTINGS_PROVIDER_SEARCH_DEFINITIONS = [
  {
    provider: "openai",
    localeKey: "OpenAI",
    fields: [
      ["endpoint", "Endpoint"],
      ["api-key", "ApiKey"],
    ],
  },
  {
    provider: "azure",
    localeKey: "Azure",
    fields: [
      ["endpoint", "Endpoint"],
      ["api-key", "ApiKey"],
      ["api-version", "ApiVerion"],
    ],
  },
  {
    provider: "google",
    localeKey: "Google",
    fields: [
      ["endpoint", "Endpoint"],
      ["api-key", "ApiKey"],
      ["api-version", "ApiVersion"],
      ["safety-settings", "GoogleSafetySettings"],
    ],
  },
  {
    provider: "anthropic",
    localeKey: "Anthropic",
    fields: [
      ["endpoint", "Endpoint"],
      ["api-key", "ApiKey"],
      ["api-version", "ApiVerion"],
    ],
  },
  {
    provider: "baidu",
    localeKey: "Baidu",
    fields: [
      ["endpoint", "Endpoint"],
      ["api-key", "ApiKey"],
      ["secret-key", "SecretKey"],
    ],
  },
  {
    provider: "tencent",
    localeKey: "Tencent",
    fields: [
      ["endpoint", "Endpoint"],
      ["api-key", "ApiKey"],
      ["secret-key", "SecretKey"],
    ],
  },
  {
    provider: "bytedance",
    localeKey: "ByteDance",
    fields: [
      ["endpoint", "Endpoint"],
      ["api-key", "ApiKey"],
    ],
  },
  {
    provider: "alibaba",
    localeKey: "Alibaba",
    fields: [
      ["endpoint", "Endpoint"],
      ["api-key", "ApiKey"],
    ],
  },
  {
    provider: "moonshot",
    localeKey: "Moonshot",
    fields: [
      ["endpoint", "Endpoint"],
      ["api-key", "ApiKey"],
    ],
  },
  {
    provider: "deepseek",
    localeKey: "DeepSeek",
    fields: [
      ["endpoint", "Endpoint"],
      ["api-key", "ApiKey"],
    ],
  },
  {
    provider: "xai",
    localeKey: "XAI",
    fields: [
      ["endpoint", "Endpoint"],
      ["api-key", "ApiKey"],
    ],
  },
  {
    provider: "chatglm",
    localeKey: "ChatGLM",
    fields: [
      ["endpoint", "Endpoint"],
      ["api-key", "ApiKey"],
    ],
  },
  {
    provider: "siliconflow",
    localeKey: "SiliconFlow",
    fields: [
      ["endpoint", "Endpoint"],
      ["api-key", "ApiKey"],
    ],
  },
  {
    provider: "stability",
    localeKey: "Stability",
    fields: [
      ["endpoint", "Endpoint"],
      ["api-key", "ApiKey"],
    ],
  },
  {
    provider: "iflytek",
    localeKey: "Iflytek",
    fields: [
      ["endpoint", "Endpoint"],
      ["api-key", "ApiKey"],
      ["api-secret", "ApiSecret"],
    ],
  },
  {
    provider: "302-ai",
    localeKey: "AI302",
    fields: [
      ["endpoint", "Endpoint"],
      ["api-key", "ApiKey"],
    ],
  },
] as const satisfies readonly SettingsProviderSearchDefinition[];

export type SettingsLocaleSource = Readonly<Record<string, unknown>>;

type SettingsEntryDefinition = readonly [
  id: string,
  category: SettingsCategory,
  subpage: SettingsSubpage,
  titlePath: string,
  descriptionPath?: string,
];

const SETTINGS_ENTRY_DEFINITIONS: readonly SettingsEntryDefinition[] = [
  ["general-avatar", "general", "general", "Avatar"],
  [
    "general-update",
    "general",
    "general",
    "Update.CheckUpdate",
    "Update.IsLatest",
  ],
  ["general-send-key", "general", "general", "SendKey"],
  [
    "general-auto-title",
    "general",
    "general",
    "AutoGenerateTitle.Title",
    "AutoGenerateTitle.SubTitle",
  ],
  [
    "general-artifacts",
    "general",
    "general",
    "SearchEntries.general-artifacts.Title",
    "SearchEntries.general-artifacts.SubTitle",
  ],
  [
    "general-code-fold",
    "general",
    "general",
    "SearchEntries.general-code-fold.Title",
    "SearchEntries.general-code-fold.SubTitle",
  ],
  [
    "model-access-code",
    "model",
    "model-providers",
    "Access.AccessCode.Title",
    "Access.AccessCode.SubTitle",
  ],
  [
    "model-custom-endpoint",
    "model",
    "model-providers",
    "Access.CustomEndpoint.Title",
    "Access.CustomEndpoint.SubTitle",
  ],
  [
    "model-provider",
    "model",
    "model-providers",
    "Access.Provider.Title",
    "Access.Provider.SubTitle",
  ],
  ["model-usage", "model", "model-providers", "Usage.Title", "Usage.NoAccess"],
  [
    "model-custom-models",
    "model",
    "model-catalog",
    "Access.CustomModel.Title",
    "Access.CustomModel.SubTitle",
  ],
  ["model-default", "model", "model-defaults", "Model"],
  [
    "model-temperature",
    "model",
    "model-defaults",
    "Temperature.Title",
    "Temperature.SubTitle",
  ],
  ["model-top-p", "model", "model-defaults", "TopP.Title", "TopP.SubTitle"],
  [
    "model-max-tokens",
    "model",
    "model-defaults",
    "MaxTokens.Title",
    "MaxTokens.SubTitle",
  ],
  [
    "model-presence-penalty",
    "model",
    "model-defaults",
    "PresencePenalty.Title",
    "PresencePenalty.SubTitle",
  ],
  [
    "model-frequency-penalty",
    "model",
    "model-defaults",
    "FrequencyPenalty.Title",
    "FrequencyPenalty.SubTitle",
  ],
  [
    "model-system-prompt",
    "model",
    "model-defaults",
    "InjectSystemPrompts.Title",
    "InjectSystemPrompts.SubTitle",
  ],
  [
    "model-input-template",
    "model",
    "model-defaults",
    "InputTemplate.Title",
    "InputTemplate.SubTitle",
  ],
  [
    "model-history-count",
    "model",
    "model-defaults",
    "HistoryCount.Title",
    "HistoryCount.SubTitle",
  ],
  [
    "model-compress-threshold",
    "model",
    "model-defaults",
    "CompressThreshold.Title",
    "CompressThreshold.SubTitle",
  ],
  [
    "model-memory",
    "model",
    "model-defaults",
    "SearchEntries.model-memory.Title",
    "SearchEntries.model-memory.SubTitle",
  ],
  [
    "model-compress-model",
    "model",
    "model-defaults",
    "CompressModel.Title",
    "CompressModel.SubTitle",
  ],
  ["appearance-theme", "appearance", "appearance", "Theme"],
  ["appearance-language", "appearance", "appearance", "Lang.Name"],
  [
    "appearance-font-size",
    "appearance",
    "appearance",
    "FontSize.Title",
    "FontSize.SubTitle",
  ],
  [
    "appearance-font-family",
    "appearance",
    "appearance",
    "FontFamily.Title",
    "FontFamily.SubTitle",
  ],
  [
    "voice-realtime-enable",
    "voice",
    "voice-realtime",
    "Realtime.Enable.Title",
    "Realtime.Enable.SubTitle",
  ],
  [
    "voice-realtime-provider",
    "voice",
    "voice-realtime",
    "Realtime.Provider.Title",
    "Realtime.Provider.SubTitle",
  ],
  [
    "voice-realtime-model",
    "voice",
    "voice-realtime",
    "Realtime.Model.Title",
    "Realtime.Model.SubTitle",
  ],
  [
    "voice-realtime-api-key",
    "voice",
    "voice-realtime",
    "Realtime.ApiKey.Title",
    "Realtime.ApiKey.SubTitle",
  ],
  [
    "voice-realtime-azure-endpoint",
    "voice",
    "voice-realtime",
    "Realtime.Azure.Endpoint.Title",
    "Realtime.Azure.Endpoint.SubTitle",
  ],
  [
    "voice-realtime-azure-deployment",
    "voice",
    "voice-realtime",
    "Realtime.Azure.Deployment.Title",
    "Realtime.Azure.Deployment.SubTitle",
  ],
  [
    "voice-realtime-voice",
    "voice",
    "voice-realtime",
    "TTS.Voice.Title",
    "TTS.Voice.SubTitle",
  ],
  [
    "voice-realtime-temperature",
    "voice",
    "voice-realtime",
    "Realtime.Temperature.Title",
    "Realtime.Temperature.SubTitle",
  ],
  [
    "voice-tts-enable",
    "voice",
    "voice-tts",
    "TTS.Enable.Title",
    "TTS.Enable.SubTitle",
  ],
  ["voice-tts-engine", "voice", "voice-tts", "TTS.Engine"],
  ["voice-tts-model", "voice", "voice-tts", "TTS.Model"],
  [
    "voice-tts-voice",
    "voice",
    "voice-tts",
    "TTS.Voice.Title",
    "TTS.Voice.SubTitle",
  ],
  [
    "voice-tts-speed",
    "voice",
    "voice-tts",
    "TTS.Speed.Title",
    "TTS.Speed.SubTitle",
  ],
  [
    "assistants-splash",
    "assistants",
    "assistants",
    "Mask.Splash.Title",
    "Mask.Splash.SubTitle",
  ],
  [
    "assistants-builtin",
    "assistants",
    "assistants",
    "Mask.Builtin.Title",
    "Mask.Builtin.SubTitle",
  ],
  [
    "prompts-autocomplete",
    "assistants",
    "assistants",
    "Prompt.Disable.Title",
    "Prompt.Disable.SubTitle",
  ],
  [
    "prompts-list",
    "assistants",
    "assistants",
    "Prompt.List",
    "Prompt.Modal.Search",
  ],
  [
    "data-cloud-sync",
    "data",
    "data-sync",
    "Sync.Config.Modal.Title",
    "Sync.Config.SyncType.SubTitle",
  ],
  [
    "data-local-transfer",
    "data",
    "data-transfer",
    "Sync.LocalState",
    "Sync.ImportFailed",
  ],
  [
    "data-reset-settings",
    "data",
    "data-danger",
    "Danger.Reset.Title",
    "Danger.Reset.SubTitle",
  ],
  [
    "data-clear-all",
    "data",
    "data-danger",
    "Danger.Clear.Title",
    "Danger.Clear.SubTitle",
  ],
];

interface SettingsSubpageLocale {
  title: string;
  description: string;
  keywords: string[];
}

function isLocaleRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getLocaleValue(
  locale: SettingsLocaleSource,
  path: readonly string[],
): unknown {
  let value: unknown = locale;
  for (const segment of path) {
    if (!isLocaleRecord(value)) return undefined;
    value = value[segment];
  }
  return value;
}

function getLocaleText(
  locale: SettingsLocaleSource,
  path: string | readonly string[],
  fallback: string,
) {
  const segments = typeof path === "string" ? path.split(".") : path;
  const value = getLocaleValue(locale, segments);
  return typeof value === "string" && value.trim() ? value : fallback;
}

function uniqueStrings(values: readonly string[]) {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean)),
  );
}

function createSearchEntry(
  locale: SettingsLocaleSource,
  id: string,
  category: SettingsCategory,
  subpage: SettingsSubpage,
  title: string,
  description: string,
  keywords: readonly string[],
): SettingsSearchEntry {
  const localizedTitle = getLocaleText(
    locale,
    ["SearchEntries", id, "Title"],
    title,
  );
  const localizedDescription = getLocaleText(
    locale,
    ["SearchEntries", id, "SubTitle"],
    description,
  );
  const localeKeywords = getLocaleValue(locale, [
    "SearchEntries",
    id,
    "Keywords",
  ]);

  return {
    id,
    category,
    subpage,
    title: localizedTitle,
    description: localizedDescription,
    keywords: uniqueStrings([
      localizedTitle,
      localizedDescription,
      ...keywords,
      ...(Array.isArray(localeKeywords)
        ? localeKeywords.filter(
            (keyword): keyword is string => typeof keyword === "string",
          )
        : []),
      id,
      id.replace(/-/g, " "),
      ...id.split("-"),
    ]),
  };
}

export function resolveSettingsLocation(
  categoryValue: string | null,
  subpageValue: string | null,
) {
  const category = (
    Object.keys(DEFAULT_SETTINGS_SUBPAGES).includes(categoryValue ?? "")
      ? categoryValue
      : "general"
  ) as SettingsCategory;
  const allowed: readonly SettingsSubpage[] =
    SETTINGS_SUBPAGES_BY_CATEGORY[category];
  const subpage = allowed.includes(subpageValue as SettingsSubpage)
    ? (subpageValue as SettingsSubpage)
    : DEFAULT_SETTINGS_SUBPAGES[category];
  return { category, subpage };
}

export function buildSettingsSearchEntries(
  locale: SettingsLocaleSource,
): SettingsSearchEntry[] {
  const category = (
    key: "General" | "Model" | "Appearance" | "Voice" | "Assistants" | "Data",
    fallback: SettingsCategory,
  ) => ({
    title: getLocaleText(locale, ["Category", key, "Title"], fallback),
    description: getLocaleText(locale, ["Category", key, "SubTitle"], fallback),
  });
  const categories = {
    general: category("General", "general"),
    model: category("Model", "model"),
    appearance: category("Appearance", "appearance"),
    voice: category("Voice", "voice"),
    assistants: category("Assistants", "assistants"),
    data: category("Data", "data"),
  };
  const section = (key: string, fallback: string) =>
    getLocaleText(locale, ["Section", key], fallback);
  const subpageLocale: Record<SettingsSubpage, SettingsSubpageLocale> = {
    general: { ...categories.general, keywords: [categories.general.title] },
    "model-providers": {
      title: section("Provider", categories.model.title),
      description: categories.model.description,
      keywords: [categories.model.title],
    },
    "model-catalog": {
      ...categories.model,
      keywords: [categories.model.title],
    },
    "model-defaults": {
      title: section("DefaultModel", categories.model.title),
      description: categories.model.description,
      keywords: [categories.model.title],
    },
    appearance: {
      ...categories.appearance,
      keywords: [categories.appearance.title],
    },
    "voice-realtime": {
      title: section("Realtime", categories.voice.title),
      description: categories.voice.description,
      keywords: [categories.voice.title],
    },
    "voice-tts": {
      title: section("TTS", categories.voice.title),
      description: categories.voice.description,
      keywords: [categories.voice.title],
    },
    assistants: {
      ...categories.assistants,
      keywords: [categories.assistants.title],
    },
    "data-sync": {
      title: section("Sync", categories.data.title),
      description: categories.data.description,
      keywords: [categories.data.title],
    },
    "data-transfer": { ...categories.data, keywords: [categories.data.title] },
    "data-danger": {
      title: section("Danger", categories.data.title),
      description: categories.data.description,
      keywords: [categories.data.title],
    },
  };
  const entries = SETTINGS_ENTRY_DEFINITIONS.map(
    ([id, entryCategory, subpage, titlePath, descriptionPath]) => {
      const fallback = subpageLocale[subpage];
      return createSearchEntry(
        locale,
        id,
        entryCategory,
        subpage,
        getLocaleText(locale, titlePath, fallback.title),
        descriptionPath
          ? getLocaleText(locale, descriptionPath, fallback.description)
          : fallback.description,
        fallback.keywords,
      );
    },
  );
  const providerFallback = subpageLocale["model-providers"];

  SETTINGS_PROVIDER_SEARCH_DEFINITIONS.forEach((provider) => {
    provider.fields.forEach(([field, localeKey]) => {
      entries.push(
        createSearchEntry(
          locale,
          `provider-${provider.provider}-${field}`,
          "model",
          "model-providers",
          getLocaleText(
            locale,
            ["Access", provider.localeKey, localeKey, "Title"],
            providerFallback.title,
          ),
          getLocaleText(
            locale,
            ["Access", provider.localeKey, localeKey, "SubTitle"],
            providerFallback.description,
          ),
          [
            ...providerFallback.keywords,
            provider.provider,
            provider.localeKey,
            field,
          ],
        ),
      );
    });
  });

  return entries;
}

export function searchSettingsEntries(
  entries: SettingsSearchEntry[],
  query: string,
) {
  const value = query.trim();
  if (!value) return { results: [], suggestions: [] };
  const options: IFuseOptions<SettingsSearchEntry> = {
    keys: ["id", "title", "description", "keywords"],
    ignoreLocation: true,
  };
  const results = new Fuse(entries, { ...options, threshold: 0.32 })
    .search(value)
    .map(({ item }) => item);
  const suggestions = results.length
    ? []
    : new Fuse(entries, { ...options, threshold: 0.6 })
        .search(value)
        .slice(0, 3)
        .map(({ item }) => item);
  return { results, suggestions };
}
