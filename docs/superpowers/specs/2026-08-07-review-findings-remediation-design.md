# Review Findings Remediation Design

**Date:** 2026-08-07
**Status:** Approved for implementation

## Goal

Resolve the six confirmed review findings without broad database or UI refactors:

1. Enforce the account sync payload limit while streaming the request body.
2. Normalize Bocha result titles from its `name` field.
3. Remove a deleted account's sync snapshot in the same SQLite transaction as the account write.
4. Serialize provider configuration changes across the provider write, audit write, and compensation rollback.
5. Preserve the final account state before cloud sync clears its active-user context.
6. Prevent duplicate home-page submissions and roll back a newly created empty session when search preflight fails.

## Design

### Bounded sync request body

Add a small route-level helper that reads `NextRequest.body` through a reader, counts raw bytes, and cancels the reader as soon as the 15 MB limit is exceeded. A valid `Content-Length` greater than the limit may be rejected early, but streaming byte accounting remains authoritative because clients can omit or falsify that header. The existing JSON validation and error response contract remain unchanged.

### Search result normalization

Treat `title` and `name` as provider-specific aliases for the normalized result title. Existing URL, snippet, deduplication, and length validation remain in place. Add a Bocha-shaped `data.webPages.value` regression test.

### Account deletion cleanup

Extend the account repository write contract with optional deleted-user IDs. `AccountAuthService.deleteUser` passes the target ID, while all other writes use the existing behavior. `SqliteAccountAuthRepository.write` deletes matching `user_sync_snapshots` rows inside its existing `BEGIN IMMEDIATE` transaction after writing the account tables. This avoids a schema migration and does not delete snapshots during unrelated writes.

### Provider mutation serialization

Introduce a process-local mutation queue in the provider configuration server module. Both PATCH and DELETE execute snapshot, provider mutation, audit write, and rollback inside this exclusive section. This matches the approved single-instance SQLite deployment boundary and prevents one failed audit from restoring over another concurrent request.

### Final cloud-sync flush

Capture the active user ID, revision, workspace owner, and AppState before clearing global sync state. Queue a final push using the captured values rather than consulting globals after cleanup. Conflict handling remains bounded to one retry and must never apply data to a different active workspace.

### Home-page submission lifecycle

Track a `startingChat` state and ignore additional sends while it is true. Snapshot the chat workspace before creating the session. If search preflight fails, restore that snapshot so no empty session remains; on success, keep the current navigation and input-clearing behavior. Disable send and suggestion actions while the operation is pending.

## Error Handling

- Oversized sync payloads continue returning HTTP 413 with `SYNC_PAYLOAD_TOO_LARGE`.
- Provider audit failures continue returning HTTP 500 after restoring the prior provider state.
- Final sync push failures are logged without restoring a stale account as active.
- Home-page search failures retain the user's draft and show the existing localized toast.

## Testing

Add focused regression coverage before each implementation change:

- A chunked request exceeding the byte limit is rejected before the full stream is consumed.
- A Bocha response using `name` produces a normalized result.
- Deleting a user removes only that user's sync snapshot and rolls back cleanup if the account transaction fails.
- Concurrent provider mutations cannot interleave across audit and rollback.
- Stopping sync flushes a captured account snapshot after global state is cleared.
- Repeated home-page submission is ignored while pending, and failed preflight restores the previous workspace.

Then run the focused suites, full Jest suite, TypeScript, lint, build, and `git diff --check`. Production build runs only after confirming no other process is actively modifying the shared worktree.

## Non-Goals

- No database schema migration or foreign-key retrofit.
- No multi-process/distributed provider lock.
- No redesign of the search or provider administration UI.
- No Git staging, commit, branch, or remote operation.
