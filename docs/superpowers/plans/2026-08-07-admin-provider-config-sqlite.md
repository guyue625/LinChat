# 管理员模型服务商配置入 SQLite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让管理员在 `/admin` 管理全部现有模型服务商，并让加密 SQLite 配置在下一次请求中覆盖环境变量。

**Architecture:** 固定 provider 注册表是单一事实源；Repository 负责 SQLite 与密钥加密；异步运行时解析层把数据库记录覆盖到现有环境变量基线。管理员 API 只返回密钥存在标记，前端 provider 子组件独立于现有大型 `admin.tsx`。全部新增行为按 RED → GREEN → REFACTOR 实施。

**Tech Stack:** Next.js 14 Route Handlers、TypeScript、Node 22 `node:sqlite`、AES-256-GCM/HKDF、React 18、Jest、Testing Library、Sass modules。

**Repository constraint:** Agent 不执行 `git add`、`git commit`、`git push` 或其他 Git 写操作。每个任务结束时只报告可由用户自行提交的文件范围。

---

## 文件结构

- `app/lib/provider-config/types.ts`：领域类型与管理员 DTO。
- `app/lib/provider-config/registry.ts`：固定 provider 注册表及环境变量映射。
- `app/lib/provider-config/validation.ts`：PATCH、URL、扩展配置和模型校验。
- `app/lib/provider-config/crypto.ts`：HKDF 子密钥及字段级 AES-GCM。
- `app/lib/provider-config/repository.ts`：SQLite CRUD、密钥保留/清除和脱敏读取。
- `app/lib/provider-config/runtime.ts`：环境变量基线覆盖与模型 token 合并。
- `app/lib/provider-config/server.ts`：生产 Repository 构造入口。
- `app/api/account/admin/providers/route.ts`：管理员 provider 列表。
- `app/api/account/admin/providers/[id]/route.ts`：PATCH/DELETE。
- `app/components/admin-providers.tsx` 与同名 SCSS：provider 管理标签页。
- 对应 `*.test.ts(x)`：所有服务器单元、路由、UI 和请求期配置回归。

### Task 1: Provider 注册表、类型与输入校验

**Files:**

- Create: `app/lib/provider-config/types.ts`
- Create: `app/lib/provider-config/registry.ts`
- Create: `app/lib/provider-config/validation.ts`
- Test: `app/lib/provider-config/validation.test.ts`

- [ ] **Step 1: 写失败测试**

测试固定 ID 全覆盖现有服务商；未知 ID、非 HTTP(S) URL、超长字段、重复模型、控制字符及逗号被拒绝；省略密钥与 clear 标志可区分。

```ts
expect(PROVIDER_IDS).toEqual([
  "openai",
  "azure",
  "google",
  "anthropic",
  "baidu",
  "bytedance",
  "alibaba",
  "tencent",
  "moonshot",
  "iflytek",
  "deepseek",
  "xai",
  "chatglm",
  "siliconflow",
  "302ai",
  "stability",
]);
expect(() =>
  validateProviderPatch("openai", {
    models: [{ name: "gpt-4o" }, { name: "gpt-4o" }],
  }),
).toThrow("模型名称不能重复");
```

- [ ] **Step 2: 验证 RED**

Run: `yarn test:ci app/lib/provider-config/validation.test.ts --runInBand`

Expected: FAIL，因为模块不存在。

- [ ] **Step 3: 写最小实现**

公开类型固定为：

```ts
export type ProviderModel = { name: string; alias?: string };
export type ProviderExtra = {
  version: 1;
  options: Record<string, string>;
  models: ProviderModel[] | null;
};
export type ProviderPatch = {
  label?: string;
  enabled?: boolean;
  baseUrl?: string | null;
  apiKey?: string;
  apiSecret?: string;
  clearApiKey?: boolean;
  clearApiSecret?: boolean;
  options?: Record<string, string>;
  models?: ProviderModel[] | null;
};
```

注册表为每个 provider 定义 `id`、`label`、`providerName`、凭证能力、允许的 option 字段及环境变量映射。校验返回规范化 patch，不保留未知字段。

- [ ] **Step 4: 验证 GREEN 并重构重复清单**

Run: `yarn test:ci app/lib/provider-config/validation.test.ts --runInBand`

Expected: PASS。

### Task 2: Provider 字段级加密

**Files:**

- Create: `app/lib/provider-config/crypto.ts`
- Test: `app/lib/provider-config/crypto.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
const encrypted = encryptProviderSecret({
  rootKey,
  providerId: "openai",
  field: "apiKey",
  plaintext: "sk-secret",
});
expect(encrypted).not.toContain("sk-secret");
expect(
  decryptProviderSecret({
    rootKey,
    providerId: "openai",
    field: "apiKey",
    encrypted,
  }),
).toBe("sk-secret");
expect(() =>
  decryptProviderSecret({
    rootKey,
    providerId: "google",
    field: "apiKey",
    encrypted,
  }),
).toThrow();
```

- [ ] **Step 2: 验证 RED**

Run: `yarn test:ci app/lib/provider-config/crypto.test.ts --runInBand`

Expected: FAIL，因为加密函数不存在。

- [ ] **Step 3: 写最小实现**

用 HKDF-SHA-256 从 `ACCOUNT_SYNC_ENCRYPTION_KEY` 派生 32 字节子密钥；每次加密使用随机 12 字节 IV；AAD 为 `nextchat-provider:v1:${providerId}:${field}`；格式为 `v1.<iv>.<tag>.<ciphertext>`。

- [ ] **Step 4: 验证 GREEN**

Run: `yarn test:ci app/lib/provider-config/crypto.test.ts --runInBand`

Expected: 正常往返、错误 provider/字段/key 和篡改密文测试全部 PASS。

### Task 3: SQLite Repository

**Files:**

- Create: `app/lib/provider-config/repository.ts`
- Create: `app/lib/provider-config/server.ts`
- Test: `app/lib/provider-config/repository.test.ts`

- [ ] **Step 1: 写失败测试**

使用 `DatabaseSync(":memory:")` 与 `applyDatabaseSchema()` 覆盖 create/read/update/delete、密钥保留、明确清除、JSON 损坏和数据库不含明文。

```ts
repository.upsert("openai", {
  label: "OpenAI 主线路",
  enabled: true,
  baseUrl: "https://api.example.com",
  apiKey: "sk-secret",
  models: [{ name: "gpt-4o" }],
});
expect(repository.get("openai")?.hasApiKey).toBe(true);
expect(rawRow.api_key).not.toContain("sk-secret");
repository.upsert("openai", { label: "重命名" });
expect(repository.getSecret("openai", "apiKey")).toBe("sk-secret");
repository.upsert("openai", { clearApiKey: true });
expect(repository.getSecret("openai", "apiKey")).toBeUndefined();
```

- [ ] **Step 2: 验证 RED**

Run: `yarn test:ci app/lib/provider-config/repository.test.ts --runInBand`

Expected: FAIL，因为 Repository 不存在。

- [ ] **Step 3: 写最小实现**

```ts
export class ProviderConfigRepository {
  list(): ProviderRecord[];
  get(id: ProviderId): ProviderRecord | null;
  upsert(id: ProviderId, patch: ValidatedProviderPatch): ProviderRecord;
  delete(id: ProviderId): boolean;
  getSecret(id: ProviderId, field: "apiKey" | "apiSecret"): string | undefined;
}
```

`upsert` 在 `BEGIN IMMEDIATE` 中读取旧行并按 patch 保留、替换或清除密钥。全部 SQL 参数化；`extra_json` 损坏抛 `CorruptProviderConfigError`。`server.ts` 用 `getDb()` 和 `getSyncEncryptionKey()` 构造单例并暴露测试 reset helper。

- [ ] **Step 4: 验证 GREEN**

Run: `yarn test:ci app/lib/provider-config/repository.test.ts --runInBand`

Expected: PASS。

### Task 4: 运行时覆盖与模型列表合并

**Files:**

- Create: `app/lib/provider-config/runtime.ts`
- Test: `app/lib/provider-config/runtime.test.ts`
- Modify: `app/config/server.ts`

- [ ] **Step 1: 写失败测试**

覆盖无记录回退、逐字段数据库覆盖、删除恢复、禁用优先、损坏记录 fail-closed、`models: null` 继承、数组权威替换、空数组隐藏和 provider 隔离。

```ts
const config = resolveProviderRuntimeConfig(environmentConfig, [
  record({
    id: "openai",
    enabled: true,
    baseUrl: "https://db.example",
    models: [],
  }),
]);
expect(config.baseUrl).toBe("https://db.example");
expect(config.providerEnabled.openai).toBe(true);
expect(
  isModelNotavailableInServer(config.customModels, "gpt-4o", [
    ServiceProvider.OpenAI,
  ]),
).toBe(true);
```

- [ ] **Step 2: 验证 RED**

Run: `yarn test:ci app/lib/provider-config/runtime.test.ts --runInBand`

Expected: FAIL，因为解析函数不存在。

- [ ] **Step 3: 写最小实现**

`getServerSideConfig()` 保持纯环境变量基线并导出稳定类型；新增：

```ts
export type RuntimeServerSideConfig = ServerSideConfig & {
  providerEnabled: Record<ProviderId, boolean>;
};
export async function getRuntimeServerSideConfig(): Promise<RuntimeServerSideConfig>;
```

模型替换先用 `collectModelTable(DEFAULT_MODELS, env.customModels)` 枚举对应 provider 名称，追加精确禁用 token，再追加数据库启用 token。禁用 provider 时清空系统凭证并隐藏其模型。

- [ ] **Step 4: 验证 GREEN**

Run: `yarn test:ci app/lib/provider-config/runtime.test.ts --runInBand`

Expected: PASS。

### Task 5: 管理员审计与 Provider API

**Files:**

- Modify: `app/lib/account-auth.ts`
- Test: `app/lib/provider-config/audit.test.ts`
- Create: `app/api/account/admin/providers/route.ts`
- Create: `app/api/account/admin/providers/[id]/route.ts`
- Test: `app/api/account/admin/providers/route.test.ts`

- [ ] **Step 1: 写审计失败测试**

构造内存账号 Repository，验证只有管理员可调用 `recordProviderConfigAudit()`，metadata 只含 provider ID、字段名和启用状态。

- [ ] **Step 2: 验证 RED、实现并验证 GREEN**

Run: `yarn test:ci app/lib/provider-config/audit.test.ts --runInBand`

先确认 FAIL；再在 `AccountAuthService` 内复用 `mutate`、`ensureAdmin`、`appendAudit`，运行至 PASS。

- [ ] **Step 3: 写 API 失败测试**

验证管理员权限、GET 全量注册表与 secret 脱敏、PATCH 校验与 upsert、DELETE 恢复、`Cache-Control: private, no-store` 和审计 metadata 脱敏。

- [ ] **Step 4: 验证 RED**

Run: `yarn test:ci app/api/account/admin/providers/route.test.ts --runInBand`

Expected: FAIL，因为路由不存在。

- [ ] **Step 5: 写最小路由并验证 GREEN**

GET 返回 capabilities、来源状态、模型配置及 `hasApiKey`/`hasApiSecret`；PATCH 调用校验后 upsert；DELETE 删除覆盖；所有错误使用现有账号错误响应或 provider 脱敏错误映射。

### Task 6: 管理员 Provider UI

**Files:**

- Create: `app/components/admin-providers.tsx`
- Create: `app/components/admin-providers.module.scss`
- Create: `app/components/admin-providers.test.tsx`
- Modify: `app/components/admin.tsx`
- Modify: `app/components/admin.module.scss`

- [ ] **Step 1: 写失败组件测试**

用 Testing Library mock fetch，验证列表、继承/覆盖标记、密钥不回填、空输入不提交、清除标志、保存后重新 GET、恢复环境变量确认和错误提示。

```tsx
render(<AdminProviders />);
expect(await screen.findByText("OpenAI")).toBeInTheDocument();
fireEvent.click(screen.getByRole("button", { name: "编辑 OpenAI" }));
expect(screen.getByLabelText("API Key")).toHaveValue("");
fireEvent.click(screen.getByRole("button", { name: "保存" }));
expect(JSON.parse(patchCall.body as string)).not.toHaveProperty("apiKey");
```

- [ ] **Step 2: 验证 RED**

Run: `yarn test:ci app/components/admin-providers.test.tsx --runInBand`

Expected: FAIL，因为组件不存在。

- [ ] **Step 3: 写最小组件**

组件自行负责 provider API 的加载、编辑、PATCH、DELETE 和错误状态。父 `AdminPage` 只增加 `providers` tab、图标、审计文案和 `<AdminProviders />`。字段按 capabilities 渲染；密钥输入始终为空。

- [ ] **Step 4: 验证 GREEN**

Run: `yarn test:ci app/components/admin-providers.test.tsx --runInBand`

Expected: PASS。

### Task 7: 模型请求改为请求期配置

**Files:**

- Modify: `app/api/auth.ts`, `app/api/common.ts`, `app/api/config/route.ts`
- Modify: `app/api/openai.ts`, `app/api/anthropic.ts`, `app/api/google.ts`
- Modify: `app/api/baidu.ts`, `app/api/bytedance.ts`, `app/api/alibaba.ts`
- Modify: `app/api/moonshot.ts`, `app/api/iflytek.ts`, `app/api/deepseek.ts`
- Modify: `app/api/xai.ts`, `app/api/glm.ts`, `app/api/siliconflow.ts`
- Modify: `app/api/302ai.ts`, `app/api/stability.ts`, `app/api/tencent/route.ts`
- Modify: `app/api/proxy.ts`
- Test: `app/api/provider-runtime-config.test.ts`

- [ ] **Step 1: 写失败回归测试**

Mock `getRuntimeServerSideConfig()`，证明连续两次请求会读取两次配置；disabled provider 即使带用户 Key 也被拒绝；`/api/config` 使用最新模型字符串且不暴露 secret。

- [ ] **Step 2: 验证 RED**

Run: `yarn test:ci app/api/provider-runtime-config.test.ts --runInBand`

Expected: FAIL，因为现有模块缓存环境变量配置。

- [ ] **Step 3: 最小改造请求路径**

删除模型模块级 `const serverConfig = getServerSideConfig()`。每个 handler 或 request helper 在请求内 `await getRuntimeServerSideConfig()`。`auth()` 把 `ModelProvider` 和 Azure path 映射到 `ProviderId`，先检查 `providerEnabled[id]`，再处理用户 Key/系统 Key。`/api/config` 在请求内构造 danger config。

Cloudflare、WebDAV、访问码等非模型配置继续使用环境变量，不纳入 provider 表。

- [ ] **Step 4: 验证 GREEN 与静态检查**

Run: `yarn test:ci app/api/provider-runtime-config.test.ts --runInBand`

Run: `rg -n "const serverConfig = getServerSideConfig\(\)" app/api --glob '*.ts'`

Expected: 测试 PASS；模型 provider、`auth.ts`、`common.ts` 和 `config/route.ts` 不再命中模块级缓存。

### Task 8: 文档、完整验证和改动说明

**Files:**

- Modify: `.env.template`
- Create: `.claude/changelogs/2026-08-07_admin-provider-config-sqlite.md`

- [ ] **Step 1: 更新部署说明**

说明 `ACCOUNT_SYNC_ENCRYPTION_KEY` 同时作为 provider 配置加密根密钥，但通过 HKDF 隔离用途；不写真实 key。

- [ ] **Step 2: 运行定向测试**

Run: `yarn test:ci app/lib/provider-config app/api/account/admin/providers app/components/admin-providers.test.tsx app/api/provider-runtime-config.test.ts --runInBand`

Expected: 全部 PASS。

- [ ] **Step 3: 运行完整验证**

Run: `yarn test:ci --runInBand`

Run: `yarn tsc --noEmit`

Run: `yarn prettier --check "app/**/*.{ts,tsx,scss}" "docs/superpowers/**/*.{md}"`

Run: `git diff --check`

Run: `yarn lint`

Run: `yarn build`

Expected: Jest、TypeScript、Prettier、diff check 和 build 通过；lint 只允许仓库既有 warning，不新增 error。

- [ ] **Step 4: Docker 验收探测**

Run: `docker version`

若 Docker CLI 可用，执行 `yarn docker:build` 并用临时数据卷验证保存、模型请求、重启恢复；若不可用，在 changelog 明确记录未执行容器级验证。

- [ ] **Step 5: 生成中文改动说明**

记录功能、数据与加密、兼容性、验证结果、部署要求和未验证项。明确 `public/favicon.png`、`public/logo.png` 是用户原有无关改动，不纳入本功能文件清单。

## 计划自审结果

- Spec 覆盖：注册表、加密、Repository、运行时覆盖、管理员 API/UI、模型列表、审计、错误处理和验证均有对应任务。
- 类型一致性：固定使用 `ProviderId`、`ProviderPatch`、`ProviderRecord`、`RuntimeServerSideConfig` 和 `providerEnabled`。
- 范围一致性：未纳入账号 SQLite 迁移、联网搜索、Cloudflare/WebDAV、连接测试或多实例 provider。
- Git 约束：计划不要求 Agent 执行 Git 写操作。
