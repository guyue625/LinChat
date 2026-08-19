import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import {
  SettingRow,
  SettingSection,
  SettingSwitch,
  SettingsSubnav,
} from "./settings-controls";

type WrappedControlProps = {
  onProps?: (props: WrappedControlProps) => void;
};

function WrappedControl(props: WrappedControlProps) {
  props.onProps?.(props);
  return <input aria-label="包装控件" aria-describedby="wrapped-help" />;
}

describe("settings controls", () => {
  it("renders a labelled setting row with status", () => {
    render(
      <SettingRow
        id="appearance-theme"
        title="主题"
        description="界面主题"
        status="即时生效"
      >
        <select aria-label="主题">
          <option>暗色</option>
        </select>
      </SettingRow>,
    );

    expect(screen.getByText("即时生效")).toBeInTheDocument();
    expect(document.getElementById("appearance-theme")).toHaveAccessibleName(
      "主题",
    );
  });

  it("associates a row error with its interactive control", () => {
    render(
      <SettingRow id="provider-api-key" title="API Key" error="密钥无效">
        <div>
          <input aria-label="API Key" aria-describedby="provider-help" />
        </div>
      </SettingRow>,
    );

    const alert = screen.getByRole("alert");
    const input = screen.getByRole("textbox", { name: "API Key" });

    expect(alert).toHaveAttribute("id", "provider-api-key-error");
    expect(input.getAttribute("aria-describedby")?.split(" ")).toEqual([
      "provider-help",
      "provider-api-key-error",
    ]);
  });

  it("associates a row error through an unknown wrapped control", async () => {
    render(
      <SettingRow id="wrapped-row" title="包装控件" error="错误">
        <WrappedControl />
      </SettingRow>,
    );

    const input = screen.getByRole("textbox", { name: "包装控件" });
    await waitFor(() =>
      expect(input.getAttribute("aria-describedby")?.split(" ")).toEqual([
        "wrapped-help",
        "wrapped-row-error",
      ]),
    );
  });

  it("does not inject aria-describedby into an unknown component", () => {
    const receivedProps: WrappedControlProps[] = [];
    render(
      <SettingRow id="wrapped-props" title="包装控件" error="错误">
        <WrappedControl onProps={(props) => receivedProps.push(props)} />
      </SettingRow>,
    );

    expect(receivedProps.length).toBeGreaterThan(0);
    for (const props of receivedProps) {
      expect(props).not.toHaveProperty("aria-describedby");
    }
  });

  it("removes only the row error description when error clears", async () => {
    const renderRow = (error?: string) => (
      <SettingRow id="wrapped-cleanup" title="包装控件" error={error}>
        <WrappedControl />
      </SettingRow>
    );
    const { rerender } = render(renderRow("错误"));

    await waitFor(() => {
      const tokens = screen
        .getByRole("textbox", { name: "包装控件" })
        .getAttribute("aria-describedby")
        ?.split(" ");
      expect(tokens).toEqual(["wrapped-help", "wrapped-cleanup-error"]);
      expect(
        tokens?.filter((token) => token === "wrapped-cleanup-error"),
      ).toHaveLength(1);
    });

    rerender(renderRow());

    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "包装控件" })).toHaveAttribute(
        "aria-describedby",
        "wrapped-help",
      ),
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("exposes danger and vertical row states", () => {
    render(
      <SettingRow id="data-clear" title="清除数据" danger vertical>
        <button type="button">清除</button>
      </SettingRow>,
    );

    const row = document.getElementById("data-clear");
    expect(row).toHaveAttribute("data-danger", "true");
    expect(row).toHaveAttribute("data-vertical", "true");
  });

  it("labels a setting section through its heading", () => {
    render(
      <SettingSection
        id="appearance"
        title="外观"
        description="调整界面显示"
        status="已同步"
      >
        <div>设置内容</div>
      </SettingSection>,
    );

    expect(screen.getByRole("region", { name: "外观" })).toBeInTheDocument();
    expect(screen.getByText("已同步")).toBeInTheDocument();
  });

  it("uses a real checkbox for the switch", () => {
    const onChange = jest.fn();
    render(<SettingSwitch label="流式输出" checked onChange={onChange} />);

    const checkbox = screen.getByRole("checkbox", { name: "流式输出" });
    expect(checkbox).toBeChecked();
    fireEvent.click(checkbox);

    expect(onChange).toHaveBeenCalledWith(false);
  });

  it("associates a row error through a custom switch", () => {
    render(
      <>
        <p id="stream-help">控制响应生成方式</p>
        <SettingRow id="stream-output" title="流式输出" error="暂时不可用">
          <SettingSwitch
            label="流式输出"
            checked
            aria-describedby="stream-help"
            onChange={jest.fn()}
          />
        </SettingRow>
      </>,
    );

    const checkbox = screen.getByRole("checkbox", { name: "流式输出" });
    expect(checkbox.getAttribute("aria-describedby")?.split(" ")).toEqual([
      "stream-help",
      "stream-output-error",
    ]);
  });

  it("keeps a disabled switch labelled and unchanged", () => {
    const onChange = jest.fn();
    render(
      <SettingSwitch
        label="流式输出"
        checked={false}
        disabled
        onChange={onChange}
      />,
    );

    const checkbox = screen.getByRole("checkbox", { name: "流式输出" });
    expect(checkbox).toBeDisabled();
    fireEvent.click(checkbox);

    expect(onChange).not.toHaveBeenCalled();
  });

  it("marks the current subpage and returns the selected target", () => {
    const onSelect = jest.fn();
    render(
      <SettingsSubnav
        ariaLabel="模型设置"
        current="model-providers"
        items={[
          { value: "model-providers", label: "服务接入" },
          { value: "model-catalog", label: "模型目录" },
        ]}
        onSelect={onSelect}
      />,
    );

    expect(screen.getByRole("button", { name: "服务接入" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    fireEvent.click(screen.getByRole("button", { name: "模型目录" }));

    expect(onSelect).toHaveBeenCalledWith("model-catalog");
  });
});
