"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_CONFIG,
  resetAccessFetch,
  sanitizeModelCatalogue,
  useAccessStore,
  useAppConfig,
  useChatStore,
} from "../store";
import {
  cacheModelWorkspace,
  cacheModelWorkspacePatch,
  GUEST_WORKSPACE,
  pickModelWorkspaceConfig,
  planModelWorkspaceSwitch,
  readModelWorkspace,
  readModelWorkspaceOwner,
  resolvePendingModelWorkspaceTransition,
  resolveWorkspaceOwner,
  shouldExposeServerModels,
  shouldReuseModelWorkspace,
  type ModelWorkspaceConfig,
  type ModelWorkspacePatch,
  type ModelWorkspaceSnapshot,
  type UserWorkspaceOwner,
  type WorkspaceOwner,
  writeModelWorkspace,
} from "../utils/account-workspace";
import { useAccount } from "./account-context";

const DEFAULT_MODEL_WORKSPACE_CONFIG = pickModelWorkspaceConfig(
  DEFAULT_CONFIG.modelConfig,
);

function snapshotFromConfig(state: {
  customModels: string;
  modelConfig: ModelWorkspaceConfig;
}): ModelWorkspaceSnapshot {
  return {
    customModels: state.customModels,
    modelConfig: pickModelWorkspaceConfig(state.modelConfig),
  };
}

function modelConfigChanged(
  current: ModelWorkspaceConfig,
  previous: ModelWorkspaceConfig,
) {
  return (
    current.model !== previous.model ||
    current.providerName !== previous.providerName ||
    current.compressModel !== previous.compressModel ||
    current.compressProviderName !== previous.compressProviderName
  );
}

/**
 * Keeps chat sessions and model catalogues aligned with the active account.
 * The in-memory config is only committed after the target account snapshot is
 * restored, so a previous account never flashes while a switch is in flight.
 */
export function AccountWorkspaceSync() {
  const { enabled, loading, setModelWorkspaceReady, user } = useAccount();
  const nextOwner = resolveWorkspaceOwner({ enabled, user });
  const allowServerModels = shouldExposeServerModels({ enabled, user });
  const lastOwnerRef = useRef<WorkspaceOwner | null>(null);
  const modelOwnerRef = useRef<WorkspaceOwner | null>(null);
  const modelSnapshotRef = useRef<ModelWorkspaceSnapshot | null>(null);
  const modelContextRef = useRef<{
    owner: WorkspaceOwner;
    allowServerModels: boolean;
  } | null>(null);
  const modelSyncGenerationRef = useRef(0);
  const modelWriteQueueRef = useRef<Promise<void>>(Promise.resolve());
  const [modelRetryNonce, setModelRetryNonce] = useState(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const modelVisibilityRef = useRef<boolean | null>(null);
  const modelWorkspaceReadyRef = useRef(false);
  const pendingModelWorkspaceRef = useRef<{
    generation: number;
    owner: WorkspaceOwner;
    snapshot: ModelWorkspacePatch;
  } | null>(null);
  const modelTargetOwnerRef = useRef<WorkspaceOwner | null>(null);
  const internalModelUpdateRef = useRef(false);
  const configHydrated = useAppConfig((state) => state._hasHydrated);

  const persistModelWorkspace = useCallback(
    (owner: UserWorkspaceOwner, snapshot: ModelWorkspaceSnapshot) => {
      modelWriteQueueRef.current = modelWriteQueueRef.current
        .catch(() => undefined)
        .then(() => writeModelWorkspace(owner, snapshot));
      return modelWriteQueueRef.current;
    },
    [],
  );

  const queueSnapshot = useCallback(
    (owner: UserWorkspaceOwner, snapshot: ModelWorkspaceSnapshot) => {
      cacheModelWorkspace(owner, snapshot);
      void persistModelWorkspace(owner, snapshot).catch((error) => {
        console.error("[Workspace] model snapshot failed", error);
      });
    },
    [persistModelWorkspace],
  );

  const queueSnapshotPatch = useCallback(
    (owner: UserWorkspaceOwner, patch: ModelWorkspacePatch) => {
      // Make the edit durable synchronously when a cached target snapshot is
      // available. This protects a quick tab close before the async queue runs.
      cacheModelWorkspacePatch(owner, patch);
      modelWriteQueueRef.current = modelWriteQueueRef.current
        .catch(() => undefined)
        .then(async () => {
          let existing: ModelWorkspaceSnapshot | null = null;
          try {
            existing = await readModelWorkspace(owner);
          } catch (error) {
            // A patch must never turn an unreadable snapshot into an empty
            // one. The next account sync can retry the read later.
            console.error("[Workspace] model patch read failed", error);
            return;
          }

          const merged: ModelWorkspaceSnapshot = {
            customModels: patch.customModels ?? existing?.customModels ?? "",
            ...(patch.modelConfig ?? existing?.modelConfig
              ? {
                  modelConfig: patch.modelConfig ?? existing?.modelConfig,
                }
              : {}),
          };
          await writeModelWorkspace(owner, merged);
        });
      void modelWriteQueueRef.current.catch((error) => {
        console.error("[Workspace] model patch failed", error);
      });
    },
    [],
  );

  useEffect(() => {
    if (loading) return;

    const isFirstSync = lastOwnerRef.current === null;
    if (!isFirstSync && lastOwnerRef.current === nextOwner) return;
    lastOwnerRef.current = nextOwner;

    void useChatStore
      .getState()
      .switchWorkspace(nextOwner, { force: isFirstSync });
  }, [loading, nextOwner]);

  useEffect(() => {
    if (loading || !configHydrated) return;

    if (retryTimerRef.current !== null) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }

    const previousContext = modelContextRef.current;
    if (
      shouldReuseModelWorkspace({
        activeOwner: modelOwnerRef.current,
        allowServerModels,
        nextOwner,
        previousContext,
        ready: modelWorkspaceReadyRef.current,
      })
    ) {
      setModelWorkspaceReady(true);
      return;
    }

    const previousGeneration = modelSyncGenerationRef.current;
    const pendingFromPrevious =
      pendingModelWorkspaceRef.current?.generation === previousGeneration
        ? pendingModelWorkspaceRef.current
        : null;
    const generation = ++modelSyncGenerationRef.current;
    let cancelled = false;
    const configState = useAppConfig.getState();
    const currentOwner = modelOwnerRef.current;
    const currentSnapshot =
      modelSnapshotRef.current ?? snapshotFromConfig(configState);

    // Cache the account being left before the transient clear below. This
    // keeps a quick refresh/tab close from losing its last model edit.
    if (
      currentOwner &&
      currentOwner !== GUEST_WORKSPACE &&
      currentOwner !== nextOwner
    ) {
      queueSnapshot(currentOwner, currentSnapshot);
    }

    // A cancelled target edit belongs to that target, never to the account
    // being left. Cache it independently before starting the next transition.
    if (pendingFromPrevious && pendingFromPrevious.owner !== GUEST_WORKSPACE) {
      queueSnapshotPatch(
        pendingFromPrevious.owner,
        pendingFromPrevious.snapshot,
      );
    }

    pendingModelWorkspaceRef.current = null;
    modelVisibilityRef.current = allowServerModels;
    modelWorkspaceReadyRef.current = false;
    modelTargetOwnerRef.current = nextOwner;
    setModelWorkspaceReady(false);

    const applyPlan = (plan: ReturnType<typeof planModelWorkspaceSwitch>) => {
      const visibleState = sanitizeModelCatalogue({
        models: [],
        customModels: plan.visibleCustomModels,
        modelConfig: {
          ...(plan.visibleModelConfig ?? DEFAULT_MODEL_WORKSPACE_CONFIG),
        },
      });
      const visibleModelConfig = visibleState.modelConfig;
      const currentConfig = useAppConfig.getState().modelConfig;
      internalModelUpdateRef.current = true;
      useAppConfig.setState({
        models: [],
        customModels: plan.visibleCustomModels,
        modelConfig: {
          ...currentConfig,
          ...visibleModelConfig,
        } as typeof currentConfig,
      });
      internalModelUpdateRef.current = false;

      const committedSnapshot: ModelWorkspaceSnapshot = {
        customModels: plan.visibleCustomModels,
        modelConfig: visibleModelConfig,
      };
      modelOwnerRef.current = nextOwner;
      modelSnapshotRef.current = committedSnapshot;
      modelTargetOwnerRef.current = nextOwner;
      modelContextRef.current = { owner: nextOwner, allowServerModels };
      modelWorkspaceReadyRef.current = true;
      setModelWorkspaceReady(true);
      return committedSnapshot;
    };

    if (!allowServerModels) {
      const plan = planModelWorkspaceSwitch({
        accountEnabled: enabled,
        currentOwner,
        currentCustomModels: currentSnapshot.customModels,
        currentModelConfig:
          currentSnapshot.modelConfig ?? DEFAULT_MODEL_WORKSPACE_CONFIG,
        fallbackModelConfig: DEFAULT_MODEL_WORKSPACE_CONFIG,
        nextOwner,
        nextSnapshot: null,
      });

      resetAccessFetch();
      useAccessStore.getState().clearServerModels();
      applyPlan(plan);
      if (plan.persist) {
        queueSnapshot(plan.persist.owner, plan.persist.snapshot);
      }

      return () => {
        cancelled = true;
      };
    }

    // Keep the previous persisted config intact while the target snapshot is
    // loading. The readiness gate hides it from the UI; clearing it here would
    // make Zustand persist an empty global snapshot if the tab closes mid-read.
    useAccessStore.getState().clearServerModels();

    void (async () => {
      // A logout caches synchronously, but wait for queued IndexedDB writes so
      // a quick login reads the same snapshot from either storage backend.
      await modelWriteQueueRef.current.catch(() => undefined);

      let nextSnapshot: ModelWorkspaceSnapshot | null = null;
      let lastKnownOwner: UserWorkspaceOwner | null = null;
      let allowLegacyBootstrap = true;
      if (enabled && nextOwner !== GUEST_WORKSPACE) {
        // The model snapshot is authoritative. The owner marker is only a
        // migration hint, so a marker read failure must not discard a valid
        // snapshot that was already recovered.
        nextSnapshot = await readModelWorkspace(nextOwner);
        try {
          lastKnownOwner = await readModelWorkspaceOwner();
        } catch (error) {
          console.error("[Workspace] model owner read failed", error);
          lastKnownOwner = null;
          allowLegacyBootstrap = false;
        }
      }

      if (cancelled || generation !== modelSyncGenerationRef.current) return;

      const pending =
        pendingModelWorkspaceRef.current?.generation === generation
          ? pendingModelWorkspaceRef.current
          : null;
      const transition = resolvePendingModelWorkspaceTransition({
        currentSnapshot,
        nextOwner,
        nextSnapshot,
        pending,
      });
      if (pending && pending.owner !== GUEST_WORKSPACE) {
        queueSnapshotPatch(pending.owner, pending.snapshot);
      }
      pendingModelWorkspaceRef.current = null;

      const plan = planModelWorkspaceSwitch({
        accountEnabled: enabled,
        allowLegacyBootstrap,
        currentOwner,
        currentCustomModels: transition.currentSnapshot.customModels,
        currentModelConfig:
          transition.currentSnapshot.modelConfig ??
          DEFAULT_MODEL_WORKSPACE_CONFIG,
        fallbackModelConfig: DEFAULT_MODEL_WORKSPACE_CONFIG,
        lastKnownOwner,
        nextOwner,
        nextSnapshot: transition.nextSnapshot,
      });
      if (plan.persist) {
        queueSnapshot(plan.persist.owner, plan.persist.snapshot);
      }

      if (cancelled || generation !== modelSyncGenerationRef.current) return;

      const committedSnapshot = applyPlan(plan);
      if (enabled && nextOwner !== GUEST_WORKSPACE) {
        // Upgrade old customModels-only snapshots and refresh the owner marker.
        queueSnapshot(nextOwner, committedSnapshot);
      }

      resetAccessFetch();
      useAccessStore.getState().fetch({ includeServerModels: true });
    })().catch((error) => {
      if (cancelled || generation !== modelSyncGenerationRef.current) return;
      console.error("[Workspace] model sync failed", error);

      const pending =
        pendingModelWorkspaceRef.current?.generation === generation
          ? pendingModelWorkspaceRef.current
          : null;
      if (pending && pending.owner !== GUEST_WORKSPACE) {
        queueSnapshotPatch(pending.owner, pending.snapshot);
      }
      pendingModelWorkspaceRef.current = null;

      // Preserve the workspace being left, but never write an empty snapshot
      // over the unreadable target workspace. Authenticated users receive a
      // safe empty custom catalogue until a later sync can read their data.
      if (
        currentOwner &&
        currentOwner !== GUEST_WORKSPACE &&
        currentOwner !== nextOwner
      ) {
        queueSnapshot(currentOwner, currentSnapshot);
      }
      // Keep the workspace hidden and retry instead of committing an empty
      // target snapshot. Existing config remains untouched so a transient
      // storage outage cannot destroy the last in-memory/legacy snapshot.
      modelWorkspaceReadyRef.current = false;
      setModelWorkspaceReady(false);
      useAccessStore.getState().clearServerModels();
      retryTimerRef.current = setTimeout(() => {
        if (!cancelled) setModelRetryNonce((value) => value + 1);
      }, 1000);
    });

    return () => {
      cancelled = true;
      if (retryTimerRef.current !== null) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, [
    allowServerModels,
    configHydrated,
    enabled,
    loading,
    nextOwner,
    modelRetryNonce,
    queueSnapshot,
    queueSnapshotPatch,
    setModelWorkspaceReady,
  ]);

  useEffect(() => {
    const unsubscribeConfig = useAppConfig.subscribe((state, previousState) => {
      if (internalModelUpdateRef.current) return;

      const snapshot = snapshotFromConfig(state);
      const workspaceChanged =
        state.customModels !== previousState.customModels ||
        modelConfigChanged(state.modelConfig, previousState.modelConfig);
      const visibility = modelVisibilityRef.current;

      // Persist hydration may finish before the account request. Preserve that
      // legacy value in memory before hiding it, so the correct first account
      // can still migrate an existing custom-model configuration.
      if (visibility === null) {
        modelSnapshotRef.current = snapshot;
      }

      if (visibility === true && !modelWorkspaceReadyRef.current) {
        if (workspaceChanged) {
          const owner = modelTargetOwnerRef.current ?? GUEST_WORKSPACE;
          const pendingSnapshot: ModelWorkspacePatch = {
            ...(state.customModels !== previousState.customModels
              ? { customModels: state.customModels }
              : {}),
            ...(modelConfigChanged(state.modelConfig, previousState.modelConfig)
              ? { modelConfig: pickModelWorkspaceConfig(state.modelConfig) }
              : {}),
          };
          pendingModelWorkspaceRef.current = {
            generation: modelSyncGenerationRef.current,
            owner,
            snapshot: pendingSnapshot,
          };
        }
        return;
      }

      if (visibility !== true) {
        const selection = pickModelWorkspaceConfig(state.modelConfig);
        if (
          state.models.length > 0 ||
          state.customModels !== "" ||
          modelConfigChanged(selection, DEFAULT_MODEL_WORKSPACE_CONFIG)
        ) {
          internalModelUpdateRef.current = true;
          useAppConfig.setState({
            models: [],
            customModels: "",
            modelConfig: {
              ...state.modelConfig,
              ...DEFAULT_MODEL_WORKSPACE_CONFIG,
            } as typeof state.modelConfig,
          });
          internalModelUpdateRef.current = false;
        }
        return;
      }

      const owner = modelOwnerRef.current;
      if (!owner || owner === GUEST_WORKSPACE || !workspaceChanged) return;

      modelSnapshotRef.current = snapshot;
      queueSnapshot(owner, snapshot);
    });

    const unsubscribeAccess = useAccessStore.subscribe((state) => {
      const visibility = modelVisibilityRef.current;
      if (
        (visibility !== true || !modelWorkspaceReadyRef.current) &&
        (state.customModels !== "" ||
          state.defaultModel !== "" ||
          state.visionModels !== "")
      ) {
        useAccessStore.getState().clearServerModels();
      }
    });

    return () => {
      unsubscribeConfig();
      unsubscribeAccess();
    };
  }, [queueSnapshot, queueSnapshotPatch]);

  return null;
}
