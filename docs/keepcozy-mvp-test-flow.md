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
- [keepcozy-mvp-write-paths.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-mvp-write-paths.md)
- [keepcozy-mvp-schema-runtime-alignment.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-mvp-schema-runtime-alignment.md)
- [space-model.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/space-model.md)
- [2026-04-03-spaces-default-test-backfill.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-03-spaces-default-test-backfill.sql)
- [2026-04-07-keepcozy-first-persistence-slice.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-07-keepcozy-first-persistence-slice.sql)
- [2026-04-07-keepcozy-first-persistence-slice-rls-hardening.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-07-keepcozy-first-persistence-slice-rls-hardening.sql)
- [2026-04-07-keepcozy-first-persistence-slice-test-seed.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-07-keepcozy-first-persistence-slice-test-seed.sql)

## Current Test-Flow Stance

The first test flow uses the current compatibility seams that already exist in
this repository:

- shared `public.spaces` and `public.space_members` act as the current
  `home` and `home_membership` boundary
- the default seeded home is the shared `TEST` space from
  [2026-04-03-spaces-default-test-backfill.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-03-spaces-default-test-backfill.sql)
- the visible KeepCozy route layer now reads dedicated persisted MVP records
  through [server.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/keepcozy/server.ts)

Important clarification:

- this is now the canonical persisted proof path once the first KeepCozy MVP
  tables and TEST-home seed have been applied
- [mvp-preview.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/keepcozy/mvp-preview.ts)
  remains only as a temporary fallback for pre-migration environments where
  those tables are not available yet
- the seeded faucet issue and linked task remain the shared anchor records for
  the first proof path
- the first proof should still be representative of the real MVP loop during
  rollout across environments

## Persisted Setup Checklist

Use this order when validating the canonical flow against real records:

1. Ensure the shared TEST home exists by applying
   [2026-04-03-spaces-default-test-backfill.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-03-spaces-default-test-backfill.sql)
   if needed.
2. Apply the first KeepCozy MVP tables from
   [2026-04-07-keepcozy-first-persistence-slice.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-07-keepcozy-first-persistence-slice.sql).
3. Apply the conservative access rules from
   [2026-04-07-keepcozy-first-persistence-slice-rls-hardening.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-07-keepcozy-first-persistence-slice-rls-hardening.sql).
4. Apply the narrow canonical seed from
   [2026-04-07-keepcozy-first-persistence-slice-test-seed.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-07-keepcozy-first-persistence-slice-test-seed.sql).
5. Open `/spaces`, select `TEST`, and validate the flow from `/home`.

Important rule:

- the canonical validation path should now use persisted rows first
- preview fallback should only be treated as an environment safety net before
  the migrations and seed are applied
- the seed provides the baseline proof path and does not reset prior reviewer
  edits, so repeated validation should append new updates instead of expecting a
  pristine reset every run

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

Secondary rooms may stay visible, but they should not become the main
validation path.

Canonical persisted route slugs must stay stable:

- room route: `/rooms/kitchen`
- issue route: `/issues/kitchen-faucet-drip`
- task route: `/tasks/capture-faucet-model`

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
   If the card is missing while `TEST` is active, confirm the persisted
   KeepCozy seed has been applied before changing the flow.
3. Room
   Open `/rooms/kitchen` and confirm the room presents the issue/task context as
   room-scoped operational work.
4. Issue
   Open `/issues/kitchen-faucet-drip` and confirm:
   - the issue is room-linked
   - issue updates are visible as structured history
   - the linked task is visible from the issue detail
   - add one note-only issue update through the live form
   Recommended shared validation input:
   `label = Write-path check`
   `body = Requested one faucet model photo before deciding on parts.`
5. Task
   Open `/tasks/capture-faucet-model` and confirm:
   - the task is issue-linked
   - task updates are visible as structured progress history
   - the task still points back to the issue and room
   - add one note-only task update through the live form
   Recommended shared validation input:
   `label = Waiting on photo`
   `body = Need one clear fixture photo before moving from identification to repair.`
6. History
   Open `/activity` and confirm the `Primary test flow history` section shows
   the same issue/task update path in one place, including the newly appended
   persisted issue/task updates.
   If another home is active, the screen should again prompt the reviewer back
   to `TEST`.
7. Optional creator-owned extension
   If you need to validate the create surfaces or status-change flow end to
   end, use the live forms to create a new issue in `TEST`, then create a new
   linked task from that issue, and finally append updates or a status change
   on those new records.
   This keeps the canonical faucet path intact while also giving the current
   reviewer creator-owned records for full write validation.

Expected baseline persisted history order:

- `Issue logged`
- `Initial assessment`
- `Task created`
- `Scope held`

Expected write-validation behavior:

- the two new note-only updates should appear after the seeded baseline entries
  in both the issue/task detail timelines and `/activity`
- the seeded faucet issue/task remain the canonical anchor records even after
  those extra updates are appended

## What Counts As A Pass

The first test flow passes when the team can validate all of the following in
one home session:

- one home can be entered cleanly
- one room can be opened as the operational context
- one issue can be read as a structured problem record
- one linked task can be read as the work item that moves the issue forward
- issue and task updates are visible as history, not just generic chat traffic
- at least one persisted issue update and one persisted task update can be
  appended through the live KeepCozy forms
- `/activity` reflects those same persisted updates as operational history
- the user can move through the loop without needing chat as the primary UX

Optional stronger pass:

- the reviewer can create a new issue in `TEST`
- the reviewer can create a new task from that issue
- the reviewer can append updates or change status on those newly created
  records

## Minimal Runtime Support In This Branch

This branch keeps implementation support intentionally small:

- the active home context and persisted MVP read layer resolve through
  [server.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/keepcozy/server.ts)
- the canonical fallback ids and compatibility preview remain defined in
  [mvp-preview.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/keepcozy/mvp-preview.ts)
- the home dashboard explicitly exposes the first proof path in
  [page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/home/page.tsx)
- the issue create/detail routes now support persisted writes in
  [page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/issues/new/page.tsx)
  and
  [page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/issues/[issueId]/page.tsx)
- the task create/detail routes now support persisted writes in
  [page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/tasks/new/page.tsx)
  and
  [page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/tasks/[taskId]/page.tsx)
- the history screen exposes the combined issue/task proof path in
  [page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/activity/page.tsx)
- the canonical TEST-home seed preserves the same room, issue, and task slugs
  as the preview-backed shell so the mental model does not change

## Current Validation Modes

Use these two modes deliberately:

### Shared canonical mode

Use the seeded `TEST` -> `Kitchen` -> faucet issue -> linked task path when the
team wants one common proof flow across environments.

Best for:

- validating the product story
- validating persisted reads
- validating note-only issue/task updates that should show up in `/activity`

### Creator-owned extension mode

Create a new issue and linked task in `TEST` when the reviewer needs to confirm
full authoring behavior on records they own.

Best for:

- validating `/issues/new`
- validating `/tasks/new`
- validating creator-owned status changes on issue/task records

Important current policy note:

- note-only updates can be validated against the seeded faucet issue/task path
- status-change validation may require the current reviewer to be the record
  creator or a `TEST` home owner/admin under the current narrow RLS rules

## What This Test Flow Should Not Do Yet

The first proof path should not expand into:

- deep chat linkage
- supplier or marketplace detail
- storage or asset intelligence
- climate intelligence
- automation or recommendation layers
- broad fixture libraries or many synthetic homes

## Current Write Support

The canonical proof path can now be validated with narrow persisted writes on
top of the first dedicated MVP schema slice:

- create issue
- create task
- append issue update
- append task update

That current write layer is defined in
[keepcozy-mvp-write-paths.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-mvp-write-paths.md).

That first persistence slice is defined in
[keepcozy-first-persistence-slice.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-first-persistence-slice.md)
and begins with:

- [2026-04-07-keepcozy-first-persistence-slice.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-07-keepcozy-first-persistence-slice.sql)
- [2026-04-07-keepcozy-first-persistence-slice-rls-hardening.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-07-keepcozy-first-persistence-slice-rls-hardening.sql)
- [2026-04-07-keepcozy-first-persistence-slice-test-seed.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-07-keepcozy-first-persistence-slice-test-seed.sql)

The test flow above should remain the same as those writes harden. The main
change should be better authoring polish, not a new proof path.
