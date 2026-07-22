# Message Metadata Hover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the assistant name visible on assistant messages and reveal the message time, model, and action controls together on desktop hover while keeping them visible on mobile.

**Architecture:** Add a small pure metadata helper so assistant-name and model fallback behavior is testable, then restructure the existing message header into identity and secondary-information groups. CSS controls desktop hover/focus visibility and overrides it for touch-width screens without changing message data or action callbacks.

**Tech Stack:** React 18, TypeScript, CSS Modules/SCSS, Node `node:test`.

---

### Task 1: Message metadata fallback helper

**Files:**

- Create: `app/utils/message-metadata.ts`
- Create: `test/message-metadata.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { getAssistantMessageMetadata } from "../app/utils/message-metadata";

test("uses the assistant name independently from the model", () => {
  assert.deepEqual(
    getAssistantMessageMetadata({
      featuredAssistantName: "Lobe AI",
      maskName: "Default Assistant",
      messageModel: "kimi-k3",
      sessionModel: "claude-3-5-sonnet",
    }),
    { assistantName: "Lobe AI", modelName: "kimi-k3" },
  );
});

test("falls back to the mask name and session model", () => {
  assert.deepEqual(
    getAssistantMessageMetadata({
      maskName: "Writing Assistant",
      sessionModel: "qwen-max",
    }),
    { assistantName: "Writing Assistant", modelName: "qwen-max" },
  );
});
```

- [ ] **Step 2: Run TypeScript to verify the missing helper fails**

Run: `npx tsc --noEmit --pretty false`

Expected: FAIL because `app/utils/message-metadata.ts` does not exist.

- [ ] **Step 3: Implement the minimal helper**

```ts
export function getAssistantMessageMetadata(input: {
  featuredAssistantName?: string;
  maskName?: string;
  defaultTopicName?: string;
  defaultAssistantName?: string;
  messageModel?: string;
  sessionModel?: string;
}) {
  const maskName =
    input.maskName && input.maskName !== input.defaultTopicName
      ? input.maskName
      : undefined;
  return {
    assistantName:
      input.featuredAssistantName ||
      maskName ||
      input.defaultAssistantName ||
      "Default Assistant",
    modelName: input.messageModel || input.sessionModel || "",
  };
}
```

- [ ] **Step 4: Compile and run the focused test**

Run: compile the helper and test to a temporary directory with `npx tsc`, then execute the compiled test file with `node`.

Expected: 2 tests pass.

### Task 2: Restructure the assistant message information row

**Files:**

- Modify: `app/components/chat.tsx`

- [ ] **Step 1: Import and call `getAssistantMessageMetadata` for each rendered assistant message**

Use `featuredAssistant?.name`, `session.mask.name`, `message.model`, and `session.mask.modelConfig.model` as inputs.

- [ ] **Step 2: Replace the model-only label with a permanent assistant-name element**

Create an identity group containing the existing avatar and a new `chat-assistant-name` element.

- [ ] **Step 3: Move time and model into the header metadata group**

Render the existing context/date label and resolved model name in `chat-message-meta`, followed immediately by the unchanged `chat-message-actions` element.

- [ ] **Step 4: Remove the old bottom `chat-message-action-date` block for assistant messages**

Keep user-message behavior isolated so the right-aligned user bubble remains unchanged.

### Task 3: Add desktop hover and mobile always-visible styles

**Files:**

- Modify: `app/components/chat.module.scss`

- [ ] **Step 1: Make the header a stable flex information row**

Add `chat-message-identity`, `chat-assistant-name`, and `chat-message-meta` styles. The assistant name uses normal text emphasis; metadata uses smaller muted text.

- [ ] **Step 2: Hide secondary information on desktop without layout movement**

Set metadata/actions to `opacity: 0`, `visibility: hidden`, and `pointer-events: none`; reveal them from `.chat-message-container:hover` and `:focus-within`. Do not translate or scale the row.

- [ ] **Step 3: Keep metadata and actions visible on screens up to 600px**

Override opacity, visibility, and pointer events; allow the information row to wrap and keep buttons within the viewport.

- [ ] **Step 4: Preserve user-message styles**

Scope assistant metadata rules through `.chat-message` and retain the existing user action positioning and hidden user date behavior.

### Task 4: Verification

**Files:**

- Verify: `app/components/chat.tsx`
- Verify: `app/components/chat.module.scss`
- Verify: `app/utils/message-metadata.ts`
- Verify: `test/message-metadata.test.ts`

- [ ] **Step 1: Run focused regression tests**

Expected: metadata helper tests pass.

- [ ] **Step 2: Run `npx tsc --noEmit --pretty false`**

Expected: exit code 0.

- [ ] **Step 3: Run targeted ESLint and Prettier checks**

Expected: exit code 0 and no formatting warnings for touched files.

- [ ] **Step 4: Run `git diff --check` and inspect the final diff**

Expected: no whitespace errors; only the planned message metadata, styles, tests, and documentation are changed by this task.
