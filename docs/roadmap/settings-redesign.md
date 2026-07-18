# 设置页重设计（参考 LobeHub）

> 配套路线图见 `lobe-redesign.md`。复用 P0~P2 已落地的 Lobe 视觉基础（留白、圆角、弱边框、弱分组 List 卡片）。
>
> 实施状态：第一阶段已于 2026-07-18 落地。

## 1. 改造目标

改造前的 `app/components/settings.tsx` 为 1975 行单文件，约 9 个主要设置分组全部在同一页面纵向平铺；服务商字段包含 16 份重复 JSX，设置查找和后续维护成本都较高。

本次改造遵循以下约束：

1. 使用设置分类导航替代全量长滚动。
2. 按 NextChat 的用户心智组织分类，不直接复制 LobeHub 的产品分类。
3. 合并“服务商接入”和“默认模型参数”。
4. 保留现有 store 字段、立即保存语义和条件渲染逻辑。
5. Provider 配置先做低风险代码搬迁，不在同一阶段改写为 schema。

## 2. 最终信息架构

```text
设置
├─ 通用                 General
├─ 模型与服务商         Model
│  ├─ 服务商接入
│  └─ 默认模型与参数
├─ 外观                 Appearance
├─ 语音                 Voice
│  ├─ 实时语音
│  └─ 文字转语音
├─ 助理与提示词         Assistants
│  ├─ 助理偏好
│  └─ 提示词
└─ 数据与隐私           Data
   ├─ 同步与备份
   └─ 危险操作
```

### 2.1 分类映射

| 新分类       | 设置内容                                                                              |
| ------------ | ------------------------------------------------------------------------------------- |
| 通用         | 头像、版本与更新、发送键、自动生成标题、预览气泡、Artifacts、代码折叠                 |
| 模型与服务商 | SaaS 入口、访问码、自定义配置、服务商、Endpoint/Key、用量、自定义模型、默认模型及参数 |
| 外观         | 主题、界面语言、字号、字体族                                                          |
| 语音         | Realtime 全部条件设置、TTS 全部条件设置                                               |
| 助理与提示词 | 助理启动页、隐藏内置助理、提示词提示开关、提示词列表                                  |
| 数据与隐私   | 云同步、导入导出、重置设置、清空数据                                                  |

“关于”当前内容不足以形成稳定一级分类，因此版本号显示在设置导航底部，完整更新操作保留在“通用”。未来增加更新日志、许可证、诊断信息和隐私政策后再升级为独立分类。

## 3. 页面与路由设计

### 3.1 专属 Settings Shell

设置路由不再渲染会话侧栏，避免形成“全局侧栏 + 设置侧栏 + 内容”的三栏结构。

```text
┌──────────────────────────────────────────┐
│ 设置 / 当前分类                    [关闭] │
├────────────┬─────────────────────────────┤
│ 设置分类   │ 当前分类标题                │
│            │                             │
│            │ List 卡片                   │
│            │                             │
│ 版本信息   │                             │
└────────────┴─────────────────────────────┘
```

- 桌面端：196px 分类导航 + 最大约 960px 的居中内容区。
- 900px 以下：隐藏左导航，使用顶部分类 Select。
- 600px 以下：缩小内容留白，继续使用顶部分类 Select，不增加嵌套抽屉。
- 右侧内容区单独滚动。

### 3.2 URL 驱动分类

分类不写入业务 store，通过查询参数表达：

```text
#/settings?tab=general
#/settings?tab=model
#/settings?tab=appearance
#/settings?tab=voice
#/settings?tab=assistants
#/settings?tab=data
```

无参数或非法参数回退到 `general`。这样支持刷新、直接链接和浏览器前进/后退，也为“前往模型设置”等精确入口保留能力。

## 4. 组件调整

### 4.1 `ProviderConfig`

新增：

```text
app/components/provider-config.tsx
```

第一阶段只将 16 家 Provider 的现有字段 JSX 和 store 读写整体移出 `settings.tsx`，保持所有特殊逻辑不变，包括：

- Azure API Version
- Google API Version 与 Safety Settings
- Baidu/Tencent/Iflytek 多密钥字段
- 各 Provider Endpoint、Placeholder 和 Locale 文案

后续如需要 schema 化，应在 Provider 字段可见性和 setter 映射测试完善后单独实施。

### 4.2 分类内容

当前分类在同一设置页面中按条件挂载，未选分类不渲染，避免隐藏内容仍参与布局或产生超长滚动。Prompt Modal 保持页面级挂载，现有 store 更新函数不变。

## 5. 已完成步骤

- [x] **S0** 记录 TypeScript 与测试基线。
- [x] **S1** 抽出 `ProviderConfig`，保留现有 Provider 行为。
- [x] **S2** 将现有设置内容映射到 6 个逻辑 Section。
- [x] **S3** 引入 URL 驱动分类导航和专属 Settings Shell。
- [x] **S4** 添加桌面/窄屏/移动端响应式。
- [x] **S5** 添加分类标题、卡片标题、选中态、焦点态和危险区语义。
- [x] **S6** 添加中英文分类及 Section 文案，其他语言使用英文 fallback。

## 6. 验证结果

- TypeScript：`yarn tsc --noEmit` 通过。
- Jest：36 个测试套件、166 个测试通过。
- 变更文件定向 ESLint：通过。
- 全量 `yarn lint`：被现有 `app/constant.ts` 上的 `unused-imports/no-unused-imports` 插件异常阻断，与本次设置页代码无关。
- Production build：本地已有开发服务占用 `.next/trace`，构建报 `EPERM`；未终止用户现有进程。

## 7. 后续可选增强

- 默认模型参数增加“高级参数”折叠。
- 自定义模型管理改为 Modal/Drawer，进一步缩短模型页。
- 为 Provider 字段补充可见性与 store setter 测试后再引入类型化 descriptor。
- 设置项继续增长后增加搜索。
- “关于”内容达到规模后恢复为独立一级分类。
