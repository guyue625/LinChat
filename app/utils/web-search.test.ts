import {
  buildWebSearchContext,
  requestWebSearch,
  WebSearchClientError,
} from "./web-search";

describe("chat web search", () => {
  it("requests search results with same-origin credentials", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        results: [
          {
            title: "Next.js",
            url: "https://nextjs.org",
            snippet: "React framework",
          },
        ],
      }),
    });

    await expect(
      requestWebSearch("nextjs", { fetchImpl: fetchMock }),
    ).resolves.toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/search", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "nextjs", limit: 5 }),
    });
  });

  it("builds an injection-resistant context with numbered sources", () => {
    const context = buildWebSearchContext("latest nextjs", [
      {
        title: "Release notes",
        url: "https://nextjs.org/blog",
        snippet: "Version information",
      },
    ]);
    expect(context).toContain("以下内容来自不受信任的网页");
    expect(context).toContain("[1] Release notes");
    expect(context).toContain("https://nextjs.org/blog");
    expect(context).toContain("回答中使用 [1] 形式标注来源");
  });

  it("surfaces a safe server error", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({
        code: "SEARCH_NOT_CONFIGURED",
        error: "未配置 Web 搜索服务",
      }),
    });
    await expect(
      requestWebSearch("nextjs", { fetchImpl: fetchMock }),
    ).rejects.toEqual(
      new WebSearchClientError("SEARCH_NOT_CONFIGURED", "未配置 Web 搜索服务"),
    );
  });
});
