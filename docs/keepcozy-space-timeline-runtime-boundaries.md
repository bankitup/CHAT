# KeepCozy Space Timeline: Runtime Boundaries

## Purpose

This document explains where future committed space timeline events should be
emitted in the current CHAT codebase, and where they should not be emitted.

It exists so the timeline foundation does not stay purely conceptual and so
later branches do not scatter event commits across unrelated messaging flows.

Related documents:

- [keepcozy-space-timeline-foundation.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-timeline-foundation.md)
- [keepcozy-space-backend-thread-object-links.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-backend-thread-object-links.md)
- [keepcozy-space-schema-companion-metadata.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-schema-companion-metadata.md)
- [keepcozy-space-foundation-implementation-plan.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-foundation-implementation-plan.md)
- [space-timeline-events.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/spaces/space-timeline-events.ts)
- [server.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/data/server.ts)
- [server.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/spaces/server.ts)

## Current Foundation on This Branch

This branch now provides:

- a space-scoped event vocabulary
- an additive SQL draft for `public.space_timeline_events`
- a low-level row builder in
  [space-timeline-events.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/spaces/space-timeline-events.ts)
  `buildSpaceTimelineEventRow(...)`

Important current-state rule:

- this branch still does not wire runtime event commits into existing chat
  flows

That is intentional. The branch defines the commit seam without broadly
changing behavior.

## Where a Future Timeline Event Commit Helper Should Live

The low-level timeline event commit helper should live in the spaces module:

- [space-timeline-events.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/spaces/space-timeline-events.ts)

Why this is the preferred home:

- timeline rows are space-scoped operational history, not message-shell state
- the helper must remain usable by both messaging-aware flows and later
  operational-object flows
- keeping it outside `server.ts` helps avoid accidental coupling to ordinary
  chat send behavior

Recommended layering:

1. low-level row builder / direct table adapter in `src/modules/spaces`
2. access-checked emitters in the service layer that owns the underlying state
   transition
3. no direct event writes from UI/server-action entrypoints

## Likely Future Event Emitters

Committed timeline events should be emitted by backend flows that already own a
durable operational transition.

### Likely messaging-side emitters later

These are good candidates for later access-checked emitters:

- a future operational-thread creation wrapper adjacent to
  [server.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/data/server.ts)
  `createConversationWithMembers(...)`
- a future access-checked wrapper around companion metadata writes built on
  [conversation-companion-metadata.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/data/conversation-companion-metadata.ts)

Why:

- these flows own durable thread-shell or metadata transitions
- they can decide whether a change is eligible for committed history before
  calling the low-level timeline helper

Important boundary:

- do not emit directly from `createConversationWithMembers(...)` itself;
  emit only from a later operational-thread wrapper that intentionally owns
  the richer KeepCozy semantics
- do not emit directly from
  `conversation-companion-metadata.ts`; let a later access-checked wrapper
  decide whether a metadata write is timeline-worthy first

### Likely operational-object emitters later

These are good candidates for later branches once real object tables exist:

- service request create/resolve flows
- work order assign/close flows
- inspection create/complete flows
- document/object linkage flows

Why:

- those flows own the business record truth
- they are better placed than chat send paths to decide when an event is
  operationally meaningful

## Existing Paths That Should Remain Untouched on This Branch

The following paths should not emit committed timeline events in this branch:

- [conversation-companion-metadata.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/data/conversation-companion-metadata.ts)
  low-level companion-metadata row reads/writes
- [conversation-thread-context.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/data/conversation-thread-context.ts)
  access-checked conversation-level read composition
- [server.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/data/server.ts)
  `sendMessage(...)`
- [server.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/data/server.ts)
  `sendMessageWithAttachment(...)`
- [message-shell.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/data/message-shell.ts)
  `buildMessageInsertPayload(...)`
- [server.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/data/server.ts)
  `getConversationForUser(...)`
- [server.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/data/server.ts)
  `getConversationSummaryForUser(...)`
- [server.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/data/server.ts)
  `getConversationHistorySnapshot(...)`
- [server.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/data/server.ts)
  `markConversationRead(...)`
- archive/hide flows driven by `conversation_members.hidden_at`
- [server.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/spaces/server.ts)
  active space lookup and space-membership resolution

Reason:

- these paths either describe ordinary chat behavior, read-model loading, or
  personal visibility state
- some are intentionally low-level adapters or read composition helpers and
  should not become event-policy decision makers
- they do not own committed operational history semantics yet

## How to Avoid Coupling Ordinary Chat Sends to Timeline Emission Too Early

Ordinary message send flows should stay separate from committed space history
until product rules explicitly say otherwise.

Guardrails:

- do not emit a timeline row for every text, attachment, or voice message send
- do not emit timeline rows from optimistic send states
- do not emit timeline rows from upload started/completed/failed diagnostics
- do not emit timeline rows from reactions, read-state changes, or typing
- do not emit timeline rows from message-history reads

If later product work needs selected message-derived events, add them through a
deliberate event-policy branch, not by piggybacking on generic send helpers.

## Recommended Future Emission Sequence

When later branches add real event writes, the safest order is:

1. complete the underlying operational write
2. determine whether the change is eligible for committed space history
3. build the timeline row through
   [space-timeline-events.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/spaces/space-timeline-events.ts)
4. insert the row through a low-level timeline adapter
5. only then expose or consume it from timeline-aware reads

Important rule:

- do not emit the event before the parent write is durably committed

## What Must Wait for Later Branches

### `feature/space-access-mapping-prep`

This later branch should own:

- policy-aware filtering of timeline rows
- interpretation of internal-only vs restricted-external audience
- operator oversight rules
- assignment-aware visibility rules

The timeline helper must not become a policy engine before that work lands.

### Later event-writing branches

Later branches should own:

- event idempotency/deduplication strategy
- transactional sequencing or outbox strategy
- whether selected message-derived events ever join the timeline
- notification and automation fan-out
- thread-local co-rendering of structured events in chat history

## Practical Rule for Later Work

If a later branch needs to emit a committed space timeline row:

- emit it from the backend service that owns the committed operational change
- use the shared timeline helper as a low-level builder/adapter
- keep generic chat send flows unchanged unless product rules explicitly widen
  the event model
