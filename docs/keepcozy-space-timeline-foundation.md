# KeepCozy Space Timeline Foundation

## Purpose

This document defines the first additive foundation for a future unified
KeepCozy space timeline.

The goal is to introduce a structured operational-history layer that is:

- space-scoped
- distinct from user-authored chat messages
- compatible with thread companion metadata and primary object linkage
- safe to add without destabilizing the current CHAT runtime

This is a foundation document. It does not implement full event writing,
timeline rendering, notification fan-out, or policy enforcement yet.

Primary schema draft:

- [2026-04-07-space-timeline-events-foundation.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-07-space-timeline-events-foundation.sql)

Primary type source:

- [types.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/spaces/types.ts)

Related documents:

- [keepcozy-space-data-flow.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-data-flow.md)
- [keepcozy-space-thread-model.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-thread-model.md)
- [keepcozy-space-access-mapping-prep.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-access-mapping-prep.md)
- [keepcozy-space-foundation-implementation-plan.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-foundation-implementation-plan.md)
- [keepcozy-space-schema-companion-metadata.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-schema-companion-metadata.md)
- [keepcozy-space-backend-thread-object-links.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-backend-thread-object-links.md)
- [keepcozy-space-timeline-runtime-boundaries.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-timeline-runtime-boundaries.md)
- [keepcozy-space-contract-types.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-contract-types.md)

## Design Decisions Locked by This Pass

- a space timeline is not the same thing as chat history
- user-authored messages remain in `public.messages`
- structured operational/system events should live in their own additive layer
- the first timeline pass should be space-scoped, append-oriented, and
  compatible with thread/object linkage
- the first pass should prioritize structured operational events over mirroring
  every chat message into the timeline
- timeline rows may optionally point at a conversation shell, a message shell,
  or a primary operational object ref
- timeline writes, timeline rendering, access policy, and automation fan-out
  remain later branches

## 1. Why KeepCozy Needs a Space Timeline

KeepCozy spaces are intended to be operational memory units, not only message
containers.

That means the system eventually needs to answer questions like:

- when was this operational thread opened?
- when was a primary object linked to it?
- when did the work move from open to resolved?
- when did a contractor or supplier become involved?
- when did a document or media artifact become part of the work record?

Those are not the same thing as:

- who sent a message
- what body text they wrote
- how one thread currently renders inside chat history

The timeline layer exists to preserve meaningful operational history in a form
that is:

- structured
- searchable
- auditable
- suitable for later automation and notification work

## 2. Distinction Between Messages, Thread System Events, and Space Timeline Events

The repo now needs three distinct concepts to remain clear.

### User-authored messages

These remain in the current messaging layer:

- `public.messages`
- `public.message_assets`
- `public.message_asset_links`

They are:

- authored communication
- replyable/reactable chat content
- the source for thread message history

They are not:

- the full operational audit model
- a substitute for structured object status
- the unified space timeline by themselves

### Thread system events

These are future thread-local structured events that may later be rendered
inside a thread timeline beside chat messages.

Examples:

- status changed
- contractor assigned
- thread closed
- primary object linked

Important current-state note:

- the active runtime does not yet have a first-class thread system-event model
- this branch does not add one to `public.messages`

Recommended boundary:

- if thread-local system-event rendering is added later, it should consume the
  structured event layer or projections from it
- it should not overload `messages.kind`

### Space timeline events

These are future space-scoped structured event rows.

They are:

- append-oriented operational history
- compatible with thread and object linkage
- suitable for space-wide activity views and later automation

They are not:

- plain chat messages
- a replacement for operational object tables
- a per-user inbox/archive preference layer

## 3. First Practical Event Model

The first practical event model is one additive table:

- `public.space_timeline_events`

Recommended first-pass row shape:

| Field | Purpose |
| --- | --- |
| `id` | stable event identity |
| `space_id` | outer operational memory boundary |
| `conversation_id` | optional thread shell linkage |
| `message_id` | optional message-shell correlation |
| `operational_object_type` | optional primary object kind |
| `operational_object_id` | optional primary object id |
| `actor_user_id` | optional acting user |
| `event_type` | structured event category |
| `source_kind` | backend/source emitter classification |
| `occurred_at` | event ordering timestamp |
| `summary_payload` | compact renderable event-local metadata |
| `created_at` | row creation timestamp |

Design rule:

- `summary_payload` is for event-local display/routing details only
- it must not replace first-class operational object state
- it must not become a hidden copy of message bodies

## 4. First-Pass Committed Event Taxonomy

The first committed timeline pass should stay narrow.

Only durable, operationally meaningful state transitions should create
committed space timeline rows.

### First-pass committed event types

These belong in the first committed pass:

| Event type | Intended meaning | Typical source | Why it is safe first-pass history |
| --- | --- | --- | --- |
| `thread_created` | an operational thread shell was created as a real work lane | operational thread creation flow | creation of the work lane is a durable operational fact |
| `thread_metadata_attached` | companion metadata was first attached to an existing thread shell | conversation companion metadata write | marks the moment a generic thread became explicitly operational |
| `primary_object_linked` | a primary operational object was linked or re-linked | companion metadata or future object flow | links communication to a durable business record |
| `status_changed` | operational state changed in a meaningful way without being a close/reopen transition | companion metadata or object workflow | captures meaningful workflow movement without duplicating lifecycle-specialized events |
| `thread_closed` | the operational thread moved into a resolved/closed state | companion metadata or object workflow | closure is a durable business-history event |
| `thread_reopened` | a closed/resolved thread returned to active work | companion metadata or object workflow | reopening is a durable business-history event |

### Deferred event types

The following categories are intentionally deferred from the first committed
pass:

| Deferred type | Why it is deferred |
| --- | --- |
| `operator_joined` | depends on later access/policy interpretation of meaningful operator participation |
| `contractor_assigned` | needs assignment-aware backend truth, not just thread membership changes |
| `supplier_attached` | needs supplier/vendor workflow truth, not just thread metadata |
| `document_attached` | needs a more mature document/object linkage layer to avoid noisy attachment history |
| `media_attached` | needs clearer distinction between chat media and operational media linkage |
| `quality_review_opened` | should wait for a real quality-review object/workflow |
| `issue_opened` | should wait for a real issue/service object/workflow |
| `issue_resolved` | should wait for a real issue/service object/workflow |

Important first-pass boundary:

- this branch defines the committed event vocabulary and schema direction
- it intentionally does not claim that every useful future category belongs in
  the first emitted set

## 5. Which Events Stay Thread-Local or Deferred

Some events may eventually matter inside a thread timeline or audit surface,
but they should not become committed space timeline rows in the first pass.

### Thread-local or later-co-render candidates

These should stay thread-local or deferred until later rendering/policy work
exists:

- participant joined/left chatter that does not change operational assignment
- internal-only visibility annotations that are only diagnostic
- thread-level system notices that are useful in one thread but not meaningful
  as space-wide history
- selected message-derived system markers if later product work needs them

### Events that should not be emitted automatically yet

These should not auto-create committed timeline rows in the first pass:

- ordinary user message posted
- message edited
- message deleted
- reactions added or removed
- read receipts or unread-state changes
- typing or presence
- DM E2EE device/bootstrap/bundle events
- RTC/call/session events
- upload started/completed/failed diagnostics
- playback, buffering, or media runtime state
- retry/failure state for optimistic UI flows

Rule:

- if an event is primarily transport, UI, or diagnostics state, it does not
  belong in committed space history yet

## 6. Event Sources In Scope Now vs Deferred

### In scope for the foundation pass

This branch is in scope to define and support:

- the event vocabulary
- the additive schema draft
- optional linkage to:
  - one space
  - one conversation
  - one message
  - one primary operational object ref
- source classification for later writers such as:
  - `conversation`
  - `conversation_companion_metadata`
  - `operational_object`
  - `message_asset`
  - `system_process`
  - `manual_admin`

### Deferred for later implementation branches

The following are intentionally deferred:

- generic `message_posted`, `message_edited`, or `message_deleted` mirroring
- reactions, read receipts, typing, or presence
- DM E2EE bootstrap/device/bundle state
- RTC/call events
- voice playback/runtime diagnostics
- full notification and automation fan-out
- policy-aware visibility filtering
- event co-rendering inside chat history

Why this is the current preference:

- it keeps the first timeline pass focused on structured operational history
- it avoids turning the space timeline into a noisy duplicate of chat transport
- it keeps message history and operational history distinct

## 7. Commit Rules for Space Timeline Events

An event should be eligible for committed space history only if all of the
following are true:

1. it represents a durable operational fact rather than transient UI state
2. it is attributable to exactly one `space_id`
3. it is emitted only after the underlying write/transition has committed
4. it has a stable event category that later search/notifications can rely on
5. it can be summarized without depending on full message-body replay

Recommended commit rule:

- a timeline row should describe a meaningful operational transition, linkage,
  or lifecycle change
- it should not describe every intermediate step taken to get there

### Examples of eligible first-pass events

- an operational thread is intentionally created
- companion metadata is first attached to an existing thread shell
- a primary operational object ref is linked to the thread
- workflow status changes from `open` to `active`
- workflow status changes from `blocked` to `active`
- workflow status changes into a closed/resolved state
- a closed/resolved thread is reopened

### Examples that are not eligible yet

- user sent a normal message saying "I’m on my way"
- a voice message upload started or retried
- a UI filter changed
- a participant briefly opened the thread
- an optimistic thread patch temporarily showed `uploading`

## 8. Duplicate and Noise-Avoidance Rules

The first pass should prefer one committed timeline row per logical business
change.

Recommended rules:

- do not emit both `status_changed` and `thread_closed` for the same closing
  transition
- do not emit both `status_changed` and `thread_reopened` for the same
  reopening transition
- do not emit `thread_metadata_attached` repeatedly if the same metadata row is
  merely edited later
- do not emit `primary_object_linked` if the same object ref is rewritten
  without changing the logical link
- do not emit document/media events for low-level storage retries, upload
  phases, or attachment-metadata churn

Recommended interpretation:

- `status_changed` is for meaningful non-close/non-reopen workflow movement
- `thread_closed` and `thread_reopened` are specialized lifecycle events and
  should win over generic status-change mirroring for those transitions

## 9. Why Raw Chat Mirroring Is Deferred

The longer-term product may still choose to surface selected message-derived
events in a space-wide activity view.

But the first timeline foundation should not begin by mirroring every message
event because that would:

- obscure the distinction between authored discussion and structured history
- make the timeline look like another inbox feed
- create noisy write volume before event policy is settled
- complicate later audit and notification rules

Recommended rule:

- start with meaningful operational/system events
- add selected message-derived timeline events later only when there is a
  clear product reason

## 10. Schema Direction for the First Pass

The first SQL draft introduces:

- [2026-04-07-space-timeline-events-foundation.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-07-space-timeline-events-foundation.sql)

The draft is intentionally:

- additive
- append-oriented
- optional with respect to existing chat flows
- separate from `public.messages`
- separate from `public.conversation_companion_metadata`

Important first-pass choices:

- no attempt to redesign `public.messages`
- no attempt to co-render events inside thread history yet
- no attempt to model every possible event payload as first-class columns
- no RLS or grants yet
- no write integration yet
- no automatic message-to-timeline mirroring yet
- no explicit idempotency key in the first draft; later write paths must choose
  a dedupe strategy deliberately

Runtime boundary note:

- later backend event-emission seams are documented in
  [keepcozy-space-timeline-runtime-boundaries.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-timeline-runtime-boundaries.md)
- this branch defines the timeline model before wiring emitters into existing
  `server.ts` flows

## 11. Relationship to Companion Metadata and Thread-Object Linkage

The timeline layer builds on the already-established boundaries:

- companion metadata stores operational thread meaning
- the backend linking layer exposes optional operational thread context
- the timeline layer records meaningful committed events around that state

Recommended relationship:

- `public.conversation_companion_metadata`
  holds current thread-level operational metadata
- `public.space_timeline_events`
  records meaningful historical changes related to that thread/object

This distinction matters:

- metadata describes current state
- timeline rows describe historical occurrences

## 12. Guardrails and Non-Goals

The first timeline foundation is intentionally narrow.

It exists to protect the future operational-history layer from becoming noisy,
ambiguous, or prematurely coupled to the current chat runtime.

### Guardrails

- do not treat all chat messages as committed timeline events by default
- do not mix operational state transitions with UI-only, transport, playback,
  or diagnostics state
- do not emit committed timeline rows for unstable or pre-commit actions
- do not build notification fan-out or automation execution into this branch
- do not collapse thread-local system notices and committed space history into
  one model
- do not change current `dm | group` conversation semantics in order to make
  the timeline work

### Practical interpretation

- ordinary text, attachment, and voice messages stay in `public.messages`
  unless a later product rule deliberately promotes a selected message-derived
  event into the space timeline
- optimistic sends, upload retries, playback state, read-state changes, and
  presence remain out of committed space history
- per-user archive/hide state remains separate from operational close/reopen
  history
- thread-local system rendering, if added later, should remain distinct from
  committed `public.space_timeline_events`
- timeline writes should happen only after the underlying operational change is
  durable
- the timeline layer must not become a back door for changing conversation
  core fields, `messages.kind`, or DM/group meaning

### Non-goals of this branch

This branch does not:

- redesign the chat message model
- write operational events into `public.messages`
- require timeline rows for normal chat to function
- implement notification fan-out
- implement automation execution
- define final access-policy resolution
- define final event deduplication/idempotency strategy
- define final UI rendering for thread-local or space-wide timelines
- redefine `public.conversations.kind`
- attach timeline emission to ordinary message-send helpers

## 13. Current State vs Target State

### Current state

- chat messages are the dominant durable history layer
- companion metadata exists only as additive groundwork
- there is no unified space timeline table
- there is no runtime event-writing layer for operational history

### Target direction after this branch

- one additive `space_timeline_events` foundation exists
- shared types describe event categories and row shape
- later backend branches can write structured operational history without
  guessing the table or vocabulary
- future policy and UI branches can build on a clearer distinction between:
  - chat messages
  - thread-local system events
  - space-level operational history

## 14. Practical Handoff to Later Branches

### What `feature/space-access-mapping-prep` should own later

- interpretation of internal-only vs restricted-external visibility
- assignment-aware participant visibility
- operator oversight rules
- policy-aware filtering of timeline rows

Visibility-prep note:

- timeline-row visibility should later inherit from parent thread/object/space
  boundaries as described in
  [keepcozy-space-access-mapping-prep.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-access-mapping-prep.md)
- generic thread moderation role alone should not be treated as enough to
  decide committed timeline visibility

### What later event-writing branches should own

- when a companion metadata change becomes a committed timeline row
- when an operational object change emits a timeline row
- when message-asset or document linkage deserves a timeline row
- deduplication and transactional/event-commit strategy
- whether and when selected message-derived events ever join the space timeline

Practical rule:

- this branch defines what a structured space timeline event is
- later branches decide when and how those rows are emitted and filtered
