# 管理员模型服务商配置入 SQLite

**日期**：2026-08-07  
**概述**：为 NextChat 增加管理员模型服务商配置中心，将 Base URL、启用状态、模型列表和加密凭证保存到 SQLite，并让配置在下一次模型请求中立即生效。环境变量继续作为逐字段回退来源，便于旧部署平滑迁移。

---

## 变更文件

| 文件路径                                                                   | 操作 | 说明                                                                                 |
| -------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------ |
| `app/lib/provider-config/*`                                                | 新增 | Provider 注册表、输入校验、AES-GCM 加密、SQLite Repository、运行时合并与生产构造入口 |
| `app/api/account/admin/providers/*`                                        | 新增 | 管理员 Provider 列表、更新、恢复环境配置 API                                         |
| `app/components/admin-providers.tsx`                                       | 新增 | Provider 管理界面与编辑交互                                                          |
| `app/components/admin-providers.module.scss`                               | 新增 | Provider 管理页响应式样式                                                            |
| `app/components/admin.tsx`                                                 | 修改 | 增加“模型服务商”标签页                                                               |
| `app/api/auth.ts`                                                          | 修改 | 请求期读取 Provider 快照，执行禁用状态和权威模型校验                                 |
| `app/api/common.ts`、`app/api/*.ts`、`app/api/tencent/route.ts`            | 修改 | 所有模型转发链路改为单请求单配置快照，移除模块级配置缓存                             |
| `app/api/config/route.ts`                                                  | 修改 | 前端配置接口改为读取最新运行时 Provider 配置                                         |
| `app/config/server.ts`                                                     | 修改 | 保留环境变量基线、修复 Tencent 凭证判断并避免日志输出完整系统 Key                    |
| `app/lib/account-auth.ts`                                                  | 修改 | 增加 Provider 配置变更审计事件                                                       |
| `.env.template`                                                            | 修改 | 补充 SQLite、加密根密钥及 Tencent 签名凭证说明                                       |
| `app/lib/provider-config/*.test.ts`                                        | 新增 | 校验、加密、Repository、运行时合并、审计和兼容性测试                                 |
| `app/api/account/admin/providers/route.test.ts`                            | 新增 | 管理员权限、脱敏、更新、删除、审计失败补偿测试                                       |
| `app/components/admin-providers.test.tsx`                                  | 新增 | 管理界面保存、密钥保留/清除、环境继承与恢复测试                                      |
| `app/api/provider-runtime-config.test.ts`                                  | 新增 | 单请求快照、个人 Key、模型权限、302.AI 与定时器回归测试                              |
| `app/config/server.test.ts`                                                | 新增 | 密钥日志脱敏与 Tencent 环境配置回归测试                                              |
| `docs/superpowers/specs/2026-08-07-admin-provider-config-sqlite-design.md` | 新增 | 功能设计文档                                                                         |
| `docs/superpowers/plans/2026-08-07-admin-provider-config-sqlite.md`        | 新增 | TDD 实施计划                                                                         |

`public/favicon.png` 和 `public/logo.png` 是用户原有的无关改动，不属于本功能，也未被覆盖或删除。

---

## 改动详情

### Provider 注册表与 SQLite Repository

固定注册 16 个现有 Provider，统一声明显示名称、凭证能力、运行时字段、可编辑扩展项和模型 Provider ID。API 只接受注册表中的 ID，并严格校验 URL、字段长度、控制字符、重复模型和扩展字段。

Provider Key/Secret 使用 `ACCOUNT_SYNC_ENCRYPTION_KEY` 作为根密钥，经 HKDF-SHA-256 派生独立子密钥，再用 AES-256-GCM 按字段加密：

```text
ACCOUNT_SYNC_ENCRYPTION_KEY
  -> HKDF(provider 专用子密钥)
  -> AES-256-GCM(providerId + field 作为 AAD)
  -> v1.<iv>.<tag>.<ciphertext>
```

SQLite 不保存明文凭证。读取时会验证 JSON 完整结构、时间戳和密文；损坏数据采用 fail-closed，不会静默回退到环境变量。

### 配置优先级与请求期快照

运行时优先级为：

1. 数据库中明确设置的字段；
2. 未覆盖字段继续继承环境变量；
3. 删除数据库记录后恢复纯环境变量行为。

没有数据库记录时，Provider 默认保持“允许用户自带 Key”的既有行为；只有管理员在数据库中明确设为禁用，才会拒绝用户 Key。每个模型请求只读取一次运行时配置，并把同一快照传给鉴权和转发层，避免更新 Key + Base URL 时混用新旧值。

数据库模型数组是对应 Provider 的权威列表。统一鉴权入口支持普通 JSON `model`、Tencent `Model`、Google 路径模型和 Stability 路径模型，302.AI 使用注册表中的 `ai302` 模型标识。

### 管理员 API 与审计

| 接口                                       | 行为                                                          |
| ------------------------------------------ | ------------------------------------------------------------- |
| `GET /api/account/admin/providers`         | 返回全部 Provider、有效值、原始覆盖值、字段来源和脱敏凭证状态 |
| `PATCH /api/account/admin/providers/[id]`  | 校验并保存数据库覆盖；空密钥保留旧值，clear 标志明确清除      |
| `DELETE /api/account/admin/providers/[id]` | 删除数据库覆盖并恢复环境变量行为                              |

API 复用现有管理员 session 鉴权，响应不返回明文 Key/Secret。配置变更与账号审计位于不同存储，因此使用加密原始快照做补偿：若审计写入失败，PATCH/DELETE 会恢复变更前的 Provider 记录和旧密钥，并返回 500。

### 管理员界面

后台新增“模型服务商”标签页，支持：

- 查看 Provider 启用状态、配置来源、Base URL、密钥状态、模型数量和更新时间；
- 编辑显示名称、启用状态、Base URL、扩展选项和权威模型列表；
- 替换或明确清除 Key/Secret，密钥输入框不会回填旧值；
- 删除数据库覆盖并恢复环境变量；
- 区分有效环境值与原始数据库覆盖，避免只改标签时把继承值意外固化进 SQLite。

---

## API 变化

| 旧接口                | 新接口                                     | 说明                                  |
| --------------------- | ------------------------------------------ | ------------------------------------- |
| 无                    | `GET /api/account/admin/providers`         | 管理员读取 Provider 配置              |
| 无                    | `PATCH /api/account/admin/providers/[id]`  | 管理员更新 Provider 数据库覆盖        |
| 无                    | `DELETE /api/account/admin/providers/[id]` | 恢复 Provider 环境变量配置            |
| `auth(req, provider)` | `auth(req, provider, runtimeConfig?)`      | 路由可传入同一请求的运行时配置快照    |
| `requestOpenai(req)`  | `requestOpenai(req, runtimeConfig)`        | OpenAI/Azure 转发不再自行二次读取配置 |

---

## 验证结果

- `yarn test:ci --runInBand`：28 个测试套件、174 个测试全部通过。
- `yarn tsc --noEmit`：通过。
- Provider 相关文件 Prettier 检查：通过。
- `git diff --check`：通过，仅有 Windows LF/CRLF 提示。
- `yarn lint`：退出码 0，仅有仓库既有 warning。
- `yarn build`：生产构建成功；日志保留仓库既有可选 WebSocket 依赖、SQLite experimental、动态 cookie/static generation 等 warning。
- 独立代码审查第一轮发现的 6 个 Important 已全部修复；第二轮审查代理因服务端 429 未产出结果，随后由主线程按安全、性能和错误处理清单复审，并额外修复 Stability 提前返回时的定时器泄漏。

---

## 注意事项

- 创建数据库 Provider 覆盖前必须配置有效的 `ACCOUNT_SYNC_ENCRYPTION_KEY`；不要提交真实密钥。
- 纯环境变量部署且 `providers` 表为空时，运行时仍兼容旧行为，不会仅因缺少加密密钥而阻断模型请求。
- 当前使用 Node 22 `node:sqlite`，构建日志会显示 experimental warning。
- 当前环境没有 Docker CLI，未执行镜像构建、挂载卷持久化和容器重启恢复验收。
- 运行时 Repository 仍会为完整性校验重复解密一次 Provider 密钥，这是低优先级性能优化，不影响功能正确性或密钥安全。

---

## 未完成 / 后续计划

- [ ] 在具备 Docker 的环境执行镜像构建、数据卷持久化和容器重启恢复验收。
- [ ] 如高并发下配置读取成为热点，再合并 Repository 的校验与运行时解密步骤。

---

## 下次新会话开场白

```text
请先阅读以下改动记录，了解管理员模型服务商配置入 SQLite 的完整实现：
@.claude/changelogs/2026-08-07_admin-provider-config-sqlite.md

管理员 Provider 配置中心已经完成，并通过全量测试、TypeScript、lint 和生产构建。当前仅缺少 Docker 容器级验收；如果继续产品路线图，请在此基础上实现“联网搜索”，不要改动用户原有的 public/favicon.png 和 public/logo.png。
```
