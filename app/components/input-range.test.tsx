import { fireEvent, render, screen } from "@testing-library/react";
import type { ChangeEvent } from "react";

import { InputRange } from "./input-range";
import { SettingRow } from "./settings-controls";

const baseProps = {
  aria: "随机性",
  numberAriaLabel: "随机性精确值",
  resetAriaLabel: "恢复随机性默认值",
  value: "0.7",
  min: "0",
  max: "1",
  step: "0.1",
};

describe("InputRange", () => {
  it("supports exact input and reset", () => {
    const onChange = jest.fn();
    const onReset = jest.fn();
    render(
      <InputRange
        {...baseProps}
        onChange={onChange}
        defaultValue="0.7"
        onReset={onReset}
      />,
    );

    fireEvent.change(screen.getByRole("spinbutton", { name: "随机性精确值" }), {
      target: { value: "0.8" },
    });
    expect(onChange).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "恢复随机性默认值" }));
    expect(onReset).toHaveBeenCalled();
  });

  it("reuses the change handler and constraints for both inputs", () => {
    const changes: Array<[string, string]> = [];
    const onChange = jest.fn((event: ChangeEvent<HTMLInputElement>) => {
      changes.push([event.currentTarget.type, event.currentTarget.value]);
    });
    render(<InputRange {...baseProps} onChange={onChange} />);

    const range = screen.getByRole("slider", { name: "随机性" });
    const number = screen.getByRole("spinbutton", { name: "随机性精确值" });

    for (const input of [range, number]) {
      expect(input).toHaveAttribute("min", "0");
      expect(input).toHaveAttribute("max", "1");
      expect(input).toHaveAttribute("step", "0.1");
    }

    fireEvent.change(range, { target: { value: "0.8" } });
    fireEvent.change(number, { target: { value: "0.6" } });

    expect(onChange).toHaveBeenCalledTimes(2);
    expect(changes).toEqual([
      ["range", "0.8"],
      ["number", "0.6"],
    ]);
  });

  it("keeps an empty number draft without notifying the caller", () => {
    const onChange = jest.fn();
    render(<InputRange {...baseProps} onChange={onChange} />);

    const number = screen.getByRole("spinbutton", { name: "随机性精确值" });
    fireEvent.focus(number);
    fireEvent.change(number, { target: { value: "" } });

    expect(onChange).not.toHaveBeenCalled();
    expect(number).toHaveDisplayValue("");
  });

  it("does not notify for out-of-range or step-mismatched drafts", () => {
    const onChange = jest.fn();
    render(<InputRange {...baseProps} onChange={onChange} />);

    const number = screen.getByRole("spinbutton", { name: "随机性精确值" });
    fireEvent.focus(number);
    fireEvent.change(number, { target: { value: "1.1" } });
    fireEvent.change(number, { target: { value: "0.15" } });

    expect(onChange).not.toHaveBeenCalled();
  });

  it("allows a complete negative value after an empty draft", () => {
    const values: number[] = [];
    const onChange = jest.fn((event: ChangeEvent<HTMLInputElement>) => {
      values.push(event.currentTarget.valueAsNumber);
    });
    render(
      <InputRange
        {...baseProps}
        value="-0.5"
        min="-2"
        max="2"
        step="0.1"
        onChange={onChange}
      />,
    );

    const number = screen.getByRole("spinbutton", { name: "随机性精确值" });
    fireEvent.focus(number);
    fireEvent.change(number, { target: { value: "" } });
    fireEvent.change(number, { target: { value: "-1" } });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(values).toEqual([-1]);
    expect(number).toHaveDisplayValue("-1");
  });

  it("restores the latest external value when an invalid draft blurs", () => {
    const onChange = jest.fn();
    const { rerender } = render(
      <InputRange {...baseProps} onChange={onChange} />,
    );
    const number = screen.getByRole("spinbutton", { name: "随机性精确值" });

    fireEvent.focus(number);
    fireEvent.change(number, { target: { value: "1.1" } });
    expect(onChange).not.toHaveBeenCalled();
    expect(number).toHaveDisplayValue("1.1");

    rerender(<InputRange {...baseProps} value="0.8" onChange={onChange} />);
    expect(number).toHaveDisplayValue("1.1");

    fireEvent.blur(number);
    expect(number).toHaveDisplayValue("0.8");
  });

  it("synchronizes both inputs when the external value changes", () => {
    const onChange = jest.fn();
    const { rerender } = render(
      <InputRange {...baseProps} onChange={onChange} />,
    );

    rerender(<InputRange {...baseProps} value="0.9" onChange={onChange} />);

    expect(screen.getByRole("slider", { name: "随机性" })).toHaveValue("0.9");
    expect(
      screen.getByRole("spinbutton", { name: "随机性精确值" }),
    ).toHaveValue(0.9);
  });

  it("uses the base aria label without injecting Chinese text", () => {
    render(
      <InputRange
        aria="Temperature"
        value="0.7"
        min="0"
        max="1"
        step="0.1"
        defaultValue="0.7"
        onChange={jest.fn()}
        onReset={jest.fn()}
      />,
    );

    expect(
      screen.getByRole("slider", { name: "Temperature" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("spinbutton", { name: "Temperature" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Temperature" })).toHaveAttribute(
      "title",
      "Temperature",
    );
  });

  it("associates both inputs with a containing row error", () => {
    render(
      <>
        <p id="temperature-help">控制输出随机程度</p>
        <SettingRow
          id="model-temperature"
          title="随机性"
          error="请输入有效数值"
        >
          <InputRange
            {...baseProps}
            aria-describedby="temperature-help"
            onChange={jest.fn()}
          />
        </SettingRow>
      </>,
    );

    const range = screen.getByRole("slider", { name: "随机性" });
    const number = screen.getByRole("spinbutton", { name: "随机性精确值" });

    for (const input of [range, number]) {
      expect(input.getAttribute("aria-describedby")?.split(" ")).toEqual([
        "temperature-help",
        "model-temperature-error",
      ]);
    }
  });

  it("only renders reset when both reset props are provided", () => {
    const onChange = jest.fn();
    const onReset = jest.fn();
    const { rerender } = render(
      <InputRange {...baseProps} onChange={onChange} />,
    );

    expect(screen.queryByRole("button")).not.toBeInTheDocument();

    rerender(
      <InputRange {...baseProps} onChange={onChange} defaultValue="0.7" />,
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();

    rerender(
      <InputRange {...baseProps} onChange={onChange} onReset={onReset} />,
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
