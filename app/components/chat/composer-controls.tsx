import React from "react";
import clsx from "clsx";

import styles from "../chat.module.scss";

export function ComposerToolButton(props: {
  icon: JSX.Element;
  label: string;
  active?: boolean;
  pressed?: boolean;
  className?: string;
  onClick: () => void;
  children?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={clsx(
        styles["composer-tool-button"],
        props.active && styles["composer-tool-button-active"],
        props.className,
      )}
      aria-label={props.label}
      aria-pressed={props.pressed}
      title={props.label}
      onClick={props.onClick}
    >
      <span className={styles["composer-tool-icon"]}>{props.icon}</span>
      {props.children}
    </button>
  );
}

export function ComposerMenuItem(props: {
  icon: JSX.Element;
  label: string;
  checked?: boolean;
  trailing?: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={styles["composer-menu-item"]}
      onClick={props.onClick}
    >
      <span className={styles["composer-menu-item-icon"]}>{props.icon}</span>
      <span className={styles["composer-menu-item-label"]}>{props.label}</span>
      {props.trailing ??
        (props.checked !== undefined && (
          <span
            className={clsx(
              styles["composer-switch"],
              props.checked && styles["composer-switch-on"],
            )}
            aria-hidden="true"
          >
            <span />
          </span>
        ))}
    </button>
  );
}
