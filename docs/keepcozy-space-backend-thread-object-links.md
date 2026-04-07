# KeepCozy Space Backend: Thread-Object Links

## Purpose

This document explains the first backend foundation added for future
thread-to-operational-object linkage in KeepCozy.

It is intentionally narrower than a full product feature. The goal is to add
backend helper boundaries that understand the companion metadata layer without
changing current DM/group behavior or introducing UI-first coupling.

Primary backend helper:

- [conversation-companion-metadata.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/data/conversation-companion-metadata.ts)
- [conversation-thread-context.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/data/conversation-thread-context.ts)

Related documents:

- [keepcozy-space-schema-companion-metadata.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-schema-companion-metadata.md)
- [keepcozy-space-schema-runtime-boundaries.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-schema-runtime-boundaries.md)
- [keepcozy-space-contract-types.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-contract-types.md)
- [keepcozy-space-thread-model.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-thread-model.md)
- [keepcozy-space-data-flow.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-data-flow.md)
- [server.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/data/server.ts)

## What This Branch Adds

This branch adds a small server-only helper layer for future conversation-level
companion metadata work, plus one narrow access-checked fetch composition path
that can expose optional operational thread context without widening current
chat payloads.

Current helper categories:

- row building from the logical companion-metadata contract
- row-to-contract normalization
- low-level reads by one or many `conversation_id` values
- low-level upsert for one companion metadata row
- access-checked conversation-level fetch composition for optional operational
  thread context
- schema-missing error detection for the additive companion table

Important design rule:

- these helpers are backend boundaries, not active runtime behavior changes

## Guardrails for This Branch

This backend link layer is intentionally narrow.

### Allowed on this branch

This branch may:

- read and normalize companion metadata through backend-only helpers
- compose optional operational thread context beside an already
  access-checked conversation shell
- expose a nullable primary operational object ref as backend data only
- verify local consistency between the conversation shell and companion row
- document where later write, timeline, and access work should happen

### Not allowed on this branch

This branch must not:

- redefine what `public.conversations.kind` means
- make companion metadata required for ordinary `dm` or `group` conversations
- add UI or page-level dependence on operational thread context
- treat companion metadata as a source of authorization truth
- emit timeline events
- validate operational object existence against future domain tables
- infer thread moderation authority from operational roles
- blur private messaging trust assumptions with operational-thread visibility

### Practical non-goal

If a conversation has no companion row, current chat behavior should remain
unchanged.

## Explicit Backend Boundary Map

The current branch should be read as having one direct companion-metadata
adapter file and several future wrapper seams around it.

| Path | Current role on this branch | Status |
| --- | --- | --- |
| [conversation-companion-metadata.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/data/conversation-companion-metadata.ts) | direct low-level adapter for `public.conversation_companion_metadata` | active on this branch |
| [conversation-thread-context.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/data/conversation-thread-context.ts) | access-checked conversation-level read composition helper for optional operational thread context | active on this branch |
| [server.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/data/server.ts) `createConversationWithMembers(...)` | future access-checked write wrapper seam | unchanged in this branch |
| [server.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/data/server.ts) `getConversationForUser(...)` | access-checked base conversation read seam used by the composition helper | unchanged in this branch |
| [server.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/data/server.ts) `getConversationSummaryForUser(...)` | future access-checked summary read seam | unchanged in this branch |
| [server.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/data/server.ts) `getConversationHistorySnapshot(...)` | message-history loader that should stay free of early companion-metadata coupling | intentionally unchanged |
| [server.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/spaces/server.ts) | space-boundary resolution layer | intentionally unchanged |
| [actions.ts](/Users/danya/IOS%20-%20Apps/CHAT/app/%28app%29/inbox/actions.ts) | UI/server-action entrypoints that should stay thin | intentionally unchanged |

Practical rule:

- only `conversation-companion-metadata.ts` should touch the companion table
  directly in the current branch
- all later access-checked usage should flow through messaging data service
  wrappers or composition helpers, not directly from UI or page code

## Why The Helper Is Low-Level

The helper intentionally does not try to become the final application service.

That is deliberate because this branch still does not decide:

- who is allowed to create each operational thread type
- how object existence should be validated against future domain tables
- what later policy matrix rules should apply
- whether conversation creation plus companion write should be transactional,
  sequential, or handled through another server-side boundary

So the current helper is intentionally narrower:

- useful enough for the next backend branch
- not broad enough to silently change current runtime behavior

## Current Helper Boundaries

The helper currently introduces these backend seams:

### Write boundary

- `buildConversationCompanionMetadataRow(...)`
- `upsertConversationCompanionMetadataWithoutAccessCheck(...)`

### Read boundary

- `getConversationCompanionMetadataWithoutAccessCheck(...)`
- `getConversationCompanionMetadataByConversationIdsWithoutAccessCheck(...)`
- `getConversationOperationalThreadContextForUser(...)`

### Contract/schema boundary

- `isConversationCompanionMetadataSchemaCacheErrorMessage(...)`

Important naming rule:

- `WithoutAccessCheck` is intentional

That suffix means the helper must not be treated as a final application-level
policy boundary.

Additional rule:

- the access-checked read composition helper is still not a policy engine
- it may expose metadata only after existing conversation access succeeds
- it must not become the place where internal-only or restricted-external
  resolution rules are invented ad hoc

## How These Helpers Should Be Used Later

The next backend branch should wrap these low-level helpers inside existing
conversation-level flows instead of calling them directly from UI code.

### Recommended first write wrapper later

Add an access-checked wrapper near conversation creation in:

- [server.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/data/server.ts)

Preferred direction:

- keep `createConversationWithMembers(...)` as the shell creator
- add a later wrapper such as:
  - `createConversationWithOperationalMetadata(...)`
  - or `createOperationalConversationWithMembers(...)`
- only operational thread flows should write companion metadata

### First read wrapper now in place

This branch now adds one nullable, access-checked conversation-level fetch
wrapper in:

- [conversation-thread-context.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/data/conversation-thread-context.ts)
  `getConversationOperationalThreadContextForUser(...)`

That helper currently:

- delegates access checking and base conversation loading to
  [server.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/data/server.ts)
  `getConversationForUser(...)`
- delegates direct companion-row access to
  [conversation-companion-metadata.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/data/conversation-companion-metadata.ts)
- returns a future-facing, optional context shape with:
  - the existing conversation shell
  - nullable companion metadata
  - nullable primary operational object ref

This keeps the first read integration explicit and narrow:

- current callers of `getConversationForUser(...)` remain unchanged
- current message-history and UI payloads remain unchanged
- higher layers can opt into operational thread context later through one
  backend seam
- policy decisions still stay outside this helper

### Recommended next read expansion later

If later branches need broader coverage, the next safe additions are still:

- nullable companion-aware summary composition near
  [server.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/data/server.ts)
  `getConversationSummaryForUser(...)`
- batched access-checked wrappers that build on the existing low-level
  batch-read helper

## What This Branch Intentionally Does Not Do

This backend foundation still does not:

- change current conversation creation behavior
- change current inbox/chat loading behavior by default
- attach companion metadata to message-history payloads
- validate object references against real operational tables
- add related-object join-table behavior
- change DM/group semantics
- change RLS or policy behavior

That scope remains deferred on purpose.

## What Must Wait for `feature/space-timeline-foundation`

The following concerns belong to the later timeline branch, not this one:

- committed `space_timeline_events` writes
- event categories for thread open/close/object-link activity
- fan-out from thread/object updates into space-level audit history
- automation hooks triggered from committed operational events
- any attempt to make thread-object linkage the same thing as timeline history

Rule:

- this backend link layer may expose thread context
- it must not start acting like the durable event log

## What Must Wait for `feature/space-access-mapping-prep`

The following concerns belong to the later access-mapping branch, not this one:

- translation from global role to space role to thread participation scope
- internal-only or restricted-external participant resolution
- assignment-aware access scoping for contractors, suppliers, or inspectors
- operator-visibility exception handling
- any policy layer that interprets companion metadata as permission state

Rule:

- this branch may expose `audienceMode` and policy-oriented metadata fields
- it must not enforce or derive final audience policy from them yet

## What Stays Unchanged On This Branch

These paths are intentionally stable in this branch:

- conversation creation behavior in
  [server.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/data/server.ts)
  `createConversationWithMembers(...)`
- conversation detail/summary behavior in
  [server.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/data/server.ts)
  `getConversationForUser(...)` and `getConversationSummaryForUser(...)`
- message-history behavior in
  [server.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/data/server.ts)
  `getConversationHistorySnapshot(...)`
- active space resolution in
  [server.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/spaces/server.ts)
- inbox/chat server actions in
  [actions.ts](/Users/danya/IOS%20-%20Apps/CHAT/app/%28app%29/inbox/actions.ts)

This is intentional. The branch adds low-level capability, not product-facing
integration.

The new read composition helper does not change that principle because it is:

- server-only
- opt-in
- not wired into existing page or action callers yet

## How Plain Runtime Behavior Stays Separate

This branch keeps the distinction explicit:

- current `public.conversations.kind` remains `dm | group`
- plain conversation behavior still works without any companion row
- operational thread metadata is additive and optional
- object-link helpers do not redefine what a conversation is

What must not leak from this branch into current runtime semantics:

- `threadType` must not replace `dm` or `group`
- `audienceMode` must not replace join-policy or membership checks
- `status` must not replace archive/hide behavior
- `primaryOperationalObjectRef` must not become required for ordinary chat
- operator visibility assumptions must not be read as DM decrypt authority

This is the core reason the helper layer lives beside the current messaging
data service instead of replacing it.

## How A Thread Carries A Primary Operational Object Ref

In this first backend foundation, a thread carries a primary object reference
only through companion metadata fields:

- `operational_object_type`
- `operational_object_id`

The helper layer mirrors that by:

- accepting a logical `primaryOperationalObjectRef`
- flattening it to the first SQL-pass row shape
- reconstructing it when rows are read back

This preserves the first-pass schema rule:

- one optional thread-level primary object ref
- no secondary related-object links yet

## What Must Wait For Later Branches

The following belong to later branches:

- access-checked operational thread creation flows
- object existence validation against real `service_requests`, `work_orders`,
  or other future tables
- conversation summary enrichment with companion metadata
- related-object links
- timeline event emission
- policy and RLS hardening

## Misuse Checklist for Later Branches

Before reusing this backend link layer, later branches should stop and check:

- am I adding optional context, or silently changing the base conversation
  contract?
- am I reading companion metadata after an existing conversation access check,
  or trying to use it to replace one?
- am I keeping timeline writes out of this layer?
- am I keeping operational-role semantics out of moderation fields?
- am I preserving `dm | group` as the only current conversation shell meaning?

## Practical Handoff To The Next Phase

The next backend branch should treat this helper file as the low-level adapter
layer and then add:

1. access-checked wrappers in the messaging data service
2. one controlled operational thread creation path
3. expand from the current single-conversation read composition helper only if
   summary or batched read needs become concrete

That keeps the migration path additive and avoids coupling unfinished
operational objects to current chat behavior too early.
