import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import {
  getMysqlExecutor,
  withMysqlTransaction,
} from "../db/mysql-transaction";
import {
  ProviderRowCodec,
  CorruptProviderConfigError,
  type ProviderRow,
} from "./codec";
import type { ProviderSecretField } from "./crypto";
import { PROVIDER_IDS } from "./registry";
import type { ProviderId, ProviderPatch } from "./types";

export class MysqlProviderConfigRepository extends ProviderRowCodec {
  private async readRow(id: ProviderId): Promise<ProviderRow | null> {
    const [rows] = await (
      await getMysqlExecutor()
    ).execute<RowDataPacket[]>(
      "SELECT * FROM nextchat_providers WHERE id = ?",
      [id],
    );
    return rows[0] ? (rows[0] as ProviderRow) : null;
  }

  async list() {
    const [rows] = await (
      await getMysqlExecutor()
    ).execute<RowDataPacket[]>("SELECT * FROM nextchat_providers");
    const records = new Map(
      rows.map((row) => {
        const record = this.decodeRow(row as ProviderRow);
        return [record.id, record] as const;
      }),
    );
    return PROVIDER_IDS.flatMap((id) =>
      records.has(id) ? [records.get(id)!] : [],
    );
  }

  async get(id: ProviderId) {
    const row = await this.readRow(id);
    return row ? this.decodeRow(row) : null;
  }

  async getSecret(id: ProviderId, field: ProviderSecretField) {
    const row = await this.readRow(id);
    const encrypted = field === "apiKey" ? row?.api_key : row?.api_secret;
    return encrypted ? this.decrypt(id, field, encrypted) : undefined;
  }

  async snapshot(id: ProviderId) {
    return { id, row: await this.readRow(id) };
  }

  async restore(snapshot: { id: ProviderId; row: ProviderRow | null }) {
    const { id, row } = snapshot;
    if (!row) {
      await this.delete(id);
      return;
    }
    if (row.id !== id) throw new CorruptProviderConfigError(id);
    this.decodeRow(row);
    await (
      await getMysqlExecutor()
    ).execute(
      `INSERT INTO nextchat_providers
      (id, label, enabled, base_url, api_key, api_secret, extra_json, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE label=VALUES(label), enabled=VALUES(enabled),
      base_url=VALUES(base_url), api_key=VALUES(api_key), api_secret=VALUES(api_secret),
      extra_json=VALUES(extra_json), updated_at=VALUES(updated_at)`,
      [
        row.id,
        row.label,
        row.enabled,
        row.base_url,
        row.api_key,
        row.api_secret,
        row.extra_json,
        row.updated_at,
      ],
    );
  }

  async upsert(id: ProviderId, patch: ProviderPatch) {
    return withMysqlTransaction(async () => {
      const row = this.buildRow(id, patch, await this.readRow(id));
      await this.restore({ id, row });
      return this.decodeRow(row);
    }, "providers");
  }

  async delete(id: ProviderId) {
    const [result] = await (
      await getMysqlExecutor()
    ).execute<ResultSetHeader>("DELETE FROM nextchat_providers WHERE id = ?", [
      id,
    ]);
    return result.affectedRows > 0;
  }
}
