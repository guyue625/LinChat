import React, { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import styles from "./home.module.scss";

import { IconButton } from "./button";
import {
  ArrowLeft as LeftIcon,
  Bell as NotificationIcon,
  Bot as MaskIcon,
  Check,
  ChevronDown as DownIcon,
  ChevronsUpDown,
  Compass as DiscoveryIcon,
  MessageCircle as ChatIcon,
  MoreHorizontal,
  PanelLeftClose as CollapseIcon,
  Plug as McpIcon,
  Plus as AddIcon,
  Search as SearchIcon,
  Trash2 as DeleteIcon,
  X as CloseIcon,
} from "lucide-react";
import { EmojiAvatar } from "./emoji";
import { BrandLogo } from "./brand-logo";
import {
  assistantToMask,
  FEATURED_ASSISTANTS,
} from "../data/featured-assistants";

import Locale from "../locales";

import { useAppConfig, useChatStore } from "../store";
import { Mask, useMaskStore } from "../store/mask";
import { Theme } from "../store/config";

import { DEFAULT_SIDEBAR_WIDTH, NARROW_SIDEBAR_WIDTH, Path } from "../constant";

import { useLocation, useNavigate } from "react-router-dom";
import { isIOS, useMobileScreen } from "../utils";
import dynamic from "next/dynamic";
import { Selector, showConfirm, showToast } from "./ui-lib";
import clsx from "clsx";
import { isMcpEnabled } from "../mcp/actions";
import { AccountDock } from "./account-dock";

const DISCOVERY = [
  { name: Locale.Plugin.Name, path: Path.Plugins },
  { name: "Stable Diffusion", path: Path.Sd },
  { name: Locale.SearchChat.Page.Title, path: Path.SearchChat },
];

const ChatList = dynamic(async () => (await import("./chat-list")).ChatList, {
  loading: () => null,
});

function RecentChatsPanel(props: { onClose: () => void }) {
  const { onClose } = props;
  const [query, setQuery] = useState("");

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return createPortal(
    <div
      className={styles["recent-panel-backdrop"]}
      role="presentation"
      onPointerDown={onClose}
    >
      <aside
        className={styles["recent-panel"]}
        role="dialog"
        aria-modal="true"
        aria-label="最近会话"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <header className={styles["recent-panel-header"]}>
          <div>
            <strong>最近</strong>
            <span>查看和管理全部会话</span>
          </div>
          <button type="button" aria-label="关闭" onClick={onClose}>
            <CloseIcon />
          </button>
        </header>
        <label className={styles["recent-panel-search"]}>
          <SearchIcon />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder="搜索会话"
          />
        </label>
        <div className={styles["recent-panel-list"]}>
          <ChatList variant="panel" query={query} onSelect={onClose} />
        </div>
      </aside>
    </div>,
    document.body,
  );
}

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

export function useSideBarState() {
  const config = useAppConfig();
  const isMobileScreen = useMobileScreen();
  const shouldNarrow =
    !isMobileScreen && config.sidebarWidth === NARROW_SIDEBAR_WIDTH;

  const toggleSideBar = () => {
    config.update((nextConfig) => {
      nextConfig.sidebarWidth = shouldNarrow
        ? DEFAULT_SIDEBAR_WIDTH
        : NARROW_SIDEBAR_WIDTH;
    });
  };

  useEffect(() => {
    const sideBarWidth = isMobileScreen
      ? "100vw"
      : `${
          shouldNarrow
            ? NARROW_SIDEBAR_WIDTH
            : config.sidebarWidth ?? DEFAULT_SIDEBAR_WIDTH
        }px`;
    document.documentElement.style.setProperty("--sidebar-width", sideBarWidth);
  }, [config.sidebarWidth, isMobileScreen, shouldNarrow]);

  return { isMobileScreen, shouldNarrow, toggleSideBar };
}

export function SideBarContainer(props: {
  children: React.ReactNode;
  shouldNarrow: boolean;
  className?: string;
}) {
  const isMobileScreen = useMobileScreen();
  const isIOSMobile = useMemo(
    () => isIOS() && isMobileScreen,
    [isMobileScreen],
  );
  const { children, className, shouldNarrow } = props;
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
    </div>
  );
}

export function SideBarHeader(props: {
  title?: string | React.ReactNode;
  subTitle?: string | React.ReactNode;
  logo?: React.ReactNode;
  children?: React.ReactNode;
  overlay?: React.ReactNode;
  shouldNarrow?: boolean;
}) {
  const { title, subTitle, logo, children, overlay, shouldNarrow } = props;
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
        {overlay}
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
  const { isMobileScreen, shouldNarrow, toggleSideBar } = useSideBarState();
  const [showDiscoverySelector, setshowDiscoverySelector] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const config = useAppConfig();
  const chatStore = useChatStore();
  const activeMaskId = chatStore.currentSession().mask.id;
  const [mcpEnabled, setMcpEnabled] = useState(false);
  const [recentExpanded, setRecentExpanded] = useState(true);
  const [recentPanelOpen, setRecentPanelOpen] = useState(false);
  const [assistantsExpanded, setAssistantsExpanded] = useState(true);
  const [topicsExpanded, setTopicsExpanded] = useState(true);
  const [assistantSwitcherOpen, setAssistantSwitcherOpen] = useState(false);
  const assistantSwitcherRef = useRef<HTMLButtonElement>(null);
  const assistantSwitcherMenuRef = useRef<HTMLDivElement>(null);
  const maskStore = useMaskStore();

  const customAssistants = Object.values(maskStore.masks).sort(
    (a, b) => b.createdAt - a.createdAt,
  );
  const isDarkTheme =
    config.theme === Theme.Dark ||
    (config.theme === Theme.Auto &&
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  const toggleTheme = () => {
    config.update((nextConfig) => {
      nextConfig.theme = isDarkTheme ? Theme.Light : Theme.Dark;
    });
  };

  useEffect(() => {
    if (!assistantSwitcherOpen) return;

    const closeSwitcher = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        assistantSwitcherRef.current?.contains(target) ||
        assistantSwitcherMenuRef.current?.contains(target)
      ) {
        return;
      }
      setAssistantSwitcherOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAssistantSwitcherOpen(false);
    };

    document.addEventListener("pointerdown", closeSwitcher);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeSwitcher);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [assistantSwitcherOpen]);

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

  const openMaskAssistant = (mask: Mask) => {
    const sessionIndex = chatStore.sessions.reduce(
      (latestIndex, session, index) => {
        if (session.mask.id !== mask.id) return latestIndex;
        if (latestIndex < 0) return index;
        return session.lastUpdate > chatStore.sessions[latestIndex].lastUpdate
          ? index
          : latestIndex;
      },
      -1,
    );

    if (sessionIndex >= 0) {
      const session = chatStore.sessions[sessionIndex];
      chatStore.updateTargetSession(session, (target) => {
        target.mask = { ...mask };
      });
      chatStore.selectSession(sessionIndex);
    } else {
      chatStore.newSession(mask);
    }

    setAssistantSwitcherOpen(false);
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
      <SideBarContainer shouldNarrow={shouldNarrow} {...props}>
        <SideBarHeader
          title={
            shouldNarrow ? undefined : (
              <button
                ref={assistantSwitcherRef}
                type="button"
                className={clsx(styles["assistant-workspace-title"], {
                  [styles["assistant-workspace-title-brand"]]:
                    currentFeaturedAssistant?.isSystem,
                })}
                aria-label={`切换助理，当前为 ${currentMask.name}`}
                aria-haspopup="listbox"
                aria-expanded={assistantSwitcherOpen}
                onClick={() => setAssistantSwitcherOpen((isOpen) => !isOpen)}
              >
                <EmojiAvatar
                  avatar={currentMaskAvatar}
                  size={currentFeaturedAssistant?.isSystem ? 32 : 28}
                />
                <span>{currentMask.name}</span>
                <ChevronsUpDown aria-hidden="true" />
              </button>
            )
          }
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
          overlay={
            !shouldNarrow && assistantSwitcherOpen ? (
              <div
                ref={assistantSwitcherMenuRef}
                className={styles["assistant-switcher-menu"]}
                role="listbox"
                aria-label="切换助理"
              >
                <div className={styles["assistant-switcher-label"]}>
                  预置助理
                </div>
                {FEATURED_ASSISTANTS.map((assistant) => {
                  const assistantMaskId = `featured-${assistant.key}`;
                  const selected = currentMask.id === assistantMaskId;
                  return (
                    <button
                      key={assistant.key}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      className={clsx(styles["assistant-switcher-item"], {
                        [styles["assistant-switcher-item-active"]]: selected,
                      })}
                      onClick={() => {
                        setAssistantSwitcherOpen(false);
                        openAssistant(assistant);
                      }}
                    >
                      <span
                        className={clsx(styles["assistant-switcher-avatar"], {
                          [styles["assistant-switcher-avatar-brand"]]:
                            assistant.isSystem,
                        })}
                      >
                        <EmojiAvatar
                          avatar={assistant.avatar}
                          size={assistant.isSystem ? 34 : 28}
                        />
                      </span>
                      <span className={styles["assistant-switcher-copy"]}>
                        <strong>{assistant.name}</strong>
                        <small>{assistant.description}</small>
                      </span>
                      {selected && <Check aria-hidden="true" />}
                    </button>
                  );
                })}
                {customAssistants.length > 0 && (
                  <>
                    <div className={styles["assistant-switcher-divider"]} />
                    <div className={styles["assistant-switcher-label"]}>
                      我的助理
                    </div>
                    {customAssistants.map((assistant) => {
                      const selected = currentMask.id === assistant.id;
                      return (
                        <button
                          key={assistant.id}
                          type="button"
                          role="option"
                          aria-selected={selected}
                          className={clsx(styles["assistant-switcher-item"], {
                            [styles["assistant-switcher-item-active"]]:
                              selected,
                          })}
                          onClick={() => openMaskAssistant(assistant)}
                        >
                          <span className={styles["assistant-switcher-avatar"]}>
                            <EmojiAvatar avatar={assistant.avatar} size={28} />
                          </span>
                          <span className={styles["assistant-switcher-copy"]}>
                            <strong>{assistant.name}</strong>
                            <small>自定义助理</small>
                          </span>
                          {selected && <Check aria-hidden="true" />}
                        </button>
                      );
                    })}
                  </>
                )}
                <div className={styles["assistant-switcher-divider"]} />
                <button
                  type="button"
                  className={clsx(
                    styles["assistant-switcher-item"],
                    styles["assistant-switcher-create"],
                  )}
                  onClick={() => {
                    setAssistantSwitcherOpen(false);
                    navigate(Path.Masks);
                  }}
                >
                  <span className={styles["assistant-switcher-avatar"]}>
                    <AddIcon aria-hidden="true" />
                  </span>
                  <span className={styles["assistant-switcher-copy"]}>
                    <strong>创建助理</strong>
                  </span>
                </button>
              </div>
            ) : undefined
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
          {!shouldNarrow && topicsExpanded && (
            <ChatList maskId={activeMaskId} />
          )}
        </SideBarBody>
        <AccountDock
          shouldNarrow={shouldNarrow}
          isDarkTheme={isDarkTheme}
          onSettings={() => navigate(Path.Settings)}
          onToggleTheme={toggleTheme}
        />
        {/* Bottom "新话题" removed — top "开启新话题" already covers this. */}
      </SideBarContainer>
    );
  }

  return (
    <SideBarContainer shouldNarrow={shouldNarrow} {...props}>
      <SideBarHeader
        title={
          shouldNarrow ? undefined : (
            <span className={styles["sidebar-brand-title"]}>
              <BrandLogo width={30} height={26} alt="" />
              <span>LinChat</span>
            </span>
          )
        }
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
        {!shouldNarrow && recentExpanded && (
          <>
            <ChatList limit={5} />
            {chatStore.sessions.length > 5 && (
              <button
                type="button"
                className={styles["recent-more-button"]}
                onClick={() => setRecentPanelOpen(true)}
              >
                <MoreHorizontal />
                <span>更多</span>
              </button>
            )}
          </>
        )}
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
      <AccountDock
        shouldNarrow={shouldNarrow}
        isDarkTheme={isDarkTheme}
        onSettings={() => navigate(Path.Settings)}
        onToggleTheme={toggleTheme}
      />
      {isMobileScreen && (
        <SideBarTail
          primaryAction={
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
          }
        />
      )}
      {recentPanelOpen && (
        <RecentChatsPanel onClose={() => setRecentPanelOpen(false)} />
      )}
    </SideBarContainer>
  );
}
