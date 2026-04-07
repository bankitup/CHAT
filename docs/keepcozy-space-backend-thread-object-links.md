# KeepCozy Space Backend: Thread-Object Links

## Purpose

This document explains the first backend foundation added for future
thread-to-operational-object linkage in KeepCozy.

It is intentionally narrower than a full product feature. The goal is to add
backend helper boundaries that understand the companion metadata layer without
changing current DM/group behavior or introducing UI-first coupling.

Primary backend helper:

- [conversation-companion-metadata.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/data/conversation-companion-metadata.ts)

Related documents:

- [keepcozy-space-schema-companion-metadata.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-schema-companion-metadata.md)
- [keepcozy-space-schema-runtime-boundaries.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-schema-runtime-boundaries.md)
- [keepcozy-space-contract-types.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-contract-types.md)
- [keepcozy-space-thread-model.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-thread-model.md)
- [keepcozy-space-data-flow.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-data-flow.md)
- [server.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/data/server.ts)

## What This Branch Adds

This branch adds a small server-only helper layer for future conversation-level
companion metadata work.

Current helper categories:

- row building from the logical companion-metadata contract
- row-to-contract normalization
- low-level reads by one or many `conversation_id` values
- low-level upsert for one companion metadata row
- schema-missing error detection for the additive companion table

Important design rule:

- these helpers are backend boundaries, not active runtime behavior changes

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

### Contract/schema boundary

- `isConversationCompanionMetadataSchemaCacheErrorMessage(...)`

Important naming rule:

- `WithoutAccessCheck` is intentional

That suffix means the helper must not be treated as a final application-level
policy boundary.

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

### Recommended first read wrapper later

Add nullable companion-metadata reads at conversation-level loaders in:

- [server.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/data/server.ts)
  `getConversationForUser(...)`
- [server.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/data/server.ts)
  `getConversationSummaryForUser(...)`

The current helper is intentionally ready for that later step because it
already supports:

- single-conversation reads
- batched reads by `conversation_id`
- row normalization into the logical contract shape

## What This Branch Intentionally Does Not Do

This backend foundation still does not:

- change current conversation creation behavior
- change current inbox/chat loading behavior
- attach companion metadata to message-history payloads
- validate object references against real operational tables
- add related-object join-table behavior
- change DM/group semantics
- change RLS or policy behavior

That scope remains deferred on purpose.

## How Plain Runtime Behavior Stays Separate

This branch keeps the distinction explicit:

- current `public.conversations.kind` remains `dm | group`
- plain conversation behavior still works without any companion row
- operational thread metadata is additive and optional
- object-link helpers do not redefine what a conversation is

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

## Practical Handoff To The Next Phase

The next backend branch should treat this helper file as the low-level adapter
layer and then add:

1. access-checked wrappers in the messaging data service
2. one controlled operational thread creation path
3. one controlled conversation-level read path

That keeps the migration path additive and avoids coupling unfinished
operational objects to current chat behavior too early.
