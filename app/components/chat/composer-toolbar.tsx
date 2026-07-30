import { useCallback, useState } from "react";

import BottomIcon from "../../icons/bottom.svg";
import HeadphoneIcon from "../../icons/headphone.svg";
import { useAppConfig, useChatStore } from "../../store";
import Locale from "../../locales";
import type { Mask } from "../../store/mask";
import styles from "../chat.module.scss";
import { ComposerToolButton } from "./composer-controls";
import { ComposerMoreMenu } from "./composer-more-menu";
import { ModelSelector } from "./model-selector";

export type ComposerToolbarProps = {
  uploadImage: () => void;
  setAttachImages: (images: string[]) => void;
  setUploading: (uploading: boolean) => void;
  uploading: boolean;
  showPromptModal?: () => void;
  scrollToBottom?: () => void;
  showPromptHints?: () => void;
  hitBottom?: boolean;
  setShowShortcutKeyModal?: (show: boolean) => void;
  setShowChatSidePanel?: (show: boolean) => void;
  mask?: Mask;
  onMaskChange?: (updater: (mask: Mask) => void) => void;
  homeMode?: boolean;
};

export function ComposerToolbar(props: ComposerToolbarProps) {
  const { onMaskChange } = props;
  const config = useAppConfig();
  const chatStore = useChatStore();
  const session = chatStore.currentSession();
  const mask = props.mask ?? session.mask;
  const [activePopover, setActivePopover] = useState<"model" | "more" | null>(
    null,
  );
  const updateMask = useCallback(
    (updater: (mask: Mask) => void) => {
      if (onMaskChange) {
        onMaskChange(updater);
        return;
      }
      chatStore.updateTargetSession(session, (target) => updater(target.mask));
    },
    [chatStore, onMaskChange, session],
  );
  const setModelOpen = useCallback((open: boolean) => {
    setActivePopover(open ? "model" : null);
  }, []);
  const setMoreOpen = useCallback((open: boolean) => {
    setActivePopover(open ? "more" : null);
  }, []);

  return (
    <div className={styles["chat-input-actions"]}>
      {activePopover && (
        <div
          className={styles["composer-popover-backdrop"]}
          onClick={() => setActivePopover(null)}
        />
      )}
      <div className={styles["composer-actions-start"]}>
        <ModelSelector
          mask={mask}
          updateMask={updateMask}
          setAttachImages={props.setAttachImages}
          setUploading={props.setUploading}
          homeMode={props.homeMode}
          open={activePopover === "model"}
          onOpenChange={setModelOpen}
        />
        <ComposerMoreMenu
          open={activePopover === "more"}
          onOpenChange={setMoreOpen}
          uploadImage={props.uploadImage}
          uploading={props.uploading}
          mask={mask}
          updateMask={updateMask}
          homeMode={props.homeMode}
          showPromptModal={props.showPromptModal}
          showPromptHints={props.showPromptHints}
          setShowShortcutKeyModal={props.setShowShortcutKeyModal}
        />
      </div>

      {!props.homeMode && (
        <div className={styles["composer-actions-end"]}>
          {!props.hitBottom && (
            <ComposerToolButton
              icon={<BottomIcon />}
              label={Locale.Chat.InputActions.ToBottom}
              onClick={() => props.scrollToBottom?.()}
            />
          )}
          {config.realtimeConfig.enable && (
            <ComposerToolButton
              icon={<HeadphoneIcon />}
              label="Realtime Chat"
              onClick={() => props.setShowChatSidePanel?.(true)}
            />
          )}
        </div>
      )}
    </div>
  );
}
