import { searchWeb, WebSearchError } from "./web-search";

describe("web search", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.WEB_SEARCH_PROVIDER;
    delete process.env.TAVILY_API_KEY;
    delete process.env.BOCHA_API_KEY;
    delete process.env.SEARXNG_URL;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("uses Tavily and normalizes result fields", async () => {
    process.env.WEB_SEARCH_PROVIDER = "tavily";
    process.env.TAVILY_API_KEY = "test-key";
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        results: [
          {
            title: " Example ",
            url: "https://example.com/article",
            content: "  A useful summary.  ",
          },
          { title: "bad", url: "javascript:alert(1)", content: "x" },
        ],
      }),
    });

    await expect(
      searchWeb("nextjs", { fetchImpl: fetchMock }),
    ).resolves.toEqual([
      {
        title: "Example",
        url: "https://example.com/article",
        snippet: "A useful summary.",
      },
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.tavily.com/search",
      expect.objectContaining({ method: "POST" }),
    );
    const request = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(request.body as string)).toMatchObject({
      api_key: "test-key",
      query: "nextjs",
      max_results: 5,
    });
  });

  it("uses the Bocha name field as the result title", async () => {
    process.env.WEB_SEARCH_PROVIDER = "bocha";
    process.env.BOCHA_API_KEY = "test-key";
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          webPages: {
            value: [
              {
                name: "Bocha result",
                url: "https://example.com/result",
                snippet: "Summary",
              },
            ],
          },
        },
      }),
    });

    await expect(
      searchWeb("nextjs", { fetchImpl: fetchMock }),
    ).resolves.toEqual([
      {
        title: "Bocha result",
        url: "https://example.com/result",
        snippet: "Summary",
      },
    ]);
  });

  it("rejects a blank or oversized query", async () => {
    process.env.WEB_SEARCH_PROVIDER = "tavily";
    process.env.TAVILY_API_KEY = "test-key";
    await expect(searchWeb("   ")).rejects.toMatchObject({
      code: "INVALID_QUERY",
    });
    await expect(searchWeb("x".repeat(501))).rejects.toMatchObject({
      code: "INVALID_QUERY",
    });
  });

  it("fails closed when no provider is configured", async () => {
    await expect(searchWeb("hello")).rejects.toBeInstanceOf(WebSearchError);
    await expect(searchWeb("hello")).rejects.toMatchObject({
      code: "SEARCH_NOT_CONFIGURED",
    });
  });

  it("preserves a SearXNG base path and rejects non-http endpoints", async () => {
    process.env.WEB_SEARCH_PROVIDER = "searxng";
    process.env.SEARXNG_URL = "https://search.example.com/searxng";
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ results: [] }),
    });

    await searchWeb("nextjs", { fetchImpl: fetchMock });

    expect(fetchMock.mock.calls[0][0].toString()).toBe(
      "https://search.example.com/searxng/search?q=nextjs&format=json&language=auto&safesearch=1",
    );

    process.env.SEARXNG_URL = "file:///tmp/searxng";
    await expect(
      searchWeb("nextjs", { fetchImpl: fetchMock }),
    ).rejects.toMatchObject({ code: "SEARCH_NOT_CONFIGURED" });
  });
});
