"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Check,
  KeyRound,
  Loader2,
  Pencil,
  Power,
  RefreshCw,
  RotateCcw,
  Save,
  ServerCog,
  X,
} from "lucide-react";
import { Path } from "../constant";
import styles from "./admin-providers.module.scss";

type SecretSource = "database" | "environment" | "none";
type ProviderModel = { name: string; alias?: string };

type AdminProvider = {
  id: string;
  providerName: string;
  label: string;
  configured: boolean;
  enabled: boolean;
  baseUrl: string | null;
  hasApiKey: boolean;
  hasApiSecret: boolean;
  apiKeySource: SecretSource;
  apiSecretSource: SecretSource;
  options: Record<string, string>;
  overrides: {
    baseUrl: string | null;
    options: Record<string, string>;
  };
  models: ProviderModel[] | null;
  updatedAt: string | null;
  capabilities: {
    supportsApiKey: boolean;
    supportsApiSecret: boolean;
    apiKeyLabel: string;
    apiSecretLabel: string | null;
    options: Array<{ key: string; label: string }>;
  };
};

type ProviderDraft = {
  provider: AdminProvider;
  label: string;
  enabled: boolean;
  baseUrl: string;
  apiKey: string;
  apiSecret: string;
  clearApiKey: boolean;
  clearApiSecret: boolean;
  options: Record<string, string>;
  inheritModels: boolean;
  modelText: string;
};

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: "same-origin",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const data = (await response.json()) as { error?: string };
  if (!response.ok) {
    throw new HttpError(response.status, data.error || "请求失败");
  }
  return data as T;
}

function modelsToText(models: ProviderModel[] | null) {
  return (models ?? [])
    .map((model) => `${model.name}${model.alias ? ` = ${model.alias}` : ""}`)
    .join("\n");
}

function textToModels(value: string): ProviderModel[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, alias = ""] = line.split(/=(.*)/s);
      return alias.trim()
        ? { name: name.trim(), alias: alias.trim() }
        : { name: name.trim() };
    });
}

function secretSourceLabel(source: SecretSource) {
  if (source === "database") return "数据库密钥";
  if (source === "environment") return "环境变量密钥";
  return "未设置";
}

function formatDate(value: string | null) {
  if (!value) return "尚未覆盖";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function AdminProviders() {
  const navigate = useNavigate();
  const [providers, setProviders] = useState<AdminProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState("");
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<ProviderDraft | null>(null);

  const handleRequestError = useCallback(
    (requestError: unknown) => {
      if (requestError instanceof HttpError) {
        if (requestError.status === 401) return navigate(Path.Auth);
        if (requestError.status === 403) return navigate(Path.Home);
      }
      setError(
        requestError instanceof Error ? requestError.message : "请求失败",
      );
    },
    [navigate],
  );

  const loadProviders = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await requestJson<{ providers: AdminProvider[] }>(
        "/api/account/admin/providers",
      );
      setProviders(data.providers);
    } catch (requestError) {
      handleRequestError(requestError);
    } finally {
      setLoading(false);
    }
  }, [handleRequestError]);

  useEffect(() => {
    void loadProviders();
  }, [loadProviders]);

  const configuredCount = useMemo(
    () => providers.filter((provider) => provider.configured).length,
    [providers],
  );

  const openEditor = (provider: AdminProvider) => {
    setEditing({
      provider,
      label: provider.label,
      enabled: provider.enabled,
      baseUrl: provider.overrides.baseUrl ?? "",
      apiKey: "",
      apiSecret: "",
      clearApiKey: false,
      clearApiSecret: false,
      options: { ...provider.overrides.options },
      inheritModels: provider.models === null,
      modelText: modelsToText(provider.models),
    });
  };

  const saveProvider = async (event: FormEvent) => {
    event.preventDefault();
    if (!editing || workingId) return;
    const body: Record<string, unknown> = {
      label: editing.label,
      enabled: editing.enabled,
      baseUrl: editing.baseUrl || null,
      options: editing.options,
      models: editing.inheritModels ? null : textToModels(editing.modelText),
    };
    if (editing.apiKey) body.apiKey = editing.apiKey;
    if (editing.apiSecret) body.apiSecret = editing.apiSecret;
    if (editing.clearApiKey) body.clearApiKey = true;
    if (editing.clearApiSecret) body.clearApiSecret = true;

    setWorkingId(editing.provider.id);
    setError("");
    try {
      await requestJson(`/api/account/admin/providers/${editing.provider.id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      setEditing(null);
      await loadProviders();
    } catch (requestError) {
      handleRequestError(requestError);
    } finally {
      setWorkingId("");
    }
  };

  const restoreProvider = async (provider: AdminProvider) => {
    if (
      !provider.configured ||
      !window.confirm(
        `恢复 ${provider.label} 的环境变量配置？数据库覆盖将被移除。`,
      )
    ) {
      return;
    }
    setWorkingId(provider.id);
    setError("");
    try {
      await requestJson(`/api/account/admin/providers/${provider.id}`, {
        method: "DELETE",
      });
      await loadProviders();
    } catch (requestError) {
      handleRequestError(requestError);
    } finally {
      setWorkingId("");
    }
  };

  return (
    <section className={styles.workspace}>
      <header className={styles.summary}>
        <div>
          <span>MODEL ROUTING MATRIX</span>
          <h2>模型服务商</h2>
          <p>数据库配置覆盖环境变量；密钥保存后不会再次显示。</p>
        </div>
        <div className={styles.summaryActions}>
          <strong>
            {configuredCount}
            <small> / {providers.length} 已覆盖</small>
          </strong>
          <button type="button" onClick={loadProviders} disabled={loading}>
            <RefreshCw className={loading ? styles.spinning : undefined} />
            刷新
          </button>
        </div>
      </header>

      {error && (
        <div className={styles.error} role="alert">
          <Power />
          <span>{error}</span>
          <button type="button" onClick={() => setError("")}>
            <X />
          </button>
        </div>
      )}

      {loading && providers.length === 0 ? (
        <div className={styles.loading}>
          <Loader2 className={styles.spinning} />
          正在读取服务商配置…
        </div>
      ) : (
        <div className={styles.grid}>
          {providers.map((provider, index) => (
            <article
              key={provider.id}
              className={styles.card}
              data-enabled={provider.enabled}
              style={{ animationDelay: `${Math.min(index, 8) * 35}ms` }}
            >
              <div className={styles.cardTop}>
                <div className={styles.providerMark}>
                  <ServerCog />
                </div>
                <div>
                  <span>{provider.providerName}</span>
                  <h3>{provider.label}</h3>
                </div>
                <span className={styles.state}>
                  {provider.enabled ? "已启用" : "已禁用"}
                </span>
              </div>

              <div className={styles.sourceLine}>
                <span data-database={provider.configured}>
                  {provider.configured ? "数据库覆盖" : "继承环境变量"}
                </span>
                <time>{formatDate(provider.updatedAt)}</time>
              </div>
              <code className={styles.endpoint}>
                {provider.baseUrl || "使用内置默认地址"}
              </code>

              <div className={styles.facts}>
                {provider.capabilities.supportsApiKey && (
                  <div>
                    <KeyRound />
                    <span>
                      {provider.capabilities.apiKeyLabel}{" "}
                      {provider.hasApiKey ? "已设置" : "未设置"}
                    </span>
                    <small>{secretSourceLabel(provider.apiKeySource)}</small>
                  </div>
                )}
                <div>
                  <Check />
                  <span>
                    {provider.models === null
                      ? "继承模型列表"
                      : `${provider.models.length} 个模型`}
                  </span>
                </div>
              </div>

              <div className={styles.cardActions}>
                <button
                  type="button"
                  aria-label={`编辑 ${provider.label}`}
                  onClick={() => openEditor(provider)}
                >
                  <Pencil />
                  编辑
                </button>
                {provider.configured && (
                  <button
                    type="button"
                    aria-label={`恢复 ${provider.label}的环境变量配置`}
                    disabled={workingId === provider.id}
                    onClick={() => restoreProvider(provider)}
                  >
                    <RotateCcw />
                    恢复环境变量
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {editing && (
        <div className={styles.modalBackdrop} role="presentation">
          <form
            className={styles.editor}
            role="dialog"
            aria-modal="true"
            aria-label={`编辑 ${editing.provider.label}`}
            onSubmit={saveProvider}
          >
            <header>
              <div>
                <span>PROVIDER OVERRIDE</span>
                <h2>{editing.provider.label}</h2>
              </div>
              <button type="button" onClick={() => setEditing(null)}>
                <X />
              </button>
            </header>

            <div className={styles.formGrid}>
              <label>
                <span>显示名称</span>
                <input
                  value={editing.label}
                  maxLength={64}
                  onChange={(event) =>
                    setEditing({ ...editing, label: event.target.value })
                  }
                />
              </label>
              <label className={styles.switchLabel}>
                <span>运行状态</span>
                <input
                  type="checkbox"
                  checked={editing.enabled}
                  onChange={(event) =>
                    setEditing({ ...editing, enabled: event.target.checked })
                  }
                />
                <strong>{editing.enabled ? "启用" : "禁用"}</strong>
              </label>
              <label className={styles.wide}>
                <span>Base URL</span>
                <input
                  value={editing.baseUrl}
                  placeholder="留空则回退环境变量或内置地址"
                  onChange={(event) =>
                    setEditing({ ...editing, baseUrl: event.target.value })
                  }
                />
              </label>

              {editing.provider.capabilities.supportsApiKey && (
                <SecretField
                  label={editing.provider.capabilities.apiKeyLabel}
                  value={editing.apiKey}
                  clear={editing.clearApiKey}
                  hasSecret={editing.provider.hasApiKey}
                  onValue={(apiKey) => setEditing({ ...editing, apiKey })}
                  onClear={(clearApiKey) =>
                    setEditing({
                      ...editing,
                      clearApiKey,
                      apiKey: clearApiKey ? "" : editing.apiKey,
                    })
                  }
                />
              )}
              {editing.provider.capabilities.supportsApiSecret && (
                <SecretField
                  label={
                    editing.provider.capabilities.apiSecretLabel || "API Secret"
                  }
                  value={editing.apiSecret}
                  clear={editing.clearApiSecret}
                  hasSecret={editing.provider.hasApiSecret}
                  onValue={(apiSecret) => setEditing({ ...editing, apiSecret })}
                  onClear={(clearApiSecret) =>
                    setEditing({
                      ...editing,
                      clearApiSecret,
                      apiSecret: clearApiSecret ? "" : editing.apiSecret,
                    })
                  }
                />
              )}

              {editing.provider.capabilities.options.map((option) => (
                <label key={option.key}>
                  <span>{option.label}</span>
                  <input
                    value={editing.options[option.key] ?? ""}
                    onChange={(event) =>
                      setEditing({
                        ...editing,
                        options: {
                          ...editing.options,
                          [option.key]: event.target.value,
                        },
                      })
                    }
                  />
                </label>
              ))}

              <div className={`${styles.wide} ${styles.modelField}`}>
                <div className={styles.modelHeading}>
                  <span>模型列表</span>
                  <label className={styles.inheritModels}>
                    <input
                      type="checkbox"
                      checked={editing.inheritModels}
                      onChange={(event) =>
                        setEditing({
                          ...editing,
                          inheritModels: event.target.checked,
                        })
                      }
                    />
                    继承环境变量和内置模型
                  </label>
                </div>
                <textarea
                  value={editing.modelText}
                  disabled={editing.inheritModels}
                  placeholder={"每行一个模型\nmodel-name = 可选显示名"}
                  onChange={(event) =>
                    setEditing({ ...editing, modelText: event.target.value })
                  }
                />
              </div>
            </div>

            <footer>
              <button type="button" onClick={() => setEditing(null)}>
                取消
              </button>
              <button
                type="submit"
                disabled={workingId === editing.provider.id}
              >
                {workingId === editing.provider.id ? (
                  <Loader2 className={styles.spinning} />
                ) : (
                  <Save />
                )}
                保存配置
              </button>
            </footer>
          </form>
        </div>
      )}
    </section>
  );
}

function SecretField(props: {
  label: string;
  value: string;
  clear: boolean;
  hasSecret: boolean;
  onValue: (value: string) => void;
  onClear: (value: boolean) => void;
}) {
  return (
    <fieldset>
      <legend>{props.label}</legend>
      <label>
        <span>{props.label}</span>
        <input
          aria-label={props.label}
          type="password"
          autoComplete="new-password"
          value={props.value}
          disabled={props.clear}
          placeholder={props.hasSecret ? "留空保留现有密钥" : "输入新密钥"}
          onChange={(event) => props.onValue(event.target.value)}
        />
      </label>
      <label className={styles.clearSecret}>
        <input
          type="checkbox"
          aria-label={`清除数据库中的 ${props.label}`}
          checked={props.clear}
          onChange={(event) => props.onClear(event.target.checked)}
        />
        清除数据库密钥并回退环境变量
      </label>
    </fieldset>
  );
}
