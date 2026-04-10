# MVP Security Target

Purpose:

- freeze the practical MVP security target for core CHAT runtime tables before the next hardening SQL pass
- define which data is user-session-readable, which flows must stay backend-controlled, and where each enforcement boundary should live
- keep this grounded in the current app architecture, not a future rewrite

This document covers:

- `public.spaces`
- `public.space_members`
- `public.conversations`
- `public.conversation_members`
- `public.messages`
- `public.message_reactions`
- media/file access through `public.message_assets`, `public.message_asset_links`, and private Supabase Storage

Current assumption:

- the app continues to render list/thread surfaces through app-owned server components, server actions, and API routes
- RLS should become the raw row-visibility backstop for authenticated user-session reads
- service-role access stays narrow and explicit for admin workflows, multi-row maintenance, cleanup, and controlled delivery helpers

## MVP target model

| Area | Frontend-readable via normal user session | Backend-only via privileged server path | Never directly user-readable | Primary boundary |
| --- | --- | --- | --- | --- |
| `spaces` | Yes. A signed-in user may read only spaces where they have an active `space_members` row. | Create, rename, profile changes, and delete remain app-owned server mutations. | Spaces with no membership. | RLS for row visibility, server action/API for writes. |
| `space_members` | Yes, but only within the same space. The MVP may expose role/user-id/joined-at membership rows for the requester's own spaces. | Add/remove/promote members, owner protection, and cross-user email resolution stay backend-controlled. | Cross-space membership rows and any auth-user email lookup. | RLS for same-space membership reads, server action/API plus service role for governance writes. |
| `conversations` | Yes, but only conversations where the requester has an active `conversation_members` row and the conversation belongs to one of their spaces. | Conversation create/reuse, group settings edits, deletion, summary repair, and DM uniqueness enforcement remain app-owned server flows. | Conversations outside membership, including DM lookup across other spaces. | RLS for row visibility, server action/API for writes and coordinated summary updates. |
| `conversation_members` | Yes, but only for conversations the requester is actively in. This supports participant lists, unread state, and notification settings. | Member add/remove, DM privacy enforcement, hide/archive maintenance, and admin-sensitive role changes remain backend-controlled. | Membership rows for conversations the requester is not part of. | RLS for active-member visibility, server action/API for writes and policy-sensitive transitions. |
| `messages` | Yes, but only for conversations where the requester is an active member. Product reads should stay on app-owned history/list loaders so `visible_from_seq`, reply shaping, and encrypted fallbacks stay truthful. | Send, edit, delete, and conversation projection maintenance remain server action/API flows; service role is allowed only for repair/cleanup helpers, not normal send. | Messages outside membership, raw encrypted envelope payloads, or any attempt to bypass `visible_from_seq`. | RLS for base conversation membership, server/API layer for shaped history/read models and writes. |
| `message_reactions` | Yes, but only for visible messages in conversations the requester can read. | Normal reaction toggle should not require service role; keep it in app-owned server actions backed by RLS. | Reactions on inaccessible messages. | RLS tied to visible message membership, server action for mutation entrypoint. |
| Media/file metadata | Yes. Active conversation members may read `message_assets` and `message_asset_links` for messages in conversations they belong to. | Asset creation/linking, delete cleanup, and orphan cleanup stay backend-controlled. | Asset metadata for other conversations. | Existing RLS on asset tables plus app-owned write helpers. |
| Media/file blobs | No direct permanent blob access. The app may fetch short-lived signed URLs only after membership checks. | Signed URL minting, object delete cleanup, and any storage maintenance remain backend-controlled. | Public bucket URLs, direct `storage.objects` browsing, or unrelated bucket objects. | Private bucket + storage policies + signed URL API route. |

## Boundary rules by subsystem

### Spaces and space membership

- `spaces` is the outer tenancy boundary.
- `space_members` is the membership truth for entering that boundary.
- RLS should allow a user-session read only when `auth.uid()` has an active membership in the same space.
- Direct client-side insert/update/delete against these tables is not the MVP target.
- Space creation and member-management stay behind server actions that:
  - verify governance in app code
  - use service-role access only where the write spans multiple users or depends on auth-admin lookups

### Conversations and conversation members

- `conversation_members` is the inner chat-access boundary.
- `conversations` must not be readable just because a user is in the parent space; a matching active `conversation_members` row is required.
- Conversation mutations stay app-owned because they coordinate:
  - DM uniqueness
  - space scoping
  - group settings
  - summary projection maintenance
- DM privacy constraints and membership shape remain database-backed invariants, not UI-only rules.

### Messages and reactions

- Raw message visibility should be limited to active conversation members.
- Message history still needs app-owned read loaders because the MVP also depends on:
  - `visible_from_seq`
  - reply hydration
  - deleted-message shaping
  - encrypted DM fallback handling
- The hardening target is not “browser queries `messages` freely”; it is “all non-privileged reads remain membership-scoped, and the product read path stays on trusted loaders.”
- Reaction rows should inherit the same visibility as their parent message.
- Reaction writes should stay “own row only” and should not require service-role access.

### Media and file access

- Media metadata stays separate from blob storage.
- `message_assets` and `message_asset_links` remain the durable media metadata layer.
- Supabase Storage buckets for chat media stay private.
- Clients must not rely on permanent public URLs.
- The MVP read contract is:
  1. user proves conversation membership through the app/runtime
  2. app resolves the attachment against message membership
  3. app returns a short-lived signed URL
- `storage.objects` is not a product-facing API surface.

## Safest implementation order

1. Harden `spaces` and `space_members`.
   - This is the outer tenancy boundary and the safest first RLS slice.
   - Keep all member-management writes on the current backend-controlled path.

2. Harden `conversations` and `conversation_members`.
   - Require active conversation membership for reads.
   - Keep conversation creation, DM reuse, and participant mutations in server actions/API.

3. Harden `messages`.
   - Make conversation membership the raw read/write prerequisite.
   - Keep shaped history delivery and all normal writes in app-owned server flows.
   - Do not move encrypted or `visible_from_seq` logic into ad hoc client queries.

4. Harden `message_reactions`.
   - Tie read/write visibility to parent-message access.
   - Restrict mutations to the acting user’s own reaction rows.

5. Finish media/file access hardening.
   - Keep asset-table RLS as the metadata boundary.
   - Keep bucket private.
   - Keep signed URL issuance and cleanup in controlled backend paths.
   - Treat orphan cleanup as a follow-up job, not part of the first policy slice.

## Service-role allowance in the MVP

Service-role access remains acceptable only for:

- space creation and governed member-management flows
- auth-user lookups not available through authenticated session tables
- push fanout and delivery maintenance
- attachment signed URL minting after membership checks
- cleanup, repair, or migration helpers that are not end-user product reads

Service role should not become the default read path for:

- inbox
- activity
- thread history
- conversation lists
- reactions

## Defaults locked for the next hardening pass

- No public media buckets.
- No permanent public media URLs.
- Core read visibility is membership-scoped first by space, then by conversation.
- Core writes stay on server actions/API, even when RLS also allows the underlying row operation.
- The first hardening slice should target outer tenancy before message/reaction detail tables.
