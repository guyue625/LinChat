/** @jest-environment node */

import { NextRequest } from "next/server";
import { WebSearchError } from "@/app/lib/web-search";
import md5 from "spark-md5";

let mockUser: { id: string } | null = { id: "user-1" };
let mockAccountAuthEnabled = true;
const mockSearchWeb = jest.fn();
const mockRuntimeConfig = jest.fn();

jest.mock("@/app/lib/account-auth-server", () => ({
  isAccountAuthEnabled: () => mockAccountAuthEnabled,
  getAccountAuthService: async () => ({
    getUserBySession: async () => mockUser,
  }),
}));

jest.mock("@/app/lib/provider-config/runtime", () => ({
  getRuntimeServerSideConfig: () => mockRuntimeConfig(),
}));

jest.mock("@/app/lib/web-search", () => ({
  WebSearchError: class WebSearchError extends Error {
    constructor(
      public readonly code: string,
      message: string,
      public readonly status = 503,
    ) {
      super(message);
    }
  },
  searchWeb: (...args: unknown[]) => mockSearchWeb(...args),
}));

import { POST } from "./route";

function request(
  body: unknown,
  cookie = "nextchat_session=token",
  authorization?: string,
) {
  return new NextRequest("http://localhost/api/search", {
    method: "POST",
    headers: {
      cookie,
      "content-type": "application/json",
      ...(authorization ? { authorization } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe("/api/search", () => {
  beforeEach(() => {
    mockAccountAuthEnabled = true;
    mockUser = { id: "user-1" };
    mockSearchWeb.mockReset();
    mockRuntimeConfig.mockReset();
  });

  it("requires the configured access code when account auth is disabled", async () => {
    mockAccountAuthEnabled = false;
    mockRuntimeConfig.mockResolvedValue({
      needCode: true,
      codes: new Set([md5.hash("secret")]),
    });
    const denied = await POST(
      request({ query: "nextjs" }, "", "Bearer nk-wrong"),
    );
    expect(denied.status).toBe(401);
    expect(mockSearchWeb).not.toHaveBeenCalled();

    mockSearchWeb.mockResolvedValue([]);
    const allowed = await POST(
      request({ query: "nextjs" }, "", "Bearer nk-secret"),
    );
    expect(allowed.status).toBe(200);
  });

  it("requires an account session when account auth is enabled", async () => {
    mockUser = null;
    const response = await POST(request({ query: "nextjs" }));
    expect(response.status).toBe(401);
    expect(mockSearchWeb).not.toHaveBeenCalled();
  });

  it("validates query and limit before searching", async () => {
    const response = await POST(request({ query: "", limit: 99 }));
    expect(response.status).toBe(400);
    expect(mockSearchWeb).not.toHaveBeenCalled();
  });

  it("returns normalized results without caching", async () => {
    mockSearchWeb.mockResolvedValue([
      {
        title: "Next.js",
        url: "https://nextjs.org",
        snippet: "React framework",
      },
    ]);
    const response = await POST(request({ query: "nextjs", limit: 3 }));
    expect(mockSearchWeb).toHaveBeenCalledWith("nextjs", { limit: 3 });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    await expect(response.json()).resolves.toEqual({
      results: [
        {
          title: "Next.js",
          url: "https://nextjs.org",
          snippet: "React framework",
        },
      ],
    });
  });

  it("maps search provider failures to a safe response", async () => {
    mockSearchWeb.mockRejectedValue(
      new WebSearchError("SEARCH_PROVIDER_ERROR", "upstream failed", 502),
    );
    const response = await POST(request({ query: "nextjs" }));
    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      code: "SEARCH_PROVIDER_ERROR",
      error: "搜索服务暂时不可用",
    });
  });
});
