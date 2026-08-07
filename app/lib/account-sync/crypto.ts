import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const KEY_BYTES = 32;
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;
const KEY_ERROR =
  "ACCOUNT_SYNC_ENCRYPTION_KEY 必须是 32 字节随机值的 Base64 编码";

type CryptoInput = {
  userId: string;
  revision: number;
  key: Buffer;
};

function aad(userId: string, revision: number) {
  return Buffer.from(`nextchat-sync:${userId}:${revision}`, "utf8");
}

export function parseSyncEncryptionKey(value: string | undefined): Buffer {
  if (
    !value ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      value,
    )
  ) {
    throw new Error(KEY_ERROR);
  }
  const key = Buffer.from(value, "base64");
  if (key.length !== KEY_BYTES || key.toString("base64") !== value) {
    throw new Error(KEY_ERROR);
  }
  return key;
}

export function getSyncEncryptionKey() {
  return parseSyncEncryptionKey(process.env.ACCOUNT_SYNC_ENCRYPTION_KEY);
}

export function encryptSyncPayload(
  input: CryptoInput & { plaintext: string },
): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", input.key, iv);
  cipher.setAAD(aad(input.userId, input.revision));
  const ciphertext = Buffer.concat([
    cipher.update(input.plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [
    "v1",
    iv.toString("base64url"),
    authTag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function decryptSyncPayload(
  input: CryptoInput & { encrypted: string },
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
    throw new Error("同步快照密文格式错误");
  }

  const iv = Buffer.from(ivPart, "base64url");
  const authTag = Buffer.from(tagPart, "base64url");
  const ciphertext = Buffer.from(ciphertextPart, "base64url");
  if (iv.length !== IV_BYTES || authTag.length !== AUTH_TAG_BYTES) {
    throw new Error("同步快照密文格式错误");
  }

  const decipher = createDecipheriv("aes-256-gcm", input.key, iv);
  decipher.setAAD(aad(input.userId, input.revision));
  decipher.setAuthTag(authTag);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}
