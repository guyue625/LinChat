# Chat UI fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep populated sessions titled usefully, make the home and chat composers share identical image-input behavior, and prevent action icons from rendering as filled blocks.

**Architecture:** Add a pure title helper in the chat store and call it at the first user-message boundary before the existing asynchronous summarizer. Extract the shared textarea/attachment surface into a focused composer component while keeping `ChatActions` as its menu/action child. Replace affected legacy action SVGs with currentColor-safe stroke icons and narrow the CSS normalization rules.

**Tech Stack:** React 18, TypeScript, Zustand, React Router, SCSS modules, lucide-react, Jest with jsdom.

---

### Task 1: Add title derivation regression coverage

**Files:**
- Create: `test/chat-title.test.ts`
- Modify: `app/store/chat.ts` (export the pure title helper and call site only after the test is red)

- [x] **Step 1: Write the failing tests**

```ts
import { deriveSessionTopic, DEFAULT_TOPIC } from "../app/store/chat";

test("derives a compact topic from the first meaningful user message", () => {
  expect(deriveSessionTopic("  How do I paste an image into chat?  ")).toBe(
    "How do I paste an image into chat?",
  );
});

test("keeps the default topic for empty or image-only input", () => {
  expect(deriveSessionTopic("   ")).toBe(DEFAULT_TOPIC);
});
```

- [x] **Step 2: Run the focused test and confirm the expected failure**

Run: `yarn test:ci test/chat-title.test.ts --runInBand`

Expected: FAIL because `deriveSessionTopic` is not exported yet.

- [x] **Step 3: Implement the pure helper and immediate fallback title**

Export `deriveSessionTopic(content: string): string`, returning `DEFAULT_TOPIC` for trimmed empty content and otherwise `trimTopic(content)`. In `onUserInput`, after the user message is appended and before asynchronous work can finish, update the target session only when `topicManuallyEdited` is false and the current topic is the default placeholder (or the legacy mask-name placeholder).

- [x] **Step 4: Run the focused test and existing store tests**

Run: `yarn test:ci test/chat-title.test.ts test/utils.test.ts --runInBand`

Expected: PASS with zero failures.

- [x] **Step 5: Add manual-rename protection coverage**

Extend `test/chat-title.test.ts` with a store-level assertion that a session marked `topicManuallyEdited` keeps its explicit title after a user message. Run the same focused command and expect PASS.

- [x] **Step 6: Cover legacy persisted sessions at display time**

  Derive the visible title from the first meaningful persisted user message when an older session still has the default or assistant-name placeholder, without mutating the session or overriding a manual rename.

### Task 2: Extract and reuse the image-capable composer

**Files:**
- Create: `app/components/chat-composer.tsx`
- Create: `app/components/chat-composer.module.scss` only if shared layout rules cannot safely live in `chat.module.scss`
- Modify: `app/components/chat.tsx`
- Modify: `app/components/workspace-home.tsx`
- Create: `test/chat-composer.test.tsx`

- [x] **Step 1: Write the failing paste behavior test**

Render the shared composer with a vision-capable model, dispatch a clipboard event containing an image `File`, and assert that the upload callback receives one image and the browser paste event is prevented. Add a second assertion that a non-image clipboard item does not call upload.

- [x] **Step 2: Run the focused test and confirm it fails for the missing shared component/handler**

Run: `yarn test:ci test/chat-composer.test.tsx --runInBand`

Expected: FAIL because the shared composer export and image-paste contract do not exist.

- [x] **Step 3: Implement the smallest shared composer contract**

Move the chat page's textarea, `handlePaste`, upload/attachment preview, `ChatActions`, and send button into `ChatComposer`. Props must include:

```ts
{
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder: string;
  attachImages: string[];
  setAttachImages: (images: string[]) => void;
  uploading: boolean;
  setUploading: (uploading: boolean) => void;
  uploadImage: () => void;
  mask: Mask;
  onMaskChange?: (updater: (mask: Mask) => void) => void;
  actions: Omit<React.ComponentProps<typeof ChatActions>, "mask" | "onMaskChange">;
  homeMode?: boolean;
}
```

Use the existing `isVisionModel` check and `uploadImageRemote` implementation, cap attachments at three, preserve text paste, and keep button labels/keyboard behavior unchanged. The chat page supplies its existing state and submit callback; the home page supplies draft-mask state and starts the new session.

- [x] **Step 4: Run the focused composer test and typecheck/build the affected modules**

Run: `yarn test:ci test/chat-composer.test.tsx --runInBand`

Expected: PASS. Then run `yarn tsc --noEmit` and expect exit code 0.

- [x] **Step 5: Remove duplicated home-only composer markup**

Delete the home textarea/attachment/footer duplication and render `ChatComposer` with the home draft mask. Keep home-specific assistant selection and navigation outside the shared component. Re-run the focused composer test.

### Task 3: Fix action and session icon rendering

**Files:**
- Modify: `app/components/chat.tsx`
- Modify: `app/components/chat-list.tsx`
- Modify: `app/components/home.module.scss`
- Modify: `app/components/chat.module.scss`
- Create: `test/chat-icons.test.tsx`

- [x] **Step 1: Add a DOM regression assertion for icon semantics**

Render the chat action menu and assert that the menu items expose their text labels and contain SVGs whose `fill`/`stroke` are not forced to a non-transparent background shape. This test should fail against the current legacy SVG/CSS combination.

- [x] **Step 2: Run the focused test and confirm failure**

Run: `yarn test:ci test/chat-icons.test.tsx --runInBand`

Expected: FAIL because the current menu imports legacy SVGs with filled transparent geometry.

- [x] **Step 3: Replace affected imports with currentColor-safe stroke icons**

Use lucide icons for the more-actions button, upload image, history/memory, quick prompt, assistant/mask, keyboard shortcuts, clear context, rename, and delete actions. Keep labels and click handlers unchanged.

- [x] **Step 4: Narrow CSS normalization**

Remove selectors that force every descendant `[fill]:not([fill="none"])` to `fill: currentColor`. Keep explicit `stroke: currentColor` for lucide SVGs and only set fill for known filled brand/avatar assets. Ensure icon buttons retain 16–18px dimensions and current theme contrast.

- [ ] **Step 5: Run icon tests and the full test suite**

Run: `yarn test:ci test/chat-icons.test.tsx --runInBand` and then `yarn test:ci --runInBand`.

Expected: PASS with zero failures.

### Task 4: Full verification

**Files:**
- Modify: none unless verification identifies a concrete regression.

- [x] **Step 1: Check formatting and diff hygiene**

Run: `git diff --check` and inspect `git diff --stat` plus all modified composer/store/icon files. Expected: no whitespace errors and no unrelated file changes.

- [ ] **Step 2: Run the production build**

Run: `yarn build`

Expected: exit code 0, including generated masks and Next.js compilation.

- [ ] **Step 3: Verify the requirements against evidence**

Confirm the focused tests prove title fallback/manual rename protection and image paste behavior; the full suite and build prove integration; and the rendered UI shows readable populated session titles, matching home/chat composer controls, and visible line icons in both themes.
