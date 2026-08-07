import path from "node:path";
import { AccountAuthService } from "./account-auth";
import { getDb } from "./db/connection";
import {
  migrateLegacyAccountAuth,
  SqliteAccountAuthRepository,
} from "./account-auth-sqlite";

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
      const database = await getDb();
      const legacyFilePath =
        process.env.ACCOUNT_DATA_FILE ||
        path.join(process.cwd(), "data", "accounts.json");
      await migrateLegacyAccountAuth(database, legacyFilePath);
      const service = new AccountAuthService(
        new SqliteAccountAuthRepository(database),
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
