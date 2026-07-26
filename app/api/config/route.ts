import { NextRequest, NextResponse } from "next/server";

import { getServerSideConfig } from "../../config/server";
import {
  getAccountAuthService,
  isAccountAuthEnabled,
} from "../../lib/account-auth-server";
import { ACCOUNT_SESSION_COOKIE } from "../account/_shared";
import { getVisibleDangerConfig } from "./visibility";

const serverConfig = getServerSideConfig();

// Danger! Do not hard code any secret value here!
// 警告！不要在这里写入任何敏感信息！
const DANGER_CONFIG = {
  needCode: serverConfig.needCode,
  hideUserApiKey: serverConfig.hideUserApiKey,
  disableGPT4: serverConfig.disableGPT4,
  hideBalanceQuery: serverConfig.hideBalanceQuery,
  disableFastLink: serverConfig.disableFastLink,
  customModels: serverConfig.customModels,
  defaultModel: serverConfig.defaultModel,
  visionModels: serverConfig.visionModels,
};

declare global {
  type DangerConfig = typeof DANGER_CONFIG;
}

async function handle(request: NextRequest) {
  let exposeServerModels = !isAccountAuthEnabled();
  if (!exposeServerModels) {
    try {
      const service = await getAccountAuthService();
      const token = request.cookies.get(ACCOUNT_SESSION_COOKIE)?.value ?? "";
      exposeServerModels = Boolean(await service.getUserBySession(token));
    } catch (error) {
      // Fail closed when the account service is unavailable.
      console.error("[Config] account session lookup failed", error);
    }
  }
  return NextResponse.json(
    getVisibleDangerConfig(DANGER_CONFIG, exposeServerModels),
  );
}

export const GET = handle;
export const POST = handle;

export const runtime = "nodejs";
