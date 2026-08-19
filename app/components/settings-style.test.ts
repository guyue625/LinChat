import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(
  path.join(process.cwd(), "app/components/settings.module.scss"),
  "utf8",
);
const controlsSource = fs.readFileSync(
  path.join(process.cwd(), "app/components/settings-controls.module.scss"),
  "utf8",
);
const inputRangeSource = fs.readFileSync(
  path.join(process.cwd(), "app/components/input-range.module.scss"),
  "utf8",
);
const providerEditorSource = fs.readFileSync(
  path.join(process.cwd(), "app/components/provider-config-editor.module.scss"),
  "utf8",
);

describe("LinChat settings workbench styles", () => {
  it("keeps the isolated LinChat settings theme tokens", () => {
    expect(source).toContain("--settings-accent: #f43d3f");
    expect(source).toContain("--settings-status: #4e8cff");
    expect(source).toContain("--settings-cream: #f3ede2");
    expect(source).toContain(":global(.dark) .settings-page");
  });

  it("keeps the content width and responsive safety rules", () => {
    expect(source).toContain("max-width: 1000px");
    expect(source).toMatch(/max-width:\s*900px/);
    expect(source).toMatch(/max-width:\s*600px/);
    expect(source).toContain("env(safe-area-inset-bottom)");
    expect(source).toContain("prefers-reduced-motion: reduce");
  });

  it("does not make the settings subnav wider than its viewport", () => {
    expect(controlsSource).toMatch(
      /\.subnav-list\s*{[^}]*box-sizing:\s*border-box/s,
    );
  });

  it("does not use the input range width as a vertical flex basis", () => {
    expect(inputRangeSource).toMatch(/\.input-range\s*{[^}]*flex:\s*0 0 auto/s);
    expect(inputRangeSource).not.toContain("flex: 0 1 440px");
  });

  it("defines one compact geometry for settings form controls", () => {
    expect(source).toContain("--settings-field-height: 38px");
    expect(source).toContain("--settings-field-width: 320px");
    expect(source).toContain("--settings-control-slot-width: 440px");
    expect(source).toContain("--settings-control-radius: 6px");
    expect(source).toContain("text-align: left");
  });

  it("aligns desktop controls in one fixed slot with a mobile fallback", () => {
    expect(controlsSource).toMatch(
      /\.row-control\s*{[^}]*width:\s*min\(100%, var\(--settings-control-slot-width\)\)[^}]*justify-self:\s*end/s,
    );
    expect(controlsSource).toMatch(
      /@media only screen and \(max-width: 600px\)[\s\S]*\.row-control\s*{[^}]*width:\s*100%[^}]*max-width:\s*none/s,
    );
  });

  it("uses a compact circular range control", () => {
    expect(inputRangeSource).toContain(
      "width: min(100%, var(--settings-control-slot-width))",
    );
    expect(inputRangeSource).toContain(
      ".range-input::-webkit-slider-runnable-track",
    );
    expect(inputRangeSource).toMatch(
      /\.range-input::-webkit-slider-thumb\s*{[^}]*border-radius:\s*50%/s,
    );
  });

  it("keeps switches and provider actions on the same height rhythm", () => {
    expect(controlsSource).toMatch(
      /\.setting-switch\s*{[^}]*min-height:\s*var\(--settings-field-height\)/s,
    );
    expect(providerEditorSource).toMatch(
      /\.test-button,[\s\S]*?\.save-button\s*{[^}]*min-height:\s*var\(--settings-field-height\)/s,
    );
  });

  it("normalizes buttons rendered inside setting rows", () => {
    expect(controlsSource).toMatch(
      /\.row-control\s*{[\s\S]*?>\s*button\s*{[^}]*height:\s*var\(--settings-field-height\)[^}]*padding:\s*0 12px[^}]*border-radius:\s*var\(--settings-control-radius\)/s,
    );
  });
});
