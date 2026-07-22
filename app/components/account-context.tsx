"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  normalizeAccountSession,
  type AccountSnapshot,
  type AccountUserSummary,
} from "./account-utils";

type AccountContextValue = {
  enabled: boolean;
  loading: boolean;
  user: AccountUserSummary | null;
  refresh: () => Promise<AccountSnapshot>;
  logout: () => Promise<void>;
};

const AccountContext = createContext<AccountContextValue | null>(null);

export function AccountProvider(props: { children: React.ReactNode }) {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
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
    await fetch("/api/account/logout", {
      method: "POST",
      credentials: "same-origin",
    });
    setUser(null);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({ enabled, loading, user, refresh, logout }),
    [enabled, loading, logout, refresh, user],
  );

  return (
    <AccountContext.Provider value={value}>
      {props.children}
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
