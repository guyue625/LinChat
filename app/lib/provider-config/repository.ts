import type { DatabaseSync } from "node:sqlite";
import type { ProviderSecretField } from "./crypto";
import { PROVIDER_IDS } from "./registry";
import type { ProviderId, ProviderPatch, ProviderRecord } from "./types";
import {
  ProviderRowCodec,
  CorruptProviderConfigError,
  type ProviderRow,
} from "./codec";
export { CorruptProviderConfigError } from "./codec";

export class ProviderConfigRepository extends ProviderRowCodec {
  constructor(
    private readonly database: DatabaseSync,
    rootKey: Buffer,
  ) {
    super(rootKey);
  }

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
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const row = this.buildRow(id, patch, this.readRow(id));
      this.restore({ id, row });
      this.database.exec("COMMIT");
      return this.decodeRow(row);
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
