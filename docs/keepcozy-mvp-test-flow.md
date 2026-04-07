# KeepCozy MVP Test Flow

## Purpose

This document defines one practical, repeatable test path for the first
KeepCozy MVP loop inside the shared repository.

It is intentionally narrow.

The goal is not to simulate the whole future product. The goal is to give the
team one realistic operational path that can be checked end to end before
deeper schema work, automation, or chat linkage.

Related documents:

- [keepcozy-mvp-boundary.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-mvp-boundary.md)
- [keepcozy-first-persistence-slice.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-first-persistence-slice.md)
- [keepcozy-mvp-schema-runtime-alignment.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-mvp-schema-runtime-alignment.md)
- [space-model.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/space-model.md)
- [2026-04-03-spaces-default-test-backfill.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-03-spaces-default-test-backfill.sql)

## Current Test-Flow Stance

Until dedicated KeepCozy MVP tables exist, the first test flow should use the
current compatibility seams that already exist in this repository:

- shared `public.spaces` and `public.space_members` act as the current
  `home` and `home_membership` boundary
- the default seeded home is the shared `TEST` space from
  [2026-04-03-spaces-default-test-backfill.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-03-spaces-default-test-backfill.sql)
- the visible KeepCozy route layer is currently backed by lightweight preview
  runtime support in
  [mvp-preview.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/keepcozy/mvp-preview.ts)

Important clarification:

- this remains the current runtime proof path while the live screens are still
  preview-backed
- dedicated persistence migrations now exist for `rooms`, `issues`,
  `issue_updates`, `tasks`, and `task_updates`, but the route layer has not
  switched to those records yet
- the first proof should still be representative of the real MVP loop during
  that transition

## Canonical Test Home

Use one home only for the first proof:

- home: `TEST`

Reason:

- `TEST` is already the documented default space seed and rollout seam
- using the shared `TEST` home keeps the first proof aligned with current
  repository reality instead of inventing a new fixture path

## Canonical Test Entities

Use one primary operational path and keep the rest secondary.

| Layer | Canonical test record | Purpose |
| --- | --- | --- |
| home | `TEST` | current seeded home compatibility seam |
| room | `Kitchen` | practical room for a real issue/task path |
| issue | `Kitchen faucet keeps dripping after shutoff` | clear operational problem tied to one room |
| task | `Capture faucet model and cartridge type` | narrow linked task that moves the issue forward |
| issue updates | `Issue logged`, `Initial assessment` | issue history proof |
| task updates | `Task created`, `Scope held` | task history proof |

Secondary preview rooms may stay visible, but they should not become the main
validation path.

## End-To-End Validation Path

The first proof path should be checked in this order:

1. Home selection
   Open `/spaces`, choose the `TEST` home, and confirm the next entry goes to
   `/home?space=<space_id>`.
2. Home dashboard
   Open the `Primary test flow` card on
   [page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/home/page.tsx) and
   confirm the flow points to `Kitchen`, the faucet issue, the linked task, and
   history.
   If another home is active, the app should ask the reviewer to switch to
   `TEST` instead of pretending the canonical proof path applies there.
3. Room
   Open `/rooms/kitchen` and confirm the room presents the issue/task context as
   room-scoped operational work.
4. Issue
   Open `/issues/kitchen-faucet-drip` and confirm:
   - the issue is room-linked
   - issue updates are visible as structured history
   - the linked task is visible from the issue detail
5. Task
   Open `/tasks/capture-faucet-model` and confirm:
   - the task is issue-linked
   - task updates are visible as structured progress history
   - the task still points back to the issue and room
6. History
   Open `/activity` and confirm the `Primary test flow history` section shows
   the same issue/task update path in one place.
   If another home is active, the screen should again prompt the reviewer back
   to `TEST`.

## What Counts As A Pass

The first test flow passes when the team can validate all of the following in
one home session:

- one home can be entered cleanly
- one room can be opened as the operational context
- one issue can be read as a structured problem record
- one linked task can be read as the work item that moves the issue forward
- issue and task updates are visible as history, not just generic chat traffic
- the user can move through the loop without needing chat as the primary UX

## Minimal Runtime Support In This Branch

This branch keeps implementation support intentionally small:

- the canonical preview data and primary test flow are defined in
  [mvp-preview.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/keepcozy/mvp-preview.ts)
- the active home context still resolves through shared space helpers in
  [server.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/keepcozy/server.ts)
- the home dashboard explicitly exposes the first proof path in
  [page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/home/page.tsx)
- the history screen exposes the combined issue/task proof path in
  [page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/activity/page.tsx)

## What This Test Flow Should Not Do Yet

The first proof path should not expand into:

- deep chat linkage
- supplier or marketplace detail
- storage or asset intelligence
- climate intelligence
- automation or recommendation layers
- broad fixture libraries or many synthetic homes

## Next Lift After This Pass

Once the team is satisfied with the first proof path, the next implementation
lift should replace the preview-backed room/issue/task records with the first
dedicated MVP schema slice:

- `rooms`
- `issues`
- `issue_updates`
- `tasks`
- `task_updates`

That next lift is now defined in
[keepcozy-first-persistence-slice.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-first-persistence-slice.md)
and begins with:

- [2026-04-07-keepcozy-first-persistence-slice.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-07-keepcozy-first-persistence-slice.sql)
- [2026-04-07-keepcozy-first-persistence-slice-rls-hardening.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-07-keepcozy-first-persistence-slice-rls-hardening.sql)
- [2026-04-07-keepcozy-first-persistence-slice-test-seed.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-07-keepcozy-first-persistence-slice-test-seed.sql)

The test flow above should remain the same when that lift happens. Only the
backing persistence layer should change.
