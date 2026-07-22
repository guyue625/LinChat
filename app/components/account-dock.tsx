"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronUp, LogIn, LogOut, ShieldCheck, UserRound } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { Path } from "../constant";
import { AccountAvatar } from "./account-avatar";
import { useAccount } from "./account-context";
import {
  accountDisplayName,
  buildAuthPath,
  getAccountMenuItems,
} from "./account-utils";
import styles from "./account-dock.module.scss";

export function AccountDock(props: { shouldNarrow: boolean }) {
  const { shouldNarrow } = props;
  const { enabled, loading, logout, user } = useAccount();
  const [open, setOpen] = useState(false);
  const dockRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!dockRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeEscape);
    };
  }, [open]);

  if (loading || !enabled) return null;

  const returnTo = `${location.pathname}${location.search}`;

  if (!user) {
    return (
      <div className={styles.dock} data-narrow={shouldNarrow}>
        <button
          type="button"
          className={styles.login}
          onClick={() => navigate(buildAuthPath(returnTo))}
          title="登录或注册"
        >
          <span className={styles.loginIcon}>
            <LogIn />
          </span>
          {!shouldNarrow && (
            <span className={styles.copy}>
              <strong>登录 / 注册</strong>
              <small>同步你的账号与会话</small>
            </span>
          )}
        </button>
      </div>
    );
  }

  const name = accountDisplayName(user);
  const items = getAccountMenuItems(user);

  return (
    <div ref={dockRef} className={styles.dock} data-narrow={shouldNarrow}>
      {open && (
        <div className={styles.menu} role="menu" aria-label="账号菜单">
          <div className={styles.menuIdentity}>
            <AccountAvatar avatar={user.avatar} name={name} size={38} />
            <span>
              <strong>{name}</strong>
              <small>@{user.username}</small>
            </span>
          </div>
          <div className={styles.divider} />
          {items.includes("profile") && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                navigate(Path.Profile);
              }}
            >
              <UserRound />
              个人资料
            </button>
          )}
          {items.includes("admin") && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                navigate(Path.Admin);
              }}
            >
              <ShieldCheck />
              账号管理
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            className={styles.logout}
            onClick={async () => {
              setOpen(false);
              await logout();
            }}
          >
            <LogOut />
            退出登录
          </button>
        </div>
      )}

      <button
        type="button"
        className={styles.account}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        title={shouldNarrow ? name : undefined}
      >
        <AccountAvatar avatar={user.avatar} name={name} size={38} />
        {!shouldNarrow && (
          <>
            <span className={styles.copy}>
              <strong>{name}</strong>
              <small>
                {user.role === "admin" ? "管理员" : `@${user.username}`}
              </small>
            </span>
            <ChevronUp className={styles.chevron} />
          </>
        )}
      </button>
    </div>
  );
}
