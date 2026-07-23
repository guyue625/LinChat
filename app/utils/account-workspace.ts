import { StoreKey } from "../constant";
import type { AccountSnapshot } from "../components/account-utils";

/** Guest / unauthenticated workspace when account auth is enabled. */
export const GUEST_WORKSPACE = "guest" as const;

export type WorkspaceOwner = typeof GUEST_WORKSPACE | `user:${string}`;

export type ChatWorkspaceSnapshot = {
  sessions: unknown[];
  currentSessionIndex: number;
  lastInput: string;
};

export function resolveWorkspaceOwner(
  account: Pick<AccountSnapshot, "enabled" | "user">,
): WorkspaceOwner {
  // Account system off → single shared store (legacy behaviour).
  if (!account.enabled) return GUEST_WORKSPACE;
  const id = account.user?.id?.trim() || account.user?.username?.trim() || "";
  if (!id) return GUEST_WORKSPACE;
  return `user:${id}`;
}

export function chatWorkspaceStorageKey(owner: WorkspaceOwner) {
  if (owner === GUEST_WORKSPACE) {
    return `${StoreKey.Chat}::${GUEST_WORKSPACE}`;
  }
  return `${StoreKey.Chat}::${owner}`;
}

/** Active in-memory view stays on the primary StoreKey; snapshots live per owner. */
export function activeChatStorageKey() {
  return StoreKey.Chat;
}

async function storage() {
  // Lazy import so pure helpers stay free of idb/nanoid for unit tests.
  const { indexedDBStorage } = await import("./indexedDB-storage");
  return indexedDBStorage;
}

export async function readChatWorkspace(
  owner: WorkspaceOwner,
): Promise<ChatWorkspaceSnapshot | null> {
  const raw = await (await storage()).getItem(chatWorkspaceStorageKey(owner));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as {
      state?: ChatWorkspaceSnapshot;
      sessions?: unknown[];
      currentSessionIndex?: number;
      lastInput?: string;
    };
    const state = parsed.state ?? parsed;
    if (!state || !Array.isArray(state.sessions)) return null;
    return {
      sessions: state.sessions,
      currentSessionIndex:
        typeof state.currentSessionIndex === "number"
          ? state.currentSessionIndex
          : 0,
      lastInput: typeof state.lastInput === "string" ? state.lastInput : "",
    };
  } catch {
    return null;
  }
}

export async function writeChatWorkspace(
  owner: WorkspaceOwner,
  snapshot: ChatWorkspaceSnapshot,
): Promise<void> {
  await (
    await storage()
  ).setItem(
    chatWorkspaceStorageKey(owner),
    JSON.stringify({
      state: {
        ...snapshot,
        // Keep persist middleware happy if something re-reads this blob.
        _hasHydrated: true,
      },
      version: 3.3,
    }),
  );
}

/**
 * When account auth is enabled and the visitor is not logged in, server-side
 * model catalogues must not be exposed in the model picker.
 */
export function shouldExposeServerModels(account: {
  enabled: boolean;
  user: unknown;
}) {
  if (!account.enabled) return true;
  return Boolean(account.user);
}
