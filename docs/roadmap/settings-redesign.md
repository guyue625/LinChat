# 设置页重设计（参考 LobeHub）

> 配套路线图见 `lobe-redesign.md`。复用 P0~P2 已落地的 Lobe 视觉基础（留白、圆角、弱边框、弱分组的 List 卡片）。

## 1. 现状问题

`app/components/settings.tsx`（1975 行单文件）当前形态：

- **无分类导航**：单页平铺滚动，7 个 `<List>` 顺序排列，49 个设置项靠滚动浏览。
- **接入区是重灾区**：第 5 个 List 把「是否用自定义配置 / 选哪家服务商 / 这家的 endpoint+key 配置 / 用量查询 / 自定义模型管理」5 件不同层级的事揉在一起；16 家服务商配置都是手写的近 50 行重复样板，无 `<ProviderConfig>` 抽象。
- **割裂**：「服务商接入配置」(Group E) 和「模型参数配置」(Group F) 拆到了两个不相邻的 List，但用户心智上是同一件事（用哪家模型 + 怎么用），得来回滚。
- **顺序随机**：面具、提示词、实时、TTS、危险区全部并列，没有「常用 → 高级」的层级。

## 2. 设计目标

1. 引入**左侧分类导航 + 右侧内容**双栏布局（点击分类切换右侧，不再长滚动）。
2. 按**用户心智**重新分 6 类，把「接入服务商」和「模型参数」收拢到一个大类。
3. 抽象出 `<ProviderConfig>` 复用组件，消灭 16 份样板。
4. 不改变任何设置项的语义和数据结构（store 不动），只重排层级和导航。

## 3. 信息架构（6 大类）

参考 LobeHub 的分类心智（通用 / 模型供应商 / 外观 / 语音 / 数据 / 关于），结合 NextChat 实际项：

```
设置
├─ 通用          General       ← 最常用，默认进入
├─ 模型          Model          ← 接入 + 参数 二合一，最大改动
│   ├─ 服务商配置（provider 切换 + 该 provider endpoint/key + usage）
│   └─ 默认模型与参数（model/temperature/topP/maxTokens/...）
├─ 外观          Appearance
├─ 语音          Voice          ← 实时对话 + TTS 合并
├─ 数据          Data           ← 同步 + 面具 + 提示词 + 危险区
└─ 关于          About
```

### 3.1 各类内容明细（49 项全量映射）

| 新分类 | 含原来的哪些项 | Locale key（现状） |
|---|---|---|
| **通用 General** | 头像、版本/更新、发送键、自动生成标题、发送预览气泡、Artifacts、代码折叠 | Avatar / Update.Version / SendKey / AutoGenerateTitle / SendPreviewBubble / Mask.Config.Artifacts / Mask.Config.CodeFold |
| **模型 Model** | 见下方 3.2 | — |
| **外观 Appearance** | 主题、界面语言、字号、字体族 | Theme / Lang.Name / FontSize / FontFamily |
| **语音 Voice** | 实时对话全部 7 项 + TTS 全部 5 项 | Realtime.* / TTS.* |
| **数据 Data** | 云同步、本地备份、面具启动屏、隐藏内置面具、禁用提示词、提示词列表、重置、清空 | Sync.* / Mask.* / Prompt.* / Danger.Reset / Danger.Clear |
| **关于 About** | SaaS 起步入口 + 版本信息(通用区移过来或重复锚点) + 更新检查日志 | Access.SaASStart / Update.* |

> 说明：「版本」在 Lobe 里放「关于」。这里把它从通用挪到关于，通用更聚焦会话行为。

### 3.2 模型 Model 类的内部结构（重点）

这一类把原来的 Group E（接入）和 Group F（参数）合并，并用**子区块**组织，而非平铺：

```
模型
├─ [子区块 A] 服务商配置
│   ├─ 使用自定义配置（开关）   ← 原 CustomEndpoint
│   ├─ access code（条件显示，showAccessCode）
│   ├─ 服务商选择（Select）     ← 原 Provider
│   ├─ <ProviderConfig provider={X} />   ← 新抽象组件，按选中 provider 渲染对应 endpoint/key
│   ├─ 用量查询（按钮 + 副标题，shouldHideBalanceQuery 条件）
│   └─ <ModelManager />         ← 按服务商的自定义模型 CRUD（从原 Group E 平移过来）
│
└─ [子区块 B] 默认模型与参数
    ├─ 模型（Select，optgroup 按服务商分组）  ← 原 ModelConfigList
    ├─ Temperature / TopP / MaxTokens
    ├─ PresencePenalty / FrequencyPenalty（Google 时隐藏）
    ├─ 注入系统提示 / 输入模板（Google 时隐藏）
    ├─ 历史条数 / 压缩阈值
    ├─ 发送记忆
    └─ 压缩模型（Select）
```

子区块 A 和 B 都没有独立的左导航项 —— 它们是「模型」页内的两个 List 卡片，上下排列。这样接入和参数逻辑上同屏，用户配置完服务商往下滚就到参数，符合心智。

## 4. 布局与组件

### 4.1 双栏布局

```
┌──────────────────────────────────────────┐
│ 设置                              [✕]      │  window-header（保留）
├──────────┬───────────────────────────────┤
│ 通用     │                               │
│ 模型     │   <当前选中分类的 List 内容>    │
│ 外观     │                               │
│ 语音     │                               │
│ 数据     │                               │
│ 关于     │                               │
└──────────┴───────────────────────────────┘
   ↑ 左导航        ↑ 右内容区（单一滚动）
  220px 固定         flex:1
```

- 左导航：垂直 `<List>` 风格菜单项，复用 Lobe 弱分组视觉；选中项高亮（背景 + 左侧色条）。
- 右内容：原来每个分类的若干 `<List>` 卡片直接渲染在此，不再平铺全部。
- 移动端：左导航折叠为顶部下拉或抽屉（呼应 P3 已做的侧栏响应式）。

### 4.2 分类状态管理

新增本地 state：

```ts
type SettingsCategory = "general" | "model" | "appearance" | "voice" | "data" | "about";
const [activeCategory, setActiveCategory] = useState<SettingsCategory>("general");
```

- 不入路由、不持久化 —— Lobe 也不持久化设置分类，每次打开默认「通用」即可。
- 右内容区用 `switch(activeCategory)` 渲染对应区块。
- 每个分类抽成内部子组件：`<GeneralSection />`、`<ModelSection />` 等，便于把 1975 行拆瘦。

### 4.3 `<ProviderConfig>` 抽象组件（消除 16 份样板）

现状 16 家服务商各写一套 50~95 行几乎一样的 JSX（endpoint + key，部分多 apiVersion/secretKey）。抽象为：

```tsx
// app/components/settings/provider-config.tsx
interface ProviderConfigProps {
  provider: ServiceProvider;
}
// 内部用一张「字段 schema」表声明每个 provider 需要哪些字段：
//   { endpoint: true, apiKey: true, apiVersion?: bool, secretKey?: bool, extraSafetySelect?: bool }
// 按 schema 渲染对应 FieldType，读写 accessStore 对应字段。
```

收益：
- `openAIConfigComponent ... ai302ConfigComponent` 16 个 const 删掉，settings.tsx 主文件瘦约 700 行。
- 新增服务商只改 schema 表一处。
- 字段语义不丢失（accessStore 读写完全一样）。

## 5. 迁移映射表（落地核对用）

| 旧位置 | 新位置 | 备注 |
|---|---|---|
| Group A 第 1 个 List（11 项）| 拆分：通用 7 项 + 外观 4 项 | 版本移到关于 |
| Group B `<SyncItems />` | 数据 | 整体平移 |
| Group C 面具 List（2 项）| 数据 | |
| Group D 提示词 List（2 项）| 数据 | |
| Group E 接入 List（SaaS/accesscode/provider/16 config/usage/ModelManager）| 模型 → 子区块 A | SaaS 移到关于 |
| Group F `<ModelConfigList />`（12 项）| 模型 → 子区块 B | |
| Group G `<RealtimeConfigList />` | 语音 | |
| Group H `<TTSConfigList />` | 语音 | |
| Group I `<DangerItems />` | 数据 | 放数据分类末尾 |

## 6. 落地步骤（建议顺序）

- [ ] **S1** 抽出 `<ProviderConfig>`，先原地替换 16 份样板，不改导航。验证设置页行为不变（store 读写对比）。← 风险最低、收益最大，先做。
- [ ] **S2** 把 `Settings` 主组件按分类拆成 6 个 `*Section` 子组件，仍顺序渲染（不引入导航）。验证无回归。
- [ ] **S3** 引入 `activeCategory` state + 左导航 + 右内容 switch 布局。
- [ ] **S4** 移动端响应式（左导航 → 抽屉/下拉），对齐 P3。
- [ ] **S5** 视觉验收：浅色/深色、1280/1440/移动端、各分类空状态与超长内容滚动。
- [ ] **S6** 国际化：6 个分类名补 `Locale.Settings.Category.*`。

## 7. 风险与约束

- **store 不动**：本次只重排 UI 层级，`accessStore` / `modelConfig` / `syncStore` 等读写一律保留原字段。
- **SlotID.CustomModel**：第 5 个 List 的 `id` 是外部锚点注入点，拆分后需确认 `app/data/` 等是否有外部代码依赖该 slot（迁移前 grep 一次）。
- **Google provider 特例**：模型参数多项对 Google 隐藏，迁移到子区块 B 时保留 `provider === Google` 的条件渲染逻辑。
- **`notify`/windows 家族配置**（你环境里有）与本次无关，不碰。
- 实施时与另一条在动 settings.tsx 的改动线协调，避免合并冲突 —— S1 先不碰导航最安全。

## 8. 与已有路线图的关系

- 视觉基线复用 `lobe-redesign.md` P0~P2 成果，本文件不重复规定圆角/留白等视觉 token。
- 建议在 `lobe-redesign.md` 的 **P3 信息架构与响应式** 下补一条「设置页分类导航（见 settings-redesign.md）」作为子项，使两份文档挂上钩。
