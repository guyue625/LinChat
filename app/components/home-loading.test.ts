import fs from "node:fs";
import path from "node:path";

const homeSource = fs.readFileSync(
  path.join(process.cwd(), "app/components/home.tsx"),
  "utf8",
);
const layoutSource = fs.readFileSync(
  path.join(process.cwd(), "app/layout.tsx"),
  "utf8",
);
const constantSource = fs.readFileSync(
  path.join(process.cwd(), "app/constant.ts"),
  "utf8",
);
const styleSource = fs.readFileSync(
  path.join(process.cwd(), "app/components/home.module.scss"),
  "utf8",
);
const loadingStyles = styleSource.slice(
  styleSource.indexOf("/* Minimal initial loader"),
  styleSource.indexOf(".rtl-screen"),
);

describe("home loading screen", () => {
  test("renders only the brand mark, status, and loading dots", () => {
    expect(homeSource).toContain('styles["loading-logo"]');
    expect(homeSource).toContain('styles["loading-brand"]');
    expect(homeSource).toContain("Synchronizing workspace");
    expect(homeSource).toContain("<LoadingDots />");
    expect(homeSource).not.toContain('styles["loading-grid"]');
    expect(homeSource).not.toContain('styles["loading-kicker"]');
    expect(homeSource).not.toContain('styles["loading-signal"]');
    expect(homeSource).not.toContain('styles["loading-core"]');
    expect(homeSource).not.toContain('styles["loading-logo-shell"]');
    expect(homeSource).not.toContain('styles["loading-core-ring"]');
    expect(homeSource).not.toContain('styles["loading-core-scan"]');
    expect(homeSource).not.toContain("BOOT SEQUENCE");
  });

  test("keeps the loading screen visible in preview mode", () => {
    expect(homeSource).toContain('searchParams.get("loading-preview") === "1"');
    expect(homeSource).toContain("isLoadingPreview || !hasHydrated");
  });

  test("restores the persisted theme before the loading screen is painted", () => {
    expect(constantSource).toContain(
      'export const THEME_STORAGE_KEY = "app-theme"',
    );
    expect(layoutSource).toContain("suppressHydrationWarning");
    expect(layoutSource).toContain("window.localStorage.getItem");

    const themeScriptIndex = layoutSource.indexOf("dangerouslySetInnerHTML");
    const childrenIndex = layoutSource.indexOf("{children}");
    expect(themeScriptIndex).toBeGreaterThanOrEqual(0);
    expect(childrenIndex).toBeGreaterThan(themeScriptIndex);

    expect(homeSource).toContain("useAppConfig((state) => state._hasHydrated)");
    expect(homeSource).toContain("if (!hasHydrated) return;");
    expect(homeSource).toContain(
      "safeLocalStorage().setItem(THEME_STORAGE_KEY, theme)",
    );
  });

  test("supports explicit and system light themes", () => {
    expect(styleSource).toContain("@mixin loading-light-theme");
    expect(styleSource).toContain("@media (prefers-color-scheme: light)");
    expect(styleSource).toContain(":global(body:not(.dark))");
    expect(styleSource).toContain(":global(.light)");
    expect(loadingStyles).toContain("--loading-bg: #101012;");
    expect(loadingStyles).toContain("--loading-bg: #f7f7f8;");

    const minimalLightTheme = loadingStyles.slice(
      loadingStyles.indexOf("@mixin loading-minimal-light-theme"),
      loadingStyles.indexOf("@media (prefers-color-scheme: light)"),
    );
    expect(minimalLightTheme).toContain(".loading-content-full .loading-stage");
    expect(minimalLightTheme).toContain("border: 0;");
    expect(minimalLightTheme).toContain("background: transparent;");
    expect(minimalLightTheme).toContain("box-shadow: none;");
  });

  test("uses a solid surface with restrained motion", () => {
    expect(loadingStyles).toContain("background: var(--loading-bg);");
    expect(loadingStyles).toContain("@keyframes loading-logo-breathe");
    expect(loadingStyles).toContain("@keyframes loading-dot-pulse");
    expect(loadingStyles).not.toContain("gradient(");
    expect(loadingStyles).not.toContain("loading-grid");
    expect(loadingStyles).not.toContain("loading-core-ring");
    expect(loadingStyles).not.toContain("loading-core-spin");

    const reducedMotionStart = loadingStyles.indexOf(
      "@media (prefers-reduced-motion: reduce)",
    );
    expect(reducedMotionStart).toBeGreaterThanOrEqual(0);

    const reducedMotionRules = loadingStyles.slice(reducedMotionStart);
    expect(reducedMotionRules).toContain(".loading-logo");
    expect(reducedMotionRules).toContain(".loading-dots span");
  });
});
