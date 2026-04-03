# Space Model v1

Purpose:

- define the minimal v1 space model for CHAT
- make conversation tenancy explicit before broader product rollout
- keep space access boundaries separate from DM E2EE confidentiality

## What a space is

A space is the top-level container for one project, team, or client context.

In v1, a space:

- has its own name
- has its own member set
- has its own owner/admin/member boundary
- contains both direct messages and group chats

The active app context should become one selected space at a time.

Current rollout note:

- until broader space UX lands, current messaging activity is temporarily scoped into one default space named `TEST`
- authenticated users now land on a space selection screen first, then enter chats inside the chosen space

## Core model

### `public.spaces`

Space metadata and ownership shell.

Minimum v1 responsibility:

- identify the space
- store its display name
- record the creating/owning user

### `public.space_members`

Membership and coarse permissions for entering the space.

Minimum v1 roles:

- `owner`
- `admin`
- `member`

This is the broader access boundary for everything inside the space. It is not
an encryption boundary and it does not imply message plaintext visibility.

### `public.conversations.space_id`

Every conversation belongs to one space.

Rules:

- every DM belongs to one specific space
- every group chat belongs to one specific space
- there are no cross-space conversations
- there are no global DMs outside spaces

## How DMs behave inside spaces

DMs are scoped to a specific space, not to the entire product.

That means:

- the same two users may need different DMs in different spaces
- DM uniqueness must become `space_id + dm_key`, not global `dm_key`
- DM membership is still defined in `public.conversation_members`, but the
  conversation itself must sit inside a parent space

## Space membership vs conversation membership

These are related but not the same thing.

`public.space_members`:

- decides whether a user belongs to the broader project/team/client space
- carries coarse space role such as `owner`, `admin`, or `member`
- should be the outer allowlist for entering the space

`public.conversation_members`:

- decides whether a user is an active participant in a specific DM or group
- carries per-conversation role and participation state
- should only be valid inside the parent space boundary

Practical v1 rule:

- a conversation member should also be a member of that conversation's parent space

## Space access vs E2EE confidentiality

These are different boundaries and must stay different.

Space access boundary:

- who can enter a space
- who can list the conversations in that space
- who can create or administer conversations in that space

DM E2EE confidentiality boundary:

- who can decrypt DM text on a client device
- which device holds the private keys
- whether plaintext ever reaches the server

Critical rule:

- space owners and space admins do not gain DM plaintext access by role alone

They may be able to manage access to the space, but they must not gain support,
operator, or database-side decryption powers from that role.

## Runtime status in this patch

Implemented now:

- explicit schema design for spaces
- migration draft for `spaces`, `space_members`, and `conversations.space_id`
- migration draft to seed a default `TEST` space and backfill current conversations into it
- narrow operational alignment SQL for environments where spaces exist but
  `conversations.space_id` is missing or null on legacy rows
- documentation of the access boundary and DM-in-space rules
- runtime active-space scoping for inbox, activity, and chat entry via `?space=<space_id>`
- post-login routing into a minimal space selection screen before messenger entry
- inbox, DMs, and Activity require an explicit selected space and redirect back to `/spaces` when that context is missing or invalid
- conversation access validation against the parent conversation space
- space-aware DM/group creation inputs from the inbox flow
- main chat action redirects preserve the active selected space for the current v1 messaging flow
- temporary v1 stability fallback for `/inbox` entry: when `space_members` lookup fails via API/schema-cache mismatch, the requested space may be accepted only if it resolves to the default `TEST` space

Not implemented yet:

- full active-space switcher UI
- persisted active-space selection beyond the current explicit `?space=<space_id>` entry model
- space-aware settings UI
- realtime filtering refinements by active space
- full space scoping across every remaining action redirect and secondary workflow
- richer multi-space management beyond simple selection

## Default TEST space behavior

For the first space-aware rollout step, the app treats existing messaging activity as belonging to one default space named `TEST`.

That means:

- legacy conversations are backfilled into `TEST`
- users who already participate in conversations are added to `TEST`
- new DM and group activity continues inside the selected space, which will initially be `TEST` for current users

This is a migration and rollout boundary, not a long-term product limit. The purpose is to establish one explicit space before adding broader space selection UX.

Operational SQL references:

- [2026-04-03-spaces-v1.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-03-spaces-v1.sql)
- [2026-04-03-spaces-default-test-backfill.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-03-spaces-default-test-backfill.sql)
- [2026-04-03-conversations-space-id-v1-align.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-03-conversations-space-id-v1-align.sql)

## Query and routing surfaces to scope next

These are the main surfaces that should become more fully selected-space aware next:

- [server.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/data/server.ts)
  conversation queries, DM reuse, conversation creation, and available-user lookup
- [actions.ts](/Users/danya/IOS%20-%20Apps/CHAT/app/%28app%29/inbox/actions.ts)
  new DM/group creation
- [actions.ts](/Users/danya/IOS%20-%20Apps/CHAT/app/%28app%29/chat/%5BconversationId%5D/actions.ts)
  conversation-specific updates
- [page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/%28app%29/inbox/page.tsx)
  already scoped; still needs eventual space-switcher integration
- [page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/%28app%29/activity/page.tsx)
  already scoped; still needs eventual space-switcher integration
- [page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/%28app%29/chat/%5BconversationId%5D/page.tsx)
  already scoped on entry; still needs broader action/redirect normalization
- [inbox-sync.tsx](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/realtime/inbox-sync.tsx)
- [active-chat-sync.tsx](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/realtime/active-chat-sync.tsx)

## What should come next

1. Add a lightweight active-space switcher and selected-space persistence UX.
2. Scope the remaining chat action redirects and realtime helpers more explicitly by `space_id`.
3. Split activity out of the default `TEST` space into user-meaningful spaces and then tighten
   `public.conversations.space_id` to `not null`.
