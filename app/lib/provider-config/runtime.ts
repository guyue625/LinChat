import {
  getServerSideConfig,
  type ServerSideConfig,
} from "../../config/server";
import { DEFAULT_MODELS } from "../../constant";
import { collectModelTable } from "../../utils/model";
import { PROVIDER_DEFINITIONS, type ProviderDefinition } from "./registry";
import { getRuntimeProviderConfigRepository } from "./server";
import type { ProviderId, ProviderModel, ProviderRecord } from "./types";

export type RuntimeProviderRecord = ProviderRecord & {
  apiKey?: string;
  apiSecret?: string;
};

export type RuntimeServerSideConfig = ServerSideConfig & {
  providerEnabled: Record<ProviderId, boolean>;
};

function modelToken(
  prefix: "+" | "-",
  name: string,
  providerId: string,
  alias?: string,
) {
  return `${prefix}${name}@${providerId}${
    prefix === "+" && alias ? `=${alias}` : ""
  }`;
}

function overrideProviderModels(
  customModels: string,
  definition: ProviderDefinition,
  models: ProviderModel[],
): string {
  const table = collectModelTable(DEFAULT_MODELS, customModels);
  const names = new Set(
    Object.values(table)
      .filter(
        (model) =>
          model.provider?.id.toLowerCase() ===
          definition.modelProviderId.toLowerCase(),
      )
      .map((model) => model.name),
  );
  const tokens = customModels
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);
  for (const name of names) {
    tokens.push(modelToken("-", name, definition.modelProviderId));
  }
  for (const model of models) {
    tokens.push(
      modelToken("+", model.name, definition.modelProviderId, model.alias),
    );
  }
  return tokens.join(",");
}

export function resolveProviderRuntimeConfig(
  environmentConfig: ServerSideConfig,
  records: readonly RuntimeProviderRecord[],
): RuntimeServerSideConfig {
  const result = {
    ...environmentConfig,
    providerEnabled: {} as Record<ProviderId, boolean>,
  } as RuntimeServerSideConfig;
  const mutable = result as unknown as Record<string, unknown>;
  const recordMap = new Map(records.map((record) => [record.id, record]));

  for (const definition of PROVIDER_DEFINITIONS) {
    const record = recordMap.get(definition.id);
    const enabled = record ? record.enabled : true;
    result.providerEnabled[definition.id] = enabled;

    if (!record) continue;
    if (record.baseUrl) {
      mutable[definition.runtime.baseUrlKey] = record.baseUrl;
    }
    if (record.apiKey) {
      mutable[definition.runtime.apiKeyKey] = record.apiKey;
    }
    if (record.apiSecret && definition.runtime.apiSecretKey) {
      mutable[definition.runtime.apiSecretKey] = record.apiSecret;
    }
    for (const option of definition.options) {
      const value = record.extra.options[option.key];
      if (value) mutable[option.runtimeKey] = value;
    }
    if (definition.runtime.enabledKey) {
      mutable[definition.runtime.enabledKey] = enabled;
    }

    if (!enabled) {
      mutable[definition.runtime.apiKeyKey] = undefined;
      if (definition.runtime.apiSecretKey) {
        mutable[definition.runtime.apiSecretKey] = undefined;
      }
    }
    if (!enabled || record.extra.models !== null) {
      result.customModels = overrideProviderModels(
        result.customModels,
        definition,
        enabled ? record.extra.models ?? [] : [],
      );
    }
  }
  return result;
}

export async function getRuntimeServerSideConfig(): Promise<RuntimeServerSideConfig> {
  const repository = await getRuntimeProviderConfigRepository();
  if (!repository) {
    return resolveProviderRuntimeConfig(getServerSideConfig(), []);
  }
  const records = repository.list().map((record) => ({
    ...record,
    apiKey: record.hasApiKey
      ? repository.getSecret(record.id, "apiKey")
      : undefined,
    apiSecret: record.hasApiSecret
      ? repository.getSecret(record.id, "apiSecret")
      : undefined,
  }));
  return resolveProviderRuntimeConfig(getServerSideConfig(), records);
}
