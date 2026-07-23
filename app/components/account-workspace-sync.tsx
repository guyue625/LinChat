"use client";

import { useEffect, useRef } from "react";
import {
  resetAccessFetch,
  useAccessStore,
  useAppConfig,
  useChatStore,
} from "../store";
import { DEFAULT_MODELS } from "../constant";
import {
  resolveWorkspaceOwner,
  shouldExposeServerModels,
} from "../utils/account-workspace";
import { useAccount } from "./account-context";

/**
 * Keeps chat sessions and server model catalogues aligned with the account
 * session. Runs as a side-effect sibling under AccountProvider.
 */
export function AccountWorkspaceSync() {
  const { enabled, loading, user } = useAccount();
  const lastOwnerRef = useRef<string | null>(null);
  const modelsUnlockedRef = useRef<boolean | null>(null);

  useEffect(() => {
    if (loading) return;

    const nextOwner = resolveWorkspaceOwner({ enabled, user });
    const isFirstSync = lastOwnerRef.current === null;
    if (!isFirstSync && lastOwnerRef.current === nextOwner) return;
    lastOwnerRef.current = nextOwner;

    void useChatStore
      .getState()
      .switchWorkspace(nextOwner, { force: isFirstSync });
  }, [enabled, loading, user?.id]);

  useEffect(() => {
    if (loading) return;

    const allowServerModels = shouldExposeServerModels({ enabled, user });
    if (modelsUnlockedRef.current === allowServerModels) return;
    modelsUnlockedRef.current = allowServerModels;

    if (!allowServerModels) {
      // Guest view: hide server-provisioned models; keep only built-ins /
      // user-entered API keys path. Session chat history is already swapped.
      useAccessStore.getState().clearServerModels();
      useAppConfig.setState({
        models: DEFAULT_MODELS as any,
        customModels: "",
      });
      return;
    }

    // Logged in (or account auth off): re-pull server config + model list.
    resetAccessFetch();
    useAccessStore.getState().fetch({ includeServerModels: true });
  }, [enabled, loading, user?.id]);

  return null;
}
