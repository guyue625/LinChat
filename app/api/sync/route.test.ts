/** @jest-environment node */

import { mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { StoreKey } from "../../constant";
import { SyncConflictError } from "../../lib/account-sync/repository";

let mockSessionUser: { id: string } | null = { id: "test-user" };
const mockRepository = {
  readWithLegacyMigration: jest.fn(),
  write: jest.fn(),
};

jest.mock("@/app/lib/account-auth-server", () => ({
  isAccountAuthEnabled: () => true,
  getAccountAuthService: async () => ({
    getUserBySession: async () => mockSessionUser,
  }),
}));

jest.mock(
  "@/app/lib/account-sync/server",
  () => ({
    getAccountSyncRepository: async () => mockRepository,
  }),
  { virtual: true },
);

import { GET, POST } from "./route";

function state(label = "local") {
  return {
    [StoreKey.Chat]: { sessions: [], currentSessionIndex: 0, lastInput: label },
    [StoreKey.Access]: {},
    [StoreKey.Config]: {},
    [StoreKey.Mask]: { masks: {} },
    [StoreKey.Prompt]: { prompts: {} },
  };
}

function request(method: "GET" | "POST", body?: unknown, revision?: string) {
  const headers = new Headers({ cookie: "nextchat_session=token" });
  if (body !== undefined) headers.set("content-type", "application/json");
  if (revision !== undefined) headers.set("x-sync-revision", revision);
  return new NextRequest("http://localhost/api/sync", {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("/api/sync", () => {
  let legacyDirectory: string;

  beforeAll(async () => {
    legacyDirectory = await mkdtemp(path.join(os.tmpdir(), "nextchat-route-"));
    process.env.ACCOUNT_SYNC_DIR = legacyDirectory;
  });

  beforeEach(async () => {
    mockSessionUser = { id: "test-user" };
    mockRepository.readWithLegacyMigration.mockReset();
    mockRepository.write.mockReset();
    await rm(legacyDirectory, { recursive: true, force: true });
    await mkdir(legacyDirectory, { recursive: true });
  });

  afterAll(async () => {
    delete process.env.ACCOUNT_SYNC_DIR;
    await rm(legacyDirectory, { recursive: true, force: true });
  });

  it("requires an authenticated account", async () => {
    mockSessionUser = null;
    const response = await GET(request("GET"));
    expect(response.status).toBe(401);
  });

  it("returns an empty revisioned envelope with no-store caching", async () => {
    mockRepository.readWithLegacyMigration.mockResolvedValue(null);
    const response = await GET(request("GET"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      state: null,
      revision: 0,
      updatedAt: null,
    });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("returns a stored snapshot", async () => {
    mockRepository.readWithLegacyMigration.mockResolvedValue({
      state: state("remote"),
      revision: 3,
      updatedAt: "2026-08-07T00:00:00.000Z",
    });

    const response = await GET(request("GET"));
    await expect(response.json()).resolves.toEqual({
      state: state("remote"),
      revision: 3,
      updatedAt: "2026-08-07T00:00:00.000Z",
    });
  });

  it.each([undefined, "-1", "1.5", "revision"])(
    "rejects an invalid revision header: %p",
    async (revision) => {
      const response = await POST(request("POST", state(), revision));
      expect(response.status).toBe(400);
      expect(mockRepository.write).not.toHaveBeenCalled();
    },
  );

  it("rejects an invalid app state", async () => {
    const response = await POST(request("POST", {}, "0"));
    expect(response.status).toBe(400);
    expect(mockRepository.write).not.toHaveBeenCalled();
  });

  it("writes with compare-and-swap revision", async () => {
    mockRepository.write.mockReturnValue({
      state: state(),
      revision: 2,
      updatedAt: "2026-08-07T00:00:00.000Z",
    });
    const response = await POST(request("POST", state(), "1"));

    expect(mockRepository.write).toHaveBeenCalledWith("test-user", state(), 1);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      revision: 2,
      updatedAt: "2026-08-07T00:00:00.000Z",
    });
  });

  it("returns the current snapshot on a revision conflict", async () => {
    mockRepository.write.mockImplementation(() => {
      throw new SyncConflictError({
        state: state("current"),
        revision: 4,
        updatedAt: "2026-08-07T00:00:01.000Z",
      });
    });

    const response = await POST(request("POST", state("stale"), "3"));
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      code: "SYNC_CONFLICT",
      state: state("current"),
      revision: 4,
      updatedAt: "2026-08-07T00:00:01.000Z",
    });
  });
});
