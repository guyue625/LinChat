import React, { useCallback } from "react";
import { SendHorizontal as SendIcon, Trash2 as DeleteIcon } from "lucide-react";
import clsx from "clsx";

import { uploadImage as uploadImageRemote } from "../../utils/chat";
import {
  getPastedImageFiles,
  mergeAttachmentUrls,
  shouldDisableComposerSend,
} from "../../utils/chat-composer";
import { isVisionModel } from "../../utils";
import type { Mask } from "../../store/mask";
import Locale from "../../locales";
import { IconButton } from "../button";
import styles from "../chat.module.scss";
import { ComposerToolbar, type ComposerToolbarProps } from "./composer-toolbar";

export function DeleteImageButton(props: { deleteImage: () => void }) {
  return (
    <div className={styles["delete-image"]} onClick={props.deleteImage}>
      <DeleteIcon />
    </div>
  );
}

type ChatComposerActionProps = Pick<
  ComposerToolbarProps,
  | "showPromptModal"
  | "scrollToBottom"
  | "showPromptHints"
  | "hitBottom"
  | "setShowShortcutKeyModal"
  | "setShowChatSidePanel"
>;

export type ChatComposerProps = ChatComposerActionProps & {
  value: string;
  onInput: (value: string) => void;
  onSubmit: () => void;
  placeholder: string;
  attachImages: string[];
  setAttachImages: React.Dispatch<React.SetStateAction<string[]>>;
  uploading: boolean;
  setUploading: React.Dispatch<React.SetStateAction<boolean>>;
  mask: Mask;
  onMaskChange?: (updater: (mask: Mask) => void) => void;
  homeMode?: boolean;
  inputRef?: React.RefObject<HTMLTextAreaElement>;
  inputId?: string;
  onKeyDown?: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onFocus?: () => void;
  onClick?: () => void;
  rows?: number;
  autoFocus?: boolean;
  inputStyle?: React.CSSProperties;
  sendIcon?: JSX.Element;
  sendLabel?: string;
  sendDisabled?: boolean;
  onSend?: () => void;
};

export function ChatComposer(props: ChatComposerProps) {
  const { attachImages, mask, setAttachImages, setUploading } = props;
  const uploadFiles = useCallback(
    async (files: File[]) => {
      const availableSlots = Math.max(0, 3 - attachImages.length);
      const selectedFiles = files.slice(0, availableSlots);
      if (selectedFiles.length === 0) return;

      setUploading(true);
      try {
        const uploaded = await Promise.all(
          selectedFiles.map((file) => uploadImageRemote(file)),
        );
        setAttachImages((current) => mergeAttachmentUrls(current, uploaded));
      } finally {
        setUploading(false);
      }
    },
    [attachImages.length, setAttachImages, setUploading],
  );

  const handlePaste = useCallback(
    (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
      if (!isVisionModel(mask.modelConfig.model)) return;

      const files = getPastedImageFiles(Array.from(event.clipboardData.items));
      if (files.length === 0) return;

      event.preventDefault();
      void uploadFiles(files);
    },
    [mask.modelConfig.model, uploadFiles],
  );

  const chooseImages = useCallback(() => {
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept =
      "image/png, image/jpeg, image/webp, image/heic, image/heif";
    fileInput.multiple = true;
    fileInput.onchange = () => {
      if (fileInput.files) {
        void uploadFiles(Array.from(fileInput.files));
      }
    };
    fileInput.click();
  }, [uploadFiles]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (props.onKeyDown) {
      props.onKeyDown(event);
      return;
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      props.onSubmit();
    }
  };

  return (
    <div
      className={clsx(styles["chat-input-panel-inner"], {
        [styles["chat-input-panel-inner-attach"]]:
          props.attachImages.length !== 0,
      })}
    >
      <textarea
        id={props.inputId}
        ref={props.inputRef}
        className={styles["chat-input"]}
        placeholder={props.placeholder}
        onInput={(event) => props.onInput(event.currentTarget.value)}
        value={props.value}
        onKeyDown={handleKeyDown}
        onFocus={props.onFocus}
        onClick={props.onClick}
        onPaste={handlePaste}
        rows={props.rows ?? 4}
        autoFocus={props.autoFocus}
        style={props.inputStyle}
      />
      {props.attachImages.length !== 0 && (
        <div className={styles["attach-images"]}>
          {props.attachImages.map((image, index) => (
            <div
              key={`${image.slice(-32)}-${index}`}
              className={styles["attach-image"]}
              style={{ backgroundImage: `url("${image}")` }}
            >
              <div className={styles["attach-image-mask"]}>
                <DeleteImageButton
                  deleteImage={() =>
                    props.setAttachImages((images) =>
                      images.filter((_, imageIndex) => imageIndex !== index),
                    )
                  }
                />
              </div>
            </div>
          ))}
        </div>
      )}
      <div className={styles["composer-footer"]}>
        <ComposerToolbar
          uploadImage={chooseImages}
          setAttachImages={props.setAttachImages}
          setUploading={props.setUploading}
          showPromptModal={props.showPromptModal}
          scrollToBottom={props.scrollToBottom}
          showPromptHints={props.showPromptHints}
          hitBottom={props.hitBottom}
          uploading={props.uploading}
          setShowShortcutKeyModal={props.setShowShortcutKeyModal}
          setShowChatSidePanel={props.setShowChatSidePanel}
          mask={props.mask}
          onMaskChange={props.onMaskChange}
          homeMode={props.homeMode}
        />
        <IconButton
          icon={props.sendIcon ?? <SendIcon />}
          aria={props.sendLabel ?? Locale.Chat.Send}
          title={props.sendLabel ?? Locale.Chat.Send}
          className={styles["chat-input-send"]}
          disabled={shouldDisableComposerSend(
            props.uploading,
            props.sendDisabled,
          )}
          onClick={props.onSend ?? props.onSubmit}
        />
      </div>
    </div>
  );
}
