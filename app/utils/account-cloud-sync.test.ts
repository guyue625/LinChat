import { StoreKey } from "../constant";

jest.mock("../store", () => {
  const createStore = () => ({
    getState: jest.fn(() => ({})),
    setState: jest.fn(),
    subscribe: jest.fn(() => () => undefined),
  });
  return {
    useAccessStore: createStore(),
    useAppConfig: createStore(),
    useChatStore: {
      ...createStore(),
      getState: jest.fn(() => ({
        currentSessionIndex: 0,
        lastInput: "",
        sessions: [],
        workspaceOwner: "user:test-user",
        workspaceSwitching: false,
      })),
    },
  };
});

jest.mock("../store/mask", () => ({
  useMaskStore: {
    getState: jest.fn(() => ({})),
    setState: jest.fn(),
    subscribe: jest.fn(() => () => undefined),
  },
}));

jest.mock("../store/prompt", () => ({
  usePromptStore: {
    getState: jest.fn(() => ({})),
    setState: jest.fn(),
    subscribe: jest.fn(() => () => undefined),
  },
}));

jest.mock("./account-workspace", () => ({
  GUEST_WORKSPACE: "guest",
  writeChatWorkspace: jest.fn(async () => undefined),
}));

import {
  pushAccountCloud,
  startAccountCloudSync,
  stopAccountCloudSync,
  stripMediaFromAppState,
  SYNC_IMAGE_PLACEHOLDER,
} from "./account-cloud-sync";
import { mergeAppState, mergeWithUpdate, type AppState } from "./sync";
import { useChatStore } from "../store";

function cloudState(label = "state") {
  return {
    [StoreKey.Chat]: {
      sessions: [],
      currentSessionIndex: 0,
      lastInput: label,
    },
    [StoreKey.Access]: {},
    [StoreKey.Config]: {},
    [StoreKey.Mask]: { masks: {} },
    [StoreKey.Prompt]: { prompts: {} },
  } as unknown as AppState;
}

function fetchResponse(input: {
  status: number;
  json?: unknown;
  text?: string;
}) {
  return {
    ok: input.status >= 200 && input.status < 300,
    status: input.status,
    json: async () => input.json,
    text: async () => input.text ?? JSON.stringify(input.json ?? {}),
  };
}

async function waitForFetchCalls(fetchMock: jest.Mock, count: number) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (fetchMock.mock.calls.length >= count) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  expect(fetchMock).toHaveBeenCalledTimes(count);
}

describe("mergeWithUpdate", () => {
  it("prefers the side with the newer lastUpdateTime", () => {
    const local = { theme: "light", lastUpdateTime: 100 };
    const remote = { theme: "dark", lastUpdateTime: 200 };
    const merged = mergeWithUpdate(local, remote);
    expect(merged.theme).toBe("dark");
  });

  it("keeps local when timestamps are equal or local is newer", () => {
    const local = { theme: "light", lastUpdateTime: 300 };
    const remote = { theme: "dark", lastUpdateTime: 200 };
    expect(mergeWithUpdate(local, remote).theme).toBe("light");
  });
});

describe("mergeAppState Config/Access assignment", () => {
  it("applies mergeWithUpdate results back onto AppState", () => {
    const local = {
      [StoreKey.Chat]: { sessions: [], currentSessionIndex: 0, lastInput: "" },
      [StoreKey.Access]: { openaiApiKey: "local-key", lastUpdateTime: 1 },
      [StoreKey.Config]: { theme: "light", lastUpdateTime: 1 },
      [StoreKey.Mask]: { masks: {} },
      [StoreKey.Prompt]: { prompts: {} },
    } as unknown as AppState;
    const remote = {
      [StoreKey.Chat]: { sessions: [], currentSessionIndex: 0, lastInput: "" },
      [StoreKey.Access]: { openaiApiKey: "remote-key", lastUpdateTime: 99 },
      [StoreKey.Config]: { theme: "dark", lastUpdateTime: 99 },
      [StoreKey.Mask]: { masks: {} },
      [StoreKey.Prompt]: { prompts: {} },
    } as unknown as AppState;

    mergeAppState(local, remote);
    expect((local[StoreKey.Access] as any).openaiApiKey).toBe("remote-key");
    expect((local[StoreKey.Config] as any).theme).toBe("dark");
  });

  it("keeps local slices when an older remote snapshot omits them", () => {
    const local = {
      [StoreKey.Chat]: { sessions: [], currentSessionIndex: 0, lastInput: "" },
      [StoreKey.Access]: { openaiApiKey: "local-key", lastUpdateTime: 10 },
      [StoreKey.Config]: { theme: "light", lastUpdateTime: 10 },
      [StoreKey.Mask]: { masks: {} },
      [StoreKey.Prompt]: { prompts: {} },
    } as unknown as AppState;
    const remote = {
      [StoreKey.Chat]: { sessions: [], currentSessionIndex: 0, lastInput: "" },
      [StoreKey.Mask]: { masks: {} },
      [StoreKey.Prompt]: { prompts: {} },
    } as unknown as AppState;

    expect(() => mergeAppState(local, remote)).not.toThrow();
    expect((local[StoreKey.Access] as any).openaiApiKey).toBe("local-key");
    expect((local[StoreKey.Config] as any).theme).toBe("light");
  });
});

describe("stripMediaFromAppState", () => {
  it("replaces data-url images with a placeholder and drops audio data urls", () => {
    const state = {
      [StoreKey.Chat]: {
        sessions: [
          {
            id: "s1",
            messages: [
              {
                id: "m1",
                content: [
                  { type: "text", text: "hello" },
                  {
                    type: "image_url",
                    image_url: { url: "data:image/png;base64,AAAA" },
                  },
                ],
                audio_url: "data:audio/wav;base64,BBBB",
              },
            ],
          },
        ],
        currentSessionIndex: 0,
        lastInput: "",
      },
      [StoreKey.Access]: {},
      [StoreKey.Config]: {},
      [StoreKey.Mask]: { masks: {} },
      [StoreKey.Prompt]: { prompts: {} },
    } as unknown as AppState;

    const stripped = stripMediaFromAppState(state);
    const message = (stripped[StoreKey.Chat] as any).sessions[0].messages[0];
    expect(message.content[0].text).toBe("hello");
    expect(message.content[1].image_url.url).toBe(SYNC_IMAGE_PLACEHOLDER);
    expect(message.audio_url).toBeUndefined();
    // original untouched
    expect(
      (state[StoreKey.Chat] as any).sessions[0].messages[0].content[1].image_url
        .url,
    ).toBe("data:image/png;base64,AAAA");
  });
});

describe("initial account cloud sync", () => {
  beforeEach(() => {
    jest.spyOn(console, "log").mockImplementation(() => undefined);
    (useChatStore.getState as jest.Mock).mockReturnValue({
      currentSessionIndex: 0,
      lastInput: "",
      sessions: [],
      workspaceOwner: "user:test-user",
      workspaceSwitching: false,
    });
  });

  afterEach(() => {
    stopAccountCloudSync({ flush: false });
    jest.restoreAllMocks();
  });

  it("does not push local state when the initial pull fails", async () => {
    const fetchMock = global.fetch as jest.Mock;
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: false, status: 503 });
    jest.spyOn(console, "error").mockImplementation(() => undefined);

    startAccountCloudSync({ userId: "test-user" });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe("GET");
  });

  it("does not push a workspace that belongs to another active user", async () => {
    const fetchMock = global.fetch as jest.Mock;
    let resolvePull!: (response: { ok: boolean; status: number }) => void;
    fetchMock.mockReset();
    fetchMock
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolvePull = resolve;
          }),
      )
      .mockResolvedValue({ ok: true, status: 200 });

    startAccountCloudSync({ userId: "other-user" });
    await Promise.resolve();
    await pushAccountCloud();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe("GET");

    stopAccountCloudSync({ flush: false });
    resolvePull({ ok: false, status: 401 });
  });

  it("seeds an empty remote with revision zero", async () => {
    const fetchMock = global.fetch as jest.Mock;
    fetchMock.mockReset();
    fetchMock
      .mockResolvedValueOnce(
        fetchResponse({
          status: 200,
          json: { state: null, revision: 0, updatedAt: null },
        }),
      )
      .mockResolvedValueOnce(
        fetchResponse({
          status: 200,
          json: {
            ok: true,
            revision: 1,
            updatedAt: "2026-08-07T00:00:00.000Z",
          },
        }),
      );

    startAccountCloudSync({ userId: "test-user" });
    await waitForFetchCalls(fetchMock, 2);

    const headers = new Headers(fetchMock.mock.calls[1]?.[1]?.headers);
    expect(fetchMock.mock.calls[1]?.[1]?.method).toBe("POST");
    expect(headers.get("x-sync-revision")).toBe("0");
  });

  it("flushes the captured latest state and revision when stopping", async () => {
    const fetchMock = global.fetch as jest.Mock;
    fetchMock.mockReset();
    fetchMock
      .mockResolvedValueOnce(
        fetchResponse({
          status: 200,
          json: { state: null, revision: 0, updatedAt: null },
        }),
      )
      .mockResolvedValueOnce(
        fetchResponse({
          status: 200,
          json: {
            ok: true,
            revision: 1,
            updatedAt: "2026-08-07T00:00:00.000Z",
          },
        }),
      )
      .mockResolvedValueOnce(
        fetchResponse({
          status: 200,
          json: {
            ok: true,
            revision: 2,
            updatedAt: "2026-08-07T00:00:01.000Z",
          },
        }),
      );

    startAccountCloudSync({ userId: "test-user" });
    await waitForFetchCalls(fetchMock, 2);
    await new Promise((resolve) => setTimeout(resolve, 0));
    (useChatStore.getState as jest.Mock).mockReturnValue({
      currentSessionIndex: 0,
      lastInput: "latest-before-stop",
      sessions: [],
      workspaceOwner: "user:test-user",
      workspaceSwitching: false,
    });

    stopAccountCloudSync();
    await waitForFetchCalls(fetchMock, 3);

    const request = fetchMock.mock.calls[2]?.[1] as RequestInit;
    const headers = new Headers(request.headers);
    const body = JSON.parse(request.body as string) as AppState;
    expect(request.method).toBe("POST");
    expect(request.keepalive).toBe(true);
    expect(headers.get("x-sync-revision")).toBe("1");
    expect((body[StoreKey.Chat] as any).lastInput).toBe("latest-before-stop");
  });

  it("retries a stopped user's captured state without applying it to another workspace", async () => {
    const fetchMock = global.fetch as jest.Mock;
    const chatSetState = useChatStore.setState as jest.Mock;
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    fetchMock.mockReset();
    chatSetState.mockClear();
    fetchMock
      .mockResolvedValueOnce(
        fetchResponse({
          status: 200,
          json: { state: null, revision: 0, updatedAt: null },
        }),
      )
      .mockResolvedValueOnce(
        fetchResponse({
          status: 200,
          json: {
            ok: true,
            revision: 1,
            updatedAt: "2026-08-07T00:00:00.000Z",
          },
        }),
      )
      .mockResolvedValueOnce(
        fetchResponse({
          status: 409,
          json: {
            code: "SYNC_CONFLICT",
            state: cloudState("remote-conflict"),
            revision: 2,
            updatedAt: "2026-08-07T00:00:01.000Z",
          },
        }),
      )
      .mockResolvedValueOnce(
        fetchResponse({
          status: 200,
          json: {
            ok: true,
            revision: 3,
            updatedAt: "2026-08-07T00:00:02.000Z",
          },
        }),
      );

    startAccountCloudSync({ userId: "test-user" });
    await waitForFetchCalls(fetchMock, 2);
    await new Promise((resolve) => setTimeout(resolve, 0));
    (useChatStore.getState as jest.Mock).mockReturnValue({
      currentSessionIndex: 0,
      lastInput: "captured-before-switch",
      sessions: [],
      workspaceOwner: "user:test-user",
      workspaceSwitching: false,
    });

    stopAccountCloudSync();
    (useChatStore.getState as jest.Mock).mockReturnValue({
      currentSessionIndex: 0,
      lastInput: "other-user-state",
      sessions: [],
      workspaceOwner: "user:other-user",
      workspaceSwitching: false,
    });
    await waitForFetchCalls(fetchMock, 4);

    const firstHeaders = new Headers(fetchMock.mock.calls[2]?.[1]?.headers);
    const retryHeaders = new Headers(fetchMock.mock.calls[3]?.[1]?.headers);
    const retryBody = JSON.parse(
      fetchMock.mock.calls[3]?.[1]?.body as string,
    ) as AppState;
    expect(firstHeaders.get("x-sync-revision")).toBe("1");
    expect(retryHeaders.get("x-sync-revision")).toBe("2");
    expect((retryBody[StoreKey.Chat] as any).lastInput).toBe(
      "captured-before-switch",
    );
    expect(chatSetState).not.toHaveBeenCalled();
  });

  it("merges a conflict and retries once with the latest revision", async () => {
    const fetchMock = global.fetch as jest.Mock;
    fetchMock.mockReset();
    fetchMock
      .mockResolvedValueOnce(
        fetchResponse({
          status: 200,
          json: { state: null, revision: 0, updatedAt: null },
        }),
      )
      .mockResolvedValueOnce(
        fetchResponse({
          status: 409,
          json: {
            code: "SYNC_CONFLICT",
            state: cloudState("remote"),
            revision: 1,
            updatedAt: "2026-08-07T00:00:01.000Z",
          },
        }),
      )
      .mockResolvedValueOnce(
        fetchResponse({
          status: 200,
          json: {
            ok: true,
            revision: 2,
            updatedAt: "2026-08-07T00:00:02.000Z",
          },
        }),
      );

    startAccountCloudSync({ userId: "test-user" });
    await waitForFetchCalls(fetchMock, 3);

    const firstHeaders = new Headers(fetchMock.mock.calls[1]?.[1]?.headers);
    const retryHeaders = new Headers(fetchMock.mock.calls[2]?.[1]?.headers);
    expect(firstHeaders.get("x-sync-revision")).toBe("0");
    expect(retryHeaders.get("x-sync-revision")).toBe("1");
  });

  it("stops after a second revision conflict", async () => {
    const fetchMock = global.fetch as jest.Mock;
    const errorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    fetchMock.mockReset();
    fetchMock
      .mockResolvedValueOnce(
        fetchResponse({
          status: 200,
          json: { state: null, revision: 0, updatedAt: null },
        }),
      )
      .mockResolvedValueOnce(
        fetchResponse({
          status: 409,
          json: {
            code: "SYNC_CONFLICT",
            state: cloudState("remote-1"),
            revision: 1,
            updatedAt: "2026-08-07T00:00:01.000Z",
          },
        }),
      )
      .mockResolvedValueOnce(
        fetchResponse({
          status: 409,
          json: {
            code: "SYNC_CONFLICT",
            state: cloudState("remote-2"),
            revision: 2,
            updatedAt: "2026-08-07T00:00:02.000Z",
          },
        }),
      );

    startAccountCloudSync({ userId: "test-user" });
    await waitForFetchCalls(fetchMock, 3);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(errorSpy).toHaveBeenCalledWith(
      "[AccountCloudSync] push failed",
      "SYNC_CONFLICT",
    );
  });

  it("does not apply a delayed pull after the account sync stops", async () => {
    const fetchMock = global.fetch as jest.Mock;
    const chatSetState = useChatStore.setState as jest.Mock;
    let resolvePull!: (response: ReturnType<typeof fetchResponse>) => void;
    fetchMock.mockReset();
    chatSetState.mockClear();
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePull = resolve;
        }),
    );

    const stop = startAccountCloudSync({ userId: "test-user" });
    await Promise.resolve();
    stop();
    resolvePull(
      fetchResponse({
        status: 200,
        json: {
          state: cloudState("stale-account"),
          revision: 1,
          updatedAt: "2026-08-07T00:00:00.000Z",
        },
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(chatSetState).not.toHaveBeenCalled();
  });
});
