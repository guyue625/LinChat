import { DEFAULT_MODELS, ServiceProvider } from "../constant";
import {
  DEFAULT_CONFIG,
  removeBuiltinModelEntries,
  sanitizeModelCatalogue,
} from "./config";

jest.mock("nanoid", () => ({ nanoid: () => "test-id" }));
jest.mock("../utils/indexedDB-storage", () => ({
  indexedDBStorage: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => undefined),
    removeItem: jest.fn(async () => undefined),
  },
}));

describe("empty-by-default model catalogue", () => {
  test("starts with no selected model or built-in catalogue", () => {
    expect(DEFAULT_CONFIG.models).toEqual([]);
    expect(DEFAULT_CONFIG.modelConfig.model).toBe("");
    expect(DEFAULT_CONFIG.modelConfig.providerName).toBe("");
  });

  test("removes built-in entries while preserving fetched custom entries", () => {
    const custom = {
      name: "company-model",
      available: true,
      sorted: 1,
      provider: {
        id: "anthropic",
        providerName: ServiceProvider.Anthropic,
        providerType: "anthropic",
        sorted: 1,
      },
    };

    expect(removeBuiltinModelEntries([DEFAULT_MODELS[0], custom])).toEqual([
      custom,
    ]);
  });

  test("clears a stale built-in selection when no model is configured", () => {
    const state = {
      models: [DEFAULT_MODELS[0]],
      customModels: "claude,claude-100k",
      modelConfig: {
        model: DEFAULT_MODELS[0].name,
        providerName: DEFAULT_MODELS[0].provider.providerName,
        compressModel: DEFAULT_MODELS[0].name,
        compressProviderName: DEFAULT_MODELS[0].provider.providerName,
      },
    };

    sanitizeModelCatalogue(state);

    expect(state.models).toEqual([]);
    expect(state.customModels).toBe("");
    expect(state.modelConfig).toMatchObject({
      model: "",
      providerName: "",
      compressModel: "",
      compressProviderName: "",
    });
  });

  test("keeps a built-in model name when it was explicitly configured", () => {
    const model = DEFAULT_MODELS[0];
    const state = {
      models: [model],
      customModels: `+${model.name}@${model.provider.providerName}`,
      modelConfig: {
        model: model.name,
        providerName: model.provider.providerName,
        compressModel: "",
        compressProviderName: "",
      },
    };

    sanitizeModelCatalogue(state);

    expect(state.models).toEqual([]);
    expect(state.modelConfig.model).toBe(model.name);
    expect(state.modelConfig.providerName).toBe(model.provider.providerName);
  });
});
