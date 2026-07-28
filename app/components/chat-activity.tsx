import { useEffect, useState } from "react";
import { Check, ChevronRight, Loader2, X } from "lucide-react";

import type { ChatMessageTool } from "../store";
import styles from "./chat.module.scss";

export function ChatActivity(props: {
  running?: boolean;
  tools?: ChatMessageTool[];
}) {
  const { running = false, tools = [] } = props;
  const hasTools = tools.length > 0;
  const [expanded, setExpanded] = useState(running && hasTools);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    setExpanded(running && hasTools);
  }, [hasTools, running]);

  useEffect(() => {
    if (!running) return;

    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      setSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [running]);

  if (!hasTools) {
    if (!running) return null;

    return (
      <div
        className={styles["chat-activity-thinking"]}
        role="status"
        aria-live="polite"
      >
        <span className={styles["chat-activity-pulse"]} aria-hidden="true" />
        <span>正在思考</span>
        <small>{seconds}s</small>
      </div>
    );
  }

  const summary = running
    ? `正在调用工具 · ${tools.length} 个`
    : `已调用 ${tools.length} 个工具`;

  return (
    <div
      className={styles["chat-activity"]}
      data-running={running || undefined}
    >
      <button
        type="button"
        className={styles["chat-activity-summary"]}
        aria-expanded={expanded}
        onClick={() => setExpanded((current) => !current)}
      >
        <ChevronRight
          className={styles["chat-activity-chevron"]}
          aria-hidden="true"
        />
        {running ? (
          <Loader2
            className={styles["chat-activity-spinner"]}
            aria-hidden="true"
          />
        ) : (
          <Check aria-hidden="true" />
        )}
        <span>{summary}</span>
        {running && <small>{seconds}s</small>}
      </button>

      {expanded && (
        <div className={styles["chat-activity-details"]}>
          {tools.map((tool) => {
            const toolName = tool.function?.name || "未命名工具";

            return (
              <div
                key={tool.id}
                className={styles["chat-activity-tool"]}
                data-error={tool.isError || undefined}
                title={tool.errorMsg}
              >
                {tool.isError === false ? (
                  <Check aria-hidden="true" />
                ) : tool.isError === true ? (
                  <X aria-hidden="true" />
                ) : (
                  <Loader2
                    className={styles["chat-activity-spinner"]}
                    aria-hidden="true"
                  />
                )}
                <span>{toolName}</span>
                {tool.errorMsg && <small>{tool.errorMsg}</small>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
