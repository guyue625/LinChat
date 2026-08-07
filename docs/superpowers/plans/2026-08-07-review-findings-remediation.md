# Review Findings Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the six confirmed review findings with focused regression coverage and no broad schema or UI redesign.

**Architecture:** Keep each fix inside its current ownership boundary. Add one stream-reading helper for sync input, extend the existing account repository transaction for deletion cleanup, serialize provider mutations at the server singleton boundary, and make client shutdown/home submission operate on captured state instead of mutable globals.

**Tech Stack:** Next.js 14 Route Handlers, React 18, TypeScript, Zustand, Node 22 `node:sqlite`, Jest, Testing Library.

---

## File Map

- `app/api/sync/read-body.ts`: bounded streaming request-body reader.
- `app/api/sync/read-body.test.ts`: byte-limit and cancellation coverage.
- `app/api/sync/route.ts`: maps the bounded-reader error to the existing 413 contract.
- `app/lib/web-search.ts` and `.test.ts`: Bocha title normalization.
- `app/lib/account-auth.ts`: repository write options and deletion call site.
- `app/lib/account-auth-sqlite.ts` and `.test.ts`: transaction-scoped snapshot cleanup.
- `app/lib/provider-config/server.ts`: process-local provider mutation queue.
- `app/api/account/admin/providers/[id]/route.ts` and `route.test.ts`: exclusive mutation scope and concurrency regression.
- `app/utils/account-cloud-sync.ts` and `.test.ts`: captured final push.
- `app/components/workspace-home.tsx` and `app/components/chat/web-search-flow.test.ts`: pending guard and failed-session rollback.

### Task 1: Bound Account Sync Request Bodies

**Files:**
- Create: `app/api/sync/read-body.ts`
- Create: `app/api/sync/read-body.test.ts`
- Modify: `app/api/sync/route.ts`

- [ ] **Step 1: Write the failing streaming-limit tests**

Cover a body split across chunks, an early `Content-Length` rejection, and a stream that records cancellation after crossing the limit:

```ts
await expect(readRequestBodyWithLimit(request, 5)).rejects.toBeInstanceOf(
  SyncPayloadTooLargeError,
);
expect(cancelled).toBe(true);
expect(pullCount).toBeLessThan(totalChunkCount);
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `yarn.cmd jest app/api/sync/read-body.test.ts --runInBand`

Expected: FAIL because `read-body.ts` does not exist.

- [ ] **Step 3: Implement the bounded reader**

Add `SyncPayloadTooLargeError` and:

```ts
export async function readRequestBodyWithLimit(
  request: Request,
  maxBytes: number,
): Promise<string>;
```

Reject a numeric `Content-Length` above the limit, then read `request.body.getReader()` chunk by chunk, count `Uint8Array.byteLength`, cancel on overflow, and decode only the accepted chunks.

- [ ] **Step 4: Integrate the route error mapping**

Replace `request.text()` with the helper and map `SyncPayloadTooLargeError` to HTTP 413 with code `SYNC_PAYLOAD_TOO_LARGE`.

- [ ] **Step 5: Run focused route tests and verify GREEN**

Run: `yarn.cmd jest app/api/sync/read-body.test.ts app/api/sync/route.test.ts --runInBand`

Expected: both suites pass.

### Task 2: Normalize Bocha Search Titles

**Files:**
- Modify: `app/lib/web-search.test.ts`
- Modify: `app/lib/web-search.ts`

- [ ] **Step 1: Add a failing Bocha response test**

Use `data.webPages.value` with `{ name, url, snippet }` and assert:

```ts
await expect(searchWeb("nextjs", { fetchImpl })).resolves.toEqual([
  {
    title: "Bocha result",
    url: "https://example.com/result",
    snippet: "Summary",
  },
]);
```

- [ ] **Step 2: Run and verify RED**

Run: `yarn.cmd jest app/lib/web-search.test.ts --runInBand`

Expected: FAIL because the result list is empty.

- [ ] **Step 3: Implement the provider alias**

Normalize the title with `row.title ?? row.name`; retain the existing trimming, URL checks, deduplication, and truncation.

- [ ] **Step 4: Run and verify GREEN**

Run: `yarn.cmd jest app/lib/web-search.test.ts --runInBand`

Expected: all web-search library tests pass.

### Task 3: Delete Account Sync Snapshots Atomically

**Files:**
- Modify: `app/lib/account-auth.ts`
- Modify: `app/lib/account-auth-sqlite.ts`
- Modify: `app/lib/account-auth-sqlite.test.ts`

- [ ] **Step 1: Add failing repository cleanup tests**

Seed two users and two `user_sync_snapshots` rows. Write an auth record without user A using:

```ts
await repository.write(nextRecord, { deletedUserIds: ["user-a"] });
```

Assert user A's snapshot is deleted and user B's remains. Add a rollback case that forces a later insert failure and asserts user A's snapshot remains.

- [ ] **Step 2: Run and verify RED**

Run: `yarn.cmd jest app/lib/account-auth-sqlite.test.ts --runInBand`

Expected: FAIL because the write options do not exist and snapshots remain.

- [ ] **Step 3: Extend the repository contract**

Define:

```ts
export type AccountAuthWriteOptions = {
  deletedUserIds?: readonly string[];
};

write(data: AuthRecord, options?: AccountAuthWriteOptions): Promise<void>;
```

Inside the existing SQLite transaction, delete each requested snapshot using a parameterized statement after the auth tables have been written and before `COMMIT`.

- [ ] **Step 4: Pass the deleted user ID from the service**

Change only `AccountAuthService.deleteUser` to call:

```ts
await this.repository.write(data, { deletedUserIds: [target.id] });
```

- [ ] **Step 5: Run and verify GREEN**

Run: `yarn.cmd jest app/lib/account-auth-sqlite.test.ts app/lib/provider-config/audit.test.ts --runInBand`

Expected: account cleanup and existing audit tests pass.

### Task 4: Serialize Provider Mutation and Audit

**Files:**
- Modify: `app/lib/provider-config/server.ts`
- Modify: `app/api/account/admin/providers/[id]/route.ts`
- Modify: `app/api/account/admin/providers/route.test.ts`

- [ ] **Step 1: Add a failing concurrency test**

Hold the first PATCH audit promise open, start a second PATCH, and assert the second request has not called `snapshot` or `upsert` until the first request completes. Then release the first audit and assert both responses complete in order.

- [ ] **Step 2: Run and verify RED**

Run: `yarn.cmd jest app/api/account/admin/providers/route.test.ts --runInBand`

Expected: FAIL because both requests currently enter the mutation section concurrently.

- [ ] **Step 3: Add the server-side exclusive queue**

Export:

```ts
export function withProviderConfigMutationLock<T>(
  operation: () => Promise<T>,
): Promise<T>;
```

Chain operations through a module-level settled promise, using both success and rejection handlers so a failed operation cannot poison the queue. Reset the queue in `resetProviderConfigRepositoryForTests`.

- [ ] **Step 4: Wrap PATCH and DELETE mutation lifecycles**

Keep `requireAdmin`, provider ID parsing, and payload validation outside the lock. Put repository lookup, snapshot, mutation, audit, and compensation restore inside one `withProviderConfigMutationLock` callback.

- [ ] **Step 5: Run and verify GREEN**

Run: `yarn.cmd jest app/api/account/admin/providers/route.test.ts app/lib/provider-config/repository.test.ts --runInBand`

Expected: concurrency, compensation, and repository tests pass.

### Task 5: Flush a Captured Account State on Stop

**Files:**
- Modify: `app/utils/account-cloud-sync.test.ts`
- Modify: `app/utils/account-cloud-sync.ts`

- [ ] **Step 1: Add the failing shutdown-flush test**

Start sync, complete the initial pull and seed push, mutate the mocked local state, call `stopAccountCloudSync()`, and assert a final POST still uses the stopped user's latest revision and captured state after globals are cleared.

- [ ] **Step 2: Run and verify RED**

Run: `yarn.cmd jest app/utils/account-cloud-sync.test.ts --runInBand`

Expected: FAIL because no final POST occurs after `activeUserId` becomes null.

- [ ] **Step 3: Implement captured push input**

Define an internal capture containing `userId`, `owner`, `revision`, and stripped AppState. Queue the final POST from that capture before invoking stop callbacks. Do not read `activeUserId` or the live workspace inside the queued operation.

- [ ] **Step 4: Preserve account-switch isolation**

On a conflict, retry only with the captured user/revision. Do not apply remote conflict state when a different account or workspace is active. Keep existing normal push behavior unchanged.

- [ ] **Step 5: Run and verify GREEN**

Run: `yarn.cmd jest app/utils/account-cloud-sync.test.ts --runInBand`

Expected: shutdown flush and all existing conflict/isolation tests pass.

### Task 6: Guard and Roll Back Home-Page Chat Creation

**Files:**
- Modify: `app/components/workspace-home.tsx`
- Modify: `app/components/chat/web-search-flow.test.ts`

- [ ] **Step 1: Add failing lifecycle regression assertions**

Extend the flow test to require a `startingChat` guard, `sendDisabled` integration, disabled suggestion buttons, and restoration of the pre-submit chat state in the catch path.

- [ ] **Step 2: Run and verify RED**

Run: `yarn.cmd jest app/components/chat/web-search-flow.test.ts --runInBand`

Expected: FAIL because no pending state or rollback exists.

- [ ] **Step 3: Implement the pending guard and rollback**

Add `startingChat`, return early on duplicate submission, and capture the minimal chat fields changed by `newSession` (`sessions`, `currentSessionIndex`, and `lastInput`). Set pending before creation, restore those fields on failure, and clear pending in `finally`.

- [ ] **Step 4: Disable all home-page submission entry points**

Pass `sendDisabled={startingChat || emptyDraft}` and disable suggestion buttons while `startingChat` is true. Preserve the draft and attachments on failure.

- [ ] **Step 5: Run and verify GREEN**

Run: `yarn.cmd jest app/components/chat/web-search-flow.test.ts app/components/chat/web-search.test.tsx --runInBand`

Expected: home flow and web-search UI tests pass.

### Task 7: Full Verification

**Files:**
- Verify all changed files.

- [ ] **Step 1: Run all tests**

Run: `yarn.cmd test:ci --runInBand --no-cache`

Expected: all suites and tests pass.

- [ ] **Step 2: Run TypeScript**

Run: `yarn.cmd tsc --noEmit`

Expected: exit code 0.

- [ ] **Step 3: Run lint**

Run: `yarn.cmd lint`

Expected: exit code 0; existing warnings may remain but no new errors.

- [ ] **Step 4: Run production build if the shared worktree is idle**

Run: `yarn.cmd build`

Expected: standalone production build succeeds. If another process is using `.next`, report the conflict rather than interrupting it.

- [ ] **Step 5: Check the final diff**

Run: `git diff --check` and `git status --short`.

Expected: no whitespace errors and no unexpected files. Do not stage, commit, switch branches, or contact a remote; Git writes are reserved for the user by `AGENTS.md`.
