# Account Administration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the account system with a secure administrator console for invitations, users, resets, roles, statistics, deletion, and audit history.

**Architecture:** Extend the existing JSON-backed `AccountAuthService` with admin-only domain operations and append-only audit records. Expose a small set of session-authorized Next.js route handlers, then add a dedicated React admin page under `/#/admin`; no user API keys or chat content are queried or returned.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, Node crypto/fs, SCSS modules, Jest.

---

### Task 1: Extend account domain models and admin operations

**Files:**
- Modify: `app/lib/account-auth.ts`
- Test: `test/account-admin.test.ts`

- [ ] Write failing tests that require `listAdminDashboard`, `createAdminInvitation`, `setUserDisabled`, `updateUserProfile`, `setUserRole`, `createPasswordReset`, `resetPassword`, and `deleteUser`.
- [ ] Verify tests fail because the admin operations do not exist.
- [ ] Add `displayName`, `avatar`, `resetTokens`, and `auditLogs` record types with backward-compatible defaults.
- [ ] Implement role checks and protect the last enabled administrator from demotion, disabling, or deletion.
- [ ] Return only safe user fields, invitation hints, aggregate statistics, and audit entries; never return password hashes, session tokens, API keys, or chat data.
- [ ] Generate invitation and password-reset secrets with `randomBytes`, store only scrypt hashes, and return plaintext once at creation.
- [ ] Re-run the domain tests and existing login tests until green.

### Task 2: Add authenticated administrator APIs

**Files:**
- Create: `app/api/account/admin/_shared.ts`
- Create: `app/api/account/admin/dashboard/route.ts`
- Create: `app/api/account/admin/invitations/route.ts`
- Create: `app/api/account/admin/invitations/[id]/route.ts`
- Create: `app/api/account/admin/users/[id]/route.ts`
- Create: `app/api/account/admin/users/[id]/reset/route.ts`
- Create: `app/api/account/reset/route.ts`
- Modify: `app/api/account/_shared.ts`
- Test: `test/account-admin-route-helpers.test.ts`

- [ ] Write failing tests for administrator-session enforcement and safe JSON error mapping.
- [ ] Verify the route helper tests fail for missing helpers.
- [ ] Resolve the HttpOnly session, reject anonymous/non-admin callers with 401/403, and pass the administrator ID into service methods.
- [ ] Implement dashboard GET, invitation POST/PATCH, user PATCH/DELETE, reset-token POST, and public reset consumption POST.
- [ ] Re-run route helper and domain tests until green.

### Task 3: Build the administrator console

**Files:**
- Create: `app/components/admin.tsx`
- Create: `app/components/admin.module.scss`
- Modify: `app/components/home.tsx`
- Modify: `app/components/sidebar.tsx`
- Modify: `app/constant.ts`

- [ ] Add `Path.Admin` and render `AdminPage` full width.
- [ ] Add an administrator-only sidebar entry discovered from `/api/account/session`.
- [ ] Build overview cards for user/session/invitation/database totals.
- [ ] Build invitation creation, expiry/use-count controls, one-time code reveal/copy, list, and revoke/restore controls.
- [ ] Build user search/list with registration time, last login, status, profile editing, role assignment, disable/restore, one-time reset-token generation, and typed-name delete confirmation.
- [ ] Build audit history with action, actor, target, timestamp, and result metadata.
- [ ] Handle loading, empty, error, mobile, dark-theme, and reduced-motion states.

### Task 4: Finish deployment and verification

**Files:**
- Modify: `.env.template`
- Modify: `Dockerfile` only if runtime configuration changes
- Create: `.Codex/changelogs/2026-07-22_complete-account-admin.md`

- [ ] Run `git diff --check`.
- [ ] Run focused account tests and the full Jest suite in CI mode.
- [ ] Run `tsc --noEmit`.
- [ ] Run the production build with the repository's OpenSSL compatibility option.
- [ ] Inspect the final diff against every requested permission and record remaining risks, if any.
- [ ] Do not commit; leave the verified working tree for user review.
