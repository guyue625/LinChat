"use client";

require("../polyfill");

import { useEffect, useState } from "react";
import styles from "./home.module.scss";

import { BrandLogo } from "./brand-logo";

import { getCSSVar, safeLocalStorage, useMobileScreen } from "../utils";

import dynamic from "next/dynamic";
import { Path, SlotID, THEME_STORAGE_KEY } from "../constant";
import { ErrorBoundary } from "./error";

import { getISOLang, getLang } from "../locales";

import {
  HashRouter as Router,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { SideBar } from "./sidebar";
import { useAppConfig } from "../store/config";
import { AuthPage } from "./auth";
import { getClientConfig } from "../config/client";
import { getClientApi } from "../client/api";
import clsx from "clsx";
import { initializeMcpSystem, isMcpEnabled } from "../mcp/actions";
import { AccountProvider, useAccount } from "./account-context";
import { AccountWorkspaceSync } from "./account-workspace-sync";
import {
  resolveWorkspaceOwner,
  shouldExposeModelWorkspace,
} from "../utils/account-workspace";

export function Loading(props: { noLogo?: boolean }) {
  const isInitialLoading = !props.noLogo;

  return (
    <div
      className={clsx(styles["loading-content"], {
        [styles["loading-content-full"]]: isInitialLoading,
        [styles["loading-content-inline"]]: !isInitialLoading,
      })}
      role="status"
      aria-live="polite"
      aria-label="LinChat is loading"
      aria-busy="true"
    >
      {isInitialLoading && (
        <div className={styles["loading-stage"]}>
          <BrandLogo
            className={styles["loading-logo"]}
            width={68}
            height={68}
            alt=""
          />
          <div className={styles["loading-brand"]}>LinChat</div>
          <div className={styles["loading-caption"]}>
            Synchronizing workspace
          </div>
          <LoadingDots />
        </div>
      )}

      {!isInitialLoading && <LoadingDots />}
    </div>
  );
}

function LoadingDots() {
  return (
    <div className={styles["loading-dots"]} aria-hidden="true">
      <span></span>
      <span></span>
      <span></span>
    </div>
  );
}

const Artifacts = dynamic(async () => (await import("./artifacts")).Artifacts, {
  loading: () => <Loading noLogo />,
});

const Settings = dynamic(async () => (await import("./settings")).Settings, {
  loading: () => <Loading noLogo />,
});

const AdminPage = dynamic(async () => (await import("./admin")).AdminPage, {
  loading: () => <Loading noLogo />,
});

const ProfilePage = dynamic(
  async () => (await import("./profile")).ProfilePage,
  { loading: () => <Loading noLogo /> },
);

const WorkspaceHome = dynamic(
  async () => (await import("./workspace-home")).WorkspaceHome,
  { loading: () => <Loading noLogo /> },
);
const Chat = dynamic(async () => (await import("./chat")).Chat, {
  loading: () => <Loading noLogo />,
});

const NewChat = dynamic(async () => (await import("./new-chat")).NewChat, {
  loading: () => <Loading noLogo />,
});

const MaskPage = dynamic(async () => (await import("./mask")).MaskPage, {
  loading: () => <Loading noLogo />,
});

const PluginPage = dynamic(async () => (await import("./plugin")).PluginPage, {
  loading: () => <Loading noLogo />,
});

const SearchChat = dynamic(
  async () => (await import("./search-chat")).SearchChatPage,
  {
    loading: () => <Loading noLogo />,
  },
);

const Sd = dynamic(async () => (await import("./sd")).Sd, {
  loading: () => <Loading noLogo />,
});

const McpMarketPage = dynamic(
  async () => (await import("./mcp-market")).McpMarketPage,
  {
    loading: () => <Loading noLogo />,
  },
);

const CommandPalette = dynamic(
  async () => (await import("./command-palette")).CommandPalette,
  {
    loading: () => null,
  },
);

export function useSwitchTheme() {
  const theme = useAppConfig((state) => state.theme);
  const hasHydrated = useAppConfig((state) => state._hasHydrated);

  useEffect(() => {
    if (!hasHydrated) return;

    document.body.classList.remove("light");
    document.body.classList.remove("dark");

    if (theme === "dark") {
      document.body.classList.add("dark");
    } else if (theme === "light") {
      document.body.classList.add("light");
    }

    safeLocalStorage().setItem(THEME_STORAGE_KEY, theme);

    const metaDescriptionDark = document.querySelector(
      'meta[name="theme-color"][media*="dark"]',
    );
    const metaDescriptionLight = document.querySelector(
      'meta[name="theme-color"][media*="light"]',
    );

    if (theme === "auto") {
      metaDescriptionDark?.setAttribute("content", "#151515");
      metaDescriptionLight?.setAttribute("content", "#fafafa");
    } else {
      const themeColor = getCSSVar("--theme-color");
      metaDescriptionDark?.setAttribute("content", themeColor);
      metaDescriptionLight?.setAttribute("content", themeColor);
    }
  }, [hasHydrated, theme]);
}

function useHtmlLang() {
  useEffect(() => {
    const lang = getISOLang();
    const htmlLang = document.documentElement.lang;

    if (lang !== htmlLang) {
      document.documentElement.lang = lang;
    }
  }, []);
}

const useHasHydrated = () => {
  const [hasHydrated, setHasHydrated] = useState<boolean>(false);

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  return hasHydrated;
};

const loadAsyncGoogleFont = () => {
  const linkEl = document.createElement("link");
  const proxyFontUrl = "/google-fonts";
  const remoteFontUrl = "https://fonts.googleapis.com";
  const googleFontUrl =
    getClientConfig()?.buildMode === "export" ? remoteFontUrl : proxyFontUrl;
  linkEl.rel = "stylesheet";
  linkEl.href =
    googleFontUrl +
    "/css2?family=" +
    encodeURIComponent("Noto Sans:wght@300;400;700;900") +
    "&display=swap";
  document.head.appendChild(linkEl);
};

export function WindowContent(props: {
  children: React.ReactNode;
  fullWidth?: boolean;
}) {
  return (
    <div
      className={clsx(styles["window-content"], {
        [styles["window-content-full"]]: props.fullWidth,
      })}
      id={SlotID.AppBody}
    >
      {props?.children}
    </div>
  );
}

function Screen() {
  const config = useAppConfig();
  const location = useLocation();
  const isArtifact = location.pathname.includes(Path.Artifacts);
  const isHome = location.pathname === Path.Home;
  const isSettings = location.pathname === Path.Settings;
  const isAuth = location.pathname === Path.Auth;
  const isProfile = location.pathname === Path.Profile;
  const isAdmin = location.pathname === Path.Admin;
  const isSd = location.pathname === Path.Sd;
  const isSdNew = location.pathname === Path.SdNew;

  const isMobileScreen = useMobileScreen();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const shouldTightBorder =
    getClientConfig()?.isApp || (config.tightBorder && !isMobileScreen);

  useEffect(() => {
    // The mobile sidebar is an overlay opened from the chat header. Close its
    // transient state whenever navigation leaves the chat route; the home
    // route still controls its own always-visible mobile sidebar state.
    if (!isMobileScreen || location.pathname !== Path.Chat) {
      setMobileSidebarOpen(false);
    }
  }, [isMobileScreen, location.pathname]);

  useEffect(() => {
    loadAsyncGoogleFont();
  }, []);

  // Ctrl+K / Cmd+K to open command palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (isArtifact) {
    return (
      <Routes>
        <Route path="/artifacts/:id" element={<Artifacts />} />
      </Routes>
    );
  }
  const renderContent = () => {
    if (isAuth) return <AuthPage />;
    if (isSd) return <Sd />;
    if (isSdNew) return <Sd />;
    return (
      <>
        {!isSettings && !isAdmin && !isProfile && (
          <SideBar
            className={clsx({
              [styles["sidebar-show"]]: isHome || mobileSidebarOpen,
            })}
            mobileOpen={mobileSidebarOpen}
            onMobileClose={() => setMobileSidebarOpen(false)}
          />
        )}
        <WindowContent fullWidth={isSettings || isAdmin || isProfile}>
          <Routes>
            <Route path={Path.Home} element={<WorkspaceHome />} />
            <Route path={Path.NewChat} element={<NewChat />} />
            <Route path={Path.Masks} element={<MaskPage />} />
            <Route path={Path.Plugins} element={<PluginPage />} />
            <Route path={Path.SearchChat} element={<SearchChat />} />
            <Route
              path={Path.Chat}
              element={
                <Chat onOpenChatList={() => setMobileSidebarOpen(true)} />
              }
            />
            <Route path={Path.Settings} element={<Settings />} />
            <Route path={Path.Profile} element={<ProfilePage />} />
            <Route path={Path.Admin} element={<AdminPage />} />
            <Route path={Path.McpMarket} element={<McpMarketPage />} />
          </Routes>
        </WindowContent>
      </>
    );
  };

  return (
    <div
      className={clsx(styles.container, {
        [styles["tight-container"]]: shouldTightBorder,
        [styles["rtl-screen"]]: getLang() === "ar",
      })}
    >
      {renderContent()}
      <CommandPalette
        show={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
      />
    </div>
  );
}

export function useLoadData() {
  const providerName = useAppConfig((state) => state.modelConfig.providerName);
  const mergeModels = useAppConfig((state) => state.mergeModels);
  const { enabled, loading, modelWorkspaceReady, user } = useAccount();
  const owner = resolveWorkspaceOwner({ enabled, user });
  const canLoadModels = shouldExposeModelWorkspace({
    enabled,
    loading,
    modelWorkspaceReady,
    user,
  });

  useEffect(() => {
    if (!canLoadModels) return;
    let cancelled = false;

    (async () => {
      // Skip server model merge for account guests — AccountWorkspaceSync
      // deliberately clears the catalogue so logged-out visitors cannot use
      // account-provisioned models.
      const api = getClientApi(providerName);
      try {
        const models = await api.llm.models();
        if (!cancelled) mergeModels(models);
      } catch (error) {
        if (!cancelled) {
          console.error("[Models] failed to load provider catalogue", error);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [canLoadModels, mergeModels, owner, providerName]);
}

function AccountModelDataLoader() {
  useLoadData();
  return null;
}

export function Home() {
  useSwitchTheme();
  useHtmlLang();
  const hasHydrated = useHasHydrated();
  const isLoadingPreview =
    typeof window !== "undefined" &&
    (() => {
      const searchParams = new URLSearchParams(window.location.search);
      return searchParams.get("loading-preview") === "1";
    })();

  useEffect(() => {
    console.log("[Config] got config from build time", getClientConfig());

    const initMcp = async () => {
      try {
        const enabled = await isMcpEnabled();
        if (enabled) {
          console.log("[MCP] initializing...");
          await initializeMcpSystem();
          console.log("[MCP] initialized");
        }
      } catch (err) {
        console.error("[MCP] failed to initialize:", err);
      }
    };
    initMcp();
  }, []);

  if (isLoadingPreview || !hasHydrated) {
    return <Loading />;
  }

  return (
    <ErrorBoundary>
      <Router>
        <AccountProvider>
          <AccountWorkspaceSync />
          <AccountModelDataLoader />
          <Screen />
        </AccountProvider>
      </Router>
    </ErrorBoundary>
  );
}
