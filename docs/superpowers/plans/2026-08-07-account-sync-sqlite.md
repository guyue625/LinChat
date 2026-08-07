# Account Sync SQLite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将账号 AppState 同步快照从明文 JSON 文件迁入带 AES-256-GCM 加密和 revision 并发控制的 SQLite，同时升级到 Node 22 并兼容旧快照。

**Architecture:** `connection.ts` 只管理 SQLite 连接与 schema；`app/lib/account-sync/` 内的校验、加密、旧文件读取和 repository 各自保持独立。`/api/sync` 继续使用账号 cookie 鉴权，通过 repository 读写；客户端保存 revision，发生 409 时合并最新快照并最多重试一次。

**Tech Stack:** Next.js 14 Route Handlers、TypeScript、Node 22 `node:sqlite` / `node:crypto`、Jest、Zustand。

---

## 文件结构

- `app/lib/db/connection.ts`：SQLite 单例、PRAGMA 与幂等 schema。
- `app/lib/account-sync/crypto.ts`：同步密钥解析与 AES-256-GCM 加解密。
- `app/lib/account-sync/state.ts`：AppState 基础结构与危险键校验。
- `app/lib/account-sync/legacy.ts`：旧 JSON 快照定位、读取与解析。
- `app/lib/account-sync/repository.ts`：加密快照查询、CAS 写入和惰性迁移。
- `app/lib/account-sync/*.test.ts`：上述纯模块及 SQLite repository 测试。
- `app/api/sync/route.ts`：鉴权、HTTP 输入输出和错误映射。
- `app/api/sync/route.test.ts`：路由级鉴权、状态码和协议测试。
- `app/utils/account-cloud-sync.ts`：客户端 revision 与冲突重试。
- `app/utils/account-cloud-sync.test.ts`：客户端同步回归与冲突测试。

### Task 1: Node 22 与跨平台测试入口

**Files:**

- Modify: `Dockerfile`
- Modify: `package.json`
- Modify: `yarn.lock`
- Modify: `jest.config.ts`

- [ ] **Step 1: 记录当前失败基线**

Run:

```powershell
yarn test:ci app/utils/account-cloud-sync.test.ts --runInBand
yarn tsc --noEmit
```

Expected: Windows 下 `test:ci` 因 `$(yarn bin jest)` 失败；TypeScript 因 Node 20 类型没有 `node:sqlite` 失败。

- [ ] **Step 2: 修改运行时与测试脚本**

将 Docker 基础镜像改为：

```dockerfile
FROM node:22-alpine AS base
```

将脚本改为跨平台形式：

```json
"test": "jest --watch",
"test:ci": "jest --ci"
```

将 `@types/node` 升级为与 Node 22 匹配的版本，并执行：

```powershell
yarn install
```

`jest.config.ts` 保持 Next/SWC 的 CommonJS 执行方式，不再设置 `extensionsToTreatAsEsm`。

- [ ] **Step 3: 验证运行时基础**

Run:

```powershell
yarn test:ci app/utils/account-cloud-sync.test.ts app/utils/merge.test.ts --runInBand
yarn tsc --noEmit
```

Expected: 目标测试通过；`node:sqlite` 类型错误消失。

- [ ] **Step 4: 用户提交点**

Agent 不执行 Git 写操作。建议用户检查后手动执行：

```powershell
git add Dockerfile package.json yarn.lock jest.config.ts
git commit -m "build: upgrade runtime to node 22"
```

### Task 2: AppState 基础校验

**Files:**

- Create: `app/lib/account-sync/state.test.ts`
- Create: `app/lib/account-sync/state.ts`

- [ ] **Step 1: 写失败测试**

测试以下行为：

```ts
expect(validateSyncState(validState).ok).toBe(true);
expect(validateSyncState(null).ok).toBe(false);
expect(validateSyncState([]).ok).toBe(false);
expect(validateSyncState({ [StoreKey.Chat]: {} }).ok).toBe(false);
expect(
  validateSyncState({
    [StoreKey.Chat]: { sessions: [] },
    [StoreKey.Config]: [],
  }).ok,
).toBe(false);
expect(hasDangerousKeys(JSON.parse('{"__proto__":{}}'))).toBe(true);
```

- [ ] **Step 2: 验证 RED**

Run:

```powershell
yarn jest app/lib/account-sync/state.test.ts --runInBand
```

Expected: FAIL，因为模块尚不存在。

- [ ] **Step 3: 实现最小校验器**

导出：

```ts
export type SyncStateValidation =
  | { ok: true; state: Record<string, unknown> }
  | { ok: false; reason: string };

export function hasDangerousKeys(value: unknown): boolean;
export function validateSyncState(value: unknown): SyncStateValidation;
```

要求 Chat 存在且 `sessions` 为数组；Config、Access、Mask、Prompt 若存在必须为普通对象；递归拒绝 `__proto__`、`constructor`、`prototype`。

- [ ] **Step 4: 验证 GREEN**

Run:

```powershell
yarn jest app/lib/account-sync/state.test.ts --runInBand
```

Expected: PASS。

### Task 3: AES-256-GCM 加密模块

**Files:**

- Create: `app/lib/account-sync/crypto.test.ts`
- Create: `app/lib/account-sync/crypto.ts`

- [ ] **Step 1: 写失败测试**

覆盖：32 字节 Base64 密钥可解析；缺失、非法 Base64、错误长度被拒绝；同一明文两次加密产生不同密文；正确用户和 revision 可解密；错误用户、revision、密钥或篡改密文认证失败。

期望接口：

```ts
const key = parseSyncEncryptionKey(keyBase64);
const encrypted = encryptSyncPayload({
  plaintext: JSON.stringify(state),
  userId: "user-1",
  revision: 1,
  key,
});
expect(
  decryptSyncPayload({ encrypted, userId: "user-1", revision: 1, key }),
).toBe(JSON.stringify(state));
```

- [ ] **Step 2: 验证 RED**

Run:

```powershell
yarn jest app/lib/account-sync/crypto.test.ts --runInBand
```

Expected: FAIL，因为模块尚不存在。

- [ ] **Step 3: 实现最小加解密**

使用 `createCipheriv("aes-256-gcm", key, randomBytes(12))`，AAD 为 `nextchat-sync:${userId}:${revision}`。密文格式严格解析为 `v1.iv.tag.ciphertext`，每段使用 base64url。

环境变量读取单独导出：

```ts
export function getSyncEncryptionKey() {
  return parseSyncEncryptionKey(process.env.ACCOUNT_SYNC_ENCRYPTION_KEY);
}
```

错误信息不得包含 key 或明文。

- [ ] **Step 4: 验证 GREEN**

Run:

```powershell
yarn jest app/lib/account-sync/crypto.test.ts --runInBand
```

Expected: PASS。

### Task 4: SQLite schema 与加密快照 repository

**Files:**

- Modify: `app/lib/db/connection.ts`
- Create: `app/lib/account-sync/repository.test.ts`
- Create: `app/lib/account-sync/repository.ts`

- [ ] **Step 1: 写 repository 失败测试**

使用 `new DatabaseSync(":memory:")` 和固定测试 key，覆盖：

```ts
expect(repository.read("u1")).toBeNull();
expect(repository.write("u1", stateA, 0).revision).toBe(1);
expect(repository.read("u1")?.state).toEqual(stateA);
expect(repository.write("u1", stateB, 1).revision).toBe(2);
expect(() => repository.write("u1", stateC, 1)).toThrow(SyncConflictError);
```

同时直接查询数据库，断言 `state_ciphertext` 不包含测试 API Key 或明文 JSON。

- [ ] **Step 2: 验证 RED**

Run:

```powershell
yarn jest app/lib/account-sync/repository.test.ts --runInBand
```

Expected: FAIL，因为表和 repository 尚不存在。

- [ ] **Step 3: 完善 connection schema**

在现有 schema 初始化中加入：

```sql
PRAGMA busy_timeout = 5000;
CREATE TABLE IF NOT EXISTS user_sync_snapshots (
  user_id TEXT PRIMARY KEY,
  state_ciphertext TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision > 0),
  updated_at TEXT NOT NULL
);
```

保留现有未来表，不连接尚未迁移的账号仓储。

- [ ] **Step 4: 实现 CAS repository**

导出：

```ts
export type AccountSyncSnapshot = {
  state: Record<string, unknown>;
  revision: number;
  updatedAt: string;
};

export class SyncConflictError extends Error {
  constructor(readonly current: AccountSyncSnapshot | null) {
    super("SYNC_CONFLICT");
  }
}

export class AccountSyncRepository {
  read(userId: string): AccountSyncSnapshot | null;
  write(
    userId: string,
    state: Record<string, unknown>,
    expectedRevision: number,
  ): AccountSyncSnapshot;
}
```

`write` 使用 `BEGIN IMMEDIATE` / `COMMIT` / `ROLLBACK`。revision 0 只允许 INSERT；其他 revision 必须与当前记录相等。加密使用即将写入的新 revision。

- [ ] **Step 5: 验证 GREEN 与回滚**

Run:

```powershell
yarn jest app/lib/account-sync/repository.test.ts --runInBand
```

Expected: 创建、更新、冲突、密文断言和事务回滚全部通过。

### Task 5: 旧 JSON 惰性迁移

**Files:**

- Create: `app/lib/account-sync/legacy.test.ts`
- Create: `app/lib/account-sync/legacy.ts`
- Modify: `app/lib/account-sync/repository.test.ts`
- Modify: `app/lib/account-sync/repository.ts`

- [ ] **Step 1: 写旧文件解析失败测试**

在 Jest 临时目录创建：不存在文件、合法 `{ state, updatedAt }`、非法 JSON、超过 15MB、非法 AppState。测试 `readLegacySyncSnapshot(userId, directory)` 返回合法快照或抛出稳定错误。

- [ ] **Step 2: 验证 RED**

Run:

```powershell
yarn jest app/lib/account-sync/legacy.test.ts --runInBand
```

Expected: FAIL，因为模块尚不存在。

- [ ] **Step 3: 实现旧文件读取**

严格验证 `userId` 为 `[A-Za-z0-9_-]+`，使用 `path.join(directory, `${userId}.json`)`；先检查字节大小，再 JSON.parse 和 `validateSyncState`。不删除或改名文件。

- [ ] **Step 4: 写 repository 迁移失败测试**

测试数据库为空时合法旧文件被加密插入为 revision 1；数据库已有记录时不读取旧文件；两个 repository 连续迁移只保留一条记录；非法旧文件不写数据库。

- [ ] **Step 5: 实现 `readWithLegacyMigration`**

repository 新增异步边界：

```ts
async readWithLegacyMigration(userId: string): Promise<AccountSyncSnapshot | null>;
```

先读 SQLite，再读旧文件；迁移 INSERT 在事务中执行，主键冲突后重新读取数据库。

- [ ] **Step 6: 验证 GREEN**

Run:

```powershell
yarn jest app/lib/account-sync/legacy.test.ts app/lib/account-sync/repository.test.ts --runInBand
```

Expected: PASS，且旧文件仍存在。

### Task 6: `/api/sync` 切换到 SQLite 协议

**Files:**

- Create: `app/api/sync/route.test.ts`
- Modify: `app/api/sync/route.ts`
- Create: `app/lib/account-sync/server.ts`

- [ ] **Step 1: 写路由失败测试**

mock `requireCurrentUser` 边界或 repository factory，覆盖：

- 未登录返回 401。
- GET 空记录返回 state null / revision 0。
- GET 有记录返回解密 state / revision / updatedAt，且 `Cache-Control` 为 `private, no-store`。
- POST 缺失或非法 `X-Sync-Revision` 返回 400。
- POST 非法 AppState 返回 400。
- POST 超过 15MB 返回 413。
- POST 成功返回递增 revision。
- `SyncConflictError` 返回 409 和当前快照。
- 密钥或数据库错误返回 503，不泄露内部信息。

- [ ] **Step 2: 验证 RED**

Run:

```powershell
yarn jest app/api/sync/route.test.ts --runInBand
```

Expected: 现有 JSON 路由不符合 revision 协议，测试失败。

- [ ] **Step 3: 添加 server factory**

`app/lib/account-sync/server.ts` 缓存由 `getDb()`、`getSyncEncryptionKey()` 和 `ACCOUNT_SYNC_DIR` 创建的 repository；提供测试重置函数，不把数据库或 key 暴露给客户端 bundle。

- [ ] **Step 4: 重写 GET/POST**

保留现有账号 cookie 鉴权。GET 调用 `readWithLegacyMigration`；POST 在解析 body 后执行 15MB、revision 和 AppState 校验，再调用 CAS write。统一映射 400/401/409/413/503。

- [ ] **Step 5: 验证 GREEN**

Run:

```powershell
yarn jest app/api/sync/route.test.ts --runInBand
```

Expected: 路由协议测试全部通过。

### Task 7: 客户端 revision 与冲突重试

**Files:**

- Modify: `app/utils/account-cloud-sync.test.ts`
- Modify: `app/utils/account-cloud-sync.ts`

- [ ] **Step 1: 写客户端失败测试**

扩展 fetch mock，覆盖：

```ts
GET -> { state: null, revision: 0 }
POST headers["X-Sync-Revision"] === "0"
POST -> { ok: true, revision: 1 }
```

再测试第一次 POST 返回 409 时：冲突 state 被合并、第二次 POST 使用新 revision、最多两次 POST；第二次仍 409 时停止，不进行第三次写入。

- [ ] **Step 2: 验证 RED**

Run:

```powershell
yarn jest app/utils/account-cloud-sync.test.ts --runInBand
```

Expected: 现有客户端没有 revision header 和冲突重试，新增测试失败。

- [ ] **Step 3: 实现 revision 状态**

`SyncEnvelope` 增加 `revision`。客户端只为当前 `activeUserId` 保存 revision；账号停止同步时清空。GET 成功后设置 revision，POST 成功后原子更新 revision。

- [ ] **Step 4: 实现单次冲突重试**

将一次写入拆为可测试函数：POST 409 时解析冲突 envelope，确认仍是同一 active user，合并并 mirror workspace，然后使用冲突 revision 再 POST 一次。任何其他失败直接退出本轮。

- [ ] **Step 5: 验证 GREEN**

Run:

```powershell
yarn jest app/utils/account-cloud-sync.test.ts --runInBand
```

Expected: 初始、冲突、账号边界和拉取失败测试全部通过。

### Task 8: 环境变量、Docker 数据卷与运维说明

**Files:**

- Modify: `.env.template`
- Modify: `.gitignore`
- Modify: `Dockerfile`
- Modify: `.claude/changelogs/2026-08-06_account-cloud-sync.md`

- [ ] **Step 1: 更新环境变量模板**

加入：

```dotenv
### SQLite database path (Docker default: /app/data/nextchat.sqlite)
ACCOUNT_DB_FILE=/app/data/nextchat.sqlite

### Required for encrypted account sync snapshots: Base64 of exactly 32 random bytes
ACCOUNT_SYNC_ENCRYPTION_KEY=
```

提供生成命令但不生成或写入真实密钥：

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

- [ ] **Step 2: 更新忽略与 Docker 权限**

忽略 `data/*.sqlite`、`data/*.sqlite-wal`、`data/*.sqlite-shm`。Docker 继续创建 `/app/data` 并设为 700；保留 `/app/data/sync` 供旧 JSON 惰性迁移。

- [ ] **Step 3: 更新改动记录**

将审查修复、SQLite、revision、加密、Node 22、迁移方式和未完成的管理员 provider/账号迁移写入现有中文改动说明。

### Task 9: 全量验证与交付检查

**Files:**

- Review only: all changed files

- [ ] **Step 1: 格式与静态检查**

Run:

```powershell
yarn prettier --check app/lib/account-sync app/lib/db/connection.ts app/api/sync app/utils/account-cloud-sync.ts app/utils/account-cloud-sync.test.ts app/utils/merge.ts app/utils/merge.test.ts jest.config.ts
yarn tsc --noEmit
yarn lint
git diff --check
```

Expected: 全部 exit 0，无新 warning/error。

- [ ] **Step 2: 目标与全量测试**

Run:

```powershell
yarn test:ci app/lib/account-sync app/api/sync app/utils/account-cloud-sync.test.ts app/utils/merge.test.ts --runInBand
yarn test:ci --runInBand
```

Expected: 所有测试套件通过，0 failed。

- [ ] **Step 3: 生产构建**

Run:

```powershell
yarn build
docker build -t nextchat:node22-sqlite .
```

Expected: Next standalone 构建和 Node 22 Docker 镜像构建均成功。

- [ ] **Step 4: 手工协议冒烟**

使用临时测试账号验证：首次 GET revision 0、首次 POST revision 1、第二客户端旧 revision 返回 409、重拉合并后写入 revision 2；确认 SQLite 中没有可搜索到的测试 API Key 明文，旧 JSON 文件未被删除。

- [ ] **Step 5: 最终 diff 审查**

Run:

```powershell
git status --short
git diff --stat
git diff -- . ':(exclude)public/favicon.png' ':(exclude)public/logo.png'
```

确认 logo/favicon 是用户已有的无关改动，不纳入本功能交付说明；不执行 add/commit/push。

- [ ] **Step 6: 用户提交点**

验证通过后，仅向用户提供按功能分组的 `git add` / `git commit` 命令，由用户自行执行。
