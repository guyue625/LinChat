import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Path } from "../constant";
import { useChatStore } from "../store";
import {
  assistantToMask,
  FEATURED_ASSISTANTS,
  FeaturedAssistant,
} from "../data/featured-assistants";
import { EmojiAvatar } from "./emoji";
import SendIcon from "../icons/send-white.svg";
import styles from "./workspace-home.module.scss";

export function WorkspaceHome() {
  const navigate = useNavigate();
  const chatStore = useChatStore();
  const [input, setInput] = useState("");
  const [active, setActive] = useState(FEATURED_ASSISTANTS[0]);

  const startChat = async (assistant: FeaturedAssistant, message?: string) => {
    chatStore.newSession(assistantToMask(assistant));
    navigate(Path.Chat);
    if (message?.trim())
      await useChatStore.getState().onUserInput(message.trim());
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!input.trim()) return;
    void startChat(active, input);
  };

  return (
    <main className={styles.page}>
      <div className={styles.glow} />
      <section className={styles.content}>
        <header className={styles.hero}>
          <div className={styles.identity}>
            <span className={styles.avatar}>
              <EmojiAvatar avatar={active.avatar} size={24} />
            </span>
            <strong>{active.name}</strong>
          </div>
          <h1>你好，今天想完成什么？</h1>
          <p>{active.greeting}</p>
        </header>

        <form className={styles.composer} onSubmit={submit}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit(e);
              }
            }}
            placeholder={`给 ${active.name} 发消息…`}
            rows={4}
            autoFocus
          />
          <div className={styles.composerFooter}>
            <span>Enter 发送 · Shift + Enter 换行</span>
            <button type="submit" disabled={!input.trim()} aria-label="发送">
              <SendIcon />
            </button>
          </div>
        </form>

        <div className={styles.suggestions}>
          {active.suggestions.map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => void startChat(active, suggestion)}
            >
              {suggestion}
            </button>
          ))}
        </div>

        <section className={styles.assistants}>
          <div className={styles.sectionTitle}>
            <div>
              <h2>选择助理</h2>
              <p>每个助理都有不同的角色、能力与提示词配置。</p>
            </div>
            <span>{FEATURED_ASSISTANTS.length} 个预置</span>
          </div>
          <div className={styles.grid}>
            {FEATURED_ASSISTANTS.map((assistant) => (
              <button
                key={assistant.key}
                className={
                  active.key === assistant.key ? styles.activeCard : styles.card
                }
                onClick={() => setActive(assistant)}
                onDoubleClick={() => void startChat(assistant)}
              >
                <span className={styles.cardAvatar}>
                  <EmojiAvatar avatar={assistant.avatar} size={28} />
                </span>
                <span className={styles.cardText}>
                  <strong>{assistant.name}</strong>
                  <small>{assistant.description}</small>
                </span>
                <span className={styles.arrow}>→</span>
              </button>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
