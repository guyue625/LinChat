# MySQL 数据存储

账号登录启用后，可将服务端聊天快照存入 MySQL 8.0 / 8.4。浏览器保留缓存和当前编辑状态，登录、切回页面以及每 5 秒从服务端读取；变更在停止更新 1.5 秒后自动保存。其他设备使用同一站点、同一账号登录即可读取。

设置 `ACCOUNT_DB_PROVIDER=mysql` 后，账号、登录会话、邀请码、密码重置令牌、审计、管理员模型配置和聊天快照全部保存在 MySQL，运行时不再读取 SQLite。多个服务实例须使用同一个 MySQL 库、`ACCOUNT_SESSION_SECRET` 和 `ACCOUNT_SYNC_ENCRYPTION_KEY`。账号和模型配置的修改使用数据库事务锁协调。

也兼容仅迁移聊天的模式：保留 `ACCOUNT_DB_PROVIDER=sqlite`，设置 `ACCOUNT_CHAT_STORAGE=mysql`。该模式的账号和模型配置仍在 SQLite，不适用于各自持有独立 SQLite 的多实例部署。

## 配置

先在 MySQL 创建一个专用数据库和用户，使用 InnoDB。运行用户需要该库的 `CREATE`、`SELECT`、`INSERT`、`UPDATE`、`DELETE` 权限。应用首次连接自动创建 `nextchat_` 前缀的表。

在服务端 `.env.local` 或容器环境变量中配置：

```dotenv
ACCOUNT_AUTH_ENABLED=true
ACCOUNT_DB_PROVIDER=mysql
ACCOUNT_MYSQL_URL=mysql://nextchat:YOUR_PASSWORD@127.0.0.1:3306/nextchat
ACCOUNT_SESSION_SECRET=YOUR_EXISTING_SESSION_SECRET
ACCOUNT_SYNC_ENCRYPTION_KEY=YOUR_EXISTING_BASE64_KEY
```

新部署还需配置 `ACCOUNT_ADMIN_USERNAME`、`ACCOUNT_ADMIN_PASSWORD`；已有部署沿用账号配置和密钥。URL 中的用户名、密码含特殊字符时需进行 URL 编码。Docker 内的 `127.0.0.1` 指容器自身，应改为数据库服务名或可访问的数据库主机。需要 TLS 的托管服务可在 URL 中使用 mysql2 支持的 `ssl` 参数，例如 `?ssl=%7B%22rejectUnauthorized%22%3Atrue%7D`；私有 CA 按 mysql2 连接参数配置。

新部署可以直接运行 `yarn dev`。已有 SQLite 数据时，先配置连接和原有密钥，暂停旧应用的写入，运行 `yarn migrate:mysql`，成功后再设置 `ACCOUNT_DB_PROVIDER=mysql` 并重启应用。迁移只读原 SQLite，在同一 MySQL 事务中迁移账号、模型配置和聊天；目标表非空或已经迁移时拒绝覆盖。聊天版本从 1 重新开始，客户端应刷新页面。

生产部署需重新构建应用并重启。原有 Compose 文件不会自动传入新增变量，需要在所用服务的 `environment` 中添加上述变量。静态导出不支持服务端 MySQL。

## 迁移与数据行为

- 默认 `ACCOUNT_DB_PROVIDER=sqlite`，显式设为 `mysql` 才启用完整 MySQL 存储；它也会强制聊天使用 MySQL。
- 完整 MySQL 模式使用显式迁移命令，不会运行时重新导入 SQLite。仅聊天模式第一次读取某账号时，若 MySQL 无记录，会从现有 SQLite 快照（或旧 JSON 快照）导入，原文件保留。
- 若服务端没有任何快照，首次登录设备用本地聊天初始化。已有服务端快照时，以服务端为准替换旧缓存；本次打开页面后的并发编辑通过三方合并保留。未上传的离线缓存不会覆盖已有主存储，切换前请先同步或导出备份。
- 同一会话中的独立消息可合并；双方同时修改同一字段时本地修改优先；会话或消息的删除优先于对被删除内容的修改。
- MySQL 模式保留内嵌图片和音频，不再将其替换为同步占位符。已有旧快照中丢失的附件无法自动恢复，迁移旧缓存附件需要在仍保存原附件的浏览器上运行一次同步。
- 上传前会读取本机 `/api/cache/` 和 `blob:` 附件并转换为内嵌数据；正文随快照加密入库，其他设备无需访问原浏览器缓存。原附件已丢失时同步明确失败，不会把不可用链接当成保存成功。当前不依赖额外对象存储，快照大小限制也包含附件。
- 自定义插件及其凭据、绘图记录和参数、逐会话草稿也随账号快照加密保存。本地缓存按账号分区，切换账号会清空旧账号视图；绘图的异步结果不会写进切换后的账号。首次使用时已有未归属数据归入首次初始化的工作区，后续不自动混入其他账号。
- MCP 为站点共享配置，保存在 `nextchat_settings` 的加密字段中。首次访问导入 `app/mcp/mcp_config.json`（保留原文件）；读取完整配置、修改或重启服务器需要管理员权限，工具调用需要登录。MCP 的进程、连接和工具运行状态仍属于各应用实例的内存状态。
- 单次快照上限仍为 15 MiB（JSON）；加密编码后更大，MySQL 的 `max_allowed_packet` 建议至少 32 MiB，反向代理也需允许对应请求体大小。
- 快照使用现有 AES-256-GCM 加密，绑定用户 ID 和版本；数据库连接密码仅保存在服务端。请备份 SQLite、MySQL 和原加密密钥。
- MySQL 故障时请求失败，不会自动写回 SQLite。恢复连接后可以继续保存。浏览器关闭前未成功上传的内容不保证已持久化至 MySQL。
- 完整 MySQL 模式删除账号时，账号、登录会话和聊天清理在同一事务中完成；MySQL 清空聊天密文并保留空墓碑，防止旧请求恢复数据。仅聊天模式仍使用 SQLite 待清理任务，后续账号同步请求重试失败的清理。
- 切回 SQLite 不会自动反向迁移，原 SQLite 快照可能已过时；不要将切换存储类型当作无损回滚。

## 验证

在两台设备上登录同一账号，创建、修改和删除聊天，等待自动保存后在另一端刷新。确认消息与删除结果一致；不同账号应互不可见。MySQL 表中的 `state_ciphertext` 不应包含消息明文。

`yarn test:mysql` 使用本地配置的真实 MySQL，检查注册、登录、审计、模型配置加密、聊天冲突和删除、事务回滚及并发锁；测试数据在事务中回滚。普通 `yarn test:ci` 强制使用 SQLite/模拟连接，不会访问本地配置的真实 MySQL。

浏览器显示缓存、版本检查缓存、数据库连接参数、加密根密钥，以及独立 WebDAV/Upstash 备份连接配置不迁入账号数据库。
