import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { StoreKey } from "../../constant";
import { LegacySyncSnapshotError, readLegacySyncSnapshot } from "./legacy";

function state() {
  return {
    [StoreKey.Chat]: { sessions: [], currentSessionIndex: 0, lastInput: "" },
  };
}

describe("readLegacySyncSnapshot", () => {
  let directory: string;

  beforeEach(async () => {
    directory = await mkdtemp(path.join(os.tmpdir(), "nextchat-sync-test-"));
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it("returns null when the legacy file does not exist", async () => {
    await expect(
      readLegacySyncSnapshot("user-1", directory),
    ).resolves.toBeNull();
  });

  it("reads a valid envelope without deleting it", async () => {
    const filePath = path.join(directory, "user-1.json");
    const envelope = {
      state: state(),
      updatedAt: "2026-08-07T00:00:00.000Z",
    };
    await writeFile(filePath, JSON.stringify(envelope), "utf8");

    await expect(readLegacySyncSnapshot("user-1", directory)).resolves.toEqual(
      envelope,
    );
    await expect(readFile(filePath, "utf8")).resolves.toContain("updatedAt");
  });

  it.each([
    ["invalid JSON", "{"],
    ["invalid state", JSON.stringify({ state: {} })],
  ])("rejects %s", async (_label, content) => {
    await writeFile(path.join(directory, "user-1.json"), content, "utf8");
    await expect(readLegacySyncSnapshot("user-1", directory)).rejects.toThrow(
      LegacySyncSnapshotError,
    );
  });

  it("checks the byte limit before parsing", async () => {
    await writeFile(path.join(directory, "user-1.json"), "x".repeat(101));
    await expect(
      readLegacySyncSnapshot("user-1", directory, 100),
    ).rejects.toThrow("大小限制");
  });

  it.each(["../user", "user/name", "", "user name"])(
    "rejects an unsafe user id: %p",
    async (userId) => {
      await expect(readLegacySyncSnapshot(userId, directory)).rejects.toThrow(
        "用户标识",
      );
    },
  );
});
