import {
  chatWorkspaceStorageKey,
  GUEST_WORKSPACE,
  resolveWorkspaceOwner,
  shouldExposeServerModels,
} from "./account-workspace";
import { StoreKey } from "../constant";

describe("account workspace isolation", () => {
  test("guest workspace when auth disabled or logged out", () => {
    expect(resolveWorkspaceOwner({ enabled: false, user: null })).toBe(
      GUEST_WORKSPACE,
    );
    expect(resolveWorkspaceOwner({ enabled: true, user: null })).toBe(
      GUEST_WORKSPACE,
    );
  });

  test("per-user workspace when logged in", () => {
    expect(
      resolveWorkspaceOwner({
        enabled: true,
        user: {
          id: "u-1",
          username: "admin",
          role: "admin",
          disabled: false,
        },
      }),
    ).toBe("user:u-1");
  });

  test("storage keys partition guest and users", () => {
    expect(chatWorkspaceStorageKey(GUEST_WORKSPACE)).toBe(
      `${StoreKey.Chat}::guest`,
    );
    expect(chatWorkspaceStorageKey("user:u-1")).toBe(
      `${StoreKey.Chat}::user:u-1`,
    );
  });

  test("server models are gated to authenticated sessions", () => {
    expect(shouldExposeServerModels({ enabled: false, user: null })).toBe(true);
    expect(shouldExposeServerModels({ enabled: true, user: null })).toBe(false);
    expect(
      shouldExposeServerModels({
        enabled: true,
        user: { username: "a", role: "user", disabled: false },
      }),
    ).toBe(true);
  });
});
