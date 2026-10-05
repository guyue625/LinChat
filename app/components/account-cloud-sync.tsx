"use client";

import { useEffect, useState } from "react";
import { usePluginStore } from "../store/plugin";
import { useSdStore } from "../store/sd";
import { useDraftStore } from "../store/draft";
import {
  switchExtraWorkspace,
  persistExtraWorkspace,
  extraWorkspaceOwner,
} from "../utils/extra-workspace";
import { useAppConfig, useChatStore } from "../store";
import {
  startAccountCloudSync,
  stopAccountCloudSync,
} from "../utils/account-cloud-sync";
import { useAccount } from "./account-context";

/**
 * Binds the signed-in account to server-side AppState sync.
 * Waits for account + chat + model workspace hydration so the first pull merges
 * against the correct local owner snapshot rather than a transient guest view.
 */
export function AccountCloudSync() {
  const { enabled, loading, loggingOut, modelWorkspaceReady, user } =
    useAccount();
  const chatHydrated = useChatStore((state) => state._hasHydrated);
  const configHydrated = useAppConfig((state) => state._hasHydrated);
  const workspaceSwitching = useChatStore((state) => state.workspaceSwitching);
  const workspaceOwner = useChatStore((state) => state.workspaceOwner);
  const pluginsReady = usePluginStore((state) => state._hasHydrated);
  const drawingsReady = useSdStore((state) => state._hasHydrated);
  const draftsReady = useDraftStore((state) => state._hasHydrated);
  const [extraOwner, setExtraOwner] = useState<string | null>(null);
  const accountUserId = user?.id;

  useEffect(() => {
    if (loading || !pluginsReady || !drawingsReady || !draftsReady) return;
    let cancelled = false;
    const target =
      accountUserId && !loggingOut ? `user:${accountUserId}` : "guest";
    setExtraOwner(null);
    void switchExtraWorkspace(target)
      .then(() => {
        if (!cancelled && extraWorkspaceOwner() === target)
          setExtraOwner(target);
      })
      .catch(() => console.error("[Workspace] extra data restoration failed"));
    return () => {
      cancelled = true;
    };
  }, [
    loading,
    loggingOut,
    accountUserId,
    pluginsReady,
    drawingsReady,
    draftsReady,
  ]);

  useEffect(() => {
    const unsubscribers = [
      usePluginStore.subscribe(persistExtraWorkspace),
      useSdStore.subscribe(persistExtraWorkspace),
      useDraftStore.subscribe(persistExtraWorkspace),
    ];
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, []);

  useEffect(() => {
    const userId = user?.id?.trim();
    const ready =
      enabled &&
      !loading &&
      !loggingOut &&
      Boolean(userId) &&
      modelWorkspaceReady &&
      chatHydrated &&
      configHydrated &&
      extraOwner === `user:${userId}` &&
      !workspaceSwitching &&
      typeof workspaceOwner === "string" &&
      workspaceOwner.startsWith("user:");

    if (!ready || !userId) {
      // Logout / guest: dispose without pushing the guest workspace upstream.
      stopAccountCloudSync({ flush: false });
      return;
    }

    const stop = startAccountCloudSync({ userId });
    return () => {
      stop();
    };
  }, [
    chatHydrated,
    configHydrated,
    extraOwner,
    enabled,
    loading,
    loggingOut,
    modelWorkspaceReady,
    user?.id,
    workspaceOwner,
    workspaceSwitching,
  ]);

  return null;
}
