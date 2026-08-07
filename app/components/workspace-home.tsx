import { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, ChevronsUpDown } from "lucide-react";
import { Path } from "../constant";
import { useChatStore } from "../store";
import { Mask } from "../store/mask";
import {
  assistantToMask,
  FEATURED_ASSISTANTS,
  FeaturedAssistant,
} from "../data/featured-assistants";
import { deepClone } from "../utils/clone";
import { EmojiAvatar } from "./emoji";
import { ChatComposer } from "./chat/composer";
import styles from "./workspace-home.module.scss";
import { showToast } from "./ui-lib";
import Locale from "../locales";

export function WorkspaceHome() {
  const navigate = useNavigate();
  const chatStore = useChatStore();
  const [input, setInput] = useState("");
  const [active, setActive] = useState(FEATURED_ASSISTANTS[0]);
  const [draftMask, setDraftMask] = useState<Mask>(() =>
    assistantToMask(FEATURED_ASSISTANTS[0]),
  );
  const [attachImages, setAttachImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [assistantMenuOpen, setAssistantMenuOpen] = useState(false);
  const [startingChat, setStartingChat] = useState(false);
  const startingChatRef = useRef(false);

  const updateDraftMask = useCallback((updater: (mask: Mask) => void) => {
    setDraftMask((current) => {
      const next = deepClone(current);
      updater(next);
      return next;
    });
  }, []);

  const chooseAssistant = (assistant: FeaturedAssistant) => {
    setActive(assistant);
    setAssistantMenuOpen(false);
    setDraftMask((current) => {
      const next = assistantToMask(assistant);
      next.modelConfig = deepClone(current.modelConfig);
      next.plugin = current.plugin ? [...current.plugin] : [];
      next.syncGlobalConfig = current.syncGlobalConfig;
      return next;
    });
  };

  const startChat = async (assistant: FeaturedAssistant, message?: string) => {
    if (startingChatRef.current) return;
    startingChatRef.current = true;
    setStartingChat(true);
    const previousChat = useChatStore.getState();
    const previousChatState = {
      sessions: previousChat.sessions,
      currentSessionIndex: previousChat.currentSessionIndex,
      lastInput: previousChat.lastInput,
    };
    try {
      const nextMask = assistantToMask(assistant);
      nextMask.modelConfig = deepClone(draftMask.modelConfig);
      nextMask.plugin = draftMask.plugin ? [...draftMask.plugin] : [];
      nextMask.syncGlobalConfig = draftMask.syncGlobalConfig;
      chatStore.newSession(nextMask);
      const session = useChatStore.getState().currentSession();
      useChatStore.getState().updateTargetSession(session, (target) => {
        target.webSearchEnabled = webSearchEnabled;
      });
      if (message?.trim() || attachImages.length > 0) {
        await useChatStore
          .getState()
          .onUserInput(message?.trim() ?? "", attachImages);
      }
      navigate(Path.Chat);
      setInput("");
      setAttachImages([]);
    } catch (error) {
      useChatStore.setState(previousChatState);
      showToast(
        error instanceof Error ? error.message : Locale.Chat.WebSearch.Failed,
      );
    } finally {
      startingChatRef.current = false;
      setStartingChat(false);
    }
  };

  const submit = () => {
    if (!input.trim() && attachImages.length === 0) return;
    void startChat(active, input);
  };

  return (
    <main className={styles.page}>
      <div className={styles.glow} />
      <section className={styles.content}>
        <header className={styles.hero}>
          <div className={styles.identitySwitcher}>
            {assistantMenuOpen && (
              <button
                type="button"
                className={styles.switcherBackdrop}
                aria-label="关闭助理选择"
                onClick={() => setAssistantMenuOpen(false)}
              />
            )}
            <button
              type="button"
              className={styles.identity}
              aria-label={`切换助理，当前为 ${active.name}`}
              aria-haspopup="listbox"
              aria-expanded={assistantMenuOpen}
              onClick={() => setAssistantMenuOpen((open) => !open)}
            >
              <span
                className={`${styles.avatar} ${
                  active.isSystem ? styles.brandAvatar : ""
                }`}
              >
                <EmojiAvatar
                  avatar={active.avatar}
                  size={active.isSystem ? 52 : 36}
                />
              </span>
              <strong>{active.name}</strong>
              <ChevronsUpDown aria-hidden="true" />
            </button>
            {assistantMenuOpen && (
              <div
                className={styles.assistantMenu}
                role="listbox"
                aria-label="选择助理"
              >
                {FEATURED_ASSISTANTS.map((assistant) => (
                  <button
                    key={assistant.key}
                    type="button"
                    role="option"
                    aria-selected={active.key === assistant.key}
                    className={
                      active.key === assistant.key
                        ? styles.assistantMenuActive
                        : undefined
                    }
                    onClick={() => chooseAssistant(assistant)}
                  >
                    <span
                      className={`${styles.menuAvatar} ${
                        assistant.isSystem ? styles.brandAvatar : ""
                      }`}
                    >
                      <EmojiAvatar
                        avatar={assistant.avatar}
                        size={assistant.isSystem ? 38 : 30}
                      />
                    </span>
                    <span>
                      <strong>{assistant.name}</strong>
                      <small>{assistant.description}</small>
                    </span>
                    {active.key === assistant.key && (
                      <Check aria-hidden="true" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
          <h1>你好，今天想完成什么？</h1>
          <p>{active.greeting}</p>
        </header>

        <div className={styles.composer}>
          <ChatComposer
            value={input}
            onInput={setInput}
            onSubmit={submit}
            placeholder={`给 ${active.name} 发消息…`}
            attachImages={attachImages}
            setAttachImages={setAttachImages}
            uploading={uploading}
            setUploading={setUploading}
            mask={draftMask}
            webSearchEnabled={webSearchEnabled}
            onWebSearchChange={setWebSearchEnabled}
            onMaskChange={updateDraftMask}
            homeMode
            rows={4}
            autoFocus
            sendDisabled={
              startingChat || (!input.trim() && attachImages.length === 0)
            }
          />
        </div>

        <div className={styles.suggestions}>
          {active.suggestions.map((suggestion) => (
            <button
              key={suggestion}
              disabled={startingChat}
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
                disabled={startingChat}
                className={
                  active.key === assistant.key ? styles.activeCard : styles.card
                }
                onClick={() => chooseAssistant(assistant)}
                onDoubleClick={() => void startChat(assistant)}
              >
                <span
                  className={`${styles.cardAvatar} ${
                    assistant.isSystem ? styles.brandAvatar : ""
                  }`}
                >
                  <EmojiAvatar
                    avatar={assistant.avatar}
                    size={assistant.isSystem ? 48 : 38}
                  />
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
