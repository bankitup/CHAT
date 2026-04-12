# Conversation Runtime Manual Matrix

Use this short matrix after changes that touch Messenger thread resilience,
voice playback, or attachment preview layout.

This is intentionally narrow. It exists to catch the recent production-class
failures without expanding into a full browser E2E plan.

## Matrix

| Area | Scenario | Steps | Expected result | Evidence to watch |
| --- | --- | --- | --- | --- |
| Broken DM route | Broken history recovery | Open a known-problem DM or simulate a conversation that previously rendered header + composer but no usable body | The thread body falls back to the local rescue state, `Retry history` works without leaving the route, and `Back to Chats` / `Open info` remain usable | `/app/(app)/chat/[conversationId]/thread-body-rescue-boundary.tsx`, `/docs/broken-thread-history-proof.md` |
| Broken DM route | Poisoned DM retirement and recreate | From DM settings, first confirm that ordinary `Hide from inbox` only removes the chat from the inbox, then use the explicit direct-chat delete confirmation, then recreate the DM from inbox | Hide-from-inbox alone is not treated as cleanup; the old poisoned conversation must not be silently auto-restored as healthy, and after true deletion the recreated DM gets a fresh conversation id and opens as a clean thread | `/app/(app)/chat/[conversationId]/actions.ts`, `/app/(app)/inbox/actions.ts`, `/src/modules/messaging/data/server.ts`, `/docs/poisoned-dm-cleanup.md` |
| Encrypted history | Older encrypted message unavailable on this device | Open a DM that contains older encrypted history unavailable on the current device, including a retired/mismatched-device case and a policy-blocked case if available | The row renders the dedicated unavailable state, the note stays truthful, no misleading generic retry/setup action appears for permanent history gaps, and the rest of the thread remains usable | `/app/(app)/chat/[conversationId]/encrypted-dm-message-body.tsx`, `/src/modules/messaging/e2ee/ui-policy.ts` |
| Voice playback | Mobile voice replay | On a real mobile device, open a thread with a committed voice message and tap play, pause, and play again | Playback either succeeds cleanly or lands in an explicit unsupported/failed state; starting voice playback must not refresh unrelated attachments in the thread and must not cause a visible thread jump on initial play, pause, or playback progress updates | `/app/(app)/chat/[conversationId]/use-thread-voice-playback-runtime.ts`, `/app/(app)/chat/[conversationId]/voice-playback-source.ts`, `/docs/voice-mobile-playback-proof.md` |
| Attachment preview | Mobile image viewer sizing | On a real mobile device, open a committed image attachment from a thread and then close it | The overlay fills the viewport, the image fits within the available space instead of collapsing into a thin strip, and the close control stays tappable | `/app/(app)/chat/[conversationId]/thread-image-preview-overlay.tsx`, `/app/globals.css` |

## Record If It Fails

- exact conversation id or environment
- device and browser
- whether the route stayed navigable
- whether ordinary hide and explicit hard delete behaved differently
- whether unrelated rows refreshed or re-resolved
- whether a recreated DM reused the poisoned conversation id or opened a fresh one
- whether voice playback caused a visible scroll jump
- whether the viewer/image size changed after the first frame
- any relevant console proof logs already available in the repo
