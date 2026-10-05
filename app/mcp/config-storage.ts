import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { RowDataPacket } from "mysql2/promise";
import { getDatabaseProvider } from "../lib/db/mysql";
import { hasDangerousKeys } from "../lib/account-sync/state";
import {
  getMysqlExecutor,
  withMysqlTransaction,
} from "../lib/db/mysql-transaction";
import {
  decryptSyncPayload,
  encryptSyncPayload,
  getSyncEncryptionKey,
} from "../lib/account-sync/crypto";
import { DEFAULT_MCP_CONFIG, type McpConfigData } from "./types";

const file = path.join(process.cwd(), "app/mcp/mcp_config.json");
function validate(value: unknown): McpConfigData {
  if (hasDangerousKeys(value)) throw new Error("Invalid MCP configuration");
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    !("mcpServers" in value) ||
    !value.mcpServers ||
    typeof value.mcpServers !== "object" ||
    Array.isArray(value.mcpServers)
  )
    throw new Error("Invalid MCP configuration");
  for (const server of Object.values(value.mcpServers)) {
    if (
      !server ||
      typeof server !== "object" ||
      typeof server.command !== "string" ||
      !Array.isArray(server.args) ||
      !server.args.every((arg: unknown) => typeof arg === "string")
    )
      throw new Error("Invalid MCP server configuration");
  }
  return value as McpConfigData;
}
async function readLegacy() {
  try {
    return validate(JSON.parse(await readFile(file, "utf8")));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT")
      return DEFAULT_MCP_CONFIG;
    throw error;
  }
}
function encrypt(config: McpConfigData) {
  return encryptSyncPayload({
    plaintext: JSON.stringify(validate(config)),
    userId: "system:mcp",
    revision: 1,
    key: getSyncEncryptionKey(),
  });
}
export async function readMcpConfig(): Promise<McpConfigData> {
  if (getDatabaseProvider() !== "mysql") return readLegacy();
  const pool = await getMysqlExecutor();
  const [rows] = await pool.execute<RowDataPacket[]>(
    "SELECT ciphertext FROM nextchat_settings WHERE name = 'mcp'",
  );
  if (!rows.length) {
    const config = await readLegacy();
    await pool.execute(
      "INSERT IGNORE INTO nextchat_settings (name, ciphertext) VALUES ('mcp', ?)",
      [encrypt(config)],
    );
    return readMcpConfig();
  }
  return validate(
    JSON.parse(
      decryptSyncPayload({
        encrypted: rows[0].ciphertext,
        userId: "system:mcp",
        revision: 1,
        key: getSyncEncryptionKey(),
      }),
    ),
  );
}
export async function writeMcpConfig(config: McpConfigData) {
  if (getDatabaseProvider() === "mysql") {
    await (
      await getMysqlExecutor()
    ).execute(
      "INSERT INTO nextchat_settings (name, ciphertext) VALUES ('mcp', ?) ON DUPLICATE KEY UPDATE ciphertext = VALUES(ciphertext)",
      [encrypt(config)],
    );
  } else {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify(validate(config), null, 2));
  }
}

let queue: Promise<unknown> = Promise.resolve();
export function withMcpConfigMutation<T>(
  operation: () => Promise<T>,
): Promise<T> {
  const run = () =>
    getDatabaseProvider() === "mysql"
      ? withMysqlTransaction(operation, "providers")
      : operation();
  const pending = queue.then(run, run);
  queue = pending.catch(() => undefined);
  return pending;
}
