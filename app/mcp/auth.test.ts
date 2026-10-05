/** @jest-environment node */
let mockUser: { role: string } | null = null;
jest.mock("next/headers", () => ({
  cookies: () => ({ get: () => ({ value: "test-token" }) }),
}));
jest.mock("../lib/account-auth-server", () => ({
  isAccountAuthEnabled: () => true,
  getAccountAuthService: async () => ({
    getUserBySession: async () => mockUser,
  }),
}));
import { requireMcpAccess } from "./auth";
it("requires login and restricts shared MCP configuration to administrators", async () => {
  mockUser = null;
  await expect(requireMcpAccess()).rejects.toMatchObject({
    code: "UNAUTHORIZED",
  });
  mockUser = { role: "user" };
  await expect(requireMcpAccess()).resolves.toBeUndefined();
  await expect(requireMcpAccess(true)).rejects.toMatchObject({
    code: "ADMIN_REQUIRED",
  });
  mockUser = { role: "admin" };
  await expect(requireMcpAccess(true)).resolves.toBeUndefined();
});
