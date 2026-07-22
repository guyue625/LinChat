# Chat UI fixes design

## Scope

The supplied screenshots describe three related issues in the existing chat workspace:

- sessions containing messages can remain labelled “新的聊天” in the sidebar;
- the home workspace composer does not behave exactly like the chat-page composer when pasting or attaching images;
- several menu and session-action icons render as filled blocks because legacy SVG fill rules override transparent SVG geometry.

The third screenshot is treated as evidence that the session contains text and image messages. Export-page layout is out of scope.

## Design

### Session title lifecycle

The chat store will expose a small pure title helper that derives a short, readable title from the first non-empty user message. When the first meaningful user message is accepted, a session that still has the default placeholder receives that local title immediately. The existing asynchronous model summarizer can subsequently replace the local title, while a manual rename always wins. Empty/image-only messages continue to use the default placeholder until there is text to title.

This makes the sidebar useful without depending on title-generation configuration or a successful secondary model request.

### Shared composer

The message-entry surface will be isolated as a reusable `ChatComposer` component. It owns the text area, paste handling, upload handling, attachment previews, action menu, and send affordance. The chat page supplies its session-backed state and callbacks; the workspace home supplies draft-assistant state and its navigation/send callback. The component keeps the existing `ChatActions` menu contract so model selection and assistant settings remain available in both contexts.

The shared paste handler accepts image clipboard items only when the selected model supports vision, prevents the browser's default image insertion, uploads at most three images, and preserves existing attachments. Text paste remains native.

### Icon rendering

New/updated action icons will use `lucide-react` stroke icons or SVGs whose visual attributes inherit `currentColor`. CSS will not globally force every descendant `fill` to `currentColor`; only intentional stroke/fill properties will be normalized. This keeps icon contrast consistent in light and dark themes and prevents transparent background paths from becoming visible shapes.

## Boundaries and error handling

- The title helper is pure and unit-testable.
- Upload failures leave the current attachments intact and clear the uploading state.
- A pasted unsupported file is ignored without preventing text paste.
- Manual renames are never overwritten by local or asynchronous automatic titles.
- The composer remains keyboard accessible and uses explicit labels for every icon-only control.

## Verification

- Unit tests cover title derivation, default-title replacement, manual-rename protection, and image-paste attachment limits.
- Existing store and UI tests must remain green.
- A production build validates the shared component types, CSS modules, and SVG imports.
- Final visual verification checks the sidebar title and the two composers at the same viewport size as the supplied screenshots.

