/** @jest-environment node */

import { NextRequest } from "next/server";
import { AccountAuthError } from "@/app/lib/account-auth";

const mockRepository = {
  list: jest.fn(),
  snapshot: jest.fn(),
  restore: jest.fn(),
  upsert: jest.fn(),
  delete: jest.fn(),
};
const mockService = {
  recordProviderConfigAudit: jest.fn(),
};
const mockRequireAdmin = jest.fn();
const mockRuntimeConfig = jest.fn();

jest.mock("@/app/api/account/admin/_shared", () => ({
  requireAdmin: (...args: unknown[]) => mockRequireAdmin(...args),
}));

jest.mock("@/app/lib/provider-config/server", () => {
  const actual = jest.requireActual("@/app/lib/provider-config/server");
  return {
    ...actual,
    getProviderConfigRepository: async () => mockRepository,
  };
});

jest.mock("@/app/lib/provider-config/runtime", () => {
  const actual = jest.requireActual("@/app/lib/provider-config/runtime");
  return {
    ...actual,
    getRuntimeServerSideConfig: () => mockRuntimeConfig(),
  };
});

import { GET } from "./route";
import { DELETE, PATCH } from "./[id]/route";
import { resetProviderConfigRepositoryForTests } from "@/app/lib/provider-config/server";

function request(method: "GET" | "PATCH" | "DELETE", body?: unknown) {
  return new NextRequest("http://localhost/api/account/admin/providers", {
    method,
    headers: {
      cookie: "nextchat_session=token",
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function openaiRecord() {
  return {
    id: "openai",
    label: "OpenAI DB",
    enabled: true,
    baseUrl: "https://db.example.com",
    hasApiKey: true,
    hasApiSecret: false,
    extra: {
      version: 1,
      options: { organizationId: "org-db" },
      models: [{ name: "gpt-4o" }],
    },
    updatedAt: "2026-08-07T00:00:00.000Z",
  };
}

describe("admin provider routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetProviderConfigRepositoryForTests();
    mockRequireAdmin.mockResolvedValue({
      service: mockService,
      user: { id: "admin-1", role: "admin", disabled: false },
    });
    mockRepository.list.mockReturnValue([openaiRecord()]);
    mockRuntimeConfig.mockResolvedValue({
      providerEnabled: {
        openai: true,
        azure: false,
        google: false,
        anthropic: false,
        baidu: false,
        bytedance: false,
        alibaba: false,
        tencent: false,
        moonshot: false,
        iflytek: false,
        deepseek: false,
        xai: false,
        chatglm: false,
        siliconflow: false,
        "302ai": false,
        stability: false,
      },
      baseUrl: "https://db.example.com",
      apiKey: "sk-secret",
      openaiOrgId: "org-db",
      customModels: "+gpt-4o@openai",
    });
  });

  it("requires an administrator", async () => {
    mockRequireAdmin.mockRejectedValue(
      new AccountAuthError("UNAUTHORIZED", "请先登录", 401),
    );
    const response = await GET(request("GET"));
    expect(response.status).toBe(401);
  });

  it("lists every provider with capabilities and no secret values", async () => {
    const response = await GET(request("GET"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(data.providers).toHaveLength(16);
    expect(data.providers[0]).toMatchObject({
      id: "openai",
      label: "OpenAI DB",
      configured: true,
      enabled: true,
      baseUrl: "https://db.example.com",
      overrides: {
        baseUrl: "https://db.example.com",
        options: { organizationId: "org-db" },
      },
      apiKeySource: "database",
      hasApiKey: true,
      models: [{ name: "gpt-4o" }],
    });
    expect(data.providers[0].capabilities).toMatchObject({
      supportsApiKey: true,
      supportsApiSecret: false,
    });
    expect(JSON.stringify(data)).not.toContain("sk-secret");
  });

  it("reports stored secret presence even when a provider is disabled", async () => {
    mockRepository.list.mockReturnValue([
      { ...openaiRecord(), enabled: false, hasApiKey: true },
    ]);
    mockRuntimeConfig.mockResolvedValue({
      providerEnabled: { openai: false },
      customModels: "",
    });

    const response = await GET(request("GET"));
    const data = await response.json();

    expect(data.providers[0]).toMatchObject({
      enabled: false,
      hasApiKey: true,
      apiKeySource: "database",
    });
  });

  it("updates a provider and audits only changed field names", async () => {
    mockRepository.upsert.mockReturnValue(openaiRecord());
    const response = await PATCH(
      request("PATCH", {
        enabled: true,
        apiKey: "new-secret",
        models: [{ name: "gpt-4o" }],
      }),
      { params: { id: "openai" } },
    );

    expect(response.status).toBe(200);
    expect(mockRepository.upsert).toHaveBeenCalledWith("openai", {
      enabled: true,
      apiKey: "new-secret",
      models: [{ name: "gpt-4o" }],
    });
    expect(mockService.recordProviderConfigAudit).toHaveBeenCalledWith(
      "admin-1",
      "PROVIDER_CONFIG_UPDATED",
      {
        providerId: "openai",
        changedFields: "apiKey,enabled,models",
        enabled: true,
      },
    );
    expect(JSON.stringify(await response.json())).not.toContain("new-secret");
  });

  it("serializes provider mutations through audit completion", async () => {
    let releaseFirstAudit!: () => void;
    let markFirstAuditStarted!: () => void;
    const firstAuditStarted = new Promise<void>((resolve) => {
      markFirstAuditStarted = resolve;
    });
    const firstAudit = new Promise<void>((resolve) => {
      releaseFirstAudit = resolve;
    });
    mockRepository.upsert.mockImplementation(
      (_id: string, patch: { label?: string }) => ({
        ...openaiRecord(),
        label: patch.label,
      }),
    );
    mockService.recordProviderConfigAudit
      .mockImplementationOnce(() => {
        markFirstAuditStarted();
        return firstAudit;
      })
      .mockResolvedValueOnce(undefined);

    const firstResponse = PATCH(request("PATCH", { label: "First" }), {
      params: { id: "openai" },
    });
    await firstAuditStarted;
    const secondResponse = PATCH(request("PATCH", { label: "Second" }), {
      params: { id: "openai" },
    });
    await new Promise<void>((resolve) => setImmediate(resolve));

    expect(mockRepository.snapshot).toHaveBeenCalledTimes(1);
    expect(mockRepository.upsert).toHaveBeenCalledTimes(1);

    releaseFirstAudit();
    const responses = await Promise.all([firstResponse, secondResponse]);

    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    expect(mockRepository.upsert.mock.calls).toEqual([
      ["openai", { label: "First" }],
      ["openai", { label: "Second" }],
    ]);
  });

  it("rejects invalid patches without writing", async () => {
    const response = await PATCH(
      request("PATCH", { baseUrl: "file:///tmp/key" }),
      { params: { id: "openai" } },
    );
    expect(response.status).toBe(400);
    expect(mockRepository.upsert).not.toHaveBeenCalled();
  });

  it("deletes a database override and records an audit event", async () => {
    mockRepository.delete.mockReturnValue(true);
    const response = await DELETE(request("DELETE"), {
      params: { id: "openai" },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(mockRepository.delete).toHaveBeenCalledWith("openai");
    expect(mockService.recordProviderConfigAudit).toHaveBeenCalledWith(
      "admin-1",
      "PROVIDER_CONFIG_DELETED",
      { providerId: "openai", changedFields: "override" },
    );
  });

  it("restores the previous provider state when update auditing fails", async () => {
    const snapshot = { id: "openai", row: { encrypted: true } };
    mockRepository.snapshot.mockReturnValue(snapshot);
    mockRepository.upsert.mockReturnValue(openaiRecord());
    mockService.recordProviderConfigAudit.mockRejectedValueOnce(
      new Error("audit write failed"),
    );

    const response = await PATCH(request("PATCH", { label: "After" }), {
      params: { id: "openai" },
    });

    expect(response.status).toBe(500);
    expect(mockRepository.restore).toHaveBeenCalledWith(snapshot);
  });

  it("restores the deleted provider when delete auditing fails", async () => {
    const snapshot = { id: "openai", row: { encrypted: true } };
    mockRepository.snapshot.mockReturnValue(snapshot);
    mockRepository.delete.mockReturnValue(true);
    mockService.recordProviderConfigAudit.mockRejectedValueOnce(
      new Error("audit write failed"),
    );

    const response = await DELETE(request("DELETE"), {
      params: { id: "openai" },
    });

    expect(response.status).toBe(500);
    expect(mockRepository.restore).toHaveBeenCalledWith(snapshot);
  });
});
