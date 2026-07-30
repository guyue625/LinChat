import { RefObject, useEffect, useRef } from "react";

import { UNFINISHED_INPUT } from "../../constant";
import { autoGrowTextArea, safeLocalStorage } from "../../utils";

const localStorage = safeLocalStorage();

export function useChatDraft(options: {
  sessionId: string;
  userInput: string;
  setUserInput: (value: string) => void;
  inputRef: RefObject<HTMLTextAreaElement>;
}) {
  const { inputRef, sessionId, setUserInput, userInput } = options;
  const latestInput = useRef(userInput);

  useEffect(() => {
    latestInput.current = userInput;
  }, [userInput]);

  useEffect(() => {
    const draftKey = UNFINISHED_INPUT(sessionId);
    const savedDraft = localStorage.getItem(draftKey);
    const input = inputRef.current;
    setUserInput(savedDraft ?? "");

    const frame = requestAnimationFrame(() => {
      if (input) {
        autoGrowTextArea(input);
      }
    });

    return () => {
      cancelAnimationFrame(frame);
      const currentInput = input?.value ?? latestInput.current;
      if (currentInput.trim()) {
        localStorage.setItem(draftKey, currentInput);
      } else {
        localStorage.removeItem(draftKey);
      }
    };
  }, [inputRef, sessionId, setUserInput]);

  useEffect(() => {
    if (!userInput) return;

    const timer = window.setTimeout(() => {
      localStorage.setItem(UNFINISHED_INPUT(sessionId), userInput);
    }, 500);

    return () => window.clearTimeout(timer);
  }, [sessionId, userInput]);
}
