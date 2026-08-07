import { getProviderDefinition, type ProviderDefinition } from "./registry";
import type { ProviderModel, ValidatedProviderPatch } from "./types";

const MAX_LABEL_LENGTH = 64;
const MAX_URL_LENGTH = 2048;
const MAX_SECRET_LENGTH = 16 * 1024;
const MAX_MODELS = 500;
const MAX_MODEL_NAME_LENGTH = 256;
const MAX_MODEL_ALIAS_LENGTH = 128;
const MAX_OPTION_LENGTH = 2048;
const UNSAFE_MODEL_CHARACTERS = /[=,\u0000-\u001f\u007f]/;

const ALLOWED_PATCH_FIELDS = new Set([
  "label",
  "enabled",
  "baseUrl",
  "apiKey",
  "apiSecret",
  "clearApiKey",
  "clearApiSecret",
  "options",
  "models",
]);

export class InvalidProviderConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidProviderConfigError";
  }
}

function invalid(message: string): never {
  throw new InvalidProviderConfigError(message);
}

function validateSecret(
  patch: Record<string, unknown>,
  definition: ProviderDefinition,
  field: "apiKey" | "apiSecret",
  clearField: "clearApiKey" | "clearApiSecret",
  label: string,
) {
  const value = patch[field];
  const clear = patch[clearField];
  const supported =
    field === "apiKey"
      ? definition.supportsApiKey
      : definition.supportsApiSecret;

  if (!supported && value !== undefined) {
    invalid(`${definition.label} 不支持 ${label}`);
  }
  if (!supported && clear !== undefined) {
    invalid(`${definition.label} 不支持 ${label}`);
  }
  if (clear !== undefined && typeof clear !== "boolean") {
    invalid(`${clearField} 必须为布尔值`);
  }
  if (value !== undefined) {
    if (typeof value !== "string") invalid(`${label} 必须为字符串`);
    if (!value) invalid(`${label} 不能为空`);
    if (value.length > MAX_SECRET_LENGTH) {
      invalid(`${label} 不能超过 ${MAX_SECRET_LENGTH} 个字符`);
    }
    if (clear === true) invalid(`不能同时设置和清除 ${label}`);
  }
}

function validateModels(value: unknown): ProviderModel[] | null {
  if (value === null) return null;
  if (!Array.isArray(value)) invalid("models 必须为数组或 null");
  if (value.length > MAX_MODELS) {
    invalid(`每个服务商最多配置 ${MAX_MODELS} 个模型`);
  }

  const names = new Set<string>();
  return value.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      invalid("模型配置必须为对象");
    }
    const keys = Object.keys(entry as Record<string, unknown>);
    if (keys.some((key) => key !== "name" && key !== "alias")) {
      invalid("模型包含不支持的字段");
    }
    const rawName = (entry as { name?: unknown }).name;
    const rawAlias = (entry as { alias?: unknown }).alias;
    if (typeof rawName !== "string") invalid("模型名称必须为字符串");
    const name = rawName.trim();
    if (
      !name ||
      name.length > MAX_MODEL_NAME_LENGTH ||
      UNSAFE_MODEL_CHARACTERS.test(name)
    ) {
      invalid("模型名称无效");
    }
    if (names.has(name)) invalid("模型名称不能重复");
    names.add(name);

    if (rawAlias !== undefined && typeof rawAlias !== "string") {
      invalid("模型别名必须为字符串");
    }
    const alias = typeof rawAlias === "string" ? rawAlias.trim() : "";
    if (
      alias.length > MAX_MODEL_ALIAS_LENGTH ||
      UNSAFE_MODEL_CHARACTERS.test(alias)
    ) {
      invalid("模型别名无效");
    }
    return alias ? { name, alias } : { name };
  });
}

export function validateProviderPatch(
  providerId: string,
  input: unknown,
): ValidatedProviderPatch {
  const definition = getProviderDefinition(providerId);
  if (!definition) invalid("未知模型服务商");
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    invalid("请求内容必须为对象");
  }

  const patch = input as Record<string, unknown>;
  const unknownField = Object.keys(patch).find(
    (key) => !ALLOWED_PATCH_FIELDS.has(key),
  );
  if (unknownField) invalid(`不支持的配置字段: ${unknownField}`);

  const result: ValidatedProviderPatch = {};
  if (patch.label !== undefined) {
    if (typeof patch.label !== "string") invalid("label 必须为字符串");
    const label = patch.label.trim();
    if (!label || label.length > MAX_LABEL_LENGTH) invalid("label 长度无效");
    result.label = label;
  }
  if (patch.enabled !== undefined) {
    if (typeof patch.enabled !== "boolean") invalid("enabled 必须为布尔值");
    result.enabled = patch.enabled;
  }
  if (patch.baseUrl !== undefined) {
    if (patch.baseUrl === null || patch.baseUrl === "") {
      result.baseUrl = null;
    } else {
      if (typeof patch.baseUrl !== "string") invalid("Base URL 必须为字符串");
      const baseUrl = patch.baseUrl.trim();
      if (!baseUrl || baseUrl.length > MAX_URL_LENGTH) {
        invalid("Base URL 长度无效");
      }
      let parsed: URL;
      try {
        parsed = new URL(baseUrl);
      } catch {
        invalid("Base URL 必须是有效的 HTTP(S) 地址");
      }
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        invalid("Base URL 必须是 HTTP(S) 地址");
      }
      result.baseUrl = baseUrl;
    }
  }

  validateSecret(patch, definition, "apiKey", "clearApiKey", "API Key");
  validateSecret(
    patch,
    definition,
    "apiSecret",
    "clearApiSecret",
    "API Secret",
  );
  if (patch.apiKey !== undefined) result.apiKey = patch.apiKey as string;
  if (patch.apiSecret !== undefined) {
    result.apiSecret = patch.apiSecret as string;
  }
  if (patch.clearApiKey !== undefined) {
    result.clearApiKey = patch.clearApiKey as boolean;
  }
  if (patch.clearApiSecret !== undefined) {
    result.clearApiSecret = patch.clearApiSecret as boolean;
  }

  if (patch.options !== undefined) {
    if (
      !patch.options ||
      typeof patch.options !== "object" ||
      Array.isArray(patch.options)
    ) {
      invalid("options 必须为对象");
    }
    const allowedOptions = new Set(
      definition.options.map((option) => option.key),
    );
    const options: Record<string, string> = {};
    for (const [key, rawValue] of Object.entries(
      patch.options as Record<string, unknown>,
    )) {
      if (!allowedOptions.has(key)) invalid(`不支持的扩展字段: ${key}`);
      if (typeof rawValue !== "string") invalid(`${key} 必须为字符串`);
      const value = rawValue.trim();
      if (value.length > MAX_OPTION_LENGTH) invalid(`${key} 长度无效`);
      options[key] = value;
    }
    result.options = options;
  }
  if (patch.models !== undefined) {
    result.models = validateModels(patch.models);
  }
  return result;
}
