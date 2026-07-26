import styles from "./auth.module.scss";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAccessStore } from "../store";
import EyeIcon from "../icons/eye.svg";
import EyeOffIcon from "../icons/eye-off.svg";
import { useAccount } from "./account-context";
import { safeReturnPath } from "./account-utils";

type Mode = "login" | "register" | "reset" | "legacy";

const RAIN_GLYPHS = "アイウエオカキクケコ01λΔΞΣ0123456789ABCDEF<>+-*/";
const RAIN_COLS = 14;
const RAIN_ROWS = 24;

// Deterministic glyph picker — SSR and client must render identical output.
function rainGlyph(col: number, row: number) {
  return RAIN_GLYPHS[
    (col * 31 + row * 17 + col * row * 7) % RAIN_GLYPHS.length
  ];
}

function CodeRain() {
  return (
    <div className={styles["code-rain"]}>
      {Array.from({ length: RAIN_COLS }, (_, col) => (
        <span className={styles["rain-col"]} key={col}>
          {/* Rows doubled so the -50% → 0 translate loops seamlessly */}
          {Array.from({ length: RAIN_ROWS * 2 }, (_, row) => (
            <i key={row}>{rainGlyph(col, row % RAIN_ROWS)}</i>
          ))}
        </span>
      ))}
    </div>
  );
}

function SceneBackground() {
  return (
    <div className={styles.bg} aria-hidden="true">
      <div className={styles["bg-aurora-a"]} />
      <div className={styles["bg-aurora-b"]} />
      <CodeRain />
      <div className={styles["bg-horizon"]} />
      <div className={styles["bg-grid"]} />
      <div className={styles["bg-glints"]}>
        {Array.from({ length: 8 }, (_, i) => (
          <span key={i} />
        ))}
      </div>
      <div className={styles.grain} />
      <div className={styles.scanlines} />
      <div className={styles.vignette} />
    </div>
  );
}

export function AuthPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const accessStore = useAccessStore();
  const { enabled, loading, refresh, user } = useAccount();
  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [invitationCode, setInvitationCode] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [failed, setFailed] = useState(false);
  const accountEnabled = loading ? null : enabled;
  const returnTo = useMemo(
    () => safeReturnPath(new URLSearchParams(location.search).get("returnTo")),
    [location.search],
  );

  useEffect(() => {
    if (loading) return;
    if (user) {
      navigate(returnTo, { replace: true });
      return;
    }
    if (!enabled) setMode("legacy");
  }, [enabled, loading, navigate, returnTo, user]);

  const switchMode = (nextMode: Mode) => {
    setMode(nextMode);
    setError("");
    setSuccess("");
    setFailed(false);
  };

  const submitAccount = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess("");
    setFailed(false);
    try {
      const endpoint = mode === "reset" ? "reset" : mode;
      const response = await fetch(`/api/account/${endpoint}`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "reset"
            ? { token: resetToken, newPassword: password }
            : { username, password, invitationCode },
        ),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "操作失败，请稍后重试");
      if (mode === "reset") {
        setPassword("");
        setResetToken("");
        setMode("login");
        setSuccess("密码已经更新，请使用新密码登录。");
      } else {
        await refresh();
        navigate(returnTo, { replace: true });
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "操作失败",
      );
      setFailed(true);
      window.setTimeout(() => setFailed(false), 650);
    } finally {
      setSubmitting(false);
    }
  };

  const submitLegacy = (event: React.FormEvent) => {
    event.preventDefault();
    if (!accessStore.accessCode.trim()) {
      setError("请输入访问码");
      setFailed(true);
      return;
    }
    navigate(returnTo, { replace: true });
  };

  return (
    <main className={styles["auth-page"]}>
      <SceneBackground />

      <div className={styles.coords} aria-hidden="true">
        <span>N 30.25°</span>
        <span>E 120.16°</span>
        <span>LINK OK</span>
      </div>

      <section className={styles["auth-stage"]}>
        <span className={styles["hud-c"]} data-pos="tl" aria-hidden="true" />
        <span className={styles["hud-c"]} data-pos="tr" aria-hidden="true" />
        <span className={styles["hud-c"]} data-pos="bl" aria-hidden="true" />
        <span className={styles["hud-c"]} data-pos="br" aria-hidden="true" />
        <span className={styles["card-scan"]} aria-hidden="true" />
        <div className={styles["brand-panel"]}>
          <span className={styles["panel-ghost"]} aria-hidden="true">
            時
          </span>
          <div className={styles["brand-row"]}>
            <div className={styles["brand-mark"]} aria-hidden="true">
              AI
            </div>
            <div className={styles["brand-copy"]}>
              <strong>LinChat</strong>
              <span>MY DEAR WORKSPACE</span>
            </div>
          </div>

          <div className={styles["panel-copy"]}>
            <p className={styles["panel-kicker"]}>WORKSPACE · 属于你的时光</p>
            <h2 className={styles["panel-title"]}>
              灵感不会
              <br />
              永远停留。
            </h2>
            <p className={styles["panel-lead"]}>
              但每一次对话、每一个念头，都可以在这里安放。
              登录，把时间接着过下去。
            </p>
          </div>

          <div className={styles["sys-readout"]} aria-hidden="true">
            <div>
              <span>SIG</span>
              <i style={{ "--v": "86%" } as React.CSSProperties} />
              <b>86%</b>
            </div>
            <div>
              <span>MEM</span>
              <i style={{ "--v": "64%" } as React.CSSProperties} />
              <b>64%</b>
            </div>
            <div>
              <span>SYN</span>
              <i style={{ "--v": "93%" } as React.CSSProperties} />
              <b>93%</b>
            </div>
          </div>

          <div className={styles["panel-status"]}>
            <span className={styles["status-dot"]} />
            <span>SESSION LINK · INTEGRITY OK</span>
          </div>
        </div>

        <div className={styles["form-panel"]}>
          <div className={styles["mode-tabs"]} aria-label="认证方式">
            {accountEnabled !== false && (
              <>
                <button
                  type="button"
                  data-active={mode === "login" || mode === "reset"}
                  onClick={() => switchMode("login")}
                >
                  登录
                </button>
                <button
                  type="button"
                  data-active={mode === "register"}
                  onClick={() => switchMode("register")}
                >
                  邀请注册
                </button>
              </>
            )}
            <button
              type="button"
              data-active={mode === "legacy"}
              onClick={() => switchMode("legacy")}
            >
              访问码
            </button>
          </div>

          {mode === "legacy" ? (
            <form className={styles["auth-form"]} onSubmit={submitLegacy}>
              <div className={styles["form-heading"]}>
                <span className={styles.eyebrow}>COMPAT GATE</span>
                <h1>使用部署访问码</h1>
                <p>适用于仍使用旧版 CODE 环境变量的部署。</p>
              </div>
              <label>
                <span>访问码</span>
                <div className={styles["field-shell"]}>
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={accessStore.accessCode}
                    onChange={(event) =>
                      accessStore.update(
                        (access) => (access.accessCode = event.target.value),
                      )
                    }
                    placeholder="输入管理员提供的访问码"
                  />
                </div>
              </label>
              {error && <div className={styles["form-error"]}>{error}</div>}
              <button className={styles["submit-button"]} type="submit">
                <span>进入 NextChat</span>
                <span className={styles["btn-arrow"]} aria-hidden="true">
                  →
                </span>
              </button>
            </form>
          ) : (
            <form
              className={styles["auth-form"]}
              data-failed={failed}
              onSubmit={submitAccount}
            >
              <div className={styles["form-heading"]}>
                <span className={styles.eyebrow}>
                  {mode === "login"
                    ? "SECURE ACCESS"
                    : mode === "register"
                    ? "INVITATION ONLY"
                    : "ONE-TIME RESET"}
                </span>
                <h1>
                  {mode === "login"
                    ? "欢迎回来"
                    : mode === "register"
                    ? "创建你的账号"
                    : "设置新密码"}
                </h1>
                <p>
                  {mode === "login"
                    ? "同步你的会话、模型与工作流。"
                    : mode === "register"
                    ? "注册需要管理员生成的邀请码。"
                    : "输入管理员提供的一次性重置凭证。"}
                </p>
              </div>

              {mode === "reset" ? (
                <label>
                  <span>密码重置凭证</span>
                  <div className={styles["field-shell"]}>
                    <input
                      type="text"
                      autoComplete="off"
                      value={resetToken}
                      onChange={(event) => setResetToken(event.target.value)}
                      placeholder="NCR-…"
                      required
                    />
                  </div>
                </label>
              ) : (
                <label>
                  <span>用户名</span>
                  <div className={styles["field-shell"]}>
                    <input
                      type="text"
                      autoComplete="username"
                      value={username}
                      onChange={(event) => setUsername(event.target.value)}
                      placeholder="3-32 位字母、数字或 _.-"
                      required
                    />
                  </div>
                </label>
              )}

              <label>
                <span>{mode === "reset" ? "新密码" : "密码"}</span>
                <div className={styles["field-shell"]}>
                  <div className={styles["password-field"]}>
                    <input
                      type={passwordVisible ? "text" : "password"}
                      autoComplete={
                        mode === "login" ? "current-password" : "new-password"
                      }
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="至少 8 位"
                      required
                    />
                    <button
                      type="button"
                      aria-label={passwordVisible ? "隐藏密码" : "显示密码"}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => setPasswordVisible((visible) => !visible)}
                    >
                      {passwordVisible ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                  </div>
                </div>
              </label>

              {mode === "register" && (
                <label>
                  <span>邀请码</span>
                  <div className={styles["field-shell"]}>
                    <input
                      type="text"
                      autoComplete="off"
                      value={invitationCode}
                      onChange={(event) =>
                        setInvitationCode(event.target.value)
                      }
                      placeholder="输入管理员提供的邀请码"
                      required
                    />
                  </div>
                </label>
              )}

              {success && (
                <div className={styles["form-success"]}>{success}</div>
              )}
              {error && <div className={styles["form-error"]}>{error}</div>}
              <button
                className={styles["submit-button"]}
                type="submit"
                disabled={submitting || accountEnabled === null}
              >
                <span>
                  {submitting
                    ? "鉴权中…"
                    : mode === "login"
                    ? "登录"
                    : mode === "register"
                    ? "注册并登录"
                    : "更新密码"}
                </span>
                <span className={styles["btn-arrow"]} aria-hidden="true">
                  →
                </span>
              </button>

              {mode === "login" && (
                <button
                  className={styles["text-button"]}
                  type="button"
                  onClick={() => switchMode("reset")}
                >
                  使用一次性凭证重置密码
                </button>
              )}
              {mode === "reset" && (
                <button
                  className={styles["text-button"]}
                  type="button"
                  onClick={() => switchMode("login")}
                >
                  返回登录
                </button>
              )}
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
