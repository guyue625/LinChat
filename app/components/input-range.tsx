import * as React from "react";
import clsx from "clsx";

import styles from "./input-range.module.scss";

interface InputRangeProps {
  onChange: React.ChangeEventHandler<HTMLInputElement>;
  title?: string;
  value: number | string;
  className?: string;
  min: string;
  max: string;
  step: string;
  aria: string;
  numberAriaLabel?: string;
  resetAriaLabel?: string;
  defaultValue?: number | string;
  onReset?: () => void;
  "aria-describedby"?: string;
}

export function InputRange({
  onChange,
  title,
  value,
  className,
  min,
  max,
  step,
  aria,
  numberAriaLabel,
  resetAriaLabel,
  defaultValue,
  onReset,
  "aria-describedby": ariaDescribedBy,
}: InputRangeProps) {
  const numberInputRef = React.useRef<HTMLInputElement>(null);
  const isNumberEditing = React.useRef(false);
  const resolvedNumberAriaLabel = numberAriaLabel ?? aria;
  const resolvedResetAriaLabel = resetAriaLabel ?? aria;
  const showReset = defaultValue !== undefined && onReset !== undefined;

  React.useEffect(() => {
    if (!isNumberEditing.current && numberInputRef.current) {
      numberInputRef.current.value = String(value);
    }
  }, [value]);

  return (
    <div className={clsx(styles["input-range"], className)}>
      <span className={styles["range-value"]}>{title || value}</span>
      <div className={styles["range-controls"]}>
        <input
          className={styles["range-input"]}
          aria-label={aria}
          aria-describedby={ariaDescribedBy}
          type="range"
          title={title}
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={onChange}
        />
        <input
          ref={numberInputRef}
          className={styles["number-input"]}
          aria-label={resolvedNumberAriaLabel}
          aria-describedby={ariaDescribedBy}
          type="number"
          defaultValue={value}
          min={min}
          max={max}
          step={step}
          onFocus={() => {
            isNumberEditing.current = true;
          }}
          onChange={(event) => {
            const valueAsNumber = event.currentTarget.valueAsNumber;
            if (
              event.currentTarget.value === "" ||
              !Number.isFinite(valueAsNumber) ||
              !event.currentTarget.validity.valid
            ) {
              return;
            }
            onChange(event);
          }}
          onBlur={(event) => {
            isNumberEditing.current = false;
            event.currentTarget.value = String(value);
          }}
        />
        {showReset && (
          <button
            className={styles["reset-button"]}
            type="button"
            aria-label={resolvedResetAriaLabel}
            title={resolvedResetAriaLabel}
            onClick={onReset}
          >
            <span aria-hidden="true">↺</span>
          </button>
        )}
      </div>
    </div>
  );
}
