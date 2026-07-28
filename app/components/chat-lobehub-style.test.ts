import fs from "node:fs";
import path from "node:path";

const chatSource = fs.readFileSync(
  path.join(process.cwd(), "app/components/chat.tsx"),
  "utf8",
);
const messageRowSource = fs.readFileSync(
  path.join(process.cwd(), "app/components/chat/message-row.tsx"),
  "utf8",
);
const styleSource = fs.readFileSync(
  path.join(process.cwd(), "app/components/chat.module.scss"),
  "utf8",
);
const lobeStyleSource = styleSource.slice(
  styleSource.indexOf("/* LobeHub-inspired chat surface"),
);

describe("LobeHub-inspired chat surface", () => {
  test("routes assistant progress through the compact activity component", () => {
    expect(chatSource).toContain('from "./chat/message-row"');
    expect(messageRowSource).toContain(
      'import { ChatActivity } from "../chat-activity"',
    );
    expect(messageRowSource).toContain("<ChatActivity");
    expect(messageRowSource).not.toContain('styles["chat-message-tools"]');
  });

  test("defines a continuous reading canvas with compact user bubbles", () => {
    expect(styleSource).toContain("--chat-reading-width: 1120px");
    expect(styleSource).toContain(
      "width: min(var(--chat-reading-width), calc(100% - 40px));",
    );
    expect(styleSource).toContain("max-width: min(680px, 72%)");
    expect(styleSource).toContain("border-radius: 16px 16px 4px 16px");
  });

  test("styles assistant activity and keeps code blocks theme-aware inside chat", () => {
    expect(styleSource).toContain(".chat-activity-summary");
    expect(styleSource).toContain(".chat-activity-thinking");
    expect(styleSource).toContain(":global(.markdown-body .code-block-pre)");
    expect(styleSource).not.toContain("background: #141416");
    expect(styleSource).not.toContain(".chat-message-status");
    expect(styleSource).not.toContain(".chat-message-tools");
  });

  test("aligns assistant content to the reading edge without an avatar background", () => {
    expect(lobeStyleSource).toContain("--chat-content-indent: 0px");
    expect(lobeStyleSource).not.toMatch(/--chat-content-indent:\s*[1-9]/);
    expect(lobeStyleSource).toMatch(
      /\.chat-message-avatar\s*\{[\s\S]*?background:\s*transparent;/,
    );
    expect(lobeStyleSource).toMatch(
      /\.chat-message-avatar :global\(\.user-avatar\)\s*\{[\s\S]*?border-color:\s*transparent;[\s\S]*?background:\s*transparent;[\s\S]*?box-shadow:\s*none;/,
    );
  });

  test("keeps user message bubbles aligned to the right", () => {
    expect(lobeStyleSource).toMatch(
      /\.chat-message-user\s*\{[\s\S]*?display:\s*flex;[\s\S]*?flex-direction:\s*row;[\s\S]*?justify-content:\s*flex-end;/,
    );
  });

  test("hides the preset prompt badge while keeping the settings modal", () => {
    expect(chatSource).not.toContain("function PromptToast");
    expect(chatSource).not.toContain('styles["prompt-toast"]');
    expect(styleSource).not.toContain(".prompt-toast");
    expect(chatSource).toContain("showPromptModal && (");
    expect(chatSource).toContain(
      "<SessionConfigModel onClose={() => setShowPromptModal(false)} />",
    );
  });
});
