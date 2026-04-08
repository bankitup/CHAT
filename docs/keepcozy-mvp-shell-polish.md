# KeepCozy MVP Shell Polish

This document defines the highest-value shell polish work for the current
KeepCozy MVP app shell on `feature/keepcozy-mvp-shell-polish`.

It assumes the current branch already has:

- a real persisted MVP loop for `rooms`, `issues`, `issue_updates`, `tasks`,
  and `task_updates`
- KeepCozy-first routes at `/home`, `/rooms`, `/issues`, `/tasks`, and
  `/activity`
- persisted issue/task write paths and append-oriented history
- the canonical persisted `TEST` home proof path

The goal of this pass is not to add new domain scope or redesign the whole
visual system. The goal is to make the current MVP feel like one coherent
product shell instead of a set of individually polished pages.

## Scope

This pass stays at the shell level:

- active home visibility and switching
- top-level navigation and section hierarchy
- continuity between home, rooms, issues, tasks, and activity
- shell-level mobile action placement
- loading, empty, and error shell states
- section naming and route framing consistency
- canonical `TEST`-home proof-path clarity from the shell perspective

This pass does not introduce:

- chat linkage or chat-led workflow
- storage, asset, climate, sensor, supplier, or recommendation layers
- a new route model or IA redesign
- broad detail-page workflow redesign beyond what supports shell continuity

## Current Shell Reality

The current shell already has useful foundation:

- [app-shell-frame.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/app-shell-frame.tsx)
  gives the MVP a stable bottom navigation with `Home`, `Rooms`, `Issues`,
  `Tasks`, and `History`
- [layout.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/layout.tsx)
  consistently wraps the authenticated KeepCozy routes
- [spaces/page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/spaces/page.tsx)
  already acts as the shared home-switching seam
- [home/page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/home/page.tsx)
  is the strongest expression of the current product loop and the canonical
  `TEST` proof path

The biggest shell gaps are now about coherence, not missing features:

- the shared shell now carries active home context, current section framing,
  and the core MVP loop strip above the page body
- `/rooms`, `/issues`, `/tasks`, and `/activity` now include stronger section
  entry cards with clearer next-step actions
- [loading.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/loading.tsx) and
  [error.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/error.tsx) now read as
  KeepCozy shell states instead of generic app scaffolding
- empty, wrong-home, and TEST-home mismatch states now give more practical
  recovery actions from the shell level

Remaining shell gaps are intentionally narrower:

- some top-level route copy still carries transitional MVP wording that can be
  tightened later
- create/detail routes are improved indirectly by the shell, but they are not
  yet fully aligned to the same shell-state language
- secondary settings and chat surfaces remain deliberately outside the main
  five-section shell

## Delivered In This Branch

This branch now delivers the following shell-level changes:

- a shared home-context shell bar in
  [app-shell-frame.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/app-shell-frame.tsx)
  that shows the active home, current section, next section, and core loop
- a stronger home-scoped action hierarchy across
  [home/page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/home/page.tsx),
  [rooms/page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/rooms/page.tsx),
  [issues/page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/issues/page.tsx),
  [tasks/page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/tasks/page.tsx),
  and [activity/page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/activity/page.tsx)
- KeepCozy-shaped loading and error shells in
  [loading.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/loading.tsx) and
  [error.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/error.tsx)
- clearer empty and mismatch recovery states for the current home context and
  the canonical TEST-home proof path
- supporting shell copy and styling in
  [index.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/i18n/index.ts) and
  [globals.css](/Users/danya/IOS%20-%20Apps/CHAT/app/globals.css)

## Priority Order

## P0

### 1. Active Home Visibility And Switching Clarity

The active home is the outer shell context for the whole MVP loop, so it
should be obvious on every top-level KeepCozy route.

Current gaps:

- the bottom nav preserves the `space` param but does not visibly tell the user
  which home is active
- switching homes is possible, but the route-to-route path back to
  `/spaces` still feels indirect outside `/home`
- the shell does not currently distinguish between "wrong home for this review"
  and "valid home, just different context"

Required outcome:

- every top-level KeepCozy route shows the active home clearly
- every top-level KeepCozy route offers one low-friction path to switch homes
- wrong-home recovery for the canonical `TEST` proof path is obvious without
  forcing the user to rediscover `/spaces`

Primary file targets:

- [app-shell-frame.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/app-shell-frame.tsx)
- [home/page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/home/page.tsx)
- [spaces/page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/spaces/page.tsx)
- [server.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/keepcozy/server.ts)

Implementation note:

- prefer one lightweight shared shell context treatment over more page-local
  switch-home blocks
- keep `space` and `space_members` as the current home seam

### 2. Top-Level Navigation Coherence And Hierarchy

The app already has the right top-level destinations. The next improvement is
to make their relationship easier to understand at a glance.

Current gaps:

- the bottom nav tells the user where they can go, but not how those sections
  relate inside the MVP loop
- `/home` functions as the dashboard, while `/rooms`, `/issues`, `/tasks`, and
  `/activity` act as peer sections, but that hierarchy is expressed mostly in
  page copy rather than the shell
- history is correctly named in nav, but `/activity` still needs the shell to
  reinforce that it is operational history, not a general social feed

Required outcome:

- the shell makes `Home` read as the dashboard and the other four sections read
  as the core operational lanes
- the user can move between top-level sections without feeling like they have
  left the same product area
- the shell keeps `History` operational and secondary chat surfaces secondary

Primary file targets:

- [app-shell-frame.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/app-shell-frame.tsx)
- [home/page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/home/page.tsx)
- [rooms/page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/rooms/page.tsx)
- [issues/page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/issues/page.tsx)
- [tasks/page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/tasks/page.tsx)
- [activity/page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/activity/page.tsx)
- [index.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/i18n/index.ts)

Implementation note:

- do not add more tabs or new route groups
- tighten shared framing and naming around the current five-section shell

### 3. Page-To-Page Continuity

The current pages are individually clear, but the transition between them still
feels more local than systemic.

Current gaps:

- selected home, filtered room, and filtered issue context are shown
  differently across routes
- list pages use page-local preview cards to explain context instead of one
  shared route-context pattern
- the move from room to issue to task to history is correct, but the shell does
  not yet make that path feel continuous

Required outcome:

- `/rooms`, `/issues`, `/tasks`, and `/activity` share one compact context
  pattern for active home and active filter state
- filtered states show a clear reset path without looking like a dead end
- the user can always tell where they are in the operational loop

Primary file targets:

- [rooms/page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/rooms/page.tsx)
- [issues/page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/issues/page.tsx)
- [tasks/page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/tasks/page.tsx)
- [activity/page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/activity/page.tsx)
- [globals.css](/Users/danya/IOS%20-%20Apps/CHAT/app/globals.css)

Implementation note:

- reuse the existing pill/meta-row language instead of inventing a new shell
  component library

### 4. Canonical TEST-Home Proof-Path Clarity From The Shell

The current proof path is strong on `/home`, `/activity`, and the canonical
detail pages. The shell still needs to reinforce it consistently when reviewers
move around.

Current gaps:

- the proof path is clear once the reviewer lands on the right pages, but the
  shell itself does not consistently echo that the review target is the `TEST`
  home
- wrong-home states exist, but they still feel page-specific rather than shell
  guided
- if the canonical seed is missing, the reviewer can still end up with multiple
  "safe but thin" pages before reaching the right recovery clue

Required outcome:

- the shell consistently supports the reviewer path `Choose TEST -> Home ->
  Kitchen -> faucet issue -> linked task -> History`
- wrong-home and missing-seed states guide the reviewer back to the canonical
  path quickly
- the shell keeps the proof path representative without turning it into a full
  onboarding system

Primary file targets:

- [home/page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/home/page.tsx)
- [rooms/page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/rooms/page.tsx)
- [activity/page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/activity/page.tsx)
- [keepcozy-mvp-test-flow.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-mvp-test-flow.md)

## P1

### 5. Mobile-First Action Placement

The app already fits mobile screens, but the primary shell actions can still be
easier to spot and repeat across sections.

Current gaps:

- create actions live in page headers on list screens, but the placement rhythm
  is not equally strong across all top-level surfaces
- `/home` mixes switch-home, core-loop actions, and secondary surfaces in a way
  that can blur the main next step
- the most important action on a page is not always visually stronger than the
  supporting pills around it

Required outcome:

- each top-level route has one obvious primary action
- shell-level actions stay predictable on small screens
- secondary actions such as chat/profile stay visibly secondary

Primary file targets:

- [app-shell-frame.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/app-shell-frame.tsx)
- [home/page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/home/page.tsx)
- [rooms/page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/rooms/page.tsx)
- [issues/page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/issues/page.tsx)
- [tasks/page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/tasks/page.tsx)
- [activity/page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/activity/page.tsx)
- [globals.css](/Users/danya/IOS%20-%20Apps/CHAT/app/globals.css)

### 6. Loading, Empty, And Error Shell States

The shell should keep the user oriented even when data is missing or still
loading.

Current gaps:

- the shared app loading state is generic and does not reflect the KeepCozy
  section shell
- the shared app error boundary is useful, but not yet aligned with the
  five-section KeepCozy shell language
- several empty cards still repeat explanatory copy instead of clearly offering
  the next step

Required outcome:

- loading states feel like KeepCozy, not generic app scaffolding
- error states keep the user anchored to `Home` and `Choose home`
- empty states tell the user the next practical move inside the MVP loop

Primary file targets:

- [loading.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/loading.tsx)
- [error.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/error.tsx)
- [rooms/page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/rooms/page.tsx)
- [issues/page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/issues/page.tsx)
- [tasks/page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/tasks/page.tsx)
- [activity/page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/activity/page.tsx)

### 7. Section Naming Consistency

The product is now persisted and operational enough that shell language should
stop sounding transitional.

Current gaps:

- top-level route cards still use `MVP slice` and preview-style language
- shell naming is stable, but some page framing still sounds like a prototype
  explanation instead of live MVP operations
- section names are right, but their support copy is not always equally
  production-shaped

Required outcome:

- the shell speaks consistently in live MVP language
- preview fallback stays an implementation detail, not the main user-facing
  story
- `History` stays aligned with operational updates across shell and page copy

Primary file targets:

- [home/page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/home/page.tsx)
- [rooms/page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/rooms/page.tsx)
- [issues/page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/issues/page.tsx)
- [tasks/page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/tasks/page.tsx)
- [activity/page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/activity/page.tsx)
- [index.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/i18n/index.ts)

## P2

### 8. Support Surfaces And Shell Containment

The MVP shell should feel complete without hiding secondary surfaces that still
exist in the shared app.

Current gaps:

- chat and profile are correctly secondary, but their relationship to the main
  KeepCozy shell still depends heavily on `/home`
- page-level shell cues do not yet fully reinforce that those surfaces support
  the loop rather than define it

Required outcome:

- the core five-section shell remains the obvious product center of gravity
- secondary chat/profile routes stay reachable without pulling the app back
  toward a chat-first reading

Primary file targets:

- [home/page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/home/page.tsx)
- [app-shell-frame.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/app-shell-frame.tsx)
- [index.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/i18n/index.ts)

## Recommended Execution Order

1. Make the active home visible and switchable from the shared shell, not only
   from page-local cards.
2. Tighten top-level section hierarchy and route-to-route continuity across
   `/home`, `/rooms`, `/issues`, `/tasks`, and `/activity`.
3. Strengthen the canonical `TEST` proof path from the shell perspective,
   especially for wrong-home and missing-seed recovery.
4. Improve mobile-first action placement once the shared shell context is
   stable.
5. Clean up loading, empty, error, and naming states so the shell reads like a
   live MVP product instead of transitional scaffolding.

## Non-Goals For This Shell Pass

This pass should not:

- add new KeepCozy domains beyond the current persisted MVP loop
- add new top-level routes or replace the current route structure
- introduce chat linkage, generic feed behavior, or messaging-first shell
  decisions
- widen into asset, storage, climate, marketplace, or automation workflows
- redesign the entire visual system

## Done Looks Like

This shell pass is successful when:

- the active home is obvious from anywhere in the KeepCozy shell
- the five top-level MVP sections feel like one product, not separate screens
- the canonical `TEST` proof path is easier to follow from the shell alone
- mobile users can spot the primary action and current context quickly
- loading, empty, and error states keep the user oriented inside the MVP loop
- future domains remain deferred instead of quietly re-entering through shell
  framing
