import { NextRequest } from "next/server";
import md5 from "spark-md5";
import { ACCESS_CODE_PREFIX, ModelProvider } from "../constant";
import {
  getAccountAuthService,
  isAccountAuthEnabled,
} from "../lib/account-auth-server";
import { shouldRejectAccountRequest } from "./account-access";
import {
  getRuntimeServerSideConfig,
  type RuntimeServerSideConfig,
} from "../lib/provider-config/runtime";
import type { ProviderId } from "../lib/provider-config/types";
import { getProviderDefinition } from "../lib/provider-config/registry";
import { isModelNotavailableInServer } from "../utils/model";

type AuthResult =
  | { error: true; msg: string; status?: number }
  | { error: false };

function getIP(req: NextRequest) {
  let ip = req.ip ?? req.headers.get("x-real-ip");
  const forwardedFor = req.headers.get("x-forwarded-for");

  if (!ip && forwardedFor) {
    ip = forwardedFor.split(",").at(0) ?? "";
  }

  return ip;
}

function parseApiKey(bearToken: string) {
  const token = bearToken.trim().replaceAll("Bearer ", "").trim();
  const isApiKey = !token.startsWith(ACCESS_CODE_PREFIX);

  return {
    accessCode: isApiKey ? "" : token.slice(ACCESS_CODE_PREFIX.length),
    apiKey: isApiKey ? token : "",
  };
}

export async function auth(
  req: NextRequest,
  modelProvider: ModelProvider,
  runtimeConfig?: RuntimeServerSideConfig,
): Promise<AuthResult> {
  const authToken = req.headers.get("Authorization") ?? "";

  // check if it is openai api key or user token
  const { accessCode, apiKey } = parseApiKey(authToken);

  const hashedCode = md5.hash(accessCode ?? "").trim();

  const serverConfig = runtimeConfig ?? (await getRuntimeServerSideConfig());
  const providerId = getProviderId(req, modelProvider);
  if (!serverConfig.providerEnabled[providerId]) {
    return { error: true, msg: "provider disabled" };
  }
  const requestedModel = await getRequestedModel(req, providerId);
  const definition = getProviderDefinition(providerId);
  if (
    requestedModel &&
    serverConfig.customModels &&
    definition &&
    isModelNotavailableInServer(
      serverConfig.customModels,
      requestedModel,
      providerId === "bytedance"
        ? definition.providerName
        : definition.modelProviderId,
    )
  ) {
    return {
      error: true,
      msg: `model ${requestedModel} is not available`,
      status: 403,
    };
  }
  const hasValidLegacyCode = serverConfig.codes.has(hashedCode);
  const accountAuthEnabled = isAccountAuthEnabled();
  const accountUser = accountAuthEnabled
    ? await (
        await getAccountAuthService()
      ).getUserBySession(req.cookies.get("nextchat_session")?.value ?? "")
    : null;
  console.log("[Auth] allowed hashed codes: ", [...serverConfig.codes]);
  console.log("[Auth] got access code:", accessCode);
  console.log("[Auth] hashed access code:", hashedCode);
  console.log("[User IP] ", getIP(req));
  console.log("[Time] ", new Date().toLocaleString());

  if (
    shouldRejectAccountRequest({
      accountAuthEnabled,
      hasAccountUser: Boolean(accountUser),
      needLegacyCode: serverConfig.needCode,
      hasValidLegacyCode,
      hasApiKey: Boolean(apiKey),
    })
  ) {
    return {
      error: true,
      msg: accountAuthEnabled
        ? "account session required"
        : !accessCode
        ? "empty access code"
        : "wrong access code",
    };
  }

  if (serverConfig.hideUserApiKey && !!apiKey) {
    return {
      error: true,
      msg: "you are not allowed to access with your own api key",
    };
  }

  // if user does not provide an api key, inject system api key
  if (!apiKey) {
    // const systemApiKey =
    //   modelProvider === ModelProvider.GeminiPro
    //     ? serverConfig.googleApiKey
    //     : serverConfig.isAzure
    //     ? serverConfig.azureApiKey
    //     : serverConfig.apiKey;

    let systemApiKey: string | undefined;

    switch (modelProvider) {
      case ModelProvider.Stability:
        systemApiKey = serverConfig.stabilityApiKey;
        break;
      case ModelProvider.GeminiPro:
        systemApiKey = serverConfig.googleApiKey;
        break;
      case ModelProvider.Claude:
        systemApiKey = serverConfig.anthropicApiKey;
        break;
      case ModelProvider.Doubao:
        systemApiKey = serverConfig.bytedanceApiKey;
        break;
      case ModelProvider.Ernie:
        systemApiKey = serverConfig.baiduApiKey;
        break;
      case ModelProvider.Qwen:
        systemApiKey = serverConfig.alibabaApiKey;
        break;
      case ModelProvider.Moonshot:
        systemApiKey = serverConfig.moonshotApiKey;
        break;
      case ModelProvider.Iflytek:
        systemApiKey =
          serverConfig.iflytekApiKey + ":" + serverConfig.iflytekApiSecret;
        break;
      case ModelProvider.DeepSeek:
        systemApiKey = serverConfig.deepseekApiKey;
        break;
      case ModelProvider.XAI:
        systemApiKey = serverConfig.xaiApiKey;
        break;
      case ModelProvider.ChatGLM:
        systemApiKey = serverConfig.chatglmApiKey;
        break;
      case ModelProvider.SiliconFlow:
        systemApiKey = serverConfig.siliconFlowApiKey;
        break;
      case ModelProvider["302.AI"]:
        systemApiKey = serverConfig.ai302ApiKey;
        break;
      case ModelProvider.GPT:
      default:
        if (req.nextUrl.pathname.includes("azure/deployments")) {
          systemApiKey = serverConfig.azureApiKey;
        } else {
          systemApiKey = serverConfig.apiKey;
        }
    }

    if (systemApiKey) {
      console.log("[Auth] use system api key");
      req.headers.set("Authorization", `Bearer ${systemApiKey}`);
    } else {
      console.log("[Auth] admin did not provide an api key");
    }
  } else {
    console.log("[Auth] use user api key");
  }

  return {
    error: false,
  };
}

async function getRequestedModel(req: NextRequest, providerId: ProviderId) {
  const pathname = decodeURIComponent(req.nextUrl.pathname);
  if (providerId === "google") {
    return pathname.match(/\/models\/([^/:]+)/)?.[1];
  }
  if (providerId === "stability") {
    return pathname.match(/\/generate\/([^/?]+)/)?.[1];
  }
  if (!req.body || req.method === "GET" || req.method === "HEAD") {
    return undefined;
  }
  try {
    const payload = (await req.clone().json()) as {
      model?: unknown;
      Model?: unknown;
    };
    const model = payload.model ?? payload.Model;
    return typeof model === "string" && model ? model : undefined;
  } catch {
    return undefined;
  }
}

function getProviderId(
  req: NextRequest,
  modelProvider: ModelProvider,
): ProviderId {
  switch (modelProvider) {
    case ModelProvider.Stability:
      return "stability";
    case ModelProvider.GeminiPro:
      return "google";
    case ModelProvider.Claude:
      return "anthropic";
    case ModelProvider.Ernie:
      return "baidu";
    case ModelProvider.Doubao:
      return "bytedance";
    case ModelProvider.Qwen:
      return "alibaba";
    case ModelProvider.Hunyuan:
      return "tencent";
    case ModelProvider.Moonshot:
      return "moonshot";
    case ModelProvider.Iflytek:
      return "iflytek";
    case ModelProvider.DeepSeek:
      return "deepseek";
    case ModelProvider.XAI:
      return "xai";
    case ModelProvider.ChatGLM:
      return "chatglm";
    case ModelProvider.SiliconFlow:
      return "siliconflow";
    case ModelProvider["302.AI"]:
      return "302ai";
    case ModelProvider.GPT:
    default:
      return req.nextUrl.pathname.includes("azure/deployments")
        ? "azure"
        : "openai";
  }
}
