import { StoreKey } from "../constant";
import type { AccountSnapshot } from "../components/account-utils";

/** Guest / unauthenticated workspace when account auth is enabled. */
export const GUEST_WORKSPACE = "guest" as const;

export type WorkspaceOwner = typeof GUEST_WORKSPACE | `user:${string}`;
export type UserWorkspaceOwner = Exclude<
  WorkspaceOwner,
  typeof GUEST_WORKSPACE
>;

/** Small cancellation primitive for async account-workspace transitions. */
export function createWorkspaceGenerationGuard() {
  let generation = 0;
  return {
    begin() {
      generation += 1;
      return generation;
    },
    isCurrent(token: number) {
      return token === generation;
    },
  };
}

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

export type ModelWorkspaceSnapshot = {
  customModels: string;
  modelConfig?: ModelWorkspaceConfig;
};

/** Fields edited while a target account snapshot is still being restored. */
export type ModelWorkspacePatch = {
  customModels?: string;
  modelConfig?: ModelWorkspaceConfig;
};

export type ModelWorkspaceConfig = {
  model: string;
  providerName: string;
  compressModel: string;
  compressProviderName: string;
};

export function pickModelWorkspaceConfig(
  config: ModelWorkspaceConfig,
): ModelWorkspaceConfig {
  return {
    model: config.model,
    providerName: config.providerName,
    compressModel: config.compressModel,
    compressProviderName: config.compressProviderName,
  };
}

function parseModelWorkspaceConfig(value: unknown) {
  if (!value || typeof value !== "object") return undefined;
  const config = value as Partial<ModelWorkspaceConfig>;
  if (
    typeof config.model !== "string" ||
    typeof config.providerName !== "string" ||
    typeof config.compressModel !== "string" ||
    typeof config.compressProviderName !== "string"
  ) {
    return undefined;
  }
  return pickModelWorkspaceConfig(config as ModelWorkspaceConfig);
}

export function modelWorkspaceStorageKey(owner: WorkspaceOwner) {
  return `${StoreKey.Config}::models::${owner}`;
}

export function modelWorkspaceOwnerStorageKey() {
  return `${StoreKey.Config}::models-owner`;
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

function readLocalStorageValue(key: string) {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocalStorageValue(key: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // IndexedDB remains the primary store when localStorage is unavailable.
  }
}

function modelWorkspacePayload(snapshot: ModelWorkspaceSnapshot) {
  return JSON.stringify({
    state: {
      ...snapshot,
      _hasHydrated: true,
    },
    version: 1,
  });
}

function modelWorkspaceOwnerPayload(owner: UserWorkspaceOwner) {
  return JSON.stringify({
    state: { owner, _hasHydrated: true },
    version: 1,
  });
}

function parseModelWorkspaceSnapshot(raw: string | null) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as {
      state?: Partial<ModelWorkspaceSnapshot> & { modelConfig?: unknown };
      modelConfig?: unknown;
    } & Partial<ModelWorkspaceSnapshot>;
    const state = parsed.state ?? parsed;
    if (typeof state.customModels !== "string") return null;
    const modelConfig = parseModelWorkspaceConfig(state.modelConfig);
    return {
      customModels: state.customModels,
      ...(modelConfig ? { modelConfig } : {}),
    } as ModelWorkspaceSnapshot;
  } catch {
    return null;
  }
}

function mergeCachedModelWorkspace(
  owner: UserWorkspaceOwner,
  snapshot: ModelWorkspaceSnapshot,
) {
  if (snapshot.modelConfig) return snapshot;
  const cached = parseModelWorkspaceSnapshot(
    readLocalStorageValue(modelWorkspaceStorageKey(owner)),
  );
  return cached?.modelConfig
    ? { ...snapshot, modelConfig: cached.modelConfig }
    : snapshot;
}

/** Cache a model snapshot synchronously before the IndexedDB write begins. */
export function cacheModelWorkspace(
  owner: UserWorkspaceOwner,
  snapshot: ModelWorkspaceSnapshot,
) {
  const effectiveSnapshot = mergeCachedModelWorkspace(owner, snapshot);
  writeLocalStorageValue(
    modelWorkspaceStorageKey(owner),
    modelWorkspacePayload(effectiveSnapshot),
  );
  writeLocalStorageValue(
    modelWorkspaceOwnerStorageKey(),
    modelWorkspaceOwnerPayload(owner),
  );
}

/**
 * Apply an in-flight edit to the synchronous cache without inventing a blank
 * custom-model list when the target snapshot has not been read yet.
 */
export function cacheModelWorkspacePatch(
  owner: UserWorkspaceOwner,
  patch: ModelWorkspacePatch,
) {
  const cached = parseModelWorkspaceSnapshot(
    readLocalStorageValue(modelWorkspaceStorageKey(owner)),
  );
  if (!cached && patch.customModels === undefined) return null;

  const merged: ModelWorkspaceSnapshot = {
    customModels: patch.customModels ?? cached?.customModels ?? "",
    ...(patch.modelConfig ?? cached?.modelConfig
      ? { modelConfig: patch.modelConfig ?? cached?.modelConfig }
      : {}),
  };
  cacheModelWorkspace(owner, merged);
  return merged;
}

export async function readModelWorkspace(
  owner: WorkspaceOwner,
): Promise<ModelWorkspaceSnapshot | null> {
  const key = modelWorkspaceStorageKey(owner);
  const localRaw = readLocalStorageValue(key);
  const localSnapshot = parseModelWorkspaceSnapshot(localRaw);
  if (localSnapshot) return localSnapshot;
  // Let storage failures reach the workspace synchronizer. A failed read is
  // not the same as an absent snapshot: treating it as absent could overwrite
  // the account's last-known model catalogue with an empty one.
  const indexedDbRaw = await (await storage()).getItem(key);
  return parseModelWorkspaceSnapshot(indexedDbRaw);
}

export async function writeModelWorkspace(
  owner: UserWorkspaceOwner,
  snapshot: ModelWorkspaceSnapshot,
): Promise<void> {
  const key = modelWorkspaceStorageKey(owner);
  const effectiveSnapshot = mergeCachedModelWorkspace(owner, snapshot);
  const serialized = modelWorkspacePayload(effectiveSnapshot);
  cacheModelWorkspace(owner, effectiveSnapshot);
  const modelStorage = await storage();
  await modelStorage.setItem(key, serialized);
  await writeModelWorkspaceOwner(owner);
}

export async function readModelWorkspaceOwner(): Promise<UserWorkspaceOwner | null> {
  const key = modelWorkspaceOwnerStorageKey();
  const parseOwner = (raw: string | null) => {
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as {
        state?: { owner?: unknown };
        owner?: unknown;
      };
      const owner = parsed.state?.owner ?? parsed.owner;
      if (typeof owner !== "string" || !owner.startsWith("user:")) {
        return null;
      }
      return owner as UserWorkspaceOwner;
    } catch {
      return null;
    }
  };
  const localOwner = parseOwner(readLocalStorageValue(key));
  if (localOwner) return localOwner;
  // As above, propagate a backend failure instead of silently returning an
  // unknown owner and allowing legacy data to be claimed by another account.
  return parseOwner(await (await storage()).getItem(key));
}

export async function writeModelWorkspaceOwner(
  owner: UserWorkspaceOwner,
): Promise<void> {
  const key = modelWorkspaceOwnerStorageKey();
  const serialized = modelWorkspaceOwnerPayload(owner);
  writeLocalStorageValue(key, serialized);
  await (await storage()).setItem(key, serialized);
}

export type ModelWorkspaceSwitchInput = {
  accountEnabled: boolean;
  allowLegacyBootstrap?: boolean;
  currentOwner: WorkspaceOwner | null;
  currentCustomModels: string;
  currentCustomModelsChanged?: boolean;
  currentModelConfig?: ModelWorkspaceConfig;
  fallbackModelConfig?: ModelWorkspaceConfig;
  lastKnownOwner?: UserWorkspaceOwner | null;
  nextOwner: WorkspaceOwner;
  nextSnapshot: ModelWorkspaceSnapshot | null | undefined;
};

export type ModelWorkspaceSwitchPlan = {
  visibleCustomModels: string;
  visibleModelConfig?: ModelWorkspaceConfig;
  persist?: {
    owner: UserWorkspaceOwner;
    snapshot: ModelWorkspaceSnapshot;
  };
};

function modelWorkspaceSnapshot(
  customModels: string,
  modelConfig?: ModelWorkspaceConfig,
): ModelWorkspaceSnapshot {
  return {
    customModels,
    ...(modelConfig
      ? { modelConfig: pickModelWorkspaceConfig(modelConfig) }
      : {}),
  };
}

function modelWorkspacePlan(
  visibleCustomModels: string,
  visibleModelConfig: ModelWorkspaceConfig | undefined,
  persist?: ModelWorkspaceSwitchPlan["persist"],
): ModelWorkspaceSwitchPlan {
  return {
    visibleCustomModels,
    ...(visibleModelConfig
      ? { visibleModelConfig: pickModelWorkspaceConfig(visibleModelConfig) }
      : {}),
    ...(persist ? { persist } : {}),
  };
}

export function shouldReuseModelWorkspace(input: {
  activeOwner: WorkspaceOwner | null;
  allowServerModels: boolean;
  nextOwner: WorkspaceOwner;
  previousContext: {
    owner: WorkspaceOwner;
    allowServerModels: boolean;
  } | null;
  ready: boolean;
}) {
  return (
    input.ready &&
    input.activeOwner === input.nextOwner &&
    input.previousContext?.owner === input.nextOwner &&
    input.previousContext.allowServerModels === input.allowServerModels
  );
}

export function resolvePendingModelWorkspaceTransition(input: {
  currentSnapshot: ModelWorkspaceSnapshot;
  nextOwner: WorkspaceOwner;
  nextSnapshot: ModelWorkspaceSnapshot | null;
  pending: {
    owner: WorkspaceOwner;
    snapshot: ModelWorkspacePatch;
  } | null;
}) {
  const pendingSnapshot = input.pending?.snapshot;
  const baseSnapshot = input.nextSnapshot ?? { customModels: "" };
  return {
    currentSnapshot: input.currentSnapshot,
    nextSnapshot:
      input.pending?.owner === input.nextOwner && pendingSnapshot
        ? {
            ...baseSnapshot,
            ...(pendingSnapshot.customModels !== undefined
              ? { customModels: pendingSnapshot.customModels }
              : {}),
            ...(pendingSnapshot.modelConfig
              ? { modelConfig: pendingSnapshot.modelConfig }
              : {}),
          }
        : input.nextSnapshot,
  };
}

export function resolveModelWorkspaceInput(input: {
  initialCustomModels: string;
  latestCustomModels: string;
  nextSnapshot: ModelWorkspaceSnapshot | null;
}) {
  const changed = input.initialCustomModels !== input.latestCustomModels;
  if (input.initialCustomModels !== input.latestCustomModels) {
    return {
      currentCustomModels: input.latestCustomModels,
      nextSnapshot: null,
      changed,
    };
  }

  return {
    currentCustomModels: input.initialCustomModels,
    nextSnapshot: input.nextSnapshot,
    changed,
  };
}

/**
 * Calculate the model configuration visible after an account workspace swap.
 * The outgoing user snapshot is returned for persistence before the guest
 * view clears the in-memory value. A non-empty legacy value is claimed by a
 * newly seen user so existing installations do not lose their models.
 */
export function planModelWorkspaceSwitch(
  input: ModelWorkspaceSwitchInput,
): ModelWorkspaceSwitchPlan {
  const currentModelConfig = input.currentModelConfig
    ? pickModelWorkspaceConfig(input.currentModelConfig)
    : undefined;
  const fallbackModelConfig = input.fallbackModelConfig
    ? pickModelWorkspaceConfig(input.fallbackModelConfig)
    : undefined;
  const leavingUser =
    input.currentOwner &&
    input.currentOwner !== GUEST_WORKSPACE &&
    input.currentOwner !== input.nextOwner
      ? {
          owner: input.currentOwner as UserWorkspaceOwner,
          snapshot: modelWorkspaceSnapshot(
            input.currentCustomModels,
            currentModelConfig,
          ),
        }
      : undefined;

  // Without account authentication the app keeps its original shared config.
  if (!input.accountEnabled) {
    return modelWorkspacePlan(
      input.currentCustomModels,
      currentModelConfig ?? fallbackModelConfig,
      leavingUser,
    );
  }

  // Never expose a user's custom catalogue in the guest workspace.
  if (input.nextOwner === GUEST_WORKSPACE) {
    return modelWorkspacePlan("", fallbackModelConfig, leavingUser);
  }

  if (input.nextSnapshot) {
    return modelWorkspacePlan(
      input.nextSnapshot.customModels,
      input.nextSnapshot.modelConfig ?? fallbackModelConfig,
      leavingUser,
    );
  }

  if (input.currentOwner === input.nextOwner) {
    return modelWorkspacePlan(
      input.currentCustomModels,
      currentModelConfig ?? fallbackModelConfig,
    );
  }

  // Bootstrap a per-user snapshot from the pre-partition shared setting.
  if (
    input.allowLegacyBootstrap !== false &&
    (input.currentCustomModels || input.currentCustomModelsChanged) &&
    (!input.currentOwner || input.currentOwner === GUEST_WORKSPACE) &&
    (input.currentCustomModelsChanged === true ||
      !input.lastKnownOwner ||
      input.lastKnownOwner === input.nextOwner)
  ) {
    return modelWorkspacePlan(
      input.currentCustomModels,
      currentModelConfig ?? fallbackModelConfig,
      {
        owner: input.nextOwner as UserWorkspaceOwner,
        snapshot: modelWorkspaceSnapshot(
          input.currentCustomModels,
          currentModelConfig ?? fallbackModelConfig,
        ),
      },
    );
  }

  return modelWorkspacePlan("", fallbackModelConfig, leavingUser);
}

export function shouldResetModelWorkspaceView(
  currentOwner: WorkspaceOwner | null,
  nextOwner: WorkspaceOwner,
) {
  return currentOwner !== null && currentOwner !== nextOwner;
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

/**
 * Return the explicitly configured model catalogue for the current account.
 * Guests receive an empty catalogue; authentication only unlocks the current
 * account workspace and never injects a built-in catalogue.
 */
export function getVisibleModels<T>(
  account: { enabled: boolean; user: unknown },
  models: readonly T[],
): T[] {
  return shouldExposeServerModels(account) ? Array.from(models) : [];
}

/** Whether the model picker is ready to be shown in the composer. */
export function shouldShowModelPicker(
  account: {
    enabled: boolean;
    loading: boolean;
    modelWorkspaceReady?: boolean;
    user: unknown;
  },
  modelCount: number,
) {
  return (
    !account.loading &&
    account.modelWorkspaceReady !== false &&
    shouldExposeServerModels(account) &&
    modelCount > 0
  );
}

export function shouldExposeModelWorkspace(account: {
  enabled: boolean;
  loading: boolean;
  modelWorkspaceReady: boolean;
  user: unknown;
}) {
  return (
    !account.loading &&
    account.modelWorkspaceReady &&
    shouldExposeServerModels(account)
  );
}

/** Do not replace a restored non-empty choice merely because models are late. */
export function shouldPreserveRestoredModelSelection(
  selectedModel: string,
  isAvailable: boolean,
) {
  return selectedModel.trim().length > 0 && !isAvailable;
}
