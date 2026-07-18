import React, { Fragment, useEffect, useMemo, useRef, useState } from "react";

import styles from "./home.module.scss";

import { IconButton } from "./button";
import SettingsIcon from "../icons/settings.svg";
import GithubIcon from "../icons/github.svg";
import AddIcon from "../icons/add.svg";
import DeleteIcon from "../icons/delete.svg";
import MaskIcon from "../icons/mask.svg";
import McpIcon from "../icons/mcp.svg";
import DragIcon from "../icons/drag.svg";
import DiscoveryIcon from "../icons/discovery.svg";
import ChatIcon from "../icons/chat.svg";
import LeftIcon from "../icons/left.svg";
import CollapseIcon from "../icons/sidebar-collapse.svg";
import NotificationIcon from "../icons/notification.svg";
import DownIcon from "../icons/down.svg";
import { EmojiAvatar } from "./emoji";
import {
  assistantToMask,
  FEATURED_ASSISTANTS,
} from "../data/featured-assistants";

import Locale from "../locales";

import { useAppConfig, useChatStore } from "../store";

import {
  DEFAULT_SIDEBAR_WIDTH,
  MAX_SIDEBAR_WIDTH,
  MIN_SIDEBAR_WIDTH,
  NARROW_SIDEBAR_WIDTH,
  Path,
  REPO_URL,
} from "../constant";

import { Link, useLocation, useNavigate } from "react-router-dom";
import { isIOS, useMobileScreen } from "../utils";
import dynamic from "next/dynamic";
import { Selector, showConfirm, showToast } from "./ui-lib";
import clsx from "clsx";
import { isMcpEnabled } from "../mcp/actions";

const DISCOVERY = [
  { name: Locale.Plugin.Name, path: Path.Plugins },
  { name: "Stable Diffusion", path: Path.Sd },
  { name: Locale.SearchChat.Page.Title, path: Path.SearchChat },
];

const ChatList = dynamic(async () => (await import("./chat-list")).ChatList, {
  loading: () => null,
});

export function useHotKey() {
  const chatStore = useChatStore();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey) {
        if (e.key === "ArrowUp") {
          chatStore.nextSession(-1);
        } else if (e.key === "ArrowDown") {
          chatStore.nextSession(1);
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });
}

export function useDragSideBar() {
  const limit = (x: number) => Math.min(MAX_SIDEBAR_WIDTH, x);

  const config = useAppConfig();
  const startX = useRef(0);
  const startDragWidth = useRef(config.sidebarWidth ?? DEFAULT_SIDEBAR_WIDTH);
  const lastUpdateTime = useRef(Date.now());

  const toggleSideBar = () => {
    config.update((config) => {
      if (config.sidebarWidth < MIN_SIDEBAR_WIDTH) {
        config.sidebarWidth = DEFAULT_SIDEBAR_WIDTH;
      } else {
        config.sidebarWidth = NARROW_SIDEBAR_WIDTH;
      }
    });
  };

  const onDragStart = (e: MouseEvent) => {
    // Remembers the initial width each time the mouse is pressed
    startX.current = e.clientX;
    startDragWidth.current = config.sidebarWidth;
    const dragStartTime = Date.now();

    const handleDragMove = (e: MouseEvent) => {
      if (Date.now() < lastUpdateTime.current + 20) {
        return;
      }
      lastUpdateTime.current = Date.now();
      const d = e.clientX - startX.current;
      const nextWidth = limit(startDragWidth.current + d);
      config.update((config) => {
        if (nextWidth < MIN_SIDEBAR_WIDTH) {
          config.sidebarWidth = NARROW_SIDEBAR_WIDTH;
        } else {
          config.sidebarWidth = nextWidth;
        }
      });
    };

    const handleDragEnd = () => {
      // In useRef the data is non-responsive, so `config.sidebarWidth` can't get the dynamic sidebarWidth
      window.removeEventListener("pointermove", handleDragMove);
      window.removeEventListener("pointerup", handleDragEnd);

      // if user click the drag icon, should toggle the sidebar
      const shouldFireClick = Date.now() - dragStartTime < 300;
      if (shouldFireClick) {
        toggleSideBar();
      }
    };

    window.addEventListener("pointermove", handleDragMove);
    window.addEventListener("pointerup", handleDragEnd);
  };

  const isMobileScreen = useMobileScreen();
  const shouldNarrow =
    !isMobileScreen && config.sidebarWidth < MIN_SIDEBAR_WIDTH;

  useEffect(() => {
    const barWidth = shouldNarrow
      ? NARROW_SIDEBAR_WIDTH
      : limit(config.sidebarWidth ?? DEFAULT_SIDEBAR_WIDTH);
    const sideBarWidth = isMobileScreen ? "100vw" : `${barWidth}px`;
    document.documentElement.style.setProperty("--sidebar-width", sideBarWidth);
  }, [config.sidebarWidth, isMobileScreen, shouldNarrow]);

  return {
    onDragStart,
    shouldNarrow,
    toggleSideBar,
  };
}

export function SideBarContainer(props: {
  children: React.ReactNode;
  onDragStart: (e: MouseEvent) => void;
  shouldNarrow: boolean;
  className?: string;
}) {
  const isMobileScreen = useMobileScreen();
  const isIOSMobile = useMemo(
    () => isIOS() && isMobileScreen,
    [isMobileScreen],
  );
  const { children, className, onDragStart, shouldNarrow } = props;
  return (
    <div
      className={clsx(styles.sidebar, className, {
        [styles["narrow-sidebar"]]: shouldNarrow,
      })}
      style={{
        // #3016 disable transition on ios mobile screen
        transition: isMobileScreen && isIOSMobile ? "none" : undefined,
      }}
    >
      {children}
      <div
        className={styles["sidebar-drag"]}
        onPointerDown={(e) => onDragStart(e as any)}
      >
        <DragIcon />
      </div>
    </div>
  );
}

export function SideBarHeader(props: {
  title?: string | React.ReactNode;
  subTitle?: string | React.ReactNode;
  logo?: React.ReactNode;
  children?: React.ReactNode;
  shouldNarrow?: boolean;
}) {
  const { title, subTitle, logo, children, shouldNarrow } = props;
  return (
    <Fragment>
      <div
        className={clsx(styles["sidebar-header"], {
          [styles["sidebar-header-narrow"]]: shouldNarrow,
        })}
        data-tauri-drag-region
      >
        <div className={styles["sidebar-title-container"]}>
          <div className={styles["sidebar-title"]} data-tauri-drag-region>
            {title}
          </div>
          <div className={styles["sidebar-sub-title"]}>{subTitle}</div>
        </div>
        <div className={clsx(styles["sidebar-logo"], "no-dark")}>{logo}</div>
      </div>
      {children}
    </Fragment>
  );
}

export function SideBarBody(props: {
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => void;
}) {
  const { onClick, children } = props;
  return (
    <div className={styles["sidebar-body"]} onClick={onClick}>
      {children}
    </div>
  );
}

export function SideBarTail(props: {
  primaryAction?: React.ReactNode;
  secondaryAction?: React.ReactNode;
}) {
  const { primaryAction, secondaryAction } = props;

  return (
    <div className={styles["sidebar-tail"]}>
      <div className={styles["sidebar-actions"]}>{primaryAction}</div>
      <div className={styles["sidebar-actions"]}>{secondaryAction}</div>
    </div>
  );
}

export function SideBar(props: { className?: string }) {
  useHotKey();
  const { onDragStart, shouldNarrow, toggleSideBar } = useDragSideBar();
  const [showDiscoverySelector, setshowDiscoverySelector] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const config = useAppConfig();
  const chatStore = useChatStore();
  const activeMaskId = chatStore.currentSession().mask.id;
  const [mcpEnabled, setMcpEnabled] = useState(false);
  const [recentExpanded, setRecentExpanded] = useState(true);
  const [assistantsExpanded, setAssistantsExpanded] = useState(true);
  const [topicsExpanded, setTopicsExpanded] = useState(true);

  const openAssistant = (assistant: (typeof FEATURED_ASSISTANTS)[number]) => {
    const maskId = `featured-${assistant.key}`;
    const sessionIndex = chatStore.sessions.reduce(
      (latestIndex, session, index) => {
        if (session.mask.id !== maskId) return latestIndex;
        if (latestIndex < 0) return index;
        return session.lastUpdate > chatStore.sessions[latestIndex].lastUpdate
          ? index
          : latestIndex;
      },
      -1,
    );

    if (sessionIndex >= 0) {
      const session = chatStore.sessions[sessionIndex];
      const latestMask = assistantToMask(assistant);
      chatStore.updateTargetSession(session, (target) => {
        target.mask = {
          ...target.mask,
          avatar: latestMask.avatar,
          name: latestMask.name,
          context: latestMask.context,
        };
      });
      chatStore.selectSession(sessionIndex);
    } else {
      chatStore.newSession(assistantToMask(assistant));
    }

    navigate(Path.Chat);
  };

  useEffect(() => {
    // 检查 MCP 是否启用
    const checkMcpStatus = async () => {
      const enabled = await isMcpEnabled();
      setMcpEnabled(enabled);
      console.log("[SideBar] MCP enabled:", enabled);
    };
    checkMcpStatus();
  }, []);

  const currentMask = chatStore.currentSession().mask;
  const currentFeaturedAssistant = FEATURED_ASSISTANTS.find(
    (assistant) => `featured-${assistant.key}` === currentMask.id,
  );
  const currentMaskAvatar =
    currentFeaturedAssistant?.avatar ?? currentMask.avatar;
  const isAssistantWorkspace =
    location.pathname === Path.Chat &&
    currentMask.name !== Locale.Store.DefaultTopic;

  if (isAssistantWorkspace) {
    const createAssistantTopic = () => {
      chatStore.newSession(
        currentFeaturedAssistant
          ? assistantToMask(currentFeaturedAssistant)
          : currentMask,
      );
      navigate(Path.Chat);
    };

    return (
      <SideBarContainer
        onDragStart={onDragStart}
        shouldNarrow={shouldNarrow}
        {...props}
      >
        <SideBarHeader
          title={
            shouldNarrow ? undefined : (
              <span
                className={clsx(styles["assistant-workspace-title"], {
                  [styles["assistant-workspace-title-brand"]]:
                    currentFeaturedAssistant?.isSystem,
                })}
              >
                <EmojiAvatar
                  avatar={currentMaskAvatar}
                  size={currentFeaturedAssistant?.isSystem ? 34 : 30}
                />
                <span>{currentMask.name}</span>
              </span>
            )
          }
          subTitle={shouldNarrow ? undefined : "助理工作区"}
          logo={
            <div className={styles["sidebar-utility-actions"]}>
              <IconButton
                icon={<LeftIcon />}
                aria="返回首页"
                title="返回首页"
                onClick={() => navigate(Path.Home)}
              />
              <IconButton
                icon={<CollapseIcon />}
                aria={shouldNarrow ? "展开侧栏" : "收起侧栏"}
                title={shouldNarrow ? "展开侧栏" : "收起侧栏"}
                onClick={toggleSideBar}
              />
            </div>
          }
          shouldNarrow={shouldNarrow}
        />
        <SideBarBody>
          <div className={styles["assistant-workspace-menu"]}>
            <button
              className={styles["assistant-workspace-action"]}
              onClick={createAssistantTopic}
              title="开启新话题"
            >
              <AddIcon />
              {!shouldNarrow && <span>开启新话题</span>}
            </button>
            <button
              className={styles["assistant-workspace-action"]}
              onClick={() => navigate(Path.SearchChat)}
              title="搜索话题"
            >
              <DiscoveryIcon />
              {!shouldNarrow && <span>搜索话题</span>}
            </button>
            <button
              className={styles["assistant-workspace-action"]}
              onClick={() => navigate(Path.Masks)}
              title="助理档案"
            >
              <MaskIcon />
              {!shouldNarrow && <span>助理档案</span>}
            </button>
          </div>
          {!shouldNarrow && (
            <button
              type="button"
              className={styles["sidebar-section-label"]}
              onClick={() => setTopicsExpanded((expanded) => !expanded)}
              aria-expanded={topicsExpanded}
            >
              <DownIcon
                className={clsx({
                  [styles["sidebar-section-collapsed"]]: !topicsExpanded,
                })}
              />
              <span>话题</span>
            </button>
          )}
          {(shouldNarrow || topicsExpanded) && (
            <ChatList narrow={shouldNarrow} maskId={activeMaskId} />
          )}
        </SideBarBody>
        <SideBarTail
          primaryAction={
            <IconButton
              icon={<SettingsIcon />}
              aria={Locale.Settings.Title}
              title={Locale.Settings.Title}
              onClick={() => navigate(Path.Settings)}
              shadow
            />
          }
          secondaryAction={
            <IconButton
              icon={<AddIcon />}
              text={shouldNarrow ? undefined : "新话题"}
              onClick={createAssistantTopic}
              shadow
            />
          }
        />
      </SideBarContainer>
    );
  }

  return (
    <SideBarContainer
      onDragStart={onDragStart}
      shouldNarrow={shouldNarrow}
      {...props}
    >
      <SideBarHeader
        title="LinChat"
        subTitle="Build your own AI assistant."
        logo={
          <div className={styles["sidebar-utility-actions"]}>
            <IconButton
              icon={<CollapseIcon />}
              aria={shouldNarrow ? "展开侧栏" : "收起侧栏"}
              title={shouldNarrow ? "展开侧栏" : "收起侧栏"}
              onClick={toggleSideBar}
            />
            {!shouldNarrow && (
              <IconButton
                icon={<NotificationIcon />}
                aria="通知"
                title="通知"
                onClick={() => showToast("暂无新通知")}
              />
            )}
          </div>
        }
        shouldNarrow={shouldNarrow}
      >
        <div className={styles["sidebar-header-bar"]}>
          <IconButton
            icon={<MaskIcon />}
            text={shouldNarrow ? undefined : Locale.Mask.Name}
            className={styles["sidebar-bar-button"]}
            onClick={() => {
              if (config.dontShowMaskSplashScreen !== true) {
                navigate(Path.NewChat, { state: { fromHome: true } });
              } else {
                navigate(Path.Masks, { state: { fromHome: true } });
              }
            }}
            shadow
          />
          {mcpEnabled && (
            <IconButton
              icon={<McpIcon />}
              text={shouldNarrow ? undefined : Locale.Mcp.Name}
              className={styles["sidebar-bar-button"]}
              onClick={() => {
                navigate(Path.McpMarket, { state: { fromHome: true } });
              }}
              shadow
            />
          )}
          <IconButton
            icon={<DiscoveryIcon />}
            text={shouldNarrow ? undefined : Locale.Discovery.Name}
            className={styles["sidebar-bar-button"]}
            onClick={() => setshowDiscoverySelector(true)}
            shadow
          />
        </div>
        {showDiscoverySelector && (
          <Selector
            items={[
              ...DISCOVERY.map((item) => {
                return {
                  title: item.name,
                  value: item.path,
                };
              }),
            ]}
            onClose={() => setshowDiscoverySelector(false)}
            onSelection={(s) => {
              navigate(s[0], { state: { fromHome: true } });
            }}
          />
        )}
      </SideBarHeader>
      <SideBarBody
        onClick={(e) => {
          if (e.target === e.currentTarget) navigate(Path.Home);
        }}
      >
        <nav className={styles["workspace-nav"]}>
          <button
            className={clsx(styles["workspace-nav-item"], {
              [styles["sidebar-entry-active"]]: location.pathname === Path.Home,
            })}
            onClick={() => navigate(Path.Home)}
          >
            <ChatIcon />
            {!shouldNarrow && <span>首页</span>}
          </button>
        </nav>
        {!shouldNarrow && (
          <button
            type="button"
            className={styles["sidebar-section-label"]}
            onClick={() => setRecentExpanded((expanded) => !expanded)}
            aria-expanded={recentExpanded}
          >
            <DownIcon
              className={clsx({
                [styles["sidebar-section-collapsed"]]: !recentExpanded,
              })}
            />
            <span>最近</span>
          </button>
        )}
        {(shouldNarrow || recentExpanded) && <ChatList narrow={shouldNarrow} />}
        <div className={styles["assistant-shortcuts"]}>
          {!shouldNarrow && (
            <button
              type="button"
              className={styles["sidebar-section-label"]}
              onClick={() => setAssistantsExpanded((expanded) => !expanded)}
              aria-expanded={assistantsExpanded}
            >
              <DownIcon
                className={clsx({
                  [styles["sidebar-section-collapsed"]]: !assistantsExpanded,
                })}
              />
              <span>助理</span>
            </button>
          )}
          {(shouldNarrow || assistantsExpanded) && (
            <>
              {FEATURED_ASSISTANTS.map((assistant) => (
                <button
                  key={assistant.key}
                  className={clsx(styles["assistant-shortcut"], {
                    [styles["assistant-shortcut-brand"]]: assistant.isSystem,
                    [styles["sidebar-entry-active"]]:
                      location.pathname === Path.Chat &&
                      activeMaskId === `featured-${assistant.key}`,
                  })}
                  title={assistant.name}
                  onClick={() => openAssistant(assistant)}
                >
                  <span>
                    <EmojiAvatar
                      avatar={assistant.avatar}
                      size={assistant.isSystem ? 36 : 28}
                    />
                  </span>
                  {!shouldNarrow && <em>{assistant.name}</em>}
                </button>
              ))}
              <button
                className={clsx(styles["assistant-shortcut"], {
                  [styles["sidebar-entry-active"]]:
                    location.pathname === Path.Masks ||
                    location.pathname === Path.NewChat,
                })}
                onClick={() => navigate(Path.Masks)}
              >
                <span className={styles["assistant-add"]}>＋</span>
                {!shouldNarrow && <em>创建助理</em>}
              </button>
            </>
          )}
        </div>
      </SideBarBody>
      <SideBarTail
        primaryAction={
          <>
            <div className={clsx(styles["sidebar-action"], styles.mobile)}>
              <IconButton
                icon={<DeleteIcon />}
                onClick={async () => {
                  if (await showConfirm(Locale.Home.DeleteChat)) {
                    chatStore.deleteSession(chatStore.currentSessionIndex);
                  }
                }}
              />
            </div>
            <div className={styles["sidebar-action"]}>
              <Link to={Path.Settings}>
                <IconButton
                  aria={Locale.Settings.Title}
                  icon={<SettingsIcon />}
                  shadow
                />
              </Link>
            </div>
            <div className={styles["sidebar-action"]}>
              <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
                <IconButton
                  aria={Locale.Export.MessageFromChatGPT}
                  icon={<GithubIcon />}
                  shadow
                />
              </a>
            </div>
          </>
        }
        secondaryAction={
          <IconButton
            icon={<AddIcon />}
            text={shouldNarrow ? undefined : Locale.Home.NewChat}
            onClick={() => {
              const currentMask = chatStore.currentSession().mask;
              const isAssistantChat =
                location.pathname === Path.Chat &&
                currentMask.id.startsWith("featured-");

              if (isAssistantChat) {
                chatStore.newSession(currentMask);
                navigate(Path.Chat);
              } else if (config.dontShowMaskSplashScreen) {
                chatStore.newSession();
                navigate(Path.Chat);
              } else {
                navigate(Path.NewChat);
              }
            }}
            shadow
          />
        }
      />
    </SideBarContainer>
  );
}
