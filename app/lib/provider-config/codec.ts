import {
  decryptProviderSecret,
  encryptProviderSecret,
  type ProviderSecretField,
} from "./crypto";
import { getProviderDefinition, isProviderId } from "./registry";
import type {
  ProviderExtra,
  ProviderId,
  ProviderPatch,
  ProviderRecord,
} from "./types";
import { validateProviderPatch } from "./validation";

export type ProviderRow = {
  id: string;
  label: string;
  enabled: number;
  base_url: string | null;
  api_key: string | null;
  api_secret: string | null;
  extra_json: string | null;
  updated_at: string;
};

const EMPTY_EXTRA: ProviderExtra = {
  version: 1,
  options: {},
  models: null,
};

export class CorruptProviderConfigError extends Error {
  constructor(readonly providerId: string) {
    super("模型服务商配置无法读取");
    this.name = "CorruptProviderConfigError";
  }
}

export class ProviderRowCodec {
  constructor(protected readonly rootKey: Buffer) {}
  protected decrypt(
    id: ProviderId,
    field: ProviderSecretField,
    encrypted: string,
  ): string {
    try {
      return decryptProviderSecret({
        rootKey: this.rootKey,
        providerId: id,
        field,
        encrypted,
      });
    } catch {
      throw new CorruptProviderConfigError(id);
    }
  }

  protected decodeRow(row: ProviderRow): ProviderRecord {
    if (!isProviderId(row.id) || (row.enabled !== 0 && row.enabled !== 1)) {
      throw new CorruptProviderConfigError(row.id);
    }
    try {
      const updatedAt = new Date(row.updated_at);
      if (
        Number.isNaN(updatedAt.getTime()) ||
        updatedAt.toISOString() !== row.updated_at
      ) {
        throw new Error("invalid timestamp");
      }
      const parsed = row.extra_json
        ? (JSON.parse(row.extra_json) as unknown)
        : EMPTY_EXTRA;
      if (
        !parsed ||
        typeof parsed !== "object" ||
        Array.isArray(parsed) ||
        (parsed as { version?: unknown }).version !== 1
      ) {
        throw new Error("invalid extra");
      }
      if (
        row.extra_json &&
        Object.keys(parsed).sort().join(",") !== "models,options,version"
      ) {
        throw new Error("invalid extra shape");
      }
      const extraObject = parsed as {
        options?: unknown;
        models?: unknown;
      };
      const normalized = validateProviderPatch(row.id, {
        label: row.label,
        enabled: Boolean(row.enabled),
        baseUrl: row.base_url,
        options: extraObject.options,
        models: extraObject.models,
      });
      if (row.api_key) this.decrypt(row.id, "apiKey", row.api_key);
      if (row.api_secret) this.decrypt(row.id, "apiSecret", row.api_secret);
      return {
        id: row.id,
        label: normalized.label as string,
        enabled: normalized.enabled as boolean,
        baseUrl: normalized.baseUrl ?? null,
        hasApiKey: Boolean(row.api_key),
        hasApiSecret: Boolean(row.api_secret),
        extra: {
          version: 1,
          options: normalized.options ?? {},
          models: normalized.models ?? null,
        },
        updatedAt: row.updated_at,
      };
    } catch (error) {
      if (error instanceof CorruptProviderConfigError) throw error;
      throw new CorruptProviderConfigError(row.id);
    }
  }

  protected buildRow(
    id: ProviderId,
    patch: ProviderPatch,
    currentRow: ProviderRow | null,
  ): ProviderRow {
    const definition = getProviderDefinition(id);
    if (!definition) throw new Error("???????");
    const validated = validateProviderPatch(id, patch);
    const current = currentRow ? this.decodeRow(currentRow) : null;
    const label = validated.label ?? current?.label ?? definition.label;
    const enabled = validated.enabled ?? current?.enabled ?? true;
    const baseUrl =
      validated.baseUrl !== undefined
        ? validated.baseUrl
        : current?.baseUrl ?? null;
    const extra: ProviderExtra = {
      version: 1,
      options:
        validated.options !== undefined
          ? validated.options
          : current?.extra.options ?? {},
      models:
        validated.models !== undefined
          ? validated.models
          : current?.extra.models ?? null,
    };

    let apiKey = currentRow?.api_key ?? null;
    let apiSecret = currentRow?.api_secret ?? null;
    if (validated.apiKey !== undefined) {
      apiKey = encryptProviderSecret({
        rootKey: this.rootKey,
        providerId: id,
        field: "apiKey",
        plaintext: validated.apiKey,
      });
    } else if (validated.clearApiKey) {
      apiKey = null;
    }
    if (validated.apiSecret !== undefined) {
      apiSecret = encryptProviderSecret({
        rootKey: this.rootKey,
        providerId: id,
        field: "apiSecret",
        plaintext: validated.apiSecret,
      });
    } else if (validated.clearApiSecret) {
      apiSecret = null;
    }

    const updatedAt = new Date().toISOString();
    return {
      id,
      label,
      enabled: enabled ? 1 : 0,
      base_url: baseUrl,
      api_key: apiKey,
      api_secret: apiSecret,
      extra_json: JSON.stringify(extra),
      updated_at: updatedAt,
    };
  }
}
