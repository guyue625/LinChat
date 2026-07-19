import { FormEvent, useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SendHorizontal, X } from "lucide-react";
import { Path } from "../constant";
import { useChatStore } from "../store";
import { Mask } from "../store/mask";
import {
  assistantToMask,
  FEATURED_ASSISTANTS,
  FeaturedAssistant,
} from "../data/featured-assistants";
import { deepClone } from "../utils/clone";
import { uploadImage as uploadImageRemote } from "../utils/chat";
import { EmojiAvatar } from "./emoji";
import { ChatActions } from "./chat";
import chatStyles from "./chat.module.scss";
import styles from "./workspace-home.module.scss";

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
  const [, setUnusedModal] = useState(false);

  const updateDraftMask = useCallback((updater: (mask: Mask) => void) => {
    setDraftMask((current) => {
      const next = deepClone(current);
      updater(next);
      return next;
    });
  }, []);

  const chooseAssistant = (assistant: FeaturedAssistant) => {
    setActive(assistant);
    setDraftMask((current) => {
      const next = assistantToMask(assistant);
      next.modelConfig = deepClone(current.modelConfig);
      next.plugin = current.plugin ? [...current.plugin] : [];
      next.syncGlobalConfig = current.syncGlobalConfig;
      return next;
    });
  };

  const startChat = async (assistant: FeaturedAssistant, message?: string) => {
    const nextMask = assistantToMask(assistant);
    nextMask.modelConfig = deepClone(draftMask.modelConfig);
    nextMask.plugin = draftMask.plugin ? [...draftMask.plugin] : [];
    nextMask.syncGlobalConfig = draftMask.syncGlobalConfig;
    chatStore.newSession(nextMask);
    navigate(Path.Chat);
    if (message?.trim() || attachImages.length > 0) {
      await useChatStore
        .getState()
        .onUserInput(message?.trim() ?? "", attachImages);
    }
    setInput("");
    setAttachImages([]);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!input.trim() && attachImages.length === 0) return;
    void startChat(active, input);
  };

  const uploadImage = async () => {
    const files = await new Promise<FileList | null>((resolve) => {
      const fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.accept =
        "image/png, image/jpeg, image/webp, image/heic, image/heif";
      fileInput.multiple = true;
      fileInput.onchange = () => resolve(fileInput.files);
      fileInput.click();
    });
    if (!files?.length) return;

    setUploading(true);
    try {
      const uploaded = await Promise.all(
        Array.from(files)
          .slice(0, 3 - attachImages.length)
          .map((file) => uploadImageRemote(file)),
      );
      setAttachImages((current) => [...current, ...uploaded].slice(0, 3));
    } finally {
      setUploading(false);
    }
  };

  return (
    <main className={styles.page}>
      <div className={styles.glow} />
      <section className={styles.content}>
        <header className={styles.hero}>
          <div className={styles.identity}>
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
          </div>
          <h1>你好，今天想完成什么？</h1>
          <p>{active.greeting}</p>
        </header>

        <form className={styles.composer} onSubmit={submit}>
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submit(event);
              }
            }}
            placeholder={`给 ${active.name} 发消息…`}
            rows={4}
            autoFocus
          />
          {attachImages.length > 0 && (
            <div className={styles.attachments}>
              {attachImages.map((image, index) => (
                <div
                  className={styles.attachment}
                  key={image.slice(-32) + index}
                  style={{ backgroundImage: `url("${image}")` }}
                >
                  <button
                    type="button"
                    aria-label="移除图片"
                    onClick={() =>
                      setAttachImages((images) =>
                        images.filter((_, imageIndex) => imageIndex !== index),
                      )
                    }
                  >
                    <X />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className={chatStyles["composer-footer"]}>
            <ChatActions
              uploadImage={() => void uploadImage()}
              setAttachImages={setAttachImages}
              setUploading={setUploading}
              showPromptModal={() => undefined}
              scrollToBottom={() => undefined}
              showPromptHints={() => undefined}
              hitBottom
              uploading={uploading}
              setShowShortcutKeyModal={setUnusedModal}
              setShowChatSidePanel={setUnusedModal}
              mask={draftMask}
              onMaskChange={updateDraftMask}
              homeMode
            />
            <button
              className={chatStyles["chat-input-send"]}
              type="submit"
              disabled={!input.trim() && attachImages.length === 0}
              aria-label="发送"
              title="发送"
            >
              <SendHorizontal />
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
