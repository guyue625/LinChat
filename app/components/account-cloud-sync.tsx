"use client";

import { useEffect } from "react";
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
