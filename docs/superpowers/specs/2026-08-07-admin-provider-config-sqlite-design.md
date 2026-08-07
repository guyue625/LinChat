# 管理员模型服务商配置入 SQLite 设计

## 背景与目标

NextChat 当前从环境变量读取模型服务商的 Base URL、API Key、API Secret 和全局 `CUSTOM_MODELS`。大部分 provider 模块还会在模块加载时缓存配置，因此修改部署环境后必须重启服务。

本功能让管理员在 `/admin` 中管理现有模型服务商，并把配置保存到已有 SQLite 数据库。数据库配置在下一次请求时生效，不要求重启；未被数据库覆盖的字段继续使用环境变量，便于渐进迁移和故障回退。

本期覆盖现有模型相关 provider：OpenAI、Azure、Google、Anthropic、Baidu、ByteDance、Alibaba、Tencent、Moonshot、Iflytek、DeepSeek、xAI、ChatGLM、SiliconFlow、302.AI 和 Stability。

## 非目标

- 不迁移账号、邀请、会话等账号数据；它们仍使用现有账号服务。
- 不管理访问码、Cloudflare、WebDAV、统计或 MCP 配置。
- 不实现服务商连通性测试、用量统计、Key 轮换调度或多套同类型 provider 实例。
- 不改变用户自行填写 API Key 的行为。
- 不删除现有环境变量支持。

## 配置优先级与运行时语义

每个 provider 使用固定 ID，并且最多有一条数据库记录。

1. 没有数据库记录时，完全使用现有环境变量。
2. 有数据库记录时，`enabled` 明确覆盖环境变量推导出的启用状态。
3. 数据库中非空的 Base URL、Key、Secret 和扩展字段覆盖对应环境变量；未设置字段回退环境变量。
4. 删除数据库记录会恢复该 provider 的纯环境变量行为。
5. 管理员清除某个数据库密钥只会移除数据库覆盖值，之后重新回退环境变量。若要禁止环境变量中的 provider，应将 provider 设为禁用。
6. 每个模型请求、鉴权请求和 `/api/config` 请求都读取最新数据库覆盖层；不在模块加载时缓存 provider 配置。

数据库不可用、记录损坏或密文无法解密时采用 fail-closed：受影响的数据库 provider 配置不用于转发请求，服务端记录不含秘密值的错误日志。不能静默回退环境变量，以免管理员已经禁用或覆盖的 provider 被意外重新启用。

## 数据模型

复用 `providers` 表的现有字段：

```sql
CREATE TABLE IF NOT EXISTS providers (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  base_url TEXT,
  api_key TEXT,
  api_secret TEXT,
  extra_json TEXT,
  updated_at TEXT NOT NULL
);
```

- `id`：固定 provider ID，仅允许服务端注册表中的值。
- `label`：管理员可见名称。
- `enabled`：数据库覆盖层的明确启用状态。
- `base_url`：可选数据库覆盖值。
- `api_key`、`api_secret`：只保存 AES-256-GCM 密文，绝不保存明文。
- `extra_json`：结构化、非秘密配置，包括 API version、organization ID、模型覆盖列表等。
- `updated_at`：ISO 8601 时间。

`extra_json` 使用带版本的结构：

```ts
type ProviderExtra = {
  version: 1;
  options: Record<string, string>;
  models: null | Array<{ name: string; alias?: string }>;
};
```

`models: null` 表示继承环境变量和内置模型；数组表示该 provider 的权威可见模型列表，空数组表示不向前端展示该 provider 的任何模型。模型覆盖只影响前端可见列表和请求模型名称校验/转换，不保存用户聊天设置。

## 密钥加密

继续使用必填的 `ACCOUNT_SYNC_ENCRYPTION_KEY` 作为根密钥，通过 HKDF-SHA-256 派生 provider 专用子密钥；同步快照和 provider 密钥不会直接复用同一 AES key。

每个密文字段使用随机 12 字节 IV 和 AES-256-GCM，AAD 包含格式版本、provider ID 和字段名。密文格式带版本，方便以后迁移。API 响应、审计日志和普通错误日志均不得包含密钥明文或完整密文。

如果根密钥缺失或格式错误，管理员 provider API 返回配置错误；模型转发不得使用数据库中的密文。

## 服务端组件

### Provider 注册表

新增单一注册表，定义固定 ID、显示名、支持的字段、环境变量映射、默认 Base URL、模型 provider 名称和扩展选项。API 校验、后台表单和运行时解析共同使用该注册表，避免三套 provider 映射漂移。

特殊凭证映射如下：

- Tencent：`apiKey` 保存 Secret ID，`apiSecret` 保存 Secret Key。
- Baidu：`apiKey` 保存 API Key，`apiSecret` 保存 Secret Key。
- Iflytek：`apiKey` 保存 API Key，`apiSecret` 保存 API Secret。
- 其他 provider 只使用 `apiKey`；Azure、Anthropic 等版本号放在 `options`。

### Repository

Repository 负责 SQLite CRUD、加解密和 JSON 解析，并返回明确的领域对象。写入使用参数化 SQL和事务。读取时验证 provider ID、布尔值、URL、扩展字段和模型结构；损坏记录抛出专用错误，不返回部分数据。

### 运行时覆盖层

保留 `getServerSideConfig()` 作为环境变量基线，新增异步运行时解析函数：

```ts
getRuntimeServerSideConfig(): Promise<ServerSideConfig>
```

它读取数据库记录并按本设计的优先级合并。所有模型 provider、系统 Key 鉴权和 `/api/config` 改为在请求处理期间调用该函数。现有模块级 `const serverConfig = ...` 必须移入请求路径或改为显式传参，保证保存后下一次请求立即生效。

`/api/config` 继续只向已登录用户暴露服务器模型列表，不暴露 Base URL、Key、Secret 或内部错误详情。

### 管理员 API

- `GET /api/account/admin/providers`：返回注册表中的全部 provider 及其有效来源状态、可编辑字段、模型配置和 `hasApiKey` / `hasApiSecret`。不返回明文密钥。
- `PATCH /api/account/admin/providers/[id]`：校验并 upsert 数据库覆盖层。省略密钥字段表示保留旧数据库值；非空字符串表示替换；`clearApiKey` / `clearApiSecret` 表示删除数据库覆盖值并恢复环境变量回退。
- `DELETE /api/account/admin/providers/[id]`：删除该 provider 的数据库覆盖记录并恢复环境变量行为。

所有路由复用现有管理员 session 鉴权。成功修改后写入管理后台当前正在读取的账号审计流（账号体系迁移 SQLite 前仍由现有账号 repository 持久化），metadata 只包含 provider ID、变更字段名和启用状态，不包含配置值。已有但尚未接线的 SQLite `audit_logs` 表不在本期启用，避免产生后台不可见的第二套审计来源。

输入限制：固定 provider ID；label 最长 64；URL 必须是 `http:` 或 `https:` 且最长 2048；单个密钥最长 16 KiB；单个模型名最长 256、别名最长 128；每个 provider 最多 500 个模型；拒绝重复模型名、控制字符和会破坏现有 `CUSTOM_MODELS` 语法的逗号。

## 模型列表合并

环境变量 `CUSTOM_MODELS` 仍作为基线。对于 `models !== null` 的数据库记录，运行时层先枚举该 provider 的内置模型及环境变量自定义模型，并在最终 `customModels` 尾部追加精确的禁用 token；随后为数据库列表追加启用 token。由于现有解析器按顺序处理，数据库列表成为该 provider 的最终权威结果，同时不影响其他 provider。

禁用 provider 时，运行时层同样隐藏其内置和环境变量模型，并清空用于服务端转发的系统凭证。用户自己提供的 API Key 不绕过管理员对 provider 的禁用状态。

## 管理员界面

在现有 `/admin` 新增“模型服务商”标签页。为避免继续扩张 `admin.tsx`，新增独立的 provider 管理组件；父组件只负责标签切换。

页面展示 provider 卡片列表：名称、数据库覆盖/环境变量继承状态、启用状态、Base URL、密钥是否已设置、模型数量和更新时间。编辑面板根据注册表能力展示字段；密钥输入框始终为空并显示“已设置/未设置”，保存空输入不会覆盖旧值，清除操作需要明确点击。

保存成功后重新拉取列表并显示结果；401 跳登录，403 返回首页，其余错误在页面内显示。删除覆盖配置属于恢复环境变量的可逆操作，需要一次确认，但不使用“永久删除”措辞。

## 错误处理与并发

- SQLite 写入使用事务，单次 PATCH 原子更新整条 provider 记录。
- 首版采用后写覆盖，不增加 revision；管理员页面保存后总是重新 GET，显示数据库中的最终状态。
- 未知 provider、无效字段和无效模型返回 400；未登录返回 401；非管理员返回 403；数据库或加密失败返回 500。
- API 错误消息不回显请求中的秘密字段。
- 运行时配置损坏时不转发请求，并返回通用服务端配置错误。

## 测试策略

遵循 TDD，至少覆盖：

1. provider 密钥派生、加密、解密、错误 AAD 和损坏密文。
2. Repository 的 upsert、保留密钥、清除密钥、删除、JSON 校验和密钥不落明文。
3. 环境变量基线、逐字段数据库覆盖、无记录回退、删除恢复、禁用优先和损坏记录 fail-closed。
4. 模型列表的继承、权威替换、空列表、别名、重复项和 provider 隔离。
5. 管理员 API 的 401、403、GET 脱敏、PATCH 校验、DELETE 和审计日志脱敏。
6. 管理员组件的字段展示、空密钥保留、明确清除和错误状态。
7. 将模块级配置移入请求路径后的 provider 回归测试。

最终执行定向 Jest、完整 `yarn test:ci --runInBand`、`yarn tsc --noEmit`、Prettier、`git diff --check`、`yarn lint` 和 `yarn build`。如果当前机器仍无 Docker CLI，容器级验证继续作为部署验收项明确记录，不宣称已完成。

## 完成标准

- 管理员能在后台查看、启用/禁用、编辑和恢复全部现有模型 provider 配置。
- API Key/API Secret 在 SQLite 中为认证加密密文，任何读取 API 和日志都不泄露秘密。
- 数据库配置保存后下一次模型请求和 `/api/config` 请求立即采用新值。
- 未迁移 provider 保持现有环境变量行为，删除数据库覆盖后可恢复该行为。
- 数据库模型列表能权威控制对应 provider 的前端可见模型，不影响其他 provider。
- 权限、输入校验、审计与失败关闭行为都有自动化测试。
