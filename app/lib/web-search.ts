import type { WebSearchResult } from "../typing";

export type { WebSearchResult } from "../typing";

type SearchProvider = "tavily" | "bocha" | "searxng";
type FetchImpl = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export class WebSearchError extends Error {
  constructor(
    readonly code:
      | "INVALID_QUERY"
      | "SEARCH_NOT_CONFIGURED"
      | "SEARCH_PROVIDER_ERROR",
    message: string,
    readonly status = code === "INVALID_QUERY" ? 400 : 503,
  ) {
    super(message);
    this.name = "WebSearchError";
  }
}

const DEFAULT_RESULT_LIMIT = 5;
const MAX_RESULT_LIMIT = 8;
const MAX_QUERY_LENGTH = 500;
const REQUEST_TIMEOUT_MS = 8_000;

function clampLimit(limit: number | undefined) {
  if (!Number.isFinite(limit)) return DEFAULT_RESULT_LIMIT;
  return Math.min(MAX_RESULT_LIMIT, Math.max(1, Math.floor(limit as number)));
}

function getConfiguredProvider(env: NodeJS.ProcessEnv): {
  provider: SearchProvider;
  apiKey?: string;
  baseUrl?: string;
} {
  const requested = env.WEB_SEARCH_PROVIDER?.trim().toLowerCase();
  const provider = requested as SearchProvider | undefined;
  if (
    requested &&
    requested !== "tavily" &&
    requested !== "bocha" &&
    requested !== "searxng"
  ) {
    throw new WebSearchError(
      "SEARCH_NOT_CONFIGURED",
      "WEB_SEARCH_PROVIDER 配置无效",
    );
  }

  if ((provider === "tavily" || !provider) && env.TAVILY_API_KEY) {
    return { provider: "tavily", apiKey: env.TAVILY_API_KEY };
  }
  if ((provider === "bocha" || !provider) && env.BOCHA_API_KEY) {
    return { provider: "bocha", apiKey: env.BOCHA_API_KEY };
  }
  if ((provider === "searxng" || !provider) && env.SEARXNG_URL) {
    return {
      provider: "searxng",
      baseUrl: env.SEARXNG_URL,
    };
  }

  throw new WebSearchError(
    "SEARCH_NOT_CONFIGURED",
    "未配置可用的 Web 搜索服务",
  );
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeResults(value: unknown, limit: number): WebSearchResult[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const results: WebSearchResult[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const title = stringValue(row.title ?? row.name);
    const url = stringValue(row.url);
    const snippet = stringValue(
      row.snippet ?? row.content ?? row.description ?? row.text,
    );
    if (!title || !snippet || !/^https?:\/\//i.test(url) || seen.has(url)) {
      continue;
    }
    seen.add(url);
    results.push({
      title: title.slice(0, 300),
      url: url.slice(0, 2000),
      snippet: snippet.slice(0, 1200),
    });
    if (results.length >= limit) break;
  }
  return results;
}

async function fetchJson(
  fetchImpl: FetchImpl,
  input: RequestInfo | URL,
  init: RequestInit,
): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetchImpl(input, {
      ...init,
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new WebSearchError(
        "SEARCH_PROVIDER_ERROR",
        `搜索服务返回 HTTP ${response.status}`,
        502,
      );
    }
    return payload;
  } catch (error) {
    if (error instanceof WebSearchError) throw error;
    throw new WebSearchError("SEARCH_PROVIDER_ERROR", "搜索服务请求失败", 502);
  } finally {
    clearTimeout(timeout);
  }
}

async function searchTavily(
  fetchImpl: FetchImpl,
  apiKey: string,
  query: string,
  limit: number,
) {
  const payload = await fetchJson(fetchImpl, "https://api.tavily.com/search", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: "basic",
      max_results: limit,
      include_answer: false,
    }),
  });
  return normalizeResults(
    (payload as { results?: unknown } | null)?.results,
    limit,
  );
}

async function searchBocha(
  fetchImpl: FetchImpl,
  apiKey: string,
  query: string,
  limit: number,
) {
  const payload = await fetchJson(
    fetchImpl,
    "https://api.bochaai.com/v1/web-search",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ query, count: limit, summary: true }),
    },
  );
  const value = payload as {
    results?: unknown;
    data?: { webPages?: { value?: unknown } };
  } | null;
  return normalizeResults(
    value?.results ?? value?.data?.webPages?.value,
    limit,
  );
}

async function searchSearxng(
  fetchImpl: FetchImpl,
  baseUrl: string,
  query: string,
  limit: number,
) {
  let endpoint: URL;
  try {
    endpoint = new URL("search", `${baseUrl.replace(/\/$/, "")}/`);
    if (endpoint.protocol !== "http:" && endpoint.protocol !== "https:") {
      throw new Error("unsupported protocol");
    }
  } catch {
    throw new WebSearchError("SEARCH_NOT_CONFIGURED", "SEARXNG_URL 配置无效");
  }
  endpoint.searchParams.set("q", query);
  endpoint.searchParams.set("format", "json");
  endpoint.searchParams.set("language", "auto");
  endpoint.searchParams.set("safesearch", "1");
  const payload = await fetchJson(fetchImpl, endpoint, {
    method: "GET",
    headers: { accept: "application/json" },
  });
  return normalizeResults(
    (payload as { results?: unknown } | null)?.results,
    limit,
  );
}

export async function searchWeb(
  rawQuery: string,
  options: {
    limit?: number;
    fetchImpl?: FetchImpl;
    env?: NodeJS.ProcessEnv;
  } = {},
): Promise<WebSearchResult[]> {
  const query = rawQuery.trim();
  if (!query || query.length > MAX_QUERY_LENGTH) {
    throw new WebSearchError(
      "INVALID_QUERY",
      `搜索关键词长度必须为 1-${MAX_QUERY_LENGTH} 个字符`,
    );
  }
  const config = getConfiguredProvider(options.env ?? process.env);
  const limit = clampLimit(options.limit);
  const fetchImpl = options.fetchImpl ?? fetch;
  switch (config.provider) {
    case "tavily":
      return searchTavily(fetchImpl, config.apiKey as string, query, limit);
    case "bocha":
      return searchBocha(fetchImpl, config.apiKey as string, query, limit);
    case "searxng":
      return searchSearxng(fetchImpl, config.baseUrl as string, query, limit);
  }
}
