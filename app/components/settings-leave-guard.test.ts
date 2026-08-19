import {
  confirmSettingsLeave,
  registerBeforeUnload,
} from "./settings-leave-guard";

describe("settings leave guard", () => {
  it("allows navigation without asking when the draft is clean", async () => {
    const confirmFn = jest.fn().mockResolvedValue(false);

    await expect(confirmSettingsLeave(false, confirmFn)).resolves.toBe(true);
    expect(confirmFn).not.toHaveBeenCalled();
  });

  it.each([true, false])(
    "uses the asynchronous confirmation result %s for a dirty draft",
    async (confirmed) => {
      const confirmFn = jest.fn().mockResolvedValue(confirmed);

      await expect(confirmSettingsLeave(true, confirmFn)).resolves.toBe(
        confirmed,
      );
      expect(confirmFn).toHaveBeenCalledTimes(1);
    },
  );

  it("registers a compatible beforeunload guard and removes it on cleanup", () => {
    const addEventListener = jest.spyOn(window, "addEventListener");
    const removeEventListener = jest.spyOn(window, "removeEventListener");

    try {
      const cleanup = registerBeforeUnload(true);
      const registration = addEventListener.mock.calls.find(
        ([eventName]) => eventName === "beforeunload",
      );
      expect(registration).toBeDefined();

      const handler = registration?.[1] as EventListener;
      const event = {
        preventDefault: jest.fn(),
        returnValue: undefined,
      } as unknown as BeforeUnloadEvent;

      handler(event);

      expect(event.preventDefault).toHaveBeenCalledTimes(1);
      expect(event.returnValue).toBe("");

      cleanup();
      expect(removeEventListener).toHaveBeenCalledWith("beforeunload", handler);

      const eventAfterCleanup = new Event("beforeunload", {
        cancelable: true,
      });
      window.dispatchEvent(eventAfterCleanup);
      expect(eventAfterCleanup.defaultPrevented).toBe(false);
    } finally {
      addEventListener.mockRestore();
      removeEventListener.mockRestore();
    }
  });

  it("does not register beforeunload while the draft is clean", () => {
    const addEventListener = jest.spyOn(window, "addEventListener");

    try {
      const cleanup = registerBeforeUnload(false);

      expect(
        addEventListener.mock.calls.some(
          ([eventName]) => eventName === "beforeunload",
        ),
      ).toBe(false);
      expect(cleanup).not.toThrow();
    } finally {
      addEventListener.mockRestore();
    }
  });
});
