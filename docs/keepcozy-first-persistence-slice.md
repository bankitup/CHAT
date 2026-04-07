# KeepCozy First Persistence Slice

## Purpose

This document defines the first real persistence slice for KeepCozy inside the
shared CHAT repository.

Its job is to replace the current preview-backed MVP entities with narrow,
production-shaped persisted records while preserving the route structure and
the current shared `space` home boundary.

This is an implementation plan for the next schema/runtime lift, not a broad
product redesign.

Related documents:

- [keepcozy-mvp-boundary.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-mvp-boundary.md)
- [keepcozy-mvp-schema-runtime-alignment.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-mvp-schema-runtime-alignment.md)
- [keepcozy-mvp-test-flow.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-mvp-test-flow.md)
- [mvp-preview.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/keepcozy/mvp-preview.ts)
- [server.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/keepcozy/server.ts)
- [2026-04-03-spaces-v1.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-03-spaces-v1.sql)
- [2026-04-03-spaces-default-test-backfill.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-03-spaces-default-test-backfill.sql)
- [2026-04-06-message-assets-runtime-align.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-06-message-assets-runtime-align.sql)
- [2026-04-07-keepcozy-first-persistence-slice.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-07-keepcozy-first-persistence-slice.sql)

## Decisions Locked By This Slice

- keep shared `public.spaces` and `public.space_members` as the current
  `home` and `home_membership` seam
- add only these first-class KeepCozy MVP tables in this slice:
  - `rooms`
  - `issues`
  - `issue_updates`
  - `tasks`
  - `task_updates`
- preserve the current KeepCozy route layer:
  - `/home`
  - `/rooms`
  - `/issues`
  - `/tasks`
  - `/activity`
- preserve current route-friendly ids by treating the current preview ids as
  first persisted slugs
- keep attachment support deferred to a thin follow-up seam instead of creating
  new asset-platform scope here
- keep chat, unified timeline, marketplace, climate, storage intelligence, and
  broader workflow object families out of this first persistence slice

## Current Starting Point

The current KeepCozy shell is already shaped around the right user flow, but
the runtime records are still preview-backed:

- [page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/home/page.tsx)
- [page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/rooms/page.tsx)
- [page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/issues/page.tsx)
- [page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/tasks/page.tsx)
- [page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/activity/page.tsx)
- [mvp-preview.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/keepcozy/mvp-preview.ts)

That means the current app direction is correct, but the persistence center of
gravity still needs to move into real KeepCozy tables.

## What This Persistence Slice Must Achieve

The first persisted slice should do exactly enough to support the current MVP
loop with real records:

1. enter one active home through shared `space`
2. read one or more persisted rooms for that home
3. read and create issues scoped to that home and optionally one room
4. read and create tasks linked to an issue
5. append issue and task updates as real history rows
6. render a combined history view from persisted updates instead of preview
   arrays

Practical rule:

- this slice should replace preview-backed MVP entities
- it should not widen into a full operational platform

## Proposed Table Set

| Table | Runtime purpose | Key relationship decisions |
| --- | --- | --- |
| `public.rooms` | first-class room records inside one home | scoped to one `space_id`; route uses `slug` |
| `public.issues` | first-class issue/problem records | scoped to one `space_id`; optionally linked to one `room_id`; route uses `slug` |
| `public.issue_updates` | append-only issue history | linked to one `issue_id` and one `space_id` |
| `public.tasks` | first-class work items that move an issue forward | linked to one `issue_id` and one `space_id`; route uses `slug` |
| `public.task_updates` | append-only task history | linked to one `task_id` and one `space_id` |

## Data Model Decisions

### 1. Keep `space` as the home seam

This slice should not create physical `homes` or `home_memberships` tables.

The active home boundary remains:

- `public.spaces`
- `public.space_members`
- active space resolution in
  [server.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/keepcozy/server.ts)

### 2. Preserve current route ids as slugs

The current preview-backed routes already use stable ids:

- room slug: `kitchen`
- issue slug: `kitchen-faucet-drip`
- task slug: `capture-faucet-model`

The first persisted slice should preserve that route behavior by storing a
`slug` on:

- `rooms`
- `issues`
- `tasks`

Recommended uniqueness:

- `rooms`: unique on `(space_id, slug)`
- `issues`: unique on `(space_id, slug)`
- `tasks`: unique on `(space_id, slug)`

### 3. Keep `tasks` linked through `issues`

`tasks` should not duplicate `room_id` in the first persistence slice.

Reason:

- the current room context can already be derived through `task -> issue -> room`
- omitting `room_id` avoids avoidable denormalization in the first MVP pass
- list pages can still filter tasks by room through a join on `issues`

### 4. Keep updates append-only and separate from parent state

`issue_updates` and `task_updates` should remain append-oriented history rows,
not mutable mirrors of the parent records.

Each update row should carry:

- parent reference
- `space_id`
- `label`
- `body`
- `kind`
- `created_by`
- `created_at`

Optional state transition details such as `status_after` are acceptable because
they support history rendering without collapsing updates into free-form chat.

### 5. Normalize storage statuses even if current preview copy differs

The preview data currently uses user-facing strings such as `Needs attention`,
`In review`, `Active`, and `Waiting`.

The first persisted slice should store normalized internal status values and
let the app map them to product copy.

Recommended first-pass statuses:

- `issues.status`:
  - `open`
  - `planned`
  - `in_review`
  - `resolved`
- `tasks.status`:
  - `planned`
  - `active`
  - `waiting`
  - `done`
  - `cancelled`

Recommended update kinds:

- `issue_updates.kind`:
  - `note`
  - `status_change`
  - `resolution`
- `task_updates.kind`:
  - `note`
  - `status_change`
  - `completion`

### 6. Keep attachment support out of this first table DDL

The MVP boundary allows minimal attachments, but this first persistence slice
should not create a new KeepCozy-specific attachment family yet.

Reason:

- the repo already has a reusable narrow asset foundation in
  [2026-04-06-message-assets-runtime-align.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-06-message-assets-runtime-align.sql)
- attachment linkage can land as a thin follow-up once issue/task history rows
  exist
- adding attachment tables now would widen this branch away from the core MVP
  proof

## Runtime Mapping By Screen

### `/home`

The home dashboard should move from preview counts to persisted counts by
active `space_id`:

- total rooms
- total open issues
- total open tasks
- canonical test flow pointers

### `/rooms`

The room list and room detail views should read:

- rooms by `space_id`
- room detail by `(space_id, slug)`
- issue and task counts via joins from `issues` and `tasks`

### `/issues`

The issue list and detail views should read:

- issues by `space_id`
- optional room-filtered issues by `room_id`
- issue detail by `(space_id, slug)`
- linked `issue_updates`
- linked `tasks`

### `/tasks`

The task list and detail views should read:

- tasks by `space_id`
- optional issue-filtered tasks by `issue_id`
- optional room-filtered tasks through an `issues` join
- task detail by `(space_id, slug)`
- linked `task_updates`

### `/activity`

The KeepCozy-first history section should move from preview arrays to a merged
space-scoped operational history feed built from:

- `issue_updates`
- `task_updates`

The current chat-derived activity surface can remain secondary until a later
history unification pass.

## Canonical First Persisted Test Path

The first persistence slice should preserve the same practical proof path
already defined in
[keepcozy-mvp-test-flow.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-mvp-test-flow.md).

Recommended first persisted records:

| Layer | First persisted record | Notes |
| --- | --- | --- |
| home seam | shared `TEST` space | already seeded in the repo |
| room | `kitchen` / `Kitchen` | canonical room slug and title |
| issue | `kitchen-faucet-drip` | parent room is `kitchen`; initial status should be `in_review` |
| task | `capture-faucet-model` | parent issue is `kitchen-faucet-drip`; initial status should be `waiting` |
| issue update | `Issue logged` | canonical first issue history row |
| issue update | `Initial assessment` | canonical second issue history row |
| task update | `Task created` | canonical first task history row |
| task update | `Scope held` | canonical second task history row |

## Recommended Migration Sequence

1. Apply the table foundation in
   [2026-04-07-keepcozy-first-persistence-slice.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-07-keepcozy-first-persistence-slice.sql).
2. Add one narrow seed/backfill for the canonical `TEST` home path.
3. Add KeepCozy read helpers for:
   - rooms list/detail
   - issues list/detail
   - tasks list/detail
   - issue/task history
4. Switch `/rooms` and the room detail route from preview reads to persisted
   reads.
5. Switch `/issues` and `/tasks` to persisted reads.
6. Switch the KeepCozy-first history section in `/activity` to persisted
   `issue_updates` and `task_updates`.
7. Add minimal create/update write paths for:
   - create issue
   - create task
   - append issue update
   - append task update
8. Keep preview fallback only as a temporary guard while the read-path swap is
   in progress, then remove it from the canonical MVP proof.

## Deliberately Deferred After This Slice

- physical `homes` / `home_memberships` tables separate from `spaces`
- dedicated attachment tables for issue/task history
- deep chat linkage or mandatory conversation rows
- `space_timeline_events` integration
- `conversation_companion_metadata` linkage
- service-request, work-order, inspection, supplier, or procurement layers
- storage intelligence, asset intelligence, climate intelligence, sensors, or
  recommendation logic
- broader policy and marketplace richness

## Narrow Follow-Up Work After This Plan

Once this table slice is approved, the next implementation branch should stay
small:

1. apply the SQL foundation
2. seed the canonical `TEST` records
3. add read repositories
4. swap one route group at a time from preview to persisted data
5. leave future-domain layers untouched
