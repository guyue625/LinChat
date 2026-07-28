import React, { useRef, useState } from "react";
import clsx from "clsx";

import styles from "../chat.module.scss";

export function ChatAction(props: {
  text: string;
  icon: JSX.Element;
  onClick: () => void;
  compact?: boolean;
  "data-action"?: string;
}) {
  const iconRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState({
    full: 16,
    icon: 16,
  });

  function updateWidth() {
    if (!iconRef.current || !textRef.current) return;
    const getWidth = (dom: HTMLDivElement) => dom.getBoundingClientRect().width;
    const textWidth = getWidth(textRef.current);
    const iconWidth = getWidth(iconRef.current);
    setWidth({
      full: textWidth + iconWidth,
      icon: iconWidth,
    });
  }

  if (props.compact) {
    return (
      <button
        type="button"
        className={styles["chat-message-action-button"]}
        aria-label={props.text}
        title={props.text}
        data-action={props["data-action"]}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          props.onClick();
        }}
      >
        <span className={styles.icon} aria-hidden="true">
          {props.icon}
        </span>
      </button>
    );
  }

  return (
    <div
      className={clsx(styles["chat-input-action"], "clickable")}
      onClick={() => {
        props.onClick();
        setTimeout(updateWidth, 1);
      }}
      onMouseEnter={updateWidth}
      onTouchStart={updateWidth}
      style={
        {
          "--icon-width": `${width.icon}px`,
          "--full-width": `${width.full}px`,
        } as React.CSSProperties
      }
    >
      <div ref={iconRef} className={styles.icon}>
        {props.icon}
      </div>
      <div className={styles.text} ref={textRef}>
        {props.text}
      </div>
    </div>
  );
}
