# KeepCozy MVP Boundary

## Purpose

This document defines the strict runtime boundary for the first real KeepCozy
MVP inside the shared CHAT repository.

The goal is to keep the first product proof narrow, implementation-oriented,
and aligned with the existing shared messaging foundation instead of expanding
too early into the broader home-ops platform vision.

This is a boundary document, not a full product redesign.

Related documents:

- [keepcozy-mvp-schema-runtime-alignment.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-mvp-schema-runtime-alignment.md)
- [keepcozy-mvp-test-flow.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-mvp-test-flow.md)
- [keepcozy-chat-shared-vocabulary.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-chat-shared-vocabulary.md)
- [keepcozy-space-foundation-implementation-plan.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-foundation-implementation-plan.md)
- [keepcozy-space-model-spec.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-model-spec.md)
- [keepcozy-space-thread-model.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-thread-model.md)
- [keepcozy-space-data-flow.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-data-flow.md)
- [keepcozy-space-schema-companion-metadata.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-schema-companion-metadata.md)
- [keepcozy-space-timeline-foundation.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-timeline-foundation.md)
- [schema-assumptions.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/schema-assumptions.md)

## Current Repo Reality

The current repository already provides shared foundation that KeepCozy should
reuse:

- `public.spaces` and `public.space_members` are the active outer container and
  membership boundary
- `public.conversations`, `public.conversation_members`, and `public.messages`
  remain the active chat shell
- `public.message_assets` and `public.message_asset_links` already provide the
  committed media foundation
- additive KeepCozy scaffolding already exists for:
  - `public.conversation_companion_metadata`
  - `public.space_timeline_events`
  - companion metadata row builders and optional conversation thread context
    helpers

The current repository does not yet have an active KeepCozy runtime for:

- `homes`
- `home_memberships`
- `rooms`
- `issues`
- `issue_updates`
- `tasks`
- `task_updates`

The current app shell now exposes a KeepCozy-first route layer:

- `/spaces`
- `/home`
- `/rooms`
- `/issues`
- `/tasks`
- `/activity`
- secondary `/inbox`
- secondary `/settings`

Important clarification:

- the KeepCozy-first routes currently act as focused MVP scaffolding around the
  shared `space` home context
- they make the intended runtime center of gravity visible now
- they do not mean dedicated `rooms`, `issues`, `issue_updates`, `tasks`, or
  `task_updates` tables already exist

That means the first KeepCozy MVP boundary should still be defined
deliberately, and the route layer should not be mistaken for completed schema
delivery.

## MVP Objective

The first real KeepCozy runtime must prove one practical operational loop:

- home -> room -> issue -> task -> update/history -> resolution

This proof is successful when the product can support real work moving through
that loop without depending on:

- full marketplace behavior
- automation-heavy intelligence layers
- deep chat-first UX
- speculative cross-domain platform breadth

## Exact Core Loop

The first runtime proof should support this exact loop:

1. enter a home-scoped context
2. choose or open a room within that home
3. create or view an issue tied to that room/home
4. create and manage one or more tasks that move the issue forward
5. append structured updates and minimal history as work progresses
6. resolve the task work and close or resolve the issue with history preserved

Practical rule:

- resolution must be a structured operational outcome
- it must not be treated as the same thing as chat archive/hide behavior

## In Scope For The First Real MVP Runtime

The first real KeepCozy MVP runtime should include the following product and
data surface.

### 1. Homes

In scope:

- a top-level managed home context
- home selection and entry
- home-scoped listing of rooms, issues, and related work

Boundary:

- the first MVP should align this concept with the existing shared `space`
  foundation instead of forking a second top-level container model

### 2. Home memberships

In scope:

- the outer membership boundary for who belongs to one home
- enough role or membership state to determine who can enter the home context

Boundary:

- first MVP should align this layer with current `space_members`
- do not invent a parallel broad membership model unless there is a concrete
  runtime need that `space_members` cannot serve

### 3. Rooms

In scope:

- first-class room records inside one home
- room-level grouping for issues and tasks
- room identity sufficient for routing, listing, and filtering

Boundary:

- room is a KeepCozy-specific entity
- there is no shared chat-core equivalent that needs to replace it

### 4. Issues

In scope:

- first-class issue records as the main user-facing operational problem unit
- issue creation, read, update, and resolution state
- linkage to one home and optionally one room

Boundary:

- issue is a structured operational record
- issue must not be reduced to a chat conversation title or message thread

### 5. Issue updates

In scope:

- append-oriented issue history entries
- status notes, progress notes, resolution notes, and minimal actor/timestamp
  history

Boundary:

- issue updates are structured operational history
- they are not the same thing as chat messages

### 6. Tasks

In scope:

- first-class actionable work records linked to an issue
- enough task state to represent work breakdown and completion
- linkage back to the parent issue and its home/room context

Boundary:

- task is part of the main MVP proof, not a later add-on
- task should remain narrower than a full work-order or vendor-management
  system in the first pass

### 7. Task updates

In scope:

- append-oriented task progress history
- minimal progress notes, timestamps, actor identity, and completion history

Boundary:

- task updates are structured operational history
- they are not a synonym for chat replies

### 8. Minimal attachments and history support

In scope:

- small, practical attachment support where needed for issue updates and task
  updates
- chronological history rendering for issue and task progress

Boundary:

- attachment support should stay minimal and auditable
- reuse shared asset patterns where practical
- do not let attachment modeling expand into a broader asset platform in the
  first MVP

## Recommended First-Class MVP Entity Map

| MVP concept | Shared alignment or source-of-truth seam | MVP stance |
| --- | --- | --- |
| `home` | align product meaning to shared `space` container | in scope |
| `home membership` | align outer boundary to `space_members` | in scope |
| `room` | KeepCozy-specific entity under the home/space | in scope |
| `issue` | KeepCozy-specific operational record | in scope |
| `issue_update` | KeepCozy-specific structured history | in scope |
| `task` | KeepCozy-specific operational record linked to an issue | in scope |
| `task_update` | KeepCozy-specific structured history | in scope |
| minimal attachments/history | may reuse shared asset patterns where practical | in scope, but narrow |
| operational chat lane | current `conversation` shell and optional companion metadata | future-supporting, not required for MVP proof |
| space-wide timeline | `space_timeline_events` foundation | future layer, not MVP proof |

## Terms That Must Align With CHAT Naming

The first MVP should stay compatible with the shared chat foundation on the
following terms.

### `space`

Rule:

- `space` remains the shared system and container name in schema, shared code,
  and cross-product docs
- `home` is the KeepCozy product/business descriptor for that container in the
  MVP

Practical guidance:

- do not rename active shared schema from `space` to `home` in code that
  touches existing runtime tables or helpers

### `space_members`

Rule:

- current outer membership alignment should continue to use the shared
  `space_members` boundary
- `home membership` may be used as product meaning in KeepCozy prose

### `conversation` and `thread`

Rule:

- `conversation` remains the current runtime and schema term
- `thread` may remain the KeepCozy product term when discussing a future
  operational communication lane

Practical guidance:

- do not rename `public.conversations` to `threads` in active runtime code
- do not make operational chat threads a blocker for the first issue/task loop

### `message`

Rule:

- `message` remains user-authored chat content inside the shared messaging core
- it must not become the name for issue updates or task updates

### `archive` vs `resolution`

Rule:

- `archive` remains per-user hide/archive behavior in chat
- `resolution`, `resolved`, and `closed` remain operational workflow terms

Practical guidance:

- do not treat “issue resolved” and “thread archived” as the same lifecycle
  fact

## Terms That Remain KeepCozy-Specific In The MVP

These terms should remain part of the KeepCozy domain layer rather than being
forced into current chat-core naming.

- `home` as the product/business meaning of a shared `space`
- `room`
- `issue`
- `issue_update`
- `task`
- `task_update`
- `resolution`

Important rule:

- these are first-class KeepCozy operational concepts
- they should not be collapsed into generic chat terms such as conversation,
  message, or inbox row

## Explicitly Out Of Scope For The First Runtime Proof

The following are explicitly out of scope for the first real KeepCozy MVP
runtime unless they are already trivially present and do not widen the design:

- storage intelligence
- asset intelligence
- climate intelligence
- recommendation engine behavior
- sensor automation
- deep chat integration
- supplier or marketplace richness
- procurement-heavy flows
- full inspection platform breadth
- vendor-assignment richness
- generalized automation fan-out
- space-wide analytics and reporting
- broad document-management platform behavior
- broad cross-space discovery or marketplace behavior

Practical rule:

- the first runtime proof should solve one home-ops loop well
- it should not try to prove the whole future platform at once

## Future Layers, Not Current MVP Commitments

The repository already contains foundation for broader KeepCozy architecture.
Those foundations should remain future layers unless the MVP loop directly
needs them.

### Future layer: operational thread companion metadata

Includes:

- `public.conversation_companion_metadata`
- `thread_type`
- `audience_mode`
- optional primary operational object linkage

Boundary:

- useful future alignment layer
- not required to prove the first home/room/issue/task runtime

### Future layer: unified space timeline

Includes:

- `public.space_timeline_events`
- structured cross-thread or cross-object activity history

Boundary:

- useful later audit and activity layer
- not required to prove issue/task updates and resolution history

### Future layer: richer object family

Includes examples already discussed in current docs:

- `service_requests`
- `work_orders`
- `supplier_orders`
- `inspections`
- `incident_cases`
- `quality_reviews`
- `space_documents`

Boundary:

- the first MVP should stay focused on issue/task runtime
- do not make the first proof wait on the whole object family

### Future layer: richer external-role and assignment policy

Includes:

- assignment-scoped external access
- supplier and contractor policy richness
- invitation systems
- advanced operator visibility rules

Boundary:

- these remain important future architecture concerns
- they are not the minimum proof of the first issue/task loop

### Future layer: space-aware storage evolution

Includes:

- space-native storage pathing
- generalized object/media/document namespaces
- richer derived artifacts

Boundary:

- first MVP may use minimal attachment support
- it should not block on a broader storage redesign

### Future layer: intelligence and automation

Includes:

- climate modules
- sensors
- recommendations
- workflow automation
- intelligence-heavy prioritization

Boundary:

- these are follow-on product layers
- they are not part of the MVP runtime definition

## Implementation Guardrails

When using this boundary in future branches:

- keep additive alignment with the shared `space` foundation
- do not redesign the chat core in order to start KeepCozy MVP runtime
- do not require deep chat embedding to prove issue/task workflow
- do not overload `public.conversations.kind`
- do not treat issue/task updates as chat messages
- do not treat a unified timeline as required before issue/task history exists
- prefer practical tables, views, and routes for the first loop over broad
  speculative abstractions

## Definition Of Done For This Boundary

This boundary is satisfied when future implementation work stays focused on:

- one home-scoped operational context
- rooms inside that home
- issues as the main problem record
- tasks as the main execution record
- structured updates/history for both
- clear operational resolution

This boundary is not satisfied if the work expands first into:

- generalized intelligence
- marketplace breadth
- automation-heavy platform layers
- chat-first redesign
- broader operational object families before the issue/task loop is proven
