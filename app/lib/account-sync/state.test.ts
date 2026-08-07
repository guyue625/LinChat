import { StoreKey } from "../../constant";
import { hasDangerousKeys, validateSyncState } from "./state";

function validState() {
  return {
    [StoreKey.Chat]: { sessions: [], currentSessionIndex: 0, lastInput: "" },
    [StoreKey.Access]: {},
    [StoreKey.Config]: {},
    [StoreKey.Mask]: { masks: {} },
    [StoreKey.Prompt]: { prompts: {} },
  };
}

describe("validateSyncState", () => {
  it("accepts a complete app state", () => {
    expect(validateSyncState(validState()).ok).toBe(true);
  });

  it.each([null, [], "state", 1])("rejects a non-object root: %p", (value) => {
    expect(validateSyncState(value).ok).toBe(false);
  });

  it("requires a chat slice with sessions", () => {
    expect(validateSyncState({}).ok).toBe(false);
    expect(validateSyncState({ [StoreKey.Chat]: {} }).ok).toBe(false);
  });

  it("rejects non-object optional slices", () => {
    const state = validState();
    (state as Record<string, unknown>)[StoreKey.Config] = [];
    expect(validateSyncState(state).ok).toBe(false);
  });

  it("allows older snapshots to omit non-chat slices", () => {
    expect(validateSyncState({ [StoreKey.Chat]: { sessions: [] } }).ok).toBe(
      true,
    );
  });

  it("rejects dangerous keys at any depth", () => {
    const state = validState();
    (state[StoreKey.Chat].sessions as unknown[]).push(
      JSON.parse('{"__proto__":{"polluted":true}}'),
    );
    expect(hasDangerousKeys(state)).toBe(true);
    expect(validateSyncState(state).ok).toBe(false);
  });
});
