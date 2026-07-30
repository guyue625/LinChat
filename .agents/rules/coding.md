# 编码约定

> **状态（v1）：** 仅骨架。不要在这里编造通用最佳实践。
> 各节内容后续从本仓库真实代码提炼（follow-up v1.1）。
> 某一节稳定超过约 100 行时，再拆成独立文件，并更新 `AGENTS.md`。

## 通用

<!-- TODO(v1.1): TypeScript 用法、命名、文件组织、注释密度跟随周围代码 -->

_待从代码提炼。_

## 前端

### 组件拆分

- 文件过大或职责混杂时（如 `app/components/chat.tsx`）应拆成边界清晰的子组件 / hooks；新功能优先进子模块，避免继续堆高。
- **酌情**：边界不清、小改动、或拆完更难读时不要硬拆；禁止为凑文件数而碎片化；非重构任务不要顺手大拆无关巨石。
- 一次只抽已成形的一块；样式仍就近 `*.module.scss`。

<!-- 其他前端约定 TODO(v1.1): hooks、Zustand store 用法等 -->

## 后端

<!-- TODO(v1.1): app/api 路由、app/api 与 app/server 下的 provider 适配 -->

_待从代码提炼。_

## 样式

<!-- TODO(v1.1): 与组件同目录的 *.module.scss、主题 class（.light / .dark）、app/styles 全局样式 -->

_待从代码提炼。_

## 测试

<!-- TODO(v1.1): Jest + Testing Library、*.test.ts(x) 同目录放置、yarn test:ci -->

_待从代码提炼。_
