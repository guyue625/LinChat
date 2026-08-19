# LinChat Settings Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 LinChat 设置页改造成已确认的紧凑 Workbench，补齐二级导航、设置搜索、统一控件、服务商凭证草稿保存、错误反馈和移动端交互。

**Architecture:** 保留现有 Zustand store、provider 枚举和路由入口，在设置页内部新增专用的布局/控件组件和显式搜索注册表。低风险配置继续直接写 store；模型服务商凭证由独立编辑器维护草稿，测试连接使用草稿值，保存时才原子写入现有 access store。

**Tech Stack:** Next.js 14、React 18、TypeScript、Sass Modules、Zustand、React Router、Fuse.js、Jest、Testing Library。

---

## 仓库约束

- 不修改 `app/components/auth.tsx`、`app/components/auth-character.tsx` 或登录页样式。
- 不重命名 `nextchat_session`、`chat-next-web-store`、`nextchat.sqlite`、`nextchat-sync`、`nextchat-provider` 或上游引用。
- 根据项目 `AGENTS.md`，执行者不得自行运行 Git 写命令。每个任务末尾只把建议命令交给主人执行。
- 工作区当前不使用额外 worktree；若主人希望隔离开发，应由主人自行创建或授权 Git worktree。

## 文件结构

**新增文件**

- `app/components/settings-schema.ts`：分类、二级页面、搜索条目和查询函数。
- `app/components/settings-schema.test.ts`：导航解析和搜索逻辑单测。
- `app/components/settings-controls.tsx`：`SettingSection`、`SettingRow`、`SettingSwitch`、`SettingsSubnav`。
- `app/components/settings-controls.module.scss`：设置页专用行、开关、二级导航和状态样式。
- `app/components/settings-controls.test.tsx`：设置控件可访问性和交互测试。
- `app/components/settings-search.tsx`：桌面下拉搜索和移动全屏搜索。
- `app/components/settings-search.test.tsx`：搜索分组、选择、无结果建议和快捷键测试。
- `app/components/provider-config-draft.ts`：provider 字段键、草稿复制、校验、脏值判断和上游连接源转换。
- `app/components/provider-config-draft.test.ts`：草稿、校验和 provider 映射单测。
- `app/components/provider-config-editor.tsx`：凭证草稿、测试连接、保存、状态和移动操作栏。
- `app/components/provider-config-editor.module.scss`：连接状态、错误和操作栏样式。
- `app/components/provider-config-editor.test.tsx`：未保存、测试和保存行为测试。
- `app/components/settings-leave-guard.ts`：统一离开确认和 `beforeunload` 注册。
- `app/components/settings-leave-guard.test.ts`：离开保护单测。
- `app/components/danger-confirm-dialog.tsx`：输入确认词的危险操作对话框。
- `app/components/danger-confirm-dialog.test.tsx`：确认词与按钮状态测试。
- `app/components/input-range.test.tsx`：滑杆、精确输入和恢复默认测试。
- `app/components/settings-style.test.ts`：关键品牌 token 和响应式规则的轻量防回归检查。

**主要修改文件**

- `app/components/settings.tsx:587-1395`：页面骨架、分类/二级导航、搜索协调、内容分区和离开保护。
- `app/components/settings.module.scss:1-618`：Workbench 页面布局、LinChat 主题 token 和响应式样式。
- `app/components/provider-config.tsx:31-834`：从直接写 store 改为受控字段渲染。
- `app/components/model-manager.tsx:1-617`：使用共享 provider 上游源，并适配新的设置行。
- `app/components/model-config.tsx:94-352`：适配设置行、设置 ID、开关和新版滑杆。
- `app/components/tts-config.tsx:13-133`：适配设置行、设置 ID、开关和新版滑杆。
- `app/components/realtime-chat/realtime-config.tsx:16-173`：适配设置行、设置 ID、开关和新版滑杆。
- `app/components/input-range.tsx:5-48`、`app/components/input-range.module.scss:1-16`：增加数字输入与恢复默认。
- `app/locales/cn.ts:170-650`、`app/locales/en.ts:172-650`：新增搜索、二级导航、保存、状态、错误和危险确认文案，并将设置页可见品牌改为 LinChat。

### Task 1: 建立设置导航和搜索注册表

**Files:**

- Create: `app/components/settings-schema.ts`
- Create: `app/components/settings-schema.test.ts`

- [ ] **Step 1: 写导航解析和搜索的失败测试**

```ts
import {
  DEFAULT_SETTINGS_SUBPAGES,
  resolveSettingsLocation,
  searchSettingsEntries,
  type SettingsSearchEntry,
} from "./settings-schema";

const entries: SettingsSearchEntry[] = [
  {
    id: "provider-openai-api-key",
    category: "model",
    subpage: "model-providers",
    title: "API Key",
    description: "OpenAI 接口密钥",
    keywords: ["密钥", "openai"],
  },
  {
    id: "appearance-theme",
    category: "appearance",
    subpage: "appearance",
    title: "主题",
    description: "浅色、暗色或跟随系统",
    keywords: ["外观", "dark", "light"],
  },
];

describe("settings schema", () => {
  it("falls back to the category default subpage", () => {
    expect(resolveSettingsLocation("model", "unknown")).toEqual({
      category: "model",
      subpage: DEFAULT_SETTINGS_SUBPAGES.model,
    });
  });

  it("matches titles and aliases and groups loose suggestions separately", () => {
    expect(searchSettingsEntries(entries, "密钥").results[0].id).toBe(
      "provider-openai-api-key",
    );
    expect(searchSettingsEntries(entries, "them").results[0].id).toBe(
      "appearance-theme",
    );
  });
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `yarn test:ci --runTestsByPath app/components/settings-schema.test.ts`

Expected: FAIL，提示无法找到 `./settings-schema`。

- [ ] **Step 3: 实现分类、二级页面和搜索类型**

```ts
import Fuse from "fuse.js";

export type SettingsCategory =
  | "general"
  | "model"
  | "appearance"
  | "voice"
  | "assistants"
  | "data";

export type SettingsSubpage =
  | "general"
  | "model-providers"
  | "model-catalog"
  | "model-defaults"
  | "appearance"
  | "voice-realtime"
  | "voice-tts"
  | "assistants"
  | "data-sync"
  | "data-transfer"
  | "data-danger";

export const DEFAULT_SETTINGS_SUBPAGES: Record<
  SettingsCategory,
  SettingsSubpage
> = {
  general: "general",
  model: "model-providers",
  appearance: "appearance",
  voice: "voice-realtime",
  assistants: "assistants",
  data: "data-sync",
};

export interface SettingsSearchEntry {
  id: string;
  category: SettingsCategory;
  subpage: SettingsSubpage;
  title: string;
  description: string;
  keywords: string[];
}

export function resolveSettingsLocation(
  categoryValue: string | null,
  subpageValue: string | null,
) {
  const category = (
    Object.keys(DEFAULT_SETTINGS_SUBPAGES).includes(categoryValue ?? "")
      ? categoryValue
      : "general"
  ) as SettingsCategory;
  const allowed = SETTINGS_SUBPAGES_BY_CATEGORY[category];
  const subpage = allowed.includes(subpageValue as SettingsSubpage)
    ? (subpageValue as SettingsSubpage)
    : DEFAULT_SETTINGS_SUBPAGES[category];
  return { category, subpage };
}

export function searchSettingsEntries(
  entries: SettingsSearchEntry[],
  query: string,
) {
  const value = query.trim();
  if (!value) return { results: [], suggestions: [] };
  const options = {
    keys: ["title", "description", "keywords"],
    ignoreLocation: true,
  } as const;
  const results = new Fuse(entries, { ...options, threshold: 0.32 })
    .search(value)
    .map(({ item }) => item);
  const suggestions = results.length
    ? []
    : new Fuse(entries, { ...options, threshold: 0.6 })
        .search(value)
        .slice(0, 3)
        .map(({ item }) => item);
  return { results, suggestions };
}
```

同时定义 `SETTINGS_SUBPAGES_BY_CATEGORY`，确保每个分类只接受自己的二级页面。

- [ ] **Step 4: 写完整搜索条目清单**

搜索注册表必须至少覆盖以下稳定 ID；标题、说明和关键词从 `Locale.Settings` 构建，不在组件内写中文：

| 分类 / 二级页面 | 设置 ID                                                                                                                                                                                                                                                                |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 通用            | `general-avatar`、`general-update`、`general-send-key`、`general-auto-title`、`general-artifacts`、`general-code-fold`                                                                                                                                                 |
| 模型 / 服务接入 | `model-access-code`、`model-custom-endpoint`、`model-provider`、`model-usage`，以及 `provider-<provider>-<field>`                                                                                                                                                      |
| 模型 / 模型目录 | `model-custom-models`                                                                                                                                                                                                                                                  |
| 模型 / 默认参数 | `model-default`、`model-temperature`、`model-top-p`、`model-max-tokens`、`model-presence-penalty`、`model-frequency-penalty`、`model-system-prompt`、`model-input-template`、`model-history-count`、`model-compress-threshold`、`model-memory`、`model-compress-model` |
| 外观            | `appearance-theme`、`appearance-language`、`appearance-font-size`、`appearance-font-family`                                                                                                                                                                            |
| 语音 / 实时语音 | `voice-realtime-enable`、`voice-realtime-provider`、`voice-realtime-model`、`voice-realtime-api-key`、`voice-realtime-azure-endpoint`、`voice-realtime-azure-deployment`、`voice-realtime-voice`、`voice-realtime-temperature`                                         |
| 语音 / TTS      | `voice-tts-enable`、`voice-tts-engine`、`voice-tts-model`、`voice-tts-voice`、`voice-tts-speed`                                                                                                                                                                        |
| 助理与提示词    | `assistants-splash`、`assistants-builtin`、`prompts-autocomplete`、`prompts-list`                                                                                                                                                                                      |
| 数据 / 同步备份 | `data-cloud-sync`                                                                                                                                                                                                                                                      |
| 数据 / 导入导出 | `data-local-transfer`                                                                                                                                                                                                                                                  |
| 数据 / 危险操作 | `data-reset-settings`、`data-clear-all`                                                                                                                                                                                                                                |

- [ ] **Step 5: 运行测试并确认通过**

Run: `yarn test:ci --runTestsByPath app/components/settings-schema.test.ts`

Expected: PASS。

- [ ] **Step 6: 向主人提供提交命令（执行者不要运行）**

```powershell
git add app/components/settings-schema.ts app/components/settings-schema.test.ts
git commit -m "feat(settings): add navigation and search schema"
```

### Task 2: 创建设置页专用控件并增强滑杆

**Files:**

- Create: `app/components/settings-controls.tsx`
- Create: `app/components/settings-controls.module.scss`
- Create: `app/components/settings-controls.test.tsx`
- Create: `app/components/input-range.test.tsx`
- Modify: `app/components/input-range.tsx:5-48`
- Modify: `app/components/input-range.module.scss:1-16`

- [ ] **Step 1: 写设置行、开关和滑杆的失败测试**

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { SettingRow, SettingSwitch } from "./settings-controls";
import { InputRange } from "./input-range";

it("renders a labelled setting row with status", () => {
  render(
    <SettingRow
      id="appearance-theme"
      title="主题"
      description="界面主题"
      status="即时生效"
    >
      <select aria-label="主题">
        <option>暗色</option>
      </select>
    </SettingRow>,
  );
  expect(screen.getByText("即时生效")).toBeInTheDocument();
  expect(document.getElementById("appearance-theme")).toBeInTheDocument();
});

it("uses a real checkbox for the switch", () => {
  const onChange = jest.fn();
  render(<SettingSwitch label="流式输出" checked onChange={onChange} />);
  fireEvent.click(screen.getByRole("checkbox", { name: "流式输出" }));
  expect(onChange).toHaveBeenCalledWith(false);
});

it("supports exact input and reset", () => {
  const onChange = jest.fn();
  const onReset = jest.fn();
  render(
    <InputRange
      aria="随机性"
      value="0.7"
      min="0"
      max="1"
      step="0.1"
      onChange={onChange}
      defaultValue="0.7"
      onReset={onReset}
    />,
  );
  fireEvent.change(screen.getByRole("spinbutton", { name: "随机性精确值" }), {
    target: { value: "0.8" },
  });
  expect(onChange).toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "恢复随机性默认值" }));
  expect(onReset).toHaveBeenCalled();
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `yarn test:ci --runTestsByPath app/components/settings-controls.test.tsx app/components/input-range.test.tsx`

Expected: FAIL，缺少新组件和新版 props。

- [ ] **Step 3: 实现专用控件**

`SettingRow` 使用 `<section id>`，包含标题/说明、控件和可选状态三列；`SettingSwitch` 使用原生 checkbox；`SettingsSubnav` 使用按钮和 `aria-current="page"`；`SettingSection` 负责标题、说明、状态和行容器。不要修改全局 `ListItem`。

核心接口固定为：

```ts
type SettingRowProps = {
  id: string;
  title: string;
  description?: React.ReactNode;
  status?: React.ReactNode;
  error?: string;
  children: React.ReactNode;
  danger?: boolean;
  vertical?: boolean;
};

type SettingSwitchProps = {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
};
```

- [ ] **Step 4: 增强 `InputRange`，保持现有事件接口兼容**

在原 props 上新增：

```ts
defaultValue?: number | string;
onReset?: () => void;
```

范围输入和数字输入都直接复用现有 `onChange: ChangeEventHandler<HTMLInputElement>`；只有同时提供 `defaultValue` 与 `onReset` 时才显示恢复按钮。数字输入沿用同一 `min`、`max`、`step`。

- [ ] **Step 5: 完成控件样式**

- 设置行桌面为 `minmax(180px, .8fr) minmax(260px, 1.2fr) auto`，移动端改为两行。
- 控件最小点击高度 34px；checkbox 开关保持完整键盘焦点。
- `error` 在控件下方以 `role="alert"` 渲染，并通过 `aria-describedby` 关联输入控件。
- `data-highlighted="true"` 使用蓝色左边缘与淡蓝背景，动画结束后由调用方移除属性。
- 危险行只改变标题/边缘色，不铺满红色背景。

- [ ] **Step 6: 运行测试并确认通过**

Run: `yarn test:ci --runTestsByPath app/components/settings-controls.test.tsx app/components/input-range.test.tsx`

Expected: PASS。

- [ ] **Step 7: 向主人提供提交命令（执行者不要运行）**

```powershell
git add app/components/settings-controls.tsx app/components/settings-controls.module.scss app/components/settings-controls.test.tsx app/components/input-range.tsx app/components/input-range.module.scss app/components/input-range.test.tsx
git commit -m "feat(settings): add workbench controls"
```

### Task 3: 实现页面骨架、二级导航和全局设置搜索

**Files:**

- Create: `app/components/settings-search.tsx`
- Create: `app/components/settings-search.test.tsx`
- Modify: `app/components/settings.tsx:587-920`
- Modify: `app/components/settings.module.scss:1-336`

- [ ] **Step 1: 写搜索组件失败测试**

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { SettingsSearch } from "./settings-search";

const entries = [
  {
    id: "provider-openai-api-key",
    category: "model" as const,
    subpage: "model-providers" as const,
    title: "API Key",
    description: "OpenAI 接口密钥",
    keywords: ["密钥", "openai"],
  },
];

it("groups results and returns the selected target", () => {
  const onSelect = jest.fn();
  render(<SettingsSearch entries={entries} onSelect={onSelect} />);
  fireEvent.change(screen.getByRole("searchbox", { name: "搜索设置" }), {
    target: { value: "API Key" },
  });
  fireEvent.click(screen.getByRole("option", { name: /API Key/ }));
  expect(onSelect).toHaveBeenCalledWith(
    expect.objectContaining({ id: "provider-openai-api-key" }),
  );
});
```

另加测试：空查询不显示结果、无结果显示宽松建议、`Escape` 关闭搜索、`Ctrl/Cmd + K` 聚焦搜索框。

- [ ] **Step 2: 运行测试并确认失败**

Run: `yarn test:ci --runTestsByPath app/components/settings-search.test.tsx`

Expected: FAIL，无法找到组件。

- [ ] **Step 3: 实现受控搜索组件**

- 桌面端：顶部输入框 + 分组结果浮层。
- 移动端：同一个 DOM 结构通过媒体查询变为全屏搜索层，避免维护两套逻辑。
- 使用 `role="listbox"` 和 `role="option"`；上下方向键切换选中项，Enter 选择。
- 组件只返回 `SettingsSearchEntry`，不自行操作路由或 DOM。

- [ ] **Step 4: 将设置位置写入查询参数**

`settings.tsx` 使用 `tab` 和新增的 `section` 参数：

```ts
const location = resolveSettingsLocation(
  searchParams.get("tab"),
  searchParams.get("section"),
);

function setSettingsLocation(
  category: SettingsCategory,
  subpage = DEFAULT_SETTINGS_SUBPAGES[category],
) {
  const next = new URLSearchParams(searchParams);
  next.set("tab", category);
  next.set("section", subpage);
  setSearchParams(next);
}
```

只有合法的分类/二级页面组合才能进入渲染；旧的 `?tab=model` 仍自动进入 `model-providers`。

- [ ] **Step 5: 实现搜索跳转和短暂高亮**

```ts
function focusSetting(entry: SettingsSearchEntry) {
  setPendingSettingId(entry.id);
  setSettingsLocation(entry.category, entry.subpage);
}

useEffect(() => {
  if (!pendingSettingId) return;
  const target = document.getElementById(pendingSettingId);
  if (!target) return;
  target.scrollIntoView({ behavior: "smooth", block: "center" });
  target.setAttribute("data-highlighted", "true");
  const timeout = window.setTimeout(() => {
    target.removeAttribute("data-highlighted");
    setPendingSettingId(undefined);
  }, 2000);
  return () => window.clearTimeout(timeout);
}, [location.category, location.subpage, pendingSettingId]);
```

effect cleanup 必须清理 timeout；目标尚未渲染时保留 `pendingSettingId`，等 active subpage 渲染后再定位。

- [ ] **Step 6: 重建桌面/移动页面骨架**

- 在 `Settings` 根部新增 `settings-page` 包裹 header 与 body。
- 桌面 sidebar 固定 216px，内容最大宽度 1000px。
- 移动端隐藏 sidebar，顶部显示分类 select 和搜索按钮。
- 分类切换设置默认二级页面；模型、语音、数据分类显示 `SettingsSubnav`。
- 删除当前仅绑定 state 的无效搜索输入实现。

- [ ] **Step 7: 运行搜索测试**

Run: `yarn test:ci --runTestsByPath app/components/settings-schema.test.ts app/components/settings-search.test.tsx`

Expected: PASS。

- [ ] **Step 8: 向主人提供提交命令（执行者不要运行）**

```powershell
git add app/components/settings.tsx app/components/settings.module.scss app/components/settings-search.tsx app/components/settings-search.test.tsx
git commit -m "feat(settings): add workbench navigation and search"
```

### Task 4: 建立服务商凭证草稿和连接源映射

**Files:**

- Create: `app/components/provider-config-draft.ts`
- Create: `app/components/provider-config-draft.test.ts`
- Modify: `app/components/model-manager.tsx:1-145`

- [ ] **Step 1: 写草稿逻辑失败测试**

测试必须覆盖：

```ts
it("copies credentials without store methods", () => {
  const draft = createProviderCredentialSnapshot(accessState);
  expect(draft.openaiApiKey).toBe("saved-key");
  expect(draft).not.toHaveProperty("update");
});

it("only emits fields for the selected provider", () => {
  expect(getProviderCredentialPatch(ServiceProvider.OpenAI, draft)).toEqual({
    openaiUrl: draft.openaiUrl,
    openaiApiKey: draft.openaiApiKey,
  });
});

it("rejects a malformed endpoint but allows an empty key", () => {
  expect(
    validateProviderDraft(ServiceProvider.OpenAI, {
      ...draft,
      openaiUrl: "ftp://bad",
    }),
  ).toHaveProperty("openaiUrl");
  expect(
    validateProviderDraft(ServiceProvider.OpenAI, {
      ...draft,
      openaiApiKey: "",
    }),
  ).not.toHaveProperty("openaiApiKey");
});

it("builds the upstream source from draft values", () => {
  expect(getProviderUpstreamSource(ServiceProvider.Azure, draft)).toMatchObject(
    {
      provider: ServiceProvider.Azure,
      baseUrl: draft.azureUrl,
      apiKey: draft.azureApiKey,
      apiVersion: draft.azureApiVersion,
    },
  );
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `yarn test:ci --runTestsByPath app/components/provider-config-draft.test.ts`

Expected: FAIL，模块不存在。

- [ ] **Step 3: 定义完整 credential key 集合**

包含现有 provider config 使用的全部字段：

```ts
export type ProviderCredentialKey =
  | "openaiUrl"
  | "openaiApiKey"
  | "azureUrl"
  | "azureApiKey"
  | "azureApiVersion"
  | "googleUrl"
  | "googleApiKey"
  | "googleApiVersion"
  | "googleSafetySettings"
  | "anthropicUrl"
  | "anthropicApiKey"
  | "anthropicApiVersion"
  | "baiduUrl"
  | "baiduApiKey"
  | "baiduSecretKey"
  | "bytedanceUrl"
  | "bytedanceApiKey"
  | "alibabaUrl"
  | "alibabaApiKey"
  | "tencentUrl"
  | "tencentSecretId"
  | "tencentSecretKey"
  | "moonshotUrl"
  | "moonshotApiKey"
  | "stabilityUrl"
  | "stabilityApiKey"
  | "iflytekUrl"
  | "iflytekApiKey"
  | "iflytekApiSecret"
  | "deepseekUrl"
  | "deepseekApiKey"
  | "xaiUrl"
  | "xaiApiKey"
  | "chatglmUrl"
  | "chatglmApiKey"
  | "siliconflowUrl"
  | "siliconflowApiKey"
  | "ai302Url"
  | "ai302ApiKey";

type AccessState = ReturnType<typeof useAccessStore.getState>;
export type ProviderCredentialSnapshot = Pick<
  AccessState,
  ProviderCredentialKey
>;
export type ProviderCredentialPatch = Partial<ProviderCredentialSnapshot>;
```

`PROVIDER_CREDENTIAL_KEYS` 为每个 `ServiceProvider` 显式列出字段，不能通过字段名猜测。

- [ ] **Step 4: 实现复制、比较、patch、校验和上游 source**

- 复制时只读取 credential key，不复制 Zustand 方法或服务端控制字段。
- 脏值比较只比较当前 provider 的字段，并对字符串做原值比较，避免用户输入被悄悄 trim。
- 保存 patch 时 URL 和密钥 trim；Google safety 枚举保持原类型。
- URL 非空时必须是 `http:` 或 `https:`；存在任一密钥但 endpoint 为空时为字段错误。
- `getProviderUpstreamSource` 迁移 `model-manager.tsx` 当前 switch 的完整行为，Tencent 继续使用 `tencentSecretId` 作为列表请求凭证。

- [ ] **Step 5: 让模型管理器复用共享 source**

删除 `model-manager.tsx` 内部 `getUpstreamSource`，改为：

```ts
fetchUpstreamModels(
  getProviderUpstreamSource(
    accessStore.provider,
    createProviderCredentialSnapshot(accessStore),
  ),
);
```

- [ ] **Step 6: 运行测试并确认通过**

Run: `yarn test:ci --runTestsByPath app/components/provider-config-draft.test.ts`

Expected: PASS。

- [ ] **Step 7: 向主人提供提交命令（执行者不要运行）**

```powershell
git add app/components/provider-config-draft.ts app/components/provider-config-draft.test.ts app/components/model-manager.tsx
git commit -m "refactor(settings): isolate provider credential drafts"
```

### Task 5: 实现服务商凭证编辑器、测试连接和保存

**Files:**

- Create: `app/components/provider-config-editor.tsx`
- Create: `app/components/provider-config-editor.module.scss`
- Create: `app/components/provider-config-editor.test.tsx`
- Modify: `app/components/provider-config.tsx:31-834`
- Modify: `app/components/settings.tsx:740-805,1250-1335`

- [ ] **Step 1: 写凭证编辑器失败测试**

使用受控 `initialValues`、`provider`、`onSave` 和 mock `fetchUpstreamModels`，覆盖：

```tsx
it("does not save while typing", () => {
  renderEditor();
  fireEvent.change(screen.getByLabelText("API Key"), {
    target: { value: "draft-key" },
  });
  expect(onSave).not.toHaveBeenCalled();
  expect(onDirtyChange).toHaveBeenLastCalledWith(true);
});

it("tests with draft values and saves only after clicking save", async () => {
  renderEditor();
  fireEvent.change(screen.getByLabelText("API Key"), {
    target: { value: "draft-key" },
  });
  fireEvent.click(screen.getByRole("button", { name: "测试连接" }));
  await waitFor(() =>
    expect(fetchUpstreamModels).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: "draft-key" }),
    ),
  );
  fireEvent.click(screen.getByRole("button", { name: "保存更改" }));
  expect(onSave).toHaveBeenCalledWith(
    expect.objectContaining({ openaiApiKey: "draft-key" }),
  );
});

it("keeps the draft after a failed test", async () => {
  fetchUpstreamModels.mockRejectedValueOnce(new Error("401 Unauthorized"));
  renderEditor();
  fireEvent.click(screen.getByRole("button", { name: "测试连接" }));
  expect(await screen.findByText(/401 Unauthorized/)).toBeInTheDocument();
  expect(screen.getByLabelText("API Key")).toHaveValue("saved-key");
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `yarn test:ci --runTestsByPath app/components/provider-config-editor.test.tsx`

Expected: FAIL，组件不存在。

- [ ] **Step 3: 将 `ProviderConfig` 改为受控字段组件**

固定 props：

```ts
type ProviderConfigProps = {
  provider: ServiceProvider;
  values: ProviderCredentialSnapshot;
  errors: Partial<Record<ProviderCredentialKey, string>>;
  onChange: <K extends ProviderCredentialKey>(
    key: K,
    value: ProviderCredentialSnapshot[K],
  ) => void;
};
```

把现有每个 provider 字段一对一迁移到描述表并由一个 renderer 输出 `SettingRow`。字段不得删除；Google safety 保留 select；所有密钥使用 `PasswordInput`；设置 ID 使用 `provider-${provider.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${field}`。

`ProviderConfigEditor` 的外部接口固定为：

```ts
type ProviderConfigEditorProps = {
  provider: ServiceProvider;
  initialValues: ProviderCredentialSnapshot;
  onSave: (patch: ProviderCredentialPatch) => void;
  onDirtyChange?: (dirty: boolean) => void;
};
```

- [ ] **Step 4: 实现编辑器状态机**

```ts
type ConnectionState =
  | { type: "idle" }
  | { type: "testing" }
  | { type: "success"; latencyMs: number; modelCount: number }
  | { type: "error"; message: string };
```

- provider 或已保存初值变化时，仅在当前没有脏值时同步草稿。
- 测试：先校验，再调用 `fetchUpstreamModels(getProviderUpstreamSource(provider, draft))`；成功记录延迟和模型数量，空数组仍表示连接成功。
- 保存：先校验，再将 `getProviderCredentialPatch` 交给 `onSave`；成功后更新 baseline、清除 dirty 和错误，并显示 Toast。
- 按钮在测试/保存期间 disabled，`aria-live="polite"` 播报连接状态。

- [ ] **Step 5: 在 `Settings` 中原子写入 access store**

```ts
const saveProviderCredentials = (patch: ProviderCredentialPatch) => {
  accessStore.update((access) => Object.assign(access, patch));
};
```

provider 切换先调用统一离开确认；确认后更新 `access.provider`。`useCustomConfig` 仍即时生效。

- [ ] **Step 6: 完成移动端固定操作栏**

只有 dirty 时显示；桌面端为 section 底部普通操作行，移动端固定在内容底部并包含 safe-area padding。

- [ ] **Step 7: 运行测试并确认通过**

Run: `yarn test:ci --runTestsByPath app/components/provider-config-draft.test.ts app/components/provider-config-editor.test.tsx`

Expected: PASS。

- [ ] **Step 8: 向主人提供提交命令（执行者不要运行）**

```powershell
git add app/components/provider-config.tsx app/components/provider-config-editor.tsx app/components/provider-config-editor.module.scss app/components/provider-config-editor.test.tsx app/components/settings.tsx
git commit -m "feat(settings): add staged provider credential editing"
```

### Task 6: 按二级页面重排现有设置内容

**Files:**

- Modify: `app/components/settings.tsx:920-1395`
- Modify: `app/components/model-manager.tsx:344-617`
- Modify: `app/components/model-config.tsx:94-352`
- Modify: `app/components/tts-config.tsx:13-133`
- Modify: `app/components/realtime-chat/realtime-config.tsx:16-173`

- [ ] **Step 1: 将一级分类内容迁移到 `SettingSection` / `SettingRow`**

- 通用和外观保留即时写 store；所有行使用 Task 1 的稳定 ID。
- 助理与提示词保留现有 modal 行为，只更换行组件和 ID。
- 原 `List` / `ListItem` 仅保留在提示词 modal、同步 modal、模型添加 modal 等非主设置内容中。

- [ ] **Step 2: 拆分模型三个二级页面**

- `model-providers`：SaaS 引导、访问码、自定义接口、provider 选择、`ProviderConfigEditor`、余额查询。
- `model-catalog`：`ModelManager`。
- `model-defaults`：`ModelConfigList`。

三个页面只渲染当前 active subpage，避免隐藏内容仍参与 tab 顺序。

- [ ] **Step 3: 拆分语音两个二级页面**

- `voice-realtime`：`RealtimeConfigList`。
- `voice-tts`：`TTSConfigList`。

补齐所有 input/select 的 `aria-label`，布尔值改用 `SettingSwitch`。

- [ ] **Step 4: 拆分数据三个二级页面**

- 把当前 `SyncItems` 拆为 `CloudSyncItems` 和 `LocalTransferItems`，功能实现不变。
- `data-sync` 显示云同步状态、配置和立即同步。
- `data-transfer` 显示本地概览、导入和导出。
- `data-danger` 显示重置与清除。

- [ ] **Step 5: 更新全部 `InputRange` 调用**

每个调用都从 `DEFAULT_CONFIG` 读取实际默认值并传入恢复 callback：字体、modelConfig 的 temperature/top_p/presence/frequency/history count、TTS speed 和 realtime temperature 均不得在多个组件重复硬编码。

- [ ] **Step 6: 保持模型与 provider 行为兼容**

- 不改变 `ServiceProvider`、`ModelProvider`、模型 token 格式或自定义模型字符串格式。
- `ModelManager` 继续只读取已保存的 access store；未保存的草稿只用于服务接入页的连接测试。
- 不修改账号工作区模型可见性判断。

- [ ] **Step 7: 运行模型管理器和滑杆测试**

Run: `yarn test:ci --runTestsByPath app/components/model-manager-modal.test.ts app/components/input-range.test.tsx`

Expected: PASS。

- [ ] **Step 8: 向主人提供提交命令（执行者不要运行）**

```powershell
git add app/components/settings.tsx app/components/model-manager.tsx app/components/model-config.tsx app/components/tts-config.tsx app/components/realtime-chat/realtime-config.tsx
git commit -m "refactor(settings): organize settings into workbench sections"
```

### Task 7: 增加未保存离开保护和危险操作确认

**Files:**

- Create: `app/components/settings-leave-guard.ts`
- Create: `app/components/settings-leave-guard.test.ts`
- Create: `app/components/danger-confirm-dialog.tsx`
- Create: `app/components/danger-confirm-dialog.test.tsx`
- Modify: `app/components/settings.tsx:245-282,608-1395`

- [ ] **Step 1: 写离开保护失败测试**

```ts
it("allows navigation when clean", async () => {
  await expect(confirmSettingsLeave(false, confirmFn)).resolves.toBe(true);
  expect(confirmFn).not.toHaveBeenCalled();
});

it("asks before discarding a dirty draft", async () => {
  confirmFn.mockResolvedValue(false);
  await expect(confirmSettingsLeave(true, confirmFn)).resolves.toBe(false);
});
```

另测试 `registerBeforeUnload(true)` 会对 `beforeunload` 调用 `preventDefault`，cleanup 后不再拦截。

- [ ] **Step 2: 写危险确认失败测试**

渲染 `DangerConfirmDialog`，确认输入不是 `DELETE` 时主按钮 disabled，输入完全匹配后才调用 `onConfirm`；取消必须不调用删除。

- [ ] **Step 3: 运行测试并确认失败**

Run: `yarn test:ci --runTestsByPath app/components/settings-leave-guard.test.ts app/components/danger-confirm-dialog.test.tsx`

Expected: FAIL，模块不存在。

- [ ] **Step 4: 实现统一离开保护**

- `confirmSettingsLeave` 接受 dirty 和异步 confirm 函数。
- `registerBeforeUnload` 只在 dirty 时注册。
- `Settings` 的关闭按钮、Escape、一级分类、二级页面、搜索跳转和 provider 切换全部先走同一 guard。
- 取消离开后不改变查询参数、provider 或草稿。

- [ ] **Step 5: 实现危险确认对话框**

- 重置设置继续普通二次确认。
- 清除全部数据使用 `DangerConfirmDialog`，确认词来自 locale；默认中文和英文均使用稳定文本 `DELETE`，避免语言切换造成不可预期。
- 对话框错误/说明使用 `aria-describedby`；移动端贴近底部显示。

- [ ] **Step 6: 运行测试并确认通过**

Run: `yarn test:ci --runTestsByPath app/components/settings-leave-guard.test.ts app/components/danger-confirm-dialog.test.tsx`

Expected: PASS。

- [ ] **Step 7: 向主人提供提交命令（执行者不要运行）**

```powershell
git add app/components/settings-leave-guard.ts app/components/settings-leave-guard.test.ts app/components/danger-confirm-dialog.tsx app/components/danger-confirm-dialog.test.tsx app/components/settings.tsx
git commit -m "feat(settings): guard drafts and destructive actions"
```

### Task 8: 落实 LinChat 视觉 token、状态样式和文案

**Files:**

- Create: `app/components/settings-style.test.ts`
- Modify: `app/components/settings.module.scss:1-618`
- Modify: `app/components/settings-controls.module.scss`
- Modify: `app/components/provider-config-editor.module.scss`
- Modify: `app/locales/cn.ts:170-650`
- Modify: `app/locales/en.ts:172-650`

- [ ] **Step 1: 写关键视觉约束失败测试**

```ts
import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(
  path.join(process.cwd(), "app/components/settings.module.scss"),
  "utf8",
);

it("keeps LinChat settings tokens and responsive breakpoints", () => {
  expect(source).toContain("--settings-accent: #f43d3f");
  expect(source).toContain("--settings-status: #4e8cff");
  expect(source).toContain("--settings-cream: #f3ede2");
  expect(source).toContain("max-width: 1000px");
  expect(source).toMatch(/max-width:\s*600px/);
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `yarn test:ci --runTestsByPath app/components/settings-style.test.ts`

Expected: FAIL，token 尚不存在。

- [ ] **Step 3: 在设置页根部定义独立主题 token**

浅色：奶油灰背景、暖白内容、深色文字；暗色：`#070610` / `#020208` 背景、`#f3ede2` 主要文字。两套主题都固定：

```scss
--settings-accent: #f43d3f;
--settings-status: #4e8cff;
--settings-cream: #f3ede2;
```

使用 `:global(.dark) .settings-page` 覆盖暗色 surface token，不改 `app/styles/globals.scss`，避免影响聊天页和登录页。

- [ ] **Step 4: 完成状态与交互样式**

- 红色：active nav、active tab、主保存按钮、错误和危险操作。
- 蓝色：连接成功、同步状态、搜索定位、focus ring。
- 设置行只使用分隔线和局部高亮，不恢复大卡片堆叠。
- hover、focus-visible、disabled、loading、error 都有独立状态；`prefers-reduced-motion` 关闭非必要动画。
- 900px 隐藏 sidebar；600px 设置行上下排列、搜索全屏、操作栏固定并处理 safe area。

- [ ] **Step 5: 补齐中英文文案**

增加二级导航、搜索分组/无结果/建议、即时生效、未保存、测试中、连接成功/失败、保存成功/失败、离开确认和危险确认词文案。将设置页中的 `使用 NextChat AI` 和对应介绍改为 `LinChat AI`，不修改 URL、存储 key 或仓库引用。

- [ ] **Step 6: 运行视觉约束测试**

Run: `yarn test:ci --runTestsByPath app/components/settings-style.test.ts`

Expected: PASS。

- [ ] **Step 7: 向主人提供提交命令（执行者不要运行）**

```powershell
git add app/components/settings.module.scss app/components/settings-controls.module.scss app/components/provider-config-editor.module.scss app/components/settings-style.test.ts app/locales/cn.ts app/locales/en.ts
git commit -m "style(settings): apply LinChat workbench theme"
```

### Task 9: 完成集成验证和回归检查

**Files:**

- Modify only when a failing verification identifies a regression: the exact files changed in Tasks 1-8
- Verify only: compatibility identifiers and login files

- [ ] **Step 1: 运行设置页定向测试**

Run:

```powershell
yarn test:ci --runTestsByPath app/components/settings-schema.test.ts app/components/settings-controls.test.tsx app/components/settings-search.test.tsx app/components/provider-config-draft.test.ts app/components/provider-config-editor.test.tsx app/components/settings-leave-guard.test.ts app/components/danger-confirm-dialog.test.tsx app/components/input-range.test.tsx app/components/settings-style.test.ts app/components/model-manager-modal.test.ts
```

Expected: 全部 PASS，无 open handle。

- [ ] **Step 2: 运行完整 Jest 回归**

Run: `yarn test:ci`

Expected: PASS。

- [ ] **Step 3: 运行 lint**

Run: `yarn lint`

Expected: 无 ESLint error；已有 warning 必须确认不是本次新增。

- [ ] **Step 4: 运行生产构建**

Run: `yarn build`

Expected: Next.js standalone build 成功，无 TypeScript 或 Sass 错误。

- [ ] **Step 5: 进行桌面与移动视觉/交互检查**

Run: `yarn dev`

检查 1440×900、1024×768、390×844：

- 六个一级分类和三个复杂分类的二级导航正确。
- 暗色/浅色层级、红色 active/CTA、蓝色状态与奶白标题符合确认预览。
- 搜索 API Key、主题、语音、导出能跳转并高亮。
- provider 输入不会立即改变 store；测试失败保留草稿；保存后重新进入仍存在。
- dirty 状态下切换分类、provider、关闭和 Escape 都会确认。
- 移动端没有横向溢出，固定操作栏不遮住最后一行。
- 清除全部数据只有输入 `DELETE` 后才能执行。

- [ ] **Step 6: 检查范围和兼容标识**

Run:

```powershell
git diff -- app/components/auth.tsx app/components/auth-character.tsx app/components/auth.module.scss
rg -n "nextchat_session|chat-next-web-store|nextchat\.sqlite|nextchat-sync|nextchat-provider" .
git diff --check
```

Expected: 登录页 diff 为空；兼容标识仍存在且未被重命名；`git diff --check` 无输出。

- [ ] **Step 7: 向主人提供最终提交命令（执行者不要运行）**

```powershell
git add app/components/settings.tsx app/components/settings.module.scss app/components/settings-schema.ts app/components/settings-schema.test.ts app/components/settings-controls.tsx app/components/settings-controls.module.scss app/components/settings-controls.test.tsx app/components/settings-search.tsx app/components/settings-search.test.tsx app/components/provider-config-draft.ts app/components/provider-config-draft.test.ts app/components/provider-config-editor.tsx app/components/provider-config-editor.module.scss app/components/provider-config-editor.test.tsx app/components/settings-leave-guard.ts app/components/settings-leave-guard.test.ts app/components/danger-confirm-dialog.tsx app/components/danger-confirm-dialog.test.tsx app/components/provider-config.tsx app/components/model-manager.tsx app/components/model-config.tsx app/components/tts-config.tsx app/components/realtime-chat/realtime-config.tsx app/components/input-range.tsx app/components/input-range.module.scss app/components/input-range.test.tsx app/components/settings-style.test.ts app/locales/cn.ts app/locales/en.ts docs/superpowers/specs/2026-08-14-settings-workbench-design.md docs/superpowers/plans/2026-08-14-settings-workbench.md
git commit -m "feat(settings): deliver LinChat settings workbench"
```
