import { randomBytes } from "node:crypto";
import { decryptProviderSecret, encryptProviderSecret } from "./crypto";

describe("provider config crypto", () => {
  it("encrypts and decrypts a provider field", () => {
    const rootKey = randomBytes(32);
    const encrypted = encryptProviderSecret({
      rootKey,
      providerId: "openai",
      field: "apiKey",
      plaintext: "sk-secret",
    });

    expect(encrypted).toMatch(/^v1\./);
    expect(encrypted).not.toContain("sk-secret");
    expect(
      decryptProviderSecret({
        rootKey,
        providerId: "openai",
        field: "apiKey",
        encrypted,
      }),
    ).toBe("sk-secret");
  });

  it("uses a fresh IV for each encryption", () => {
    const rootKey = randomBytes(32);
    const input = {
      rootKey,
      providerId: "openai" as const,
      field: "apiKey" as const,
      plaintext: "same-secret",
    };

    expect(encryptProviderSecret(input)).not.toBe(encryptProviderSecret(input));
  });

  it.each([
    ["provider", { providerId: "google" as const }],
    ["field", { field: "apiSecret" as const }],
    ["root key", { rootKey: randomBytes(32) }],
  ])("rejects the wrong %s", (_label, replacement) => {
    const rootKey = randomBytes(32);
    const encrypted = encryptProviderSecret({
      rootKey,
      providerId: "openai",
      field: "apiKey",
      plaintext: "sk-secret",
    });

    expect(() =>
      decryptProviderSecret({
        rootKey,
        providerId: "openai",
        field: "apiKey",
        encrypted,
        ...replacement,
      }),
    ).toThrow();
  });

  it("rejects malformed and tampered ciphertext", () => {
    const rootKey = randomBytes(32);
    const encrypted = encryptProviderSecret({
      rootKey,
      providerId: "openai",
      field: "apiKey",
      plaintext: "sk-secret",
    });
    const tampered = `${encrypted.slice(0, -1)}${
      encrypted.endsWith("A") ? "B" : "A"
    }`;

    for (const value of ["", "v2.a.b.c", "v1.a.b.c", tampered]) {
      expect(() =>
        decryptProviderSecret({
          rootKey,
          providerId: "openai",
          field: "apiKey",
          encrypted: value,
        }),
      ).toThrow();
    }
  });
});
