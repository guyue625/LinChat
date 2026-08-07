import { randomBytes } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { applyDatabaseSchema } from "../db/connection";
import {
  CorruptProviderConfigError,
  ProviderConfigRepository,
} from "./repository";

describe("ProviderConfigRepository", () => {
  let database: DatabaseSync;
  let repository: ProviderConfigRepository;

  beforeEach(() => {
    database = new DatabaseSync(":memory:");
    applyDatabaseSchema(database);
    repository = new ProviderConfigRepository(database, randomBytes(32));
  });

  afterEach(() => database.close());

  it("creates and reads a provider without exposing plaintext secrets", () => {
    const created = repository.upsert("openai", {
      label: "OpenAI 主线路",
      enabled: true,
      baseUrl: "https://api.example.com",
      apiKey: "sk-secret",
      options: { organizationId: "org-1" },
      models: [{ name: "gpt-4o", alias: "GPT 4o" }],
    });

    expect(created).toMatchObject({
      id: "openai",
      label: "OpenAI 主线路",
      enabled: true,
      baseUrl: "https://api.example.com",
      hasApiKey: true,
      hasApiSecret: false,
      extra: {
        version: 1,
        options: { organizationId: "org-1" },
        models: [{ name: "gpt-4o", alias: "GPT 4o" }],
      },
    });
    expect(JSON.stringify(created)).not.toContain("sk-secret");
    expect(repository.getSecret("openai", "apiKey")).toBe("sk-secret");

    const row = database
      .prepare("SELECT api_key, extra_json FROM providers WHERE id = ?")
      .get("openai") as { api_key: string; extra_json: string };
    expect(row.api_key).not.toContain("sk-secret");
    expect(row.extra_json).not.toContain("sk-secret");
  });

  it("uses registry defaults for a new partial record", () => {
    expect(repository.upsert("google", { enabled: false })).toMatchObject({
      id: "google",
      label: "Google Gemini",
      enabled: false,
      baseUrl: null,
      hasApiKey: false,
      extra: { version: 1, options: {}, models: null },
    });
  });

  it("preserves omitted secrets and clears only when explicitly requested", () => {
    repository.upsert("baidu", {
      apiKey: "key-secret",
      apiSecret: "second-secret",
    });
    repository.upsert("baidu", { label: "百度主线路" });

    expect(repository.getSecret("baidu", "apiKey")).toBe("key-secret");
    expect(repository.getSecret("baidu", "apiSecret")).toBe("second-secret");

    const cleared = repository.upsert("baidu", {
      clearApiKey: true,
      clearApiSecret: true,
    });
    expect(cleared).toMatchObject({
      hasApiKey: false,
      hasApiSecret: false,
    });
    expect(repository.getSecret("baidu", "apiKey")).toBeUndefined();
    expect(repository.getSecret("baidu", "apiSecret")).toBeUndefined();
  });

  it("replaces options and models only when they are supplied", () => {
    repository.upsert("azure", {
      options: { apiVersion: "2024-01-01" },
      models: [{ name: "gpt-4o" }],
    });
    repository.upsert("azure", { label: "Azure 2" });
    expect(repository.get("azure")?.extra).toEqual({
      version: 1,
      options: { apiVersion: "2024-01-01" },
      models: [{ name: "gpt-4o" }],
    });

    repository.upsert("azure", { options: {}, models: null });
    expect(repository.get("azure")?.extra).toEqual({
      version: 1,
      options: {},
      models: null,
    });
  });

  it("lists records in registry order and deletes an override", () => {
    repository.upsert("google", { enabled: true });
    repository.upsert("openai", { enabled: true });

    expect(repository.list().map((record) => record.id)).toEqual([
      "openai",
      "google",
    ]);
    expect(repository.delete("openai")).toBe(true);
    expect(repository.delete("openai")).toBe(false);
    expect(repository.get("openai")).toBeNull();
  });

  it("restores an exact encrypted snapshot after a failed follow-up operation", () => {
    repository.upsert("openai", {
      label: "Before",
      apiKey: "old-secret",
      models: [{ name: "old-model" }],
    });
    const existingSnapshot = repository.snapshot("openai");

    repository.upsert("openai", {
      label: "After",
      apiKey: "new-secret",
      models: [{ name: "new-model" }],
    });
    repository.restore(existingSnapshot);

    expect(repository.get("openai")).toMatchObject({
      label: "Before",
      extra: { models: [{ name: "old-model" }] },
    });
    expect(repository.getSecret("openai", "apiKey")).toBe("old-secret");

    const missingSnapshot = repository.snapshot("google");
    repository.upsert("google", { enabled: false });
    repository.restore(missingSnapshot);
    expect(repository.get("google")).toBeNull();
  });

  it("rejects invalid patches even when called outside the API", () => {
    expect(() =>
      repository.upsert("openai", {
        baseUrl: "file:///tmp/secret",
      }),
    ).toThrow("Base URL");
  });

  it("fails closed on malformed stored JSON or ciphertext", () => {
    repository.upsert("openai", { apiKey: "secret" });
    database
      .prepare("UPDATE providers SET extra_json = ? WHERE id = ?")
      .run("{", "openai");
    expect(() => repository.get("openai")).toThrow(CorruptProviderConfigError);

    repository.delete("openai");
    repository.upsert("openai", { apiKey: "secret" });
    database
      .prepare("UPDATE providers SET api_key = ? WHERE id = ?")
      .run("v1.invalid.invalid.invalid", "openai");
    expect(() => repository.getSecret("openai", "apiKey")).toThrow(
      CorruptProviderConfigError,
    );
  });

  it("fails closed on incomplete extra data or an invalid timestamp", () => {
    repository.upsert("openai", { enabled: true });
    database
      .prepare("UPDATE providers SET extra_json = ? WHERE id = ?")
      .run(JSON.stringify({ version: 1 }), "openai");
    expect(() => repository.get("openai")).toThrow(CorruptProviderConfigError);

    repository.upsert("google", { enabled: true });
    database
      .prepare("UPDATE providers SET updated_at = ? WHERE id = ?")
      .run("not-a-timestamp", "google");
    expect(() => repository.get("google")).toThrow(CorruptProviderConfigError);
  });
});
