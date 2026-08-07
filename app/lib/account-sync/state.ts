import { StoreKey } from "../../constant";

export type SyncState = Record<string, unknown>;
export const MAX_ACCOUNT_SYNC_BYTES = 15 * 1024 * 1024;

export type SyncStateValidation =
  | { ok: true; state: SyncState }
  | { ok: false; reason: string };

const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const OPTIONAL_OBJECT_SLICES = [
  StoreKey.Access,
  StoreKey.Config,
  StoreKey.Mask,
  StoreKey.Prompt,
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function hasDangerousKeys(value: unknown): boolean {
  const pending = [value];
  const visited = new Set<object>();

  while (pending.length > 0) {
    const current = pending.pop();
    if (typeof current !== "object" || current === null) continue;
    if (visited.has(current)) continue;
    visited.add(current);

    for (const key of Object.keys(current)) {
      if (DANGEROUS_KEYS.has(key)) return true;
      pending.push((current as Record<string, unknown>)[key]);
    }
  }

  return false;
}

export function validateSyncState(value: unknown): SyncStateValidation {
  if (!isRecord(value)) {
    return { ok: false, reason: "同步数据必须是对象" };
  }
  if (hasDangerousKeys(value)) {
    return { ok: false, reason: "同步数据包含危险字段" };
  }

  const chat = value[StoreKey.Chat];
  if (!isRecord(chat) || !Array.isArray(chat.sessions)) {
    return { ok: false, reason: "同步数据缺少有效的聊天分片" };
  }

  for (const key of OPTIONAL_OBJECT_SLICES) {
    const slice = value[key];
    if (slice !== undefined && !isRecord(slice)) {
      return { ok: false, reason: `同步数据分片 ${key} 格式错误` };
    }
  }

  return { ok: true, state: value };
}
