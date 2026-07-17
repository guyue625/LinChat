<div align="center">

<a href='#企业版'>
  <img src="./docs/images/ent.svg" alt="icon"/>
</a>

<h1 align="center">NextChat</h1>

一键免费部署你的私人 ChatGPT 网页应用，支持 Claude, GPT4 & Gemini Pro 模型。

[NextChatAI](https://nextchat.club?utm_source=readme) / [企业版](#%E4%BC%81%E4%B8%9A%E7%89%88) / [演示 Demo](https://chat-gpt-next-web.vercel.app/) / [反馈 Issues](https://github.com/Yidadaa/ChatGPT-Next-Web/issues) / [加入 Discord](https://discord.gg/zrhvHCr79N)

[<img src="https://vercel.com/button" alt="Deploy on Zeabur" height="30">](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FChatGPTNextWeb%2FChatGPT-Next-Web&env=OPENAI_API_KEY&env=CODE&project-name=nextchat&repository-name=NextChat) [<img src="https://zeabur.com/button.svg" alt="Deploy on Zeabur" height="30">](https://zeabur.com/templates/ZBUEFA) [<img src="https://gitpod.io/button/open-in-gitpod.svg" alt="Open in Gitpod" height="30">](https://gitpod.io/#https://github.com/Yidadaa/ChatGPT-Next-Web)

</div>

## Sponsor AI API

<a href='https://302.ai/'>
  <img src="https://github.com/user-attachments/assets/d8c0c513-1e18-4d3b-a2a9-ff3696aec0d4" width="100%" alt="icon"/>
</a>

[302.AI](https://302.ai/) 是一个按需付费的AI应用平台，提供市面上最全的AI API和AI在线应用。

## 企业版

满足您公司私有化部署和定制需求

- **品牌定制**：企业量身定制 VI/UI，与企业品牌形象无缝契合
- **资源集成**：由企业管理人员统一配置和管理数十种 AI 资源，团队成员开箱即用
- **权限管理**：成员权限、资源权限、知识库权限层级分明，企业级 Admin Panel 统一控制
- **知识接入**：企业内部知识库与 AI 能力相结合，比通用 AI 更贴近企业自身业务需求
- **安全审计**：自动拦截敏感提问，支持追溯全部历史对话记录，让 AI 也能遵循企业信息安全规范
- **私有部署**：企业级私有部署，支持各类主流私有云部署，确保数据安全和隐私保护
- **持续更新**：提供多模态、智能体等前沿能力持续更新升级服务，常用常新、持续先进

企业版咨询: **business@nextchat.dev**

<img width="300" src="https://github.com/user-attachments/assets/bb29a11d-ff75-48a8-b1f8-d2d7238cf987">

## 开始使用

1. 准备好你的 [OpenAI API Key](https://platform.openai.com/account/api-keys);
2. 点击右侧按钮开始部署：
   [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FYidadaa%2FChatGPT-Next-Web&env=OPENAI_API_KEY&env=CODE&env=GOOGLE_API_KEY&project-name=chatgpt-next-web&repository-name=ChatGPT-Next-Web)，直接使用 Github 账号登录即可，记得在环境变量页填入 API Key 和[页面访问密码](#配置页面访问密码) CODE；
3. 部署完毕后，即可开始使用；
4. （可选）[绑定自定义域名](https://vercel.com/docs/concepts/projects/domains/add-a-domain)：Vercel 分配的域名 DNS 在某些区域被污染了，绑定自定义域名即可直连。

<div align="center">
   
![主界面](./docs/images/cover.png)

</div>

## 保持更新

如果你按照上述步骤一键部署了自己的项目，可能会发现总是提示“存在更新”的问题，这是由于 Vercel 会默认为你创建一个新项目而不是 fork 本项目，这会导致无法正确地检测更新。
推荐你按照下列步骤重新部署：

- 删除掉原先的仓库；
- 使用页面右上角的 fork 按钮，fork 本项目；
- 在 Vercel 重新选择并部署，[请查看详细教程](./docs/vercel-cn.md#如何新建项目)。

### 打开自动更新

> 如果你遇到了 Upstream Sync 执行错误，请[手动 Sync Fork 一次](./README_CN.md#手动更新代码)！

当你 fork 项目之后，由于 Github 的限制，需要手动去你 fork 后的项目的 Actions 页面启用 Workflows，并启用 Upstream Sync Action，启用之后即可开启每小时定时自动更新：

![自动更新](./docs/images/enable-actions.jpg)

![启用自动更新](./docs/images/enable-actions-sync.jpg)

### 手动更新代码

如果你想让手动立即更新，可以查看 [Github 的文档](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/working-with-forks/syncing-a-fork) 了解如何让 fork 的项目与上游代码同步。

你可以 star/watch 本项目或者 follow 作者来及时获得新功能更新通知。

## 配置页面访问密码

> 配置密码后，用户需要在设置页手动填写访问码才可以正常聊天，否则会通过消息提示未授权状态。

> **警告**：请务必将密码的位数设置得足够长，最好 7 位以上，否则[会被爆破](https://github.com/Yidadaa/ChatGPT-Next-Web/issues/518)。

本项目提供有限的权限控制功能，请在 Vercel 项目控制面板的环境变量页增加名为 `CODE` 的环境变量，值为用英文逗号分隔的自定义密码：

```
code1,code2,code3
```

增加或修改该环境变量后，请**重新部署**项目使改动生效。

## 环境变量

> 本项目大多数配置项都通过环境变量来设置，教程：[如何修改 Vercel 环境变量](./docs/vercel-cn.md)。

### `OPENAI_API_KEY` （必填项）

OpenAI 密钥，你在 openai 账户页面申请的 api key，使用英文逗号隔开多个 key，这样可以随机轮询这些 key。

### `CODE` （可选）

访问密码，可选，可以使用逗号隔开多个密码。

**警告**：如果不填写此项，则任何人都可以直接使用你部署后的网站，可能会导致你的 token 被急速消耗完毕，建议填写此选项。

### `BASE_URL` （可选）

> Default: `https://api.openai.com`

> Examples: `http://your-openai-proxy.com`

OpenAI 接口代理 URL，如果你手动配置了 openai 接口代理，请填写此选项。

> 如果遇到 ssl 证书问题，请将 `BASE_URL` 的协议设置为 http。

### `OPENAI_ORG_ID` （可选）

指定 OpenAI 中的组织 ID。

### `AZURE_URL` （可选）

> 形如：https://{azure-resource-url}/openai

Azure 部署地址。

### `AZURE_API_KEY` （可选）

Azure 密钥。

### `AZURE_API_VERSION` （可选）

Azure Api 版本，你可以在这里找到：[Azure 文档](https://learn.microsoft.com/en-us/azure/ai-services/openai/reference#chat-completions)。

### `GOOGLE_API_KEY` (可选)

Google Gemini Pro 密钥.

### `GOOGLE_URL` (可选)

Google Gemini Pro Api Url.

### `ANTHROPIC_API_KEY` (可选)

anthropic claude Api Key.

### `ANTHROPIC_API_VERSION` (可选)

anthropic claude Api version.

### `ANTHROPIC_URL` (可选)

anthropic claude Api Url.

### `BAIDU_API_KEY` (可选)

Baidu Api Key.

### `BAIDU_SECRET_KEY` (可选)

Baidu Secret Key.

### `BAIDU_URL` (可选)

Baidu Api Url.

### `BYTEDANCE_API_KEY` (可选)

ByteDance Api Key.

### `BYTEDANCE_URL` (可选)

ByteDance Api Url.

### `ALIBABA_API_KEY` (可选)

阿里云（千问）Api Key.

### `ALIBABA_URL` (可选)

阿里云（千问）Api Url.

### `IFLYTEK_URL` (可选)

讯飞星火Api Url.

### `IFLYTEK_API_KEY` (可选)

讯飞星火Api Key.

### `IFLYTEK_API_SECRET` (可选)

讯飞星火Api Secret.

### `CHATGLM_API_KEY` (可选)

ChatGLM Api Key.

### `CHATGLM_URL` (可选)

ChatGLM Api Url.

### `DEEPSEEK_API_KEY` (可选)

DeepSeek Api Key.

### `DEEPSEEK_URL` (可选)

DeepSeek Api Url.

### `HIDE_USER_API_KEY` （可选）

如果你不想让用户自行填入 API Key，将此环境变量设置为 1 即可。

### `DISABLE_GPT4` （可选）

如果你不想让用户使用 GPT-4，将此环境变量设置为 1 即可。

### `ENABLE_BALANCE_QUERY` （可选）

如果你想启用余额查询功能，将此环境变量设置为 1 即可。

### `DISABLE_FAST_LINK` （可选）

如果你想禁用从链接解析预制设置，将此环境变量设置为 1 即可。

### `WHITE_WEBDAV_ENDPOINTS` (可选)

如果你想增加允许访问的webdav服务地址，可以使用该选项，格式要求：

- 每一个地址必须是一个完整的 endpoint
  > `https://xxxx/xxx`
- 多个地址以`,`相连

### `CUSTOM_MODELS` （可选）

> 示例：`+qwen-7b-chat,+glm-6b,-gpt-3.5-turbo,gpt-4-1106-preview=gpt-4-turbo` 表示增加 `qwen-7b-chat` 和 `glm-6b` 到模型列表，而从列表中删除 `gpt-3.5-turbo`，并将 `gpt-4-1106-preview` 模型名字展示为 `gpt-4-turbo`。
> 如果你想先禁用所有模型，再启用指定模型，可以使用 `-all,+gpt-3.5-turbo`，则表示仅启用 `gpt-3.5-turbo`

用来控制模型列表，使用 `+` 增加一个模型，使用 `-` 来隐藏一个模型，使用 `模型名=展示名` 来自定义模型的展示名，用英文逗号隔开。

在Azure的模式下，支持使用`modelName@Azure=deploymentName`的方式配置模型名称和部署名称(deploy-name)

> 示例：`+gpt-3.5-turbo@Azure=gpt35`这个配置会在模型列表显示一个`gpt35(Azure)`的选项。
> 如果你只能使用Azure模式，那么设置 `-all,+gpt-3.5-turbo@Azure=gpt35` 则可以让对话的默认使用 `gpt35(Azure)`

在ByteDance的模式下，支持使用`modelName@bytedance=deploymentName`的方式配置模型名称和部署名称(deploy-name)

> 示例: `+Doubao-lite-4k@bytedance=ep-xxxxx-xxx`这个配置会在模型列表显示一个`Doubao-lite-4k(ByteDance)`的选项

### `DEFAULT_MODEL` （可选）

更改默认模型

### `VISION_MODELS` (可选)

> 默认值：空
> 示例：`gpt-4-vision,claude-3-opus,my-custom-model` 表示为这些模型添加视觉能力，作为对默认模式匹配的补充（默认会检测包含"vision"、"claude-3"、"gemini-1.5"等关键词的模型）。

在默认模式匹配之外，添加更多具有视觉能力的模型。多个模型用逗号分隔。

### `DEFAULT_INPUT_TEMPLATE` （可选）

自定义默认的 template，用于初始化『设置』中的『用户输入预处理』配置项

### `STABILITY_API_KEY` (optional)

Stability API密钥

### `STABILITY_URL` (optional)

自定义的Stability API请求地址

### `ENABLE_MCP` (optional)

启用MCP（Model Context Protocol）功能

### `SILICONFLOW_API_KEY` (optional)

SiliconFlow API Key.

### `SILICONFLOW_URL` (optional)

SiliconFlow API URL.

### `AI302_API_KEY` (optional)

302.AI API Key.

### `AI302_URL` (optional)

302.AI API URL.

## 开发

点击下方按钮，开始二次开发：

[![Open in Gitpod](https://gitpod.io/button/open-in-gitpod.svg)](https://gitpod.io/#https://github.com/Yidadaa/ChatGPT-Next-Web)

在开始写代码之前，需要在项目根目录新建一个 `.env.local` 文件，里面填入环境变量：

```
OPENAI_API_KEY=<your api key here>

# 中国大陆用户，可以使用本项目自带的代理进行开发，你也可以自由选择其他代理地址
BASE_URL=https://b.nextweb.fun/api/proxy
```

### 本地开发

1. 安装 nodejs 18 和 yarn，具体细节请询问 ChatGPT；
2. 执行 `yarn install && yarn dev` 即可。⚠️ 注意：此命令仅用于本地开发，不要用于部署！
3. 如果你想本地部署，请使用 `yarn install && yarn build && yarn start` 命令，你可以配合 pm2 来守护进程，防止被杀死，详情询问 ChatGPT。

## 部署

### 宝塔面板部署

> [简体中文 > 如何通过宝塔一键部署](./docs/bt-cn.md)

### 容器部署 （推荐）

> Docker 版本需要在 20 及其以上，否则会提示找不到镜像。

> ⚠️ 注意：官方预构建镜像在大多数时间都会落后最新的版本 1 到 2 天，所以部署后会持续出现“存在更新”的提示，属于正常现象。

#### 方式一：直接拉取官方镜像

```shell
docker pull yidadaa/chatgpt-next-web

docker run -d -p 3000:3000 \
   -e OPENAI_API_KEY=sk-xxxx \
   -e CODE=页面访问密码 \
   yidadaa/chatgpt-next-web
```

你也可以指定 proxy：

```shell
docker run -d -p 3000:3000 \
   -e OPENAI_API_KEY=sk-xxxx \
   -e CODE=页面访问密码 \
   --net=host \
   -e PROXY_URL=http://127.0.0.1:7890 \
   yidadaa/chatgpt-next-web
```

如需启用 MCP 功能，可以使用：

```shell
docker run -d -p 3000:3000 \
   -e OPENAI_API_KEY=sk-xxxx \
   -e CODE=页面访问密码 \
   -e ENABLE_MCP=true \
   yidadaa/chatgpt-next-web
```

如果你的本地代理需要账号密码，可以使用：

```shell
-e PROXY_URL="http://127.0.0.1:7890 user password"
```

如果你需要指定其他环境变量，请自行在上述命令中增加 `-e 环境变量=环境变量值` 来指定。

#### 方式二：GitHub Actions 自动构建镜像（推荐，本机无 Docker）

适用场景：本机没有 Docker，也不想在服务器上慢慢 `docker build`。  
由 GitHub 云端编译，推送到 **GHCR**（GitHub 自带镜像仓库，**无需注册 Docker Hub**），服务器只负责 `docker pull` + `docker run`。

**流程概览**

```text
本机改代码 → git push → GitHub Actions 自动 build → 推到 ghcr.io
服务器：docker pull → docker run
```

**1. 推送代码并触发构建**

工作流文件：`.github/workflows/docker.yml`。

触发方式：

- 推送到 `main` / `dev` 分支（自动）
- 在 GitHub 网页：`Actions` → `Publish Docker image` → `Run workflow`（手动）
- 发布 Release（自动）

**2. 等待 Actions 成功**

打开：`https://github.com/guyue625/NextChat/actions`  
看到绿色勾即表示镜像已推送。

镜像地址（所有者名会转为小写）：

```text
ghcr.io/guyue625/nextchat:latest   # main 分支
ghcr.io/guyue625/nextchat:dev      # dev 分支
```

**3. 首次：把 GHCR 包设为 Public（否则服务器 pull 要登录）**

1. 打开 GitHub 仓库 → 右侧 **Packages**（或头像 → Settings → Packages）
2. 进入 `nextchat` 这个 package
3. Package settings → Change visibility → **Public**

若保持 Private，服务器需先登录：

```shell
# 在 GitHub → Settings → Developer settings → Personal access tokens 创建 PAT
# 勾选 read:packages
echo YOUR_GITHUB_PAT | docker login ghcr.io -u guyue625 --password-stdin
```

**4. 服务器拉取并运行**

```shell
docker pull ghcr.io/guyue625/nextchat:latest

docker run -d --name nextchat -p 3000:3000 \
  -e OPENAI_API_KEY=sk-xxxx \
  -e CODE=页面访问密码 \
  ghcr.io/guyue625/nextchat:latest
```

**5. 之后更新**

本机：

```shell
git add .
git commit -m "your message"
git push
```

等 Actions 跑完后，服务器：

```shell
docker pull ghcr.io/guyue625/nextchat:latest
docker stop nextchat && docker rm nextchat
docker run -d --name nextchat -p 3000:3000 \
  -e OPENAI_API_KEY=sk-xxxx \
  -e CODE=页面访问密码 \
  ghcr.io/guyue625/nextchat:latest
```

> 说明：构建在 GitHub 的机器上完成，一般比小带宽服务器本地 build 更稳、更快；服务器不再执行 `yarn install` / `yarn build`。

#### 方式三：基于本仓库源码在服务器构建（本机无 Docker 时可选）

适用场景：本机没有 Docker，或需要部署自己改过的代码。流程是 **本机导出源码 → 上传服务器 → 服务器 `docker build`**。

**1. 本机打包源码**

先确保改动已提交到 git（`git archive` 只会打进已提交的文件）：

```shell
git add .
git commit -m "your message"
yarn release:src
```

会在项目根目录生成 `nextchat-src.tar.gz`。

**2. 上传到服务器**

```shell
scp nextchat-src.tar.gz root@你的服务器IP:/root/
```

**3. 服务器解压**

> 重要：`git archive` 打出来的包**没有**顶层目录，文件会直接解压到当前目录。请先进入空目录再解压，并确认目录里有 `Dockerfile`。

```shell
mkdir -p /root/nextchat
cd /root/nextchat
tar -xzf /root/nextchat-src.tar.gz

# 确认 Dockerfile 存在（必须看到这个文件）
ls -la Dockerfile package.json
```

若 `ls` 提示没有 `Dockerfile`，说明当前目录不对或解压路径错了，**不要**继续 `docker build`。

**4. 服务器构建镜像**

```shell
cd /root/nextchat
docker build -t guyue625/nextchat:local .
```

首次构建可能需要数分钟（拉基础镜像、安装依赖、执行 `yarn build`）。

**5. 运行容器**

```shell
docker run -d --name nextchat -p 3000:3000 \
  -e OPENAI_API_KEY=sk-xxxx \
  -e CODE=页面访问密码 \
  guyue625/nextchat:local
```

浏览器访问：`http://服务器IP:3000`。

**6. 更新部署**

本机改代码并提交后重新打包上传，服务器上：

```shell
cd /root/nextchat
rm -rf ./* ./.[!.]* 2>/dev/null || true
tar -xzf /root/nextchat-src.tar.gz
docker build -t guyue625/nextchat:local .
docker stop nextchat && docker rm nextchat
docker run -d --name nextchat -p 3000:3000 \
  -e OPENAI_API_KEY=sk-xxxx \
  -e CODE=页面访问密码 \
  guyue625/nextchat:local
```

**常见问题：`open Dockerfile: no such file or directory`**

表示 Docker 在**当前目录**找不到 `Dockerfile`（日志里 `transferring dockerfile: 2B` 也是同一类问题）。按下面排查：

```shell
# 你在哪个目录？
pwd

# 当前目录有没有 Dockerfile？
ls -la

# 若没有，到解压目录再构建
cd /root/nextchat
ls -la Dockerfile
docker build -t guyue625/nextchat:local .
```

#### 方式四：服务器直接 git 拉取后构建

服务器能访问 GitHub 时，可以跳过 scp 源码包：

```shell
git clone https://github.com/guyue625/NextChat.git
cd NextChat
docker build -t guyue625/nextchat:local .
docker run -d --name nextchat -p 3000:3000 \
  -e OPENAI_API_KEY=sk-xxxx \
  -e CODE=页面访问密码 \
  guyue625/nextchat:local
```

之后更新：

```shell
cd NextChat
git pull
docker build -t guyue625/nextchat:local .
docker stop nextchat && docker rm nextchat
docker run -d --name nextchat -p 3000:3000 \
  -e OPENAI_API_KEY=sk-xxxx \
  -e CODE=页面访问密码 \
  guyue625/nextchat:local
```

### 本地部署

在控制台运行下方命令：

```shell
bash <(curl -s https://raw.githubusercontent.com/Yidadaa/ChatGPT-Next-Web/main/scripts/setup.sh)
```

⚠️ 注意：如果你安装过程中遇到了问题，请使用 docker 部署。

## 鸣谢

### 捐赠者

> 见英文版。

### 贡献者

[见项目贡献者列表](https://github.com/Yidadaa/ChatGPT-Next-Web/graphs/contributors)

### 相关项目

- [one-api](https://github.com/songquanpeng/one-api): 一站式大模型额度管理平台，支持市面上所有主流大语言模型

## 开源协议

[MIT](https://opensource.org/license/mit/)
