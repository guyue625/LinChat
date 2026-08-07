"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  ArrowLeft,
  Ban,
  Check,
  Clipboard,
  Database,
  KeyRound,
  Loader2,
  LogOut,
  RefreshCw,
  Search,
  ServerCog,
  ShieldCheck,
  Ticket,
  Trash2,
  UserCog,
  Users,
  X,
} from "lucide-react";
import { Path } from "../constant";
import styles from "./admin.module.scss";
import {
  formatStorageSize,
  invitationStatus,
  matchesUserSearch,
} from "./admin-utils";
import { useAccount } from "./account-context";
import { buildAuthPath } from "./account-utils";
import { AdminProviders } from "./admin-providers";

interface AdminUser {
  id: string;
  username: string;
  displayName?: string;
  avatar?: string;
  role: "user" | "admin";
  disabled: boolean;
  createdAt: string;
  lastLoginAt?: string;
}

interface AdminInvitation {
  id: string;
  codeHint?: string;
  label?: string;
  createdAt: string;
  createdByUserId?: string;
  expiresAt?: string;
  maxUses: number;
  usedCount: number;
  disabled: boolean;
}

interface AdminAuditLog {
  id: string;
  action: string;
  createdAt: string;
  actorUserId?: string;
  actorUsername?: string;
  targetUserId?: string;
  targetInvitationId?: string;
  metadata?: Record<string, string | number | boolean | null>;
}

interface AdminDashboardData {
  stats: {
    totalUsers: number;
    activeUsers: number;
    disabledUsers: number;
    adminUsers: number;
    activeSessions: number;
    invitations: number;
    usableInvitations: number;
    storageBytes: number;
  };
  users: AdminUser[];
  invitations: AdminInvitation[];
  auditLogs: AdminAuditLog[];
}

type AdminTab = "overview" | "users" | "invitations" | "providers" | "audit";

const ACTION_LABELS: Record<string, string> = {
  INITIAL_ADMIN_CREATED: "初始化管理员",
  USER_REGISTERED: "用户注册",
  LOGIN_SUCCESS: "登录成功",
  LOGIN_FAILED: "登录失败",
  LOGIN_BLOCKED: "阻止禁用账号登录",
  LOGOUT: "退出登录",
  INVITATION_CREATED: "生成邀请码",
  INVITATION_REVOKED: "吊销邀请码",
  INVITATION_RESTORED: "恢复邀请码",
  USER_PROFILE_UPDATED: "修改用户资料",
  USER_ROLE_UPDATED: "修改用户角色",
  USER_DISABLED: "禁用账号",
  USER_RESTORED: "恢复账号",
  PASSWORD_RESET_CREATED: "生成重置凭证",
  PASSWORD_RESET_USED: "使用重置凭证",
  USER_DELETED: "删除账号",
  PROVIDER_CONFIG_UPDATED: "更新模型服务商配置",
  PROVIDER_CONFIG_DELETED: "恢复模型服务商环境变量配置",
};

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: "same-origin",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "请求失败");
  return data as T;
}

function formatDate(value?: string) {
  if (!value) return "从未";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function userName(user: AdminUser) {
  return user.displayName || user.username;
}

export function AdminPage() {
  const navigate = useNavigate();
  const {
    enabled,
    loading: accountLoading,
    loggingOut,
    logout: logoutAccount,
    user,
  } = useAccount();
  const [tab, setTab] = useState<AdminTab>("overview");
  const [dashboard, setDashboard] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [workingId, setWorkingId] = useState("");
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [deletingUser, setDeletingUser] = useState<AdminUser | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [secret, setSecret] = useState<{
    title: string;
    value: string;
    note: string;
  } | null>(null);
  const [inviteForm, setInviteForm] = useState({
    label: "",
    maxUses: 1,
    expiresAt: "",
  });

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setDashboard(
        await requestJson<AdminDashboardData>("/api/account/admin/dashboard"),
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "加载失败",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (accountLoading) return;
    if (!enabled) {
      navigate(Path.Home, { replace: true });
      return;
    }
    if (!user) {
      navigate(buildAuthPath(Path.Admin), { replace: true });
      return;
    }
    if (user.role !== "admin") {
      navigate(Path.Home, { replace: true });
      return;
    }
    void loadDashboard();
  }, [accountLoading, enabled, loadDashboard, navigate, user]);

  const filteredUsers = useMemo(
    () =>
      dashboard?.users.filter((user) => matchesUserSearch(user, query)) ?? [],
    [dashboard?.users, query],
  );

  const runAction = async (id: string, action: () => Promise<void>) => {
    setWorkingId(id);
    setError("");
    try {
      await action();
      await loadDashboard();
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "操作失败",
      );
    } finally {
      setWorkingId("");
    }
  };

  const createInvitation = async (event: React.FormEvent) => {
    event.preventDefault();
    await runAction("create-invitation", async () => {
      const result = await requestJson<{
        code: string;
        invitation: AdminInvitation;
      }>("/api/account/admin/invitations", {
        method: "POST",
        body: JSON.stringify({
          label: inviteForm.label,
          maxUses: inviteForm.maxUses,
          expiresAt: inviteForm.expiresAt
            ? new Date(inviteForm.expiresAt).toISOString()
            : undefined,
        }),
      });
      setSecret({
        title: "邀请码已生成",
        value: result.code,
        note: "系统只展示这一次，请立即复制给需要注册的用户。",
      });
      setInviteForm({ label: "", maxUses: 1, expiresAt: "" });
    });
  };

  const patchUser = async (
    user: AdminUser,
    patch: Partial<
      Pick<AdminUser, "displayName" | "avatar" | "role" | "disabled">
    >,
  ) => {
    await runAction(user.id, async () => {
      await requestJson(`/api/account/admin/users/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      setEditingUser(null);
    });
  };

  const createReset = async (user: AdminUser) => {
    await runAction(`reset-${user.id}`, async () => {
      const result = await requestJson<{ token: string; expiresAt: string }>(
        `/api/account/admin/users/${user.id}/reset`,
        { method: "POST", body: "{}" },
      );
      setSecret({
        title: `${userName(user)} 的密码重置凭证`,
        value: result.token,
        note: `凭证将在 ${formatDate(result.expiresAt)} 失效，且只能使用一次。`,
      });
    });
  };

  const deleteUser = async () => {
    if (!deletingUser) return;
    await runAction(`delete-${deletingUser.id}`, async () => {
      await requestJson(`/api/account/admin/users/${deletingUser.id}`, {
        method: "DELETE",
        body: JSON.stringify({ confirmation: deleteConfirmation }),
      });
      setDeletingUser(null);
      setDeleteConfirmation("");
    });
  };

  const copySecret = async () => {
    if (!secret) return;
    await navigator.clipboard.writeText(secret.value);
  };

  const logoutFromAdmin = async () => {
    if (loggingOut) return;
    await logoutAccount();
    navigate(Path.Auth);
  };

  if (
    accountLoading ||
    !enabled ||
    !user ||
    user.role !== "admin" ||
    (loading && !dashboard)
  ) {
    return (
      <main className={styles.page}>
        <div className={styles.loading}>
          <ShieldCheck />
          <span>正在读取管理数据…</span>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <button type="button" onClick={() => navigate(Path.Home)}>
            <ArrowLeft />
          </button>
          <div className={styles.mark}>
            <ShieldCheck />
          </div>
          <div>
            <span>ACCOUNT CONTROL</span>
            <h1>账号管理中心</h1>
          </div>
        </div>
        <div className={styles.headerActions}>
          <button type="button" onClick={loadDashboard} disabled={loading}>
            <RefreshCw className={loading ? styles.spinning : undefined} />
            刷新
          </button>
          <button
            type="button"
            onClick={logoutFromAdmin}
            disabled={loggingOut}
            aria-busy={loggingOut}
          >
            {loggingOut ? (
              <Loader2 className={styles.spinning} aria-hidden="true" />
            ) : (
              <LogOut />
            )}
            {loggingOut ? "正在退出…" : "退出"}
          </button>
        </div>
      </header>

      <nav className={styles.tabs} aria-label="管理员功能">
        {(
          [
            ["overview", "总览", Activity],
            ["users", "用户", Users],
            ["invitations", "邀请码", Ticket],
            ["providers", "模型服务商", ServerCog],
            ["audit", "审计", Database],
          ] as const
        ).map(([value, label, Icon]) => (
          <button
            key={value}
            type="button"
            data-active={tab === value}
            onClick={() => setTab(value)}
          >
            <Icon />
            {label}
          </button>
        ))}
      </nav>

      {error && (
        <div className={styles.error} role="alert">
          <Ban />
          <span>{error}</span>
          <button type="button" onClick={() => setError("")}>
            <X />
          </button>
        </div>
      )}

      {dashboard && tab === "overview" && (
        <section className={styles.overview}>
          <div className={styles.statsGrid}>
            <StatCard
              icon={<Users />}
              label="用户总数"
              value={dashboard.stats.totalUsers}
              detail={`${dashboard.stats.activeUsers} 个可用账号`}
            />
            <StatCard
              icon={<Activity />}
              label="活跃会话"
              value={dashboard.stats.activeSessions}
              detail="仅统计数量，不读取会话内容"
            />
            <StatCard
              icon={<Ticket />}
              label="可用邀请码"
              value={dashboard.stats.usableInvitations}
              detail={`共生成 ${dashboard.stats.invitations} 个`}
            />
            <StatCard
              icon={<Database />}
              label="账号数据"
              value={formatStorageSize(dashboard.stats.storageBytes)}
              detail="不包含聊天记录和 API Key"
            />
          </div>

          <div className={styles.overviewColumns}>
            <article className={styles.panel}>
              <div className={styles.panelHeading}>
                <div>
                  <span>SECURITY BOUNDARY</span>
                  <h2>权限边界</h2>
                </div>
                <ShieldCheck />
              </div>
              <ul className={styles.boundaries}>
                <li>
                  <Check />
                  管理员无法查看用户密码原文
                </li>
                <li>
                  <Check />
                  管理员无法读取或冒充用户会话
                </li>
                <li>
                  <Check />
                  页面不查询用户 API Key 与聊天内容
                </li>
                <li>
                  <Check />
                  邀请码和重置凭证仅生成时显示一次
                </li>
              </ul>
            </article>

            <article className={styles.panel}>
              <div className={styles.panelHeading}>
                <div>
                  <span>RECENT EVENTS</span>
                  <h2>最近安全事件</h2>
                </div>
                <button type="button" onClick={() => setTab("audit")}>
                  查看全部
                </button>
              </div>
              <div className={styles.eventList}>
                {dashboard.auditLogs.slice(0, 6).map((log) => (
                  <AuditRow key={log.id} log={log} />
                ))}
                {dashboard.auditLogs.length === 0 && (
                  <div className={styles.empty}>暂无安全事件</div>
                )}
              </div>
            </article>
          </div>
        </section>
      )}

      {dashboard && tab === "users" && (
        <section className={styles.panel}>
          <div className={styles.panelHeading}>
            <div>
              <span>USER DIRECTORY</span>
              <h2>用户账号</h2>
            </div>
            <label className={styles.search}>
              <Search />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索用户名或显示名称"
              />
            </label>
          </div>
          <div className={styles.userList}>
            {filteredUsers.map((user) => (
              <article className={styles.userCard} key={user.id}>
                <div className={styles.avatar}>
                  {user.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.avatar} alt="" />
                  ) : (
                    userName(user).slice(0, 1).toUpperCase()
                  )}
                </div>
                <div className={styles.userIdentity}>
                  <strong>{userName(user)}</strong>
                  <span>@{user.username}</span>
                </div>
                <div className={styles.userMeta}>
                  <span>注册于 {formatDate(user.createdAt)}</span>
                  <span>最近登录 {formatDate(user.lastLoginAt)}</span>
                </div>
                <div className={styles.badges}>
                  <span
                    data-tone={user.role === "admin" ? "accent" : "neutral"}
                  >
                    {user.role === "admin" ? "管理员" : "用户"}
                  </span>
                  <span data-tone={user.disabled ? "danger" : "success"}>
                    {user.disabled ? "已禁用" : "正常"}
                  </span>
                </div>
                <div className={styles.userActions}>
                  <button type="button" onClick={() => setEditingUser(user)}>
                    <UserCog />
                    编辑
                  </button>
                  <button
                    type="button"
                    disabled={workingId === user.id}
                    onClick={() =>
                      patchUser(user, { disabled: !user.disabled })
                    }
                  >
                    {user.disabled ? <Check /> : <Ban />}
                    {user.disabled ? "恢复" : "禁用"}
                  </button>
                  <button
                    type="button"
                    disabled={workingId === `reset-${user.id}`}
                    onClick={() => createReset(user)}
                  >
                    <KeyRound />
                    重置密码
                  </button>
                  <button
                    type="button"
                    className={styles.dangerButton}
                    onClick={() => {
                      setDeletingUser(user);
                      setDeleteConfirmation("");
                    }}
                  >
                    <Trash2 />
                    删除
                  </button>
                </div>
              </article>
            ))}
            {filteredUsers.length === 0 && (
              <div className={styles.empty}>没有符合条件的用户</div>
            )}
          </div>
        </section>
      )}

      {dashboard && tab === "invitations" && (
        <section className={styles.invitationLayout}>
          <form className={styles.panel} onSubmit={createInvitation}>
            <div className={styles.panelHeading}>
              <div>
                <span>ISSUE ACCESS</span>
                <h2>生成邀请码</h2>
              </div>
              <Ticket />
            </div>
            <div className={styles.formGrid}>
              <label>
                <span>用途备注</span>
                <input
                  value={inviteForm.label}
                  onChange={(event) =>
                    setInviteForm((value) => ({
                      ...value,
                      label: event.target.value,
                    }))
                  }
                  placeholder="例如：产品内测"
                  maxLength={64}
                />
              </label>
              <label>
                <span>可使用次数</span>
                <input
                  type="number"
                  min={1}
                  max={10000}
                  value={inviteForm.maxUses}
                  onChange={(event) =>
                    setInviteForm((value) => ({
                      ...value,
                      maxUses: Number(event.target.value),
                    }))
                  }
                />
              </label>
              <label>
                <span>失效时间（可选）</span>
                <input
                  type="datetime-local"
                  value={inviteForm.expiresAt}
                  onChange={(event) =>
                    setInviteForm((value) => ({
                      ...value,
                      expiresAt: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
            <button
              className={styles.primaryButton}
              type="submit"
              disabled={workingId === "create-invitation"}
            >
              <Ticket />
              {workingId === "create-invitation" ? "正在生成…" : "生成邀请码"}
            </button>
          </form>

          <div className={styles.panel}>
            <div className={styles.panelHeading}>
              <div>
                <span>INVITATION LEDGER</span>
                <h2>邀请码记录</h2>
              </div>
              <strong>{dashboard.invitations.length}</strong>
            </div>
            <div className={styles.invitationList}>
              {dashboard.invitations.map((invitation) => {
                const status = invitationStatus(invitation);
                return (
                  <article
                    key={invitation.id}
                    className={styles.invitationCard}
                  >
                    <div>
                      <strong>{invitation.label || "未命名邀请码"}</strong>
                      <code>{invitation.codeHint || "已加密保存"}</code>
                    </div>
                    <div className={styles.invitationMeta}>
                      <span>
                        {invitation.usedCount}/{invitation.maxUses} 次
                      </span>
                      <span>
                        {invitation.expiresAt
                          ? formatDate(invitation.expiresAt)
                          : "长期有效"}
                      </span>
                    </div>
                    <span className={styles.status} data-status={status}>
                      {status === "active"
                        ? "可用"
                        : status === "revoked"
                        ? "已吊销"
                        : status === "expired"
                        ? "已过期"
                        : "次数耗尽"}
                    </span>
                    <button
                      type="button"
                      disabled={workingId === invitation.id}
                      onClick={() =>
                        runAction(invitation.id, async () => {
                          await requestJson(
                            `/api/account/admin/invitations/${invitation.id}`,
                            {
                              method: "PATCH",
                              body: JSON.stringify({
                                disabled: !invitation.disabled,
                              }),
                            },
                          );
                        })
                      }
                    >
                      {invitation.disabled ? "恢复" : "吊销"}
                    </button>
                  </article>
                );
              })}
              {dashboard.invitations.length === 0 && (
                <div className={styles.empty}>尚未生成邀请码</div>
              )}
            </div>
          </div>
        </section>
      )}

      {dashboard && tab === "audit" && (
        <section className={styles.panel}>
          <div className={styles.panelHeading}>
            <div>
              <span>SECURITY AUDIT</span>
              <h2>安全审计记录</h2>
            </div>
            <Activity />
          </div>
          <div className={styles.auditList}>
            {dashboard.auditLogs.map((log) => (
              <AuditRow key={log.id} log={log} detailed />
            ))}
            {dashboard.auditLogs.length === 0 && (
              <div className={styles.empty}>暂无审计记录</div>
            )}
          </div>
        </section>
      )}

      {dashboard && tab === "providers" && <AdminProviders />}

      {editingUser && (
        <div className={styles.modalBackdrop} role="presentation">
          <div className={styles.modal} role="dialog" aria-modal="true">
            <div className={styles.modalHeading}>
              <div>
                <span>EDIT ACCOUNT</span>
                <h2>编辑 @{editingUser.username}</h2>
              </div>
              <button type="button" onClick={() => setEditingUser(null)}>
                <X />
              </button>
            </div>
            <label>
              <span>显示名称</span>
              <input
                value={editingUser.displayName ?? ""}
                onChange={(event) =>
                  setEditingUser({
                    ...editingUser,
                    displayName: event.target.value,
                  })
                }
                maxLength={64}
              />
            </label>
            <label>
              <span>头像地址</span>
              <input
                value={editingUser.avatar ?? ""}
                onChange={(event) =>
                  setEditingUser({ ...editingUser, avatar: event.target.value })
                }
                placeholder="https://…"
              />
            </label>
            <label>
              <span>账号角色</span>
              <select
                value={editingUser.role}
                onChange={(event) =>
                  setEditingUser({
                    ...editingUser,
                    role: event.target.value as "user" | "admin",
                  })
                }
              >
                <option value="user">用户</option>
                <option value="admin">管理员</option>
              </select>
            </label>
            <button
              type="button"
              className={styles.primaryButton}
              disabled={workingId === editingUser.id}
              onClick={() =>
                patchUser(editingUser, {
                  displayName: editingUser.displayName ?? "",
                  avatar: editingUser.avatar ?? "",
                  role: editingUser.role,
                })
              }
            >
              <Check />
              保存修改
            </button>
          </div>
        </div>
      )}

      {deletingUser && (
        <div className={styles.modalBackdrop} role="presentation">
          <div className={styles.modal} role="dialog" aria-modal="true">
            <div className={styles.modalHeading}>
              <div>
                <span>DANGER ZONE</span>
                <h2>删除 @{deletingUser.username}</h2>
              </div>
              <button type="button" onClick={() => setDeletingUser(null)}>
                <X />
              </button>
            </div>
            <p className={styles.warning}>
              删除后会清理该账号、登录会话和未使用的重置凭证。安全审计记录会保留。
            </p>
            <label>
              <span>
                输入用户名 <strong>{deletingUser.username}</strong> 确认
              </span>
              <input
                autoFocus
                value={deleteConfirmation}
                onChange={(event) => setDeleteConfirmation(event.target.value)}
              />
            </label>
            <button
              type="button"
              className={styles.deleteConfirm}
              disabled={
                deleteConfirmation.toLowerCase() !== deletingUser.username ||
                workingId === `delete-${deletingUser.id}`
              }
              onClick={deleteUser}
            >
              <Trash2 />
              永久删除账号
            </button>
          </div>
        </div>
      )}

      {secret && (
        <div className={styles.modalBackdrop} role="presentation">
          <div className={styles.modal} role="dialog" aria-modal="true">
            <div className={styles.modalHeading}>
              <div>
                <span>ONE-TIME SECRET</span>
                <h2>{secret.title}</h2>
              </div>
              <button type="button" onClick={() => setSecret(null)}>
                <X />
              </button>
            </div>
            <p>{secret.note}</p>
            <div className={styles.secretValue}>
              <code>{secret.value}</code>
              <button type="button" onClick={copySecret}>
                <Clipboard />
                复制
              </button>
            </div>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => setSecret(null)}
            >
              我已安全保存
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

function StatCard(props: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  detail: string;
}) {
  return (
    <article className={styles.statCard}>
      <div>{props.icon}</div>
      <span>{props.label}</span>
      <strong>{props.value}</strong>
      <small>{props.detail}</small>
    </article>
  );
}

function AuditRow(props: { log: AdminAuditLog; detailed?: boolean }) {
  return (
    <article className={styles.auditRow}>
      <div className={styles.auditIcon}>
        <Activity />
      </div>
      <div>
        <strong>{ACTION_LABELS[props.log.action] || props.log.action}</strong>
        <span>
          {props.log.actorUsername
            ? `由 @${props.log.actorUsername} 操作`
            : "系统事件"}
        </span>
        {props.detailed && props.log.metadata && (
          <code>{JSON.stringify(props.log.metadata)}</code>
        )}
      </div>
      <time>{formatDate(props.log.createdAt)}</time>
    </article>
  );
}
