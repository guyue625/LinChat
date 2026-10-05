import { useRef, useState } from "react";
import { act, renderHook } from "@testing-library/react";
jest.mock("../../utils", () => ({
  autoGrowTextArea: jest.fn(),
  safeLocalStorage: () => window.localStorage,
}));
jest.mock("../../utils/indexedDB-storage", () => ({
  indexedDBStorage: {
    getItem: async () => null,
    setItem: async () => undefined,
  },
}));
import { useDraftStore } from "../../store/draft";
import { useChatDraft } from "./use-chat-draft";

beforeEach(() => {
  window.localStorage.clear();
  useDraftStore.setState({ drafts: { chat: "stored" }, owner: "user:a" });
});

it("restores remote drafts and preserves text currently being edited", async () => {
  const hook = renderHook(() => {
    const [userInput, setUserInput] = useState("");
    const inputRef = useRef<HTMLTextAreaElement>(null);
    useChatDraft({ sessionId: "chat", userInput, setUserInput, inputRef });
    return { userInput, setUserInput };
  });
  await act(async () => {
    await Promise.resolve();
  });
  expect(hook.result.current.userInput).toBe("stored");
  act(() => useDraftStore.getState().setDraft("user:a", "chat", "remote"));
  expect(hook.result.current.userInput).toBe("remote");
  act(() => hook.result.current.setUserInput("typing"));
  act(() => useDraftStore.getState().setDraft("user:a", "chat", "new remote"));
  expect(hook.result.current.userInput).toBe("typing");
  hook.unmount();
  expect(useDraftStore.getState().drafts.chat).toBe("typing");
});

it("ignores a delayed draft write from a different account", () => {
  useDraftStore.getState().setDraft("user:b", "chat", "wrong account");
  expect(useDraftStore.getState().drafts.chat).toBe("stored");
});
