import { fireEvent, render, screen } from "@testing-library/react";
import {
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";

import { DangerConfirmDialog } from "./danger-confirm-dialog";

jest.mock("./ui-lib", () => {
  const React = jest.requireActual<typeof import("react")>("react");

  return {
    Input: ({
      as: _as,
      ...props
    }: InputHTMLAttributes<HTMLInputElement> & { as?: string }) =>
      React.createElement("input", props),
    Modal: ({
      title,
      children,
      actions,
      onClose,
    }: {
      title: string;
      children?: ReactNode;
      actions?: ReactNode[];
      onClose?: () => void;
    }) => (
      <section>
        <h2>{title}</h2>
        <button type="button" aria-label="Close dialog" onClick={onClose} />
        {children}
        <footer>{actions}</footer>
      </section>
    ),
  };
});

jest.mock("./button", () => {
  const React = jest.requireActual<typeof import("react")>("react");

  return {
    IconButton: ({
      aria,
      text,
      ...props
    }: ButtonHTMLAttributes<HTMLButtonElement> & {
      aria?: string;
      text?: string;
      bordered?: boolean;
      type?: string;
    }) => {
      const { bordered: _bordered, type: _type, ...buttonProps } = props;
      return React.createElement(
        "button",
        { ...buttonProps, type: "button", "aria-label": aria },
        text,
      );
    },
  };
});

const defaultProps = {
  open: true,
  confirmWord: "DELETE",
  title: "Clear all data",
  description: "This action cannot be undone.",
  inputLabel: "Type DELETE to confirm",
  confirmLabel: "Delete everything",
  cancelLabel: "Cancel",
};

describe("DangerConfirmDialog", () => {
  it("enables confirmation only for an exact confirmation word match", () => {
    const onConfirm = jest.fn();
    render(
      <DangerConfirmDialog
        {...defaultProps}
        onClose={jest.fn()}
        onConfirm={onConfirm}
      />,
    );

    const input = screen.getByRole("textbox", {
      name: defaultProps.inputLabel,
    });
    const confirmButton = screen.getByRole("button", {
      name: defaultProps.confirmLabel,
    });

    expect(confirmButton).toBeDisabled();
    fireEvent.change(input, { target: { value: "delete" } });
    expect(confirmButton).toBeDisabled();
    fireEvent.change(input, { target: { value: " DELETE " } });
    expect(confirmButton).toBeDisabled();
    fireEvent.change(input, { target: { value: "DELETE" } });
    expect(confirmButton).toBeEnabled();

    fireEvent.click(confirmButton);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("cancels without confirming", () => {
    const onClose = jest.fn();
    const onConfirm = jest.fn();
    render(
      <DangerConfirmDialog
        {...defaultProps}
        onClose={onClose}
        onConfirm={onConfirm}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: defaultProps.cancelLabel }),
    );

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("associates its description and error with the dialog and input", () => {
    const error = "The typed confirmation word does not match.";
    render(
      <DangerConfirmDialog
        {...defaultProps}
        error={error}
        onClose={jest.fn()}
        onConfirm={jest.fn()}
      />,
    );

    const dialog = screen.getByRole("dialog", {
      name: defaultProps.title,
    });
    const input = screen.getByRole("textbox", {
      name: defaultProps.inputLabel,
    });
    const descriptionId = screen.getByText(defaultProps.description).id;
    const errorId = screen.getByRole("alert").id;

    expect(descriptionId).not.toBe("");
    expect(screen.getByRole("alert")).toHaveTextContent(error);
    expect(dialog).toHaveAttribute(
      "aria-describedby",
      `${descriptionId} ${errorId}`,
    );
    expect(input).toHaveAttribute(
      "aria-describedby",
      `${descriptionId} ${errorId}`,
    );
  });

  it("clears the confirmation input after closing and reopening", () => {
    function DialogHarness() {
      const [open, setOpen] = useState(true);

      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Open dialog
          </button>
          <DangerConfirmDialog
            {...defaultProps}
            open={open}
            onClose={() => setOpen(false)}
            onConfirm={jest.fn()}
          />
        </>
      );
    }

    render(<DialogHarness />);
    fireEvent.change(
      screen.getByRole("textbox", { name: defaultProps.inputLabel }),
      { target: { value: "DELETE" } },
    );
    fireEvent.click(
      screen.getByRole("button", { name: defaultProps.cancelLabel }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Open dialog" }));

    expect(
      screen.getByRole("textbox", { name: defaultProps.inputLabel }),
    ).toHaveValue("");
    expect(
      screen.getByRole("button", { name: defaultProps.confirmLabel }),
    ).toBeDisabled();
  });
});
