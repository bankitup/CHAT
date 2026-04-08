# KeepCozy Space Data Flow

## Purpose

This document defines how data, storage, and history should be organized around
`space` as KeepCozy evolves from the current CHAT runtime.

The goal is to make the space the durable operational memory unit, while
keeping chat as one important contributor to that memory rather than the only
source of truth.

This is an architecture document. It is intended to guide later schema, RLS,
storage, search, automation, and UI work without forcing risky runtime changes
in the current app.

Related documents:

- [keepcozy-space-model-spec.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-model-spec.md)
- [keepcozy-space-access-model.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-access-model.md)
- [keepcozy-role-layering.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-role-layering.md)
- [keepcozy-space-thread-model.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-thread-model.md)
- [keepcozy-space-timeline-foundation.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-timeline-foundation.md)
- [schema-assumptions.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/schema-assumptions.md)
- [schema-requirements.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/schema-requirements.md)
- [media-rtc-architecture.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/media-rtc-architecture.md)
- [voice-message-foundation.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/voice-message-foundation.md)
- [encrypted-voice-asset-contract.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/encrypted-voice-asset-contract.md)
- [security/e2ee-security-model.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/security/e2ee-security-model.md)

## Design Decisions Locked by This Pass

- `space` is the operational memory unit
- chat is one contributor to operational history, not the only durable source
  of truth
- richer operational thread meaning should prefer a future companion metadata
  layer instead of overloading `public.conversations.kind`
- operational threads are intended to be auditable and operator-visible by
  default
- private messaging may follow a different trust mode and should not become the
  main operational history system for a space
- major operational records should prefer first-class tables over a premature
  generic reference abstraction

## 1. Why Space Is the Operational Memory Unit

A KeepCozy space represents one managed property, home, or operational object.
That means the system needs to remember more than chat history alone.

The operational memory for a space should eventually include:

- communication threads
- structured work records
- documents and media
- assignments and ownership changes
- inspections, orders, and incident history
- system-generated events
- automation-visible state transitions

Chat remains essential, but it should not be the only durable record of what
happened in a space. Free-text messages are good for discussion, but they are
weak as the sole source for:

- workflow state
- audit history
- search and reporting
- notification targeting
- automation triggers

The design principle is:

- `space` is the outer memory boundary
- threads are communication lanes inside that boundary
- structured objects hold operational truth
- timeline events connect those layers into a searchable history

## 2. Recommended Top-Level Entities

KeepCozy should treat the following entities as the core data map for a space.

### Existing active foundation

These already exist in the current CHAT runtime and should remain foundational:

- `public.spaces`
- `public.space_members`
- `public.conversations`
- `public.conversation_members`
- `public.messages`
- `public.message_assets`
- `public.message_asset_links`
- `public.message_reactions`

Current role of these entities:

- `spaces`
  top-level tenancy and membership boundary
- `conversations`
  thread shells inside a space
- `messages`
  durable communication history inside a thread
- `message_assets` and `message_asset_links`
  committed media metadata and linkage

### Recommended target additions

KeepCozy should later add explicit structured records beside the chat layer.
Recommended categories:

- `service_requests`
- `work_orders`
- `supplier_orders`
- `inspections`
- `incident_cases`
- `quality_reviews`
- `space_documents`
- `space_timeline_events`
- `space_event_subscriptions` or equivalent automation/notification hooks

Implementation note:

- these do not all need to be introduced at once
- major operational records should prefer first-class tables, even if a shared
  linking helper or search projection exists later
- a generic reference layer may still be useful for cross-linking and search,
  but it should not replace real domain tables as the architecture target
- the important architectural rule is that operational records must become
  first-class entities, not remain hidden in message text

### Recommended relationship shape

- one `space` contains many operational objects
- one `space` contains many threads
- one thread may relate to one primary operational object
- one operational object may accumulate many timeline events
- one message may optionally reference an operational object or event
- one media asset may belong to a message, an operational object, or both over
  time through explicit link layers

## 2A. Trust Modes Inside Space Memory

KeepCozy operational memory should recognize two different trust modes.

### Operational history trust mode

This is the default mode for space operations.

Characteristics:

- operator-visible by policy
- auditable
- suitable for structured object and timeline linkage
- not dependent on end-to-end encrypted message bodies

### Private messaging trust mode

This is the separate mode for person-to-person privacy, including current DM
E2EE work.

Characteristics:

- may still be space-scoped in the current CHAT runtime
- may use encrypted message envelopes
- should not become the only authoritative operational record for a space

Important rule:

- the space timeline should be able to represent that private communication
  happened when needed
- it should not depend on decryptable private message content to model
  operational truth

## 3. Space-Scoped Storage Namespace Strategy

Storage should gradually move from thread-shaped naming to space-shaped naming.

### Current state

The active chat media runtime uses the canonical `message-media` bucket and
stores objects under a conversation-first path shape:

- `<conversation_id>/<message_id>/(voice|files)/...`

This works for current chat and voice sending, but it encodes a narrower
assumption:

- storage is organized around message threads, not around the parent space

### Target direction

KeepCozy should move toward a space-aware namespace strategy so that chat
media, structured documents, and operational artifacts can coexist inside one
space boundary.

Recommended shape:

- `spaces/<space_id>/conversations/<conversation_id>/messages/<message_id>/...`
- `spaces/<space_id>/objects/<object_type>/<object_id>/documents/...`
- `spaces/<space_id>/objects/<object_type>/<object_id>/media/...`
- `spaces/<space_id>/derived/<artifact_type>/...`

Recommended rules:

- every new storage namespace should be attributable to exactly one `space_id`
- message-linked assets may still retain `conversation_id` and `message_id`
  inside the path
- object-linked assets should prefer `object_type` and `object_id`
- derived exports, reports, and generated artifacts should not be mixed into
  message-only folders

### Migration-friendly guidance

Do not migrate existing object paths immediately.

Safer sequence:

1. keep current `message-media` bucket working for active chat and voice
2. introduce space-aware path rules for new object/document classes later
3. only migrate legacy conversation-first media paths when policy, tooling, and
   backfill plans are ready

Recommended future schema support:

- add direct `space_id` attribution wherever storage-backed entities are meant
  to be queried outside the thread view
- avoid depending on path parsing alone for durable tenancy logic

## 4. Relationship Between Thread Messages and Structured Operational Objects

Threads and operational objects should cooperate, not replace each other.

Recommended split:

- threads hold discussion, coordination, replies, reactions, and attached
  conversational context
- structured operational objects hold authoritative workflow state

Examples:

- a `service_request` thread should not be the service request record
- a `job_coordination` thread should not be the only source for contractor
  assignment or completion status
- an `inspection` thread should not be the only durable source of findings

Recommended design rule:

- the operational object is the business record
- the thread is the communication lane around that record

Practical mapping options:

- add `operational_object_type` and `operational_object_id` to a future thread
  companion metadata layer
- add optional object references on selected messages when a single message
  represents a structured action or resolution
- use timeline events to represent cross-links cleanly instead of forcing every
  relationship into the message body

## 5. Unified Space Timeline / Activity Log Concept

KeepCozy should eventually expose a unified space timeline that combines chat
and structured operational history.

That timeline should be conceptually separate from:

- inbox summary
- one thread's visible message history
- raw storage upload internals

Recommended timeline event categories:

- user-authored message posted
- message edited or deleted
- voice note committed
- attachment committed
- service request opened
- work order assigned
- supplier order created or updated
- inspection scheduled or completed
- incident escalated or resolved
- document added
- thread opened, reopened, or closed
- participant invited, joined, removed, or reassigned

First-foundation note:

- the longer-term timeline may include selected message-derived events
- the first structured timeline foundation should start with operational/system
  events and leave broad message mirroring for a later branch
- the first committed event subset should stay even narrower:
  - thread created
  - thread metadata attached
  - primary object linked
  - meaningful status changed
  - thread closed
  - thread reopened

Guardrail:

- this longer-term category list must not be read as a first-pass emission
  checklist
- the initial timeline branch should not mirror all message traffic, upload
  state, or UI/system noise into committed space history
- thread-local system notices and space-wide committed history should stay as
  separate concepts
- per-user archive/hide state should not be collapsed into operational thread
  lifecycle history

Recommended target event fields:

| Field | Why it matters |
| --- | --- |
| `id` | stable event identity |
| `space_id` | outer memory boundary |
| `event_type` | routing, rendering, and automation key |
| `occurred_at` | timeline ordering |
| `actor_user_id` | auditability |
| `conversation_id` | optional thread context |
| `message_id` | optional chat linkage |
| `operational_object_type` | operational reference |
| `operational_object_id` | operational reference |
| `audience_mode` | internal-only vs external-visible control |
| `summary_payload` | compact renderable details |
| `search_text` or equivalent derived index input | future search support |

First-foundation note:

- the initial timeline foundation may start narrower than this full target
  field set
- the first additive SQL pass can reasonably focus on:
  - `space_id`
  - optional `conversation_id`
  - optional `message_id`
  - optional primary object ref
  - `event_type`
  - `source_kind`
  - `occurred_at`
  - `summary_payload`
- audience/search derivations can be added later once access policy and search
  strategy are clearer

Recommended design rule:

- timeline events should be append-oriented and audit-friendly
- they should summarize meaningful state changes
- they should not depend on loading blobs or replaying entire message history
- later visibility should inherit from parent thread/object/space policy
  boundaries rather than being guessed from generic thread role alone

## 6. Search and Indexing Implications

If KeepCozy treats chat as the only memory layer, search quality will remain
weak and expensive.

Better long-term approach:

- search message text separately from structured operational fields
- index operational objects by state, assignment, vendor, date, and status
- index timeline summaries for fast activity retrieval
- index media/documents by metadata, not by blob contents alone

Recommended search surfaces:

- space-wide activity search
- thread-local message search
- operational-object search
- document/media search by metadata

Recommended searchable fields later:

- object titles and reference numbers
- status and assignee fields
- participant names/roles
- message body where allowed
- asset file names, mime types, and durations
- timeline summary text

Important boundary:

- inbox and activity should stay summary-driven
- they should not scan blobs or reconstruct thread history on every load
- search indexing should consume committed metadata and events, not live upload
  state

## 7. Notifications and Automation Hooks

Notifications and automation should be driven by committed space events, not by
raw transport details.

Recommended notification/automation trigger sources:

- timeline event committed
- operational object status changed
- participant assignment changed
- thread opened or closed
- new message posted in a relevant thread
- document or media committed

Recommended trigger dimensions:

- `space_id`
- `conversation_id` when thread-scoped
- `object_type`
- `object_id`
- `event_type`
- actor
- audience mode

Practical guidance:

- do not trigger operational automation from local upload progress
- do not treat temporary client draft states as business events
- prefer hooks that fire after durable commit of a message, asset, or object
  state transition

This keeps future automation compatible with:

- operator workflows
- assignment routing
- reminder engines
- audits and escalations
- eventual search reindexing jobs

## 8. Current State vs Target State

| Area | Current state | Target state |
| --- | --- | --- |
| Outer boundary | `spaces` already scope conversations | `spaces` become the full operational memory boundary |
| Communication shell | `conversations` and `messages` carry most durable history | chat remains a communication layer inside broader operational memory |
| Thread semantics | most operational meaning is implicit | a companion metadata layer carries thread type, audience mode, and object linkage |
| Media model | `message_assets` and `message_asset_links` support committed voice/media | the same asset layer extends to space documents and object-linked media |
| Storage pathing | active media is conversation-first inside `message-media` | new storage becomes space-aware and object-aware |
| Activity model | inbox/activity use conversation summary projections | space timeline adds structured operational events beside message summaries |
| Search | largely message/list oriented | search spans threads, objects, events, and media metadata |
| Automation | mostly absent as a durable event layer | automation hooks attach to committed events and object transitions |
| Trust mode | current DM E2EE exists only for private DMs | operational threads stay auditable; private messaging remains a separate trust mode |

## 9. Risks of Making Chat the Only Source of Truth

If chat remains the only durable memory layer, KeepCozy will inherit avoidable
product and operational problems:

- workflow state becomes trapped inside free text
- contractor or supplier activity becomes hard to audit
- operator oversight depends on reading threads manually
- reporting and search become unreliable
- media and documents become harder to locate outside one thread
- notifications become noisy because there is no structured event layer
- automation has to infer business meaning from message text
- closure and resolution logic become ambiguous

In short:

- chat-only history is good for communication replay
- it is not sufficient as the sole operational record for a managed property

## 10. Migration-Friendly Recommendations

Keep the path from current CHAT runtime to future KeepCozy architecture narrow
and incremental.

Recommended sequence:

1. preserve current `spaces -> conversations -> messages` runtime as the stable
   shell
2. continue using `message_assets` and `message_asset_links` as the committed
   media foundation
3. add a thread companion metadata layer beside existing entities instead of
   overloading `conversation.kind` or `messages.kind`
4. introduce a unified `space_timeline_events` layer before attempting broad
   search or automation
5. introduce operational object references gradually, starting with the highest
   value thread types
6. keep storage migration optional until new space-aware namespaces are ready
7. let inbox/activity stay summary-driven, even after richer space history is
   added

Recommended schema posture:

- evolve by adding explicit fields and tables
- avoid breaking current chat/thread assumptions
- avoid forcing all future operational meaning into existing message rows

## 11. Current Schema Gaps to Plan For

The current repo already contains the base needed for space-scoped chat and
committed media, but several gaps remain before the full KeepCozy memory model
exists.

Most important gaps:

- no first-class operational object tables
- no unified `space_timeline_events` table
- no thread companion metadata layer for `thread_type`, `audience_mode`, and
  object linkage
- no direct `space_id` on current committed media rows
- no space-native storage namespace convention yet
- no durable automation subscription/trigger model
- no first-class document registry separate from message attachments/media

These gaps are not reasons to refactor the current runtime immediately. They
are the next schema planning layer above the current stable chat foundation.
