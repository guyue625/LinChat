import { createPersistStore } from "../utils/store";

export const DRAFT_STORE_KEY = "account-drafts";
export const useDraftStore = createPersistStore(
  { drafts: {} as Record<string, string>, owner: "guest" },
  (set, get) => ({
    setDraft(owner: string, id: string, text: string) {
      if (owner !== get().owner) return;
      const drafts = { ...get().drafts };
      if (text) drafts[id] = text;
      else delete drafts[id];
      set({ drafts, lastUpdateTime: Date.now() });
    },
  }),
  { name: DRAFT_STORE_KEY, version: 1 },
);
