/** @jest-environment node */
import type { Pool } from "mysql2/promise";
import { StoreKey } from "../../constant";
import { MysqlAccountSyncRepository } from "./mysql-repository";
import { CorruptSyncSnapshotError, SyncConflictError } from "./repository";

const state = (text: string) => ({
  [StoreKey.Chat]: { sessions: [], lastInput: text },
});

describe("MySQL account snapshots", () => {
  const execute = jest.fn();
  const key = Buffer.alloc(32, 7);
  const repository = new MysqlAccountSyncRepository(
    { execute } as unknown as Pool,
    key,
  );

  beforeEach(() => execute.mockReset());

  it("encrypts a snapshot and reads it for its owner only", async () => {
    execute.mockResolvedValueOnce([{ affectedRows: 1 }]);
    const written = await repository.write(
      "owner",
      state("private message"),
      0,
    );
    const values = execute.mock.calls[0][1];
    expect(values[1]).not.toContain("private message");
    const row = {
      state_ciphertext: values[1],
      revision: "1",
      updated_at: values[3],
    };
    execute.mockResolvedValueOnce([[row]]);
    await expect(repository.read("owner")).resolves.toEqual(written);
    execute.mockResolvedValueOnce([[row]]);
    await expect(repository.read("other")).rejects.toBeInstanceOf(
      CorruptSyncSnapshotError,
    );
    expect(execute.mock.calls[2][1]).toEqual(["other"]);
  });

  it("rejects a stale update and returns the latest revision", async () => {
    execute.mockResolvedValueOnce([{ affectedRows: 1 }]);
    await repository.write("owner", state("latest"), 1);
    const values = execute.mock.calls[0][1];
    execute.mockResolvedValueOnce([{ affectedRows: 0 }]).mockResolvedValueOnce([
      [
        {
          state_ciphertext: values[0],
          revision: "2",
          updated_at: values[2],
        },
      ],
    ]);
    await expect(
      repository.write("owner", state("stale"), 1),
    ).rejects.toMatchObject({
      current: { revision: 2, state: state("latest") },
    });
    expect(execute.mock.calls[1][0]).toContain("revision = ? AND deleted = 0");
  });

  it("handles simultaneous first writes as a conflict", async () => {
    execute
      .mockRejectedValueOnce({ code: "ER_DUP_ENTRY" })
      .mockResolvedValueOnce([[]]);
    await expect(
      repository.write("owner", state("first"), 0),
    ).rejects.toBeInstanceOf(SyncConflictError);
  });

  it("does not fall back to legacy storage when MySQL is unavailable", async () => {
    const legacy = { readWithLegacyMigration: jest.fn(), write: jest.fn() };
    const migrating = new MysqlAccountSyncRepository(
      { execute } as unknown as Pool,
      key,
      legacy,
    );
    execute.mockRejectedValueOnce(new Error("offline"));
    await expect(migrating.readWithLegacyMigration("owner")).rejects.toThrow(
      "offline",
    );
    expect(legacy.readWithLegacyMigration).not.toHaveBeenCalled();
  });

  it("imports an existing SQLite snapshot only when MySQL has no snapshot", async () => {
    const legacy = {
      readWithLegacyMigration: jest
        .fn()
        .mockResolvedValue({ state: state("old"), revision: 8 }),
      write: jest.fn(),
    };
    const migrating = new MysqlAccountSyncRepository(
      { execute } as unknown as Pool,
      key,
      legacy,
    );
    execute
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);
    await expect(
      migrating.readWithLegacyMigration("owner"),
    ).resolves.toMatchObject({ state: state("old"), revision: 1 });
    expect(legacy.write).not.toHaveBeenCalled();
  });

  it("clears ciphertext and retains a tombstone to block late writes", async () => {
    execute.mockResolvedValueOnce([{ affectedRows: 1 }]);
    await repository.delete("deleted-user");
    expect(execute.mock.calls[0][0]).toContain(
      "state_ciphertext = '', revision = 0, deleted = 1",
    );
    expect(execute.mock.calls[0][1][0]).toBe("deleted-user");
  });

  it("rejects malformed state and unsafe revisions before issuing SQL", async () => {
    await expect(repository.write("owner", {}, 0)).rejects.toThrow();
    await expect(
      repository.write("owner", state("test"), Number.MAX_SAFE_INTEGER),
    ).rejects.toThrow();
    expect(execute).not.toHaveBeenCalled();
  });
});
