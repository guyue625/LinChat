/** @jest-environment node */

import { NextRequest } from "next/server";
import { ModelProvider } from "../constant";

const mockRuntimeConfig = jest.fn();

jest.mock("@/app/lib/provider-config/runtime", () => ({
  getRuntimeServerSideConfig: () => mockRuntimeConfig(),
}));

jest.mock("@/app/lib/account-auth-server", () => ({
  isAccountAuthEnabled: () => false,
  getAccountAuthService: jest.fn(),
}));

import { auth } from "./auth";
import { GET as getConfig } from "./config/route";
import { handle as handleOpenai } from "./openai";
import { handle as handleAi302 } from "./302ai";
import { handle as handleStability } from "./stability";

const enabledProviders = {
  openai: true,
  azure: true,
  google: true,
  anthropic: true,
  baidu: true,
  bytedance: true,
  alibaba: true,
  tencent: true,
  moonshot: true,
  iflytek: true,
  deepseek: true,
  xai: true,
  chatglm: true,
  siliconflow: true,
  "302ai": true,
  stability: true,
};

function runtimeConfig(overrides: Record<string, unknown> = {}) {
  return {
    codes: new Set<string>(),
    needCode: false,
    hideUserApiKey: false,
    disableGPT4: false,
    hideBalanceQuery: true,
    disableFastLink: false,
    customModels: "",
    defaultModel: "",
    visionModels: "",
    providerEnabled: { ...enabledProviders },
    ...overrides,
  };
}

describe("request-time provider config", () => {
  beforeEach(() => {
    mockRuntimeConfig.mockReset();
    global.fetch = jest.fn().mockResolvedValue(new Response("ok"));
  });

  it("rejects a disabled provider even when the user supplies an API key", async () => {
    mockRuntimeConfig.mockResolvedValue(
      runtimeConfig({
        providerEnabled: { ...enabledProviders, openai: false },
      }),
    );
    const request = new NextRequest(
      "http://localhost/api/openai/v1/chat/completions",
      { headers: { Authorization: "Bearer user-key" } },
    );

    await expect(auth(request, ModelProvider.GPT)).resolves.toEqual({
      error: true,
      msg: "provider disabled",
    });
  });

  it("reads fresh runtime model config for every config request", async () => {
    mockRuntimeConfig
      .mockResolvedValueOnce(runtimeConfig({ customModels: "+first@openai" }))
      .mockResolvedValueOnce(runtimeConfig({ customModels: "+second@openai" }));
    const request = new NextRequest("http://localhost/api/config");

    const first = await getConfig(request);
    const second = await getConfig(request);

    await expect(first.json()).resolves.toMatchObject({
      customModels: "+first@openai",
    });
    const secondBody = await second.json();
    expect(secondBody).toMatchObject({
      customModels: "+second@openai",
    });
    expect(mockRuntimeConfig).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(secondBody)).not.toContain("apiKey");
  });

  it("uses one runtime snapshot for authentication and forwarding", async () => {
    mockRuntimeConfig
      .mockResolvedValueOnce(
        runtimeConfig({
          baseUrl: "https://old.example.com",
          apiKey: "old-key",
        }),
      )
      .mockResolvedValueOnce(
        runtimeConfig({
          baseUrl: "https://new.example.com",
          apiKey: "new-key",
        }),
      );
    const request = new NextRequest(
      "http://localhost/api/openai/v1/chat/completions",
      {
        method: "POST",
        body: JSON.stringify({ model: "gpt-4o", messages: [] }),
        headers: { "content-type": "application/json" },
      },
    );

    const response = await handleOpenai(request, {
      params: { path: ["v1", "chat", "completions"] },
    });

    expect(response.status).toBe(200);
    expect(mockRuntimeConfig).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      "https://old.example.com/v1/chat/completions",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer old-key" }),
      }),
    );
  });

  it.each([
    {
      provider: ModelProvider.GPT,
      providerId: "openai",
      url: "http://localhost/api/openai/v1/chat/completions",
      body: { model: "blocked-model" },
    },
    {
      provider: ModelProvider.GeminiPro,
      providerId: "google",
      url: "http://localhost/api/google/v1beta/models/blocked-model:streamGenerateContent",
    },
    {
      provider: ModelProvider.Stability,
      providerId: "stability",
      url: "http://localhost/api/stability/v2beta/stable-image/generate/blocked-model",
    },
    {
      provider: ModelProvider.Hunyuan,
      providerId: "tencent",
      url: "http://localhost/api/tencent",
      body: { Model: "blocked-model" },
    },
  ])(
    "rejects a model hidden for $providerId regardless of request shape",
    async ({ provider, providerId, url, body }) => {
      mockRuntimeConfig.mockResolvedValue(
        runtimeConfig({ customModels: `+allowed-model@${providerId}` }),
      );
      const request = new NextRequest(url, {
        method: "POST",
        headers: {
          Authorization: "Bearer user-key",
          "content-type": "application/json",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });

      await expect(auth(request, provider)).resolves.toEqual({
        error: true,
        msg: "model blocked-model is not available",
        status: 403,
      });
    },
  );

  it("uses the registry model provider id for 302.AI", async () => {
    jest.useFakeTimers();
    mockRuntimeConfig.mockResolvedValue(
      runtimeConfig({
        customModels: "+allowed-model@ai302",
        ai302Url: "https://api.302.example.com",
        ai302ApiKey: "system-key",
      }),
    );
    const request = new NextRequest(
      "http://localhost/api/302ai/v1/chat/completions",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model: "allowed-model" }),
      },
    );

    try {
      const response = await handleAi302(request, {
        params: { path: ["v1", "chat", "completions"] },
      });

      expect(response.status).toBe(200);
    } finally {
      jest.useRealTimers();
    }
  });

  it("does not leave a Stability timeout behind when authorization returns early", async () => {
    jest.useFakeTimers();
    mockRuntimeConfig.mockResolvedValue(
      runtimeConfig({
        customModels: "+allowed-model@stability",
        stabilityApiKey: "system-key",
      }),
    );
    const request = new NextRequest(
      "http://localhost/api/stability/v2beta/stable-image/generate/blocked-model",
      { method: "POST" },
    );
    try {
      const response = await handleStability(request, {
        params: {
          path: ["v2beta", "stable-image", "generate", "blocked-model"],
        },
      });

      expect(response.status).toBe(403);
      expect(jest.getTimerCount()).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });
});
