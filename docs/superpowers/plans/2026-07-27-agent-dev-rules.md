# Agent 开发规则实现计划

> **给 Agent 执行者：** 推荐使用 superpowers:subagent-driven-development，或 superpowers:executing-plans，按任务逐步实现。步骤使用 checkbox（`- [ ]`）跟踪。

**目标：** 为 Claude Code / Codex 建立共享入口与空规则骨架，便于后续填写编码约定与领域规则，且不产生双份正文。

**架构：** `AGENTS.md` 为跨工具权威入口（短：概览、必读清单、硬约束、命令）。`CLAUDE.md` 为 Claude 薄包装，指向 `AGENTS.md`。规则正文只放在 `.agents/rules/`（`coding.md` 分节骨架、`domain.md` 占位）。v1 不改业务代码，不填充具体编码条文。

**技术栈：** 仅 Markdown（NextChat 仓库文档）。Spec：`docs/superpowers/specs/2026-07-27-agent-dev-rules-design.md`。

**Spec：** [2026-07-27-agent-dev-rules-design.md](../specs/2026-07-27-agent-dev-rules-design.md)

**说明：** 用户自管 git；执行者只负责创建/更新规则文件，不执行 commit。

---

## 文件结构

| 文件 | 职责 |
| --- | --- |
| `AGENTS.md` | 权威 Agent 入口：项目地图、必读清单、硬约束、命令 |
| `CLAUDE.md` | Claude 薄入口： defer 到 AGENTS + 可选 Claude 说明 |
| `.agents/rules/coding.md` | 编码约定骨架（仅分节；v1 无具体条文） |
| `.agents/rules/domain.md` | 领域规则占位 |

v1 不修改其他文件。正文使用**中文**。

---

### Task 1: 创建 `.agents/rules/` 下的规则骨架

**文件：**

- 创建：`.agents/rules/coding.md`
- 创建：`.agents/rules/domain.md`

- [x] **Step 1: 创建 rules 目录**

```bash
mkdir -p .agents/rules
```

- [x] **Step 2: 写入 `.agents/rules/coding.md`（中文骨架）**

见仓库当前文件（分节：通用 / 前端 / 后端 / 样式 / 测试）。

- [x] **Step 3: 写入 `.agents/rules/domain.md`（中文占位）**

见仓库当前文件（分节：Chat / Session、Account、API Providers、Config / Access）。

- [ ] **Step 4: 校验骨架结构**

```bash
test -f .agents/rules/coding.md && test -f .agents/rules/domain.md && \
  grep -q '## 前端' .agents/rules/coding.md && \
  grep -q '## 后端' .agents/rules/coding.md && \
  grep -q '## 样式' .agents/rules/coding.md && \
  grep -q '## 测试' .agents/rules/coding.md && \
  grep -q '## Chat / Session' .agents/rules/domain.md && \
  echo OK
```

期望输出：`OK`

---

### Task 2: 写入权威入口 `AGENTS.md`

**文件：**

- 创建/覆盖：`AGENTS.md`

- [x] **Step 1: 写入中文 `AGENTS.md`**

含：项目说明、目录速览、必读规则、硬约束、常用命令、维护约定。

- [ ] **Step 2: 校验指向两个规则文件**

```bash
grep -q '.agents/rules/coding.md' AGENTS.md && \
  grep -q '.agents/rules/domain.md' AGENTS.md && \
  grep -q '硬约束' AGENTS.md && \
  grep -q 'yarn test:ci' AGENTS.md && \
  echo OK
```

期望输出：`OK`

---

### Task 3: 写入薄包装 `CLAUDE.md`

**文件：**

- 创建/覆盖：`CLAUDE.md`

- [x] **Step 1: 写入中文 `CLAUDE.md`**

声明以 `AGENTS.md` 为准，列出必读路径，附 Claude 专属短说明（superpowers、skills、小 diff）。

- [ ] **Step 2: 校验包装指向 AGENTS**

```bash
grep -q 'AGENTS.md' CLAUDE.md && \
  grep -q '.agents/rules/coding.md' CLAUDE.md && \
  grep -q 'superpowers' CLAUDE.md && \
  echo OK
```

期望输出：`OK`

---

### Task 4: 端到端核对

**文件：** 无（只读检查）

- [ ] **Step 1: 确认四个产物存在且保持简短**

```bash
wc -l AGENTS.md CLAUDE.md .agents/rules/coding.md .agents/rules/domain.md
```

期望：`AGENTS.md` 约 40–80 行；`CLAUDE.md` 约 40 行以内；两个 rules 文件均为骨架体量。

- [ ] **Step 2: 确认入口未复制长正文**

占位句「待从代码提炼 / 待补充」应主要出现在 `.agents/rules/*`，而不是在入口里展开成完整条文。

- [ ] **Step 3: 确认未改业务代码（本功能范围）**

本功能只应涉及上述 Markdown 文件（以及已有的 spec/plan 文档）。不要把无关的 `app/` 改动混进本工作。

---

## Spec 覆盖对照

| Spec 要求 | 任务 |
| --- | --- |
| `AGENTS.md` 权威入口 | Task 2 |
| `CLAUDE.md` 薄包装 | Task 3 |
| `coding.md` 分节骨架 | Task 1 |
| `domain.md` 占位 | Task 1 |
| 单一事实源 / 入口不复制长文 | Task 2–4 |
| v1 不填编码条文 | Task 1 内容 |
| 不改业务 / 不做 path-scoped / 不改 linter | 全部（仅文档） |

## 明确不做（本 plan 不实现）

- 填充真实编码约定（v1.1）
- 填充领域规则（v1.2）
- 按 frontend/backend/styles 拆多文件
- `.claude/rules` globs
- ESLint / Prettier / CI 变更
- 由 Agent 执行 git commit（用户自行管理）
