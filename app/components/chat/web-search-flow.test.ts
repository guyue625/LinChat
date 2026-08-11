import fs from "node:fs";
import path from "node:path";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("web search chat flow", () => {
  test("waits for the home-page send before navigating to chat", () => {
    const source = read("app/components/workspace-home.tsx");
    const sendIndex = source.indexOf(
      '.onUserInput(message?.trim() ?? "", attachImages)',
    );
    const navigateIndex = source.indexOf("navigate(Path.Chat)");

    expect(sendIndex).toBeGreaterThan(-1);
    expect(navigateIndex).toBeGreaterThan(sendIndex);
  });

  test("guards home-page chat creation and restores state on failure", () => {
    const source = read("app/components/workspace-home.tsx");

    expect(source).toContain(
      "const [startingChat, setStartingChat] = useState(false)",
    );
    expect(source).toContain("if (startingChatRef.current) return;");
    expect(source).toContain("sendDisabled={");
    expect(source).toContain("startingChat ||");
    expect(source).toContain("disabled={startingChat || !hasConfiguredModel}");
    expect(source).toContain("useChatStore.setState(previousChatState)");
    expect(source).toContain("setStartingChat(false)");
  });

  test("disables chat sending while the search preflight is loading", () => {
    const source = read("app/components/chat.tsx");

    expect(source).toContain("sendDisabled={isLoading || !hasConfiguredModel}");
    expect(source).toContain("if (isLoading) return;");
  });

  test("restores resent messages when search preflight fails", () => {
    const source = read("app/components/chat.tsx");

    expect(source).toContain(
      "const messagesBeforeResend = session.messages.slice()",
    );
    expect(source).toContain("target.messages = messagesBeforeResend");
  });
});
