export type SettingsLeaveConfirm = () => boolean | Promise<boolean>;

export async function confirmSettingsLeave(
  dirty: boolean,
  confirmFn: SettingsLeaveConfirm,
) {
  if (!dirty) return true;

  return await confirmFn();
}

export function registerBeforeUnload(dirty: boolean) {
  if (!dirty || typeof window === "undefined") return () => {};

  const handleBeforeUnload = (event: BeforeUnloadEvent) => {
    event.preventDefault();
    event.returnValue = "";
  };

  window.addEventListener("beforeunload", handleBeforeUnload);

  return () => {
    window.removeEventListener("beforeunload", handleBeforeUnload);
  };
}
