# Claude Code

本仓库的项目规则以 **[`AGENTS.md`](AGENTS.md)** 为准，请将其视为权威来源。

## 必读

1. [`AGENTS.md`](AGENTS.md) — 项目地图、硬约束、常用命令
2. [`.agents/rules/coding.md`](.agents/rules/coding.md) — 编码约定（填满前为骨架）
3. [`.agents/rules/domain.md`](.agents/rules/domain.md) — 领域规则占位

不要在本文件维护第二份长规则正文。

## Claude 专属说明

- 本仓库使用 **superpowers** 流程文档：`docs/superpowers/specs/` 与 `docs/superpowers/plans/`。多步骤功能若已有批准的 spec/plan，优先按文档执行。
- 适用时优先使用已有 project skills/hooks；用户指示与 `AGENTS.md` 仍高于 skill 默认行为。
- 保持小 diff；沿用本地 Sass module、Zustand、`app/api` provider 等既有模式，不要另起一套架构。
