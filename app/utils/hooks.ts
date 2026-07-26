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
    return collectModelsWithDefaultModel(
      configStore.models,
      [configStore.customModels, accessStore.customModels].join(","),
      accessStore.defaultModel,
    );
  }, [
    accessStore.customModels,
    accessStore.defaultModel,
    configStore.customModels,
    configStore.models,
    exposeModels,
  ]);

  return models;
}
