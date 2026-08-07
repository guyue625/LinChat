import { merge } from "./merge";

describe("merge", () => {
  it("ignores prototype-polluting keys from parsed JSON", () => {
    const source = JSON.parse(
      '{"__proto__":{"polluted":"yes"},"constructor":{"prototype":{"pollutedByConstructor":"yes"}},"safe":"value"}',
    );

    try {
      const target = {} as Record<string, unknown>;
      merge(target, source);

      expect(target.safe).toBe("value");
      expect(({} as { polluted?: string }).polluted).toBeUndefined();
      expect(
        ({} as { pollutedByConstructor?: string }).pollutedByConstructor,
      ).toBeUndefined();
    } finally {
      delete (Object.prototype as { polluted?: string }).polluted;
      delete (Object.prototype as { pollutedByConstructor?: string })
        .pollutedByConstructor;
    }
  });
});
