# Manual Test Matrix

## Tester Rule For Stability Phase

Do not accept “tap slowly” as a workaround.

For every scenario below:

- first tap must show immediate acknowledgment
- second tap must be ignored safely or handled deterministically
- slow completion must still look alive
- final success or failure must be explicit

Voice-specific cross-device verification lives in:

- [voice-cross-device-manual-matrix.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/voice-cross-device-manual-matrix.md)

Focused conversation-runtime recovery verification lives in:

- [conversation-runtime-manual-matrix.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/conversation-runtime-manual-matrix.md)

## Matrix

| Area | Scenario | Steps | Expected result | Evidence to watch |
| --- | --- | --- | --- | --- |
| Inbox | Create DM | Open inbox, open new chat sheet, select one DM target, submit | Button shows pending immediately, one chat opens, no duplicate conversation is created | `/app/(app)/inbox/new-chat-sheet.tsx`, `/app/(app)/inbox/actions.ts`, logs around `inbox:create-dm` |
| Inbox | Create group | Open inbox, group mode, select members, enter title, submit | Pending state appears immediately, one group opens, no duplicate tap behavior | `/app/(app)/inbox/actions.ts`, `/src/modules/messaging/data/server.ts#createConversationWithMembers` |
| Spaces | Create governed space | Open `/spaces/new`, fill name/profile/admins/members, submit once | Immediate pending state, one space is created, error remains truthful if any identifier is invalid | `/app/(app)/spaces/actions.ts`, `/src/modules/spaces/write-server.ts#createGovernedSpace` |
| Spaces | Add governed members/admins | Open `/spaces/members`, add members/admins, submit | Immediate pending state, member/admin changes persist once, no duplicate inserts/promotions | `/app/(app)/spaces/actions.ts`, `/src/modules/spaces/write-server.ts#addMembersToGovernedSpace` |
| Chat send | Group text send | Type short text and send | Optimistic message appears immediately, committed message replaces it cleanly, read state advances | `/app/(app)/chat/[conversationId]/plaintext-chat-composer-form.tsx`, `/app/(app)/chat/[conversationId]/actions.ts#sendMessageMutationAction` |
| Chat send | Group photo send from library | Pick gallery image and send | Immediate optimistic shell, no dead tap, committed image appears once, preview opens | `/app/(app)/chat/[conversationId]/composer-attachment-picker.tsx`, `/src/modules/messaging/data/server.ts#sendMessageWithAttachment` |
| Chat send | Group camera capture send | Use camera mode, take photo, send | Same as gallery path, no inflated pending shell, no duplicate send | same as above |
| Chat send | Group file send | Pick non-image file and send | Immediate pending state, final attachment row appears once, no duplicate message shell | same as above |
| Chat send | Voice send | Record voice note, send, tap replay, pause, resume | Send acknowledges immediately, replay works, repeated taps do not destabilize page | voice runtime files under `/app/(app)/chat/[conversationId]` |
| Chat send | Voice cross-device matrix | Run the dedicated desktop/mobile matrix for Chrome, Safari, and Android Chrome where available | Playback either succeeds or lands in explicit unsupported/failed state; it must not masquerade as generic loading | `/docs/voice-cross-device-manual-matrix.md`, `/docs/voice-mobile-playback-proof.md` |
| Encrypted DM | Text send | In DM, type text, send | Local ack appears immediately, one committed encrypted message appears, no duplicate row | `/app/(app)/chat/[conversationId]/encrypted-dm-composer-form.tsx`, `/app/api/messaging/dm-e2ee/send/route.ts` |
| Encrypted DM | Text + attachment send | In DM, attach photo or file and type text, send | One optimistic row, one committed row, no split-send behavior | same as above plus `/src/modules/messaging/data/server.ts#sendEncryptedDmMessageWithAttachment` |
| Encrypted DM | Attachment-only send | In DM, attach file without text | Existing attachment-only flow still works cleanly | same as above |
| Reactions | Add/remove reaction | Long-press or quick-action message, toggle reaction on and off | UI updates once, server result and live state converge, no stale count | `/app/(app)/chat/[conversationId]/thread-reaction-picker.tsx`, `/app/(app)/chat/[conversationId]/actions.ts#toggleReactionMutationAction` |
| Group membership | Add participant to open group | Add member from group settings/page | Pending state visible, member appears once, no extra refresh needed to confirm | `/app/(app)/chat/[conversationId]/actions.ts`, `/src/modules/messaging/data/server.ts#addParticipantsToGroupConversation` |
| Group membership | Remove participant | Remove participant from group | Pending state visible, participant removed once, role rules respected | `/src/modules/messaging/data/server.ts#removeParticipantFromGroupConversation` |
| Group membership | Leave group as owner | Leave group with another active member present | Owner handoff succeeds, leave succeeds, resulting surfaces stay consistent | `/src/modules/messaging/data/server.ts#leaveGroupConversation` |
| Profile | Update profile name | Change display name and save | Save shows pending immediately, success banner appears, inbox/chat/settings all reflect new name | `/app/(app)/settings/profile-settings-form.tsx`, `/app/(app)/settings/actions.ts#updateProfileAction` |
| Profile | Upload avatar | Select avatar, crop, apply, save | Crop/apply/save each show clear progress, final avatar updates across surfaces | same as above plus `/src/modules/messaging/data/server.ts#updateCurrentUserProfile` |
| Group settings | Update group title/avatar/join policy | Change title and optional avatar/join policy, save | One save path, one result, no mixed stale values after return to thread | `/app/(app)/chat/[conversationId]/group-chat-settings-form.tsx`, `/src/modules/messaging/data/server.ts#updateConversationIdentity` |
| Auth continuity | Session expires during write | Begin action in one tab, invalidate session elsewhere, finish action | Failure is explicit and recoverable, not silent | request viewer + server action paths |
| Realtime | Inbox refresh after send from another tab | Open inbox in tab A, send from tab B | Inbox row updates without manual reload or clearly refreshes once | `/src/modules/messaging/realtime/inbox-sync.tsx` |
| Realtime | Chat refresh after send from another tab | Open thread in tab A, send from tab B | Thread converges without duplicate rows or stale placeholders | `/src/modules/messaging/realtime/active-chat-sync.tsx` |
| Realtime | Hidden tab reconnect | Background tab for >15 seconds, send updates elsewhere, foreground again | One clean recovery path, not a stale thread/inbox | realtime sync files and router refresh behavior |
| Loading | Inbox initial load | Hard-refresh `/inbox` with active space selected | Stable list loads, no invalid-space loop, no empty-state flicker masking real failure | `/app/(app)/inbox/page.tsx`, `/src/modules/spaces/server.ts` |
| Loading | Chat initial load | Hard-refresh `/chat/[conversationId]` with reply/edit/settings query params | Thread resolves correct window and settings state, no route confusion | `/app/(app)/chat/[conversationId]/page.tsx` |
| Performance | Mobile inbox first load | On a real mobile device, hard-refresh `/inbox` and wait before interacting | Initial list appears quickly, create/new-chat code is not needed before open, live updates attach without a visible startup jump | `/app/(app)/inbox/page.tsx`, `/app/(app)/inbox/inbox-filterable-content.tsx`, `/app/(app)/inbox/inbox-page-deferred-effects.tsx`, `/docs/performance/mobile-messenger-truth-pass.md` |
| Performance | Mobile chat first load | On a real mobile device, hard-refresh `/chat/[conversationId]` and wait before interacting | Header, thread, and composer settle without major late shifts; reaction/edit/delete/voice extras do not block first paint | `/app/(app)/chat/[conversationId]/thread-history-viewport.tsx`, `/app/(app)/chat/[conversationId]/thread-composer-runtime.tsx`, `/docs/performance/mobile-messenger-truth-pass.md` |
| Push | Enable notifications | Open settings, enable notifications | Permission and device registration move through visible states, no silent no-op | `/app/(app)/settings/notification-readiness.tsx`, `/src/modules/messaging/sdk/notifications.ts` |
| Push | Test push | Trigger test send if enabled | Result is explicit: success, blocked, unconfigured, or delivery failure | same as above plus `/src/modules/messaging/push/server.ts` |

## Manual Test Order

Run in this order during stability:

1. inbox create flows
2. plaintext send flows
3. attachment/photo flows
4. encrypted DM text and attachment flows
5. group membership flows
6. profile and avatar flows
7. inbox/chat reload and reconnect flows
8. push readiness and test send

## Failure Signatures To Record

For every failure, capture:

- exact user action
- whether first tap showed visible acknowledgment
- whether repeated tap changed outcome
- whether optimistic UI appeared
- whether server eventually succeeded anyway
- whether inbox/thread/settings required manual refresh to look correct
- any route query params or active space mismatch involved

## Existing Debug Surfaces Worth Reusing

- `NEXT_PUBLIC_CHAT_DEBUG_LIVE_REFRESH=1`
- `CHAT_DEBUG_INBOX_SSR=1`
- `CHAT_DEBUG_SPACES_SSR=1`
- `NEXT_PUBLIC_CHAT_DEBUG_VOICE=1`
- `CHAT_DEBUG_DM_E2EE_BOOTSTRAP=1`
- `CHAT_DEBUG_DM_E2EE_SEND=1`
- `CHAT_DEBUG_PUSH=1`

These already exist in the repo and should be preferred over inventing a second diagnostic vocabulary during the stability phase.
