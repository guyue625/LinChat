import { useMemo } from "react";
import { useAccessStore, useAppConfig } from "../store";
import { useAccount } from "../components/account-context";
import { collectModelsWithDefaultModel } from "./model";
import { shouldExposeModelWorkspace } from "./account-workspace";

export function useAllModels() {
  const accessStore = useAccessStore();
  const configStore = useAppConfig();
  const { enabled, loading, modelWorkspaceReady, user } = useAccount();
  const exposeModels = shouldExposeModelWorkspace({
    enabled,
    loading,
    modelWorkspaceReady,
    user,
  });
  const models = useMemo(() => {
    if (!exposeModels) return [];
    // With custom config, the curated workspace list is the sole source of
    // truth: "-all" disables the built-in catalog AND whatever the server
    // enables via CUSTOM_MODELS (its tokens are dropped here on purpose —
    // e.g. a server-side "all" would otherwise re-enable the whole catalog).
    // Only the user's "+" tokens from the model manager survive.
    const customTokens = accessStore.useCustomConfig
      ? ["-all", configStore.customModels].join(",")
      : [configStore.customModels, accessStore.customModels].join(",");
    return collectModelsWithDefaultModel(
      configStore.models,
      customTokens,
      accessStore.defaultModel,
    );
  }, [
    accessStore.customModels,
    accessStore.defaultModel,
    accessStore.useCustomConfig,
    configStore.customModels,
    configStore.models,
    exposeModels,
  ]);

  return models;
}
