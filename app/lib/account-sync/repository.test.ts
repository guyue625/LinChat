import { randomBytes } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { StoreKey } from "../../constant";
import { applyDatabaseSchema } from "../db/connection";
import { AccountSyncRepository, SyncConflictError } from "./repository";

function state(apiKey: string) {
  return {
    [StoreKey.Chat]: { sessions: [], currentSessionIndex: 0, lastInput: "" },
    [StoreKey.Access]: { openaiApiKey: apiKey, lastUpdateTime: 1 },
    [StoreKey.Config]: { lastUpdateTime: 1 },
    [StoreKey.Mask]: { masks: {} },
    [StoreKey.Prompt]: { prompts: {} },
  };
}

describe("AccountSyncRepository", () => {
  let database: DatabaseSync;
  let repository: AccountSyncRepository;
  let legacyDirectory: string;

  beforeEach(async () => {
    database = new DatabaseSync(":memory:");
    applyDatabaseSchema(database);
    legacyDirectory = await mkdtemp(
      path.join(os.tmpdir(), "nextchat-repository-test-"),
    );
    repository = new AccountSyncRepository(
      database,
      randomBytes(32),
      legacyDirectory,
    );
  });

  afterEach(async () => {
    database.close();
    await rm(legacyDirectory, { recursive: true, force: true });
  });

  it("creates and reads an encrypted snapshot", () => {
    expect(repository.read("u1")).toBeNull();

    const created = repository.write("u1", state("secret-key"), 0);

    expect(created.revision).toBe(1);
    expect(repository.read("u1")?.state).toEqual(state("secret-key"));
    const row = database
      .prepare(
        "SELECT state_ciphertext FROM user_sync_snapshots WHERE user_id = ?",
      )
      .get("u1") as { state_ciphertext: string };
    expect(row.state_ciphertext).not.toContain("secret-key");
    expect(row.state_ciphertext).not.toContain(StoreKey.Access);
  });

  it("updates only when the expected revision matches", () => {
    repository.write("u1", state("first"), 0);
    const updated = repository.write("u1", state("second"), 1);

    expect(updated.revision).toBe(2);
    expect(repository.read("u1")?.state).toEqual(state("second"));
  });

  it("returns the current snapshot on a revision conflict", () => {
    repository.write("u1", state("first"), 0);
    repository.write("u1", state("second"), 1);

    let conflict: SyncConflictError | undefined;
    try {
      repository.write("u1", state("stale"), 1);
    } catch (error) {
      conflict = error as SyncConflictError;
    }

    expect(conflict).toBeInstanceOf(SyncConflictError);
    expect(conflict?.current?.revision).toBe(2);
    expect(conflict?.current?.state).toEqual(state("second"));
    expect(repository.read("u1")?.state).toEqual(state("second"));
  });

  it("rejects revision zero when a snapshot already exists", () => {
    repository.write("u1", state("first"), 0);
    expect(() => repository.write("u1", state("replace"), 0)).toThrow(
      SyncConflictError,
    );
    expect(repository.read("u1")?.state).toEqual(state("first"));
  });

  it("migrates a legacy snapshot once and keeps the source file", async () => {
    const filePath = path.join(legacyDirectory, "u1.json");
    await writeFile(
      filePath,
      JSON.stringify({
        state: state("legacy-secret"),
        updatedAt: "2026-08-06T00:00:00.000Z",
      }),
      "utf8",
    );

    const migrated = await repository.readWithLegacyMigration("u1");

    expect(migrated).toEqual({
      state: state("legacy-secret"),
      revision: 1,
      updatedAt: "2026-08-06T00:00:00.000Z",
    });
    await expect(readFile(filePath, "utf8")).resolves.toContain(
      "legacy-secret",
    );
  });

  it("prefers an existing database snapshot over a broken legacy file", async () => {
    repository.write("u1", state("database"), 0);
    await writeFile(path.join(legacyDirectory, "u1.json"), "{", "utf8");

    await expect(repository.readWithLegacyMigration("u1")).resolves.toEqual(
      expect.objectContaining({ state: state("database"), revision: 1 }),
    );
  });

  it("does not create a row from an invalid legacy snapshot", async () => {
    await writeFile(path.join(legacyDirectory, "u1.json"), "{", "utf8");

    await expect(repository.readWithLegacyMigration("u1")).rejects.toThrow();
    expect(repository.read("u1")).toBeNull();
  });

  it("returns the same migrated row on subsequent reads", async () => {
    await writeFile(
      path.join(legacyDirectory, "u1.json"),
      JSON.stringify({ state: state("legacy"), updatedAt: null }),
      "utf8",
    );

    const first = await repository.readWithLegacyMigration("u1");
    const second = await repository.readWithLegacyMigration("u1");

    expect(first?.revision).toBe(1);
    expect(second).toEqual(first);
    const row = database
      .prepare("SELECT COUNT(*) AS count FROM user_sync_snapshots")
      .get() as { count: number };
    expect(row.count).toBe(1);
  });
});
