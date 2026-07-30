import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Search as SearchIcon } from "lucide-react";
import clsx from "clsx";

import DownIcon from "../../icons/down.svg";
import ConfirmIcon from "../../icons/confirm.svg";
import { ModelType, useAccessStore } from "../../store";
import { isVisionModel } from "../../utils";
import { ServiceProvider } from "../../constant";
import type { Mask } from "../../store/mask";
import { useAllModels } from "../../utils/hooks";
import {
  filterModelsByProviders,
  resolveModelDisplayName,
} from "../../utils/model";
import { getModelVendor } from "../../utils/model-vendor";
import { focusWithoutScroll } from "../../utils/focus-without-scroll";
import { getComposerPopoverPlacement } from "../../utils/popover";
import {
  resolveWorkspaceOwner,
  shouldShowModelPicker,
} from "../../utils/account-workspace";
import Locale from "../../locales";
import { showToast } from "../ui-lib";
import { ModelIcon } from "../emoji";
import { useAccount } from "../account-context";
import styles from "../chat.module.scss";
import { ComposerToolButton } from "./composer-controls";

export function ModelSelector(props: {
  mask: Mask;
  updateMask: (updater: (mask: Mask) => void) => void;
  setAttachImages: (images: string[]) => void;
  setUploading: (uploading: boolean) => void;
  homeMode?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { mask, onOpenChange, setAttachImages, setUploading, updateMask } =
    props;
  const currentModel = mask.modelConfig.model;
  const currentProviderName =
    mask.modelConfig.providerName || ServiceProvider.OpenAI;
  const allModels = useAllModels();
  const accessStore = useAccessStore();
  const {
    enabled: accountEnabled,
    loading: accountLoading,
    modelWorkspaceReady,
    user: accountUser,
  } = useAccount();
  const workspaceOwner = resolveWorkspaceOwner({
    enabled: accountEnabled,
    user: accountUser,
  });
  const configuredProviderKey = accessStore.useCustomConfig
    ? accessStore.configuredProviders().join(",")
    : "";
  const selectedProviders = useMemo(() => {
    if (!accessStore.useCustomConfig) return undefined;
    if (configuredProviderKey) return configuredProviderKey.split(",");
    return [accessStore.provider];
  }, [
    accessStore.provider,
    accessStore.useCustomConfig,
    configuredProviderKey,
  ]);
  const models = useMemo(() => {
    const available = filterModelsByProviders(allModels, selectedProviders);
    const defaultModel = available.find((model) => model.isDefault);
    return defaultModel
      ? [defaultModel, ...available.filter((model) => model !== defaultModel)]
      : available;
  }, [allModels, selectedProviders]);
  const showModelPicker = shouldShowModelPicker(
    {
      enabled: accountEnabled,
      loading: accountLoading,
      modelWorkspaceReady,
      user: accountUser,
    },
    models.length,
  );
  const currentModelInfo = useMemo(() => {
    return models.find(
      (item) =>
        item.name === currentModel &&
        item.provider?.providerName === currentProviderName,
    );
  }, [currentModel, currentProviderName, models]);
  const currentModelName = resolveModelDisplayName({
    modelName: currentModel,
    providerName: currentProviderName,
    models,
  });
  const modelSelectorOpen = showModelPicker && props.open;
  const [modelSearch, setModelSearch] = useState("");
  const modelAnchorRef = useRef<HTMLDivElement>(null);
  const modelSearchRef = useRef<HTMLInputElement>(null);
  const [modelPopoverLayout, setModelPopoverLayout] = useState<
    ReturnType<typeof getComposerPopoverPlacement>
  >({ placement: "bottom", maxHeight: 360 });
  const filteredModels = useMemo(() => {
    const query = modelSearch.trim().toLowerCase();
    if (!query) return models;
    return models.filter((model) =>
      [
        model.displayName,
        model.name,
        model.provider?.providerName,
        getModelVendor(
          model.name,
          model.provider?.providerName,
          model.displayName,
        ),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [modelSearch, models]);
  const groupedModels = useMemo(() => {
    const groups = new Map<string, typeof filteredModels>();
    filteredModels.forEach((model) => {
      const vendor = getModelVendor(
        model.name,
        model.provider?.providerName,
        model.displayName,
      );
      const group = groups.get(vendor) ?? [];
      group.push(model);
      groups.set(vendor, group);
    });
    return Array.from(groups.entries());
  }, [filteredModels]);

  const updateModelPopoverLayout = useCallback(() => {
    if (!props.homeMode || !modelAnchorRef.current) return;

    const rect = modelAnchorRef.current.getBoundingClientRect();
    const viewport = window.visualViewport;
    const viewportTop = viewport?.offsetTop ?? 0;
    const nextLayout = getComposerPopoverPlacement({
      triggerTop: rect.top - viewportTop,
      triggerBottom: rect.bottom - viewportTop,
      viewportHeight: viewport?.height ?? window.innerHeight,
      preferredPlacement: "bottom",
    });
    setModelPopoverLayout((currentLayout) =>
      currentLayout.placement === nextLayout.placement &&
      currentLayout.maxHeight === nextLayout.maxHeight
        ? currentLayout
        : nextLayout,
    );
  }, [props.homeMode]);

  useEffect(() => {
    onOpenChange(false);
    setModelSearch("");
  }, [onOpenChange, workspaceOwner]);

  useEffect(() => {
    const canUpload = isVisionModel(currentModel);
    if (!canUpload) {
      setAttachImages([]);
      setUploading(false);
    }

    const unavailable = !models.some(
      (model) =>
        model.name === currentModel &&
        model.provider?.providerName === currentProviderName,
    );
    if (unavailable && models.length > 0) {
      const nextModel = models.find((model) => model.isDefault) || models[0];
      updateMask((mask) => {
        mask.modelConfig.model = nextModel.name;
        mask.modelConfig.providerName = nextModel.provider
          ?.providerName as ServiceProvider;
      });
      showToast(nextModel.displayName || nextModel.name);
    }
  }, [
    currentModel,
    currentProviderName,
    models,
    setAttachImages,
    setUploading,
    updateMask,
  ]);

  useEffect(() => {
    if (!modelSelectorOpen || !props.homeMode) return;

    const viewport = window.visualViewport;
    window.addEventListener("resize", updateModelPopoverLayout);
    viewport?.addEventListener("resize", updateModelPopoverLayout);
    return () => {
      window.removeEventListener("resize", updateModelPopoverLayout);
      viewport?.removeEventListener("resize", updateModelPopoverLayout);
    };
  }, [modelSelectorOpen, props.homeMode, updateModelPopoverLayout]);

  useEffect(() => {
    if (modelSelectorOpen) focusWithoutScroll(modelSearchRef.current);
  }, [modelSelectorOpen]);

  const close = () => onOpenChange(false);
  const selectModel = (model: (typeof models)[number]) => {
    updateMask((mask) => {
      mask.modelConfig.model = model.name as ModelType;
      mask.modelConfig.providerName = model.provider
        ?.providerName as ServiceProvider;
      mask.syncGlobalConfig = false;
    });
    showToast(model.displayName || model.name);
    close();
    setModelSearch("");
  };

  return (
    <div
      className={styles["composer-anchor"]}
      ref={modelAnchorRef}
      hidden={!showModelPicker}
      style={{ display: showModelPicker ? undefined : "none" }}
    >
      <ComposerToolButton
        icon={
          <ModelIcon
            model={currentModel}
            provider={currentProviderName}
            displayName={currentModelInfo?.displayName}
            className={styles["composer-model-icon"]}
            size={24}
          />
        }
        label={currentModelName}
        active={modelSelectorOpen}
        className={styles["composer-model-button"]}
        onClick={() => {
          if (!modelSelectorOpen) updateModelPopoverLayout();
          onOpenChange(!modelSelectorOpen);
        }}
      >
        <span className={styles["composer-model-name"]}>
          {currentModelName}
        </span>
        <DownIcon />
      </ComposerToolButton>
      {modelSelectorOpen && (
        <div
          className={clsx(styles["composer-model-popover"], {
            [styles["composer-model-popover-home"]]: props.homeMode,
          })}
          data-placement={
            props.homeMode ? modelPopoverLayout.placement : undefined
          }
          style={
            props.homeMode
              ? ({
                  "--composer-model-popover-max-height": `${modelPopoverLayout.maxHeight}px`,
                  "--composer-model-list-max-height": `${Math.max(
                    0,
                    modelPopoverLayout.maxHeight - 64,
                  )}px`,
                } as React.CSSProperties)
              : undefined
          }
        >
          <div className={styles["composer-model-search"]}>
            <SearchIcon aria-hidden="true" />
            <input
              ref={modelSearchRef}
              value={modelSearch}
              placeholder={`${Locale.Settings.Model}...`}
              aria-label={Locale.Settings.Model}
              onChange={(event) => setModelSearch(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") close();
              }}
            />
          </div>
          <div className={styles["composer-model-list"]}>
            {groupedModels.map(([vendorName, vendorModels]) => (
              <section
                className={styles["composer-model-group"]}
                key={vendorName}
              >
                <div className={styles["composer-model-group-title"]}>
                  <span>{`模型厂商 · ${vendorName}`}</span>
                  <small>{vendorModels.length}</small>
                </div>
                {vendorModels.map((model) => {
                  const selected =
                    model.name === currentModel &&
                    model.provider?.providerName === currentProviderName;
                  return (
                    <button
                      type="button"
                      key={`${model.name}@${
                        model.provider?.providerName ?? "Other"
                      }`}
                      className={clsx(
                        styles["composer-model-item"],
                        selected && styles["composer-model-item-selected"],
                      )}
                      onClick={() => selectModel(model)}
                    >
                      <span className={styles["composer-model-avatar"]}>
                        <ModelIcon
                          model={model.name}
                          provider={model.provider?.providerName}
                          displayName={model.displayName}
                          size={28}
                        />
                      </span>
                      <span className={styles["composer-model-copy"]}>
                        <strong>{model.displayName || model.name}</strong>
                        <small>{model.name}</small>
                      </span>
                      {selected && <ConfirmIcon />}
                    </button>
                  );
                })}
              </section>
            ))}
            {filteredModels.length === 0 && (
              <div className={styles["composer-model-empty"]}>
                {Locale.Settings.Model}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
