import { DatabaseSync } from "node:sqlite";
import { applyDatabaseSchema } from "../db/connection";
import { createRuntimeProviderRepository } from "./server";

describe("runtime provider repository bootstrap", () => {
  let database: DatabaseSync;

  beforeEach(() => {
    database = new DatabaseSync(":memory:");
    applyDatabaseSchema(database);
  });

  afterEach(() => database.close());

  it("keeps environment-only deployments working without an encryption key", () => {
    expect(createRuntimeProviderRepository(database, undefined)).toBeNull();
  });

  it("requires the encryption key once a database override exists", () => {
    database
      .prepare(
        `INSERT INTO providers
          (id, label, enabled, base_url, api_key, api_secret, extra_json, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        "openai",
        "OpenAI",
        0,
        null,
        null,
        null,
        JSON.stringify({ version: 1, options: {}, models: null }),
        "2026-08-07T00:00:00.000Z",
      );

    expect(() => createRuntimeProviderRepository(database, undefined)).toThrow(
      "ACCOUNT_SYNC_ENCRYPTION_KEY",
    );
  });
});
