import { useDebouncedCallback } from "use-debounce";
import React, {
  Fragment,
  RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Bot as MaskIcon,
  Command as PromptIcon,
  Copy as CopyIcon,
  Eraser as BreakIcon,
  History as BrainIcon,
  ImagePlus as ImageIcon,
  Keyboard as ShortcutkeyIcon,
  Pause as StopIcon,
  Pencil as EditIcon,
  Pin as PinIcon,
  Plus as AddIcon,
  RotateCcw as ResetIcon,
  Search as SearchIcon,
  SendHorizontal as SendIcon,
  Settings2 as SettingsIcon,
  Trash2 as DeleteIcon,
  Volume2 as SpeakIcon,
  VolumeX as SpeakStopIcon,
} from "lucide-react";
import DownIcon from "../icons/down.svg";
import RenameIcon from "../icons/edit.svg";
import ExportIcon from "../icons/export-arrow.svg";
import ReturnIcon from "../icons/return.svg";
import LoadingIcon from "../icons/three-dots.svg";
import LoadingButtonIcon from "../icons/loading.svg";
import ReloadIcon from "../icons/refresh.svg";
import ConfirmIcon from "../icons/confirm.svg";
import CloseIcon from "../icons/close.svg";
import CancelIcon from "../icons/cancel.svg";

import BottomIcon from "../icons/bottom.svg";
import SizeIcon from "../icons/size.svg";
import QualityIcon from "../icons/hd.svg";
import StyleIcon from "../icons/palette.svg";
import PluginIcon from "../icons/plugin.svg";
import McpToolIcon from "../icons/tool.svg";
import HeadphoneIcon from "../icons/headphone.svg";
import {
  BOT_HELLO,
  ChatMessage,
  createMessage,
  DEFAULT_TOPIC,
  ModelType,
  SubmitKey,
  useAccessStore,
  useAppConfig,
  useChatStore,
  usePluginStore,
} from "../store";

import {
  autoGrowTextArea,
  copyToClipboard,
  getMessageImages,
  getMessageTextContent,
  isDalle3,
  isVisionModel,
  safeLocalStorage,
  getModelSizes,
  supportsCustomSize,
  useMobileScreen,
  selectOrCopy,
  showPlugins,
} from "../utils";

import { uploadImage as uploadImageRemote } from "@/app/utils/chat";
import {
  getPastedImageFiles,
  mergeAttachmentUrls,
  shouldDisableComposerSend,
} from "@/app/utils/chat-composer";

import dynamic from "next/dynamic";

import { ChatControllerPool } from "../client/controller";
import { DalleQuality, DalleStyle, ModelSize } from "../typing";
import { Prompt, usePromptStore } from "../store/prompt";
import Locale from "../locales";

import { IconButton } from "./button";
import styles from "./chat.module.scss";

import {
  List,
  ListItem,
  Modal,
  Selector,
  showConfirm,
  showPrompt,
  showToast,
} from "./ui-lib";
import { useNavigate } from "react-router-dom";
import {
  CHAT_PAGE_SIZE,
  DEFAULT_TTS_ENGINE,
  ModelProvider,
  Path,
  REQUEST_TIMEOUT_MS,
  ServiceProvider,
  UNFINISHED_INPUT,
} from "../constant";
import { ContextPrompts, MaskAvatar, MaskConfig } from "./mask";
import { Mask, useMaskStore } from "../store/mask";
import { ChatCommandPrefix, useChatCommand, useCommand } from "../command";
import { prettyObject } from "../utils/format";
import { ExportMessageModal } from "./exporter";
import { useAllModels } from "../utils/hooks";
import { ClientApi, MultimodalContent } from "../client/api";
import { createTTSPlayer } from "../utils/audio";
import { MsEdgeTTS, OUTPUT_FORMAT } from "../utils/ms_edge_tts";

import { isEmpty } from "lodash-es";
import { filterModelsByProviders } from "../utils/model";
import { getModelVendor } from "../utils/model-vendor";
import { focusWithoutScroll } from "../utils/focus-without-scroll";
import { getComposerPopoverPlacement } from "../utils/popover";
import { RealtimeChat } from "@/app/components/realtime-chat";
import clsx from "clsx";
import { getAvailableClientsCount, isMcpEnabled } from "../mcp/actions";
import { FEATURED_ASSISTANTS } from "../data/featured-assistants";
import { ModelIcon } from "./emoji";
import { useAccount } from "./account-context";
import { runWithAccountLogin } from "./account-login-guard";
import { buildAuthPath } from "./account-utils";
import {
  resolveWorkspaceOwner,
  shouldShowModelPicker,
} from "../utils/account-workspace";
import { deriveTopicFromMessages } from "../utils/session-topic";
import {
  getAssistantMessageMetadata,
  getMessageModelDisplayName,
} from "../utils/message-metadata";

const localStorage = safeLocalStorage();

const ttsPlayer = createTTSPlayer();

const EMPTY_CHAT_SUGGESTIONS = [
  "帮我梳理一下今天的工作",
  "解释一个复杂问题",
  "帮我从零开始写一份方案",
];

const Markdown = dynamic(async () => (await import("./markdown")).Markdown, {
  loading: () => <LoadingIcon />,
});

export function SessionConfigModel(props: { onClose: () => void }) {
  const chatStore = useChatStore();
  const session = chatStore.currentSession();
  const maskStore = useMaskStore();
  const navigate = useNavigate();

  return (
    <div className="modal-mask">
      <Modal
        title={Locale.Context.Edit}
        onClose={() => props.onClose()}
        actions={[
          <IconButton
            key="reset"
            icon={<ResetIcon />}
            bordered
            text={Locale.Chat.Config.Reset}
            onClick={async () => {
              if (await showConfirm(Locale.Memory.ResetConfirm)) {
                chatStore.updateTargetSession(
                  session,
                  (session) => (session.memoryPrompt = ""),
                );
              }
            }}
          />,
          <IconButton
            key="copy"
            icon={<CopyIcon />}
            bordered
            text={Locale.Chat.Config.SaveAs}
            onClick={() => {
              navigate(Path.Masks);
              setTimeout(() => {
                maskStore.create(session.mask);
              }, 500);
            }}
          />,
        ]}
      >
        <MaskConfig
          mask={session.mask}
          updateMask={(updater) => {
            const mask = { ...session.mask };
            updater(mask);
            chatStore.updateTargetSession(
              session,
              (session) => (session.mask = mask),
            );
          }}
          shouldSyncFromGlobal
          extraListItems={
            session.mask.modelConfig.sendMemory ? (
              <ListItem
                className="copyable"
                title={`${Locale.Memory.Title} (${session.lastSummarizeIndex} of ${session.messages.length})`}
                subTitle={session.memoryPrompt || Locale.Memory.EmptyContent}
              ></ListItem>
            ) : (
              <></>
            )
          }
        ></MaskConfig>
      </Modal>
    </div>
  );
}

function PromptToast(props: {
  showToast?: boolean;
  showModal?: boolean;
  setShowModal: (_: boolean) => void;
}) {
  const chatStore = useChatStore();
  const session = chatStore.currentSession();
  const context = session.mask.context;

  return (
    <div className={styles["prompt-toast"]} key="prompt-toast">
      {props.showToast && context.length > 0 && (
        <div
          className={clsx(styles["prompt-toast-inner"], "clickable")}
          role="button"
          onClick={() => props.setShowModal(true)}
        >
          <BrainIcon />
          <span className={styles["prompt-toast-content"]}>
            {Locale.Context.Toast(context.length)}
          </span>
        </div>
      )}
      {props.showModal && (
        <SessionConfigModel onClose={() => props.setShowModal(false)} />
      )}
    </div>
  );
}

function useSubmitHandler() {
  const config = useAppConfig();
  const submitKey = config.submitKey;
  const isComposing = useRef(false);

  useEffect(() => {
    const onCompositionStart = () => {
      isComposing.current = true;
    };
    const onCompositionEnd = () => {
      isComposing.current = false;
    };

    window.addEventListener("compositionstart", onCompositionStart);
    window.addEventListener("compositionend", onCompositionEnd);

    return () => {
      window.removeEventListener("compositionstart", onCompositionStart);
      window.removeEventListener("compositionend", onCompositionEnd);
    };
  }, []);

  const shouldSubmit = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Fix Chinese input method "Enter" on Safari
    if (e.keyCode == 229) return false;
    if (e.key !== "Enter") return false;
    if (e.key === "Enter" && (e.nativeEvent.isComposing || isComposing.current))
      return false;
    return (
      (config.submitKey === SubmitKey.AltEnter && e.altKey) ||
      (config.submitKey === SubmitKey.CtrlEnter && e.ctrlKey) ||
      (config.submitKey === SubmitKey.ShiftEnter && e.shiftKey) ||
      (config.submitKey === SubmitKey.MetaEnter && e.metaKey) ||
      (config.submitKey === SubmitKey.Enter &&
        !e.altKey &&
        !e.ctrlKey &&
        !e.shiftKey &&
        !e.metaKey)
    );
  };

  return {
    submitKey,
    shouldSubmit,
  };
}

export type RenderPrompt = Pick<Prompt, "title" | "content">;

export function PromptHints(props: {
  prompts: RenderPrompt[];
  onPromptSelect: (prompt: RenderPrompt) => void;
}) {
  const noPrompts = props.prompts.length === 0;
  const [selectIndex, setSelectIndex] = useState(0);
  const selectedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelectIndex(0);
  }, [props.prompts.length]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (noPrompts || e.metaKey || e.altKey || e.ctrlKey) {
        return;
      }
      // arrow up / down to select prompt
      const changeIndex = (delta: number) => {
        e.stopPropagation();
        e.preventDefault();
        const nextIndex = Math.max(
          0,
          Math.min(props.prompts.length - 1, selectIndex + delta),
        );
        setSelectIndex(nextIndex);
        selectedRef.current?.scrollIntoView({
          block: "center",
        });
      };

      if (e.key === "ArrowUp") {
        changeIndex(1);
      } else if (e.key === "ArrowDown") {
        changeIndex(-1);
      } else if (e.key === "Enter") {
        const selectedPrompt = props.prompts.at(selectIndex);
        if (selectedPrompt) {
          props.onPromptSelect(selectedPrompt);
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.prompts.length, selectIndex]);

  if (noPrompts) return null;
  return (
    <div className={styles["prompt-hints"]}>
      {props.prompts.map((prompt, i) => (
        <div
          ref={i === selectIndex ? selectedRef : null}
          className={clsx(styles["prompt-hint"], {
            [styles["prompt-hint-selected"]]: i === selectIndex,
          })}
          key={prompt.title + i.toString()}
          onClick={() => props.onPromptSelect(prompt)}
          onMouseEnter={() => setSelectIndex(i)}
        >
          <div className={styles["hint-title"]}>{prompt.title}</div>
          <div className={styles["hint-content"]}>{prompt.content}</div>
        </div>
      ))}
    </div>
  );
}

function ClearContextDivider() {
  const chatStore = useChatStore();
  const session = chatStore.currentSession();

  return (
    <div
      className={styles["clear-context"]}
      onClick={() =>
        chatStore.updateTargetSession(
          session,
          (session) => (session.clearContextIndex = undefined),
        )
      }
    >
      <div className={styles["clear-context-tips"]}>{Locale.Context.Clear}</div>
      <div className={styles["clear-context-revert-btn"]}>
        {Locale.Context.Revert}
      </div>
    </div>
  );
}

export function ChatAction(props: {
  text: string;
  icon: JSX.Element;
  onClick: () => void;
  compact?: boolean;
  "data-action"?: string;
}) {
  const iconRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState({
    full: 16,
    icon: 16,
  });

  function updateWidth() {
    if (!iconRef.current || !textRef.current) return;
    const getWidth = (dom: HTMLDivElement) => dom.getBoundingClientRect().width;
    const textWidth = getWidth(textRef.current);
    const iconWidth = getWidth(iconRef.current);
    setWidth({
      full: textWidth + iconWidth,
      icon: iconWidth,
    });
  }

  if (props.compact) {
    return (
      <button
        type="button"
        className={styles["chat-message-action-button"]}
        aria-label={props.text}
        title={props.text}
        data-action={props["data-action"]}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          props.onClick();
        }}
      >
        <span className={styles["icon"]} aria-hidden="true">
          {props.icon}
        </span>
      </button>
    );
  }

  return (
    <div
      className={clsx(styles["chat-input-action"], "clickable")}
      onClick={() => {
        props.onClick();
        setTimeout(updateWidth, 1);
      }}
      onMouseEnter={updateWidth}
      onTouchStart={updateWidth}
      style={
        {
          "--icon-width": `${width.icon}px`,
          "--full-width": `${width.full}px`,
        } as React.CSSProperties
      }
    >
      <div ref={iconRef} className={styles["icon"]}>
        {props.icon}
      </div>
      <div className={styles["text"]} ref={textRef}>
        {props.text}
      </div>
    </div>
  );
}

function useScrollToBottom(
  scrollRef: RefObject<HTMLDivElement>,
  detach: boolean = false,
  messages: ChatMessage[],
) {
  // for auto-scroll
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollDomToBottom = useCallback(() => {
    const dom = scrollRef.current;
    if (dom) {
      requestAnimationFrame(() => {
        setAutoScroll(true);
        dom.scrollTo(0, dom.scrollHeight);
      });
    }
  }, [scrollRef]);

  // auto scroll
  useEffect(() => {
    if (autoScroll && !detach) {
      scrollDomToBottom();
    }
  });

  // auto scroll when messages length changes
  const lastMessagesLength = useRef(messages.length);
  useEffect(() => {
    if (messages.length > lastMessagesLength.current && !detach) {
      scrollDomToBottom();
    }
    lastMessagesLength.current = messages.length;
  }, [messages.length, detach, scrollDomToBottom]);

  return {
    scrollRef,
    autoScroll,
    setAutoScroll,
    scrollDomToBottom,
  };
}

function ComposerToolButton(props: {
  icon: JSX.Element;
  label: string;
  active?: boolean;
  className?: string;
  onClick: () => void;
  children?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={clsx(
        styles["composer-tool-button"],
        props.active && styles["composer-tool-button-active"],
        props.className,
      )}
      aria-label={props.label}
      title={props.label}
      onClick={props.onClick}
    >
      <span className={styles["composer-tool-icon"]}>{props.icon}</span>
      {props.children}
    </button>
  );
}

function ComposerMenuItem(props: {
  icon: JSX.Element;
  label: string;
  checked?: boolean;
  trailing?: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={styles["composer-menu-item"]}
      onClick={props.onClick}
    >
      <span className={styles["composer-menu-item-icon"]}>{props.icon}</span>
      <span className={styles["composer-menu-item-label"]}>{props.label}</span>
      {props.trailing ??
        (props.checked !== undefined && (
          <span
            className={clsx(
              styles["composer-switch"],
              props.checked && styles["composer-switch-on"],
            )}
            aria-hidden="true"
          >
            <span />
          </span>
        ))}
    </button>
  );
}
function TaskRunningStatus() {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const startedAt = Date.now();
    const timer = window.setInterval(
      () => setSeconds(Math.floor((Date.now() - startedAt) / 1000)),
      1000,
    );
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div
      className={styles["chat-message-status"]}
      role="status"
      aria-live="polite"
    >
      <span>任务正在处理中，你可以放心切换到其他页面</span>
      <small>{seconds}s</small>
    </div>
  );
}

export type ChatActionsProps = {
  uploadImage: () => void;
  setAttachImages: (images: string[]) => void;
  setUploading: (uploading: boolean) => void;
  showPromptModal: () => void;
  scrollToBottom: () => void;
  showPromptHints: () => void;
  hitBottom: boolean;
  uploading: boolean;
  setShowShortcutKeyModal: React.Dispatch<React.SetStateAction<boolean>>;
  setShowChatSidePanel: React.Dispatch<React.SetStateAction<boolean>>;
  mask?: Mask;
  onMaskChange?: (updater: (mask: Mask) => void) => void;
  homeMode?: boolean;
};

export function ChatActions(props: ChatActionsProps) {
  const { setAttachImages, setUploading, onMaskChange } = props;
  const config = useAppConfig();
  const navigate = useNavigate();
  const chatStore = useChatStore();
  const pluginStore = usePluginStore();
  const session = chatStore.currentSession();
  const mask = props.mask ?? session.mask;
  const updateMask = useCallback(
    (updater: (mask: Mask) => void) => {
      if (onMaskChange) {
        onMaskChange(updater);
        return;
      }
      chatStore.updateTargetSession(session, (target) => updater(target.mask));
    },
    [chatStore, onMaskChange, session],
  );
  const currentModel = mask.modelConfig.model;
  const currentProviderName =
    mask.modelConfig?.providerName || ServiceProvider.OpenAI;
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
  // Every provider with usable credentials contributes models, so users can
  // mix e.g. OpenAI and Anthropic models in one deployment. Falls back to the
  // single global provider switch when no credentials are configured locally.
  const configuredProviders = accessStore.useCustomConfig
    ? accessStore.configuredProviders()
    : [];
  const selectedProviders = useMemo(() => {
    if (!accessStore.useCustomConfig) return undefined;
    if (configuredProviders.length > 0) return configuredProviders;
    return [accessStore.provider];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    accessStore.useCustomConfig,
    accessStore.provider,
    configuredProviders.join(","),
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
  }, [models, currentModel, currentProviderName]);
  const currentModelName = currentModelInfo?.displayName || currentModel;

  const [showModelSelector, setShowModelSelector] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [modelSearch, setModelSearch] = useState("");
  const modelSelectorOpen = showModelPicker && showModelSelector;
  useEffect(() => {
    setShowModelSelector(false);
    setModelSearch("");
  }, [workspaceOwner]);
  const modelAnchorRef = useRef<HTMLDivElement>(null);
  const modelSearchRef = useRef<HTMLInputElement>(null);
  const [modelPopoverLayout, setModelPopoverLayout] = useState<
    ReturnType<typeof getComposerPopoverPlacement>
  >({ placement: "bottom", maxHeight: 360 });
  const [showPluginSelector, setShowPluginSelector] = useState(false);
  const [showUploadImage, setShowUploadImage] = useState(false);
  const [showSizeSelector, setShowSizeSelector] = useState(false);
  const [showQualitySelector, setShowQualitySelector] = useState(false);
  const [showStyleSelector, setShowStyleSelector] = useState(false);
  const [mcpState, setMcpState] = useState({ enabled: false, count: 0 });
  const isMobileScreen = useMobileScreen();
  const plugins = pluginStore.getAll();
  const selectedPluginCount = mask.plugin?.length ?? 0;
  const modelSizes = getModelSizes(currentModel);
  const currentSize = mask.modelConfig?.size ?? ("1024x1024" as ModelSize);
  const currentQuality = mask.modelConfig?.quality ?? "standard";
  const currentStyle = mask.modelConfig?.style ?? "vivid";
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
  const getVendorGroupLabel = (vendorName: string) => {
    return `模型厂商 · ${vendorName}`;
  };

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
    const canUpload = isVisionModel(currentModel);
    setShowUploadImage(canUpload);
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
    let alive = true;
    (async () => {
      const enabled = await isMcpEnabled();
      const count = enabled ? await getAvailableClientsCount() : 0;
      if (alive) setMcpState({ enabled, count });
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!showModelSelector || !props.homeMode) return;

    // The opening click measures the anchor before the popover is mounted.
    // Measuring again in this effect can replace the placement after the
    // first paint (especially when autoFocus scrolls the page), which makes
    // the popover visibly jump. Only viewport resizes need a re-measure here.
    const viewport = window.visualViewport;
    window.addEventListener("resize", updateModelPopoverLayout);
    viewport?.addEventListener("resize", updateModelPopoverLayout);
    return () => {
      window.removeEventListener("resize", updateModelPopoverLayout);
      viewport?.removeEventListener("resize", updateModelPopoverLayout);
    };
  }, [props.homeMode, showModelSelector, updateModelPopoverLayout]);

  useEffect(() => {
    if (!showModelSelector) return;
    focusWithoutScroll(modelSearchRef.current);
  }, [showModelSelector]);

  const closePopovers = () => {
    setShowModelSelector(false);
    setShowMoreMenu(false);
  };
  const selectModel = (model: (typeof models)[number]) => {
    updateMask((mask) => {
      mask.modelConfig.model = model.name as ModelType;
      mask.modelConfig.providerName = model.provider
        ?.providerName as ServiceProvider;
      mask.syncGlobalConfig = false;
    });
    showToast(model.displayName || model.name);
    setShowModelSelector(false);
    setModelSearch("");
  };
  const toggleMemory = () => {
    updateMask((mask) => {
      mask.modelConfig.sendMemory = !mask.modelConfig.sendMemory;
      mask.syncGlobalConfig = false;
    });
  };
  const clearContext = () => {
    chatStore.updateTargetSession(session, (target) => {
      if (target.clearContextIndex === target.messages.length) {
        target.clearContextIndex = undefined;
      } else {
        target.clearContextIndex = target.messages.length;
        target.memoryPrompt = "";
      }
    });
    setShowMoreMenu(false);
  };
  const openPluginSelector = () => {
    setShowMoreMenu(false);
    plugins.length === 0 ? navigate(Path.Plugins) : setShowPluginSelector(true);
  };

  // TODO(lobe-composer): Add general file attachments, native web search,
  // Agent Gateway, device targeting and approval modes only after their
  // runtimes exist. Non-functional placeholder controls stay hidden.
  return (
    <div className={styles["chat-input-actions"]}>
      {(modelSelectorOpen || showMoreMenu) && (
        <div
          className={styles["composer-popover-backdrop"]}
          onClick={closePopovers}
        />
      )}
      <div className={styles["composer-actions-start"]}>
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
              />
            }
            label={currentModelName}
            active={modelSelectorOpen}
            className={styles["composer-model-button"]}
            onClick={() => {
              setShowMoreMenu(false);
              if (!showModelSelector) updateModelPopoverLayout();
              setShowModelSelector(!showModelSelector);
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
                  onChange={(event) =>
                    setModelSearch(event.currentTarget.value)
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Escape") closePopovers();
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
                      <span>{getVendorGroupLabel(vendorName)}</span>
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

        <div className={styles["composer-anchor"]}>
          <ComposerToolButton
            icon={<AddIcon />}
            label={Locale.ChatItem.MoreActions}
            active={showMoreMenu}
            onClick={() => {
              setShowModelSelector(false);
              setShowMoreMenu((show) => !show);
            }}
          />
          {showMoreMenu && (
            <div className={styles["composer-more-menu"]}>
              {showUploadImage && (
                <ComposerMenuItem
                  icon={props.uploading ? <LoadingButtonIcon /> : <ImageIcon />}
                  label={Locale.Chat.InputActions.UploadImage}
                  onClick={() => {
                    setShowMoreMenu(false);
                    props.uploadImage();
                  }}
                />
              )}
              <ComposerMenuItem
                icon={<BrainIcon />}
                label={Locale.Memory.Title}
                checked={mask.modelConfig.sendMemory}
                onClick={toggleMemory}
              />
              {!props.homeMode && (
                <ComposerMenuItem
                  icon={<PromptIcon />}
                  label={Locale.Chat.InputActions.Prompt}
                  onClick={() => {
                    setShowMoreMenu(false);
                    props.showPromptHints();
                  }}
                />
              )}
              <ComposerMenuItem
                icon={<MaskIcon />}
                label={Locale.Chat.InputActions.Masks}
                onClick={() => navigate(Path.Masks)}
              />
              {showPlugins(currentProviderName, currentModel) && (
                <ComposerMenuItem
                  icon={<PluginIcon />}
                  label={Locale.Plugin.Name}
                  trailing={
                    selectedPluginCount > 0 ? (
                      <span className={styles["composer-menu-count"]}>
                        {selectedPluginCount}
                      </span>
                    ) : undefined
                  }
                  onClick={openPluginSelector}
                />
              )}
              {mcpState.enabled && (
                <ComposerMenuItem
                  icon={<McpToolIcon />}
                  label={`MCP${mcpState.count ? ` (${mcpState.count})` : ""}`}
                  onClick={() => navigate(Path.McpMarket)}
                />
              )}
              {(supportsCustomSize(currentModel) || isDalle3(currentModel)) && (
                <div className={styles["composer-menu-divider"]} />
              )}
              {supportsCustomSize(currentModel) && (
                <ComposerMenuItem
                  icon={<SizeIcon />}
                  label={currentSize}
                  onClick={() => {
                    setShowMoreMenu(false);
                    setShowSizeSelector(true);
                  }}
                />
              )}
              {isDalle3(currentModel) && (
                <>
                  <ComposerMenuItem
                    icon={<QualityIcon />}
                    label={currentQuality}
                    onClick={() => {
                      setShowMoreMenu(false);
                      setShowQualitySelector(true);
                    }}
                  />
                  <ComposerMenuItem
                    icon={<StyleIcon />}
                    label={currentStyle}
                    onClick={() => {
                      setShowMoreMenu(false);
                      setShowStyleSelector(true);
                    }}
                  />
                </>
              )}
              {!props.homeMode && (
                <>
                  <div className={styles["composer-menu-divider"]} />
                  <ComposerMenuItem
                    icon={<SettingsIcon />}
                    label={Locale.Chat.InputActions.Settings}
                    onClick={() => {
                      setShowMoreMenu(false);
                      props.showPromptModal();
                    }}
                  />
                  <ComposerMenuItem
                    icon={<BreakIcon />}
                    label={Locale.Chat.InputActions.Clear}
                    onClick={clearContext}
                  />
                  {!isMobileScreen && (
                    <ComposerMenuItem
                      icon={<ShortcutkeyIcon />}
                      label={Locale.Chat.ShortcutKey.Title}
                      onClick={() => {
                        setShowMoreMenu(false);
                        props.setShowShortcutKeyModal(true);
                      }}
                    />
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {!props.homeMode && (
        <div className={styles["composer-actions-end"]}>
          {!props.hitBottom && (
            <ComposerToolButton
              icon={<BottomIcon />}
              label={Locale.Chat.InputActions.ToBottom}
              onClick={props.scrollToBottom}
            />
          )}
          {config.realtimeConfig.enable && (
            <ComposerToolButton
              icon={<HeadphoneIcon />}
              label="Realtime Chat"
              onClick={() => props.setShowChatSidePanel(true)}
            />
          )}
        </div>
      )}

      {showSizeSelector && (
        <Selector
          defaultSelectedValue={currentSize}
          items={modelSizes.map((size) => ({ title: size, value: size }))}
          onClose={() => setShowSizeSelector(false)}
          onSelection={(selection) => {
            if (selection.length === 0) return;
            const size = selection[0];
            updateMask((mask) => {
              mask.modelConfig.size = size;
            });
            showToast(size);
          }}
        />
      )}
      {showQualitySelector && (
        <Selector
          defaultSelectedValue={currentQuality}
          items={["standard", "hd"].map((quality) => ({
            title: quality,
            value: quality as DalleQuality,
          }))}
          onClose={() => setShowQualitySelector(false)}
          onSelection={(selection) => {
            if (selection.length === 0) return;
            const quality = selection[0];
            updateMask((mask) => {
              mask.modelConfig.quality = quality;
            });
            showToast(quality);
          }}
        />
      )}
      {showStyleSelector && (
        <Selector
          defaultSelectedValue={currentStyle}
          items={["vivid", "natural"].map((style) => ({
            title: style,
            value: style as DalleStyle,
          }))}
          onClose={() => setShowStyleSelector(false)}
          onSelection={(selection) => {
            if (selection.length === 0) return;
            const style = selection[0];
            updateMask((mask) => {
              mask.modelConfig.style = style;
            });
            showToast(style);
          }}
        />
      )}
      {showPluginSelector && (
        <Selector
          multiple
          defaultSelectedValue={mask.plugin}
          items={plugins.map((plugin) => ({
            title: `${plugin.title}@${plugin.version}`,
            value: plugin.id,
          }))}
          onClose={() => setShowPluginSelector(false)}
          onSelection={(selection) => {
            updateMask((mask) => {
              mask.plugin = selection as string[];
            });
          }}
        />
      )}
    </div>
  );
}
export function EditMessageModal(props: { onClose: () => void }) {
  const chatStore = useChatStore();
  const session = chatStore.currentSession();
  const [messages, setMessages] = useState(session.messages.slice());

  return (
    <div className="modal-mask">
      <Modal
        title={Locale.Chat.EditMessage.Title}
        onClose={props.onClose}
        actions={[
          <IconButton
            text={Locale.UI.Cancel}
            icon={<CancelIcon />}
            key="cancel"
            onClick={() => {
              props.onClose();
            }}
          />,
          <IconButton
            type="primary"
            text={Locale.UI.Confirm}
            icon={<ConfirmIcon />}
            key="ok"
            onClick={() => {
              chatStore.updateTargetSession(
                session,
                (session) => (session.messages = messages),
              );
              props.onClose();
            }}
          />,
        ]}
      >
        <List>
          <ListItem
            title={Locale.Chat.EditMessage.Topic.Title}
            subTitle={Locale.Chat.EditMessage.Topic.SubTitle}
          >
            <input
              type="text"
              value={session.topic}
              onInput={(e) =>
                chatStore.updateTargetSession(session, (session) => {
                  session.topic = e.currentTarget.value;
                  session.topicManuallyEdited = true;
                })
              }
            ></input>
          </ListItem>
        </List>
        <ContextPrompts
          context={messages}
          updateContext={(updater) => {
            const newMessages = messages.slice();
            updater(newMessages);
            setMessages(newMessages);
          }}
        />
      </Modal>
    </div>
  );
}

export function DeleteImageButton(props: { deleteImage: () => void }) {
  return (
    <div className={styles["delete-image"]} onClick={props.deleteImage}>
      <DeleteIcon />
    </div>
  );
}

type ChatComposerActionProps = Pick<
  ChatActionsProps,
  | "showPromptModal"
  | "scrollToBottom"
  | "showPromptHints"
  | "hitBottom"
  | "setShowShortcutKeyModal"
  | "setShowChatSidePanel"
>;

export type ChatComposerProps = ChatComposerActionProps & {
  value: string;
  onInput: (value: string) => void;
  onSubmit: () => void;
  placeholder: string;
  attachImages: string[];
  setAttachImages: React.Dispatch<React.SetStateAction<string[]>>;
  uploading: boolean;
  setUploading: React.Dispatch<React.SetStateAction<boolean>>;
  mask: Mask;
  onMaskChange?: (updater: (mask: Mask) => void) => void;
  homeMode?: boolean;
  inputRef?: React.RefObject<HTMLTextAreaElement>;
  inputId?: string;
  onKeyDown?: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onFocus?: () => void;
  onClick?: () => void;
  rows?: number;
  autoFocus?: boolean;
  inputStyle?: React.CSSProperties;
  sendIcon?: JSX.Element;
  sendLabel?: string;
  sendDisabled?: boolean;
  onSend?: () => void;
};

export function ChatComposer(props: ChatComposerProps) {
  const { attachImages, mask, setAttachImages, setUploading } = props;
  const uploadFiles = useCallback(
    async (files: File[]) => {
      const availableSlots = Math.max(0, 3 - attachImages.length);
      const selectedFiles = files.slice(0, availableSlots);
      if (selectedFiles.length === 0) return;

      setUploading(true);
      try {
        const uploaded = await Promise.all(
          selectedFiles.map((file) => uploadImageRemote(file)),
        );
        setAttachImages((current) => mergeAttachmentUrls(current, uploaded));
      } finally {
        setUploading(false);
      }
    },
    [attachImages.length, setAttachImages, setUploading],
  );

  const handlePaste = useCallback(
    (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
      if (!isVisionModel(mask.modelConfig.model)) return;

      const files = getPastedImageFiles(Array.from(event.clipboardData.items));
      if (files.length === 0) return;

      event.preventDefault();
      void uploadFiles(files);
    },
    [mask.modelConfig.model, uploadFiles],
  );

  const chooseImages = useCallback(() => {
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept =
      "image/png, image/jpeg, image/webp, image/heic, image/heif";
    fileInput.multiple = true;
    fileInput.onchange = () => {
      if (fileInput.files) {
        void uploadFiles(Array.from(fileInput.files));
      }
    };
    fileInput.click();
  }, [uploadFiles]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (props.onKeyDown) {
      props.onKeyDown(event);
      return;
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      props.onSubmit();
    }
  };

  return (
    <div
      className={clsx(styles["chat-input-panel-inner"], {
        [styles["chat-input-panel-inner-attach"]]:
          props.attachImages.length !== 0,
      })}
    >
      <textarea
        id={props.inputId}
        ref={props.inputRef}
        className={styles["chat-input"]}
        placeholder={props.placeholder}
        onInput={(event) => props.onInput(event.currentTarget.value)}
        value={props.value}
        onKeyDown={handleKeyDown}
        onFocus={props.onFocus}
        onClick={props.onClick}
        onPaste={handlePaste}
        rows={props.rows ?? 4}
        autoFocus={props.autoFocus}
        style={props.inputStyle}
      />
      {props.attachImages.length !== 0 && (
        <div className={styles["attach-images"]}>
          {props.attachImages.map((image, index) => (
            <div
              key={`${image.slice(-32)}-${index}`}
              className={styles["attach-image"]}
              style={{ backgroundImage: `url("${image}")` }}
            >
              <div className={styles["attach-image-mask"]}>
                <DeleteImageButton
                  deleteImage={() =>
                    props.setAttachImages((images) =>
                      images.filter((_, imageIndex) => imageIndex !== index),
                    )
                  }
                />
              </div>
            </div>
          ))}
        </div>
      )}
      <div className={styles["composer-footer"]}>
        <ChatActions
          uploadImage={chooseImages}
          setAttachImages={props.setAttachImages}
          setUploading={props.setUploading}
          showPromptModal={props.showPromptModal}
          scrollToBottom={props.scrollToBottom}
          showPromptHints={props.showPromptHints}
          hitBottom={props.hitBottom}
          uploading={props.uploading}
          setShowShortcutKeyModal={props.setShowShortcutKeyModal}
          setShowChatSidePanel={props.setShowChatSidePanel}
          mask={props.mask}
          onMaskChange={props.onMaskChange}
          homeMode={props.homeMode}
        />
        <IconButton
          icon={props.sendIcon ?? <SendIcon />}
          aria={props.sendLabel ?? Locale.Chat.Send}
          title={props.sendLabel ?? Locale.Chat.Send}
          className={styles["chat-input-send"]}
          disabled={shouldDisableComposerSend(
            props.uploading,
            props.sendDisabled,
          )}
          onClick={props.onSend ?? props.onSubmit}
        />
      </div>
    </div>
  );
}

export function ShortcutKeyModal(props: { onClose: () => void }) {
  const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
  const shortcuts = [
    {
      title: Locale.Chat.ShortcutKey.newChat,
      keys: isMac ? ["⌘", "Shift", "O"] : ["Ctrl", "Shift", "O"],
    },
    { title: Locale.Chat.ShortcutKey.focusInput, keys: ["Shift", "Esc"] },
    {
      title: Locale.Chat.ShortcutKey.copyLastCode,
      keys: isMac ? ["⌘", "Shift", ";"] : ["Ctrl", "Shift", ";"],
    },
    {
      title: Locale.Chat.ShortcutKey.copyLastMessage,
      keys: isMac ? ["⌘", "Shift", "C"] : ["Ctrl", "Shift", "C"],
    },
    {
      title: Locale.Chat.ShortcutKey.showShortcutKey,
      keys: isMac ? ["⌘", "/"] : ["Ctrl", "/"],
    },
    {
      title: Locale.Chat.ShortcutKey.clearContext,
      keys: isMac
        ? ["⌘", "Shift", "backspace"]
        : ["Ctrl", "Shift", "backspace"],
    },
  ];
  return (
    <div className="modal-mask">
      <Modal
        title={Locale.Chat.ShortcutKey.Title}
        onClose={props.onClose}
        actions={[
          <IconButton
            type="primary"
            text={Locale.UI.Confirm}
            icon={<ConfirmIcon />}
            key="ok"
            onClick={() => {
              props.onClose();
            }}
          />,
        ]}
      >
        <div className={styles["shortcut-key-container"]}>
          <div className={styles["shortcut-key-grid"]}>
            {shortcuts.map((shortcut, index) => (
              <div key={index} className={styles["shortcut-key-item"]}>
                <div className={styles["shortcut-key-title"]}>
                  {shortcut.title}
                </div>
                <div className={styles["shortcut-key-keys"]}>
                  {shortcut.keys.map((key, i) => (
                    <div key={i} className={styles["shortcut-key"]}>
                      <span>{key}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
}

type ChatProps = {
  onOpenChatList?: () => void;
};

function _Chat(props: ChatProps) {
  type RenderMessage = ChatMessage & { preview?: boolean };

  const chatStore = useChatStore();
  const session = chatStore.currentSession();
  const displayTopic =
    !session.topicManuallyEdited &&
    (session.topic === DEFAULT_TOPIC || session.topic === session.mask.name)
      ? deriveTopicFromMessages(
          session.messages,
          session.topic || DEFAULT_TOPIC,
        )
      : session.topic || DEFAULT_TOPIC;
  const config = useAppConfig();
  const allModels = useAllModels();
  const fontSize = config.fontSize;
  const fontFamily = config.fontFamily;

  const [showExport, setShowExport] = useState(false);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [userInput, setUserInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { submitKey, shouldSubmit } = useSubmitHandler();
  const scrollRef = useRef<HTMLDivElement>(null);
  const isScrolledToBottom = scrollRef?.current
    ? Math.abs(
        scrollRef.current.scrollHeight -
          (scrollRef.current.scrollTop + scrollRef.current.clientHeight),
      ) <= 1
    : false;
  const isAttachWithTop = useMemo(() => {
    const lastMessage = scrollRef.current?.lastElementChild as HTMLElement;
    // if scrolllRef is not ready or no message, return false
    if (!scrollRef?.current || !lastMessage) return false;
    const topDistance =
      lastMessage!.getBoundingClientRect().top -
      scrollRef.current.getBoundingClientRect().top;
    // leave some space for user question
    return topDistance < 100;
  }, [scrollRef?.current?.scrollHeight]);

  const isTyping = userInput !== "";

  // if user is typing, should auto scroll to bottom
  // if user is not typing, should auto scroll to bottom only if already at bottom
  const { setAutoScroll, scrollDomToBottom } = useScrollToBottom(
    scrollRef,
    (isScrolledToBottom || isAttachWithTop) && !isTyping,
    session.messages,
  );
  const [hitBottom, setHitBottom] = useState(true);
  const isMobileScreen = useMobileScreen();
  const navigate = useNavigate();
  const {
    enabled: accountEnabled,
    loading: accountLoading,
    refresh: refreshAccount,
    user: accountUser,
  } = useAccount();
  const [attachImages, setAttachImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  const runAccountAction = useCallback(
    async (action: () => Promise<void> | void) => {
      const snapshot = accountLoading
        ? await refreshAccount()
        : { enabled: accountEnabled, user: accountUser };
      await runWithAccountLogin(
        snapshot,
        async () => {
          const shouldLogin =
            await showConfirm("登录后才能开始对话，是否前往登录页？");
          if (shouldLogin) {
            navigate(buildAuthPath(Path.Chat));
          }
        },
        action,
      );
    },
    [accountEnabled, accountLoading, accountUser, navigate, refreshAccount],
  );

  // prompt hints
  const promptStore = usePromptStore();
  const [promptHints, setPromptHints] = useState<RenderPrompt[]>([]);
  const onSearch = useDebouncedCallback(
    (text: string) => {
      const matchedPrompts = promptStore.search(text);
      setPromptHints(matchedPrompts);
    },
    100,
    { leading: true, trailing: true },
  );

  // auto grow input
  const [inputRows, setInputRows] = useState(2);
  const measure = useDebouncedCallback(
    () => {
      const rows = inputRef.current ? autoGrowTextArea(inputRef.current) : 1;
      const inputRows = Math.min(
        20,
        Math.max(2 + Number(!isMobileScreen), rows),
      );
      setInputRows(inputRows);
    },
    100,
    {
      leading: true,
      trailing: true,
    },
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(measure, [userInput]);

  // chat commands shortcuts
  const chatCommands = useChatCommand({
    new: () => chatStore.newSession(),
    newm: () => navigate(Path.NewChat),
    prev: () => chatStore.nextSession(-1),
    next: () => chatStore.nextSession(1),
    clear: () =>
      chatStore.updateTargetSession(
        session,
        (session) => (session.clearContextIndex = session.messages.length),
      ),
    fork: () => chatStore.forkSession(),
    del: () => chatStore.deleteSession(chatStore.currentSessionIndex),
  });

  // only search prompts when user input is short
  const SEARCH_TEXT_LIMIT = 30;
  const onInput = (text: string) => {
    setUserInput(text);
    const n = text.trim().length;

    // clear search results
    if (n === 0) {
      setPromptHints([]);
    } else if (text.match(ChatCommandPrefix)) {
      setPromptHints(chatCommands.search(text));
    } else if (!config.disablePromptHint && n < SEARCH_TEXT_LIMIT) {
      // check if need to trigger auto completion
      if (text.startsWith("/")) {
        let searchText = text.slice(1);
        onSearch(searchText);
      }
    }
  };

  const doSubmit = (userInput: string) => {
    if (userInput.trim() === "" && isEmpty(attachImages)) return;
    const matchCommand = chatCommands.match(userInput);
    if (matchCommand.matched) {
      setUserInput("");
      setPromptHints([]);
      matchCommand.invoke();
      return;
    }
    void runAccountAction(() => {
      setIsLoading(true);
      chatStore
        .onUserInput(userInput, attachImages)
        .then(() => setIsLoading(false));
      setAttachImages([]);
      chatStore.setLastInput(userInput);
      setUserInput("");
      setPromptHints([]);
      if (!isMobileScreen) inputRef.current?.focus();
      setAutoScroll(true);
    });
  };

  const onPromptSelect = (prompt: RenderPrompt) => {
    setTimeout(() => {
      setPromptHints([]);

      const matchedChatCommand = chatCommands.match(prompt.content);
      if (matchedChatCommand.matched) {
        // if user is selecting a chat command, just trigger it
        matchedChatCommand.invoke();
        setUserInput("");
      } else {
        // or fill the prompt
        setUserInput(prompt.content);
      }
      inputRef.current?.focus();
    }, 30);
  };

  // stop response
  const onUserStop = (messageId: string) => {
    ChatControllerPool.stop(session.id, messageId);
  };

  useEffect(() => {
    chatStore.updateTargetSession(session, (session) => {
      const stopTiming = Date.now() - REQUEST_TIMEOUT_MS;
      session.messages.forEach((m) => {
        // check if should stop all stale messages
        if (m.isError || new Date(m.date).getTime() < stopTiming) {
          if (m.streaming) {
            m.streaming = false;
          }

          if (m.content.length === 0) {
            m.isError = true;
            m.content = prettyObject({
              error: true,
              message: "empty response",
            });
          }
        }
      });

      // auto sync mask config from global config
      if (session.mask.syncGlobalConfig) {
        console.log("[Mask] syncing from global, name = ", session.mask.name);
        session.mask.modelConfig = { ...config.modelConfig };
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  // check if should send message
  const onInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // if ArrowUp and no userInput, fill with last input
    if (
      e.key === "ArrowUp" &&
      userInput.length <= 0 &&
      !(e.metaKey || e.altKey || e.ctrlKey)
    ) {
      setUserInput(chatStore.lastInput ?? "");
      e.preventDefault();
      return;
    }
    if (shouldSubmit(e) && promptHints.length === 0) {
      doSubmit(userInput);
      e.preventDefault();
    }
  };
  const onRightClick = (e: any, message: ChatMessage) => {
    // copy to clipboard
    if (selectOrCopy(e.currentTarget, getMessageTextContent(message))) {
      if (userInput.length === 0) {
        setUserInput(getMessageTextContent(message));
      }

      e.preventDefault();
    }
  };

  const deleteMessage = (msgId?: string) => {
    chatStore.updateTargetSession(
      session,
      (session) =>
        (session.messages = session.messages.filter((m) => m.id !== msgId)),
    );
  };

  const onDelete = (msgId: string) => {
    deleteMessage(msgId);
  };

  const onResend = (message: ChatMessage) => {
    // when it is resending a message
    // 1. for a user's message, find the next bot response
    // 2. for a bot's message, find the last user's input
    // 3. delete original user input and bot's message
    // 4. resend the user's input

    const resendingIndex = session.messages.findIndex(
      (m) => m.id === message.id,
    );

    if (resendingIndex < 0 || resendingIndex >= session.messages.length) {
      console.error("[Chat] failed to find resending message", message);
      return;
    }

    let userMessage: ChatMessage | undefined;
    let botMessage: ChatMessage | undefined;

    if (message.role === "assistant") {
      // if it is resending a bot's message, find the user input for it
      botMessage = message;
      for (let i = resendingIndex; i >= 0; i -= 1) {
        if (session.messages[i].role === "user") {
          userMessage = session.messages[i];
          break;
        }
      }
    } else if (message.role === "user") {
      // if it is resending a user's input, find the bot's response
      userMessage = message;
      for (let i = resendingIndex; i < session.messages.length; i += 1) {
        if (session.messages[i].role === "assistant") {
          botMessage = session.messages[i];
          break;
        }
      }
    }

    if (userMessage === undefined) {
      console.error("[Chat] failed to resend", message);
      return;
    }
    const resendUserMessage = userMessage;

    void runAccountAction(() => {
      // delete the original messages only after the account check passes
      deleteMessage(resendUserMessage.id);
      deleteMessage(botMessage?.id);

      // resend the message
      setIsLoading(true);
      const textContent = getMessageTextContent(resendUserMessage);
      const images = getMessageImages(resendUserMessage);
      chatStore
        .onUserInput(textContent, images)
        .then(() => setIsLoading(false));
      inputRef.current?.focus();
    });
  };

  const onPinMessage = (message: ChatMessage) => {
    chatStore.updateTargetSession(session, (session) =>
      session.mask.context.push(message),
    );

    showToast(Locale.Chat.Actions.PinToastContent, {
      text: Locale.Chat.Actions.PinToastAction,
      onClick: () => {
        setShowPromptModal(true);
      },
    });
  };

  const onEditMessage = async (message: ChatMessage) => {
    const newMessage = await showPrompt(
      Locale.Chat.Actions.Edit,
      getMessageTextContent(message),
      10,
    );
    let newContent: string | MultimodalContent[] = newMessage;
    const images = getMessageImages(message);
    if (images.length > 0) {
      newContent = [{ type: "text", text: newMessage }];
      images.forEach((image) => {
        (newContent as MultimodalContent[]).push({
          type: "image_url",
          image_url: { url: image },
        });
      });
    }

    chatStore.updateTargetSession(session, (targetSession) => {
      const targetMessage = targetSession.mask.context
        .concat(targetSession.messages)
        .find((item) => item.id === message.id);
      if (targetMessage) targetMessage.content = newContent;
    });
  };

  const accessStore = useAccessStore();
  const [speechStatus, setSpeechStatus] = useState(false);
  const [speechLoading, setSpeechLoading] = useState(false);

  async function openaiSpeech(text: string) {
    if (speechStatus) {
      ttsPlayer.stop();
      setSpeechStatus(false);
    } else {
      var api: ClientApi;
      api = new ClientApi(ModelProvider.GPT);
      const config = useAppConfig.getState();
      setSpeechLoading(true);
      ttsPlayer.init();
      let audioBuffer: ArrayBuffer;
      const { markdownToTxt } = require("markdown-to-txt");
      const textContent = markdownToTxt(text);
      if (config.ttsConfig.engine !== DEFAULT_TTS_ENGINE) {
        const edgeVoiceName = accessStore.edgeVoiceName();
        const tts = new MsEdgeTTS();
        await tts.setMetadata(
          edgeVoiceName,
          OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3,
        );
        audioBuffer = await tts.toArrayBuffer(textContent);
      } else {
        audioBuffer = await api.llm.speech({
          model: config.ttsConfig.model,
          input: textContent,
          voice: config.ttsConfig.voice,
          speed: config.ttsConfig.speed,
        });
      }
      setSpeechStatus(true);
      ttsPlayer
        .play(audioBuffer, () => {
          setSpeechStatus(false);
        })
        .catch((e) => {
          console.error("[OpenAI Speech]", e);
          showToast(prettyObject(e));
          setSpeechStatus(false);
        })
        .finally(() => setSpeechLoading(false));
    }
  }

  const context: RenderMessage[] = useMemo(() => {
    return session.mask.hideContext ? [] : session.mask.context.slice();
  }, [session.mask.context, session.mask.hideContext]);

  if (
    context.length === 0 &&
    session.messages.at(0)?.content !== BOT_HELLO.content
  ) {
    const copiedHello = Object.assign({}, BOT_HELLO);
    if (!accessStore.isAuthorized()) {
      copiedHello.content = Locale.Error.Unauthorized;
    }
    context.push(copiedHello);
  }

  // Only committed messages belong in the conversation. While the user is
  // composing, the draft stays in the input instead of appearing twice.
  const renderMessages = useMemo(() => {
    return context.concat(session.messages as RenderMessage[]).concat(
      isLoading
        ? [
            {
              ...createMessage({
                role: "assistant",
                content: "??",
              }),
              preview: true,
            },
          ]
        : [],
    );
  }, [context, isLoading, session.messages]);

  const [msgRenderIndex, _setMsgRenderIndex] = useState(
    Math.max(0, renderMessages.length - CHAT_PAGE_SIZE),
  );

  function setMsgRenderIndex(newIndex: number) {
    newIndex = Math.min(renderMessages.length - CHAT_PAGE_SIZE, newIndex);
    newIndex = Math.max(0, newIndex);
    _setMsgRenderIndex(newIndex);
  }

  const messages = useMemo(() => {
    const endRenderIndex = Math.min(
      msgRenderIndex + 3 * CHAT_PAGE_SIZE,
      renderMessages.length,
    );
    return renderMessages.slice(msgRenderIndex, endRenderIndex);
  }, [msgRenderIndex, renderMessages]);

  const onChatBodyScroll = (e: HTMLElement) => {
    const bottomHeight = e.scrollTop + e.clientHeight;
    const edgeThreshold = e.clientHeight;

    const isTouchTopEdge = e.scrollTop <= edgeThreshold;
    const isTouchBottomEdge = bottomHeight >= e.scrollHeight - edgeThreshold;
    const isHitBottom =
      bottomHeight >= e.scrollHeight - (isMobileScreen ? 4 : 10);

    const prevPageMsgIndex = msgRenderIndex - CHAT_PAGE_SIZE;
    const nextPageMsgIndex = msgRenderIndex + CHAT_PAGE_SIZE;

    if (isTouchTopEdge && !isTouchBottomEdge) {
      setMsgRenderIndex(prevPageMsgIndex);
    } else if (isTouchBottomEdge) {
      setMsgRenderIndex(nextPageMsgIndex);
    }

    setHitBottom(isHitBottom);
    setAutoScroll(isHitBottom);
  };

  function scrollToBottom() {
    setMsgRenderIndex(renderMessages.length - CHAT_PAGE_SIZE);
    scrollDomToBottom();
  }

  // clear context index = context length + index in messages
  const clearContextIndex =
    (session.clearContextIndex ?? -1) >= 0
      ? session.clearContextIndex! + context.length - msgRenderIndex
      : -1;

  const [showPromptModal, setShowPromptModal] = useState(false);

  const autoFocus = !isMobileScreen; // wont auto focus on mobile screen

  useCommand({
    fill: setUserInput,
    submit: (text) => {
      doSubmit(text);
    },
    code: (text) => {
      if (accessStore.disableFastLink) return;
      console.log("[Command] got code from url: ", text);
      showConfirm(Locale.URLCommand.Code + `code = ${text}`).then((res) => {
        if (res) {
          accessStore.update((access) => (access.accessCode = text));
        }
      });
    },
    settings: (text) => {
      if (accessStore.disableFastLink) return;

      try {
        const payload = JSON.parse(text) as {
          key?: string;
          url?: string;
        };

        console.log("[Command] got settings from url: ", payload);

        if (payload.key || payload.url) {
          showConfirm(
            Locale.URLCommand.Settings +
              `\n${JSON.stringify(payload, null, 4)}`,
          ).then((res) => {
            if (!res) return;
            if (payload.key) {
              accessStore.update(
                (access) => (access.openaiApiKey = payload.key!),
              );
            }
            if (payload.url) {
              accessStore.update((access) => (access.openaiUrl = payload.url!));
            }
            accessStore.update((access) => (access.useCustomConfig = true));
          });
        }
      } catch {
        console.error("[Command] failed to get settings from url: ", text);
      }
    },
  });

  // edit / insert message modal
  const [isEditingMessage, setIsEditingMessage] = useState(false);

  // remember unfinished input
  useEffect(() => {
    // try to load from local storage
    const key = UNFINISHED_INPUT(session.id);
    const mayBeUnfinishedInput = localStorage.getItem(key);
    if (mayBeUnfinishedInput && userInput.length === 0) {
      setUserInput(mayBeUnfinishedInput);
      localStorage.removeItem(key);
    }

    const dom = inputRef.current;
    return () => {
      localStorage.setItem(key, dom?.value ?? "");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 快捷键 shortcut keys
  const [showShortcutKeyModal, setShowShortcutKeyModal] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // 打开新聊天 command + shift + o
      if (
        (event.metaKey || event.ctrlKey) &&
        event.shiftKey &&
        event.key.toLowerCase() === "o"
      ) {
        event.preventDefault();
        setTimeout(() => {
          chatStore.newSession();
          navigate(Path.Chat);
        }, 10);
      }
      // 聚焦聊天输入 shift + esc
      else if (event.shiftKey && event.key.toLowerCase() === "escape") {
        event.preventDefault();
        inputRef.current?.focus();
      }
      // 复制最后一个代码块 command + shift + ;
      else if (
        (event.metaKey || event.ctrlKey) &&
        event.shiftKey &&
        event.code === "Semicolon"
      ) {
        event.preventDefault();
        const copyCodeButton =
          document.querySelectorAll<HTMLElement>(".copy-code-button");
        if (copyCodeButton.length > 0) {
          copyCodeButton[copyCodeButton.length - 1].click();
        }
      }
      // 复制最后一个回复 command + shift + c
      else if (
        (event.metaKey || event.ctrlKey) &&
        event.shiftKey &&
        event.key.toLowerCase() === "c"
      ) {
        event.preventDefault();
        const lastNonUserMessage = messages
          .filter((message) => message.role !== "user")
          .pop();
        if (lastNonUserMessage) {
          const lastMessageContent = getMessageTextContent(lastNonUserMessage);
          copyToClipboard(lastMessageContent);
        }
      }
      // 展示快捷键 command + /
      else if ((event.metaKey || event.ctrlKey) && event.key === "/") {
        event.preventDefault();
        setShowShortcutKeyModal(true);
      }
      // 清除上下文 command + shift + backspace
      else if (
        (event.metaKey || event.ctrlKey) &&
        event.shiftKey &&
        event.key.toLowerCase() === "backspace"
      ) {
        event.preventDefault();
        chatStore.updateTargetSession(session, (session) => {
          if (session.clearContextIndex === session.messages.length) {
            session.clearContextIndex = undefined;
          } else {
            session.clearContextIndex = session.messages.length;
            session.memoryPrompt = ""; // will clear memory
          }
        });
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [messages, chatStore, navigate, session]);

  const [showChatSidePanel, setShowChatSidePanel] = useState(false);
  const featuredAssistant = FEATURED_ASSISTANTS.find(
    (assistant) => `featured-${assistant.key}` === session.mask.id,
  );
  const isAssistantSession = session.mask.name !== DEFAULT_TOPIC;
  const isConversationEmpty = session.messages.length === 0;
  const emptyStateTitle =
    featuredAssistant?.name ||
    (isAssistantSession ? session.mask.name : "开始新对话");
  const emptyStateDescription =
    featuredAssistant?.description ||
    (isAssistantSession
      ? `我是 ${session.mask.name}，可以围绕你的目标提供专注、连续的帮助。`
      : "和 LinChat 一起整理想法、解决问题并完成工作。");
  const emptyStateGreeting =
    featuredAssistant?.greeting ||
    (isAssistantSession
      ? "告诉我你现在想完成什么，我们可以从这里开始。"
      : "选择一个建议，或者直接在下方输入你的问题。");
  const emptyStateSuggestions =
    featuredAssistant?.suggestions || EMPTY_CHAT_SUGGESTIONS;

  return (
    <>
      <div
        className={clsx(styles.chat, {
          [styles["chat-empty-state"]]: isConversationEmpty,
          [styles["chat-assistant"]]: isAssistantSession,
        })}
        key={session.id}
      >
        <div className="window-header" data-tauri-drag-region>
          {isMobileScreen && (
            <div className="window-actions">
              <div className={"window-action-button"}>
                <IconButton
                  icon={<ReturnIcon />}
                  bordered
                  title={Locale.Chat.Actions.ChatList}
                  onClick={() => {
                    if (props.onOpenChatList) {
                      props.onOpenChatList();
                    } else {
                      navigate(Path.Home);
                    }
                  }}
                />
              </div>
            </div>
          )}

          <div
            className={clsx("window-header-title", styles["chat-body-title"])}
          >
            <div
              className={clsx(
                "window-header-main-title",
                styles["chat-body-main-title"],
              )}
              onClickCapture={() => setIsEditingMessage(true)}
            >
              {displayTopic}
            </div>
            <div className="window-header-sub-title">
              {session.mask.name || "默认助理"} ·{" "}
              {Locale.Chat.SubTitle(session.messages.length)}
            </div>
          </div>
          <div className="window-actions">
            <div className="window-action-button">
              <IconButton
                icon={<ReloadIcon />}
                bordered
                title={Locale.Chat.Actions.RefreshTitle}
                onClick={() => {
                  showToast(Locale.Chat.Actions.RefreshToast);
                  chatStore.summarizeSession(true, session);
                }}
              />
            </div>
            {!isMobileScreen && (
              <div className="window-action-button">
                <IconButton
                  icon={<RenameIcon />}
                  bordered
                  title={Locale.Chat.EditMessage.Title}
                  aria={Locale.Chat.EditMessage.Title}
                  onClick={() => setIsEditingMessage(true)}
                />
              </div>
            )}
            <div className="window-action-button">
              <IconButton
                icon={<ExportIcon />}
                bordered
                title={Locale.Chat.Actions.Export}
                onClick={() => {
                  setShowExport(true);
                }}
              />
            </div>
          </div>

          <PromptToast
            showToast={!hitBottom}
            showModal={showPromptModal}
            setShowModal={setShowPromptModal}
          />
        </div>
        <div className={styles["chat-main"]}>
          <div className={styles["chat-body-container"]}>
            {!hitBottom && (
              <button
                className={styles["scroll-to-latest"]}
                type="button"
                aria-label={Locale.Chat.InputActions.ToBottom}
                onClick={scrollToBottom}
              >
                <BottomIcon />
              </button>
            )}
            <div
              className={styles["chat-body"]}
              ref={scrollRef}
              onScroll={(e) => onChatBodyScroll(e.currentTarget)}
              onMouseDown={() => inputRef.current?.blur()}
              onTouchStart={() => {
                inputRef.current?.blur();
                setAutoScroll(false);
              }}
            >
              {isConversationEmpty && (
                <section
                  className={clsx(styles["chat-empty"], {
                    [styles["chat-empty-assistant"]]: isAssistantSession,
                  })}
                >
                  <div
                    className={clsx(styles["chat-empty-avatar"], {
                      [styles["chat-empty-avatar-brand"]]:
                        featuredAssistant?.isSystem,
                    })}
                  >
                    <MaskAvatar
                      avatar={featuredAssistant?.avatar ?? session.mask.avatar}
                      size={featuredAssistant?.isSystem ? 62 : 54}
                    />
                  </div>
                  <div className={styles["chat-empty-copy"]}>
                    <h1 title={emptyStateTitle}>{emptyStateTitle}</h1>
                    <p>{emptyStateDescription}</p>
                    <strong>{emptyStateGreeting}</strong>
                  </div>
                  <div className={styles["chat-empty-suggestions"]}>
                    <div className={styles["chat-empty-suggestions-label"]}>
                      你可以这样问
                    </div>
                    {emptyStateSuggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => doSubmit(suggestion)}
                      >
                        <span>{suggestion}</span>
                        <span aria-hidden="true">↗</span>
                      </button>
                    ))}
                  </div>
                </section>
              )}
              {!isConversationEmpty &&
                messages
                  // TODO
                  // .filter((m) => !m.isMcpResponse)
                  .map((message, i) => {
                    // Keep the original render index so context boundaries and
                    // clear-context dividers stay aligned after hiding prompts.
                    if (message.role === "system") return null;

                    const isUser = message.role === "user";
                    const isContext = i < context.length;
                    const showActions =
                      i > 0 &&
                      !(message.preview || message.content.length === 0) &&
                      !isContext;
                    const showTyping = message.preview || message.streaming;
                    const resolvedMessageModel = !isUser
                      ? getMessageModelDisplayName({
                          messageModel: message.model,
                          messageProvider: message.provider,
                          sessionModel: session.mask.modelConfig.model,
                          sessionProvider:
                            session.mask.modelConfig.providerName,
                          models: allModels,
                        })
                      : undefined;
                    const assistantMetadata = !isUser
                      ? getAssistantMessageMetadata({
                          featuredAssistantName: featuredAssistant?.name,
                          maskName: session.mask.name,
                          defaultTopicName: DEFAULT_TOPIC,
                          defaultAssistantName: "默认助理",
                          messageModel: resolvedMessageModel,
                          sessionModel: session.mask.modelConfig.model,
                        })
                      : undefined;

                    const shouldShowClearContextDivider =
                      i === clearContextIndex - 1;

                    return (
                      <Fragment key={message.id}>
                        <div
                          className={
                            isUser
                              ? styles["chat-message-user"]
                              : styles["chat-message"]
                          }
                        >
                          <div className={styles["chat-message-container"]}>
                            <div className={styles["chat-message-header"]}>
                              {!isUser && assistantMetadata && (
                                <div
                                  className={styles["chat-message-identity"]}
                                >
                                  <div
                                    className={styles["chat-message-avatar"]}
                                  >
                                    <MaskAvatar
                                      avatar={
                                        featuredAssistant?.avatar ??
                                        session.mask.avatar
                                      }
                                      model={assistantMetadata.modelName}
                                    />
                                  </div>
                                  <div
                                    className={styles["chat-assistant-name"]}
                                  >
                                    {assistantMetadata.assistantName}
                                  </div>
                                </div>
                              )}

                              {!isUser && assistantMetadata && (
                                <div className={styles["chat-message-meta"]}>
                                  <div
                                    className={
                                      styles["chat-message-action-date"]
                                    }
                                  >
                                    {isContext
                                      ? Locale.Chat.IsContext
                                      : message.date.toLocaleString()}
                                  </div>
                                  {assistantMetadata.modelName && (
                                    <div className={styles["chat-model-name"]}>
                                      {assistantMetadata.modelName}
                                    </div>
                                  )}
                                </div>
                              )}

                              {isUser && (
                                <div
                                  className={styles["chat-message-action-date"]}
                                >
                                  {isContext
                                    ? Locale.Chat.IsContext
                                    : message.date.toLocaleString()}
                                </div>
                              )}
                            </div>
                            {message?.tools?.length == 0 && showTyping && (
                              <TaskRunningStatus />
                            )}
                            {/*@ts-ignore*/}
                            {message?.tools?.length > 0 && (
                              <div className={styles["chat-message-tools"]}>
                                {message?.tools?.map((tool) => (
                                  <div
                                    key={tool.id}
                                    title={tool?.errorMsg}
                                    className={styles["chat-message-tool"]}
                                  >
                                    {tool.isError === false ? (
                                      <ConfirmIcon />
                                    ) : tool.isError === true ? (
                                      <CloseIcon />
                                    ) : (
                                      <LoadingButtonIcon />
                                    )}
                                    <span>{tool?.function?.name}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            <div className={styles["chat-message-item"]}>
                              <Markdown
                                key={message.streaming ? "loading" : "done"}
                                content={getMessageTextContent(message)}
                                loading={
                                  (message.preview || message.streaming) &&
                                  message.content.length === 0 &&
                                  !isUser
                                }
                                //   onContextMenu={(e) => onRightClick(e, message)} // hard to use
                                onDoubleClickCapture={() => {
                                  if (!isMobileScreen) return;
                                  setUserInput(getMessageTextContent(message));
                                }}
                                fontSize={fontSize}
                                fontFamily={fontFamily}
                                parentRef={scrollRef}
                                defaultShow={i >= messages.length - 6}
                              />
                              {getMessageImages(message).length == 1 && (
                                <img
                                  className={styles["chat-message-item-image"]}
                                  src={getMessageImages(message)[0]}
                                  alt=""
                                />
                              )}
                              {getMessageImages(message).length > 1 && (
                                <div
                                  className={styles["chat-message-item-images"]}
                                  style={
                                    {
                                      "--image-count":
                                        getMessageImages(message).length,
                                    } as React.CSSProperties
                                  }
                                >
                                  {getMessageImages(message).map(
                                    (image, index) => {
                                      return (
                                        <img
                                          className={
                                            styles[
                                              "chat-message-item-image-multi"
                                            ]
                                          }
                                          key={index}
                                          src={image}
                                          alt=""
                                        />
                                      );
                                    },
                                  )}
                                </div>
                              )}
                            </div>
                            {message?.audio_url && (
                              <div className={styles["chat-message-audio"]}>
                                <audio src={message.audio_url} controls />
                              </div>
                            )}

                            {showActions && (
                              <div className={styles["chat-message-actions"]}>
                                <div
                                  className={
                                    styles["chat-message-action-buttons"]
                                  }
                                >
                                  {message.streaming ? (
                                    <ChatAction
                                      compact
                                      text={Locale.Chat.Actions.Stop}
                                      icon={<StopIcon />}
                                      onClick={() =>
                                        onUserStop(message.id ?? i)
                                      }
                                      data-action="stop"
                                    />
                                  ) : (
                                    <>
                                      {isUser && (
                                        <ChatAction
                                          compact
                                          text={Locale.Chat.Actions.Edit}
                                          icon={<EditIcon />}
                                          onClick={() => onEditMessage(message)}
                                        />
                                      )}
                                      <ChatAction
                                        compact
                                        text={Locale.Chat.Actions.Retry}
                                        icon={<ResetIcon />}
                                        onClick={() => onResend(message)}
                                      />
                                      <ChatAction
                                        compact
                                        text={Locale.Chat.Actions.Delete}
                                        icon={<DeleteIcon />}
                                        onClick={() =>
                                          onDelete(message.id ?? i)
                                        }
                                      />
                                      <ChatAction
                                        compact
                                        text={Locale.Chat.Actions.Pin}
                                        icon={<PinIcon />}
                                        onClick={() => onPinMessage(message)}
                                      />
                                      <ChatAction
                                        compact
                                        text={Locale.Chat.Actions.Copy}
                                        icon={<CopyIcon />}
                                        onClick={() =>
                                          copyToClipboard(
                                            getMessageTextContent(message),
                                          )
                                        }
                                      />
                                      {config.ttsConfig.enable && (
                                        <ChatAction
                                          compact
                                          text={
                                            speechStatus
                                              ? Locale.Chat.Actions.StopSpeech
                                              : Locale.Chat.Actions.Speech
                                          }
                                          icon={
                                            speechStatus ? (
                                              <SpeakStopIcon />
                                            ) : (
                                              <SpeakIcon />
                                            )
                                          }
                                          onClick={() =>
                                            openaiSpeech(
                                              getMessageTextContent(message),
                                            )
                                          }
                                        />
                                      )}
                                    </>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        {shouldShowClearContextDivider && (
                          <ClearContextDivider />
                        )}
                      </Fragment>
                    );
                  })}
            </div>
            <div className={styles["chat-input-panel"]}>
              <PromptHints
                prompts={promptHints}
                onPromptSelect={onPromptSelect}
              />

              <ChatComposer
                value={userInput}
                onInput={onInput}
                onSubmit={() => doSubmit(userInput)}
                placeholder={Locale.Chat.Input(submitKey)}
                attachImages={attachImages}
                setAttachImages={setAttachImages}
                uploading={uploading}
                setUploading={setUploading}
                mask={session.mask}
                inputRef={inputRef}
                inputId="chat-input"
                onKeyDown={onInputKeyDown}
                rows={inputRows}
                autoFocus={autoFocus}
                inputStyle={{
                  fontSize: config.fontSize,
                  fontFamily: config.fontFamily,
                }}
                showPromptModal={() => setShowPromptModal(true)}
                scrollToBottom={scrollToBottom}
                hitBottom={hitBottom}
                showPromptHints={() => {
                  if (promptHints.length > 0) {
                    setPromptHints([]);
                    return;
                  }

                  inputRef.current?.focus();
                  setUserInput("/");
                  onSearch("");
                }}
                setShowShortcutKeyModal={setShowShortcutKeyModal}
                setShowChatSidePanel={setShowChatSidePanel}
                sendIcon={
                  ChatControllerPool.hasPending() ? <StopIcon /> : <SendIcon />
                }
                sendLabel={
                  ChatControllerPool.hasPending()
                    ? Locale.Chat.Actions.Stop
                    : Locale.Chat.Send
                }
                onSend={() => {
                  if (ChatControllerPool.hasPending()) {
                    ChatControllerPool.stopAll();
                  } else {
                    doSubmit(userInput);
                  }
                }}
              />
            </div>
          </div>
          <div
            className={clsx(styles["chat-side-panel"], {
              [styles["mobile"]]: isMobileScreen,
              [styles["chat-side-panel-show"]]: showChatSidePanel,
            })}
          >
            {showChatSidePanel && (
              <RealtimeChat
                onClose={() => {
                  setShowChatSidePanel(false);
                }}
                onStartVoice={async () => {
                  console.log("start voice");
                }}
              />
            )}
          </div>
        </div>
      </div>
      {showExport && (
        <ExportMessageModal onClose={() => setShowExport(false)} />
      )}

      {isEditingMessage && (
        <EditMessageModal
          onClose={() => {
            setIsEditingMessage(false);
          }}
        />
      )}

      {showShortcutKeyModal && (
        <ShortcutKeyModal onClose={() => setShowShortcutKeyModal(false)} />
      )}
    </>
  );
}

export function Chat(props: ChatProps = {}) {
  const chatStore = useChatStore();
  const session = chatStore.currentSession();
  return <_Chat key={session.id} {...props}></_Chat>;
}
