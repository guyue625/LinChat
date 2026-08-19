import { ServiceProvider } from "../constant";
import type { SettingsSearchEntry } from "./settings-schema";
import {
  coordinateSettingsSearchSelection,
  createSettingsFocusCoordinator,
  getSettingsSearchProvider,
  updateSettingsLocationParams,
} from "./settings-search-coordinator";

const providerEntry: SettingsSearchEntry = {
  id: "provider-azure-api-key",
  category: "model",
  subpage: "model-providers",
  title: "Azure API Key",
  description: "Azure credential",
  keywords: ["azure"],
};

describe("settings search coordination", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    document.body.replaceChildren();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    document.body.replaceChildren();
  });

  it("preserves unrelated URL parameters when changing settings location", () => {
    const previous = new URLSearchParams(
      "tab=general&section=general&source=shared-link&preview=1",
    );

    const next = updateSettingsLocationParams(previous, "voice", "voice-tts");

    expect(next.toString()).toBe(
      "tab=voice&section=voice-tts&source=shared-link&preview=1",
    );
    expect(previous.toString()).toBe(
      "tab=general&section=general&source=shared-link&preview=1",
    );
  });

  it("prepares a provider before navigation and target focus", () => {
    const events: string[] = [];

    coordinateSettingsSearchSelection(providerEntry, {
      selectProvider: (provider) => events.push(`provider:${provider}`),
      setLocation: (category, subpage) =>
        events.push(`location:${category}:${subpage}`),
      focus: (id) => events.push(`focus:${id}`),
    });

    expect(events).toEqual([
      `provider:${ServiceProvider.Azure}`,
      "location:model:model-providers",
      "focus:provider-azure-api-key",
    ]);
  });

  it.each([
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
  ])("maps the %s search prefix", (prefix, provider) => {
    expect(getSettingsSearchProvider(`provider-${prefix}-api-key`)).toBe(
      provider,
    );
  });

  it("ignores ordinary entries", () => {
    expect(getSettingsSearchProvider("appearance-theme")).toBeUndefined();
  });

  it("retries until a delayed target appears, then highlights it", () => {
    const onPendingChange = jest.fn();
    const coordinator = createSettingsFocusCoordinator({
      retryDelay: 50,
      maxAttempts: 4,
      highlightDuration: 2000,
      onPendingChange,
    });

    coordinator.focus("delayed-setting");
    expect(coordinator.getPendingId()).toBe("delayed-setting");

    const target = document.createElement("section");
    target.id = "delayed-setting";
    target.scrollIntoView = jest.fn();
    document.body.appendChild(target);
    jest.advanceTimersByTime(50);

    expect(target).toHaveAttribute("data-highlighted", "true");
    expect(target.scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "center",
    });
    expect(onPendingChange).toHaveBeenLastCalledWith("delayed-setting");
  });

  it("clears a missing target after the finite retry budget", () => {
    const onPendingChange = jest.fn();
    const coordinator = createSettingsFocusCoordinator({
      retryDelay: 25,
      maxAttempts: 3,
      onPendingChange,
    });

    coordinator.focus("missing-setting");
    jest.advanceTimersByTime(50);

    expect(coordinator.getPendingId()).toBeUndefined();
    expect(onPendingChange).toHaveBeenLastCalledWith(undefined);
    expect(jest.getTimerCount()).toBe(0);
  });

  it("restarts the highlight duration for consecutive selections of the same id", () => {
    const target = document.createElement("section");
    target.id = "appearance-theme";
    target.scrollIntoView = jest.fn();
    document.body.appendChild(target);
    const coordinator = createSettingsFocusCoordinator({
      highlightDuration: 2000,
    });

    coordinator.focus("appearance-theme");
    jest.advanceTimersByTime(1000);
    coordinator.focus("appearance-theme");
    jest.advanceTimersByTime(1000);

    expect(target).toHaveAttribute("data-highlighted", "true");
    expect(coordinator.getPendingId()).toBe("appearance-theme");

    jest.advanceTimersByTime(1000);
    expect(target).not.toHaveAttribute("data-highlighted");
    expect(coordinator.getPendingId()).toBeUndefined();
  });

  it("cleans retry and highlight work when disposed", () => {
    const target = document.createElement("section");
    target.id = "voice-realtime-enable";
    target.scrollIntoView = jest.fn();
    document.body.appendChild(target);
    const onPendingChange = jest.fn();
    const coordinator = createSettingsFocusCoordinator({ onPendingChange });

    coordinator.focus("voice-realtime-enable");
    expect(target).toHaveAttribute("data-highlighted", "true");

    coordinator.dispose();
    expect(target).not.toHaveAttribute("data-highlighted");
    expect(coordinator.getPendingId()).toBeUndefined();
    expect(jest.getTimerCount()).toBe(0);

    jest.advanceTimersByTime(3000);
    expect(onPendingChange).not.toHaveBeenCalledWith(undefined);
  });
});
