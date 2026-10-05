/** @jest-environment node */
import { DatabaseSync } from "node:sqlite";

let mockDatabase: DatabaseSync;
const mockExecute = jest.fn();

jest.mock("../db/connection", () => ({ getDb: async () => mockDatabase }));
jest.mock("../db/mysql", () => ({
  getChatStorageProvider: () => "mysql",
  getMysqlPool: async () => ({ execute: mockExecute }),
}));

import { flushSyncDeletions } from "./deletions";

describe("MySQL deletion outbox", () => {
  beforeEach(() => {
    mockDatabase = new DatabaseSync(":memory:");
    mockDatabase.exec(
      "CREATE TABLE pending_sync_deletions (user_id TEXT PRIMARY KEY)",
    );
    mockDatabase
      .prepare("INSERT INTO pending_sync_deletions VALUES (?)")
      .run("deleted-user");
    mockExecute.mockReset();
  });

  afterEach(() => mockDatabase.close());

  it("retains failed cleanup and retries it on a later request", async () => {
    mockExecute.mockRejectedValueOnce(new Error("offline"));
    await expect(flushSyncDeletions()).rejects.toThrow("offline");
    expect(
      mockDatabase.prepare("SELECT * FROM pending_sync_deletions").all(),
    ).toHaveLength(1);

    mockExecute.mockResolvedValueOnce([{ affectedRows: 1 }]);
    await flushSyncDeletions();
    expect(
      mockDatabase.prepare("SELECT * FROM pending_sync_deletions").all(),
    ).toEqual([]);
    expect(mockExecute.mock.calls[1][1][0]).toBe("deleted-user");
  });
});
