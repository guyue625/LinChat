import React, { RefObject } from "react";
import dynamic from "next/dynamic";
import {
  Copy as CopyIcon,
  Pause as StopIcon,
  Pencil as EditIcon,
  Pin as PinIcon,
  RotateCcw as ResetIcon,
  Trash2 as DeleteIcon,
  Volume2 as SpeakIcon,
  VolumeX as SpeakStopIcon,
} from "lucide-react";

import LoadingIcon from "../../icons/three-dots.svg";
import { DEFAULT_TOPIC } from "../../store";
import type { ChatMessage } from "../../store";
import type { Mask } from "../../store/mask";
import Locale from "../../locales";
import {
  copyToClipboard,
  getMessageImages,
  getMessageTextContent,
} from "../../utils";
import {
  getAssistantMessageMetadata,
  getMessageModelDisplayName,
} from "../../utils/message-metadata";
import type { FeaturedAssistant } from "../../data/featured-assistants";
import { useChatStore } from "../../store";
import { MaskAvatar } from "../mask";
import { ChatActivity } from "../chat-activity";
import styles from "../chat.module.scss";
import { ChatAction } from "./message-action";

const Markdown = dynamic(async () => (await import("../markdown")).Markdown, {
  loading: () => <LoadingIcon />,
});

export type RenderMessage = ChatMessage & { preview?: boolean };

type ModelCatalog = Parameters<typeof getMessageModelDisplayName>[0]["models"];

function ClearContextDivider() {
  const chatStore = useChatStore();
  const session = chatStore.currentSession();

  return (
    <div
      className={styles["clear-context"]}
      onClick={() =>
        chatStore.updateTargetSession(
          session,
          (session) => (session.clearContextIndex = undefined),
        )
      }
    >
      <div className={styles["clear-context-tips"]}>{Locale.Context.Clear}</div>
      <div className={styles["clear-context-revert-btn"]}>
        {Locale.Context.Revert}
      </div>
    </div>
  );
}

export function ChatMessageRow(props: {
  message: RenderMessage;
  index: number;
  messageCount: number;
  isContext: boolean;
  showActions: boolean;
  showClearContextDivider: boolean;
  mask: Mask;
  featuredAssistant?: FeaturedAssistant;
  models: ModelCatalog;
  fontSize: number;
  fontFamily: string;
  parentRef: RefObject<HTMLDivElement>;
  isMobileScreen: boolean;
  speechStatus: boolean;
  ttsEnabled: boolean;
  onSetInput: (value: string) => void;
  onStop: (messageId: string) => void;
  onEdit: (message: ChatMessage) => void;
  onResend: (message: ChatMessage) => void;
  onDelete: (messageId: string) => void;
  onPin: (message: ChatMessage) => void;
  onSpeak: (text: string) => void;
}) {
  const { message } = props;
  if (message.role === "system") return null;

  const isUser = message.role === "user";
  const showTyping = message.preview || message.streaming;
  const messageText = getMessageTextContent(message);
  const messageImages = getMessageImages(message);
  const resolvedMessageModel = !isUser
    ? getMessageModelDisplayName({
        messageModel: message.model,
        messageProvider: message.provider,
        sessionModel: props.mask.modelConfig.model,
        sessionProvider: props.mask.modelConfig.providerName,
        models: props.models,
      })
    : undefined;
  const assistantMetadata = !isUser
    ? getAssistantMessageMetadata({
        featuredAssistantName: props.featuredAssistant?.name,
        maskName: props.mask.name,
        defaultTopicName: DEFAULT_TOPIC,
        defaultAssistantName: "默认助理",
        messageModel: resolvedMessageModel,
        sessionModel: props.mask.modelConfig.model,
      })
    : undefined;

  return (
    <>
      <div
        className={
          isUser ? styles["chat-message-user"] : styles["chat-message"]
        }
      >
        <div className={styles["chat-message-container"]}>
          <div className={styles["chat-message-header"]}>
            {!isUser && assistantMetadata && (
              <div className={styles["chat-message-identity"]}>
                <div className={styles["chat-message-avatar"]}>
                  <MaskAvatar
                    avatar={
                      props.featuredAssistant?.avatar ?? props.mask.avatar
                    }
                    model={assistantMetadata.modelName}
                  />
                </div>
                <div className={styles["chat-assistant-name"]}>
                  {assistantMetadata.assistantName}
                </div>
              </div>
            )}

            {!isUser && assistantMetadata && (
              <div className={styles["chat-message-meta"]}>
                <div className={styles["chat-message-action-date"]}>
                  {props.isContext
                    ? Locale.Chat.IsContext
                    : message.date.toLocaleString()}
                </div>
                {assistantMetadata.modelName && (
                  <div className={styles["chat-model-name"]}>
                    {assistantMetadata.modelName}
                  </div>
                )}
              </div>
            )}

            {isUser && (
              <div className={styles["chat-message-action-date"]}>
                {props.isContext
                  ? Locale.Chat.IsContext
                  : message.date.toLocaleString()}
              </div>
            )}
          </div>
          {!isUser && (showTyping || (message.tools?.length ?? 0) > 0) && (
            <ChatActivity
              running={Boolean(showTyping)}
              tools={message.tools ?? []}
            />
          )}
          <div className={styles["chat-message-item"]}>
            <Markdown
              key={message.streaming ? "loading" : "done"}
              content={messageText}
              loading={
                Boolean(message.preview || message.streaming) &&
                message.content.length === 0 &&
                !isUser
              }
              onDoubleClickCapture={() => {
                if (props.isMobileScreen) props.onSetInput(messageText);
              }}
              fontSize={props.fontSize}
              fontFamily={props.fontFamily}
              parentRef={props.parentRef}
              defaultShow={props.index >= props.messageCount - 6}
            />
            {messageImages.length === 1 && (
              <img
                className={styles["chat-message-item-image"]}
                src={messageImages[0]}
                alt=""
              />
            )}
            {messageImages.length > 1 && (
              <div
                className={styles["chat-message-item-images"]}
                style={
                  {
                    "--image-count": messageImages.length,
                  } as React.CSSProperties
                }
              >
                {messageImages.map((image, index) => (
                  <img
                    className={styles["chat-message-item-image-multi"]}
                    key={index}
                    src={image}
                    alt=""
                  />
                ))}
              </div>
            )}
          </div>
          {message.audio_url && (
            <div className={styles["chat-message-audio"]}>
              <audio src={message.audio_url} controls />
            </div>
          )}

          {props.showActions && (
            <div className={styles["chat-message-actions"]}>
              <div className={styles["chat-message-action-buttons"]}>
                {message.streaming ? (
                  <ChatAction
                    compact
                    text={Locale.Chat.Actions.Stop}
                    icon={<StopIcon />}
                    onClick={() => props.onStop(message.id)}
                    data-action="stop"
                  />
                ) : (
                  <>
                    {isUser && (
                      <ChatAction
                        compact
                        text={Locale.Chat.Actions.Edit}
                        icon={<EditIcon />}
                        onClick={() => props.onEdit(message)}
                      />
                    )}
                    <ChatAction
                      compact
                      text={Locale.Chat.Actions.Retry}
                      icon={<ResetIcon />}
                      onClick={() => props.onResend(message)}
                    />
                    <ChatAction
                      compact
                      text={Locale.Chat.Actions.Delete}
                      icon={<DeleteIcon />}
                      onClick={() => props.onDelete(message.id)}
                    />
                    <ChatAction
                      compact
                      text={Locale.Chat.Actions.Pin}
                      icon={<PinIcon />}
                      onClick={() => props.onPin(message)}
                    />
                    <ChatAction
                      compact
                      text={Locale.Chat.Actions.Copy}
                      icon={<CopyIcon />}
                      onClick={() => copyToClipboard(messageText)}
                    />
                    {props.ttsEnabled && (
                      <ChatAction
                        compact
                        text={
                          props.speechStatus
                            ? Locale.Chat.Actions.StopSpeech
                            : Locale.Chat.Actions.Speech
                        }
                        icon={
                          props.speechStatus ? <SpeakStopIcon /> : <SpeakIcon />
                        }
                        onClick={() => props.onSpeak(messageText)}
                      />
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      {props.showClearContextDivider && <ClearContextDivider />}
    </>
  );
}
