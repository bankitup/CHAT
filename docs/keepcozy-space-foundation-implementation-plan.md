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
- [keepcozy-space-thread-model.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-thread-model.md)
- [keepcozy-space-data-flow.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-data-flow.md)
- [schema-assumptions.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/schema-assumptions.md)
- [schema-requirements.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/schema-requirements.md)
- [media-rtc-architecture.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/media-rtc-architecture.md)

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

### What the current architecture does not yet provide

- no operational thread-type model beyond `dm` and `group`
- no explicit thread audience model such as `internal-only` or
  `restricted-external`
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
- space roles carry the real operational meaning
- operational objects become first-class records beside chat
- timeline events become the durable bridge between chat history and
  operational history
- storage evolves from conversation-first naming toward space-aware naming
- automation and notifications hook into committed events, not only message text

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
- no `thread_type`, `audience_mode`, or operational-object reference fields on
  thread shells
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

- finalize the four space architecture docs
- finalize this implementation plan
- agree on canonical terms for:
  - space role
  - thread type
  - audience mode
  - operational object
  - timeline event

Work type:

- docs only

Risk:

- low

### Phase 1. Additive schema foundations for KeepCozy metadata

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

### Phase 2. Backend boundaries for space-aware reads and writes

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

### Phase 3. Policy-prep and access-resolution groundwork

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

### Phase 4. Timeline and operational object foundation

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

### Phase 5. Controlled user-facing KeepCozy thread experience

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

### Phase 6. Policy matrix, RLS hardening, and shipping review

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
2. add additive schema for thread metadata, invitations/assignments, and
   timeline events
3. add backend read/write helpers for space/thread/object linkage
4. add non-user-facing event generation and object-link scaffolding
5. prepare the role and audience resolution layer
6. ship one narrow operational-object plus thread linkage path
7. only then start policy matrix and RLS hardening work
8. ship limited KeepCozy UI once backend contracts are stable

Key rule:

- do not start with user-facing KeepCozy UI
- start with additive data model and backend boundaries first

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
- the canonical audience modes for threads and objects
- whether role expansion happens in `space_members.role` directly or through a
  mapping layer
- whether thread metadata lives on `public.conversations` or in a companion
  table
- what the first operational object type will be
- how operator oversight interacts with future private-thread exceptions

Policy matrix work should start only once those modeling choices are stable.

## 9. What Should Happen Before Shipping Any User-Facing KeepCozy Integration

Before shipping any KeepCozy-facing UI or workflow:

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

- `feature/space-schema-metadata-foundation`
- `feature/space-thread-metadata-contracts`
- `feature/space-object-link-foundation`
- `feature/space-timeline-foundation`
- `feature/space-access-policy-prep`
- `feature/keepcozy-space-ui-shell`

Recommended strategy:

- start with schema and backend foundation branches
- merge non-user-facing branches before UI work
- keep policy/RLS work in its own review-heavy branch
- treat any branch that changes active visibility or authorization as a
  higher-review item

## 11. Quick Wins

The fastest low-risk wins are:

- add shared TypeScript types for `thread_type`, `audience_mode`, and
  operational object references
- decide whether thread metadata belongs on `conversations` or in a companion
  table
- add a draft `space_timeline_events` schema doc before implementation
- add explicit backend helper boundaries for thread metadata and object links
- document operator-visibility and private-thread exception assumptions before
  policy work

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
- open the next branch for additive schema and type-level metadata foundation
- avoid user-facing KeepCozy UI until the metadata and event layers exist

That gives the project the best chance of making KeepCozy reusable without
breaking the restored CHAT runtime.
