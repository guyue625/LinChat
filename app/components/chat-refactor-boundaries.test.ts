import fs from "node:fs";
import path from "node:path";

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("chat module boundaries", () => {
  test("keeps the shared composer outside the chat page module", () => {
    const chatSource = read("app/components/chat.tsx");
    const workspaceSource = read("app/components/workspace-home.tsx");
    const toolbarSource = read("app/components/chat/composer-toolbar.tsx");
    const composerModules = [
      "app/components/chat/composer-controls.tsx",
      "app/components/chat/model-selector.tsx",
      "app/components/chat/composer-more-menu.tsx",
    ];

    expect(
      fs.existsSync(
        path.join(process.cwd(), "app/components/chat/composer.tsx"),
      ),
    ).toBe(true);
    composerModules.forEach((modulePath) => {
      expect(fs.existsSync(path.join(process.cwd(), modulePath))).toBe(true);
    });
    expect(chatSource).toContain('from "./chat/composer"');
    expect(workspaceSource).toContain('from "./chat/composer"');
    expect(workspaceSource).not.toContain('from "./chat"');
    expect(workspaceSource).not.toContain("setUnusedModal");
    expect(toolbarSource).toContain('from "./model-selector"');
    expect(toolbarSource).toContain('from "./composer-more-menu"');
  });

  test("separates message rendering and stateful page hooks", () => {
    const chatSource = read("app/components/chat.tsx");
    const expectedModules = [
      "app/components/chat/message-row.tsx",
      "app/components/chat/use-chat-scroll.ts",
      "app/components/chat/use-chat-draft.ts",
    ];

    expectedModules.forEach((modulePath) => {
      expect(fs.existsSync(path.join(process.cwd(), modulePath))).toBe(true);
    });
    expect(chatSource).toContain('from "./chat/message-row"');
    expect(chatSource).toContain('from "./chat/use-chat-scroll"');
    expect(chatSource).toContain('from "./chat/use-chat-draft"');
  });
});
