# 账号认证数据迁移到 SQLite

**日期**：2026-08-07  
**概述**：将账号、邀请、会话、密码重置令牌和审计日志从 JSON 文件存储切换为 SQLite，并保留旧 JSON 的一次性导入能力，避免升级时丢失登录数据。

---

## 变更文件

| 文件路径                              | 操作 | 说明                                              |
| ------------------------------------- | ---- | ------------------------------------------------- |
| `app/lib/account-auth-sqlite.ts`      | 新增 | SQLite 账号仓库、完整记录读写和旧 JSON 一次性迁移 |
| `app/lib/account-auth-sqlite.test.ts` | 新增 | 往返读写及迁移行为测试                            |
| `app/lib/account-auth-server.ts`      | 修改 | 认证服务初始化改用 SQLite，并触发旧数据迁移       |
| `.env.template`                       | 修改 | 将 `ACCOUNT_DATA_FILE` 标注为旧数据迁移源         |
| `Dockerfile`                          | 修改 | 明确 SQLite 默认数据卷路径                        |

---

## 关键行为

- SQLite 默认文件为 `data/nextchat.sqlite`，可用 `ACCOUNT_DB_FILE` 覆盖。
- 若数据库账号相关表为空且 `ACCOUNT_DATA_FILE` 存在，则导入一次；源 JSON 不删除。
- 迁移标记写入 `meta` 表；已有 SQLite 数据不会被旧 JSON 覆盖。
- 写入采用单事务替换五类账号数据，避免半写入状态。
- 审计日志 `metadata` 继续以 JSON 保存并在读取时校验对象结构。

---

## 验证

- `yarn test:ci --runInBand`：29 个 suite、176 个测试通过。
- `yarn tsc --noEmit`：通过。
- `yarn lint`：通过，仅仓库原有 warning。
- `yarn build`：成功；保留仓库已有的 `bufferutil`、`utf-8-validate` 和 React Hook warning。

---

## 未完成 / 后续

- 需要在有 Docker 的环境验证数据卷挂载、重启恢复和旧 `accounts.json` 迁移。
- 联网搜索 `/api/search` 和聊天联网开关尚未实现。

---

## 下次新会话开场白

```text
请先阅读 .claude/changelogs/2026-08-07_migrate-account-auth-to-sqlite.md。
账号认证数据已经切换到 SQLite，测试、类型检查、lint、build 均通过。请继续实现路线图中的 Web 搜索：先设计并实现服务端 /api/search，再接入聊天发送前的联网开关和搜索结果上下文注入；编码、验证、审查严格串行，不要启动并行代理。
```
