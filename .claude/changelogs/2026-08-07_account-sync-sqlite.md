# 账号云同步迁移至加密 SQLite

**日期**：2026-08-07  
**概述**：审查并修复方案 A 账号云同步中的数据覆盖、账号竞态与原型污染问题；将服务端同步快照从明文 JSON 迁入带 AES-256-GCM 加密和 revision 乐观锁的 SQLite。运行时升级到 Node 22，旧 JSON 快照可惰性迁移且不会被删除。

---

## 变更文件

| 文件路径                                                          | 操作      | 说明                                                                    |
| ----------------------------------------------------------------- | --------- | ----------------------------------------------------------------------- |
| `app/api/sync/route.ts`                                           | 重写      | 使用 SQLite repository；增加 revision、409、校验、no-store 与稳定错误码 |
| `app/api/sync/route.test.ts`                                      | 新增      | 覆盖鉴权、空快照、revision、非法状态、CAS 写入和冲突响应                |
| `app/lib/account-sync/crypto.ts`                                  | 新增      | AES-256-GCM 加解密与 32 字节 Base64 密钥校验                            |
| `app/lib/account-sync/state.ts`                                   | 新增      | AppState 基础结构与危险原型键校验                                       |
| `app/lib/account-sync/legacy.ts`                                  | 新增      | 安全读取旧 JSON 快照，执行大小和结构校验                                |
| `app/lib/account-sync/repository.ts`                              | 新增      | SQLite 加密快照读写、revision CAS 和惰性迁移                            |
| `app/lib/account-sync/server.ts`                                  | 新增      | 服务端 repository 单例组装边界                                          |
| `app/lib/account-sync/*.test.ts`                                  | 新增      | 加密、校验、SQLite 与旧文件迁移测试                                     |
| `app/lib/db/connection.ts`                                        | 新增/完善 | Node 22 `node:sqlite` 连接、WAL、busy timeout 和同步表 schema           |
| `app/utils/account-cloud-sync.ts`                                 | 新增/完善 | 登录拉取、30 秒防抖、媒体剥离、revision 与单次冲突重试                  |
| `app/utils/account-cloud-sync.test.ts`                            | 新增      | 覆盖合并、账号隔离、失败不盲写、revision 与冲突流程                     |
| `app/components/account-cloud-sync.tsx`                           | 新增      | 在账号和工作区 hydration 完成后启停云同步                               |
| `app/components/home.tsx`                                         | 修改      | 挂载账号云同步组件                                                      |
| `app/utils/sync.ts`                                               | 修改      | 修复时间戳来源、合并方向、结果未写回和旧分片缺失崩溃                    |
| `app/utils/merge.ts`                                              | 修改      | 阻断 `__proto__` / `constructor` / `prototype` 原型污染                 |
| `app/utils/merge.test.ts`                                         | 新增      | 原型污染回归测试                                                        |
| `Dockerfile`                                                      | 修改      | 基础镜像升级到 Node 22，并保留旧快照迁移目录                            |
| `package.json` / `yarn.lock`                                      | 修改      | Node 22 类型与跨平台 Jest 脚本                                          |
| `.env.template`                                                   | 修改      | 增加数据库路径、加密密钥和旧快照目录说明                                |
| `.gitignore`                                                      | 修改      | 忽略 SQLite、WAL、SHM 和旧同步目录                                      |
| `jest.config.ts`                                                  | 修改      | 移除与 Next/SWC 输出冲突的 ESM 强制配置                                 |
| `docs/superpowers/specs/2026-08-07-account-sync-sqlite-design.md` | 新增      | 已批准设计                                                              |
| `docs/superpowers/plans/2026-08-07-account-sync-sqlite.md`        | 新增      | TDD 实施计划                                                            |

> `public/favicon.png` 和 `public/logo.png` 的本地改动不属于本功能，提交时应单独处理。

---

## 关键行为

### 加密落盘

- SQLite 表 `user_sync_snapshots` 只保存版本化密文、revision 和更新时间。
- 完整 AppState 使用 AES-256-GCM；AAD 绑定用户 ID 与 revision。
- `ACCOUNT_SYNC_ENCRYPTION_KEY` 缺失或不是 32 字节 Base64 时同步服务失败关闭，不降级明文。
- 日志不再输出冲突快照或 API Key，只输出稳定错误码。

### 多设备并发

- GET 返回 `{ state, revision, updatedAt }`。
- POST 必须提供 `X-Sync-Revision`。
- revision 不匹配返回 409 与最新快照。
- 客户端合并最新远端状态后最多重试一次；第二次冲突停止，避免无限覆盖。

### 旧数据迁移

- 数据库无用户记录时读取 `ACCOUNT_SYNC_DIR/<userId>.json`。
- 合法旧快照加密写入 revision 1。
- 旧文件不删除、不改名，便于人工回滚。
- 非法、超限或认证失败的旧快照不会被空状态覆盖。

### 审查修复

- Config/Access 真正按较新的 `lastUpdateTime` 获胜。
- 拉取失败时不再盲目 POST 本地状态。
- 推送严格绑定当前账号工作区。
- 延迟到达的旧账号 GET 响应不会应用到新账号。
- 深合并函数不再允许原型污染。

---

## 部署要求

生成同步加密密钥：

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

部署环境至少设置：

```dotenv
ACCOUNT_DB_FILE=/app/data/nextchat.sqlite
ACCOUNT_SYNC_ENCRYPTION_KEY=<上一步生成的值>
```

数据库和加密密钥必须一起备份。密钥丢失后，SQLite 密文无法恢复；仍保留的旧 JSON 可作为迁移期人工回滚来源。

---

## 验证结果

- `yarn test:ci --runInBand`：18 个套件、115 条测试全部通过。
- `yarn tsc --noEmit`：通过。
- `yarn prettier --check ...`：通过。
- `yarn lint`：exit 0；仅有仓库原有的 8 条 warning，本次文件无新增告警。
- `yarn build`：Next standalone 生产构建成功，包含动态路由 `/api/sync`。
- Docker 镜像构建：当前机器没有 Docker CLI，未执行；上线前仍需运行 `docker build -t nextchat:node22-sqlite .`。
- standalone HTTP 冒烟：环境策略在执行前拒绝启动脚本，未产生临时数据；repository、路由与客户端协议已由自动测试覆盖。

---

## 未完成 / 后续计划

- [ ] 管理员模型服务商、Base URL、Key 和模型列表入 SQLite，并增加后台配置页。
- [ ] 将 `accounts.json` 迁入同一 SQLite，再为同步快照补用户外键和账号删除级联。
- [ ] 可选：同步状态 UI、密钥轮换、附件对象存储和删除传播。
- [ ] 在有 Docker CLI 的环境完成 Node 22 镜像构建与容器级冒烟。

---

## 下次新会话开场白

```text
请先阅读以下变更记录，了解账号云同步迁移状态：
@.claude/changelogs/2026-08-07_account-sync-sqlite.md

账号聊天、用户设置、API Key 和模型偏好快照已迁入 AES-256-GCM 加密的 SQLite，并完成 revision 冲突控制。下一步实现管理员模型服务商配置入库和后台管理页；开始前先检查当前 git status/diff，并保留 favicon/logo 的无关本地改动。
```
