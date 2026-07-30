import { RefObject, useCallback, useEffect, useRef, useState } from "react";

import type { ChatMessage } from "../../store";

export function useChatScroll(
  scrollRef: RefObject<HTMLDivElement>,
  detach: boolean,
  messages: ChatMessage[],
) {
  const [autoScroll, setAutoScroll] = useState(true);
  const lastMessagesLength = useRef(messages.length);

  const scrollDomToBottom = useCallback(() => {
    const dom = scrollRef.current;
    if (!dom) return;

    requestAnimationFrame(() => {
      setAutoScroll(true);
      dom.scrollTo(0, dom.scrollHeight);
    });
  }, [scrollRef]);

  useEffect(() => {
    if (autoScroll && !detach) {
      scrollDomToBottom();
    }
  }, [autoScroll, detach, messages, scrollDomToBottom]);

  useEffect(() => {
    if (messages.length > lastMessagesLength.current && !detach) {
      scrollDomToBottom();
    }
    lastMessagesLength.current = messages.length;
  }, [detach, messages.length, scrollDomToBottom]);

  return {
    autoScroll,
    setAutoScroll,
    scrollDomToBottom,
  };
}
