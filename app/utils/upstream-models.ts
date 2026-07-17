import { ServiceProvider } from "../constant";

export interface UpstreamModelSource {
  baseUrl: string;
  apiKey: string;
  provider: ServiceProvider;
  apiVersion?: string;
}

export interface UpstreamModel {
  name: string;
  alias?: string;
}

function appendPath(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

export function getUpstreamModelsUrl(source: UpstreamModelSource): string {
  const baseUrl = source.baseUrl.trim().replace(/\/+$/, "");
  if (!baseUrl) throw new Error("Missing upstream endpoint");
  if (/\/models(?:\?|$)/i.test(baseUrl)) return baseUrl;

  if (source.provider === ServiceProvider.Google) {
    const version = source.apiVersion?.trim() || "v1beta";
    if (new RegExp(`/${version}$`, "i").test(baseUrl)) {
      return appendPath(baseUrl, "models");
    }
    return appendPath(baseUrl, `${version}/models`);
  }

  if (
    source.provider === ServiceProvider.ChatGLM &&
    !/\/api\/paas\/v4$/i.test(baseUrl)
  ) {
    return appendPath(baseUrl, "api/paas/v4/models");
  }

  if (/\/v(?:1|1beta|4)$/i.test(baseUrl)) {
    return appendPath(baseUrl, "models");
  }

  return appendPath(baseUrl, "v1/models");
}

export function getUpstreamModelsHeaders(
  source: UpstreamModelSource,
): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  const apiKey = source.apiKey.trim();
  if (!apiKey) return headers;

  if (source.provider === ServiceProvider.Anthropic) {
    headers["x-api-key"] = apiKey;
    headers["anthropic-version"] = source.apiVersion || "2023-06-01";
  } else if (source.provider === ServiceProvider.Google) {
    headers["x-goog-api-key"] = apiKey;
  } else if (source.provider === ServiceProvider.Azure) {
    headers["api-key"] = apiKey;
  } else {
    headers.Authorization = apiKey.toLowerCase().startsWith("bearer ")
      ? apiKey
      : `Bearer ${apiKey}`;
  }

  return headers;
}

function readModel(item: unknown): UpstreamModel | undefined {
  if (typeof item === "string") {
    return { name: item.replace(/^models\//, "") };
  }
  if (!item || typeof item !== "object") return;

  const value = item as Record<string, unknown>;
  const rawName = value.id ?? value.name ?? value.model;
  if (typeof rawName !== "string" || !rawName.trim()) return;

  const rawAlias = value.displayName ?? value.display_name;
  const name = rawName.trim().replace(/^models\//, "");
  const alias = typeof rawAlias === "string" ? rawAlias.trim() : "";
  return { name, ...(alias && alias !== name ? { alias } : {}) };
}

export function parseUpstreamModels(payload: unknown): UpstreamModel[] {
  let items: unknown[] = [];
  if (Array.isArray(payload)) {
    items = payload;
  } else if (payload && typeof payload === "object") {
    const value = payload as Record<string, unknown>;
    if (Array.isArray(value.data)) items = value.data;
    else if (Array.isArray(value.models)) items = value.models;
  }

  const seen = new Set<string>();
  return items.flatMap((item) => {
    const model = readModel(item);
    if (!model || seen.has(model.name)) return [];
    seen.add(model.name);
    return [model];
  });
}

export async function fetchUpstreamModels(
  source: UpstreamModelSource,
  fetcher: typeof fetch = fetch,
): Promise<UpstreamModel[]> {
  const response = await fetcher(getUpstreamModelsUrl(source), {
    method: "GET",
    headers: getUpstreamModelsHeaders(source),
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    throw new Error(
      `${response.status} ${response.statusText}${detail ? `: ${detail}` : ""}`,
    );
  }

  return parseUpstreamModels(await response.json());
}
