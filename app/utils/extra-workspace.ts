import {
  usePluginStore,
  FunctionToolService,
  ensureBuiltinPlugins,
} from "../store/plugin";
import { DEFAULT_SD_STATE, useSdStore } from "../store/sd";
import { useDraftStore } from "../store/draft";
import { indexedDBStorage } from "./indexedDB-storage";

const OWNER_KEY = "extra-workspace-owner";
let owner: string | null = null;
let generation = 0;
let initialized = false;
let writes: Promise<unknown> = Promise.resolve();

function snapshot() {
  const plugins = usePluginStore.getState();
  const drawings = useSdStore.getState();
  return JSON.parse(
    JSON.stringify({
      plugins: {
        plugins: plugins.plugins,
        lastUpdateTime: plugins.lastUpdateTime,
      },
      drawings: {
        draw: drawings.draw,
        currentId: drawings.currentId,
        currentModel: drawings.currentModel,
        currentParams: drawings.currentParams,
        lastUpdateTime: drawings.lastUpdateTime,
      },
      drafts: {
        drafts: useDraftStore.getState().drafts,
        lastUpdateTime: useDraftStore.getState().lastUpdateTime,
      },
    }),
  );
}

export function persistExtraWorkspace() {
  if (!owner) return;
  const key = `account-extra::${owner}`;
  const data = JSON.stringify({ state: snapshot() });
  writes = writes
    .catch(() => undefined)
    .then(() => indexedDBStorage.setItem(key, data));
  void writes.catch(() =>
    console.error("[Workspace] extra data persistence failed"),
  );
}

export async function switchExtraWorkspace(nextOwner: string) {
  if (owner === nextOwner) return;
  const token = ++generation;
  const first = !initialized;
  initialized = true;
  const previousOwner =
    owner ?? (first ? window.localStorage.getItem(OWNER_KEY) : null);
  const previous = snapshot();
  if (previousOwner || first) {
    const key = `account-extra::${previousOwner ?? nextOwner}`;
    writes = writes
      .catch(() => undefined)
      .then(() =>
        indexedDBStorage.setItem(key, JSON.stringify({ state: previous })),
      );
  }
  owner = null;
  FunctionToolService.tools = {};
  usePluginStore.setState({ plugins: {}, lastUpdateTime: 0 });
  useSdStore.setState({ ...DEFAULT_SD_STATE, draw: [], lastUpdateTime: 0 });
  useDraftStore.setState({ drafts: {}, owner: nextOwner, lastUpdateTime: 0 });
  await writes;
  const raw = await indexedDBStorage.getItem(`account-extra::${nextOwner}`);
  if (token !== generation) return;
  // Only the first account may adopt pre-feature, unowned local data.
  const restored = raw ? JSON.parse(raw).state : null;
  if (restored) {
    usePluginStore.setState(restored.plugins);
    useSdStore.setState(restored.drawings);
    useDraftStore.setState({ ...restored.drafts, owner: nextOwner });
  }
  owner = nextOwner;
  window.localStorage.setItem(OWNER_KEY, nextOwner);
  void ensureBuiltinPlugins(() => owner === nextOwner && token === generation);
}

export function extraWorkspaceOwner() {
  return owner;
}
