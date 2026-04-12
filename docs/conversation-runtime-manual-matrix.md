# Conversation Runtime Manual Matrix

Use this short matrix after changes that touch Messenger thread resilience,
voice playback, or attachment preview layout.

This is intentionally narrow. It exists to catch the recent production-class
failures without expanding into a full browser E2E plan.

## Matrix

| Area | Scenario | Steps | Expected result | Evidence to watch |
| --- | --- | --- | --- | --- |
| Broken DM route | Broken history recovery | Open a known-problem DM or simulate a conversation that previously rendered header + composer but no usable body | The thread body falls back to the local rescue state, `Retry history` works without leaving the route, and `Back to Chats` / `Open info` remain usable | `/app/(app)/chat/[conversationId]/thread-body-rescue-boundary.tsx`, `/docs/broken-thread-history-proof.md` |
| Voice playback | Mobile voice replay | On a real mobile device, open a thread with a committed voice message and tap play, pause, and play again | Playback either succeeds cleanly or lands in an explicit unsupported/failed state; starting voice playback must not refresh unrelated attachments in the thread | `/app/(app)/chat/[conversationId]/use-thread-voice-playback-runtime.ts`, `/app/(app)/chat/[conversationId]/voice-playback-source.ts`, `/docs/voice-mobile-playback-proof.md` |
| Attachment preview | Mobile image viewer sizing | On a real mobile device, open a committed image attachment from a thread and then close it | The overlay fills the viewport, the image fits within the available space instead of collapsing into a thin strip, and the close control stays tappable | `/app/(app)/chat/[conversationId]/thread-image-preview-overlay.tsx`, `/app/globals.css` |

## Record If It Fails

- exact conversation id or environment
- device and browser
- whether the route stayed navigable
- whether unrelated rows refreshed or re-resolved
- whether the viewer/image size changed after the first frame
- any relevant console proof logs already available in the repo
