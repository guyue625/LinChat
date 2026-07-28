# Loading Light Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a cool-white technical light theme to the full-screen loading sequence while preserving the current dark theme and animations.

**Architecture:** Keep the existing React structure and dark SCSS as the baseline. Add one SCSS mixin containing light-only surface overrides, apply it to explicit `.light` ancestors, and use `prefers-color-scheme: light` only while `body.dark` is absent so explicit app theme state wins.

**Tech Stack:** React 18, Next.js 14, Sass modules, Jest source regression tests, Prettier, Next ESLint

---

### Task 1: Lock Theme Resolution With a Failing Test

**Files:**

- Modify: `app/components/home-loading.test.ts`
- Test: `app/components/home-loading.test.ts`

- [ ] **Step 1: Write the failing regression test**

Add this test inside the existing `describe("home loading screen", ...)` block:

```ts
test("supports explicit and system light themes", () => {
  expect(styleSource).toContain("@mixin loading-light-theme");
  expect(styleSource).toContain("@media (prefers-color-scheme: light)");
  expect(styleSource).toContain(":global(body:not(.dark))");
  expect(styleSource).toContain(":global(.light)");
});
```

- [ ] **Step 2: Run the test and verify the expected failure**

Run:

```powershell
npx jest --ci app/components/home-loading.test.ts --runInBand
```

Expected: the new test fails because `@mixin loading-light-theme` is absent; the existing loading tests remain green.

- [ ] **Step 3: Commit the test checkpoint**

```powershell
git add app/components/home-loading.test.ts
git commit -m "test: cover loading light theme resolution"
```

### Task 2: Add the Cool-White Loading Palette

**Files:**

- Modify: `app/components/home.module.scss`
- Test: `app/components/home-loading.test.ts`

- [ ] **Step 1: Add the light-theme mixin**

Insert the following after `.loading-content-inline .loading-dots` and before the loading keyframes:

```scss
@mixin loading-light-theme {
  .loading-content {
    --loading-bg: #edf6f7;
    --loading-panel: rgba(250, 253, 253, 0.82);
    --loading-ink: #12343d;
    --loading-muted: #587985;
    --loading-cyan: #078fac;
    --loading-cyan-soft: rgba(7, 143, 172, 0.28);
    --loading-coral: #df654f;
    --loading-gold: #a7771d;
    --loading-green: #17835f;
    --loading-line: rgba(18, 80, 94, 0.18);
  }

  .loading-content-full {
    background: radial-gradient(
        ellipse 74% 42% at 50% -8%,
        rgba(13, 151, 178, 0.16),
        transparent 62%
      ), radial-gradient(
        ellipse 68% 38% at 48% 112%,
        rgba(223, 101, 79, 0.13),
        transparent 62%
      ), linear-gradient(180deg, #f9fcfc 0%, #eaf4f5 52%, #eef7f2 100%);
  }

  .loading-content-full::before {
    background: repeating-linear-gradient(
        90deg,
        rgba(7, 125, 151, 0.16) 0 1px,
        transparent 1px 74px
      ), repeating-linear-gradient(0deg, rgba(7, 125, 151, 0.11) 0 1px, transparent
          1px 62px);
    opacity: 0.5;
  }

  .loading-content-full::after {
    background: linear-gradient(
        180deg,
        rgba(255, 255, 255, 0.5),
        transparent 14%,
        transparent 86%,
        rgba(22, 72, 82, 0.12)
      ), repeating-linear-gradient(0deg, transparent 0 2px, rgba(
            20,
            67,
            78,
            0.12
          ) 2px 3px);
    opacity: 0.12;
    mix-blend-mode: multiply;
  }

  .loading-stage {
    background: radial-gradient(
        ellipse 92% 48% at 50% 0%,
        rgba(7, 143, 172, 0.13),
        transparent 68%
      ), linear-gradient(180deg, rgba(253, 255, 255, 0.9), rgba(234, 243, 244, 0.82));
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.92),
      inset 0 -34px 86px rgba(223, 101, 79, 0.06),
      0 0 0 1px rgba(7, 143, 172, 0.05),
      0 24px 72px rgba(29, 67, 76, 0.18),
      0 0 60px rgba(7, 143, 172, 0.09);
  }

  .loading-grid {
    background: linear-gradient(
        90deg,
        transparent,
        rgba(7, 143, 172, 0.12) 50%,
        transparent
      ), repeating-linear-gradient(
        90deg,
        rgba(7, 143, 172, 0.11) 0 1px,
        transparent 1px 42px
      ), repeating-linear-gradient(0deg, rgba(18, 52, 61, 0.06) 0 1px, transparent
          1px 34px);
  }

  .loading-core::before {
    background:
      linear-gradient(rgba(7, 125, 151, 0.32), rgba(7, 125, 151, 0.32)) 50% 0 / 1px
        100% no-repeat,
      linear-gradient(90deg, rgba(7, 125, 151, 0.32), rgba(7, 125, 151, 0.32)) 0
        50% / 100% 1px no-repeat;
  }

  .loading-core::after {
    border-color: rgba(167, 119, 29, 0.24);
    box-shadow: inset 0 0 32px rgba(7, 143, 172, 0.08);
  }

  .loading-logo-shell {
    border-color: rgba(18, 80, 94, 0.16);
    background: radial-gradient(
        ellipse 90% 80% at 50% 18%,
        rgba(7, 143, 172, 0.16),
        transparent 64%
      ), linear-gradient(145deg, rgba(255, 255, 255, 0.94), rgba(218, 234, 237, 0.8));
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.96),
      0 0 30px rgba(7, 143, 172, 0.16),
      0 16px 36px rgba(23, 62, 71, 0.2);
  }

  .loading-logo-shell::before {
    border-color: rgba(7, 143, 172, 0.28);
  }

  .loading-core-ring {
    border-color: rgba(7, 125, 151, 0.2);
  }

  .loading-brand {
    text-shadow: 0 0 22px rgba(7, 143, 172, 0.18);
  }

  .loading-signal > div {
    color: rgba(18, 52, 61, 0.62);
  }

  .loading-signal i {
    background: rgba(18, 80, 94, 0.12);
  }
}
```

- [ ] **Step 2: Apply explicit and pre-hydration theme resolution**

Place these rules immediately after the mixin:

```scss
@media (prefers-color-scheme: light) {
  :global(body:not(.dark)) {
    @include loading-light-theme;
  }
}

:global(.light) {
  @include loading-light-theme;
}
```

This keeps the existing dark declarations as the baseline. Explicit `.dark`
prevents the system-light fallback, while explicit `.light` wins on a dark OS.

- [ ] **Step 3: Run the focused regression suite**

```powershell
npx jest --ci app/components/home-loading.test.ts --runInBand
```

Expected: all loading tests pass.

- [ ] **Step 4: Format and verify SCSS compilation through lint**

```powershell
npx prettier --write app/components/home.module.scss app/components/home-loading.test.ts
npx prettier --check app/components/home.module.scss app/components/home-loading.test.ts
npx next lint
```

Expected: Prettier passes; lint exits 0 with only the repository's existing unrelated warnings.

- [ ] **Step 5: Commit the implementation**

```powershell
git add app/components/home.module.scss app/components/home-loading.test.ts
git commit -m "feat: add loading light theme"
```

### Task 3: Final Runtime Verification

**Files:**

- Verify: `app/components/home.module.scss`
- Verify: `app/components/home-loading.test.ts`

- [ ] **Step 1: Start the isolated development server**

```powershell
npx next dev -p 3000
```

Expected: Next.js reports `Ready` and serves port 3000. Do not run `next build`
while this development server is active because both commands write `.next`.

- [ ] **Step 2: Verify both themes through preview mode**

Open `http://localhost:3000/?loading-preview=1`, select light and dark themes in
the app configuration between reloads, and verify that the background, panel,
logo frame, telemetry labels, and grid all switch without layout movement.

- [ ] **Step 3: Confirm the final working tree scope**

```powershell
git diff --check
git status --short
```

Expected: no whitespace errors and no generated screenshot/browser-profile
artifacts.
