import TopicIcon from "../icons/topic.svg";
import MoreIcon from "../icons/more-horizontal.svg";
import { PencilLine as RenameIcon, Trash2 as DeleteIcon } from "lucide-react";

import styles from "./home.module.scss";
import {
  DragDropContext,
  Droppable,
  Draggable,
  OnDragEndResponder,
} from "@hello-pangea/dnd";

import { useChatStore } from "../store";

import Locale from "../locales";
import { useLocation, useNavigate } from "react-router-dom";
import { Path } from "../constant";
import { MaskAvatar } from "./mask";
import { Mask } from "../store/mask";
import { useRef, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { showConfirm, showPrompt } from "./ui-lib";
import clsx from "clsx";
import { deriveTopicFromMessages } from "../utils/session-topic";

function getDisplayTopic(session: {
  topic: string;
  topicManuallyEdited?: boolean;
  messages: { role?: string; content?: unknown }[];
  mask: Mask;
}) {
  if (
    !session.topicManuallyEdited &&
    (session.topic === Locale.Store.DefaultTopic ||
      session.topic === session.mask.name)
  ) {
    return deriveTopicFromMessages(session.messages, session.topic);
  }

  return session.topic || Locale.Store.DefaultTopic;
}

export function ChatItem(props: {
  onClick?: () => void;
  onOpenMenu?: (position: { x: number; y: number }) => void;
  title: string;
  count: number;
  selected: boolean;
  id: string;
  index: number;
  narrow?: boolean;
  mask: Mask;
  dragDisabled?: boolean;
}) {
  const draggableRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (props.selected && draggableRef.current) {
      draggableRef.current?.scrollIntoView({
        block: "center",
      });
    }
  }, [props.selected]);

  const { pathname: currentPath } = useLocation();

  const openMenuFromTrigger = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    props.onOpenMenu?.({ x: rect.right - 8, y: rect.bottom + 4 });
  };

  return (
    <Draggable
      draggableId={`${props.id}`}
      index={props.index}
      isDragDisabled={props.dragDisabled}
    >
      {(provided) => (
        <div
          className={clsx(styles["chat-item"], {
            [styles["chat-item-selected"]]:
              props.selected && currentPath === Path.Chat,
          })}
          onClick={props.onClick}
          onContextMenu={(event) => {
            event.preventDefault();
            event.stopPropagation();
            props.onOpenMenu?.({ x: event.clientX, y: event.clientY });
          }}
          ref={(ele) => {
            draggableRef.current = ele;
            provided.innerRef(ele);
          }}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          title={`${props.title}\n${Locale.ChatItem.ChatItemCount(
            props.count,
          )}`}
        >
          {props.narrow ? (
            <div className={styles["chat-item-narrow"]}>
              <div className={clsx(styles["chat-item-avatar"], "no-dark")}>
                <MaskAvatar
                  avatar={props.mask.avatar}
                  model={props.mask.modelConfig.model}
                />
              </div>
              <div className={styles["chat-item-narrow-count"]}>
                {props.count}
              </div>
            </div>
          ) : (
            <div className={styles["chat-item-compact"]}>
              <span className={styles["chat-item-icon"]}>
                <TopicIcon />
              </span>
              <div className={styles["chat-item-title"]}>{props.title}</div>
            </div>
          )}

          <button
            type="button"
            className={styles["chat-item-menu-trigger"]}
            aria-label={Locale.ChatItem.MoreActions}
            title={Locale.ChatItem.MoreActions}
            onClick={openMenuFromTrigger}
          >
            <MoreIcon />
          </button>
        </div>
      )}
    </Draggable>
  );
}

export function ChatList(props: {
  narrow?: boolean;
  maskId?: string;
  limit?: number;
  query?: string;
  variant?: "sidebar" | "panel";
  onSelect?: () => void;
}) {
  const [sessions, selectedIndex, selectSession, moveSession] = useChatStore(
    (state) => [
      state.sessions,
      state.currentSessionIndex,
      state.selectSession,
      state.moveSession,
    ],
  );
  const chatStore = useChatStore();
  const navigate = useNavigate();
  const [menu, setMenu] = useState<{
    storeIndex: number;
    x: number;
    y: number;
  }>();

  const normalizedQuery = props.query?.trim().toLowerCase();
  const matchingSessions = sessions
    .map((session, storeIndex) => ({ session, storeIndex }))
    .map(({ session, storeIndex }) => ({
      session,
      storeIndex,
      displayTopic: getDisplayTopic(session),
    }))
    .filter(({ session }) => !props.maskId || session.mask.id === props.maskId)
    .filter(
      ({ displayTopic }) =>
        !normalizedQuery ||
        displayTopic.toLowerCase().includes(normalizedQuery),
    );
  const visibleSessions = props.limit
    ? matchingSessions.slice(0, props.limit)
    : matchingSessions;
  const dragDisabled = Boolean(
    props.maskId || props.limit || normalizedQuery || props.variant === "panel",
  );

  const onDragEnd: OnDragEndResponder = (result) => {
    if (dragDisabled) return;

    const { destination, source } = result;
    if (!destination) {
      return;
    }

    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    moveSession(source.index, destination.index);
  };

  useEffect(() => {
    if (!menu) return;

    const closeMenu = () => setMenu(undefined);
    const closeMenuOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu();
    };

    window.addEventListener("pointerdown", closeMenu);
    window.addEventListener("blur", closeMenu);
    window.addEventListener("resize", closeMenu);
    window.addEventListener("keydown", closeMenuOnEscape);

    return () => {
      window.removeEventListener("pointerdown", closeMenu);
      window.removeEventListener("blur", closeMenu);
      window.removeEventListener("resize", closeMenu);
      window.removeEventListener("keydown", closeMenuOnEscape);
    };
  }, [menu]);

  const selectedMenuSession = menu ? sessions.at(menu.storeIndex) : undefined;
  const menuWidth = 168;
  const menuHeight = 92;
  const menuPosition = menu
    ? {
        left: Math.max(8, Math.min(menu.x, window.innerWidth - menuWidth - 8)),
        top: Math.max(8, Math.min(menu.y, window.innerHeight - menuHeight - 8)),
      }
    : undefined;

  const renameSession = async () => {
    if (!menu || !selectedMenuSession) return;
    const storeIndex = menu.storeIndex;
    const currentTitle = selectedMenuSession.topic;
    setMenu(undefined);
    const nextTitle = await showPrompt(Locale.Chat.Rename, currentTitle, 1);
    const normalizedTitle = nextTitle?.trim();
    if (normalizedTitle) {
      chatStore.renameSession(storeIndex, normalizedTitle);
    }
  };

  const deleteSession = async () => {
    if (!menu) return;
    const storeIndex = menu.storeIndex;
    setMenu(undefined);
    if (await showConfirm(Locale.Home.DeleteChat)) {
      chatStore.deleteSession(storeIndex);
    }
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <Droppable droppableId={`chat-list-${props.variant ?? "sidebar"}`}>
        {(provided) => (
          <div
            className={clsx(styles["chat-list"], {
              [styles["chat-list-panel"]]: props.variant === "panel",
            })}
            ref={provided.innerRef}
            {...provided.droppableProps}
          >
            {visibleSessions.map(
              ({ session: item, storeIndex, displayTopic }, visibleIndex) => (
                <ChatItem
                  title={displayTopic}
                  count={item.messages.length}
                  key={item.id}
                  id={item.id}
                  index={visibleIndex}
                  selected={storeIndex === selectedIndex}
                  dragDisabled={dragDisabled}
                  onClick={() => {
                    selectSession(storeIndex);
                    navigate(Path.Chat);
                    props.onSelect?.();
                  }}
                  onOpenMenu={({ x, y }) => {
                    setMenu({ storeIndex, x, y });
                  }}
                  narrow={props.narrow}
                  mask={item.mask}
                />
              ),
            )}
            {visibleSessions.length === 0 && props.variant === "panel" && (
              <div className={styles["recent-panel-empty"]}>未找到相关会话</div>
            )}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
      {menu &&
        selectedMenuSession &&
        menuPosition &&
        createPortal(
          <div
            className={styles["chat-item-context-menu"]}
            role="menu"
            aria-label={Locale.ChatItem.MoreActions}
            style={menuPosition}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <button type="button" role="menuitem" onClick={renameSession}>
              <RenameIcon />
              <span>{Locale.Chat.Rename}</span>
            </button>
            <button
              type="button"
              role="menuitem"
              className={styles["chat-item-context-menu-danger"]}
              onClick={deleteSession}
            >
              <DeleteIcon />
              <span>{Locale.Chat.Actions.Delete}</span>
            </button>
          </div>,
          document.body,
        )}
    </DragDropContext>
  );
}
