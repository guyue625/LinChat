import {
  AccountAuthService,
  type AccountAuthRepository,
  type AuthRecord,
} from "../account-auth";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe("provider config audit", () => {
  let data: AuthRecord;
  let repository: AccountAuthRepository;
  let service: AccountAuthService;

  beforeEach(() => {
    data = {
      users: [
        {
          id: "admin-1",
          username: "admin",
          passwordHash: "unused",
          role: "admin",
          disabled: false,
          createdAt: "2026-08-07T00:00:00.000Z",
        },
        {
          id: "user-1",
          username: "user",
          passwordHash: "unused",
          role: "user",
          disabled: false,
          createdAt: "2026-08-07T00:00:00.000Z",
        },
      ],
      invitations: [],
      sessions: [],
      resetTokens: [],
      auditLogs: [],
    };
    repository = {
      read: async () => clone(data),
      write: async (next) => {
        data = clone(next);
      },
    };
    service = new AccountAuthService(repository, "session-secret");
  });

  it("records a provider change in the existing admin audit stream", async () => {
    await service.recordProviderConfigAudit(
      "admin-1",
      "PROVIDER_CONFIG_UPDATED",
      {
        providerId: "openai",
        changedFields: "enabled,apiKey",
        enabled: true,
      },
    );

    expect(data.auditLogs).toHaveLength(1);
    expect(data.auditLogs[0]).toMatchObject({
      action: "PROVIDER_CONFIG_UPDATED",
      actorUserId: "admin-1",
      actorUsername: "admin",
      metadata: {
        providerId: "openai",
        changedFields: "enabled,apiKey",
        enabled: true,
      },
    });
    expect(JSON.stringify(data.auditLogs[0])).not.toContain("secret");
  });

  it("requires an enabled administrator", async () => {
    await expect(
      service.recordProviderConfigAudit("user-1", "PROVIDER_CONFIG_DELETED", {
        providerId: "openai",
        changedFields: "override",
      }),
    ).rejects.toMatchObject({ code: "ADMIN_REQUIRED", status: 403 });
    expect(data.auditLogs).toHaveLength(0);
  });
});
