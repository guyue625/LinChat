import { useEffect, useId, useState, type ReactNode } from "react";

import { IconButton } from "./button";
import { Input, Modal } from "./ui-lib";

export type DangerConfirmDialogProps = {
  open: boolean;
  confirmWord: string;
  title: string;
  description: ReactNode;
  inputLabel?: string;
  confirmLabel: string;
  cancelLabel: string;
  error?: ReactNode;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
};

export function DangerConfirmDialog({
  open,
  confirmWord,
  title,
  description,
  inputLabel = confirmWord,
  confirmLabel,
  cancelLabel,
  error,
  onClose,
  onConfirm,
}: DangerConfirmDialogProps) {
  const [value, setValue] = useState("");
  const id = useId();
  const inputId = `${id}-input`;
  const descriptionId = `${id}-description`;
  const errorId = `${id}-error`;
  const describedBy = error ? `${descriptionId} ${errorId}` : descriptionId;

  useEffect(() => {
    if (!open) setValue("");
  }, [open]);

  if (!open) return null;

  const close = () => {
    setValue("");
    onClose();
  };
  const matches = value === confirmWord;

  return (
    <div
      className="modal-mask"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        aria-describedby={describedBy}
      >
        <Modal
          title={title}
          onClose={close}
          actions={[
            <IconButton
              key="cancel"
              aria={cancelLabel}
              text={cancelLabel}
              onClick={close}
              bordered
            />,
            <IconButton
              key="confirm"
              aria={confirmLabel}
              text={confirmLabel}
              onClick={() => {
                if (matches) void onConfirm();
              }}
              disabled={!matches}
              type="danger"
            />,
          ]}
        >
          <p id={descriptionId}>{description}</p>
          <label htmlFor={inputId}>{inputLabel}</label>
          <Input
            as="input"
            id={inputId}
            value={value}
            autoComplete="off"
            aria-describedby={describedBy}
            onChange={(event) => setValue(event.currentTarget.value)}
            autoFocus
          />
          {error && (
            <p id={errorId} role="alert">
              {error}
            </p>
          )}
        </Modal>
      </div>
    </div>
  );
}
