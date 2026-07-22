import styles from "./auth.module.scss";

export type AuthCharacterPose =
  | "idle"
  | "tracking"
  | "covering"
  | "peeking"
  | "thinking"
  | "failed";

export function getAuthCharacterPose(input: {
  activeField: "username" | "password" | "invitation" | null;
  passwordVisible: boolean;
  submitting: boolean;
  failed: boolean;
}): AuthCharacterPose {
  if (input.submitting) return "thinking";
  if (input.failed) return "failed";
  if (input.activeField === "password") {
    return input.passwordVisible ? "peeking" : "covering";
  }
  if (input.activeField === "username") return "tracking";
  return "idle";
}

export function AuthCharacter(props: {
  pose: AuthCharacterPose;
  usernameLength: number;
}) {
  const eyeOffset = Math.min(5, Math.max(-5, (props.usernameLength - 8) / 3));
  return (
    <div
      className={`${styles["character-wrap"]} no-dark`}
      data-pose={props.pose}
      aria-hidden="true"
      style={{ "--eye-offset": `${eyeOffset}px` } as React.CSSProperties}
    >
      <div className={styles["character-shadow"]} />
      <svg className={styles.character} viewBox="0 0 260 230">
        <path
          className={styles["character-body"]}
          d="M55 224c2-51 24-80 75-80s73 29 75 80H55Z"
        />
        <path
          className={styles["character-ear"]}
          d="M72 92c-25-7-28 38-4 42M188 92c25-7 28 38 4 42"
        />
        <path
          className={styles["character-head"]}
          d="M67 92c0-47 25-75 63-75s63 28 63 75v24c0 38-25 64-63 64s-63-26-63-64V92Z"
        />
        <path
          className={styles["character-hair"]}
          d="M72 78c7-43 35-61 60-61 35 0 58 25 61 62-19-7-36-18-47-33-20 20-44 31-74 32Z"
        />
        <g className={styles["character-face"]}>
          <g className={styles["character-eyes"]}>
            <ellipse cx="104" cy="105" rx="8" ry="10" />
            <ellipse cx="156" cy="105" rx="8" ry="10" />
          </g>
          <path
            className={styles["character-brows"]}
            d="M91 89q13-8 25 0M144 89q13-8 25 0"
          />
          <path className={styles["character-mouth"]} d="M116 136q14 12 28 0" />
        </g>
        <g className={styles["character-arms"]}>
          <path
            className={styles["character-arm-left"]}
            d="M82 205c-21-15-33-33-21-45 13-13 29 6 47 31"
          />
          <path
            className={styles["character-arm-right"]}
            d="M178 205c21-15 33-33 21-45-13-13-29 6-47 31"
          />
        </g>
        <g className={styles["character-cover-arms"]}>
          <path d="M62 185c9-31 25-58 45-68 12-6 22 13 10 22-13 10-20 23-24 42" />
          <path d="M198 185c-9-31-25-58-45-68-12-6-22 13-10 22 13 10 20 23 24 42" />
        </g>
      </svg>
      <div className={styles["character-bubble"]}>
        {props.pose === "peeking"
          ? "我只偷看一眼"
          : props.pose === "thinking"
          ? "正在确认身份…"
          : props.pose === "failed"
          ? "好像哪里不对"
          : "欢迎回来"}
      </div>
    </div>
  );
}
