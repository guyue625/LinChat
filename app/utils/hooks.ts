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
    // With custom config, the curated workspace list is the source of truth:
    // "-all" first disables the built-in catalog, then the user's "+" tokens
    // re-enable exactly the models they added in the model manager.
    const customTokens = [
      accessStore.useCustomConfig ? "-all" : "",
      configStore.customModels,
      accessStore.customModels,
    ].join(",");
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
