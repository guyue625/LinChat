# Agent 开发指南（NextChat）

本文件是编码类 Agent 的**权威入口**（Codex、经 `CLAUDE.md` 进入的 Claude，以及其他同类工具）。

## 项目

NextChat 是可自托管的多模型聊天 Web 应用（ChatGPT 风格界面），可选 Tauri 桌面端构建。

**技术栈：** Next.js 14、React 18、TypeScript、Sass modules、Zustand、Jest，多模型 API 位于 `app/api`。

## 目录速览

| 路径 | 职责 |
| --- | --- |
| `app/components/` | UI 组件（`*.tsx` + 同目录 `*.module.scss`、测试） |
| `app/store/` | Zustand stores（chat、config、access 等） |
| `app/api/` | API 路由与模型 provider 适配 |
| `app/styles/` | 全局 / 共享 SCSS |
| `app/locales/` | i18n 文案 |
| `app/masks/` | Prompt masks；通过 `yarn mask` 构建 |
| `app/mcp/` | MCP 相关客户端逻辑 |
| `docs/superpowers/specs/` | 功能设计 spec |
| `docs/superpowers/plans/` | 实现计划 |
| `.agents/rules/` | 共享 Agent 规则正文（单一事实源） |

## 必读规则

做非琐碎改动前请阅读：

1. [`.agents/rules/coding.md`](.agents/rules/coding.md) — 编码约定（v1 为骨架，后续再填）
2. [`.agents/rules/domain.md`](.agents/rules/domain.md) — 领域规则（v1 为占位）

**不要**在本文件复制大段规则正文。正文只维护在 `.agents/rules/` 下，本入口保持简短。

## 硬约束

- 匹配周围代码风格（命名、抽象层级、注释密度）。不要顺手重排无关代码。
- 不要提交密钥、API Key 或 `.env.local` 内容。
- 优先最小改动完成任务；未经确认不要扩大范围。
- 不要臆造领域规则；若 `domain.md` 仍是占位，应先问人或查代码，而不是猜测。
- 格式由 Prettier / ESLint（`next/core-web-vitals`）约束；Agent 文档不要重复写格式细则。
- **危险操作须确认：** 涉及删除文件/目录、覆盖重要配置、重置数据、强制推送、改远程、改权限、批量不可逆改动等危险操作时，先向用户说明影响并取得确认，再执行。
- **Git 写操作须交还用户：** 允许只读查询（如 `git status`、`git diff`、`git log`、`git show`、`git branch` 查看类）。禁止自行执行会改动仓库状态或与远程交互的命令，尤其是 `add` / `commit` / `push` / `pull` / `fetch`（若会改本地跟踪）、`checkout`/`switch` 切分支、`merge` / `rebase` / `reset` / `tag` 等。若需要提交或推送，只把完整命令写给用户，由用户确认后自行执行。

## 常用命令

| 命令 | 用途 |
| --- | --- |
| `yarn dev` | 本地 Next 开发（同时 watch masks） |
| `yarn lint` | Next ESLint |
| `yarn test:ci` | Jest 单次跑完（CI 模式） |
| `yarn test` | Jest watch |
| `yarn build` | standalone 生产构建 |
| `yarn mask` | 重建 masks |

## 维护约定

- 规则**正文**只放在 `.agents/rules/`。
- 增删或重命名规则文件时，同步更新本文件的必读清单（以及 `CLAUDE.md` 中的路径列表）。
- 优先在 `coding.md` / `domain.md` 内加节；某一节约 100 行以上再拆新文件。
