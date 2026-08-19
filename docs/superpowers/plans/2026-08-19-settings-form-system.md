# Settings Form System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a compact, consistently aligned form-control system scoped to the LinChat settings page.

**Architecture:** Keep business components and persistence unchanged. Define the control geometry and states inside the existing settings CSS boundary, then let focused component modules consume the same visual tokens.

**Tech Stack:** Next.js 14, React 18, TypeScript, Sass modules, Jest

---

### Task 1: Lock the form geometry with regression tests

**Files:**
- Modify: `app/components/settings-style.test.ts`

- [ ] Add assertions for the `38px` control height, `320px` field width, `440px` control slot, `6px` radius, left-aligned text and mobile full-width fallback.
- [ ] Run `yarn jest app/components/settings-style.test.ts --runInBand` and confirm the new assertions fail because the tokens and geometry are absent.

### Task 2: Add the settings-scoped form tokens and alignment slot

**Files:**
- Modify: `app/components/settings.module.scss`
- Modify: `app/components/settings-controls.module.scss`

- [ ] Add settings-scoped tokens for field height, field width, control-slot width, radius and focus ring.
- [ ] Make `.row-control` a `440px`-wide alignment slot on desktop and full width below `600px`.
- [ ] Normalize text inputs, password inputs, number inputs, selects and textareas without changing global styles.
- [ ] Run the style regression test and confirm the geometry assertions pass.

### Task 3: Refine the range, switch and action controls

**Files:**
- Modify: `app/components/input-range.module.scss`
- Modify: `app/components/settings-controls.module.scss`
- Modify: `app/components/provider-config-editor.module.scss`
- Test: `app/components/input-range.test.tsx`
- Test: `app/components/settings-controls.test.tsx`

- [ ] Add failing style assertions for the compact range track, circular thumb, 38px switch hit area and consistent action-button height.
- [ ] Run the focused tests and confirm the assertions fail for the missing visual rules.
- [ ] Implement the compact range, switch and action states using the settings tokens.
- [ ] Run the focused tests and confirm they pass.

### Task 4: Verify themes and responsive behavior

**Files:**
- Modify if needed: `app/components/settings.module.scss`
- Modify if needed: `app/components/input-range.module.scss`

- [ ] Run `yarn jest app/components/settings-style.test.ts app/components/input-range.test.tsx app/components/settings-controls.test.tsx --runInBand`.
- [ ] Run `yarn tsc --noEmit --incremental false` and focused ESLint/Prettier checks.
- [ ] Verify desktop controls share one right edge in light and dark themes.
- [ ] Verify at `390px` that controls fill available width and the page has no horizontal overflow.

Git commit steps are intentionally omitted because this repository requires Git writes to be performed by the user.
