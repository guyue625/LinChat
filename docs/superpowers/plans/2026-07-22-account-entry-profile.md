# Account Entry and Profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a discoverable sidebar login/account menu, login-required chat sending, safe return navigation, and a self-service profile page.

**Architecture:** Centralize browser account state in a React context backed by `/api/account/session`. Keep authorization authoritative on the server, add a self-only profile endpoint, and use small pure helpers for login redirects, display names, avatar fallbacks, and send gating so behavior is testable without rendering the full application.

**Tech Stack:** Next.js 14 App Router APIs, React 18, React Router hash routes, TypeScript, SCSS modules, Jest.

---

### Task 1: Self-service profile domain and API

**Files:**
- Modify: `app/lib/account-auth.ts`
- Create: `app/api/account/profile/route.ts`
- Modify: `test/account-auth.test.ts`
- Create: `test/account-profile-route-config.test.ts`

- [ ] **Step 1: Write failing domain tests**

Add tests proving `updateOwnProfile(userId, { displayName, avatar })` changes only the current user's public fields, writes `USER_PROFILE_UPDATED`, rejects an empty/overlong display name or invalid avatar, and exposes no role/disabled mutation.

- [ ] **Step 2: Run tests and verify RED**

Run: `node --no-warnings ./node_modules/jest/bin/jest.js test/account-auth.test.ts --runInBand`

Expected: FAIL because `updateOwnProfile` does not exist.

- [ ] **Step 3: Implement the minimal domain method and route**

Add:

```ts
async updateOwnProfile(
  userId: string,
  input: { displayName?: string; avatar?: string },
) {
  // validate, mutate only displayName/avatar, audit, persist, return publicUser
}
```

Create dynamic Node route with authenticated `GET` and `PATCH`; read only `displayName` and `avatar` from the request body.

- [ ] **Step 4: Run tests and verify GREEN**

Run the focused domain and route-config tests; expect all to pass.

### Task 2: Account browser state and pure interaction helpers

**Files:**
- Create: `app/components/account-context.tsx`
- Create: `app/components/account-utils.ts`
- Create: `test/account-ui-utils.test.ts`

- [ ] **Step 1: Write failing helper tests**

Cover:

```ts
shouldRequireLogin({ enabled: true, user: null }) === true
shouldRequireLogin({ enabled: false, user: null }) === false
safeReturnPath("/chat") === "/chat"
safeReturnPath("https://evil.example") === Path.Chat
accountDisplayName({ displayName: "", username: "alice" }) === "alice"
accountInitial("alice") === "A"
```

- [ ] **Step 2: Run tests and verify RED**

Expected: FAIL because helpers do not exist.

- [ ] **Step 3: Implement helpers and provider**

Provider state:

```ts
type AccountState = {
  enabled: boolean;
  loading: boolean;
  user: AccountPublicUser | null;
  refresh(): Promise<AccountPublicUser | null>;
  logout(): Promise<void>;
};
```

`refresh` fetches `/api/account/session` with same-origin credentials; `logout` calls `/api/account/logout` and refreshes local state.

- [ ] **Step 4: Run helper tests and verify GREEN**

### Task 3: Routing, login return, and profile page

**Files:**
- Modify: `app/constant.ts`
- Modify: `app/components/home.tsx`
- Modify: `app/components/auth.tsx`
- Create: `app/components/profile.tsx`
- Create: `app/components/profile.module.scss`

- [ ] **Step 1: Add route/config tests that fail**

Extend helper tests for encoded `returnTo`, and add source configuration assertions for `Path.Profile` and the profile route.

- [ ] **Step 2: Verify RED**

- [ ] **Step 3: Implement routing and profile UI**

- Wrap the screen in `AccountProvider`.
- Remove the current global anonymous redirect from `Screen`; only profile/admin remain protected.
- Add `Path.Profile = "/profile"` and route it to `ProfilePage`.
- Login success calls `refresh()` and navigates to the validated `returnTo` value.
- Profile form PATCHes `/api/account/profile`, displays username/role read-only, and refreshes context on success.

- [ ] **Step 4: Verify GREEN**

### Task 4: Sidebar account dock and menu

**Files:**
- Modify: `app/components/sidebar.tsx`
- Modify: `app/components/home.module.scss`
- Modify: `test/account-ui-utils.test.ts`

- [ ] **Step 1: Add failing menu-model tests**

Prove anonymous state yields a login action; normal user gets profile/logout; admin additionally gets admin management.

- [ ] **Step 2: Verify RED**

- [ ] **Step 3: Implement account dock**

- Render it above the existing settings/theme tail in both normal and assistant sidebars.
- Anonymous click navigates to `Path.Auth` with `returnTo` equal to the current route.
- Authenticated click opens an accessible menu with profile, optional admin, and logout.
- Close on outside pointer/Escape; narrow mode renders avatar only; mobile styles anchor the menu above the dock.

- [ ] **Step 4: Verify GREEN**

### Task 5: Login-required message sending

**Files:**
- Create: `app/components/account-login-guard.ts`
- Modify: `app/components/chat.tsx`
- Modify: `test/account-ui-utils.test.ts`

- [ ] **Step 1: Write failing guard tests**

Test that an enabled anonymous account returns `false`, triggers the login prompt callback, and never invokes the send callback; disabled auth or logged-in users invoke send normally.

- [ ] **Step 2: Verify RED**

- [ ] **Step 3: Implement and integrate guard**

Implement:

```ts
export async function runWithAccountLogin(
  account: AccountSnapshot,
  onRequireLogin: () => Promise<void> | void,
  action: () => Promise<void> | void,
) { /* guard before action */ }
```

Wrap both text send paths in `chat.tsx` before `chatStore.onUserInput`. The prompt uses the existing confirmation UI and navigates to login only when confirmed.

- [ ] **Step 4: Verify GREEN and regression behavior**

### Task 6: End-to-end verification

**Files:**
- Modify tests only if a genuine defect is reproduced first.

- [ ] Run account-focused Jest suites.
- [ ] Run `.\node_modules\.bin\tsc.cmd --noEmit`.
- [ ] Run `git diff --check`.
- [ ] Build with `$env:NODE_OPTIONS='--openssl-legacy-provider'; npm run build`.
- [ ] Start the production server with temporary account data and verify anonymous browsing, send guard helpers, login/session, profile GET/PATCH, logout, and admin access over HTTP.
- [ ] Confirm no commit or staging was created.
