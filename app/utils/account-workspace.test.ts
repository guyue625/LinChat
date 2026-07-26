import {
  chatWorkspaceStorageKey,
  createWorkspaceGenerationGuard,
  getVisibleModels,
  GUEST_WORKSPACE,
  modelWorkspaceOwnerStorageKey,
  modelWorkspaceStorageKey,
  planModelWorkspaceSwitch,
  resolveWorkspaceOwner,
  resolveModelWorkspaceInput,
  shouldResetModelWorkspaceView,
  shouldExposeServerModels,
  shouldShowModelPicker,
  shouldPreserveRestoredModelSelection,
} from "./account-workspace";
import * as accountWorkspace from "./account-workspace";
import { StoreKey } from "../constant";

jest.mock("nanoid", () => ({ nanoid: () => "test-id" }));
jest.mock("./indexedDB-storage", () => ({
  indexedDBStorage: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => undefined),
    removeItem: jest.fn(async () => undefined),
    clear: jest.fn(async () => undefined),
  },
}));

import { indexedDBStorage } from "./indexedDB-storage";

describe("account workspace isolation", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

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
    expect(modelWorkspaceStorageKey("user:u-1")).toBe(
      `${StoreKey.Config}::models::user:u-1`,
    );
    expect(modelWorkspaceStorageKey("user:u-2")).not.toBe(
      modelWorkspaceStorageKey("user:u-1"),
    );
    expect(modelWorkspaceOwnerStorageKey()).toBe(
      `${StoreKey.Config}::models-owner`,
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

  test("does not expose any model entries to a logged-out account", () => {
    const models = [{ name: "gpt-4o" }];

    expect(getVisibleModels({ enabled: true, user: null }, models)).toEqual([]);
    expect(
      getVisibleModels(
        {
          enabled: true,
          user: {
            username: "alice",
            role: "user",
            disabled: false,
          },
        },
        models,
      ),
    ).toEqual(models);
  });

  test("shows the model picker only after an account is ready", () => {
    expect(
      shouldShowModelPicker({ enabled: true, loading: false, user: null }, 1),
    ).toBe(false);
    expect(
      shouldShowModelPicker(
        {
          enabled: true,
          loading: false,
          user: {
            username: "alice",
            role: "user",
            disabled: false,
          },
        },
        1,
      ),
    ).toBe(true);
    expect(
      shouldShowModelPicker(
        {
          enabled: true,
          loading: true,
          user: {
            username: "alice",
            role: "user",
            disabled: false,
          },
        },
        1,
      ),
    ).toBe(false);
    expect(
      shouldShowModelPicker(
        {
          enabled: true,
          loading: false,
          modelWorkspaceReady: false,
          user: {
            username: "alice",
            role: "user",
            disabled: false,
          },
        } as Parameters<typeof shouldShowModelPicker>[0],
        1,
      ),
    ).toBe(false);
  });

  test("does not reuse a stale account context while its workspace is restoring", () => {
    const shouldReuseModelWorkspace = (
      accountWorkspace as unknown as {
        shouldReuseModelWorkspace?: (input: {
          activeOwner: string | null;
          allowServerModels: boolean;
          nextOwner: string;
          previousContext: {
            owner: string;
            allowServerModels: boolean;
          } | null;
          ready: boolean;
        }) => boolean;
      }
    ).shouldReuseModelWorkspace;

    expect(typeof shouldReuseModelWorkspace).toBe("function");
    expect(
      shouldReuseModelWorkspace?.({
        activeOwner: "user:alice",
        allowServerModels: true,
        nextOwner: "user:alice",
        previousContext: {
          owner: "user:alice",
          allowServerModels: true,
        },
        ready: false,
      }),
    ).toBe(false);
    expect(
      shouldReuseModelWorkspace?.({
        activeOwner: "user:alice",
        allowServerModels: true,
        nextOwner: "user:alice",
        previousContext: {
          owner: "user:alice",
          allowServerModels: true,
        },
        ready: true,
      }),
    ).toBe(true);
  });

  test("applies target-account edits without replacing the outgoing snapshot", () => {
    const resolvePendingModelWorkspaceTransition = (
      accountWorkspace as unknown as {
        resolvePendingModelWorkspaceTransition?: (input: {
          currentSnapshot: {
            customModels: string;
            modelConfig?: {
              model: string;
              providerName: string;
              compressModel: string;
              compressProviderName: string;
            };
          };
          nextOwner: string;
          nextSnapshot: {
            customModels: string;
            modelConfig?: {
              model: string;
              providerName: string;
              compressModel: string;
              compressProviderName: string;
            };
          } | null;
          pending: {
            owner: string;
            snapshot: {
              customModels: string;
              modelConfig?: {
                model: string;
                providerName: string;
                compressModel: string;
                compressProviderName: string;
              };
            };
          } | null;
        }) => {
          currentSnapshot: { customModels: string; modelConfig?: unknown };
          nextSnapshot: { customModels: string; modelConfig?: unknown } | null;
        };
      }
    ).resolvePendingModelWorkspaceTransition;
    const alice = { customModels: "OpenAI::alice" };
    const bobBefore = { customModels: "Anthropic::bob-before" };
    const bobEdited = { customModels: "Anthropic::bob-edited" };

    expect(typeof resolvePendingModelWorkspaceTransition).toBe("function");
    expect(
      resolvePendingModelWorkspaceTransition?.({
        currentSnapshot: alice,
        nextOwner: "user:bob",
        nextSnapshot: bobBefore,
        pending: { owner: "user:bob", snapshot: bobEdited },
      }),
    ).toEqual({ currentSnapshot: alice, nextSnapshot: bobEdited });

    expect(
      resolvePendingModelWorkspaceTransition?.({
        currentSnapshot: alice,
        nextOwner: "user:bob",
        nextSnapshot: {
          customModels: bobBefore.customModels,
          modelConfig: {
            model: "bob-model",
            providerName: "Anthropic",
            compressModel: "",
            compressProviderName: "",
          },
        },
        pending: { owner: "user:bob", snapshot: bobEdited },
      }),
    ).toEqual({
      currentSnapshot: alice,
      nextSnapshot: {
        customModels: bobEdited.customModels,
        modelConfig: {
          model: "bob-model",
          providerName: "Anthropic",
          compressModel: "",
          compressProviderName: "",
        },
      },
    });
  });

  test("keeps a user's custom models across logout and login", () => {
    const owner = "user:alice" as const;
    const customModels = "OpenAI::alpha=Alpha,Anthropic::beta";

    const logout = planModelWorkspaceSwitch({
      accountEnabled: true,
      currentOwner: owner,
      currentCustomModels: customModels,
      nextOwner: GUEST_WORKSPACE,
      nextSnapshot: null,
    });

    expect(logout.visibleCustomModels).toBe("");
    expect(logout.persist).toEqual({
      owner,
      snapshot: { customModels },
    });

    const login = planModelWorkspaceSwitch({
      accountEnabled: true,
      currentOwner: GUEST_WORKSPACE,
      currentCustomModels: "",
      nextOwner: owner,
      nextSnapshot: logout.persist?.snapshot,
    });

    expect(login.visibleCustomModels).toBe(customModels);
  });

  test("round-trips a per-user model snapshot through the synchronous cache", async () => {
    const owner = "user:alice" as const;
    const snapshot = {
      customModels: "OpenAI::alpha=Alpha",
      modelConfig: {
        model: "alpha",
        providerName: "OpenAI",
        compressModel: "",
        compressProviderName: "",
      },
    };

    const { cacheModelWorkspace, readModelWorkspace } = await import(
      "./account-workspace"
    );
    cacheModelWorkspace(owner, snapshot);

    await expect(readModelWorkspace(owner)).resolves.toEqual(snapshot);
  });

  test("does not discard legacy custom models when account auth is disabled", () => {
    const customModels = "OpenAI::alpha=Alpha";

    expect(
      planModelWorkspaceSwitch({
        accountEnabled: false,
        currentOwner: GUEST_WORKSPACE,
        currentCustomModels: customModels,
        nextOwner: GUEST_WORKSPACE,
        nextSnapshot: null,
      }),
    ).toMatchObject({ visibleCustomModels: customModels });
  });

  test("does not copy one account's custom models into another account", () => {
    const aliceModels = "OpenAI::alice-only";

    expect(
      planModelWorkspaceSwitch({
        accountEnabled: true,
        currentOwner: "user:alice",
        currentCustomModels: aliceModels,
        nextOwner: "user:bob",
        nextSnapshot: null,
      }),
    ).toEqual({
      visibleCustomModels: "",
      persist: {
        owner: "user:alice",
        snapshot: { customModels: aliceModels },
      },
    });
  });

  test("does not bootstrap a previous account's legacy value for a new user", () => {
    expect(
      planModelWorkspaceSwitch({
        accountEnabled: true,
        currentOwner: null,
        currentCustomModels: "OpenAI::alice-only",
        lastKnownOwner: "user:alice",
        nextOwner: "user:bob",
        nextSnapshot: null,
      }),
    ).toEqual({ visibleCustomModels: "" });
  });

  test("allows legacy bootstrap when the remembered owner is the same user", () => {
    const customModels = "OpenAI::alice-only";

    expect(
      planModelWorkspaceSwitch({
        accountEnabled: true,
        currentOwner: null,
        currentCustomModels: customModels,
        lastKnownOwner: "user:alice",
        nextOwner: "user:alice",
        nextSnapshot: null,
      }),
    ).toEqual({
      visibleCustomModels: customModels,
      persist: {
        owner: "user:alice",
        snapshot: { customModels },
      },
    });
  });

  test("does not claim legacy data when the owner marker could not be read", () => {
    expect(
      planModelWorkspaceSwitch({
        accountEnabled: true,
        allowLegacyBootstrap: false,
        currentOwner: null,
        currentCustomModels: "OpenAI::unknown-owner",
        nextOwner: "user:bob",
        nextSnapshot: null,
      }),
    ).toEqual({ visibleCustomModels: "" });
  });

  test("clears stale models while changing authenticated workspaces", () => {
    expect(shouldResetModelWorkspaceView("user:alice", "user:bob")).toBe(true);
    expect(shouldResetModelWorkspaceView(GUEST_WORKSPACE, "user:bob")).toBe(
      true,
    );
    expect(shouldResetModelWorkspaceView("user:alice", "user:alice")).toBe(
      false,
    );
  });

  test("restores the target account while saving the account being left", () => {
    const aliceModels = "OpenAI::alice-only";
    const bobModels = "Anthropic::bob-only";

    expect(
      planModelWorkspaceSwitch({
        accountEnabled: true,
        currentOwner: "user:alice",
        currentCustomModels: aliceModels,
        nextOwner: "user:bob",
        nextSnapshot: { customModels: bobModels },
      }),
    ).toEqual({
      visibleCustomModels: bobModels,
      persist: {
        owner: "user:alice",
        snapshot: { customModels: aliceModels },
      },
    });
  });

  test("keeps selected model settings inside the owning account workspace", () => {
    const aliceConfig = {
      model: "alice-model",
      providerName: "OpenAI",
      compressModel: "alice-compress",
      compressProviderName: "OpenAI",
    };
    const bobConfig = {
      model: "bob-model",
      providerName: "Anthropic",
      compressModel: "",
      compressProviderName: "",
    };

    expect(
      planModelWorkspaceSwitch({
        accountEnabled: true,
        currentOwner: "user:alice",
        currentCustomModels: "OpenAI::alice-model",
        currentModelConfig: aliceConfig,
        fallbackModelConfig: bobConfig,
        nextOwner: "user:bob",
        nextSnapshot: {
          customModels: "Anthropic::bob-model",
          modelConfig: bobConfig,
        },
      } as Parameters<typeof planModelWorkspaceSwitch>[0]),
    ).toEqual({
      visibleCustomModels: "Anthropic::bob-model",
      visibleModelConfig: bobConfig,
      persist: {
        owner: "user:alice",
        snapshot: {
          customModels: "OpenAI::alice-model",
          modelConfig: aliceConfig,
        },
      },
    });
  });

  test("keeps edits made while the account model workspace is loading", () => {
    const resolved = resolveModelWorkspaceInput({
      initialCustomModels: "",
      latestCustomModels: "OpenAI::added-while-loading",
      nextSnapshot: { customModels: "OpenAI::stale-snapshot" },
    });

    expect(resolved).toEqual({
      currentCustomModels: "OpenAI::added-while-loading",
      nextSnapshot: null,
      changed: true,
    });
  });

  test("does not treat model storage failures as a missing snapshot", async () => {
    const getItem = jest
      .spyOn(indexedDBStorage, "getItem")
      .mockRejectedValue(new Error("storage unavailable"));

    await expect(
      accountWorkspace.readModelWorkspace("user:alice"),
    ).rejects.toThrow("storage unavailable");

    getItem.mockRestore();
  });

  test("preserves target custom models when only its selected model changes", () => {
    const resolvePendingModelWorkspaceTransition = (
      accountWorkspace as unknown as {
        resolvePendingModelWorkspaceTransition?: (input: {
          currentSnapshot: { customModels: string; modelConfig?: unknown };
          nextOwner: string;
          nextSnapshot: { customModels: string; modelConfig?: unknown } | null;
          pending: {
            owner: string;
            snapshot: { customModels?: string; modelConfig?: unknown };
          } | null;
        }) => {
          currentSnapshot: { customModels: string; modelConfig?: unknown };
          nextSnapshot: { customModels: string; modelConfig?: unknown } | null;
        };
      }
    ).resolvePendingModelWorkspaceTransition;

    expect(
      resolvePendingModelWorkspaceTransition?.({
        currentSnapshot: { customModels: "alice" },
        nextOwner: "user:bob",
        nextSnapshot: {
          customModels: "bob-models",
          modelConfig: { model: "bob-old" },
        },
        pending: {
          owner: "user:bob",
          snapshot: { modelConfig: { model: "bob-new" } },
        },
      }),
    ).toEqual({
      currentSnapshot: { customModels: "alice" },
      nextSnapshot: {
        customModels: "bob-models",
        modelConfig: { model: "bob-new" },
      },
    });
  });

  test("persists a deletion made while the account model workspace is loading", () => {
    expect(
      planModelWorkspaceSwitch({
        accountEnabled: true,
        currentOwner: GUEST_WORKSPACE,
        currentCustomModels: "",
        currentCustomModelsChanged: true,
        nextOwner: "user:alice",
        nextSnapshot: null,
      }),
    ).toEqual({
      visibleCustomModels: "",
      persist: {
        owner: "user:alice",
        snapshot: { customModels: "" },
      },
    });
  });

  test("invalidates an older workspace transition when a newer one starts", () => {
    const guard = createWorkspaceGenerationGuard();
    const first = guard.begin();
    const second = guard.begin();

    expect(guard.isCurrent(first)).toBe(false);
    expect(guard.isCurrent(second)).toBe(true);
  });

  test("preserves a restored model selection while its catalogue is still loading", () => {
    expect(shouldPreserveRestoredModelSelection("server-model", false)).toBe(
      true,
    );
    expect(shouldPreserveRestoredModelSelection("", false)).toBe(false);
    expect(shouldPreserveRestoredModelSelection("server-model", true)).toBe(
      false,
    );
  });
});
