import { ServiceProvider } from "../constant";
import type {
  SettingsCategory,
  SettingsSearchEntry,
  SettingsSubpage,
} from "./settings-schema";

const SETTINGS_SEARCH_PROVIDERS = [
  ["openai", ServiceProvider.OpenAI],
  ["azure", ServiceProvider.Azure],
  ["google", ServiceProvider.Google],
  ["anthropic", ServiceProvider.Anthropic],
  ["baidu", ServiceProvider.Baidu],
  ["tencent", ServiceProvider.Tencent],
  ["bytedance", ServiceProvider.ByteDance],
  ["alibaba", ServiceProvider.Alibaba],
  ["moonshot", ServiceProvider.Moonshot],
  ["deepseek", ServiceProvider.DeepSeek],
  ["xai", ServiceProvider.XAI],
  ["chatglm", ServiceProvider.ChatGLM],
  ["siliconflow", ServiceProvider.SiliconFlow],
  ["stability", ServiceProvider.Stability],
  ["iflytek", ServiceProvider.Iflytek],
  ["302-ai", ServiceProvider["302.AI"]],
] as const;

export function updateSettingsLocationParams(
  previous: URLSearchParams,
  category: SettingsCategory,
  subpage: SettingsSubpage,
) {
  const next = new URLSearchParams(previous);
  next.set("tab", category);
  next.set("section", subpage);
  return next;
}

export function getSettingsSearchProvider(id: string) {
  return SETTINGS_SEARCH_PROVIDERS.find(([prefix]) =>
    id.startsWith(`provider-${prefix}-`),
  )?.[1];
}

type SettingsSearchSelectionActions = {
  selectProvider?: (provider: ServiceProvider) => void;
  setLocation: (category: SettingsCategory, subpage: SettingsSubpage) => void;
  focus: (id: string) => void;
};

export function coordinateSettingsSearchSelection(
  entry: SettingsSearchEntry,
  actions: SettingsSearchSelectionActions,
) {
  const provider = getSettingsSearchProvider(entry.id);
  if (provider) {
    actions.selectProvider?.(provider);
  }

  actions.setLocation(entry.category, entry.subpage);
  actions.focus(entry.id);
}

type SettingsFocusCoordinatorOptions = {
  retryDelay?: number;
  maxAttempts?: number;
  highlightDuration?: number;
  onPendingChange?: (id: string | undefined) => void;
};

export function createSettingsFocusCoordinator({
  retryDelay = 50,
  maxAttempts = 20,
  highlightDuration = 2000,
  onPendingChange,
}: SettingsFocusCoordinatorOptions = {}) {
  let disposed = false;
  let pendingId: string | undefined;
  let highlightedTarget: HTMLElement | undefined;
  let retryTimer: number | undefined;
  let highlightTimer: number | undefined;

  const clearRetryTimer = () => {
    if (retryTimer === undefined) return;
    window.clearTimeout(retryTimer);
    retryTimer = undefined;
  };

  const clearHighlight = () => {
    if (highlightTimer !== undefined) {
      window.clearTimeout(highlightTimer);
      highlightTimer = undefined;
    }
    highlightedTarget?.removeAttribute("data-highlighted");
    highlightedTarget = undefined;
  };

  const setPendingId = (id: string | undefined, notify = true) => {
    pendingId = id;
    if (notify && !disposed) {
      onPendingChange?.(id);
    }
  };

  const locate = (id: string, attempt: number) => {
    if (disposed || pendingId !== id) return;

    const target = document.getElementById(id);
    if (target) {
      target.scrollIntoView?.({ behavior: "smooth", block: "center" });
      target.setAttribute("data-highlighted", "true");
      highlightedTarget = target;
      highlightTimer = window.setTimeout(() => {
        highlightTimer = undefined;
        if (disposed || pendingId !== id) return;

        target.removeAttribute("data-highlighted");
        if (highlightedTarget === target) {
          highlightedTarget = undefined;
        }
        setPendingId(undefined);
      }, highlightDuration);
      return;
    }

    if (attempt >= Math.max(1, maxAttempts)) {
      setPendingId(undefined);
      return;
    }

    retryTimer = window.setTimeout(() => {
      retryTimer = undefined;
      locate(id, attempt + 1);
    }, retryDelay);
  };

  return {
    focus(id: string) {
      if (disposed) return;

      clearRetryTimer();
      clearHighlight();
      setPendingId(id);
      locate(id, 1);
    },
    getPendingId() {
      return pendingId;
    },
    dispose() {
      if (disposed) return;

      disposed = true;
      clearRetryTimer();
      clearHighlight();
      setPendingId(undefined, false);
    },
  };
}
