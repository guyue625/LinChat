import type { DatabaseSync } from "node:sqlite";
import {
  decryptProviderSecret,
  encryptProviderSecret,
  type ProviderSecretField,
} from "./crypto";
import { getProviderDefinition, isProviderId, PROVIDER_IDS } from "./registry";
import type {
  ProviderExtra,
  ProviderId,
  ProviderPatch,
  ProviderRecord,
} from "./types";
import { validateProviderPatch } from "./validation";

type ProviderRow = {
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

export class ProviderConfigRepository {
  constructor(
    private readonly database: DatabaseSync,
    private readonly rootKey: Buffer,
  ) {}

  private readRow(id: ProviderId): ProviderRow | null {
    return (
      (this.database
        .prepare(
          `SELECT id, label, enabled, base_url, api_key, api_secret,
                  extra_json, updated_at
             FROM providers
            WHERE id = ?`,
        )
        .get(id) as ProviderRow | undefined) ?? null
    );
  }

  private decrypt(
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

  private decodeRow(row: ProviderRow): ProviderRecord {
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

  list(): ProviderRecord[] {
    const rows = this.database
      .prepare(
        `SELECT id, label, enabled, base_url, api_key, api_secret,
                extra_json, updated_at
           FROM providers`,
      )
      .all() as ProviderRow[];
    const records = new Map(
      rows.map((row) => {
        const decoded = this.decodeRow(row);
        return [decoded.id, decoded] as const;
      }),
    );
    return PROVIDER_IDS.flatMap((id) => {
      const record = records.get(id);
      return record ? [record] : [];
    });
  }

  get(id: ProviderId): ProviderRecord | null {
    const row = this.readRow(id);
    return row ? this.decodeRow(row) : null;
  }

  getSecret(id: ProviderId, field: ProviderSecretField): string | undefined {
    const row = this.readRow(id);
    if (!row) return undefined;
    const encrypted = field === "apiKey" ? row.api_key : row.api_secret;
    return encrypted ? this.decrypt(id, field, encrypted) : undefined;
  }

  snapshot(id: ProviderId) {
    const row = this.readRow(id);
    return { id, row: row ? { ...row } : null };
  }

  restore(snapshot: ReturnType<ProviderConfigRepository["snapshot"]>) {
    const { id, row } = snapshot;
    if (!row) {
      this.database.prepare("DELETE FROM providers WHERE id = ?").run(id);
      return;
    }
    if (row.id !== id) throw new CorruptProviderConfigError(id);
    this.decodeRow(row);
    this.database
      .prepare(
        `INSERT INTO providers
          (id, label, enabled, base_url, api_key, api_secret, extra_json, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           label = excluded.label,
           enabled = excluded.enabled,
           base_url = excluded.base_url,
           api_key = excluded.api_key,
           api_secret = excluded.api_secret,
           extra_json = excluded.extra_json,
           updated_at = excluded.updated_at`,
      )
      .run(
        row.id,
        row.label,
        row.enabled,
        row.base_url,
        row.api_key,
        row.api_secret,
        row.extra_json,
        row.updated_at,
      );
  }

  upsert(id: ProviderId, patch: ProviderPatch): ProviderRecord {
    const definition = getProviderDefinition(id);
    if (!definition) throw new Error("未知模型服务商");
    const validated = validateProviderPatch(id, patch);

    this.database.exec("BEGIN IMMEDIATE");
    try {
      const currentRow = this.readRow(id);
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
      this.database
        .prepare(
          `INSERT INTO providers
            (id, label, enabled, base_url, api_key, api_secret, extra_json, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             label = excluded.label,
             enabled = excluded.enabled,
             base_url = excluded.base_url,
             api_key = excluded.api_key,
             api_secret = excluded.api_secret,
             extra_json = excluded.extra_json,
             updated_at = excluded.updated_at`,
        )
        .run(
          id,
          label,
          enabled ? 1 : 0,
          baseUrl,
          apiKey,
          apiSecret,
          JSON.stringify(extra),
          updatedAt,
        );
      this.database.exec("COMMIT");
      return this.get(id) as ProviderRecord;
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  delete(id: ProviderId): boolean {
    return (
      this.database.prepare("DELETE FROM providers WHERE id = ?").run(id)
        .changes > 0
    );
  }
}
