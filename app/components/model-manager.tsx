import { useEffect, useMemo, useRef, useState } from "react";

import { useAccessStore } from "../store";
import {
  getCustomModelsForProvider,
  mergeCustomModelDraft,
  removeCustomModelAt,
  selectUpstreamModels,
  updateCustomModelAt,
} from "../utils/custom-models";
import { fetchUpstreamModels, UpstreamModel } from "../utils/upstream-models";
import Locale from "../locales";
import AddIcon from "../icons/add.svg";
import CloseIcon from "../icons/close.svg";
import ConfirmIcon from "../icons/confirm.svg";
import DeleteIcon from "../icons/delete.svg";
import EditIcon from "../icons/edit.svg";
import LoadingIcon from "../icons/three-dots.svg";
import ResetIcon from "../icons/reload.svg";
import { IconButton } from "./button";
import { Input, Modal, showToast } from "./ui-lib";
import styles from "./model-manager.module.scss";
import { SettingRow } from "./settings-controls";
import { useAccount } from "./account-context";
import {
  resolveWorkspaceOwner,
  shouldExposeModelWorkspace,
} from "../utils/account-workspace";
import {
  createProviderCredentialSnapshot,
  getProviderUpstreamSource,
} from "./provider-config-draft";

export function ModelManager(props: {
  customModels: string;
  onChange: (customModels: string) => void;
}) {
  const accessStore = useAccessStore();
  const { enabled, loading, modelWorkspaceReady, user } = useAccount();
  const showModels = shouldExposeModelWorkspace({
    enabled,
    loading,
    modelWorkspaceReady,
    user,
  });
  const workspaceOwner = resolveWorkspaceOwner({ enabled, user });
  const fetchGenerationRef = useRef(0);
  const provider = accessStore.provider;
  const [draftName, setDraftName] = useState("");
  const [draftAlias, setDraftAlias] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [availableModels, setAvailableModels] = useState<UpstreamModel[]>();
  const [configuredModelNames, setConfiguredModelNames] = useState<Set<string>>(
    new Set(),
  );
  const [selectedModelNames, setSelectedModelNames] = useState<Set<string>>(
    new Set(),
  );
  const [modelSearch, setModelSearch] = useState("");
  const [editing, setEditing] = useState<{
    tokenIndex: number;
    name: string;
    alias: string;
  }>();
  const models = useMemo(
    () => getCustomModelsForProvider(props.customModels, provider),
    [props.customModels, provider],
  );
  const canAdd =
    !!draftName.trim() && !/[,=]/.test(draftName) && !draftAlias.includes(",");
  const canSave =
    !!editing?.name.trim() &&
    !/[,=]/.test(editing.name) &&
    !editing.alias.includes(",");
  const filteredAvailableModels = useMemo(() => {
    const query = modelSearch.trim().toLowerCase();
    if (!query) return availableModels ?? [];
    return (availableModels ?? []).filter((model) =>
      `${model.name} ${model.alias ?? ""}`.toLowerCase().includes(query),
    );
  }, [availableModels, modelSearch]);

  useEffect(() => {
    fetchGenerationRef.current += 1;
    setDraftName("");
    setDraftAlias("");
    setShowAddModal(false);
    setEditing(undefined);
    setAvailableModels(undefined);
    setModelSearch("");
  }, [provider, showModels, workspaceOwner]);

  const openAddModal = () => {
    setDraftName("");
    setDraftAlias("");
    setAvailableModels(undefined);
    setConfiguredModelNames(new Set());
    setSelectedModelNames(new Set());
    setModelSearch("");
    setShowAddModal(true);
  };

  const closeAddModal = () => {
    setShowAddModal(false);
    setDraftName("");
    setDraftAlias("");
    setAvailableModels(undefined);
    setConfiguredModelNames(new Set());
    setSelectedModelNames(new Set());
    setModelSearch("");
  };

  const confirmAddModels = () => {
    const hasManualName = !!draftName.trim();
    const hasManualAlias = !!draftAlias.trim();
    const selectedModels = selectUpstreamModels(
      availableModels ?? [],
      selectedModelNames,
      configuredModelNames,
    );

    if ((hasManualName && !canAdd) || (!hasManualName && hasManualAlias)) {
      showToast(Locale.Settings.Access.CustomModel.Invalid);
      return;
    }
    if (!hasManualName && selectedModels.length === 0) {
      showToast(Locale.Settings.Access.CustomModel.SelectionRequired);
      return;
    }

    props.onChange(
      mergeCustomModelDraft(
        props.customModels,
        provider,
        draftName,
        draftAlias,
        selectedModels,
      ),
    );
    showToast(
      Locale.Settings.Access.CustomModel.AddSuccess(
        selectedModels.length + Number(hasManualName),
      ),
    );
    closeAddModal();
  };

  const saveModel = () => {
    if (!editing || !canSave) {
      showToast(Locale.Settings.Access.CustomModel.Invalid);
      return;
    }
    props.onChange(
      updateCustomModelAt(
        props.customModels,
        editing.tokenIndex,
        provider,
        editing.name,
        editing.alias,
      ),
    );
    setEditing(undefined);
  };

  const fetchModels = async () => {
    const generation = ++fetchGenerationRef.current;
    const ownerAtStart = workspaceOwner;
    setFetching(true);
    try {
      const upstreamModels = await fetchUpstreamModels(
        getProviderUpstreamSource(
          accessStore.provider,
          createProviderCredentialSnapshot(accessStore),
        ),
      );
      if (upstreamModels.length === 0) {
        throw new Error(Locale.Settings.Access.CustomModel.EmptyResponse);
      }
      if (
        generation !== fetchGenerationRef.current ||
        ownerAtStart !== workspaceOwner
      ) {
        return;
      }
      const availableNames = new Set(upstreamModels.map((model) => model.name));
      const configuredNames = new Set(
        models
          .map((model) => model.name)
          .filter((name) => availableNames.has(name)),
      );
      setConfiguredModelNames(configuredNames);
      setSelectedModelNames(new Set());
      setAvailableModels(upstreamModels);
      setModelSearch("");
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      showToast(Locale.Settings.Access.CustomModel.FetchFailed(reason));
    } finally {
      if (
        generation === fetchGenerationRef.current &&
        ownerAtStart === workspaceOwner
      ) {
        setFetching(false);
      }
    }
  };

  const toggleModel = (name: string) => {
    setSelectedModelNames((current) => {
      const next = new Set(current);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const toggleAllFiltered = () => {
    setSelectedModelNames((current) => {
      const next = new Set(current);
      const selectableModels = filteredAvailableModels.filter(
        (model) => !configuredModelNames.has(model.name),
      );
      const allSelected = selectableModels.every((model) =>
        next.has(model.name),
      );
      selectableModels.forEach((model) => {
        if (allSelected) next.delete(model.name);
        else next.add(model.name);
      });
      return next;
    });
  };

  if (!showModels) return null;

  return (
    <>
      <SettingRow
        id="model-custom-models"
        title={Locale.Settings.Access.CustomModel.Title}
        description={
          <div className={styles.meta}>
            <span className={styles.providerBadge}>{provider}</span>
            <span>
              {Locale.Settings.Access.CustomModel.ModelCount(models.length)}
            </span>
          </div>
        }
      >
        <IconButton
          className={styles.fetchButton}
          icon={<AddIcon />}
          text={Locale.Settings.Access.CustomModel.Add}
          type="primary"
          bordered
          onClick={openAddModal}
        />
      </SettingRow>

      {models.map((model, index) =>
        editing?.tokenIndex === model.tokenIndex ? (
          <div className={styles.modelItem} key={model.tokenIndex}>
            <SettingRow
              id={`model-custom-model-${model.tokenIndex}`}
              title={`${provider} · ${index + 1}`}
              description={Locale.Settings.Access.CustomModel.Edit}
            >
              <div className={styles.editActions}>
                <Input
                  as="input"
                  className={styles.editInput}
                  aria-label={Locale.Settings.Access.CustomModel.Name}
                  value={editing.name}
                  placeholder={Locale.Settings.Access.CustomModel.Name}
                  onChange={(event) =>
                    setEditing({
                      ...editing,
                      name: event.currentTarget.value,
                    })
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") saveModel();
                  }}
                />
                <Input
                  as="input"
                  className={styles.editInput}
                  aria-label={Locale.Settings.Access.CustomModel.Alias}
                  value={editing.alias}
                  placeholder={Locale.Settings.Access.CustomModel.AliasOptional}
                  onChange={(event) =>
                    setEditing({
                      ...editing,
                      alias: event.currentTarget.value,
                    })
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") saveModel();
                  }}
                />
                <IconButton
                  className={styles.saveButton}
                  icon={<ConfirmIcon />}
                  aria={Locale.Settings.Access.CustomModel.Save}
                  title={Locale.Settings.Access.CustomModel.Save}
                  type="primary"
                  disabled={!canSave}
                  onClick={saveModel}
                />
                <IconButton
                  className={styles.actionButton}
                  icon={<CloseIcon />}
                  aria={Locale.Settings.Access.CustomModel.Cancel}
                  title={Locale.Settings.Access.CustomModel.Cancel}
                  bordered
                  onClick={() => setEditing(undefined)}
                />
              </div>
            </SettingRow>
          </div>
        ) : (
          <div className={styles.modelItem} key={model.tokenIndex}>
            <SettingRow
              id={`model-custom-model-${model.tokenIndex}`}
              title={model.alias || model.name}
              description={model.alias ? model.name : provider}
            >
              <div className={styles.rowActions}>
                <IconButton
                  className={styles.actionButton}
                  icon={<EditIcon />}
                  aria={Locale.Settings.Access.CustomModel.Edit}
                  title={Locale.Settings.Access.CustomModel.Edit}
                  onClick={() =>
                    setEditing({
                      tokenIndex: model.tokenIndex,
                      name: model.name,
                      alias: model.alias,
                    })
                  }
                />
                <IconButton
                  className={styles.deleteButton}
                  icon={<DeleteIcon />}
                  aria={Locale.Settings.Access.CustomModel.Remove}
                  title={Locale.Settings.Access.CustomModel.Remove}
                  onClick={() =>
                    props.onChange(
                      removeCustomModelAt(props.customModels, model.tokenIndex),
                    )
                  }
                />
              </div>
            </SettingRow>
          </div>
        ),
      )}

      {showAddModal && (
        <div className="modal-mask">
          <Modal
            title={Locale.Settings.Access.CustomModel.AddModalTitle}
            onClose={closeAddModal}
            actions={[
              <IconButton
                key="cancel"
                text={Locale.Settings.Access.CustomModel.Cancel}
                bordered
                onClick={closeAddModal}
              />,
              <IconButton
                key="add"
                text={Locale.Settings.Access.CustomModel.Add}
                type="primary"
                disabled={!canAdd && selectedModelNames.size === 0}
                onClick={confirmAddModels}
              />,
            ]}
          >
            <div className={styles.modelPicker}>
              <div className={styles.manualModelSection}>
                <div className={styles.sectionTitle}>
                  {Locale.Settings.Access.CustomModel.ManualTitle}
                </div>
                <Input
                  as="input"
                  className={styles.modalInput}
                  aria-label={Locale.Settings.Access.CustomModel.Name}
                  value={draftName}
                  placeholder={
                    Locale.Settings.Access.CustomModel.NamePlaceholder
                  }
                  onChange={(event) => setDraftName(event.currentTarget.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") confirmAddModels();
                  }}
                />
                <Input
                  as="input"
                  className={styles.modalInput}
                  aria-label={Locale.Settings.Access.CustomModel.Alias}
                  value={draftAlias}
                  placeholder={
                    Locale.Settings.Access.CustomModel.AliasPlaceholder
                  }
                  onChange={(event) => setDraftAlias(event.currentTarget.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") confirmAddModels();
                  }}
                />
              </div>

              <div className={styles.upstreamModelSection}>
                <div className={styles.upstreamModelHeader}>
                  <div>
                    <div className={styles.sectionTitle}>
                      {Locale.Settings.Access.CustomModel.UpstreamTitle}
                    </div>
                    <div className={styles.sectionHint}>
                      {Locale.Settings.Access.CustomModel.UpstreamHelp}
                    </div>
                  </div>
                  <IconButton
                    className={styles.fetchButton}
                    icon={fetching ? <LoadingIcon /> : <ResetIcon />}
                    text={
                      fetching
                        ? Locale.Settings.Access.CustomModel.Fetching
                        : Locale.Settings.Access.CustomModel.Fetch
                    }
                    bordered
                    disabled={fetching}
                    onClick={fetchModels}
                  />
                </div>

                {availableModels && (
                  <>
                    <div className={styles.modelPickerToolbar}>
                      <Input
                        as="input"
                        className={styles.modelSearch}
                        aria-label={Locale.Settings.Access.CustomModel.Search}
                        placeholder={Locale.Settings.Access.CustomModel.Search}
                        value={modelSearch}
                        onChange={(event) =>
                          setModelSearch(event.currentTarget.value)
                        }
                      />
                      <button
                        className={styles.selectAllButton}
                        type="button"
                        onClick={toggleAllFiltered}
                      >
                        {filteredAvailableModels.every((model) =>
                          selectedModelNames.has(model.name),
                        )
                          ? Locale.Settings.Access.CustomModel.ClearVisible
                          : Locale.Settings.Access.CustomModel.SelectVisible}
                      </button>
                    </div>
                    <div className={styles.modelPickerSummary}>
                      {Locale.Settings.Access.CustomModel.SelectedCount(
                        selectedModelNames.size,
                        availableModels.length,
                      )}
                    </div>
                    <div className={styles.modelPickerList}>
                      {filteredAvailableModels.map((model) => {
                        const alreadyAdded = configuredModelNames.has(
                          model.name,
                        );
                        return (
                          <label
                            className={styles.modelOption}
                            key={model.name}
                          >
                            <input
                              type="checkbox"
                              checked={selectedModelNames.has(model.name)}
                              disabled={alreadyAdded}
                              onChange={() => toggleModel(model.name)}
                            />
                            <span className={styles.modelOptionText}>
                              <span>{model.alias || model.name}</span>
                              {model.alias && <small>{model.name}</small>}
                            </span>
                            {alreadyAdded && (
                              <span className={styles.alreadyAdded}>
                                {
                                  Locale.Settings.Access.CustomModel
                                    .AlreadyAdded
                                }
                              </span>
                            )}
                          </label>
                        );
                      })}
                      {filteredAvailableModels.length === 0 && (
                        <div className={styles.noResults}>
                          {Locale.Settings.Access.CustomModel.NoMatches}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </Modal>
        </div>
      )}
    </>
  );
}
