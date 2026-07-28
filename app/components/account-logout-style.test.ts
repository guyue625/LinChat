import fs from "node:fs";
import path from "node:path";

const componentSource = fs.readFileSync(
  path.join(process.cwd(), "app/components/account-context.tsx"),
  "utf8",
);
const styleSource = fs.readFileSync(
  path.join(process.cwd(), "app/components/account-context.module.scss"),
  "utf8",
);

describe("account logout overlay", () => {
  test("uses a compact status mark and progress treatment", () => {
    expect(componentSource).toContain("<LogOut");
    expect(componentSource).toContain("styles.logoutMark");
    expect(componentSource).toContain("styles.logoutIcon");
    expect(componentSource).toContain("styles.logoutProgress");
    expect(componentSource).not.toContain("styles.logoutSpinner");
  });

  test("derives the overlay and card colors from app theme tokens", () => {
    expect(styleSource).toContain("var(--gray)");
    expect(styleSource).toContain("var(--white)");
    expect(styleSource).toContain("var(--black)");
    expect(styleSource).toContain("background: var(--cta-bg);");
    expect(styleSource).toContain("color: var(--cta-fg);");
    expect(styleSource).not.toContain("#0b1624");
    expect(styleSource).not.toContain("#67e8f9");
  });

  test("respects reduced motion for every logout animation", () => {
    const reducedMotion = styleSource.slice(
      styleSource.indexOf("@media (prefers-reduced-motion: reduce)"),
    );
    expect(reducedMotion).toContain(".logoutCard");
    expect(reducedMotion).toContain(".logoutMark");
    expect(reducedMotion).toContain(".logoutProgress::after");
  });
});
