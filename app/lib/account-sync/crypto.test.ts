import { randomBytes } from "node:crypto";
import {
  decryptSyncPayload,
  encryptSyncPayload,
  parseSyncEncryptionKey,
} from "./crypto";

describe("account sync encryption", () => {
  const keyBase64 = randomBytes(32).toString("base64");
  const plaintext = JSON.stringify({ apiKey: "secret-value" });

  it("accepts exactly 32 bytes encoded as base64", () => {
    expect(parseSyncEncryptionKey(keyBase64)).toHaveLength(32);
  });

  it.each([
    undefined,
    "",
    "not-base64!",
    randomBytes(31).toString("base64"),
    randomBytes(33).toString("base64"),
  ])("rejects an invalid encryption key: %p", (value) => {
    expect(() => parseSyncEncryptionKey(value)).toThrow(
      "ACCOUNT_SYNC_ENCRYPTION_KEY",
    );
  });

  it("round-trips data with a random IV", () => {
    const key = parseSyncEncryptionKey(keyBase64);
    const first = encryptSyncPayload({
      plaintext,
      userId: "user-1",
      revision: 1,
      key,
    });
    const second = encryptSyncPayload({
      plaintext,
      userId: "user-1",
      revision: 1,
      key,
    });

    expect(first).not.toBe(second);
    expect(
      decryptSyncPayload({
        encrypted: first,
        userId: "user-1",
        revision: 1,
        key,
      }),
    ).toBe(plaintext);
  });

  it("binds ciphertext to the user and revision", () => {
    const key = parseSyncEncryptionKey(keyBase64);
    const encrypted = encryptSyncPayload({
      plaintext,
      userId: "user-1",
      revision: 2,
      key,
    });

    expect(() =>
      decryptSyncPayload({
        encrypted,
        userId: "user-2",
        revision: 2,
        key,
      }),
    ).toThrow();
    expect(() =>
      decryptSyncPayload({
        encrypted,
        userId: "user-1",
        revision: 3,
        key,
      }),
    ).toThrow();
  });

  it("rejects a tampered ciphertext", () => {
    const key = parseSyncEncryptionKey(keyBase64);
    const encrypted = encryptSyncPayload({
      plaintext,
      userId: "user-1",
      revision: 1,
      key,
    });
    const parts = encrypted.split(".");
    const tamperedTag = Buffer.from(parts[2], "base64url");
    tamperedTag[0] ^= 1;
    parts[2] = tamperedTag.toString("base64url");

    expect(() =>
      decryptSyncPayload({
        encrypted: parts.join("."),
        userId: "user-1",
        revision: 1,
        key,
      }),
    ).toThrow();
  });
});
