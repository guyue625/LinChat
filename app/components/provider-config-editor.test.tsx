import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { InputHTMLAttributes, SelectHTMLAttributes } from "react";

import { GoogleSafetySettingsThreshold, ServiceProvider } from "../constant";
import { fetchUpstreamModels } from "../utils/upstream-models";
import type { ProviderCredentialSnapshot } from "./provider-config-draft";
import { ProviderConfigEditor } from "./provider-config-editor";

jest.mock("nanoid", () => ({ nanoid: () => "test-id" }));

jest.mock("../locales", () => {
  const field = (title: string) => ({
    Title: title,
    SubTitle: `${title} description`,
    Placeholder: title,
  });
  const provider = () => ({
    Endpoint: field("Endpoint"),
    ApiKey: field("API Key"),
  });
  const access = {
    OpenAI: provider(),
    Azure: { ...provider(), ApiVerion: field("API Version") },
    Google: {
      ...provider(),
      ApiVersion: field("API Version"),
      GoogleSafetySettings: field("Safety Settings"),
    },
    Anthropic: { ...provider(), ApiVerion: field("API Version") },
    Baidu: { ...provider(), SecretKey: field("Secret Key") },
    ByteDance: provider(),
    Alibaba: provider(),
    Tencent: { ...provider(), SecretKey: field("Secret Key") },
    Moonshot: provider(),
    Stability: provider(),
    Iflytek: { ...provider(), ApiSecret: field("API Secret") },
    DeepSeek: provider(),
    XAI: provider(),
    ChatGLM: provider(),
    SiliconFlow: provider(),
    AI302: provider(),
  };

  return {
    __esModule: true,
    default: {
      UI: { Close: "Close", Confirm: "Confirm", Cancel: "Cancel" },
      Export: { Image: { Modal: "Export image" } },
      Settings: {
        ShowPassword: "Show password",
        Status: {
          Unsaved: "Unsaved changes",
          TestConnection: "Test connection",
          Testing: "Testing connection…",
          ConnectionSuccess: (latencyMs: number, modelCount: number) =>
            `Connected in ${latencyMs} ms · ${modelCount} model${
              modelCount === 1 ? "" : "s"
            }`,
          ConnectionFailed: (reason: string) => `Connection failed: ${reason}`,
          SaveChanges: "Save changes",
          Saving: "Saving…",
          SaveSuccess: "Provider settings saved.",
          SaveFailed: (reason: string) => `Save failed: ${reason}`,
          ValidationFailed: "Validation failed. Check the highlighted fields.",
        },
        Access: access,
      },
    },
  };
});

jest.mock("../utils/upstream-models", () => {
  const actual = jest.requireActual<typeof import("../utils/upstream-models")>(
    "../utils/upstream-models",
  );
  return { ...actual, fetchUpstreamModels: jest.fn() };
});

jest.mock("./ui-lib", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  return {
    Input: ({
      as: _as,
      ...props
    }: InputHTMLAttributes<HTMLInputElement> & { as?: string }) =>
      React.createElement("input", props),
    PasswordInput: ({
      aria: _aria,
      ...props
    }: InputHTMLAttributes<HTMLInputElement> & { aria?: string }) =>
      React.createElement("input", { ...props, type: "password" }),
    Select: (props: SelectHTMLAttributes<HTMLSelectElement>) =>
      React.createElement("select", props),
    showToast: jest.fn(),
  };
});

const mockFetchUpstreamModels = fetchUpstreamModels as jest.MockedFunction<
  typeof fetchUpstreamModels
>;

function createSnapshot(
  overrides: Partial<ProviderCredentialSnapshot> = {},
): ProviderCredentialSnapshot {
  return {
    openaiUrl: "https://api.openai.com",
    openaiApiKey: "saved-key",
    azureUrl: "https://example.openai.azure.com",
    azureApiKey: "saved-azure-key",
    azureApiVersion: "2024-10-21",
    googleUrl: "https://generativelanguage.googleapis.com",
    googleApiKey: "",
    googleApiVersion: "v1",
    googleSafetySettings: GoogleSafetySettingsThreshold.BLOCK_ONLY_HIGH,
    anthropicUrl: "https://api.anthropic.com",
    anthropicApiKey: "",
    anthropicApiVersion: "2023-06-01",
    baiduUrl: "https://aip.baidubce.com",
    baiduApiKey: "",
    baiduSecretKey: "",
    bytedanceUrl: "https://ark.cn-beijing.volces.com",
    bytedanceApiKey: "",
    alibabaUrl: "https://dashscope.aliyuncs.com/api",
    alibabaApiKey: "",
    tencentUrl: "https://hunyuan.tencentcloudapi.com",
    tencentSecretId: "",
    tencentSecretKey: "",
    moonshotUrl: "https://api.moonshot.ai",
    moonshotApiKey: "",
    stabilityUrl: "https://api.stability.ai",
    stabilityApiKey: "",
    iflytekUrl: "https://spark-api-open.xf-yun.com",
    iflytekApiKey: "",
    iflytekApiSecret: "",
    deepseekUrl: "https://api.deepseek.com",
    deepseekApiKey: "",
    xaiUrl: "https://api.x.ai",
    xaiApiKey: "",
    chatglmUrl: "https://open.bigmodel.cn",
    chatglmApiKey: "",
    siliconflowUrl: "https://api.siliconflow.cn",
    siliconflowApiKey: "",
    ai302Url: "https://api.302.ai",
    ai302ApiKey: "",
    ...overrides,
  };
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function renderEditor({
  provider = ServiceProvider.OpenAI,
  initialValues = createSnapshot(),
  onSave = jest.fn(),
  onDirtyChange = jest.fn(),
}: {
  provider?: ServiceProvider;
  initialValues?: ProviderCredentialSnapshot;
  onSave?: jest.Mock;
  onDirtyChange?: jest.Mock;
} = {}) {
  const view = render(
    <ProviderConfigEditor
      provider={provider}
      initialValues={initialValues}
      onSave={onSave}
      onDirtyChange={onDirtyChange}
    />,
  );
  return { ...view, onSave, onDirtyChange };
}

function getProviderInput(id: string) {
  const input = document.querySelector<HTMLInputElement>(`#${id} input`);
  expect(input).not.toBeNull();
  return input as HTMLInputElement;
}

describe("ProviderConfigEditor", () => {
  beforeEach(() => {
    mockFetchUpstreamModels.mockReset();
    mockFetchUpstreamModels.mockResolvedValue([]);
  });

  it("keeps API key edits in the draft until save", async () => {
    const { onSave, onDirtyChange } = renderEditor();

    fireEvent.change(getProviderInput("provider-openai-api-key"), {
      target: { value: "draft-key" },
    });

    expect(onSave).not.toHaveBeenCalled();
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(true));
  });

  it("tests with draft values and saves a trimmed patch only on demand", async () => {
    mockFetchUpstreamModels.mockResolvedValue([{ name: "gpt-4o" }]);
    const { onSave } = renderEditor();

    fireEvent.change(getProviderInput("provider-openai-api-key"), {
      target: { value: "  draft-key  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Test connection" }));

    await waitFor(() =>
      expect(mockFetchUpstreamModels).toHaveBeenCalledWith(
        expect.objectContaining({ apiKey: "  draft-key  " }),
      ),
    );
    expect(onSave).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ openaiApiKey: "draft-key" }),
      ),
    );
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("shows the original connection error and preserves the draft", async () => {
    mockFetchUpstreamModels.mockRejectedValueOnce(
      new Error("401 Unauthorized"),
    );
    renderEditor();

    const apiKey = getProviderInput("provider-openai-api-key");
    fireEvent.change(apiKey, { target: { value: "draft-key" } });
    fireEvent.click(screen.getByRole("button", { name: "Test connection" }));

    expect(await screen.findByText(/401 Unauthorized/)).toBeInTheDocument();
    expect(apiKey).toHaveValue("draft-key");
  });

  it("does not test or save an invalid draft", async () => {
    const { onSave } = renderEditor();

    fireEvent.change(getProviderInput("provider-openai-endpoint"), {
      target: { value: "not-a-url" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Test connection" }));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(
      await screen.findByText("Endpoint must be a valid HTTP or HTTPS URL."),
    ).toBeInTheDocument();
    expect(mockFetchUpstreamModels).not.toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("prevents duplicate connection tests while testing", async () => {
    const pending =
      createDeferred<Awaited<ReturnType<typeof fetchUpstreamModels>>>();
    mockFetchUpstreamModels.mockReturnValueOnce(pending.promise);
    renderEditor();

    fireEvent.change(getProviderInput("provider-openai-api-key"), {
      target: { value: "draft-key" },
    });
    const testButton = screen.getByRole("button", {
      name: "Test connection",
    });
    const saveButton = screen.getByRole("button", { name: "Save changes" });
    fireEvent.click(testButton);

    expect(testButton).toBeDisabled();
    expect(saveButton).toBeDisabled();
    fireEvent.click(testButton);
    expect(mockFetchUpstreamModels).toHaveBeenCalledTimes(1);

    await act(async () => {
      pending.resolve([]);
      await pending.promise;
    });
    await waitFor(() => expect(testButton).toBeEnabled());
  });

  it("prevents duplicate saves while saving", async () => {
    const pending = createDeferred<void>();
    const onSave = jest.fn(() => pending.promise);
    renderEditor({ onSave });

    fireEvent.change(getProviderInput("provider-openai-api-key"), {
      target: { value: "draft-key" },
    });
    const testButton = screen.getByRole("button", {
      name: "Test connection",
    });
    const saveButton = screen.getByRole("button", { name: "Save changes" });
    fireEvent.click(saveButton);

    expect(testButton).toBeDisabled();
    expect(saveButton).toBeDisabled();
    fireEvent.click(saveButton);
    expect(onSave).toHaveBeenCalledTimes(1);

    await act(async () => {
      pending.resolve();
      await pending.promise;
    });
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Save changes" }),
      ).not.toBeInTheDocument(),
    );
  });

  it("keeps a draft and reports a synchronous save error", async () => {
    const onSave = jest.fn(() => {
      throw new Error("Storage unavailable");
    });
    renderEditor({ onSave });

    const apiKey = getProviderInput("provider-openai-api-key");
    fireEvent.change(apiKey, { target: { value: "draft-key" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText(/Storage unavailable/)).toBeInTheDocument();
    expect(apiKey).toHaveValue("draft-key");
  });

  it("synchronizes provider and initial value updates while clean", () => {
    const initialValues = createSnapshot();
    const { rerender, onSave, onDirtyChange } = renderEditor({ initialValues });

    const updatedOpenAIValues = createSnapshot({
      openaiApiKey: "updated-saved-key",
    });
    rerender(
      <ProviderConfigEditor
        provider={ServiceProvider.OpenAI}
        initialValues={updatedOpenAIValues}
        onSave={onSave}
        onDirtyChange={onDirtyChange}
      />,
    );
    expect(getProviderInput("provider-openai-api-key")).toHaveValue(
      "updated-saved-key",
    );

    const azureValues = createSnapshot({ azureApiKey: "updated-azure-key" });
    rerender(
      <ProviderConfigEditor
        provider={ServiceProvider.Azure}
        initialValues={azureValues}
        onSave={onSave}
        onDirtyChange={onDirtyChange}
      />,
    );
    expect(getProviderInput("provider-azure-api-key")).toHaveValue(
      "updated-azure-key",
    );
  });

  it("does not overwrite a dirty draft when provider or values update", () => {
    const initialValues = createSnapshot({ azureApiKey: "original-azure-key" });
    const { rerender, onSave, onDirtyChange } = renderEditor({ initialValues });

    fireEvent.change(getProviderInput("provider-openai-api-key"), {
      target: { value: "draft-key" },
    });
    const incomingValues = createSnapshot({
      openaiApiKey: "incoming-openai-key",
      azureApiKey: "incoming-azure-key",
    });
    rerender(
      <ProviderConfigEditor
        provider={ServiceProvider.Azure}
        initialValues={incomingValues}
        onSave={onSave}
        onDirtyChange={onDirtyChange}
      />,
    );

    expect(getProviderInput("provider-azure-api-key")).toHaveValue(
      "original-azure-key",
    );
  });
});
