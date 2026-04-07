# KeepCozy Space Foundation Implementation Plan

## Purpose

This document turns the first KeepCozy space architecture pass into a practical
implementation plan.

It is meant to answer:

- what the current CHAT foundation already provides
- what the KeepCozy-ready target state requires
- what gaps remain
- what order of work is safest
- which tasks belong in docs, schema, backend, or frontend phases

This plan is intentionally incremental. It should guide feature-branch work
without destabilizing the current CHAT runtime.

Related documents:

- [keepcozy-space-model-spec.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-model-spec.md)
- [keepcozy-space-access-model.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-access-model.md)
- [keepcozy-role-layering.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-role-layering.md)
- [keepcozy-space-thread-model.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-thread-model.md)
- [keepcozy-space-data-flow.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-data-flow.md)
- [keepcozy-space-access-mapping-prep.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-access-mapping-prep.md)
- [keepcozy-space-timeline-foundation.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-timeline-foundation.md)
- [keepcozy-space-timeline-runtime-boundaries.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-timeline-runtime-boundaries.md)
- [keepcozy-space-schema-companion-metadata.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-schema-companion-metadata.md)
- [keepcozy-space-schema-runtime-boundaries.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-schema-runtime-boundaries.md)
- [keepcozy-space-backend-thread-object-links.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-backend-thread-object-links.md)
- [schema-assumptions.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/schema-assumptions.md)
- [schema-requirements.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/schema-requirements.md)
- [media-rtc-architecture.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/media-rtc-architecture.md)
- [security/e2ee-security-model.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/security/e2ee-security-model.md)

## Architecture Decisions Locked by This Docs Pass

The following decisions should now be treated as the default implementation
direction:

- keep `public.conversations.kind` limited to `dm` and `group`
- prefer a future companion metadata layer keyed by `conversation_id` for
  `thread_type`, `audience_mode`, and object linkage
- keep operational roles separate from thread participation and moderation roles
- treat operational threads as auditable and operator-visible by policy
- treat private messaging as a separate trust mode, including current DM E2EE
- make `space` the operational memory unit, not just the chat filter
- prefer first-class operational tables for major business records

## 1. Current State Summary

The current CHAT codebase already provides a real foundation for space-scoped
messaging, but it is still fundamentally a chat-first architecture.

### What already exists

- `public.spaces` and `public.space_members` exist and are active runtime
  dependencies
- `public.conversations.space_id` already scopes inbox, activity, and chat
  entry
- `public.conversations.kind` currently distinguishes only `dm` and `group`
- `public.conversation_members` provides thread-level membership, read state,
  hide/archive state, and notification settings
- `public.messages` is still the durable message history shell
- `public.message_assets` and `public.message_asset_links` now provide the
  committed media foundation for voice/media work
- inbox and activity are summary-driven from conversation projection fields
- current active role enums are still generic at both the space and
  conversation layer

### What the current architecture does not yet provide

- no operational thread-type model beyond `dm` and `group`
- no explicit thread audience model such as `internal-only` or
  `restricted-external`
- no companion metadata layer for operational thread semantics
- no first-class operational objects such as service requests or work orders
- no unified space timeline or event log
- no invitation or assignment model
- no KeepCozy-ready space role model in active schema
- no space-native storage namespace strategy in active runtime

## 2. Target State Summary

The KeepCozy-ready target state keeps the current messaging shell, but makes
space the full operational boundary around it.

### Target architectural shape

- `space` is the durable access, storage, and operational memory boundary
- `conversations` remain the communication shell inside a space
- operational thread purpose is modeled separately from `conversation.kind`
- operational thread semantics prefer a companion metadata layer over direct
  mutation of current shell fields
- space roles carry the real operational meaning
- operational objects become first-class records beside chat
- timeline events become the durable bridge between chat history and
  operational history
- storage evolves from conversation-first naming toward space-aware naming
- automation and notifications hook into committed events, not only message text
- operational threads stay operator-visible and auditable by default
- private messaging remains a separate trust mode and not the main operational
  source of truth

### Target product behavior

- a space contains many operational threads, not one broad group chat
- external participants see only assigned threads and records
- operators get explicit oversight within policy boundaries
- internal-only coordination is modeled by policy and metadata, not by UI
  convention
- chat is a communication record, but not the only source of truth

## 3. Gaps Between Current CHAT Architecture and KeepCozy-Ready Space Architecture

### Schema gaps

- `space_members.role` is still generic and does not represent KeepCozy roles
- no invitation or assignment entities
- no companion metadata layer for `thread_type`, `audience_mode`, or
  operational-object references
- no first-class operational object tables
- no `space_timeline_events` or equivalent event layer
- no direct `space_id` attribution for all future space-searchable media and
  documents

### Backend gaps

- no service boundary yet for operational object lookup and cross-linking
- no event-commit layer that can drive automation or notifications cleanly
- no policy-ready access resolution model that separates global role, space
  role, and thread participation
- current storage policies and media lookup are still thread-first

### Frontend gaps

- inbox and chat UI are still conversation-centric
- no thread-type-aware listing or creation flows
- no object-linked thread surfaces
- no internal-only or restricted-external visibility treatment in UI
- no space timeline or object timeline views

### Product/process gaps

- no agreed policy matrix yet
- no audited operator-visibility exception model
- no defined branch sequence for introducing these capabilities safely

## 4. Recommended Implementation Phases

### Phase 0. Architecture freeze and terminology alignment

Goal:

- lock the vocabulary and entity boundaries before schema work begins

Outputs:

- finalize the five space architecture docs
- add the dedicated role-layering document
- finalize this implementation plan
- agree on canonical terms for:
  - space role
  - thread participation and moderation role
  - thread type
  - audience mode
  - operational object
  - timeline event

Work type:

- docs only

Risk:

- low

Status:

- complete on `feature/space-model-foundation`

### Phase 1. Companion metadata and contract scaffolding

Goal:

- define low-risk contracts before additive schema rollout

Recommended scope:

- add shared TypeScript contract shapes for:
  - `thread_type`
  - `audience_mode`
  - operational object references
  - role-layer translation
- decide whether thread metadata should live in a companion table or a narrowly
  scoped companion layer abstraction
- document initial timeline event categories and event payload boundaries

Work type:

- docs
- backend types

Risk:

- low

Current branch note:

- the intended outputs of this phase now have a first concrete draft in
  [keepcozy-space-contract-types.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-contract-types.md)
  and [types.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/spaces/types.ts)

### Phase 2. Additive schema foundations for KeepCozy metadata

Goal:

- add minimal new schema primitives without changing current runtime behavior

Recommended scope:

- add additive thread metadata fields or a companion thread-metadata table for:
  - `thread_type`
  - `audience_mode`
  - `status`
  - `operational_object_type`
  - `operational_object_id`
  - `thread_owner_user_id`
- add draft schema for invitation and assignment entities
- add draft schema for a unified `space_timeline_events` table
- add direct `space_id` attribution where future space-level search will need it

Work type:

- schema
- docs

Risk:

- medium, if additive only

### Phase 3. Backend boundaries for space-aware reads and writes

Goal:

- create backend contracts that understand space/thread/object relationships
  without changing user-facing flows yet

Recommended scope:

- add repository/service boundaries for thread metadata reads
- add object-reference helpers and validation boundaries
- add event-commit helpers that can later write timeline rows alongside
  thread/object changes
- add storage-path helpers for future space-aware media/document namespaces

Work type:

- backend
- tests

Risk:

- medium

Recommended feature branch:

- `feature/space-backend-thread-object-links`

Current branch note:

- the first low-level backend helper boundary now exists in
  [conversation-companion-metadata.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/data/conversation-companion-metadata.ts)
  with a narrow read composition seam in
  [conversation-thread-context.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/data/conversation-thread-context.ts)
  and is documented in
  [keepcozy-space-backend-thread-object-links.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-backend-thread-object-links.md)

Phase 3 guardrail:

- this backend phase may expose optional operational thread context
- it must not emit timeline history or enforce final audience/access policy yet

### Phase 4. Policy-prep and access-resolution groundwork

Goal:

- prepare for later policy matrix and RLS work without rewriting authorization
  immediately

Recommended scope:

- add role-mapping docs and code-level type scaffolding
- define translation between:
  - global role
  - space role
  - thread participation role
- define internal-only and restricted-external resolution rules in backend
  helpers first
- instrument where current runtime assumes generic `owner/admin/member`

Work type:

- docs
- backend
- light schema if needed

Risk:

- medium to high if it touches active authorization paths

Branch ownership note:

- `feature/space-access-mapping-prep` should own role-layer resolution,
  internal-only vs restricted-external interpretation, and assignment-aware
  visibility rules
- it should not widen the current backend link layer into a general-purpose
  authorization shortcut

Current branch note:

- the first access-mapping preparation layer now has a dedicated branch-level
  doc in
  [keepcozy-space-access-mapping-prep.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-access-mapping-prep.md)
  and a small shared TypeScript vocabulary in
  [types.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/spaces/types.ts)
- this prep work names policy inputs and interpretation order without changing
  current runtime authorization behavior

Phase 4 guardrails:

- it must not be treated as final authorization enforcement
- it must not collapse operational role semantics into current
  `owner/admin/member` moderation fields
- it must not treat companion metadata as the only access truth
- it must not assume timeline visibility is always identical to parent thread
  visibility
- it must not change current `dm | group` runtime semantics
- it must not turn UI presentation assumptions into backend policy shortcuts

### Phase 5. Timeline and operational object foundation

Goal:

- introduce structured operational memory beside chat

Recommended scope:

- create the first operational object type with minimal UI surface
- write timeline events for that object and its linked thread activity
- prove that message history and operational history can coexist cleanly
- keep inbox/activity summary-driven

Work type:

- schema
- backend
- limited frontend

Risk:

- medium

Current branch note:

- the first structured timeline foundation now has a concrete doc and SQL
  draft in
  [keepcozy-space-timeline-foundation.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-timeline-foundation.md)
  and
  [2026-04-07-space-timeline-events-foundation.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-07-space-timeline-events-foundation.sql)
- this branch defines additive event vocabulary and schema direction without
  changing chat runtime behavior
- the branch also now defines future emission seams in
  [keepcozy-space-timeline-runtime-boundaries.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-timeline-runtime-boundaries.md)
  and keeps the low-level builder boundary in
  [space-timeline-events.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/spaces/space-timeline-events.ts)
  separate from ordinary chat send flows

Branch ownership note:

- `feature/space-timeline-foundation` should own structured event vocabulary,
  additive timeline schema direction, and later durable event-writing seams
- later access/policy work should build on this event model rather than trying
  to redefine the timeline shape ad hoc

Phase 5 guardrails:

- it must not treat all chat messages as timeline rows by default
- it must not mix operational state transitions with transport/UI/runtime
  diagnostics
- it must not fold thread-local system notices into committed space history
- it must not ship notification fan-out or automation execution as part of the
  first timeline pass
- it must not widen current `dm | group` runtime semantics to make timeline
  work

### Phase 6. Controlled user-facing KeepCozy thread experience

Goal:

- expose KeepCozy-specific thread semantics only after the backend model is
  trustworthy

Recommended scope:

- add thread-type-aware listing or filtering
- add object-linked thread details
- add internal-only or restricted-external badges/surfaces
- expose space-aware creation flows for one safe operational thread type first

Work type:

- frontend
- backend

Risk:

- medium to high

### Phase 7. Policy matrix, RLS hardening, and shipping review

Goal:

- turn the agreed model into enforceable policy before broad release

Recommended scope:

- formal policy matrix
- RLS and backend guard review
- operator visibility review
- external participant restriction review
- auditability and timeline review

Work type:

- schema
- backend
- security review

Risk:

- high

## 5. Suggested Order of Execution

Recommended sequence:

1. finish docs and terminology alignment
2. add shared type and contract scaffolding for thread metadata, audience
   modes, and role-layer translation
3. add additive schema for companion metadata, invitations/assignments, and
   timeline events
4. add backend read/write helpers for space/thread/object linkage
5. add non-user-facing event generation and object-link scaffolding
6. prepare the role and audience resolution layer
7. ship one narrow operational-object plus thread linkage path
8. ship limited KeepCozy UI once backend contracts are stable
9. only then start policy matrix and RLS hardening work

Key rule:

- do not start with user-facing KeepCozy UI
- start with additive data model and backend boundaries first
- do not start by rewriting active authorization or active shell enums

## 6. Task Classification by Work Type

| Task area | Primary work type |
| --- | --- |
| terminology alignment | docs only |
| thread type / audience mode spec | docs only |
| invitation and assignment model draft | docs only -> schema |
| additive thread metadata | schema |
| operational object tables | schema |
| unified timeline event table | schema |
| repository/service boundaries for space-aware reads | backend |
| event-commit helpers | backend |
| object-linked thread queries | backend |
| current-runtime compatibility tests | backend/test |
| space/thread/object creation flows | backend then frontend |
| thread-type-aware list or creation UI | frontend |
| policy matrix and RLS review | schema/backend/security |

## 7. Safe vs Risky Work

### Safe in normal feature branches

- docs and terminology work
- additive schema drafts that are not wired into production yet
- backend helper extraction that preserves existing behavior
- new internal types and metadata mappers
- timeline/object scaffolding behind unused or non-user-facing paths

### Needs extra review

- changing active authorization behavior
- changing RLS on current conversations, messages, or storage
- changing how inbox/activity summaries are derived
- changing `conversation.kind` semantics
- changing active DM privacy or operator visibility assumptions
- changing storage paths for existing committed media
- turning internal-only visibility into active UI without server enforcement

## 8. What Should Happen Before Policy Matrix Work

Before formal policy matrix work begins, the project should first decide:

- the canonical KeepCozy space role set
- the canonical split between space role and thread participation/moderation role
- the canonical audience modes for threads and objects
- whether role expansion happens in `space_members.role` directly or through a
  mapping layer
- whether thread metadata lives in a companion table or another companion layer
- what the first operational object type will be
- how operator oversight interacts with future private-thread exceptions

Policy matrix work should start only once those modeling choices are stable.

## 9. What Should Happen Before Shipping Any User-Facing KeepCozy Integration

Before shipping any KeepCozy-facing UI or workflow:

- the role-layering and companion-metadata direction should be frozen
- additive schema for thread metadata and object linkage should exist
- one operational object path should be implemented end-to-end
- backend access checks should understand thread audience and assignment scope
- timeline events should exist for the shipped object/thread flow
- external participant restrictions should be testable server-side
- storage/media rules should be aligned with space-aware future direction
- inbox/activity should remain summary-driven and not regress
- no KeepCozy UI should rely on client-side hiding alone for restricted data

## 10. Recommended Branch Strategy for the Next Phase

Use smaller feature branches that each change one architectural layer at a
time.

Recommended next branches:

- `feature/space-contract-types`
- `feature/space-schema-companion-metadata`
- `feature/space-backend-thread-object-links`
- `feature/space-timeline-foundation`
- `feature/space-access-mapping-prep`
- `feature/space-first-operational-object`
- `feature/keepcozy-space-ui-shell`
- `feature/space-policy-matrix`
- `feature/space-rls-hardening`

Recommended strategy:

- start with non-user-facing contract, schema, and backend foundation branches
- merge non-user-facing branches before UI work
- keep policy/RLS work in its own review-heavy branch
- treat any branch that changes active visibility or authorization as a
  higher-review item

## 11. Quick Wins

The fastest low-risk wins are:

- add shared TypeScript types for `thread_type`, `audience_mode`, and
  operational object references
- decide whether thread metadata belongs in a companion table or other
  companion layer
- add a draft `space_timeline_events` schema doc before implementation
- add explicit backend helper boundaries for thread metadata and object links
- document operator-visibility and private-thread exception assumptions before
  policy work
- keep operational role semantics out of current conversation moderation enums

## 12. Highest-Risk Changes

The changes most likely to cause regressions are:

- altering active conversation/message RLS before the policy model is frozen
- overloading `conversation.kind` beyond `dm` and `group`
- expanding visibility rules in client UI before backend enforcement exists
- migrating existing chat media paths prematurely
- mixing operational event semantics into ordinary user messages
- changing inbox/activity from projection-driven summaries to history scanning

## 13. Recommended Immediate Next Step

The next practical step should be:

- keep this branch documentation-only
- open the next branch for type-level and contract-level metadata foundation
- avoid user-facing KeepCozy UI until the metadata and event layers exist

That gives the project the best chance of making KeepCozy reusable without
breaking the restored CHAT runtime.
