# KeepCozy MVP Write Paths

## Purpose

This document defines the first real write-path plan for the KeepCozy MVP loop
inside the shared CHAT repository.

It builds on the completed persisted read slice and keeps the next
implementation lift narrow:

- create issue
- append issue update
- create task linked to issue
- append task update
- change issue and task status through append-oriented history

This is a write-path plan for the next implementation branch, not a broad
workflow redesign.

Related documents:

- [keepcozy-mvp-boundary.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-mvp-boundary.md)
- [keepcozy-first-persistence-slice.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-first-persistence-slice.md)
- [keepcozy-mvp-schema-runtime-alignment.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-mvp-schema-runtime-alignment.md)
- [keepcozy-mvp-test-flow.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-mvp-test-flow.md)
- [server.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/keepcozy/server.ts)
- [mvp-preview.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/keepcozy/mvp-preview.ts)
- [page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/issues/new/page.tsx)
- [page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/issues/[issueId]/page.tsx)
- [page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/tasks/new/page.tsx)
- [page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/tasks/[taskId]/page.tsx)
- [2026-04-07-keepcozy-first-persistence-slice.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-07-keepcozy-first-persistence-slice.sql)
- [2026-04-07-keepcozy-first-persistence-slice-rls-hardening.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-07-keepcozy-first-persistence-slice-rls-hardening.sql)

## Decisions Locked By This Plan

- keep shared `public.spaces` and `public.space_members` as the current home
  and home-membership seam
- keep the current route layer:
  - `/home`
  - `/rooms`
  - `/issues`
  - `/issues/new`
  - `/issues/[issueId]`
  - `/tasks`
  - `/tasks/new`
  - `/tasks/[taskId]`
  - `/activity`
- keep the persisted read behavior in
  [server.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/keepcozy/server.ts)
  as the source of truth for rendering after writes
- keep writes append-oriented:
  - status changes must insert an `issue_updates` or `task_updates` row
  - parent issue/task rows may be updated to reflect current status, but never
    without a matching history row
- do not add chat linkage, attachment linkage, storage logic, asset logic,
  climate logic, or future workflow layers in this write pass

## Current Repo Starting Point

The current repository already has the persisted read layer needed for a narrow
write plan:

- `rooms`, `issues`, `issue_updates`, `tasks`, and `task_updates` exist in the
  first KeepCozy persistence slice
- [server.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/keepcozy/server.ts)
  resolves the MVP loop from those tables
- `/issues/new` and `/tasks/new` already exist as stable route placeholders
- `/issues/[issueId]` and `/tasks/[taskId]` already render structured history
- `/activity` already reads a merged KeepCozy-first history view from issue and
  task updates

Current branch status:

- `/issues/new` now creates real `issues` and first `issue_updates` rows
- `/issues/[issueId]` now appends real `issue_updates` rows, including status
  changes and resolution history
- task write paths remain the next narrow lift

What is still missing is the first task write behavior, not route structure or
object shape.

## Scope Of The First Write Slice

The first write slice should add exactly these operations:

| Operation | MVP purpose | Required persisted effect |
| --- | --- | --- |
| create issue | open a new operational problem record in one home and optional room | insert `issues` row and first `issue_updates` row |
| append issue update | record progress without editing chat history | insert `issue_updates` row and update parent issue timestamps/status if needed |
| create task linked to issue | turn an issue into concrete work | insert `tasks` row and first `task_updates` row |
| append task update | record task progress | insert `task_updates` row and update parent task timestamps/status if needed |
| change issue/task status | reflect progress in append-oriented history | insert status-bearing history row first, then update parent row |

The first write slice should not add:

- general issue editing
- general task editing
- delete/archive flows
- attachments
- marketplace or vendor steps
- chat-linked side effects
- generic workflow engines

## Recommended UI Surfaces

### `/issues/new`

This should become the first issue-create surface.

Recommended MVP fields:

- `spaceId` hidden input from the active home context
- optional `roomId` preselected from query string `?room=<room-slug>`
- `title`
- `summary`
- optional `nextStep`
- `firstUpdateBody`

Recommended first-pass behavior:

- default new issues to status `open`
- insert the first history row with label `Issue logged`
- redirect to `/issues/[issue-slug]?space=<space_id>`

### `/issues/[issueId]`

This should become the first issue-update surface.

Recommended MVP controls:

- note body input
- optional short label input
- optional status target selector:
  - `open`
  - `planned`
  - `in_review`
  - `resolved`

Recommended first-pass behavior:

- note-only submit inserts `issue_updates.kind = 'note'`
- status change inserts `issue_updates.kind = 'status_change'`
- resolve inserts `issue_updates.kind = 'resolution'`
- any status mutation also updates `issues.status`, `issues.updated_at`, and
  resolution columns when status becomes `resolved`

### `/tasks/new`

This should become the first task-create surface.

Recommended MVP fields:

- `spaceId` hidden input from the active home context
- `issueId` required, preselected from query string `?issue=<issue-slug>` when
  launched from an issue detail screen
- `title`
- `summary`
- optional `nextStep`
- `firstUpdateBody`

Recommended first-pass behavior:

- default new tasks to status `planned`
- insert the first history row with label `Task created`
- redirect to `/tasks/[task-slug]?space=<space_id>`

### `/tasks/[taskId]`

This should become the first task-update surface.

Recommended MVP controls:

- note body input
- optional short label input
- optional status target selector:
  - `planned`
  - `active`
  - `waiting`
  - `done`
  - `cancelled`

Recommended first-pass behavior:

- note-only submit inserts `task_updates.kind = 'note'`
- status change inserts `task_updates.kind = 'status_change'`
- completion inserts `task_updates.kind = 'completion'`
- any status mutation also updates `tasks.status`, `tasks.updated_at`, and
  completion columns when status becomes `done`

## Append-Oriented Mutation Rules

### 1. Parent rows remain current-state records

`issues` and `tasks` should continue storing the current state used by list and
detail views.

That includes:

- current `status`
- current `next_step`
- `updated_at`
- `resolved_at` / `resolved_by` for issues when applicable
- `completed_at` / `completed_by` for tasks when applicable

### 2. History rows remain the audit trail

`issue_updates` and `task_updates` remain the permanent audit trail for what
happened and when.

Rule:

- every status mutation must insert a history row
- direct status-only parent updates are out of scope for this MVP

### 3. Status logic should stay small

Recommended first-pass status behavior:

- issue creation defaults to `open`
- task creation defaults to `planned`
- resolution is only represented by:
  - issue status `resolved`
  - task status `done`
- moving back out of `resolved` or `done` should clear
  `resolved_at` / `resolved_by` or `completed_at` / `completed_by`

### 4. First history rows should be system-shaped, not user-designed

Recommended generated labels:

- issue create: `Issue logged`
- task create: `Task created`
- issue status change: `Status updated`
- issue resolution: `Issue resolved`
- task status change: `Status updated`
- task completion: `Task completed`

The body remains user-provided.

## Recommended Repository And Action Layout

Keep the existing read layer separate from the first write layer.

Recommended new files:

- `app/(app)/issues/actions.ts`
  for:
  - create issue
  - append issue update
- `app/(app)/tasks/actions.ts`
  for:
  - create task
  - append task update
- `src/modules/keepcozy/write-server.ts`
  for:
  - slug generation
  - membership-aware lookup helpers
  - narrow mutation helpers that talk to Supabase

Recommended separation rule:

- [server.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/keepcozy/server.ts)
  stays focused on read composition and route context
- `write-server.ts` owns mutation-specific helpers
- route actions stay thin and follow the repo’s existing server-action pattern
  from [actions.ts](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/inbox/actions.ts)
  and [actions.ts](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/settings/actions.ts)

## Write-Path Validation Rules

### Authentication and membership

Use the same request-scoped Supabase client and viewer seam already used by the
repo:

- [server.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/lib/request-context/server.ts)

Recommended checks before mutation:

- authenticated viewer is required
- active `spaceId` is required
- parent issue/task must belong to the same `spaceId`
- selected room must belong to the same `spaceId`
- selected issue for task creation must belong to the same `spaceId`

RLS remains the final enforcement layer, but the write helpers should still
return clean user-facing failures before relying on policy errors.

### Slugs

The repo does not currently expose a reusable slug helper.

The first write pass should add a small KeepCozy-local helper that:

- derives a slug from title
- preserves current lowercase-hyphen route style
- uniquifies within `(space_id, slug)` for `issues` and `tasks`

This helper should stay local to KeepCozy until a broader shared need exists.

### User-facing failures

Recommended first-pass failure handling:

- use route-local server actions with redirect-based error messages
- redirect back to the current create/detail surface
- keep messages narrow:
  - missing title
  - missing update body
  - missing required issue selection
  - room or issue not found in this home
  - unable to save right now

## Revalidation And Redirect Guidance

### After issue create

Revalidate:

- `/home`
- `/issues`
- `/activity`
- affected room detail path when room is present

Redirect:

- `/issues/[issue-slug]?space=<space_id>`

### After issue update

Revalidate:

- `/home`
- `/issues`
- `/issues/[issueId]`
- `/tasks` when issue status impacts linked work lists
- `/activity`
- affected room detail path when room is present

Redirect:

- back to `/issues/[issueId]?space=<space_id>`

### After task create

Revalidate:

- `/home`
- `/tasks`
- `/issues/[issueId]`
- `/activity`
- affected room detail path through the parent issue

Redirect:

- `/tasks/[task-slug]?space=<space_id>`

### After task update

Revalidate:

- `/home`
- `/tasks`
- `/tasks/[taskId]`
- `/issues/[issueId]`
- `/activity`
- affected room detail path through the parent issue

Redirect:

- back to `/tasks/[taskId]?space=<space_id>`

## Canonical TEST-Home Support

The first write pass must preserve the current canonical mental model from
[keepcozy-mvp-test-flow.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-mvp-test-flow.md):

- `TEST` home
- `Kitchen` room
- `Kitchen faucet keeps dripping after shutoff`
- `Capture faucet model and cartridge type`
- issue and task history in `/activity`

Recommended stance:

- do not rewrite the canonical seed path in this write branch
- do allow append actions against the seeded issue and task once the schema and
  seed are applied
- treat the seeded flow as the first persisted end-to-end validation path for
  both reads and writes

## Explicit Non-Goals

- no migration that adds new tables
- no new attachment linkage
- no generalized edit/delete/archive flows
- no issue-to-chat coupling
- no task assignment or vendor workflow
- no room creation flow in this branch
- no generic activity engine beyond the current issue/task history surfaces

## Recommended Implementation Order

1. Add KeepCozy write helpers in
   `src/modules/keepcozy/write-server.ts`.
2. Add issue server actions in
   `app/(app)/issues/actions.ts`.
3. Turn `/issues/new` into a real create form.
4. Add append-update and status-change form support to `/issues/[issueId]`.
5. Add task server actions in
   `app/(app)/tasks/actions.ts`.
6. Turn `/tasks/new` into a real create form, preferably with `?issue=...`
   preselection when opened from an issue.
7. Add append-update and status-change form support to `/tasks/[taskId]`.
8. Verify the canonical TEST-home flow with the existing persisted seed and
   `/activity` history.

## Definition Of Success For The Next Implementation Branch

The next write implementation branch succeeds when:

- a user can create an issue in one home
- a user can add a first issue update at creation time
- a user can create a task linked to that issue
- a user can append issue and task progress notes later
- issue and task status can change only through history-backed mutations
- the read surfaces continue to reflect the persisted result without changing
  the route structure
