# KeepCozy Space Schema: Runtime Boundaries

## Purpose

This document explains where the future companion metadata layer should later
be read and written in the current CHAT codebase.

It exists so the schema branch does not draft `public.conversation_companion_metadata`
in a vacuum. The goal is to give the next backend-focused branch clear seams to
work from without changing current runtime behavior on this branch.

Related documents:

- [keepcozy-space-schema-companion-metadata.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-schema-companion-metadata.md)
- [keepcozy-space-backend-thread-object-links.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-backend-thread-object-links.md)
- [keepcozy-space-contract-types.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-contract-types.md)
- [keepcozy-space-foundation-implementation-plan.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-foundation-implementation-plan.md)
- [keepcozy-space-thread-model.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-thread-model.md)
- [server.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/data/server.ts)
- [server.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/spaces/server.ts)
- [actions.ts](/Users/danya/IOS%20-%20Apps/CHAT/app/%28app%29/inbox/actions.ts)

## Current Live Boundaries

The current runtime already has a clean enough shell to support later
companion-metadata integration.

### Current write seam

Conversation creation is centralized in:

- [server.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/data/server.ts)
  `createConversationWithMembers(...)`

Current UI entry points call that helper rather than writing `public.conversations`
directly:

- [actions.ts](/Users/danya/IOS%20-%20Apps/CHAT/app/%28app%29/inbox/actions.ts)
  `createDmAction(...)`
- [actions.ts](/Users/danya/IOS%20-%20Apps/CHAT/app/%28app%29/inbox/actions.ts)
  `createGroupAction(...)`

### Current read seams

Conversation detail and summary loading are centralized in:

- [server.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/data/server.ts)
  `getConversationForUser(...)`
- [server.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/data/server.ts)
  `getConversationSummaryForUser(...)`
- [server.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/data/server.ts)
  `getConversationHistorySnapshot(...)`

Space selection and outer space visibility are currently resolved in:

- [server.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/spaces/server.ts)
  `getUserSpaces(...)`
- [server.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/spaces/server.ts)
  `resolveActiveSpaceForUser(...)`

Important boundary:

- `src/modules/spaces/server.ts` currently resolves the outer space shell and
  membership boundary
- `src/modules/messaging/data/server.ts` currently resolves conversation shell,
  membership, history, and summary data

That split should stay intact when companion metadata arrives.

Current branch note:

- the first low-level backend helper now exists in
  [conversation-companion-metadata.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/data/conversation-companion-metadata.ts)
- the remaining work is to wrap that helper in access-checked conversation
  flows rather than adding a brand-new helper style

## Future Write Boundary

The preferred future write boundary is:

- keep UI/server actions thin
- write companion metadata from a server-side messaging data helper
- do not let forms or client components write companion rows directly

### Recommended first integration shape

The current backend foundation already provides a low-level upsert helper in:

- [conversation-companion-metadata.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/data/conversation-companion-metadata.ts)
  `upsertConversationCompanionMetadataWithoutAccessCheck(...)`

Later backend work should add an access-checked wrapper adjacent to
`createConversationWithMembers(...)`, for example:

- `createConversationWithOperationalMetadata(...)`
- or `createOperationalConversationWithMembers(...)`

The important design rule is the same either way:

- companion metadata writes should happen in the messaging data service layer,
  not in `app/(app)/...` server actions

### Recommended write sequence later

The safest additive sequence for the first real integration is:

1. create the conversation shell with the existing conversation helper
2. create conversation members with the existing membership logic
3. only if the new flow is an operational thread, write the optional
   companion row
4. if companion metadata write fails, return a controlled server error or use a
   narrow cleanup strategy chosen in that later branch

Important boundary:

- this branch does not choose the final transactional mechanism
- a later backend branch can decide between:
  - sequential helper calls plus cleanup
  - a database function / RPC
  - another narrow transaction strategy

What matters here is that the write boundary stays centralized and server-side.

### What Should Not Write Companion Metadata Later

The following should not become direct writers of companion rows:

- [actions.ts](/Users/danya/IOS%20-%20Apps/CHAT/app/%28app%29/inbox/actions.ts)
  `createDmAction(...)`
- [actions.ts](/Users/danya/IOS%20-%20Apps/CHAT/app/%28app%29/inbox/actions.ts)
  `createGroupAction(...)`
- client components or forms
- message-send helpers
- thread history loaders

Those callers should continue to delegate to backend helpers instead.

## Future Read Boundary

The preferred future read boundary is:

- add a dedicated companion-metadata read helper in the messaging data layer
- keep reads nullable and additive at first
- join companion metadata at conversation-level boundaries, not per-message

### Recommended first read helpers later

The current backend foundation already provides low-level reads in:

- [conversation-companion-metadata.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/data/conversation-companion-metadata.ts)
  `getConversationCompanionMetadataWithoutAccessCheck(...)`
- [conversation-companion-metadata.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/data/conversation-companion-metadata.ts)
  `getConversationCompanionMetadataByConversationIdsWithoutAccessCheck(...)`

Later backend work should wrap those in access-checked conversation loaders,
for example:

- `getConversationCompanionMetadata(conversationId, userId)`
- `getConversationCompanionMetadataByConversationIds(conversationIds, userId)`

These helpers should:

- read zero-or-one companion row per conversation
- validate `space_id` and `conversation_id` expectations
- remain safe when no companion row exists
- return future-facing metadata without mutating current `dm | group` meaning

### Where Reads Should Be Introduced First

The safest first consumers later are:

- [server.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/data/server.ts)
  `getConversationForUser(...)`
- [server.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/data/server.ts)
  `getConversationSummaryForUser(...)`

These are good first seams because they already shape conversation-level data
for screens and actions.

### Where Reads Should Wait

The following should not be the first place companion metadata is introduced:

- per-message mapping inside `getConversationHistorySnapshot(...)`
- message media or voice attachment helpers
- DM E2EE helpers
- `src/modules/spaces/server.ts`

Reason:

- companion metadata is thread-level, not message-level
- adding it to history snapshot internals too early would couple operational
  thread semantics to message rendering work
- adding it to spaces helpers too early would blur the boundary between
  outer-space resolution and thread-level metadata

## Existing Code Paths That Should Remain Untouched On This Branch

This schema branch should not mutate behavior in:

- [actions.ts](/Users/danya/IOS%20-%20Apps/CHAT/app/%28app%29/inbox/actions.ts)
- [server.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/data/server.ts)
  conversation creation, summary, and history behavior
- [server.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/spaces/server.ts)
  active-space lookup behavior
- current DM/group meaning in `public.conversations.kind`
- current thread membership/moderation meaning in `public.conversation_members.role`
- current archive behavior in `conversation_members.hidden_at`

This branch is schema and documentation groundwork only.

## What Must Wait For Later Branches

The following should wait for later backend-focused work such as a
thread-object-links branch:

- object existence validation against real operational tables
- writes that populate companion metadata from real operational thread creation
  flows
- companion metadata reads inside user-facing conversation screens
- related-object link tables
- timeline event writes
- invitation or assignment-aware visibility enforcement
- RLS and policy hardening for the new table

## Recommended Integration Order After This Branch

The safest follow-on order is:

1. add backend helper boundaries for reading and writing companion metadata
2. integrate companion writes for one controlled operational thread creation
   flow
3. integrate nullable companion reads at conversation-level loaders
4. add object validation and later related-object links only after real
   operational tables exist
5. add policy and RLS hardening after the policy matrix is settled

Recommended next feature branch:

- `feature/space-backend-thread-object-links`

## Practical Rule For The Next Backend Branch

If the next branch needs companion metadata, use this rule:

- read and write it in the messaging data service layer
- keep it optional
- keep it conversation-level
- do not scatter it through UI actions or message-mapping code first

That keeps the migration path additive and reviewable.
