export function focusWithoutScroll(
  element: { focus: (options?: FocusOptions) => void } | null | undefined,
) {
  element?.focus({ preventScroll: true });
}
