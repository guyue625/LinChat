import {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
  type ReactNode,
} from "react";
import clsx from "clsx";

import styles from "./settings.module.scss";

import ResetIcon from "../icons/reload.svg";
import AddIcon from "../icons/add.svg";
import CloseIcon from "../icons/close.svg";
import CopyIcon from "../icons/copy.svg";
import ClearIcon from "../icons/clear.svg";
import LoadingIcon from "../icons/three-dots.svg";
import EditIcon from "../icons/edit.svg";
import FireIcon from "../icons/fire.svg";
import EyeIcon from "../icons/eye.svg";
import DownloadIcon from "../icons/download.svg";
import UploadIcon from "../icons/upload.svg";
import ConfigIcon from "../icons/config.svg";
import SettingsIcon from "../icons/settings.svg";
import BrainIcon from "../icons/brain.svg";
import PaletteIcon from "../icons/palette.svg";
import VoiceIcon from "../icons/voice.svg";
import RobotIcon from "../icons/robot.svg";
import HistoryIcon from "../icons/history.svg";
import ConfirmIcon from "../icons/confirm.svg";

import ConnectionIcon from "../icons/connection.svg";
import CloudSuccessIcon from "../icons/cloud-success.svg";
import CloudFailIcon from "../icons/cloud-fail.svg";
import { trackSettingsPageGuideToCPaymentClick } from "../utils/auth-settings-events";
import {
  Input,
  List,
  ListItem,
  Modal,
  PasswordInput,
  Popover,
  Select,
  showConfirm,
  showToast,
} from "./ui-lib";
import { ModelConfigList } from "./model-config";
import { ModelManager } from "./model-manager";
import { ProviderConfigEditor } from "./provider-config-editor";
import { DangerConfirmDialog } from "./danger-confirm-dialog";
import {
  createProviderCredentialSnapshot,
  type ProviderCredentialPatch,
  type ProviderCredentialSnapshot,
} from "./provider-config-draft";
import {
  confirmSettingsLeave,
  registerBeforeUnload,
} from "./settings-leave-guard";

import { IconButton } from "./button";
import {
  DEFAULT_CONFIG,
  SubmitKey,
  useChatStore,
  Theme,
  useUpdateStore,
  useAccessStore,
  useAppConfig,
} from "../store";

import Locale, {
  AllLangs,
  ALL_LANG_OPTIONS,
  changeLang,
  getLang,
} from "../locales";
import { copyToClipboard, clientUpdate, semverCompare } from "../utils";
import Link from "next/link";
import {
  OPENAI_BASE_URL,
  Path,
  RELEASE_URL,
  STORAGE_KEY,
  ServiceProvider,
  SlotID,
  UPDATE_URL,
  SAAS_CHAT_URL,
} from "../constant";
import { Prompt, SearchService, usePromptStore } from "../store/prompt";
import { ErrorBoundary } from "./error";
import { InputRange } from "./input-range";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Avatar, AvatarPicker } from "./emoji";
import { getClientConfig } from "../config/client";
import { useSyncStore } from "../store/sync";
import { nanoid } from "nanoid";
import { useMaskStore } from "../store/mask";
import { ProviderType } from "../utils/cloud";
import { TTSConfigList } from "./tts-config";
import { RealtimeConfigList } from "./realtime-chat/realtime-config";
import { useAccount } from "./account-context";
import { AccountAvatar } from "./account-avatar";
import { accountDisplayName } from "./account-utils";
import { SettingsSearch } from "./settings-search";
import {
  SettingRow,
  SettingSection,
  SettingSwitch,
  SettingsSubnav,
} from "./settings-controls";
import {
  buildSettingsSearchEntries,
  DEFAULT_SETTINGS_SUBPAGES,
  resolveSettingsLocation,
  type SettingsCategory,
  type SettingsSearchEntry,
  type SettingsSubpage,
} from "./settings-schema";
import {
  coordinateSettingsSearchSelection,
  createSettingsFocusCoordinator,
  getSettingsSearchProvider,
  updateSettingsLocationParams,
} from "./settings-search-coordinator";

export type { SettingsCategory } from "./settings-schema";

type AccessState = Parameters<typeof createProviderCredentialSnapshot>[0];

function useStableProviderCredentialSnapshot(
  accessState: AccessState,
): ProviderCredentialSnapshot {
  const next = createProviderCredentialSnapshot(accessState);
  const signature = JSON.stringify(next);
  const cache = useRef({ signature, value: next });

  if (cache.current.signature !== signature) {
    cache.current = { signature, value: next };
  }

  return cache.current.value;
}

function EditPromptModal(props: { id: string; onClose: () => void }) {
  const promptStore = usePromptStore();
  const prompt = promptStore.get(props.id);

  return prompt ? (
    <div className="modal-mask">
      <Modal
        title={Locale.Settings.Prompt.EditModal.Title}
        onClose={props.onClose}
        actions={[
          <IconButton
            key=""
            onClick={props.onClose}
            text={Locale.UI.Confirm}
            bordered
          />,
        ]}
      >
        <div className={styles["edit-prompt-modal"]}>
          <Input
            as="input"
            type="text"
            value={prompt.title}
            readOnly={!prompt.isUser}
            className={styles["edit-prompt-title"]}
            onInput={(e) =>
              promptStore.updatePrompt(
                props.id,
                (prompt) => (prompt.title = e.currentTarget.value),
              )
            }
          />
          <Input
            value={prompt.content}
            readOnly={!prompt.isUser}
            className={styles["edit-prompt-content"]}
            rows={10}
            onInput={(e) =>
              promptStore.updatePrompt(
                props.id,
                (prompt) => (prompt.content = e.currentTarget.value),
              )
            }
          ></Input>
        </div>
      </Modal>
    </div>
  ) : null;
}

function UserPromptModal(props: { onClose?: () => void }) {
  const promptStore = usePromptStore();
  const userPrompts = promptStore.getUserPrompts();
  const builtinPrompts = SearchService.builtinPrompts;
  const allPrompts = userPrompts.concat(builtinPrompts);
  const [searchInput, setSearchInput] = useState("");
  const [searchPrompts, setSearchPrompts] = useState<Prompt[]>([]);
  const prompts = searchInput.length > 0 ? searchPrompts : allPrompts;

  const [editingPromptId, setEditingPromptId] = useState<string>();

  useEffect(() => {
    if (searchInput.length > 0) {
      const searchResult = SearchService.search(searchInput);
      setSearchPrompts(searchResult);
    } else {
      setSearchPrompts([]);
    }
  }, [searchInput]);

  return (
    <div className="modal-mask">
      <Modal
        title={Locale.Settings.Prompt.Modal.Title}
        onClose={() => props.onClose?.()}
        actions={[
          <IconButton
            key="add"
            onClick={() => {
              const promptId = promptStore.add({
                id: nanoid(),
                createdAt: Date.now(),
                title: "Empty Prompt",
                content: "Empty Prompt Content",
              });
              setEditingPromptId(promptId);
            }}
            icon={<AddIcon />}
            bordered
            text={Locale.Settings.Prompt.Modal.Add}
          />,
        ]}
      >
        <div className={styles["user-prompt-modal"]}>
          <Input
            as="input"
            type="text"
            className={styles["user-prompt-search"]}
            placeholder={Locale.Settings.Prompt.Modal.Search}
            value={searchInput}
            onInput={(e) => setSearchInput(e.currentTarget.value)}
          />

          <div className={styles["user-prompt-list"]}>
            {prompts.map((v, _) => (
              <div className={styles["user-prompt-item"]} key={v.id ?? v.title}>
                <div className={styles["user-prompt-header"]}>
                  <div className={styles["user-prompt-title"]}>{v.title}</div>
                  <div className={styles["user-prompt-content"] + " one-line"}>
                    {v.content}
                  </div>
                </div>

                <div className={styles["user-prompt-buttons"]}>
                  {v.isUser && (
                    <IconButton
                      icon={<ClearIcon />}
                      className={styles["user-prompt-button"]}
                      onClick={() => promptStore.remove(v.id!)}
                    />
                  )}
                  {v.isUser ? (
                    <IconButton
                      icon={<EditIcon />}
                      className={styles["user-prompt-button"]}
                      onClick={() => setEditingPromptId(v.id)}
                    />
                  ) : (
                    <IconButton
                      icon={<EyeIcon />}
                      className={styles["user-prompt-button"]}
                      onClick={() => setEditingPromptId(v.id)}
                    />
                  )}
                  <IconButton
                    icon={<CopyIcon />}
                    className={styles["user-prompt-button"]}
                    onClick={() => copyToClipboard(v.content)}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </Modal>

      {editingPromptId !== undefined && (
        <EditPromptModal
          id={editingPromptId!}
          onClose={() => setEditingPromptId(undefined)}
        />
      )}
    </div>
  );
}

function DangerItems() {
  const chatStore = useChatStore();
  const appConfig = useAppConfig();
  const [showClearAllConfirm, setShowClearAllConfirm] = useState(false);

  return (
    <>
      <SettingRow
        id="data-reset-settings"
        title={Locale.Settings.Danger.Reset.Title}
        description={Locale.Settings.Danger.Reset.SubTitle}
        danger
      >
        <IconButton
          aria={Locale.Settings.Danger.Reset.Title}
          text={Locale.Settings.Danger.Reset.Action}
          onClick={async () => {
            if (await showConfirm(Locale.Settings.Danger.Reset.Confirm)) {
              appConfig.reset();
            }
          }}
          type="danger"
        />
      </SettingRow>
      <SettingRow
        id="data-clear-all"
        title={Locale.Settings.Danger.Clear.Title}
        description={Locale.Settings.Danger.Clear.SubTitle}
        danger
      >
        <IconButton
          aria={Locale.Settings.Danger.Clear.Title}
          text={Locale.Settings.Danger.Clear.Action}
          onClick={() => setShowClearAllConfirm(true)}
          type="danger"
        />
      </SettingRow>
      <DangerConfirmDialog
        open={showClearAllConfirm}
        confirmWord={Locale.Settings.Danger.Confirm.ConfirmWord}
        title={Locale.Settings.Danger.Confirm.Title}
        description={Locale.Settings.Danger.Confirm.Description}
        inputLabel={Locale.Settings.Danger.Confirm.InputLabel(
          Locale.Settings.Danger.Confirm.ConfirmWord,
        )}
        confirmLabel={Locale.Settings.Danger.Confirm.Action}
        cancelLabel={Locale.Settings.Danger.Confirm.Cancel}
        onClose={() => setShowClearAllConfirm(false)}
        onConfirm={() => {
          setShowClearAllConfirm(false);
          chatStore.clearAllData();
        }}
      />
    </>
  );
}

function CheckButton() {
  const syncStore = useSyncStore();

  const couldCheck = useMemo(() => {
    return syncStore.cloudSync();
  }, [syncStore]);

  const [checkState, setCheckState] = useState<
    "none" | "checking" | "success" | "failed"
  >("none");

  async function check() {
    setCheckState("checking");
    const valid = await syncStore.check();
    setCheckState(valid ? "success" : "failed");
  }

  if (!couldCheck) return null;

  return (
    <IconButton
      text={Locale.Settings.Sync.Config.Modal.Check}
      bordered
      onClick={check}
      icon={
        checkState === "none" ? (
          <ConnectionIcon />
        ) : checkState === "checking" ? (
          <LoadingIcon />
        ) : checkState === "success" ? (
          <CloudSuccessIcon />
        ) : checkState === "failed" ? (
          <CloudFailIcon />
        ) : (
          <ConnectionIcon />
        )
      }
    ></IconButton>
  );
}

function SyncConfigModal(props: { onClose?: () => void }) {
  const syncStore = useSyncStore();

  return (
    <div className="modal-mask">
      <Modal
        title={Locale.Settings.Sync.Config.Modal.Title}
        onClose={() => props.onClose?.()}
        actions={[
          <CheckButton key="check" />,
          <IconButton
            key="confirm"
            onClick={props.onClose}
            icon={<ConfirmIcon />}
            bordered
            text={Locale.UI.Confirm}
          />,
        ]}
      >
        <List className={styles["settings-list"]}>
          <ListItem
            title={Locale.Settings.Sync.Config.SyncType.Title}
            subTitle={Locale.Settings.Sync.Config.SyncType.SubTitle}
          >
            <select
              value={syncStore.provider}
              onChange={(e) => {
                syncStore.update(
                  (config) =>
                    (config.provider = e.target.value as ProviderType),
                );
              }}
            >
              {Object.entries(ProviderType).map(([k, v]) => (
                <option value={v} key={k}>
                  {k}
                </option>
              ))}
            </select>
          </ListItem>

          <ListItem
            title={Locale.Settings.Sync.Config.Proxy.Title}
            subTitle={Locale.Settings.Sync.Config.Proxy.SubTitle}
          >
            <input
              type="checkbox"
              checked={syncStore.useProxy}
              onChange={(e) => {
                syncStore.update(
                  (config) => (config.useProxy = e.currentTarget.checked),
                );
              }}
            ></input>
          </ListItem>
          {syncStore.useProxy ? (
            <ListItem
              title={Locale.Settings.Sync.Config.ProxyUrl.Title}
              subTitle={Locale.Settings.Sync.Config.ProxyUrl.SubTitle}
            >
              <Input
                as="input"
                type="text"
                value={syncStore.proxyUrl}
                onChange={(e) => {
                  syncStore.update(
                    (config) => (config.proxyUrl = e.currentTarget.value),
                  );
                }}
              />
            </ListItem>
          ) : null}
        </List>

        {syncStore.provider === ProviderType.WebDAV && (
          <>
            <List className={styles["settings-list"]}>
              <ListItem title={Locale.Settings.Sync.Config.WebDav.Endpoint}>
                <Input
                  as="input"
                  type="text"
                  value={syncStore.webdav.endpoint}
                  onChange={(e) => {
                    syncStore.update(
                      (config) =>
                        (config.webdav.endpoint = e.currentTarget.value),
                    );
                  }}
                />
              </ListItem>

              <ListItem title={Locale.Settings.Sync.Config.WebDav.UserName}>
                <Input
                  as="input"
                  type="text"
                  value={syncStore.webdav.username}
                  onChange={(e) => {
                    syncStore.update(
                      (config) =>
                        (config.webdav.username = e.currentTarget.value),
                    );
                  }}
                />
              </ListItem>
              <ListItem title={Locale.Settings.Sync.Config.WebDav.Password}>
                <PasswordInput
                  value={syncStore.webdav.password}
                  onChange={(e) => {
                    syncStore.update(
                      (config) =>
                        (config.webdav.password = e.currentTarget.value),
                    );
                  }}
                ></PasswordInput>
              </ListItem>
            </List>
          </>
        )}

        {syncStore.provider === ProviderType.UpStash && (
          <List className={styles["settings-list"]}>
            <ListItem title={Locale.Settings.Sync.Config.UpStash.Endpoint}>
              <Input
                as="input"
                type="text"
                value={syncStore.upstash.endpoint}
                onChange={(e) => {
                  syncStore.update(
                    (config) =>
                      (config.upstash.endpoint = e.currentTarget.value),
                  );
                }}
              />
            </ListItem>

            <ListItem title={Locale.Settings.Sync.Config.UpStash.UserName}>
              <Input
                as="input"
                type="text"
                value={syncStore.upstash.username}
                placeholder={STORAGE_KEY}
                onChange={(e) => {
                  syncStore.update(
                    (config) =>
                      (config.upstash.username = e.currentTarget.value),
                  );
                }}
              />
            </ListItem>
            <ListItem title={Locale.Settings.Sync.Config.UpStash.Password}>
              <PasswordInput
                value={syncStore.upstash.apiKey}
                onChange={(e) => {
                  syncStore.update(
                    (config) => (config.upstash.apiKey = e.currentTarget.value),
                  );
                }}
              ></PasswordInput>
            </ListItem>
          </List>
        )}
      </Modal>
    </div>
  );
}

function CloudSyncItems() {
  const syncStore = useSyncStore();
  const couldSync = useMemo(() => {
    return syncStore.cloudSync();
  }, [syncStore]);

  const [showSyncConfigModal, setShowSyncConfigModal] = useState(false);

  return (
    <>
      <SettingRow
        id="data-cloud-sync"
        title={Locale.Settings.Sync.CloudState}
        description={
          syncStore.lastProvider
            ? `${new Date(syncStore.lastSyncTime).toLocaleString()} [${
                syncStore.lastProvider
              }]`
            : Locale.Settings.Sync.NotSyncYet
        }
      >
        <div style={{ display: "flex" }}>
          <IconButton
            aria={Locale.Settings.Sync.CloudState + Locale.UI.Config}
            icon={<ConfigIcon />}
            text={Locale.UI.Config}
            onClick={() => {
              setShowSyncConfigModal(true);
            }}
          />
          {couldSync && (
            <IconButton
              aria={Locale.Settings.Sync.CloudState + Locale.UI.Sync}
              icon={<ResetIcon />}
              text={Locale.UI.Sync}
              onClick={async () => {
                try {
                  await syncStore.sync();
                  showToast(Locale.Settings.Sync.Success);
                } catch (e) {
                  showToast(Locale.Settings.Sync.Fail);
                  console.error("[Sync]", e);
                }
              }}
            />
          )}
        </div>
      </SettingRow>

      {showSyncConfigModal && (
        <SyncConfigModal onClose={() => setShowSyncConfigModal(false)} />
      )}
    </>
  );
}

function LocalTransferItems() {
  const syncStore = useSyncStore();
  const chatStore = useChatStore();
  const promptStore = usePromptStore();
  const maskStore = useMaskStore();
  const stateOverview = useMemo(() => {
    const sessions = chatStore.sessions;
    const messageCount = sessions.reduce((p, c) => p + c.messages.length, 0);

    return {
      chat: sessions.length,
      message: messageCount,
      prompt: Object.keys(promptStore.prompts).length,
      mask: Object.keys(maskStore.masks).length,
    };
  }, [chatStore.sessions, maskStore.masks, promptStore.prompts]);

  return (
    <SettingRow
      id="data-local-transfer"
      title={Locale.Settings.Sync.LocalState}
      description={Locale.Settings.Sync.Overview(stateOverview)}
    >
      <div style={{ display: "flex" }}>
        <IconButton
          aria={Locale.Settings.Sync.LocalState + Locale.UI.Export}
          icon={<UploadIcon />}
          text={Locale.UI.Export}
          onClick={() => {
            syncStore.export();
          }}
        />
        <IconButton
          aria={Locale.Settings.Sync.LocalState + Locale.UI.Import}
          icon={<DownloadIcon />}
          text={Locale.UI.Import}
          onClick={() => {
            syncStore.import();
          }}
        />
      </div>
    </SettingRow>
  );
}

export function Settings() {
  const navigate = useNavigate();
  const { user: accountUser } = useAccount();
  const accountName = accountUser ? accountDisplayName(accountUser) : "User";
  const [searchParams, setSearchParams] = useSearchParams();
  const location = resolveSettingsLocation(
    searchParams.get("tab"),
    searchParams.get("section"),
  );
  const activeCategory = location.category;
  const [, setPendingSettingId] = useState<string>();
  const [providerDraftDirty, setProviderDraftDirty] = useState(false);
  const [providerEditorRevision, setProviderEditorRevision] = useState(0);
  const leaveConfirmationRef = useRef<Promise<boolean> | null>(null);
  const guardedActionSequenceRef = useRef(0);
  const focusCoordinatorRef = useRef<ReturnType<
    typeof createSettingsFocusCoordinator
  > | null>(null);

  const getFocusCoordinator = () => {
    if (!focusCoordinatorRef.current) {
      focusCoordinatorRef.current = createSettingsFocusCoordinator({
        onPendingChange: setPendingSettingId,
      });
    }
    return focusCoordinatorRef.current;
  };

  useEffect(
    () => () => {
      focusCoordinatorRef.current?.dispose();
      focusCoordinatorRef.current = null;
    },
    [],
  );

  const requestSettingsLeave = useCallback(() => {
    if (!providerDraftDirty) {
      return confirmSettingsLeave(false, () =>
        window.confirm(Locale.Settings.LeaveConfirm.DiscardProviderChanges),
      );
    }
    if (leaveConfirmationRef.current) return leaveConfirmationRef.current;

    const request = confirmSettingsLeave(true, () =>
      window.confirm(Locale.Settings.LeaveConfirm.DiscardProviderChanges),
    );
    leaveConfirmationRef.current = request;
    const clearRequest = () => {
      if (leaveConfirmationRef.current === request) {
        leaveConfirmationRef.current = null;
      }
    };
    void request.then(clearRequest, clearRequest);
    return request;
  }, [providerDraftDirty]);

  const runAfterSettingsLeave = useCallback(
    async (action: () => void | Promise<void>) => {
      const actionSequence = ++guardedActionSequenceRef.current;
      const wasDirty = providerDraftDirty;
      let allowed = false;

      try {
        allowed = await requestSettingsLeave();
      } catch {
        return false;
      }
      if (!allowed || actionSequence !== guardedActionSequenceRef.current) {
        return false;
      }

      if (wasDirty) {
        setProviderDraftDirty(false);
        setProviderEditorRevision((revision) => revision + 1);
      }
      await action();
      return true;
    },
    [providerDraftDirty, requestSettingsLeave],
  );

  const closeSettings = useCallback(() => {
    void runAfterSettingsLeave(() => navigate(Path.Home));
  }, [navigate, runAfterSettingsLeave]);

  const categories = [
    {
      id: "general",
      icon: <SettingsIcon />,
      ...Locale.Settings.Category.General,
    },
    { id: "model", icon: <BrainIcon />, ...Locale.Settings.Category.Model },
    {
      id: "appearance",
      icon: <PaletteIcon />,
      ...Locale.Settings.Category.Appearance,
    },
    { id: "voice", icon: <VoiceIcon />, ...Locale.Settings.Category.Voice },
    {
      id: "assistants",
      icon: <RobotIcon />,
      ...Locale.Settings.Category.Assistants,
    },
    { id: "data", icon: <HistoryIcon />, ...Locale.Settings.Category.Data },
  ] satisfies Array<{
    id: SettingsCategory;
    icon: ReactNode;
    Title: string;
    SubTitle: string;
  }>;
  const activeCategoryMeta =
    categories.find((category) => category.id === activeCategory) ??
    categories[0];
  const subpageLabels: Record<SettingsSubpage, string> = {
    general: categories[0].Title,
    "model-providers": Locale.Settings.Subpage.ModelProviders,
    "model-catalog": Locale.Settings.Subpage.ModelCatalog,
    "model-defaults": Locale.Settings.Subpage.ModelDefaults,
    appearance: categories[2].Title,
    "voice-realtime": Locale.Settings.Subpage.VoiceRealtime,
    "voice-tts": Locale.Settings.Subpage.VoiceTTS,
    assistants: categories[4].Title,
    "data-sync": Locale.Settings.Subpage.DataSync,
    "data-transfer": Locale.Settings.Subpage.DataTransfer,
    "data-danger": Locale.Settings.Subpage.DataDanger,
  };
  const subnavItemsByCategory: Partial<
    Record<
      SettingsCategory,
      readonly { value: SettingsSubpage; label: ReactNode }[]
    >
  > = {
    model: [
      {
        value: "model-providers",
        label: subpageLabels["model-providers"],
      },
      { value: "model-catalog", label: subpageLabels["model-catalog"] },
      { value: "model-defaults", label: subpageLabels["model-defaults"] },
    ],
    voice: [
      { value: "voice-realtime", label: subpageLabels["voice-realtime"] },
      { value: "voice-tts", label: subpageLabels["voice-tts"] },
    ],
    data: [
      { value: "data-sync", label: subpageLabels["data-sync"] },
      { value: "data-transfer", label: subpageLabels["data-transfer"] },
      { value: "data-danger", label: subpageLabels["data-danger"] },
    ],
  };
  const activeSubnavItems = subnavItemsByCategory[activeCategory];
  const localeSettings = Locale.Settings;
  const searchEntries = useMemo(
    () => buildSettingsSearchEntries(localeSettings),
    [localeSettings],
  );

  function setSettingsLocation(
    category: SettingsCategory,
    subpage: SettingsSubpage = DEFAULT_SETTINGS_SUBPAGES[category],
  ) {
    setSearchParams((previous) =>
      updateSettingsLocationParams(previous, category, subpage),
    );
  }

  const selectCategory = (category: SettingsCategory) => {
    void runAfterSettingsLeave(() => setSettingsLocation(category));
  };

  const selectSubpage = (subpage: SettingsSubpage) => {
    void runAfterSettingsLeave(() =>
      setSettingsLocation(activeCategory, subpage),
    );
  };

  function focusSetting(entry: SettingsSearchEntry) {
    void runAfterSettingsLeave(() => {
      const provider = getSettingsSearchProvider(entry.id);
      if (provider) applyProviderChange(provider, true);

      coordinateSettingsSearchSelection(entry, {
        setLocation: setSettingsLocation,
        focus: (id) => getFocusCoordinator().focus(id),
      });
    });
  }

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const config = useAppConfig();
  const updateConfig = config.update;

  const updateStore = useUpdateStore();
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const currentVersion = updateStore.formatVersion(updateStore.version);
  const remoteId = updateStore.formatVersion(updateStore.remoteVersion);
  const hasNewVersion = semverCompare(currentVersion, remoteId) === -1;
  const updateUrl = getClientConfig()?.isApp ? RELEASE_URL : UPDATE_URL;

  function checkUpdate(force = false) {
    setCheckingUpdate(true);
    updateStore.getLatestVersion(force).then(() => {
      setCheckingUpdate(false);
    });

    console.log("[Update] local version ", updateStore.version);
    console.log("[Update] remote version ", updateStore.remoteVersion);
  }

  const accessStore = useAccessStore();
  const providerInitialValues =
    useStableProviderCredentialSnapshot(accessStore);

  function applyProviderChange(
    provider: ServiceProvider,
    enableCustomConfig = false,
  ) {
    if (provider === accessStore.provider) {
      if (enableCustomConfig && !accessStore.useCustomConfig) {
        accessStore.update((access) => {
          access.useCustomConfig = true;
        });
      }
      return;
    }

    accessStore.update((access) => {
      access.provider = provider;
      if (enableCustomConfig) {
        access.useCustomConfig = true;
      }
    });
  }

  function requestProviderChange(
    provider: ServiceProvider,
    enableCustomConfig = false,
  ) {
    return runAfterSettingsLeave(() =>
      applyProviderChange(provider, enableCustomConfig),
    );
  }

  function saveProviderCredentials(patch: ProviderCredentialPatch) {
    accessStore.update((access) => Object.assign(access, patch));
  }

  const shouldHideBalanceQuery = useMemo(() => {
    const isOpenAiUrl = accessStore.openaiUrl.includes(OPENAI_BASE_URL);

    return (
      accessStore.hideBalanceQuery ||
      isOpenAiUrl ||
      accessStore.provider === ServiceProvider.Azure
    );
  }, [
    accessStore.hideBalanceQuery,
    accessStore.openaiUrl,
    accessStore.provider,
  ]);

  const usage = {
    used: updateStore.used,
    subscription: updateStore.subscription,
  };
  const [loadingUsage, setLoadingUsage] = useState(false);
  function checkUsage(force = false) {
    if (shouldHideBalanceQuery) {
      return;
    }

    setLoadingUsage(true);
    updateStore.updateUsage(force).finally(() => {
      setLoadingUsage(false);
    });
  }

  const enabledAccessControl = useMemo(
    () => accessStore.enabledAccessControl(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const promptStore = usePromptStore();
  const builtinCount = SearchService.count.builtin;
  const customCount = promptStore.getUserPrompts().length ?? 0;
  const [shouldShowPromptModal, setShowPromptModal] = useState(false);

  const showUsage = accessStore.isAuthorized();
  useEffect(() => {
    // checks per minutes
    checkUpdate();
    showUsage && checkUsage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return registerBeforeUnload(providerDraftDirty);
  }, [providerDraftDirty]);

  useEffect(() => {
    const keydownEvent = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) {
        e.preventDefault();
        closeSettings();
      }
    };
    document.addEventListener("keydown", keydownEvent);
    return () => {
      document.removeEventListener("keydown", keydownEvent);
    };
  }, [closeSettings]);

  useEffect(() => {
    if (clientConfig?.isApp) {
      // Force to set custom endpoint to true if it's app
      accessStore.update((state) => {
        state.useCustomConfig = true;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clientConfig = useMemo(() => getClientConfig(), []);
  const showAccessCode = enabledAccessControl && !clientConfig?.isApp;

  const accessCodeComponent = showAccessCode && (
    <SettingRow
      id="model-access-code"
      title={Locale.Settings.Access.AccessCode.Title}
      description={Locale.Settings.Access.AccessCode.SubTitle}
    >
      <PasswordInput
        aria={Locale.Settings.ShowPassword}
        aria-label={Locale.Settings.Access.AccessCode.Title}
        value={accessStore.accessCode}
        type="text"
        placeholder={Locale.Settings.Access.AccessCode.Placeholder}
        onChange={(e) => {
          accessStore.update(
            (access) => (access.accessCode = e.currentTarget.value),
          );
        }}
      />
    </SettingRow>
  );

  const saasStartComponent = (
    <div className={styles["subtitle-button"]}>
      <SettingRow
        id="model-saas-start"
        title={
          Locale.Settings.Access.SaasStart.Title +
          `${Locale.Settings.Access.SaasStart.Label}`
        }
        description={Locale.Settings.Access.SaasStart.SubTitle}
      >
        <IconButton
          aria={
            Locale.Settings.Access.SaasStart.Title +
            Locale.Settings.Access.SaasStart.ChatNow
          }
          icon={<FireIcon />}
          type={"primary"}
          text={Locale.Settings.Access.SaasStart.ChatNow}
          onClick={() => {
            trackSettingsPageGuideToCPaymentClick();
            window.location.href = SAAS_CHAT_URL;
          }}
        />
      </SettingRow>
    </div>
  );

  const useCustomConfigComponent = // Conditionally render the following row based on clientConfig.isApp
    !clientConfig?.isApp && ( // only show if isApp is false
      <SettingRow
        id="model-custom-endpoint"
        title={Locale.Settings.Access.CustomEndpoint.Title}
        description={Locale.Settings.Access.CustomEndpoint.SubTitle}
      >
        <SettingSwitch
          label={Locale.Settings.Access.CustomEndpoint.Title}
          checked={accessStore.useCustomConfig}
          onChange={(checked) =>
            accessStore.update((access) => (access.useCustomConfig = checked))
          }
        />
      </SettingRow>
    );

  return (
    <ErrorBoundary>
      <div className={styles["settings-page"]}>
        <div
          className={clsx("window-header", styles["settings-header"])}
          data-tauri-drag-region
        >
          <div className={styles["settings-header-brand"]}>
            <div className={styles["settings-header-icon"]} aria-hidden="true">
              <SettingsIcon />
            </div>
            <div className="window-header-title">
              <div className="window-header-main-title">
                {Locale.Settings.Title}
              </div>
              <div className="window-header-sub-title">
                {Locale.Settings.SubTitle}
              </div>
            </div>
          </div>
          <SettingsSearch
            entries={searchEntries}
            placeholder={Locale.Settings.Search.Placeholder}
            ariaLabel={Locale.Settings.Search.AriaLabel}
            closeLabel={Locale.Settings.Search.Close}
            noResultsLabel={Locale.Settings.Search.NoResults}
            suggestionsLabel={Locale.Settings.Search.Suggestions}
            groupLabel={(category, subpage) =>
              Locale.Settings.Search.GroupSections(
                categories.find((item) => item.id === category)?.Title ??
                  category,
                subpageLabels[subpage],
              )
            }
            onSelect={focusSetting}
          />
          <div className={styles["settings-close"]}>
            <IconButton
              aria={Locale.UI.Close}
              icon={<CloseIcon />}
              onClick={closeSettings}
              bordered
            />
          </div>
        </div>
        <div className={styles["settings"]}>
          <aside className={styles["settings-sidebar"]}>
            <nav
              className={styles["settings-nav"]}
              aria-label={Locale.Settings.Category.Navigation}
            >
              {categories.map((category) => (
                <button
                  type="button"
                  key={category.id}
                  className={
                    category.id === activeCategory
                      ? styles["settings-nav-item-active"]
                      : styles["settings-nav-item"]
                  }
                  aria-current={
                    category.id === activeCategory ? "page" : undefined
                  }
                  title={category.SubTitle}
                  onClick={() => selectCategory(category.id)}
                >
                  <span
                    className={styles["settings-nav-icon"]}
                    aria-hidden="true"
                  >
                    {category.icon}
                  </span>
                  <span className={styles["settings-nav-copy"]}>
                    <strong>{category.Title}</strong>
                    <small>{category.SubTitle}</small>
                  </span>
                </button>
              ))}
            </nav>
            <div className={styles["settings-sidebar-footer"]}>
              <span className={styles["settings-version-dot"]}></span>
              <span>
                {Locale.Settings.Update.Version(currentVersion ?? "unknown")}
              </span>
            </div>
          </aside>

          <main className={styles["settings-content"]}>
            <div className={styles["settings-mobile-category"]}>
              <label htmlFor="settings-category-select">
                {Locale.Settings.Category.Navigation}
              </label>
              <Select
                id="settings-category-select"
                value={activeCategory}
                onChange={(event) =>
                  selectCategory(event.currentTarget.value as SettingsCategory)
                }
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.Title}
                  </option>
                ))}
              </Select>
            </div>

            <header className={styles["settings-section-header"]}>
              <div
                className={styles["settings-section-icon"]}
                aria-hidden="true"
              >
                {activeCategoryMeta.icon}
              </div>
              <div>
                <h1>{activeCategoryMeta.Title}</h1>
                <p>{activeCategoryMeta.SubTitle}</p>
              </div>
            </header>
            {activeSubnavItems && (
              <div className={styles["settings-subnav-wrap"]}>
                <SettingsSubnav
                  ariaLabel={Locale.Settings.Subpage.Navigation(
                    activeCategoryMeta.Title,
                  )}
                  current={location.subpage}
                  items={activeSubnavItems}
                  onSelect={selectSubpage}
                />
              </div>
            )}
            {(activeCategory === "general" ||
              activeCategory === "appearance") && (
              <SettingSection title={activeCategoryMeta.Title}>
                {activeCategory === "general" && (
                  <>
                    <SettingRow
                      id="general-avatar"
                      title={Locale.Settings.Avatar}
                    >
                      {accountUser ? (
                        <button
                          type="button"
                          className={styles["account-avatar-trigger"]}
                          aria-label={Locale.Settings.Avatar}
                          title={Locale.Settings.Avatar}
                          onClick={() => navigate(Path.Profile)}
                        >
                          <AccountAvatar
                            avatar={accountUser.avatar}
                            name={accountName}
                            size={38}
                          />
                          <span
                            className={styles["account-avatar-hint"]}
                            aria-hidden="true"
                          >
                            ↗
                          </span>
                        </button>
                      ) : (
                        <Popover
                          onClose={() => setShowEmojiPicker(false)}
                          content={
                            <AvatarPicker
                              onEmojiClick={(avatar: string) => {
                                updateConfig(
                                  (config) => (config.avatar = avatar),
                                );
                                setShowEmojiPicker(false);
                              }}
                            />
                          }
                          open={showEmojiPicker}
                        >
                          <button
                            type="button"
                            aria-label={Locale.Settings.Avatar}
                            aria-haspopup="dialog"
                            aria-expanded={showEmojiPicker}
                            className={styles.avatar}
                            onClick={() => {
                              setShowEmojiPicker(!showEmojiPicker);
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                setShowEmojiPicker(!showEmojiPicker);
                              }
                            }}
                          >
                            <Avatar avatar={config.avatar} />
                            <span
                              className={styles["avatar-edit-badge"]}
                              aria-hidden="true"
                            >
                              ✦
                            </span>
                          </button>
                        </Popover>
                      )}
                    </SettingRow>

                    <SettingRow
                      id="general-update"
                      title={Locale.Settings.Update.Version(
                        currentVersion ?? "unknown",
                      )}
                      description={
                        checkingUpdate
                          ? Locale.Settings.Update.IsChecking
                          : hasNewVersion
                          ? Locale.Settings.Update.FoundUpdate(
                              remoteId ?? "ERROR",
                            )
                          : Locale.Settings.Update.IsLatest
                      }
                    >
                      {checkingUpdate ? (
                        <LoadingIcon />
                      ) : hasNewVersion ? (
                        clientConfig?.isApp ? (
                          <IconButton
                            className={styles["settings-action"]}
                            icon={<ResetIcon></ResetIcon>}
                            text={Locale.Settings.Update.GoToUpdate}
                            onClick={() => clientUpdate()}
                          />
                        ) : (
                          <Link
                            href={updateUrl}
                            target="_blank"
                            className="link"
                          >
                            {Locale.Settings.Update.GoToUpdate}
                          </Link>
                        )
                      ) : (
                        <IconButton
                          className={styles["settings-action"]}
                          icon={<ResetIcon></ResetIcon>}
                          text={Locale.Settings.Update.CheckUpdate}
                          onClick={() => checkUpdate(true)}
                        />
                      )}
                    </SettingRow>

                    <SettingRow
                      id="general-send-key"
                      title={Locale.Settings.SendKey}
                    >
                      <Select
                        aria-label={Locale.Settings.SendKey}
                        value={config.submitKey}
                        onChange={(e) => {
                          updateConfig(
                            (config) =>
                              (config.submitKey = e.target
                                .value as any as SubmitKey),
                          );
                        }}
                      >
                        {Object.values(SubmitKey).map((v) => (
                          <option value={v} key={v}>
                            {v}
                          </option>
                        ))}
                      </Select>
                    </SettingRow>
                  </>
                )}
                {activeCategory === "appearance" && (
                  <>
                    <SettingRow
                      id="appearance-theme"
                      title={Locale.Settings.Theme}
                    >
                      <Select
                        aria-label={Locale.Settings.Theme}
                        value={config.theme}
                        onChange={(e) => {
                          updateConfig(
                            (config) =>
                              (config.theme = e.target.value as any as Theme),
                          );
                        }}
                      >
                        {Object.values(Theme).map((v) => (
                          <option value={v} key={v}>
                            {v}
                          </option>
                        ))}
                      </Select>
                    </SettingRow>

                    <SettingRow
                      id="appearance-language"
                      title={Locale.Settings.Lang.Name}
                    >
                      <Select
                        aria-label={Locale.Settings.Lang.Name}
                        value={getLang()}
                        onChange={(e) => {
                          changeLang(e.target.value as any);
                        }}
                      >
                        {AllLangs.map((lang) => (
                          <option value={lang} key={lang}>
                            {ALL_LANG_OPTIONS[lang]}
                          </option>
                        ))}
                      </Select>
                    </SettingRow>

                    <SettingRow
                      id="appearance-font-size"
                      title={Locale.Settings.FontSize.Title}
                      description={Locale.Settings.FontSize.SubTitle}
                    >
                      <InputRange
                        aria={Locale.Settings.FontSize.Title}
                        title={`${
                          config.fontSize ?? DEFAULT_CONFIG.fontSize
                        }px`}
                        value={config.fontSize}
                        defaultValue={DEFAULT_CONFIG.fontSize}
                        min="12"
                        max="40"
                        step="1"
                        onReset={() =>
                          updateConfig(
                            (config) =>
                              (config.fontSize = DEFAULT_CONFIG.fontSize),
                          )
                        }
                        onChange={(e) =>
                          updateConfig(
                            (config) =>
                              (config.fontSize = Number.parseInt(
                                e.currentTarget.value,
                              )),
                          )
                        }
                      ></InputRange>
                    </SettingRow>

                    <SettingRow
                      id="appearance-font-family"
                      title={Locale.Settings.FontFamily.Title}
                      description={Locale.Settings.FontFamily.SubTitle}
                    >
                      <Input
                        as="input"
                        aria-label={Locale.Settings.FontFamily.Title}
                        type="text"
                        value={config.fontFamily}
                        placeholder={Locale.Settings.FontFamily.Placeholder}
                        onChange={(e) =>
                          updateConfig(
                            (config) =>
                              (config.fontFamily = e.currentTarget.value),
                          )
                        }
                      />
                    </SettingRow>
                  </>
                )}
                {activeCategory === "general" && (
                  <>
                    <SettingRow
                      id="general-auto-title"
                      title={Locale.Settings.AutoGenerateTitle.Title}
                      description={Locale.Settings.AutoGenerateTitle.SubTitle}
                    >
                      <SettingSwitch
                        label={Locale.Settings.AutoGenerateTitle.Title}
                        checked={config.enableAutoGenerateTitle}
                        onChange={(checked) =>
                          updateConfig(
                            (config) =>
                              (config.enableAutoGenerateTitle = checked),
                          )
                        }
                      />
                    </SettingRow>

                    <SettingRow
                      id="general-artifacts"
                      title={Locale.Mask.Config.Artifacts.Title}
                      description={Locale.Mask.Config.Artifacts.SubTitle}
                    >
                      <SettingSwitch
                        label={Locale.Mask.Config.Artifacts.Title}
                        checked={config.enableArtifacts}
                        onChange={(checked) =>
                          updateConfig(
                            (config) => (config.enableArtifacts = checked),
                          )
                        }
                      />
                    </SettingRow>
                    <SettingRow
                      id="general-code-fold"
                      title={Locale.Mask.Config.CodeFold.Title}
                      description={Locale.Mask.Config.CodeFold.SubTitle}
                    >
                      <span data-testid="enable-code-fold-checkbox">
                        <SettingSwitch
                          label={Locale.Mask.Config.CodeFold.Title}
                          checked={config.enableCodeFold}
                          onChange={(checked) =>
                            updateConfig(
                              (config) => (config.enableCodeFold = checked),
                            )
                          }
                        />
                      </span>
                    </SettingRow>
                  </>
                )}
              </SettingSection>
            )}

            {activeCategory === "data" && location.subpage === "data-sync" && (
              <SettingSection title={subpageLabels["data-sync"]}>
                <CloudSyncItems />
              </SettingSection>
            )}

            {activeCategory === "data" &&
              location.subpage === "data-transfer" && (
                <SettingSection title={subpageLabels["data-transfer"]}>
                  <LocalTransferItems />
                </SettingSection>
              )}

            {activeCategory === "assistants" && (
              <>
                <SettingSection title={Locale.Settings.Section.Assistants}>
                  <SettingRow
                    id="assistants-splash"
                    title={Locale.Settings.Mask.Splash.Title}
                    description={Locale.Settings.Mask.Splash.SubTitle}
                  >
                    <SettingSwitch
                      label={Locale.Settings.Mask.Splash.Title}
                      checked={!config.dontShowMaskSplashScreen}
                      onChange={(checked) =>
                        updateConfig(
                          (config) =>
                            (config.dontShowMaskSplashScreen = !checked),
                        )
                      }
                    />
                  </SettingRow>

                  <SettingRow
                    id="assistants-builtin"
                    title={Locale.Settings.Mask.Builtin.Title}
                    description={Locale.Settings.Mask.Builtin.SubTitle}
                  >
                    <SettingSwitch
                      label={Locale.Settings.Mask.Builtin.Title}
                      checked={config.hideBuiltinMasks}
                      onChange={(checked) =>
                        updateConfig(
                          (config) => (config.hideBuiltinMasks = checked),
                        )
                      }
                    />
                  </SettingRow>
                </SettingSection>

                <SettingSection title={Locale.Settings.Section.Prompts}>
                  <SettingRow
                    id="prompts-autocomplete"
                    title={Locale.Settings.Prompt.Disable.Title}
                    description={Locale.Settings.Prompt.Disable.SubTitle}
                  >
                    <SettingSwitch
                      label={Locale.Settings.Prompt.Disable.Title}
                      checked={config.disablePromptHint}
                      onChange={(checked) =>
                        updateConfig(
                          (config) => (config.disablePromptHint = checked),
                        )
                      }
                    />
                  </SettingRow>

                  <SettingRow
                    id="prompts-list"
                    title={Locale.Settings.Prompt.List}
                    description={Locale.Settings.Prompt.ListCount(
                      builtinCount,
                      customCount,
                    )}
                  >
                    <IconButton
                      aria={
                        Locale.Settings.Prompt.List +
                        Locale.Settings.Prompt.Edit
                      }
                      icon={<EditIcon />}
                      text={Locale.Settings.Prompt.Edit}
                      onClick={() => setShowPromptModal(true)}
                    />
                  </SettingRow>
                </SettingSection>
              </>
            )}

            {activeCategory === "model" &&
              location.subpage === "model-providers" && (
                <SettingSection title={Locale.Settings.Section.Provider}>
                  {saasStartComponent}
                  {accessCodeComponent}

                  {!accessStore.hideUserApiKey && (
                    <>
                      {useCustomConfigComponent}

                      {accessStore.useCustomConfig && (
                        <>
                          <SettingRow
                            id="model-provider"
                            title={Locale.Settings.Access.Provider.Title}
                            description={
                              Locale.Settings.Access.Provider.SubTitle
                            }
                          >
                            <Select
                              aria-label={Locale.Settings.Access.Provider.Title}
                              value={accessStore.provider}
                              onChange={(event) => {
                                const provider = event.currentTarget
                                  .value as ServiceProvider;
                                void requestProviderChange(provider);
                              }}
                            >
                              {Object.entries(ServiceProvider).map(([k, v]) => (
                                <option value={v} key={k}>
                                  {k}
                                </option>
                              ))}
                            </Select>
                          </SettingRow>
                          <ProviderConfigEditor
                            key={`${accessStore.provider}-${providerEditorRevision}`}
                            provider={accessStore.provider}
                            initialValues={providerInitialValues}
                            onSave={saveProviderCredentials}
                            onDirtyChange={setProviderDraftDirty}
                          />
                        </>
                      )}
                    </>
                  )}

                  {!shouldHideBalanceQuery && !clientConfig?.isApp ? (
                    <SettingRow
                      id="model-usage"
                      title={Locale.Settings.Usage.Title}
                      description={
                        showUsage
                          ? loadingUsage
                            ? Locale.Settings.Usage.IsChecking
                            : Locale.Settings.Usage.SubTitle(
                                usage?.used ?? "[?]",
                                usage?.subscription ?? "[?]",
                              )
                          : Locale.Settings.Usage.NoAccess
                      }
                    >
                      {!showUsage || loadingUsage ? (
                        <div />
                      ) : (
                        <IconButton
                          icon={<ResetIcon></ResetIcon>}
                          text={Locale.Settings.Usage.Check}
                          onClick={() => checkUsage(true)}
                        />
                      )}
                    </SettingRow>
                  ) : null}
                </SettingSection>
              )}

            {activeCategory === "model" &&
              location.subpage === "model-catalog" && (
                <SettingSection
                  id={SlotID.CustomModel}
                  title={subpageLabels["model-catalog"]}
                >
                  <ModelManager
                    customModels={config.customModels}
                    onChange={(customModels) =>
                      config.update(
                        (config) => (config.customModels = customModels),
                      )
                    }
                  />
                </SettingSection>
              )}

            {activeCategory === "model" &&
              location.subpage === "model-defaults" && (
                <SettingSection title={Locale.Settings.Section.DefaultModel}>
                  <ModelConfigList
                    modelConfig={config.modelConfig}
                    updateConfig={(updater) => {
                      const modelConfig = { ...config.modelConfig };
                      updater(modelConfig);
                      config.update(
                        (config) => (config.modelConfig = modelConfig),
                      );
                    }}
                  />
                </SettingSection>
              )}

            {shouldShowPromptModal && (
              <UserPromptModal onClose={() => setShowPromptModal(false)} />
            )}
            {activeCategory === "voice" &&
              location.subpage === "voice-realtime" && (
                <SettingSection title={Locale.Settings.Section.Realtime}>
                  <RealtimeConfigList
                    realtimeConfig={config.realtimeConfig}
                    updateConfig={(updater) => {
                      const realtimeConfig = { ...config.realtimeConfig };
                      updater(realtimeConfig);
                      config.update(
                        (config) => (config.realtimeConfig = realtimeConfig),
                      );
                    }}
                  />
                </SettingSection>
              )}

            {activeCategory === "voice" && location.subpage === "voice-tts" && (
              <SettingSection title={Locale.Settings.Section.TTS}>
                <TTSConfigList
                  ttsConfig={config.ttsConfig}
                  updateConfig={(updater) => {
                    const ttsConfig = { ...config.ttsConfig };
                    updater(ttsConfig);
                    config.update((config) => (config.ttsConfig = ttsConfig));
                  }}
                />
              </SettingSection>
            )}

            {activeCategory === "data" &&
              location.subpage === "data-danger" && (
                <SettingSection title={Locale.Settings.Section.Danger}>
                  <DangerItems />
                </SettingSection>
              )}
          </main>
        </div>
      </div>
    </ErrorBoundary>
  );
}
