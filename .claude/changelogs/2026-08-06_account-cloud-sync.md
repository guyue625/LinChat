# 方案 A：账号绑定云同步

**日期**：2026-08-06
**概述**：为已登录账号增加服务端 AppState 云同步（聊天记录 / 设置 / 用户 Key / 面具 / 提示词），并修复上游 `mergeWithUpdate` / `mergeAppState` 导致设置同步失效的两个 bug。本地 IndexedDB 仍是主存储，服务端保存去媒体后的整包快照，换设备登录后自动拉取合并。

---

## 变更文件

| 文件路径                                | 操作 | 说明                                                                       |
| --------------------------------------- | ---- | -------------------------------------------------------------------------- |
| `app/api/sync/route.ts`                 | 新增 | 账号鉴权的 GET 拉取 / POST 推送接口，快照落盘 `data/sync/<userId>.json`    |
| `app/utils/account-cloud-sync.ts`       | 新增 | 客户端同步核心：登录拉取合并、30s 防抖推送、base64 图片剥离、pagehide 冲刷 |
| `app/components/account-cloud-sync.tsx` | 新增 | 挂载组件，等账号 + workspace 就绪后启动同步                                |
| `app/utils/account-cloud-sync.test.ts`  | 新增 | merge / strip 相关单测（当前 jest.setup 有环境问题，未实际跑通）           |
| `app/utils/sync.ts`                     | 修改 | 修两个上游合并 bug，让 Config/Access 同步真正生效                          |
| `app/components/home.tsx`               | 修改 | 在 `AccountProvider` 内挂载 `<AccountCloudSync />`                         |
| `.gitignore`                            | 修改 | 忽略 `data/sync/`                                                          |
| `.env.template`                         | 修改 | 增加可选 `ACCOUNT_SYNC_DIR` 说明                                           |
| `Dockerfile`                            | 修改 | 预创建 `/app/data/sync` 目录                                               |

> 注意：`public/favicon.png` / `public/logo.png` 也有本地改动，**不属于本次云同步功能**，提交时请分开处理。

---

## 改动详情

### `app/api/sync/route.ts`（新增）

改动原因：给已登录用户提供服务端快照读写，按账号隔离。

关键行为：

- 复用 `nextchat_session` cookie + `getAccountAuthService().getUserBySession`
- `GET /api/sync`：读 `data/sync/<userId>.json`；不存在时返回 `{ state: null, updatedAt: null }`
- `POST /api/sync`：body 为整包 AppState JSON；15MB 上限；原子写入 `{ state, updatedAt }`
- 目录可通过 `ACCOUNT_SYNC_DIR` 覆盖，默认 `process.cwd()/data/sync`
- userId 写入前做 `[a-zA-Z0-9_-]` 清洗，防路径穿越

### `app/utils/account-cloud-sync.ts`（新增）

改动原因：把“何时同步、怎么合并、怎么推送”封装成可复用客户端模块。

关键流程：

1. `startAccountCloudSync({ userId })` 启动
2. `pullAndMergeAccountCloud()`：GET 远端 → `mergeAppState` → `setLocalAppState` → 回写 per-owner chat workspace
3. 合并后**强制保留本机** `workspaceOwner` / `workspaceSwitching=false` / `_hasHydrated=true`
4. 无论远端空/非空，初始同步后都会 push 一次（空则 seed，非空则把 local-wins 字段回写）
5. 订阅 Chat / Config / Access / Mask / Prompt 五个 store，**30s 防抖**自动 push
6. `pagehide` / `visibilitychange=hidden` 时 `keepalive` 冲刷
7. `stripMediaFromAppState`：推送前把消息里的 `data:` 图片换成 1px GIF 占位，去掉 audio data URL；本地 IndexedDB 原图保留
8. guest / workspace 切换中 / 正在 apply remote 时不 push

### `app/components/account-cloud-sync.tsx`（新增）+ `home.tsx`

改动原因：只在“已登录且本地 workspace 已就绪”时开同步，避免 guest 快照污染服务端。

启动条件同时满足：

- `enabled && !loading && !loggingOut && user.id`
- `modelWorkspaceReady && chatHydrated && configHydrated`
- `!workspaceSwitching && workspaceOwner.startsWith("user:")`

登出时 `stopAccountCloudSync({ flush: false })`，不把 guest 状态推上去。

### `app/utils/sync.ts`（修改）

改动原因：上游两个 bug 会让设置/Access 同步永远失效。

```diff
-    MergeStates[key](localStoreState, remoteStoreState);
+    // Config/Access mergers return a new object; Chat/Prompt/Mask mutate in place.
+    localState[key] = MergeStates[key](localStoreState, remoteStoreState);

-  const remoteUpdateTime = localState.lastUpdateTime ?? 1;
+  const remoteUpdateTime = remoteState.lastUpdateTime ?? 0;
```

补充说明：

- `mergeWithUpdate` 旧代码把 remote 时间戳读成了 local，导致 Config/Access 永远本地胜
- `mergeAppState` 旧代码丢掉了 merger 返回的新对象，即使时间戳判断正确也写不回去

---

## API 变化

| 接口        | 方法 | 鉴权                | 说明                                                 |
| ----------- | ---- | ------------------- | ---------------------------------------------------- |
| `/api/sync` | GET  | 账号 session cookie | 返回 `{ state, updatedAt }` 或空包                   |
| `/api/sync` | POST | 账号 session cookie | body = AppState JSON（建议已 strip 媒体），15MB 上限 |

环境变量：

| 变量               | 默认        | 说明                                                 |
| ------------------ | ----------- | ---------------------------------------------------- |
| `ACCOUNT_SYNC_DIR` | `data/sync` | 快照目录，Docker 建议挂到与 `ACCOUNT_DATA_FILE` 同卷 |

---

## 注意事项

- **必须开启账号体系**（`ACCOUNT_AUTH_ENABLED` 或配置了初始管理员）才有同步；未登录不会触发
- 图片/音频 **不会** 跨设备同步，只有文本与元数据；换设备后历史图会变成占位 GIF
- 冲突策略：Chat 按 session/message id 并集；Config/Access 按 `lastUpdateTime` 新者覆盖；Prompt/Mask 本地优先合并
- 多端同时在线时是“防抖整包覆盖”，**不是** OT/CRDT 实时协同；短时间两边都改，后 push 的一方可能覆盖先 push 的字段（Chat 消息因按 id 合并相对安全）
- 服务端仍是 JSON 文件，不是 SQLite；与账号 `accounts.json` 同风格，个人站够用
- Docker 需把 `/app/data` 挂持久卷，否则容器重建丢同步数据
- 仓库现有 `jest.setup.ts` 在本机报 `exports is not defined`，**所有** jest 用例（含旧用例）都跑不起来；`tsc --noEmit` 已通过
- `public/favicon.png` / `public/logo.png` 的 binary 变更与本功能无关，提交时不要混进同一 commit

---

## 未完成 / 后续计划

- [ ] 管理员模型配置入 SQLite / 后台可改服务商（原路线图第 2 步）
- [ ] 联网搜索：`/api/search` + 输入框开关 + 发送前注入（原路线图第 3 步）
- [ ] 账号体系从 `accounts.json` 迁到同一 SQLite（原路线图第 4 步）
- [ ] 可选：同步附件对象存储（真正跨设备保留图片）
- [ ] 可选：同步状态 UI 提示（上次同步时间 / 失败重试）
- [ ] 修复仓库 jest.setup ESM 问题，让 `account-cloud-sync.test.ts` 真正跑通

---

## 下次新会话开场白

```
请先阅读以下改动记录，了解上一次的工作内容：
@.claude/changelogs/2026-08-06_account-cloud-sync.md

上一次已完成方案 A「账号绑定云同步」：新增 /api/sync、客户端自动拉取合并与防抖推送，并修复了 mergeWithUpdate / mergeAppState 两个上游 bug。本地 IndexedDB 仍是主存储，服务端存去媒体后的整包快照。

路线图下一步任选其一继续：
1) 管理员模型配置入 SQLite（后台可改服务商/Key/模型列表，不再依赖环境变量）
2) 联网搜索（服务端 /api/search + 输入框开关 + 发送前注入上下文）
3) 账号 accounts.json 迁同一 SQLite
4) 给云同步补状态 UI / 附件对象存储

请从第 [x] 项开始实施。
```
