import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  AccountAuthService,
  type AccountAuthRepository,
  type AuthRecord,
} from "./account-auth";

const EMPTY_RECORD: AuthRecord = {
  users: [],
  invitations: [],
  sessions: [],
  resetTokens: [],
  auditLogs: [],
};

class JsonAccountAuthRepository implements AccountAuthRepository {
  constructor(private readonly filePath: string) {}

  async read(): Promise<AuthRecord> {
    try {
      const content = await readFile(this.filePath, "utf8");
      const parsed = JSON.parse(content) as Partial<AuthRecord>;
      return {
        users: parsed.users ?? [],
        invitations: parsed.invitations ?? [],
        sessions: parsed.sessions ?? [],
        resetTokens: parsed.resetTokens ?? [],
        auditLogs: parsed.auditLogs ?? [],
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return JSON.parse(JSON.stringify(EMPTY_RECORD)) as AuthRecord;
      }
      throw error;
    }
  }

  async write(data: AuthRecord): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.${process.pid}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(data, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
    await rename(temporaryPath, this.filePath);
  }
}

let servicePromise: Promise<AccountAuthService> | undefined;

export function isAccountAuthEnabled() {
  return (
    process.env.ACCOUNT_AUTH_ENABLED === "true" ||
    Boolean(
      process.env.ACCOUNT_ADMIN_USERNAME && process.env.ACCOUNT_ADMIN_PASSWORD,
    )
  );
}

export async function getAccountAuthService() {
  if (!isAccountAuthEnabled()) {
    throw new Error("Account authentication is not enabled");
  }
  if (!servicePromise) {
    servicePromise = (async () => {
      const sessionSecret =
        process.env.ACCOUNT_SESSION_SECRET || process.env.CODE || "";
      if (sessionSecret.length < 16) {
        throw new Error(
          "ACCOUNT_SESSION_SECRET must contain at least 16 characters",
        );
      }
      const filePath =
        process.env.ACCOUNT_DATA_FILE ||
        path.join(process.cwd(), "data", "accounts.json");
      const service = new AccountAuthService(
        new JsonAccountAuthRepository(filePath),
        sessionSecret,
      );
      const adminUsername = process.env.ACCOUNT_ADMIN_USERNAME;
      const adminPassword = process.env.ACCOUNT_ADMIN_PASSWORD;
      if (adminUsername && adminPassword) {
        await service.createInitialAdmin(adminUsername, adminPassword);
      }
      const initialInvitation = process.env.ACCOUNT_INITIAL_INVITATION;
      if (initialInvitation) {
        const maxUses = Number(
          process.env.ACCOUNT_INITIAL_INVITATION_USES || 1,
        );
        await service.createInvitation(initialInvitation, maxUses);
      }
      return service;
    })();
  }
  return servicePromise;
}
