import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import {
  MAX_ACCOUNT_SYNC_BYTES,
  validateSyncState,
  type SyncState,
} from "./state";

export type LegacySyncSnapshot = {
  state: SyncState;
  updatedAt: string | null;
};

export class LegacySyncSnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LegacySyncSnapshotError";
  }
}

function legacySnapshotPath(userId: string, directory: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(userId)) {
    throw new LegacySyncSnapshotError("同步用户标识格式错误");
  }
  return path.join(directory, `${userId}.json`);
}

export async function readLegacySyncSnapshot(
  userId: string,
  directory: string,
  maxBytes = MAX_ACCOUNT_SYNC_BYTES,
): Promise<LegacySyncSnapshot | null> {
  const filePath = legacySnapshotPath(userId, directory);
  try {
    const metadata = await stat(filePath);
    if (metadata.size > maxBytes) {
      throw new LegacySyncSnapshotError("旧同步快照超出大小限制");
    }

    const content = await readFile(filePath, "utf8");
    const envelope = JSON.parse(content) as {
      state?: unknown;
      updatedAt?: unknown;
    };
    const validation = validateSyncState(envelope?.state);
    if (!validation.ok) {
      throw new LegacySyncSnapshotError(validation.reason);
    }
    return {
      state: validation.state,
      updatedAt:
        typeof envelope.updatedAt === "string" ? envelope.updatedAt : null,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    if (error instanceof LegacySyncSnapshotError) throw error;
    throw new LegacySyncSnapshotError("旧同步快照格式错误");
  }
}
