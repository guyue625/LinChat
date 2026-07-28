import fs from "node:fs";
import path from "node:path";

const markdownSource = fs.readFileSync(
  path.join(process.cwd(), "app/components/markdown.tsx"),
  "utf8",
);
const styleSource = fs.readFileSync(
  path.join(process.cwd(), "app/styles/markdown.scss"),
  "utf8",
);
const highlightSource = fs.readFileSync(
  path.join(process.cwd(), "app/styles/highlight.scss"),
  "utf8",
);

describe("markdown code blocks", () => {
  test("uses a dedicated block with an accessible icon toolbar", () => {
    expect(markdownSource).toContain('className="code-block"');
    expect(markdownSource).toContain("Terminal as TerminalIcon");
    expect(markdownSource).toContain('className="code-language-label"');
    expect(markdownSource).toContain('className="code-actions"');
    expect(markdownSource).toContain(
      'className="code-tool-button copy-code-button"',
    );
    expect(markdownSource).toContain("aria-label={copyLabel}");
    expect(markdownSource).toContain('className="code-block-pre"');
  });

  test("places long-code disclosure in the header", () => {
    const headerIndex = markdownSource.indexOf('className="code-header"');
    const actionsIndex = markdownSource.indexOf('className="code-actions"');
    const foldIndex = markdownSource.indexOf(
      'className="code-tool-button code-fold-button"',
    );
    const preIndex = markdownSource.indexOf('className="code-block-pre"');

    expect(headerIndex).toBeGreaterThanOrEqual(0);
    expect(actionsIndex).toBeGreaterThan(headerIndex);
    expect(foldIndex).toBeGreaterThan(actionsIndex);
    expect(preIndex).toBeGreaterThan(foldIndex);
    expect(markdownSource).not.toContain('className="code-fold-footer"');
    expect(markdownSource).toContain("aria-expanded={!collapsed}");
    expect(markdownSource).toContain("aria-label={foldLabel}");
    expect(markdownSource).toContain("const CODE_FOLD_HEIGHT = 360");
  });

  test("defines compact theme-aware code surfaces", () => {
    expect(styleSource).toContain("--color-code-canvas: #f7f7f8");
    expect(styleSource).toContain("--color-code-canvas: #171719");
    expect(styleSource).toContain(".markdown-body .code-block");
    expect(styleSource).toContain(".markdown-body .code-actions");
    expect(styleSource).toContain(".markdown-body .code-tool-button");
    expect(styleSource).toContain("max-height: 360px");
    expect(styleSource).toContain("border-radius: 8px");
    expect(styleSource).not.toContain(".markdown-body .code-fold-footer");
    expect(styleSource).not.toContain("--color-code-footer");
  });

  test("uses separate light and dark syntax palettes without a fixed dark canvas", () => {
    expect(styleSource).toContain("--color-code-syntax-comment: #6a737d");
    expect(styleSource).toContain("--color-code-syntax-comment: #565f89");
    expect(highlightSource).toContain("background: transparent");
    expect(highlightSource).toContain("var(--color-code-syntax-comment)");
    expect(highlightSource).toContain("var(--color-code-syntax-keyword)");
    expect(highlightSource).not.toContain("background: #141416");
  });
});
