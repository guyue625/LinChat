import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from "node:crypto";
import type { ProviderId } from "./types";

const KEY_BYTES = 32;
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;

export type ProviderSecretField = "apiKey" | "apiSecret";

type ProviderCryptoScope = {
  rootKey: Buffer;
  providerId: ProviderId;
  field: ProviderSecretField;
};

function deriveProviderKey(rootKey: Buffer): Buffer {
  if (rootKey.length !== KEY_BYTES) {
    throw new Error("provider 配置加密根密钥必须为 32 字节");
  }
  return Buffer.from(
    hkdfSync(
      "sha256",
      rootKey,
      Buffer.from("nextchat-provider-config", "utf8"),
      Buffer.from("v1", "utf8"),
      KEY_BYTES,
    ),
  );
}

function aad(providerId: ProviderId, field: ProviderSecretField): Buffer {
  return Buffer.from(`nextchat-provider:v1:${providerId}:${field}`, "utf8");
}

export function encryptProviderSecret(
  input: ProviderCryptoScope & { plaintext: string },
): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(
    "aes-256-gcm",
    deriveProviderKey(input.rootKey),
    iv,
  );
  cipher.setAAD(aad(input.providerId, input.field));
  const ciphertext = Buffer.concat([
    cipher.update(input.plaintext, "utf8"),
    cipher.final(),
  ]);
  return [
    "v1",
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function decryptProviderSecret(
  input: ProviderCryptoScope & { encrypted: string },
): string {
  const [version, ivPart, tagPart, ciphertextPart, extra] =
    input.encrypted.split(".");
  if (
    version !== "v1" ||
    !ivPart ||
    !tagPart ||
    !ciphertextPart ||
    extra !== undefined
  ) {
    throw new Error("provider 密文格式错误");
  }

  const iv = Buffer.from(ivPart, "base64url");
  const tag = Buffer.from(tagPart, "base64url");
  const ciphertext = Buffer.from(ciphertextPart, "base64url");
  if (
    iv.length !== IV_BYTES ||
    tag.length !== AUTH_TAG_BYTES ||
    ciphertext.length === 0
  ) {
    throw new Error("provider 密文格式错误");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    deriveProviderKey(input.rootKey),
    iv,
  );
  decipher.setAAD(aad(input.providerId, input.field));
  decipher.setAuthTag(tag);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}
