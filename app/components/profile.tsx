"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Image as ImageIcon,
  UserRound,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Path } from "../constant";
import { AccountAvatar } from "./account-avatar";
import { useAccount } from "./account-context";
import { accountDisplayName, buildAuthPath } from "./account-utils";
import styles from "./profile.module.scss";

export function ProfilePage() {
  const navigate = useNavigate();
  const { enabled, loading, refresh, user } = useAccount();
  const [displayName, setDisplayName] = useState("");
  const [avatar, setAvatar] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (loading) return;
    if (!enabled) {
      navigate(Path.Home, { replace: true });
    } else if (!user) {
      navigate(buildAuthPath(Path.Profile), { replace: true });
    }
  }, [enabled, loading, navigate, user]);

  useEffect(() => {
    if (!user) return;
    setDisplayName(user.displayName ?? "");
    setAvatar(user.avatar ?? "");
  }, [user]);

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/account/profile", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, avatar }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "保存失败");
      await refresh();
      setSuccess("个人资料已更新");
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "保存失败",
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading || !user) {
    return <main className={styles.page}>正在加载个人资料…</main>;
  }

  const name = accountDisplayName(user);

  return (
    <main className={styles.page}>
      <div className={styles.backdrop} aria-hidden="true" />
      <header className={styles.header}>
        <button type="button" onClick={() => navigate(Path.Home)}>
          <ArrowLeft />
          返回工作台
        </button>
        <span>ACCOUNT PROFILE</span>
      </header>

      <section className={styles.card}>
        <div className={styles.identity}>
          <AccountAvatar
            avatar={avatar}
            name={name}
            size={88}
            className={styles.avatar}
          />
          <div>
            <span>{user.role === "admin" ? "管理员账号" : "个人账号"}</span>
            <h1>{name}</h1>
            <p>@{user.username}</p>
          </div>
        </div>

        <form className={styles.form} onSubmit={saveProfile}>
          <div className={styles.readonlyRow}>
            <UserRound />
            <div>
              <span>用户名</span>
              <strong>{user.username}</strong>
            </div>
            <small>注册后不可修改</small>
          </div>

          <label>
            <span>显示名称</span>
            <input
              value={displayName}
              maxLength={64}
              onChange={(event) => setDisplayName(event.currentTarget.value)}
              placeholder={user.username}
            />
            <small>显示在侧边栏账号区，最多 64 个字符。</small>
          </label>

          <label>
            <span>头像图片 URL</span>
            <div className={styles.inputWithIcon}>
              <ImageIcon />
              <input
                type="url"
                value={avatar}
                maxLength={500}
                onChange={(event) => setAvatar(event.currentTarget.value)}
                placeholder="https://example.com/avatar.png"
              />
            </div>
            <small>留空时使用用户名首字母作为头像。</small>
          </label>

          {error && <div className={styles.error}>{error}</div>}
          {success && (
            <div className={styles.success}>
              <CheckCircle2 />
              {success}
            </div>
          )}

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.secondary}
              onClick={() => navigate(Path.Home)}
            >
              取消
            </button>
            <button type="submit" disabled={saving}>
              {saving ? "保存中…" : "保存资料"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
