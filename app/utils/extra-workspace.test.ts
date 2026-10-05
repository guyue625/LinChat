let mockStorage = new Map<string, string>();
function mockStore(initial: any) {
  let state = initial;
  return {
    getState: () => state,
    setState: (patch: any) => {
      state = { ...state, ...patch };
    },
  };
}
jest.mock("../store/plugin", () => ({
  usePluginStore: mockStore({ plugins: {}, lastUpdateTime: 0 }),
  FunctionToolService: { tools: {} },
  ensureBuiltinPlugins: jest.fn(),
}));
jest.mock("../store/sd", () => ({
  useSdStore: mockStore({ draw: [], currentId: 0 }),
  DEFAULT_SD_STATE: { draw: [], currentId: 0 },
}));
jest.mock("../store/draft", () => ({
  useDraftStore: mockStore({ drafts: {}, owner: "guest", lastUpdateTime: 0 }),
}));
jest.mock("./indexedDB-storage", () => ({
  indexedDBStorage: {
    getItem: async (key: string) => mockStorage.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      mockStorage.set(key, value);
    },
  },
}));

beforeEach(() => {
  jest.resetModules();
  mockStorage = new Map();
  window.localStorage.clear();
});

it("isolates plugin credentials, drawings and drafts between accounts", async () => {
  const { switchExtraWorkspace } = await import("./extra-workspace");
  const { usePluginStore } = await import("../store/plugin");
  const { useSdStore } = await import("../store/sd");
  const { useDraftStore } = await import("../store/draft");
  await switchExtraWorkspace("user:a");
  usePluginStore.setState({
    plugins: { private: { authToken: "secret-a" } },
  } as any);
  useSdStore.setState({ draw: [{ id: "drawing-a" }] });
  useDraftStore.setState({ drafts: { chat: "draft-a" } });
  await switchExtraWorkspace("user:b");
  expect(usePluginStore.getState().plugins).toEqual({});
  expect(useSdStore.getState().draw).toEqual([]);
  expect(useDraftStore.getState().drafts).toEqual({});
  await switchExtraWorkspace("user:a");
  expect(usePluginStore.getState().plugins.private.authToken).toBe("secret-a");
  expect(useDraftStore.getState().drafts.chat).toBe("draft-a");
});

it("does not overwrite the previous account cache during rapid switches", async () => {
  const { switchExtraWorkspace, extraWorkspaceOwner } = await import(
    "./extra-workspace"
  );
  const { useDraftStore } = await import("../store/draft");
  await switchExtraWorkspace("user:a");
  useDraftStore.setState({ drafts: { chat: "keep-me" } });
  await Promise.all([
    switchExtraWorkspace("user:b"),
    switchExtraWorkspace("user:c"),
  ]);
  expect(extraWorkspaceOwner()).toBe("user:c");
  await switchExtraWorkspace("user:a");
  expect(useDraftStore.getState().drafts.chat).toBe("keep-me");
});
