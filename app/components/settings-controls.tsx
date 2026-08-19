import * as React from "react";
import clsx from "clsx";

import type { SettingsSubpage } from "./settings-schema";
import styles from "./settings-controls.module.scss";

export type SettingSectionProps = {
  id?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  status?: React.ReactNode;
  children: React.ReactNode;
};

export type SettingRowProps = {
  id: string;
  title: string;
  description?: React.ReactNode;
  status?: React.ReactNode;
  error?: string;
  children: React.ReactNode;
  danger?: boolean;
  vertical?: boolean;
};

export type SettingSwitchProps = {
  label: string;
  checked: boolean;
  disabled?: boolean;
  "aria-describedby"?: string;
  onChange: (checked: boolean) => void;
};

export type SettingsSubnavItem = Readonly<{
  value: SettingsSubpage;
  label: React.ReactNode;
}>;

export type SettingsSubnavProps = {
  ariaLabel?: string;
  current: SettingsSubpage;
  items: readonly SettingsSubnavItem[];
  onSelect: (subpage: SettingsSubpage) => void;
};

type DescribableElementProps = {
  children?: React.ReactNode;
  "aria-describedby"?: string;
};

const DESCRIBABLE_ELEMENTS = new Set(["button", "input", "select", "textarea"]);
const DESCRIBABLE_SELECTOR = "button,input,select,textarea";

function appendDescriptionId(current: string | undefined, id: string) {
  return Array.from(new Set([...(current?.split(/\s+/) ?? []), id]))
    .filter(Boolean)
    .join(" ");
}

function removeDescriptionId(element: HTMLElement, id: string) {
  const descriptionIds =
    element.getAttribute("aria-describedby")?.split(/\s+/).filter(Boolean) ??
    [];
  const addedIdIndex = descriptionIds.lastIndexOf(id);
  if (addedIdIndex === -1) return;

  descriptionIds.splice(addedIdIndex, 1);
  if (descriptionIds.length > 0) {
    element.setAttribute("aria-describedby", descriptionIds.join(" "));
  } else {
    element.removeAttribute("aria-describedby");
  }
}

function describeInteractiveChildren(
  children: React.ReactNode,
  errorId: string,
): React.ReactNode {
  return React.Children.map(children, (child) => {
    if (!React.isValidElement<DescribableElementProps>(child)) return child;

    if (child.type === React.Fragment) {
      return React.cloneElement(
        child,
        undefined,
        describeInteractiveChildren(child.props.children, errorId),
      );
    }

    if (typeof child.type !== "string") return child;

    if (DESCRIBABLE_ELEMENTS.has(child.type)) {
      return React.cloneElement(child, {
        "aria-describedby": appendDescriptionId(
          child.props["aria-describedby"],
          errorId,
        ),
      });
    }

    if (child.props.children === undefined) return child;

    return React.cloneElement(
      child,
      undefined,
      describeInteractiveChildren(child.props.children, errorId),
    );
  });
}

export function SettingSection({
  id,
  title,
  description,
  status,
  children,
}: SettingSectionProps) {
  const generatedHeadingId = React.useId();
  const headingId = id ? `${id}-title` : generatedHeadingId;

  return (
    <section
      id={id}
      className={styles["setting-section"]}
      aria-labelledby={headingId}
    >
      <header className={styles["section-header"]}>
        <div className={styles["section-copy"]}>
          <h2 id={headingId} className={styles["section-title"]}>
            {title}
          </h2>
          {description !== undefined && (
            <div className={styles["section-description"]}>{description}</div>
          )}
        </div>
        {status !== undefined && (
          <div className={styles["section-status"]}>{status}</div>
        )}
      </header>
      <div className={styles["section-rows"]}>{children}</div>
    </section>
  );
}

export function SettingRow({
  id,
  title,
  description,
  status,
  error,
  children,
  danger = false,
  vertical = false,
}: SettingRowProps) {
  const titleId = `${id}-title`;
  const errorId = `${id}-error`;
  const controlRef = React.useRef<HTMLDivElement>(null);
  const controls = error
    ? describeInteractiveChildren(children, errorId)
    : children;

  React.useEffect(() => {
    const controlContainer = controlRef.current;
    if (!controlContainer || !error) return;

    const updatedControls: HTMLElement[] = [];
    controlContainer
      .querySelectorAll<HTMLElement>(DESCRIBABLE_SELECTOR)
      .forEach((control) => {
        const current = control.getAttribute("aria-describedby") ?? undefined;
        const currentIds = current?.split(/\s+/).filter(Boolean) ?? [];
        if (currentIds.includes(errorId)) return;

        control.setAttribute(
          "aria-describedby",
          appendDescriptionId(current, errorId),
        );
        updatedControls.push(control);
      });

    return () => {
      updatedControls.forEach((control) =>
        removeDescriptionId(control, errorId),
      );
    };
  }, [children, error, errorId]);

  return (
    <section
      id={id}
      className={clsx(
        styles["setting-row"],
        danger && styles["row-danger"],
        vertical && styles["row-vertical"],
      )}
      aria-labelledby={titleId}
      data-danger={danger ? "true" : undefined}
      data-vertical={vertical ? "true" : undefined}
      data-has-status={status !== undefined ? "true" : undefined}
    >
      <div className={styles["row-copy"]}>
        <h3 id={titleId} className={styles["row-title"]}>
          {title}
        </h3>
        {description !== undefined && (
          <div className={styles["row-description"]}>{description}</div>
        )}
      </div>
      <div ref={controlRef} className={styles["row-control"]}>
        {controls}
        {error && (
          <div id={errorId} className={styles["row-error"]} role="alert">
            {error}
          </div>
        )}
      </div>
      {status !== undefined && (
        <div className={styles["row-status"]}>{status}</div>
      )}
    </section>
  );
}

export function SettingSwitch({
  label,
  checked,
  disabled = false,
  "aria-describedby": ariaDescribedBy,
  onChange,
}: SettingSwitchProps) {
  return (
    <label
      className={clsx(
        styles["setting-switch"],
        disabled && styles["switch-disabled"],
      )}
    >
      <span className={styles["visually-hidden"]}>{label}</span>
      <input
        className={styles["switch-input"]}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        aria-describedby={ariaDescribedBy}
        onChange={(event) => {
          if (!disabled) onChange(event.currentTarget.checked);
        }}
      />
      <span className={styles["switch-track"]} aria-hidden="true">
        <span className={styles["switch-thumb"]} />
      </span>
    </label>
  );
}

export function SettingsSubnav({
  ariaLabel,
  current,
  items,
  onSelect,
}: SettingsSubnavProps) {
  return (
    <nav className={styles["settings-subnav"]} aria-label={ariaLabel}>
      <div className={styles["subnav-list"]}>
        {items.map((item) => {
          const isCurrent = item.value === current;
          return (
            <button
              key={item.value}
              className={clsx(
                styles["subnav-item"],
                isCurrent && styles["subnav-item-current"],
              )}
              type="button"
              aria-current={isCurrent ? "page" : undefined}
              onClick={() => onSelect(item.value)}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
