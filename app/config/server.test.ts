import { getServerSideConfig } from "./server";

describe("server config logging", () => {
  it("never writes an API key value to logs", () => {
    const previous = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = "sk-log-secret";
    const log = jest.spyOn(console, "log").mockImplementation(() => undefined);
    try {
      expect(getServerSideConfig().apiKey).toBe("sk-log-secret");
      expect(JSON.stringify(log.mock.calls)).not.toContain("sk-log-secret");
    } finally {
      log.mockRestore();
      if (previous === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = previous;
    }
  });

  it("enables Tencent only when both signing credentials are configured", () => {
    const previous = {
      apiKey: process.env.TENCENT_API_KEY,
      secretId: process.env.TENCENT_SECRET_ID,
      secretKey: process.env.TENCENT_SECRET_KEY,
    };
    process.env.TENCENT_API_KEY = "legacy-key";
    process.env.TENCENT_SECRET_ID = "secret-id";
    process.env.TENCENT_SECRET_KEY = "secret-key";
    try {
      expect(getServerSideConfig().isTencent).toBe(true);
      delete process.env.TENCENT_SECRET_KEY;
      expect(getServerSideConfig().isTencent).toBe(false);
    } finally {
      for (const [key, value] of Object.entries({
        TENCENT_API_KEY: previous.apiKey,
        TENCENT_SECRET_ID: previous.secretId,
        TENCENT_SECRET_KEY: previous.secretKey,
      })) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });
});
