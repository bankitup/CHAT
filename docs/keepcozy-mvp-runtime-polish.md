# KeepCozy MVP Runtime Polish

This document defines the highest-value runtime polish work for the current KeepCozy MVP loop on `feature/keepcozy-mvp-runtime-polish`.

It assumes the current branch already has:

- persisted MVP records for `rooms`, `issues`, `issue_updates`, `tasks`, and `task_updates`
- persisted read paths in `src/modules/keepcozy/server.ts`
- persisted issue/task write paths in `src/modules/keepcozy/write-server.ts`
- current MVP routes at `/home`, `/rooms`, `/issues`, `/tasks`, and `/activity`
- the canonical persisted `TEST` home proof path

The goal of this pass is not to add new product scope. The goal is to make the existing MVP loop clearer, more reliable, and easier to validate before chat hookup or broader object layering.

## Scope

This polish pass stays inside the current MVP loop:

- home selection and home dashboard
- room list and room detail entry points
- issue list, issue detail, issue create, and issue history
- task list, task detail, task create, and task history
- activity/history for the persisted MVP loop

This pass does not introduce:

- chat linkage or chat-driven workflow
- storage, asset, or attachment-heavy flows
- climate, sensors, recommendations, or supplier logic
- broader object modeling beyond the current MVP schema slice
- a product IA redesign or visual redesign

## Current Runtime Reality

The current MVP runtime is already real enough to polish instead of re-architect:

- `/home` reads persisted counts and the primary `TEST` flow summary from `src/modules/keepcozy/server.ts`
- `/rooms`, `/issues`, `/tasks`, and `/activity` read persisted MVP data when the KeepCozy tables exist
- issue creation and issue updates are persisted through `src/modules/keepcozy/write-server.ts`
- task creation and task updates are persisted through `src/modules/keepcozy/write-server.ts`
- issue and task history are already append-oriented through `issue_updates` and `task_updates`
- preview data remains a temporary fallback for environments where the MVP tables are unavailable

The highest-value gaps are now runtime polish gaps, not missing schema gaps.

## Priority Order

## P0

### 1. Revalidation Consistency

The read/write loop should feel immediately trustworthy after every mutation.

Current gaps:

- issue create revalidation is broad and mostly correct
- task create and task update revalidation are broad and mostly correct
- issue update revalidation is narrower and can leave `/home` stale after appended history

Required outcome:

- `/home`, `/issues`, `/tasks`, `/activity`, and affected detail/filter routes stay in sync after every issue or task mutation
- the primary `TEST` flow card on `/home` stays current after issue updates, not only after issue creation

Primary file targets:

- `app/(app)/issues/actions.ts`
- `app/(app)/tasks/actions.ts`

Implementation note:

- keep the current route structure and Server Action approach
- fix this with narrow `revalidatePath` alignment, not a new data-fetching model

### 2. Form UX And Validation Clarity

The current write paths are real, but validation and error recovery are still too fragile for repeated testing.

Current gaps:

- create forms redirect with coarse success/error messages and do not preserve most typed values after validation failure
- issue/task update forms do not clearly distinguish note-only updates from status-changing updates
- the canonical seeded flow can fail on status changes because of current creator/admin rules, but the forms do not explain that context

Required outcome:

- create and update forms preserve enough entered state to make retries practical on mobile
- validation errors are specific enough to tell the user what to fix next
- issue/task detail forms explain the practical difference between note updates and status changes

Primary file targets:

- `app/(app)/issues/new/page.tsx`
- `app/(app)/issues/[issueId]/page.tsx`
- `app/(app)/tasks/new/page.tsx`
- `app/(app)/tasks/[taskId]/page.tsx`
- `app/(app)/issues/actions.ts`
- `app/(app)/tasks/actions.ts`

Implementation note:

- stay narrow
- prefer redirect-safe draft echo and clearer copy over introducing a heavier client-side form stack

### 3. Canonical Test-Flow Usability

The `TEST -> Kitchen -> faucet issue -> linked task -> history` path should stay easy to validate even as real writes accumulate.

Current gaps:

- the canonical flow is visible on `/home` and `/activity`, but recovery guidance is still light when seeded data is missing or partial
- docs need to stay explicit about which checks validate shared seeded records versus newly created creator-owned records

Required outcome:

- when `TEST` is active and the canonical records are missing, the UI explains the next recovery step instead of looking broken
- docs keep one clear persisted validation path for the shared seeded flow and one clear path for creator-owned write validation

Primary file targets:

- `docs/keepcozy-mvp-test-flow.md`
- `app/(app)/home/page.tsx`
- `app/(app)/activity/page.tsx`

Implementation note:

- keep the same canonical story and route targets
- do not add fixture complexity beyond the current narrow seed model

## P1

### 4. Empty States And Missing-Data States

The MVP loop should always tell the user what the next practical step is.

Current gaps:

- list pages fall back to generic empty cards instead of next-step guidance
- detail pages can hit missing record states that are technically safe but not especially helpful
- filtered list pages do not always explain how to recover when the selected room or issue is missing

Required outcome:

- `/rooms`, `/issues`, `/tasks`, and `/activity` empty states point to the next useful action
- detail pages distinguish between "record missing" and "wrong home/filter context"
- filtered list screens offer a clear reset path back to the broader list

Primary file targets:

- `app/(app)/rooms/page.tsx`
- `app/(app)/issues/page.tsx`
- `app/(app)/tasks/page.tsx`
- `app/(app)/issues/[issueId]/page.tsx`
- `app/(app)/tasks/[taskId]/page.tsx`
- `app/(app)/activity/page.tsx`

### 5. Transitional Copy And Preview Language Cleanup

The runtime is no longer primarily preview-backed, but several route surfaces still read like preview scaffolding.

Current gaps:

- `/rooms`, `/issues`, and `/tasks` still show "preview" pills and preview-first copy
- some cards describe the persisted MVP loop as if it is still only a prototype surface

Required outcome:

- core route copy describes the current runtime as live MVP operations
- preview fallback remains an implementation detail, not the main product story

Primary file targets:

- `app/(app)/rooms/page.tsx`
- `app/(app)/issues/page.tsx`
- `app/(app)/tasks/page.tsx`
- `app/(app)/home/page.tsx`
- `src/modules/i18n/index.ts`

### 6. Room / Issue / Task Linkage Visibility

The MVP loop works best when the user can always see how the current record connects to the next one.

Current gaps:

- create screens preserve some context, but the selected room or issue is not always made visually explicit enough
- list screens show linkage pills, but the hierarchy is not always obvious at a glance
- activity links are correct, but the relationship between home, room, issue, and task can still feel implied instead of explicit

Required outcome:

- create issue makes selected room context obvious
- create task makes selected issue and inherited room context obvious
- issue and task detail pages keep the related object links visible without extra scanning

Primary file targets:

- `app/(app)/issues/new/page.tsx`
- `app/(app)/tasks/new/page.tsx`
- `app/(app)/issues/[issueId]/page.tsx`
- `app/(app)/tasks/[taskId]/page.tsx`
- `app/(app)/activity/page.tsx`

## P2

### 7. Activity / History Coherence

`/activity` already reflects the persisted MVP loop, but it still needs a focused polish pass so the operational history reads cleanly beside the retained messaging lane.

Current gaps:

- KeepCozy counts are clear, but history labels can be more explicit about issue-stage versus task-stage updates
- the retained messaging section is intentionally secondary, but the boundary can still be clearer in copy and card emphasis

Required outcome:

- the KeepCozy operational digest remains the first thing the user understands on `/activity`
- issue/task history language matches what users see on detail pages
- the secondary messaging lane stays visible without competing with the MVP loop

Primary file targets:

- `app/(app)/activity/page.tsx`
- `src/modules/i18n/index.ts`

### 8. Mobile-First Action Clarity

The current layout is already mobile-safe, but a polish pass should remove avoidable friction from the most common MVP actions.

Current gaps:

- primary actions sometimes compete visually with context pills or secondary buttons
- some stacked cards still read like scaffolding rather than a first operational tool

Required outcome:

- create, update, and back-navigation actions are obvious on small screens
- the next action in the loop is always easier to spot than future-facing or secondary actions

Primary file targets:

- `app/(app)/home/page.tsx`
- `app/(app)/rooms/page.tsx`
- `app/(app)/issues/page.tsx`
- `app/(app)/issues/new/page.tsx`
- `app/(app)/issues/[issueId]/page.tsx`
- `app/(app)/tasks/page.tsx`
- `app/(app)/tasks/new/page.tsx`
- `app/(app)/tasks/[taskId]/page.tsx`
- `app/(app)/activity/page.tsx`

## Recommended Execution Order

1. Fix revalidation consistency, starting with issue update parity against the existing task update behavior.
2. Improve form validation clarity and preserve enough typed state for mobile-friendly retries.
3. Strengthen canonical `TEST` flow guidance on `/home`, `/activity`, and in the test-flow doc.
4. Upgrade empty states so every MVP route points clearly to the next step.
5. Remove preview-first copy from persisted route surfaces.
6. Tighten linkage visibility and activity wording once the above behavior is stable.

## Non-Goals For This Polish Pass

Do not use this pass to:

- add attachments or asset handling
- add room creation flows
- broaden issue or task fields beyond the current MVP schema slice
- add assignee systems, supplier workflows, or automation
- replace the retained messaging lane with a generic timeline engine
- change the shared `space` / `space_members` seam

## Definition Of Done For Runtime Polish

This polish plan is complete when the next code pass leaves the runtime in this state:

- persisted issue and task writes feel consistent and trustworthy
- `/home` and `/activity` stay in sync with appended history
- empty and missing-data states guide the user forward through the MVP loop
- the canonical `TEST` flow remains easy to validate on real records
- room, issue, and task links are visible enough to understand the loop without extra explanation
- the app reads as a practical KeepCozy MVP runtime, not as preview scaffolding
