"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Loader2 } from "lucide-react";
import {
  normalizeAccountSession,
  type AccountSnapshot,
  type AccountUserSummary,
} from "./account-utils";
import styles from "./account-context.module.scss";

type AccountContextValue = {
  enabled: boolean;
  loading: boolean;
  loggingOut: boolean;
  user: AccountUserSummary | null;
  refresh: () => Promise<AccountSnapshot>;
  logout: () => Promise<void>;
};

const AccountContext = createContext<AccountContextValue | null>(null);

function LogoutOverlay() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const blockKeys = (event: KeyboardEvent) => {
      // Trap focus / navigation while logout is in flight.
      event.preventDefault();
      event.stopPropagation();
    };
    document.addEventListener("keydown", blockKeys, true);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", blockKeys, true);
    };
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div
      className={styles.logoutOverlay}
      role="alertdialog"
      aria-modal="true"
      aria-busy="true"
      aria-live="assertive"
      aria-labelledby="logout-overlay-title"
      aria-describedby="logout-overlay-hint"
      onContextMenu={(event) => event.preventDefault()}
    >
      <div className={styles.logoutCard}>
        <Loader2 className={styles.logoutSpinner} aria-hidden="true" />
        <p id="logout-overlay-title" className={styles.logoutTitle}>
          正在退出…
        </p>
        <p id="logout-overlay-hint" className={styles.logoutHint}>
          拜拜，期待下次再见
        </p>
      </div>
    </div>,
    document.body,
  );
}

export function AccountProvider(props: { children: React.ReactNode }) {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [user, setUser] = useState<AccountUserSummary | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/account/session", {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!response.ok) throw new Error("账号状态加载失败");
      const next = normalizeAccountSession(await response.json());
      setEnabled(next.enabled);
      setUser(next.user);
      return next;
    } catch {
      const next = { enabled: false, user: null };
      setEnabled(next.enabled);
      setUser(null);
      return next;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await fetch("/api/account/logout", {
        method: "POST",
        credentials: "same-origin",
      });
    } finally {
      // Always clear local session so UI recovers even if the request fails.
      setUser(null);
      setLoggingOut(false);
    }
  }, [loggingOut]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({ enabled, loading, loggingOut, user, refresh, logout }),
    [enabled, loading, loggingOut, logout, refresh, user],
  );

  return (
    <AccountContext.Provider value={value}>
      {props.children}
      {loggingOut && <LogoutOverlay />}
    </AccountContext.Provider>
  );
}

export function useAccount() {
  const value = useContext(AccountContext);
  if (!value) {
    throw new Error("useAccount must be used inside AccountProvider");
  }
  return value;
}
