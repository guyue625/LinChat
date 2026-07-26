import { useEffect, useRef, useState, useCallback } from "react";
import { useChatStore } from "../store";
import { useNavigate } from "react-router-dom";
import { Path } from "../constant";
import styles from "./command-palette.module.scss";
import Locale from "../locales";
import { Search, MessageSquare, Clock, Hash } from "lucide-react";

interface CommandPaletteProps {
  show: boolean;
  onClose: () => void;
}

type SearchResult = {
  type: "session" | "message";
  sessionId: string;
  sessionIndex: number;
  title: string;
  preview?: string;
  lastUpdate?: number;
};

export function CommandPalette({ show, onClose }: CommandPaletteProps) {
  const chatStore = useChatStore();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const search = useCallback(
    (searchQuery: string) => {
      if (!searchQuery.trim()) {
        // 显示最近的会话
        const recentSessions = chatStore.sessions
          .map((session, index) => ({
            type: "session" as const,
            sessionId: session.id,
            sessionIndex: index,
            title: session.topic,
            lastUpdate: session.lastUpdate,
            preview: session.messages[session.messages.length - 1]?.content
              ?.toString()
              .slice(0, 100),
          }))
          .sort((a, b) => (b.lastUpdate || 0) - (a.lastUpdate || 0))
          .slice(0, 10);
        setResults(recentSessions);
        return;
      }

      const lowerQuery = searchQuery.toLowerCase();
      const sessionResults: SearchResult[] = [];

      chatStore.sessions.forEach((session, index) => {
        // 搜索会话标题
        if (session.topic.toLowerCase().includes(lowerQuery)) {
          sessionResults.push({
            type: "session",
            sessionId: session.id,
            sessionIndex: index,
            title: session.topic,
            lastUpdate: session.lastUpdate,
            preview: session.messages[session.messages.length - 1]?.content
              ?.toString()
              .slice(0, 100),
          });
        } else {
          // 搜索消息内容
          session.messages.forEach((message) => {
            const content = message.content?.toString() || "";
            if (content.toLowerCase().includes(lowerQuery)) {
              const matchIndex = content.toLowerCase().indexOf(lowerQuery);
              const start = Math.max(0, matchIndex - 40);
              const end = Math.min(content.length, matchIndex + 60);
              sessionResults.push({
                type: "message",
                sessionId: session.id,
                sessionIndex: index,
                title: session.topic,
                preview: content.substring(start, end),
                lastUpdate: session.lastUpdate,
              });
            }
          });
        }
      });

      // 按更新时间排序，最近的在前
      sessionResults.sort((a, b) => (b.lastUpdate || 0) - (a.lastUpdate || 0));
      setResults(sessionResults.slice(0, 20));
    },
    [chatStore.sessions],
  );

  useEffect(() => {
    if (show) {
      setQuery("");
      setSelectedIndex(0);
      search("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [show, search]);

  useEffect(() => {
    const timer = setTimeout(() => {
      search(query);
      setSelectedIndex(0);
    }, 150);
    return () => clearTimeout(timer);
  }, [query, search]);

  useEffect(() => {
    if (!show) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter" && results[selectedIndex]) {
        e.preventDefault();
        handleSelect(results[selectedIndex]);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [show, results, selectedIndex, onClose]);

  // 自动滚动到选中项
  useEffect(() => {
    if (resultsRef.current && results.length > 0) {
      const selectedElement = resultsRef.current.children[
        selectedIndex
      ] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({
          block: "nearest",
          behavior: "smooth",
        });
      }
    }
  }, [selectedIndex, results]);

  const handleSelect = (result: SearchResult) => {
    chatStore.selectSession(result.sessionIndex);
    navigate(Path.Chat);
    onClose();
  };

  const formatTime = (timestamp?: number) => {
    if (!timestamp) return "";
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return Locale.CommandPalette.JustNow;
    if (minutes < 60) return Locale.CommandPalette.MinutesAgo(minutes);
    if (hours < 24) return Locale.CommandPalette.HoursAgo(hours);
    return Locale.CommandPalette.DaysAgo(days);
  };

  if (!show) return null;

  return (
    <div className={styles["command-palette-overlay"]} onClick={onClose}>
      <div
        className={styles["command-palette"]}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles["search-box"]}>
          <Search className={styles["search-icon"]} size={18} />
          <input
            ref={inputRef}
            type="text"
            placeholder={Locale.CommandPalette.Placeholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className={styles["search-input"]}
          />
          <kbd className={styles["kbd"]}>ESC</kbd>
        </div>

        <div className={styles["results"]} ref={resultsRef}>
          {results.length === 0 && query && (
            <div className={styles["no-results"]}>
              {Locale.CommandPalette.NoResults}
            </div>
          )}
          {results.map((result, index) => (
            <div
              key={`${result.sessionId}-${index}`}
              className={`${styles["result-item"]} ${
                index === selectedIndex ? styles["selected"] : ""
              }`}
              onClick={() => handleSelect(result)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <div className={styles["result-icon"]}>
                {result.type === "session" ? (
                  <MessageSquare size={16} />
                ) : (
                  <Hash size={16} />
                )}
              </div>
              <div className={styles["result-content"]}>
                <div className={styles["result-title"]}>{result.title}</div>
                {result.preview && (
                  <div className={styles["result-preview"]}>
                    {result.preview}
                  </div>
                )}
              </div>
              {result.lastUpdate && (
                <div className={styles["result-time"]}>
                  <Clock size={12} />
                  {formatTime(result.lastUpdate)}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className={styles["footer"]}>
          <div className={styles["hint"]}>
            <kbd>↑</kbd>
            <kbd>↓</kbd>
            {Locale.CommandPalette.Navigate}
          </div>
          <div className={styles["hint"]}>
            <kbd>↵</kbd>
            {Locale.CommandPalette.Select}
          </div>
          <div className={styles["hint"]}>
            <kbd>ESC</kbd>
            {Locale.CommandPalette.Close}
          </div>
        </div>
      </div>
    </div>
  );
}
