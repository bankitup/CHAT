# MVP Security Posture

This document records the practical security state of the CHAT MVP today.

Use it as the quick operational answer to:

- what is already hardened
- what is still intentionally pending
- how chat media is actually protected
- where service-role access is still expected

For the longer-term target model, see
[mvp-security-target.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/security/mvp-security-target.md).
For runtime schema expectations, see
[schema-assumptions.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/schema-assumptions.md).

## Current posture summary

| Area | Current state | Source |
| --- | --- | --- |
| `public.spaces` | Hardened for authenticated `select` by actual space membership. Authenticated writes stay blocked. | [2026-04-10-spaces-and-space-members-rls.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-10-spaces-and-space-members-rls.sql) |
| `public.space_members` | Hardened for same-space authenticated `select`. Authenticated writes stay blocked. | [2026-04-10-spaces-and-space-members-rls.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-10-spaces-and-space-members-rls.sql) |
| `public.conversations` | Not yet hardened with live RLS. Next safe `select` slice is prepared but deferred. | [2026-04-10-conversations-metadata-rls-deferred-plan.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-10-conversations-metadata-rls-deferred-plan.sql) |
| `public.conversation_members` | Still pending a dedicated core access slice. Runtime behavior is enforced mainly by app-owned loaders and write checks. | Current runtime |
| `public.messages` | Still pending a dedicated core access slice. Runtime reads remain shaped through app-owned history loaders. | Current runtime |
| `public.message_reactions` | Still pending a dedicated core access slice. Reaction access still follows app/runtime shaping rather than a final explicit MVP RLS pass. | Current runtime |
| `public.message_assets` | First-pass RLS is active for active conversation members and sender-owned insert/delete flows. | [2026-04-06-message-assets-runtime-align.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-06-message-assets-runtime-align.sql) |
| `public.message_asset_links` | First-pass RLS is active for active conversation members and sender-owned insert flows. | [2026-04-06-message-assets-runtime-align.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-06-message-assets-runtime-align.sql) |
| `storage.objects` for `message-media` | Hardened by private bucket plus conversation-member storage policies. | [2026-04-06-message-attachments-storage-policies.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-06-message-attachments-storage-policies.sql) |

## Hardened now

- Outer tenancy is now real, not aspirational. `spaces` and `space_members` reads are membership-scoped.
- Media metadata already has a first-pass RLS layer through `message_assets` and `message_asset_links`.
- Chat media blobs live in the private `message-media` bucket and rely on conversation-member storage policies.
- User-facing media reads now flow through the attachment signed-URL route after membership checks. Chat no longer treats `message_assets.external_url` as a direct delivery shortcut.
- Supporting tables such as push subscriptions, device registration, and encrypted envelope storage already have earlier first-pass hardening work, but they are not the main open tenancy gap anymore.

## Still pending

- `public.conversations` live RLS is not enabled yet.
- `public.conversation_members` still needs its first explicit core access slice.
- `public.messages` still needs its first explicit core access slice.
- `public.message_reactions` still needs its first explicit core access slice.

Why `public.conversations` is still deferred:

- conversation creation still inserts the conversation row before membership rows exist
- conversation summary projection still updates `last_message_*` columns during normal send/edit/delete flows
- some group metadata writes still allow a service-role fallback and are not yet aligned to a consistent privileged write path

Until those write paths are aligned, enabling `public.conversations` RLS would risk runtime regressions.

## Media and file access

Current secure media contract:

1. uploads land in the private `message-media` bucket
2. durable metadata lives in `message_assets`
3. message linkage lives in `message_asset_links`
4. chat history returns storage-backed attachments only
5. the client resolves a short-lived signed URL through
   `/api/messaging/conversations/[conversationId]/messages/[messageId]/attachments/[attachmentId]/signed-url`
6. that route verifies authenticated conversation membership before returning access

Operational rules:

- no public media bucket
- no permanent public media URL dependency for chat
- no raw `storage.objects` browsing as a product read path
- `external-url` asset rows are not treated as supported user-facing chat delivery

## Intentional service-role use

Service-role access is still intentional in these areas:

- governed space creation and member-management flows
- attachment signed-URL creation fallback and controlled blob cleanup
- avatar and chat-media cleanup after replace/delete flows
- push delivery fanout and maintenance helpers
- repair, migration, and rollback helpers
- selected conversation/group-management write paths while `public.conversations` RLS remains deferred

Service role is not the intended default read path for:

- inbox
- activity
- thread history
- conversation lists
- reactions

## Safest next slices

1. Align `public.conversations` writes, then enable the prepared `select`-only metadata policy.
2. Add the first explicit `public.conversation_members` access slice.
3. Add the first explicit `public.messages` access slice.
4. Add the first explicit `public.message_reactions` access slice.

Keep the order above. The current MVP is safer when the outer and metadata boundaries harden before deeper content tables.
