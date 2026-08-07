import { StoreKey } from "../constant";
import { useAccessStore, useAppConfig, useChatStore } from "../store";
import { useMaskStore } from "../store/mask";
import { usePromptStore } from "../store/prompt";
import {
  GUEST_WORKSPACE,
  writeChatWorkspace,
  type WorkspaceOwner,
} from "./account-workspace";
import {
  AppState,
  getLocalAppState,
  mergeAppState,
  setLocalAppState,
} from "./sync";

export const ACCOUNT_CLOUD_SYNC_PATH = "/api/sync";
export const ACCOUNT_CLOUD_SYNC_DEBOUNCE_MS = 30_000;

/** 1x1 transparent GIF — keeps multimodal message shape without shipping base64 payloads. */
export const SYNC_IMAGE_PLACEHOLDER =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

type SyncEnvelope = {
  state: AppState | null;
  revision: number;
  updatedAt: string | null;
};

type SyncPushResponse = {
  ok: true;
  revision: number;
  updatedAt: string;
};

class CloudSyncConflictError extends Error {
  constructor(readonly envelope: SyncEnvelope) {
    super("SYNC_CONFLICT");
    this.name = "CloudSyncConflictError";
  }
}

type StartOptions = {
  userId: string;
  /** Called after a successful pull+merge so UI can react if needed. */
  onMerged?: () => void;
};

type CapturedPush = {
  userId: string;
  owner: WorkspaceOwner;
  revision: number;
  state: AppState;
};

let applyingRemote = false;
let pushQueue: Promise<void> = Promise.resolve();
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let activeUserId: string | null = null;
let activeRevision = 0;
let stopFns: Array<() => void> = [];

function isDataUrl(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("data:");
}

function stripMultimodalContent(content: unknown): unknown {
  if (typeof content === "string") {
    return isDataUrl(content) ? "[media omitted for sync]" : content;
  }
  if (!Array.isArray(content)) return content;
  return content.map((part) => {
    if (!part || typeof part !== "object") return part;
    const next = { ...(part as Record<string, unknown>) };
    if (next.type === "image_url" && next.image_url) {
      const image = next.image_url as Record<string, unknown>;
      if (isDataUrl(image.url)) {
        next.image_url = { ...image, url: SYNC_IMAGE_PLACEHOLDER };
      }
    }
    if (typeof next.image === "string" && isDataUrl(next.image)) {
      next.image = SYNC_IMAGE_PLACEHOLDER;
    }
    return next;
  });
}

/**
 * Deep-clone AppState and replace embedded media payloads so the POST body
 * stays under the server size limit. Local IndexedDB keeps the original images.
 */
export function stripMediaFromAppState(state: AppState): AppState {
  const cloned = JSON.parse(JSON.stringify(state)) as AppState;
  const chat = cloned[StoreKey.Chat] as
    | {
        sessions?: Array<{
          messages?: Array<{
            content?: unknown;
            audio_url?: string;
          }>;
        }>;
      }
    | undefined;
  if (chat) {
    // Device-local runtime fields — do not fan out to other browsers.
    delete (chat as { workspaceSwitching?: unknown }).workspaceSwitching;
    delete (chat as { _hasHydrated?: unknown })._hasHydrated;
  }
  if (!chat?.sessions) return cloned;

  for (const session of chat.sessions) {
    if (!session?.messages) continue;
    for (const message of session.messages) {
      if (!message) continue;
      message.content = stripMultimodalContent(message.content);
      if (isDataUrl(message.audio_url)) {
        message.audio_url = undefined;
      }
    }
  }
  return cloned;
}

async function fetchRemoteEnvelope(): Promise<SyncEnvelope> {
  const response = await fetch(ACCOUNT_CLOUD_SYNC_PATH, {
    method: "GET",
    credentials: "same-origin",
    cache: "no-store",
  });
  if (response.status === 401) {
    throw new Error("UNAUTHORIZED");
  }
  if (!response.ok) {
    throw new Error(`SYNC_PULL_FAILED:${response.status}`);
  }
  const payload = (await response.json()) as SyncEnvelope | AppState;
  // Empty remote: { state: null }. Existing snapshot: { state, revision }.
  if (
    payload &&
    typeof payload === "object" &&
    "state" in payload &&
    ("updatedAt" in payload || (payload as SyncEnvelope).state === null)
  ) {
    const envelope = payload as Partial<SyncEnvelope>;
    return {
      state: envelope.state ?? null,
      revision:
        typeof envelope.revision === "number" &&
        Number.isSafeInteger(envelope.revision) &&
        envelope.revision >= 0
          ? envelope.revision
          : 0,
      updatedAt:
        typeof envelope.updatedAt === "string" ? envelope.updatedAt : null,
    };
  }
  // Defensive: treat a bare AppState as the snapshot body.
  return { state: payload as AppState, revision: 0, updatedAt: null };
}

async function postLocalState(
  state: AppState,
  revision: number,
  keepalive = false,
): Promise<SyncPushResponse> {
  const stripped = stripMediaFromAppState(state);
  const body = JSON.stringify(stripped);
  const response = await fetch(ACCOUNT_CLOUD_SYNC_PATH, {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "content-type": "application/json",
      "x-sync-revision": String(revision),
    },
    body,
    keepalive,
  });
  if (response.status === 401) {
    throw new Error("UNAUTHORIZED");
  }
  if (response.status === 409) {
    throw new CloudSyncConflictError((await response.json()) as SyncEnvelope);
  }
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`SYNC_PUSH_FAILED:${response.status}:${text}`);
  }
  const result = (await response.json()) as SyncPushResponse;
  if (!Number.isSafeInteger(result.revision) || result.revision < 1) {
    throw new Error("SYNC_PUSH_INVALID_RESPONSE");
  }
  return result;
}

function currentChatOwner(): WorkspaceOwner {
  const owner = useChatStore.getState().workspaceOwner as
    | WorkspaceOwner
    | undefined;
  return owner ?? GUEST_WORKSPACE;
}

/**
 * After setLocalAppState merges remote chat into the live store, mirror it into
 * the per-owner IndexedDB partition so the next workspace switch still sees it.
 */
async function mirrorChatWorkspace() {
  const owner = currentChatOwner();
  if (owner === GUEST_WORKSPACE) return;
  const chat = useChatStore.getState();
  await writeChatWorkspace(owner, {
    sessions: chat.sessions,
    currentSessionIndex: chat.currentSessionIndex,
    lastInput: chat.lastInput ?? "",
  });
}

async function applyRemoteState(state: AppState, userId: string) {
  if (activeUserId !== userId || currentChatOwner() !== `user:${userId}`) {
    return false;
  }

  applyingRemote = true;
  try {
    const localOwner = currentChatOwner();
    const localState = getLocalAppState();
    mergeAppState(localState, state);
    setLocalAppState(localState);
    useChatStore.setState({
      workspaceOwner: localOwner,
      workspaceSwitching: false,
      _hasHydrated: true,
    } as any);
    useAppConfig.setState({ _hasHydrated: true } as any);
    useAccessStore.setState({ _hasHydrated: true } as any);
    await mirrorChatWorkspace();
    return true;
  } finally {
    await Promise.resolve();
    applyingRemote = false;
  }
}

export async function pullAndMergeAccountCloud(
  userId = activeUserId,
  isCurrent: () => boolean = () => activeUserId === userId,
): Promise<"empty" | "merged" | "stale"> {
  const envelope = await fetchRemoteEnvelope();
  if (!userId || !isCurrent() || activeUserId !== userId) return "stale";
  activeRevision = envelope.revision;
  if (!envelope.state) {
    return "empty";
  }
  return (await applyRemoteState(envelope.state, userId)) ? "merged" : "stale";
}

export async function pushAccountCloud(options?: { keepalive?: boolean }) {
  if (applyingRemote) return;
  if (useChatStore.getState().workspaceSwitching) return;
  const userId = activeUserId;
  if (!userId) return;
  const owner = currentChatOwner();
  if (owner !== `user:${userId}`) return;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const revision = activeRevision;
    try {
      const result = await postLocalState(
        getLocalAppState(),
        revision,
        options?.keepalive === true,
      );
      if (activeUserId === userId && currentChatOwner() === `user:${userId}`) {
        activeRevision = result.revision;
      }
      return;
    } catch (error) {
      if (!(error instanceof CloudSyncConflictError) || attempt > 0) {
        throw error;
      }
      if (activeUserId !== userId || currentChatOwner() !== `user:${userId}`) {
        return;
      }
      activeRevision = error.envelope.revision;
      if (error.envelope.state) {
        const applied = await applyRemoteState(error.envelope.state, userId);
        if (!applied) return;
      }
    }
  }
}

function enqueuePush(options?: { keepalive?: boolean }) {
  pushQueue = pushQueue
    .catch(() => undefined)
    .then(() => pushAccountCloud(options))
    .catch((error) => {
      console.error(
        "[AccountCloudSync] push failed",
        error instanceof Error ? error.message : "UNKNOWN_SYNC_ERROR",
      );
    });
  return pushQueue;
}

function captureActivePush(): CapturedPush | null {
  if (applyingRemote || useChatStore.getState().workspaceSwitching) return null;
  const userId = activeUserId;
  if (!userId) return null;
  const owner = currentChatOwner();
  if (owner !== `user:${userId}`) return null;
  return {
    userId,
    owner,
    revision: activeRevision,
    state: stripMediaFromAppState(getLocalAppState()),
  };
}

async function pushCapturedAccountCloud(capture: CapturedPush) {
  let revision = capture.revision;
  const state = capture.state;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const result = await postLocalState(state, revision, true);
      if (
        activeUserId === capture.userId &&
        currentChatOwner() === capture.owner
      ) {
        activeRevision = result.revision;
      }
      return;
    } catch (error) {
      if (!(error instanceof CloudSyncConflictError) || attempt > 0) {
        throw error;
      }
      revision = error.envelope.revision;
      if (error.envelope.state) {
        mergeAppState(state, error.envelope.state);
        if (
          activeUserId === capture.userId &&
          currentChatOwner() === capture.owner
        ) {
          activeRevision = revision;
          await applyRemoteState(error.envelope.state, capture.userId);
        }
      }
    }
  }
}

function enqueueCapturedPush(capture: CapturedPush) {
  pushQueue = pushQueue
    .catch(() => undefined)
    .then(() => pushCapturedAccountCloud(capture))
    .catch((error) => {
      console.error(
        "[AccountCloudSync] push failed",
        error instanceof Error ? error.message : "UNKNOWN_SYNC_ERROR",
      );
    });
  return pushQueue;
}

function scheduleDebouncedPush() {
  if (applyingRemote) return;
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void enqueuePush();
  }, ACCOUNT_CLOUD_SYNC_DEBOUNCE_MS);
}

function flushDebouncedPush(keepalive = false) {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  return enqueuePush({ keepalive });
}

function subscribeStores(onChange: () => void) {
  const unsubs = [
    useChatStore.subscribe(onChange),
    useAppConfig.subscribe(onChange),
    useAccessStore.subscribe(onChange),
    useMaskStore.subscribe(onChange),
    usePromptStore.subscribe(onChange),
  ];
  return () => unsubs.forEach((u) => u());
}

/**
 * Start account-bound cloud sync for the signed-in user.
 * Returns a disposer that cancels timers, unsubscribes stores, and flushes once.
 */
export function startAccountCloudSync(options: StartOptions): () => void {
  // Replace any previous session (e.g. account switch without full remount).
  stopAccountCloudSync({ flush: false });
  activeUserId = options.userId;
  activeRevision = 0;

  let cancelled = false;
  const generation = activeUserId;

  const runInitial = async () => {
    try {
      const result = await pullAndMergeAccountCloud(
        generation,
        () => !cancelled && activeUserId === generation,
      );
      if (cancelled || activeUserId !== generation) return;
      if (result === "stale") return;
      options.onMerged?.();
      // Always push after pull so a first-login device seeds the server, and a
      // merge result is durable on the server with local-wins fields applied.
      await enqueuePush();
      if (result === "merged") {
        console.log("[AccountCloudSync] pulled and merged remote state");
      } else {
        console.log("[AccountCloudSync] remote empty, seeded from local");
      }
    } catch (error) {
      if (cancelled || activeUserId !== generation) return;
      console.error("[AccountCloudSync] initial sync failed", error);
    }
  };

  void runInitial();

  const unsubscribe = subscribeStores(() => {
    if (cancelled || applyingRemote) return;
    if (useChatStore.getState().workspaceSwitching) return;
    scheduleDebouncedPush();
  });

  const onPageHide = () => {
    void flushDebouncedPush(true);
  };
  const onVisibility = () => {
    if (document.visibilityState === "hidden") {
      void flushDebouncedPush(true);
    }
  };
  if (typeof window !== "undefined") {
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibility);
  }

  const stop = () => {
    cancelled = true;
    if (activeUserId === generation) activeUserId = null;
    if (activeUserId === null) activeRevision = 0;
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    unsubscribe();
    if (typeof window !== "undefined") {
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibility);
    }
  };
  stopFns.push(stop);
  return stop;
}

export function stopAccountCloudSync(options?: { flush?: boolean }) {
  const shouldFlush = options?.flush !== false;
  const capturedPush = shouldFlush ? captureActivePush() : null;
  if (capturedPush) {
    void enqueueCapturedPush(capturedPush);
  }
  const fns = stopFns;
  stopFns = [];
  for (const stop of fns) stop();
  activeUserId = null;
  activeRevision = 0;
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
}

/** Test helper: whether a remote apply is currently suppressing auto-push. */
export function isApplyingRemoteCloudSync() {
  return applyingRemote;
}
