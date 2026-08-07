import { NextRequest, NextResponse } from "next/server";
import md5 from "spark-md5";
import { ACCESS_CODE_PREFIX } from "@/app/constant";
import {
  getAccountAuthService,
  isAccountAuthEnabled,
} from "@/app/lib/account-auth-server";
import { WebSearchError, searchWeb } from "@/app/lib/web-search";
import { getRuntimeServerSideConfig } from "@/app/lib/provider-config/runtime";
import { ACCOUNT_SESSION_COOKIE } from "../account/_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_QUERY_LENGTH = 500;
const MAX_RESULT_LIMIT = 8;

function response(body: Record<string, unknown>, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { "cache-control": "private, no-store" },
  });
}

async function authorizeSearchRequest(request: NextRequest) {
  if (!isAccountAuthEnabled()) {
    const serverConfig = await getRuntimeServerSideConfig();
    if (!serverConfig.needCode) return true;
    const authorization = request.headers.get("authorization") ?? "";
    const token = authorization.replace(/^Bearer\s+/i, "").trim();
    if (!token.startsWith(ACCESS_CODE_PREFIX)) return false;
    const accessCode = token.slice(ACCESS_CODE_PREFIX.length);
    return serverConfig.codes.has(md5.hash(accessCode));
  }
  try {
    const service = await getAccountAuthService();
    return Boolean(
      await service.getUserBySession(
        request.cookies.get(ACCOUNT_SESSION_COOKIE)?.value ?? "",
      ),
    );
  } catch (error) {
    console.error("[Search] account session lookup failed", error);
    throw new WebSearchError(
      "SEARCH_PROVIDER_ERROR",
      "账号服务暂时不可用",
      503,
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!(await authorizeSearchRequest(request))) {
      return response(
        { code: "ACCOUNT_SESSION_REQUIRED", error: "请先登录" },
        401,
      );
    }

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return response({ code: "INVALID_JSON", error: "请求格式无效" }, 400);
    }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return response({ code: "INVALID_QUERY", error: "搜索请求无效" }, 400);
    }
    const body = payload as { query?: unknown; limit?: unknown };
    const query = typeof body.query === "string" ? body.query.trim() : "";
    const limit = body.limit === undefined ? undefined : Number(body.limit);
    if (
      !query ||
      query.length > MAX_QUERY_LENGTH ||
      (limit !== undefined &&
        (!Number.isInteger(limit) || limit < 1 || limit > MAX_RESULT_LIMIT))
    ) {
      return response(
        {
          code: "INVALID_QUERY",
          error: `搜索关键词长度须为 1-${MAX_QUERY_LENGTH} 个字符，结果数须为 1-${MAX_RESULT_LIMIT}`,
        },
        400,
      );
    }

    const results = await searchWeb(query, { limit });
    return response({ results });
  } catch (error) {
    if (error instanceof WebSearchError) {
      const message =
        error.code === "SEARCH_NOT_CONFIGURED"
          ? "未配置 Web 搜索服务"
          : error.code === "INVALID_QUERY"
          ? error.message
          : "搜索服务暂时不可用";
      return response({ code: error.code, error: message }, error.status);
    }
    console.error("[Search] request failed", error);
    return response(
      { code: "SEARCH_PROVIDER_ERROR", error: "搜索服务暂时不可用" },
      503,
    );
  }
}
