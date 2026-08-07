# 账号同步快照 SQLite 设计

**日期：** 2026-08-07  
**状态：** 已批准并实施

## 背景与目标

当前账号云同步将完整 AppState 保存到 `data/sync/<userId>.json`。该快照包含聊天记录、用户设置、模型偏好、提示词、面具和 Access/API Key。JSON 文件方案缺少并发版本控制，两台设备可能以最后一次写入互相覆盖；API Key 也会以明文进入文件与备份。

本阶段将同步快照迁入 SQLite，增加乐观并发控制和静态加密，同时兼容已经生成的 JSON 快照。Docker 运行时从已停止安全维护的 Node 18 升级到 Node 22，并使用内置 `node:sqlite`。

## 范围

本阶段包含：

- 将账号 AppState 快照保存到 SQLite。
- 使用 revision 检测多设备并发写入冲突。
- 使用 AES-256-GCM 加密完整快照，避免数据库或备份直接暴露 API Key。
- 惰性迁移现有 `data/sync/<userId>.json`。
- 保持现有账号 session cookie 鉴权、15MB 限制和 Base64 媒体剥离。
- 修复并验证方案 A 审查中发现的合并、竞态和安全问题。

本阶段不包含：

- 将 `accounts.json` 迁入 SQLite。
- 管理员模型服务商、Base URL、Key 和模型列表管理界面。
- 图片、音频等附件跨设备同步。
- 会话或消息删除的跨设备传播。
- 多节点共享数据库；目标仍是个人服务器上的单实例部署。

## 运行时与数据库

Docker 基础镜像升级到 `node:22-alpine`，`@types/node` 升级到兼容 Node 22 的版本。数据库默认路径为 `data/nextchat.sqlite`，可通过 `ACCOUNT_DB_FILE` 覆盖。

SQLite 启用：

```sql
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;
```

新增表：

```sql
CREATE TABLE IF NOT EXISTS user_sync_snapshots (
  user_id TEXT PRIMARY KEY,
  state_ciphertext TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision > 0),
  updated_at TEXT NOT NULL
);
```

账号目前仍在 JSON 仓储中，因此本阶段不为 `user_id` 添加外键。账号迁移完成后再补外键及账号删除时的级联清理。

## 加密边界

服务端新增必填环境变量：

```text
ACCOUNT_SYNC_ENCRYPTION_KEY=<32 字节随机值的 Base64 编码>
```

密文格式带显式版本：

```text
v1.<base64url(iv)>.<base64url(authTag)>.<base64url(ciphertext)>
```

- 算法：AES-256-GCM。
- IV：每次写入生成 12 个随机字节。
- AAD：`nextchat-sync:<userId>:<revision>`，防止把一个用户或版本的密文复制给另一个用户。
- 数据库中不保存明文 AppState 或加密密钥。
- 环境变量缺失、Base64 非法或解码后不是 32 字节时，同步接口返回 503；不得降级为明文。
- 解密认证失败时返回 503 并保留原记录，不自动用本地快照覆盖。
- 加密密钥必须和数据库备份一起保管；本阶段不实现在线密钥轮换。

## 仓储边界

`app/lib/db/connection.ts` 只负责打开数据库、设置 PRAGMA 和执行幂等 schema。`app/lib/db/account-sync-repository.ts` 负责：

- 按 `user_id` 读取并解密快照。
- 在事务中执行 compare-and-swap 写入。
- 数据库无记录时尝试惰性迁移旧 JSON。
- 将数据库错误、版本冲突和密文错误转换为明确的领域错误。

路由不直接拼 SQL，也不直接处理加密细节。

## API 协议

### GET `/api/sync`

鉴权成功且已有快照：

```json
{
  "state": {},
  "revision": 3,
  "updatedAt": "2026-08-07T12:00:00.000Z"
}
```

没有快照：

```json
{
  "state": null,
  "revision": 0,
  "updatedAt": null
}
```

所有响应设置 `Cache-Control: private, no-store`。

### POST `/api/sync`

请求 body 继续使用原始 AppState JSON，避免无必要地改变客户端序列化结构。客户端通过请求头传入上次读取的版本：

```text
X-Sync-Revision: 3
```

- 首次创建必须传 `0`。
- 更新必须等于数据库当前 revision。
- 写入成功后 revision 加一，返回 `{ "ok": true, "revision": 4, "updatedAt": "..." }`。
- header 缺失、不是非负整数或 body 不是基础 AppState 结构时返回 400。
- body UTF-8 大小超过 15MB 时返回 413。

版本不匹配时返回 409，并在响应中附带当前服务端快照：

```json
{
  "code": "SYNC_CONFLICT",
  "state": {},
  "revision": 4,
  "updatedAt": "2026-08-07T12:00:01.000Z"
}
```

## 客户端数据流

1. 账号工作区完成 hydration 后执行 GET。
2. 远端为空时，以 revision `0` 推送本地快照。
3. 远端存在时，先合并远端与本地，再用 GET 返回的 revision 推送合并结果。
4. 正常 store 变化仍使用 30 秒防抖；每次 POST 使用客户端保存的最新 revision。
5. POST 返回 409 时，客户端合并冲突响应中的最新远端快照，更新 revision，再重试一次。
6. 第二次仍冲突或发生网络、鉴权、解密、数据库错误时停止本轮写入并记录错误，不继续盲写。
7. 账号切换、guest workspace、远端 apply 和 workspace 切换期间禁止推送。

该流程保证单实例 SQLite 上的并发写入不会静默覆盖未读取的远端版本。聊天消息仍按 ID 合并；Config 与 Access 仍按 `lastUpdateTime` 选择较新状态。

## 旧 JSON 惰性迁移

当数据库中没有该用户记录时，仓储检查旧路径 `ACCOUNT_SYNC_DIR/<userId>.json`：

1. 文件不存在：按空快照处理。
2. 文件存在：解析 `{ state, updatedAt }`，检查基础 AppState 结构和 15MB 上限。
3. 使用 revision `1` 加密写入 SQLite。
4. 并发迁移通过事务与主键约束保证只产生一条记录；失败的一方重新读取数据库记录。
5. 不删除、不重命名旧 JSON 文件，便于人工回滚。
6. 旧文件非法时记录服务端错误并返回 503，不以空快照覆盖。

## 输入校验与错误处理

基础 AppState 至少要求以下分片为对象；旧版本允许缺少非 Chat 分片，由客户端保留本地对应值：

- Chat：对象，且 `sessions` 为数组。
- Config、Access、Mask、Prompt：存在时必须为对象。

服务端不接受数组、`null` 或危险原型键作为状态根或分片。通用深合并函数必须忽略 `__proto__`、`constructor` 和 `prototype`。

日志不得输出 AppState、API Key、密文、加密密钥或完整 session token。错误响应只返回稳定错误码和非敏感中文提示。

## 测试与验收

自动测试覆盖：

- AES-256-GCM 加解密、错误密钥和 AAD 不匹配。
- SQLite 空记录、创建、更新、revision 冲突和事务回滚。
- 旧 JSON 成功迁移、非法 JSON、非法 AppState 和并发迁移。
- API 未登录、空快照、成功 GET/POST、缺少 revision、413 和 409。
- 客户端首次 seed、正常更新、409 合并后单次重试、重复冲突停止。
- 拉取失败不回推、账号不匹配不推送、旧快照缺少分片不崩溃。
- 合并方向与原型污染回归测试。

完成前执行：

```powershell
yarn jest app/utils/account-cloud-sync.test.ts app/utils/merge.test.ts --runInBand
yarn test:ci
yarn tsc --noEmit
yarn lint
yarn build
docker build -t nextchat:node22-sqlite .
```

Windows 下现有 `test:ci` 脚本使用 Unix 命令替换，需要在实施计划中改为跨平台调用后再作为验收命令。

## 回滚

- 旧 JSON 快照始终保留，因此可以将路由临时切回旧仓储读取。
- 数据库 schema 只新增表，不删除或改写现有表。
- Node 22 升级若触发依赖兼容问题，应在合入前解决；不得以跳过构建验证作为上线方案。
- 加密密钥丢失时只能从仍保留的旧 JSON 或其他明文导出恢复，数据库密文本身不可恢复。
