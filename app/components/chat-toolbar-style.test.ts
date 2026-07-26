import fs from "node:fs";
import path from "node:path";

const chatSource = fs.readFileSync(
  path.join(process.cwd(), "app/components/chat.tsx"),
  "utf8",
);
const styleSource = fs.readFileSync(
  path.join(process.cwd(), "app/components/chat.module.scss"),
  "utf8",
);

function getRuleBody(selector: string) {
  const selectorStart = styleSource.indexOf(`${selector} {`);
  expect(selectorStart).toBeGreaterThanOrEqual(0);

  const bodyStart = styleSource.indexOf("{", selectorStart);
  const bodyEnd = styleSource.indexOf("}", bodyStart);
  return styleSource.slice(bodyStart + 1, bodyEnd);
}

describe("chat message action toolbar styles", () => {
  test("uses a dedicated inner toolbar class instead of composer layout styles", () => {
    expect(chatSource).toContain('styles["chat-message-action-buttons"]');
  });

  test("keeps the message toolbar content-sized", () => {
    const rule = getRuleBody(".chat-message-action-buttons");

    expect(rule).toMatch(/display:\s*inline-flex/);
    expect(rule).toMatch(/width:\s*max-content/);
    expect(rule).toMatch(/flex:\s*0\s+0\s+auto/);
    expect(rule).toMatch(/justify-content:\s*flex-start/);
  });

  test("centers every action icon inside a fixed-size button", () => {
    const buttonRule = getRuleBody(".chat-message-action-button");
    const iconRule = getRuleBody(".chat-message-action-button .icon");

    expect(buttonRule).toMatch(/display:\s*inline-flex/);
    expect(buttonRule).toMatch(/align-items:\s*center/);
    expect(buttonRule).toMatch(/justify-content:\s*center/);
    expect(iconRule).toMatch(/display:\s*inline-flex/);
    expect(iconRule).toMatch(/align-items:\s*center/);
    expect(iconRule).toMatch(/justify-content:\s*center/);
  });

  test("does not turn low-opacity SVG helper paths opaque", () => {
    const toolbarStart = styleSource.indexOf(".chat-message-action-buttons");
    const toolbarEnd = styleSource.indexOf(
      ".chat-message > .chat-message-container:hover",
      toolbarStart,
    );
    const toolbarRules = styleSource.slice(toolbarStart, toolbarEnd);

    expect(toolbarRules).not.toMatch(/\n\s*fill-opacity\s*:/);
  });
});
