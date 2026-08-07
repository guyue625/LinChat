import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AdminProviders } from "./admin-providers";

const provider = {
  id: "openai",
  providerName: "OpenAI",
  label: "OpenAI 主线路",
  configured: true,
  enabled: true,
  baseUrl: "https://api.example.com",
  hasApiKey: true,
  hasApiSecret: false,
  apiKeySource: "database",
  apiSecretSource: "none",
  options: { organizationId: "org-1" },
  overrides: {
    baseUrl: "https://api.example.com",
    options: { organizationId: "org-1" },
  },
  models: [{ name: "gpt-4o", alias: "GPT 4o" }],
  updatedAt: "2026-08-07T00:00:00.000Z",
  capabilities: {
    supportsApiKey: true,
    supportsApiSecret: false,
    apiKeyLabel: "API Key",
    apiSecretLabel: null,
    options: [{ key: "organizationId", label: "Organization ID" }],
  },
};

function response(body: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response);
}

describe("AdminProviders", () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock;
  });

  it("renders provider source and secret status without revealing a key", async () => {
    fetchMock.mockReturnValue(response({ providers: [provider] }));
    render(
      <MemoryRouter>
        <AdminProviders />
      </MemoryRouter>,
    );

    expect(await screen.findByText("OpenAI 主线路")).toBeInTheDocument();
    expect(screen.getByText("数据库覆盖")).toBeInTheDocument();
    expect(screen.getByText("API Key 已设置")).toBeInTheDocument();
    expect(screen.queryByText(/sk-/)).not.toBeInTheDocument();
  });

  it("keeps an existing key when the secret input is left empty", async () => {
    fetchMock
      .mockReturnValueOnce(response({ providers: [provider] }))
      .mockReturnValueOnce(response({ provider }))
      .mockReturnValueOnce(response({ providers: [provider] }));
    render(
      <MemoryRouter>
        <AdminProviders />
      </MemoryRouter>,
    );

    fireEvent.click(
      await screen.findByRole("button", { name: "编辑 OpenAI 主线路" }),
    );
    expect(screen.getByLabelText("API Key")).toHaveValue("");
    fireEvent.click(screen.getByRole("button", { name: "保存配置" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    const patchCall = fetchMock.mock.calls[1];
    expect(patchCall[0]).toBe("/api/account/admin/providers/openai");
    const body = JSON.parse(patchCall[1].body as string);
    expect(body).not.toHaveProperty("apiKey");
    expect(body.models).toEqual([{ name: "gpt-4o", alias: "GPT 4o" }]);
  });

  it("does not persist inherited environment values when saving another field", async () => {
    const inheritedProvider = {
      ...provider,
      baseUrl: "https://environment.example.com",
      options: { organizationId: "org-environment" },
      overrides: { baseUrl: null, options: {} },
    };
    fetchMock
      .mockReturnValueOnce(response({ providers: [inheritedProvider] }))
      .mockReturnValueOnce(response({ provider: inheritedProvider }))
      .mockReturnValueOnce(response({ providers: [inheritedProvider] }));
    render(
      <MemoryRouter>
        <AdminProviders />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("button", { name: /编辑/ }));
    fireEvent.change(screen.getByLabelText("显示名称"), {
      target: { value: "OpenAI 新名称" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存配置" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    const body = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    expect(body.baseUrl).toBeNull();
    expect(body.options).toEqual({});
    expect(JSON.stringify(body)).not.toContain("environment.example.com");
    expect(JSON.stringify(body)).not.toContain("org-environment");
  });

  it("sends an explicit clear flag instead of an empty secret", async () => {
    fetchMock
      .mockReturnValueOnce(response({ providers: [provider] }))
      .mockReturnValueOnce(response({ provider }))
      .mockReturnValueOnce(response({ providers: [provider] }));
    render(
      <MemoryRouter>
        <AdminProviders />
      </MemoryRouter>,
    );

    fireEvent.click(
      await screen.findByRole("button", { name: "编辑 OpenAI 主线路" }),
    );
    fireEvent.click(screen.getByLabelText("清除数据库中的 API Key"));
    fireEvent.click(screen.getByRole("button", { name: "保存配置" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    const body = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    expect(body).toMatchObject({ clearApiKey: true });
    expect(body).not.toHaveProperty("apiKey");
  });

  it("restores environment behavior through DELETE after confirmation", async () => {
    fetchMock
      .mockReturnValueOnce(response({ providers: [provider] }))
      .mockReturnValueOnce(response({ ok: true }))
      .mockReturnValueOnce(
        response({ providers: [{ ...provider, configured: false }] }),
      );
    jest.spyOn(window, "confirm").mockReturnValueOnce(true);
    render(
      <MemoryRouter>
        <AdminProviders />
      </MemoryRouter>,
    );

    fireEvent.click(
      await screen.findByRole("button", {
        name: "恢复 OpenAI 主线路的环境变量配置",
      }),
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(fetchMock.mock.calls[1]).toEqual([
      "/api/account/admin/providers/openai",
      expect.objectContaining({ method: "DELETE" }),
    ]);
  });
});
