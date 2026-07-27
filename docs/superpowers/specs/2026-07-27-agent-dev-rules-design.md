# Agent Dev Rules Design

## Goal

为 Claude Code 与 Codex 建立**共享、可维护**的项目开发规则体系：入口统一、正文分类存放、首版先搭骨架，编码约定与领域规则后续按真实代码再填。

## Background

- 仓库根目录已有空的 `AGENTS.md`、`CLAUDE.md`
- 已有 `.claude/settings.json`（仅少量 Bash 权限）、空的 `.agents/`、`.Codex/changelogs/`
- 项目为 NextChat（Next.js 14 + React + Sass modules + Zustand + 多 provider API）
- 已使用 superpowers 的 `docs/superpowers/specs|plans` 流程
- 目标工具：**Claude Code + Codex 共享一份规则**，避免双份漂移
- 内容重心：**编码约定**为主；**领域规则**先占位
- 分类策略：文件级先粗分（coding / domain），编码约定**文件内**再分前端/后端/样式等；单节变长后再拆文件

## Chosen Approach

**共享核心 + 轻量分类（方案 C）**

- `AGENTS.md` 为跨工具权威入口
- `CLAUDE.md` 为 Claude 薄包装，引用 `AGENTS.md`，可附 Claude 专属补充
- 规则正文在 `.agents/rules/`，入口只索引不复制长文
- 不按 frontend / backend / styles 过早拆多文件

## File Layout

```text
AGENTS.md                      # 权威入口（Codex / 通用 agent）
CLAUDE.md                      # Claude 薄入口 → 引用 AGENTS.md
.agents/rules/
  coding.md                    # 编码约定（首版：分节骨架；正文后补）
  domain.md                    # 领域规则（首版：占位骨架）
```

### Load Relationship

| 工具 | 读取顺序 |
|------|----------|
| Codex / 通用 | `AGENTS.md` → 必读清单中的 `.agents/rules/*` |
| Claude Code | `CLAUDE.md` → `AGENTS.md` → 同上规则文件 |

规则**正文只维护一份**。禁止在 `CLAUDE.md` / `AGENTS.md` 中复制长文副本。

### Split Threshold

- 文件级默认只有 `coding.md`、`domain.md`
- `coding.md` 内用二级标题分段：通用 / 前端 / 后端 / 样式 / 测试
- **当某一节稳定超过约 100 行**时，再升格为独立文件（例如 `coding-styles.md`），并更新入口必读清单
- 不引入 path-scoped 自动规则（如 Claude rules globs）；需要时另开设计

## Entry Contents

### `AGENTS.md`（权威，保持短）

1. 项目一句话说明 + 技术栈
2. 目录速览（`app/components`、`app/store`、`app/api`、`app/styles` 等）
3. **必读规则清单**（指向 `.agents/rules/coding.md`、`domain.md`）
4. **全局硬约束**（少而硬，可直接写在入口）：例如匹配周围代码风格、不提交密钥、不无故扩大改动面
5. 常用命令（`yarn dev` / `yarn test:ci` / `yarn lint` 等）

### `CLAUDE.md`（薄）

- 声明：项目开发规则以 `AGENTS.md` 为准
- 重复或引用必读清单（便于 Claude 启动时看到）
- 可选补充：本仓库使用 superpowers（`docs/superpowers/specs`、`plans`）、相关 skill 提醒
- 不写与 `AGENTS.md` 重复的长规则正文

## Rule File Skeletons

### `coding.md`（首版仅骨架）

首版**只建立分节标题与「待从代码提炼」说明**，不填充具体条文。

预定分节：

| 节 | 后续填写来源（实现填充阶段） |
|----|------------------------------|
| 通用 | TypeScript、命名、文件组织、注释密度跟周围代码 |
| 前端 | React 组件、hooks、Zustand store 用法 |
| 后端 | `app/api` 路由、provider 适配模式 |
| 样式 | `*.module.scss`、主题 class、避免无必要全局样式 |
| 测试 | Jest + Testing Library 约定 |

填写原则（后续）：只写**从本仓库代码 squint 出的真实约定**，不写通用最佳实践空话；不与 ESLint / Prettier 已强制的格式细则重复。

### `domain.md`（首版占位）

- 说明：领域规则待业务边界清晰后补充
- 预留空节骨架，例如：Chat / Session、Account、API Providers、Config / Access
- 每节标注「待补充」，禁止猜测性业务规则

## Maintenance Rules

1. **单一事实源**：正文只在 `.agents/rules/`；入口只索引
2. **新增规则**：能进现有节就不要新建文件；单节过长再拆
3. **禁止**：过时空话、与 linter/formatter 重复的纯格式细则、未验证的领域断言
4. **变更入口**：增删规则文件或重命名时，同步更新 `AGENTS.md`（及 `CLAUDE.md`）必读清单
5. **双工具**：默认不维护 Claude / Codex 两套不同正文；工具差异只放在各自薄入口的短补充段

## Implementation Scope

### v1（本 design 对应的首版实现）

1. 写入 `AGENTS.md` 权威薄入口（项目速览、必读清单、硬约束、命令）
2. 写入 `CLAUDE.md` 薄包装（引用 AGENTS + 可选 Claude 补充）
3. 创建 `.agents/rules/coding.md` **分节骨架**（无具体条文）
4. 创建 `.agents/rules/domain.md` **占位骨架**
5. 不修改业务代码
6. 不强制改 `.claude/settings.json`（除非后续发现读规则需要额外权限）

### Explicitly out of v1

- 填充 `coding.md` 的具体编码条文（单独 follow-up）
- 填充完整领域规则
- 按 frontend / backend / styles 拆成多个文件
- path-scoped / glob 自动加载规则
- 改 ESLint、Prettier 或 CI

### Follow-up（非本 design 阻塞）

- **v1.1**：扫代码提炼并写入 `coding.md` 各节真实约定
- **v1.2**：按模块逐步补 `domain.md`
- 单节过长时再物理拆分文件

## Success Criteria

- Claude Code 与 Codex 都能从入口找到同一套规则路径
- 入口文件短、可扫读；长文不出现在入口
- `coding.md` / `domain.md` 骨架齐全，后续可直接往对应节填
- 无业务代码变更；无双份规则正文

## Non-Goals

- 不把 superpowers 的全部 skill 流程抄进规则文件
- 不替代 README / 用户文档
- 不做多 agent 编排或自定义 subagent 定义（可另开）
