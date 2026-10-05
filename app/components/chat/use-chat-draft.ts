import { RefObject, useEffect, useRef } from "react";
import { UNFINISHED_INPUT } from "../../constant";
import { autoGrowTextArea, safeLocalStorage } from "../../utils";
import { useDraftStore } from "../../store/draft";
const localStorage = safeLocalStorage();

export function useChatDraft(options: {
  sessionId: string;
  userInput: string;
  setUserInput: (value: string) => void;
  inputRef: RefObject<HTMLTextAreaElement>;
}) {
  const { inputRef, sessionId, setUserInput, userInput } = options;
  const owner = useDraftStore((state) => state.owner);
  const latestInput = useRef(userInput);
  const skipSave = useRef(false);
  latestInput.current = userInput;

  useEffect(() => {
    const store = useDraftStore.getState();
    const legacy = localStorage.getItem(UNFINISHED_INPUT(sessionId));
    const saved = store.drafts[sessionId] ?? legacy ?? "";
    skipSave.current = true;
    setUserInput(saved);
    store.setDraft(owner, sessionId, saved);
    if (legacy !== null) localStorage.removeItem(UNFINISHED_INPUT(sessionId));
    const frame = requestAnimationFrame(() => {
      if (inputRef.current) autoGrowTextArea(inputRef.current);
    });
    return () => {
      cancelAnimationFrame(frame);
      useDraftStore.getState().setDraft(owner, sessionId, latestInput.current);
    };
  }, [inputRef, owner, sessionId, setUserInput]);

  useEffect(
    () =>
      useDraftStore.subscribe((state, previous) => {
        if (state.owner !== owner || previous.owner !== owner) return;
        const before = previous.drafts[sessionId] ?? "";
        const after = state.drafts[sessionId] ?? "";
        if (before !== after && latestInput.current === before)
          setUserInput(after);
      }),
    [owner, sessionId, setUserInput],
  );

  useEffect(() => {
    if (skipSave.current) {
      skipSave.current = false;
      return;
    }
    const timer = window.setTimeout(
      () => useDraftStore.getState().setDraft(owner, sessionId, userInput),
      500,
    );
    return () => window.clearTimeout(timer);
  }, [owner, sessionId, userInput]);
}
