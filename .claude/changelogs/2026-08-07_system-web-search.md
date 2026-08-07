# 系统级联网搜索

**日期**：2026-08-07  
**概述**：为聊天和首页输入框增加系统级“联网搜索”开关。发送消息前由服务端调用已配置的搜索后端，把结果作为本次请求的临时上下文注入模型，并在助手回答下方展示可点击来源。搜索结果不会以隐藏 system 消息写入聊天正文。

---

## 变更文件

| 文件路径                                                       | 操作 | 说明                                                           |
| -------------------------------------------------------------- | ---- | -------------------------------------------------------------- |
| `app/lib/web-search.ts`                                        | 新增 | Tavily、博查、SearXNG 后端适配、结果归一化、超时和安全错误映射 |
| `app/api/search/route.ts`                                      | 新增 | `POST /api/search`，账号会话/访问码鉴权与输入校验              |
| `app/utils/web-search.ts`                                      | 新增 | 浏览器请求封装和抗提示词注入的上下文构造                       |
| `app/components/chat/web-search.tsx`                           | 新增 | 联网开关和来源链接组件                                         |
| `app/components/chat/web-search-flow.test.ts`                  | 新增 | 首页跳转、重复发送和重发失败恢复回归测试                       |
| `app/typing.ts`、`app/store/chat/session.ts`                   | 修改 | 增加搜索结果、会话开关和助手消息来源字段                       |
| `app/store/chat.ts`                                            | 修改 | 发送前搜索、临时上下文注入、访问码转发和结果保存               |
| `app/components/chat.tsx`、`app/components/workspace-home.tsx` | 修改 | 接入开关；搜索失败保留输入；主页等待搜索成功后再导航           |
| `app/components/chat/composer*.tsx`、`message-row.tsx`         | 修改 | 工具栏开关、发送禁用状态和来源渲染                             |
| `app/components/chat.module.scss`                              | 修改 | 来源列表样式                                                   |
| `app/locales/cn.ts`、`app/locales/en.ts`                       | 修改 | 中英文联网搜索文案                                             |
| `.env.template`、`Dockerfile`                                  | 修改 | 增加搜索后端环境变量                                           |

---

## 功能细节

### 搜索后端

通过环境变量选择后端：

```dotenv
WEB_SEARCH_PROVIDER=tavily|bocha|searxng
TAVILY_API_KEY=
BOCHA_API_KEY=
SEARXNG_URL=
```

未指定 `WEB_SEARCH_PROVIDER` 时，按 Tavily、博查、SearXNG 的顺序选择第一个已配置的后端。查询限制为 1–500 个字符，结果数限制为 1–8 条，默认 5 条；上游请求 8 秒超时，只接受 HTTP(S) 来源 URL，并对标题、摘要和链接长度做截断。

### 请求与安全

- 开启账号体系时，搜索接口必须携带 `nextchat_session` 会话。
- 未开启账号体系但配置了访问码时，必须携带 `Authorization: Bearer nk-<访问码>`。
- 搜索接口使用 `private, no-store`，不缓存包含查询内容的结果。
- 上游错误不会把 API Key 或内部异常返回给浏览器。
- 搜索结果被明确标记为不可信网页内容，模型被要求忽略其中改变角色、泄露信息或执行操作的指令，并用 `[1]` 形式标注来源。

### 聊天行为

每个会话独立保存联网开关，旧会话缺失字段时默认关闭。搜索上下文只存在于当前模型请求，不显示为聊天消息；来源元数据保存在助手消息上，用于回答下方的来源链接展示。搜索失败时不会清空用户输入；主页会等预检成功后才跳转到聊天页，重发失败会恢复被替换的原消息。

## API 变化

新增接口：

```text
POST /api/search
请求：{ "query": string, "limit"?: number }
成功：{ "results": [{ "title", "url", "snippet" }] }
```

该接口是内部系统接口，不是可插拔前端插件；后续增删搜索引擎只需在 `app/lib/web-search.ts` 增加适配器并更新 provider 选择逻辑。

## 注意事项

- 需要至少配置一个搜索后端；未配置时接口返回 `SEARCH_NOT_CONFIGURED`，界面会提示搜索暂不可用。
- Tavily/博查会产生第三方 API 用量；SearXNG 需要自行维护实例。
- 本机没有 Docker CLI，未执行 Docker 镜像构建和容器级验收。
- `public/favicon.png`、`public/logo.png` 不属于联网搜索功能；本次搜索实现没有以功能代码修改它们。

## 验证结果

- 定向搜索测试：5 suites / 17 tests passed
- 全量 Jest：34 suites / 193 tests passed
- `yarn tsc --noEmit`：通过
- 相关变更文件 Prettier：通过
- `yarn lint`：通过，只有既有 warning
- `yarn build`：通过，只有既有可选依赖、Lint 和 Node SQLite 警告
- `git diff --check`：通过

## 下一次会话开场白

```text
请先阅读这份改动记录：@.claude/changelogs/2026-08-07_system-web-search.md

系统级联网搜索已经完成实现和本地验证。现在请继续做真实环境验收：先配置一个搜索后端，启动 NextChat，验证联网开关、搜索失败时输入保留、回答来源链接和账号/访问码鉴权；不要修改 public/favicon.png 或 public/logo.png，也不要执行 Git 写操作。
```
