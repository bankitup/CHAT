# Messenger Space Shell Polish

This document defines the highest-value shell polish work for
`messenger_full` spaces in the shared CHAT + KeepCozy app.

It assumes the repo already has:

- profile-aware space resolution through
  [server.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/spaces/server.ts)
- a profile-aware shared shell in
  [app-shell-frame.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/app-shell-frame.tsx)
- shared messaging route-access seams in
  [route-context.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/server/route-context.ts)
- a working messenger-space entry path into `/inbox`
- a separate KeepCozy `TEST` space that remains the ops-oriented sandbox

The goal of this pass is not to redesign the app or fork a second product.
The goal is to make `messenger_full` spaces feel clearly chat-first inside the
shared shell, with less KeepCozy leakage and a more coherent mobile messenger
posture.

## Scope

This pass stays at the messenger-shell level:

- bottom navigation for `messenger_full`
- shell hierarchy between home, chats, activity, spaces, and settings
- active space visibility and switching clarity
- fresh-space empty states
- page-to-page continuity between `/inbox`, `/spaces`, and `/settings`
- profile-aware differentiation between messenger and KeepCozy shells
- mobile-first action clarity

This pass does not introduce:

- a new product architecture
- deep chat-linkage into KeepCozy objects
- new storage, asset, climate, or supplier domains
- final capability enforcement beyond the current shell split

## Current Branch Reality

This branch now provides the first real messenger-profile shell posture:

- `messenger_full` spaces use a messenger bottom nav:
  `Home / Chats / Activity`
- `keepcozy_ops` spaces keep the existing KeepCozy bottom nav:
  `Home / Rooms / Issues / Tasks / History`
- `/home` is now profile-aware and renders a lightweight messenger home surface
  for messenger spaces
- `/activity` is now profile-aware and renders a message-centric activity view
  for messenger spaces instead of reusing KeepCozy-first operational framing
- `/inbox` now treats a clean messenger space like a real starting point rather
  than a generic empty chat list

The remaining work after this branch is no longer “make messenger shell real at
all.” It is refinement and hardening.

Current messenger-shell strengths on this branch:

- the active space is visible on messenger home and fresh-space inbox states
- the shell distinguishes messenger spaces from KeepCozy spaces immediately
- settings remain reachable, but they no longer dominate the primary messenger
  bottom nav
- a fresh messenger space now exposes concrete first actions:
  create DM, create group, and manage members when the current user can do so

## Desired Messenger Shell Posture

For `messenger_full`, the shell should feel like:

- chat-first
- mobile-first
- active-space aware
- lightweight to understand in a fresh space
- clearly distinct from KeepCozy without becoming a separate app

Recommended first messenger shell posture:

- `Home` = messenger overview and fresh-space starting point
- `Chats` = inbox and conversation continuity
- `Activity` = message-centric recent activity and unread continuity
- `Spaces` = switching context, not a primary daily tab
- `Settings` = reachable but secondary

Practical rule:

- messenger spaces should look like a place where conversation is the product
- KeepCozy surfaces may remain reachable in the repo, but they should not
  define the shell promise for `messenger_full`

## What This Branch Delivered

### 1. Messenger Bottom Navigation Is Now Shell-Defining

- messenger spaces use `Home / Chats / Activity`
- KeepCozy spaces are unaffected
- the split remains profile-aware and still runs through the shared auth and
  active-space context

Primary files:

- [app-shell-frame.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/app-shell-frame.tsx)
- [index.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/i18n/index.ts)

### 2. Messenger Home Now Feels Intentional

- `/home` now acts as a messenger overview for `messenger_full`
- it foregrounds the current space, the next message-centric actions, recent
  chats, and secondary profile/space actions without feeling like a utility
  screen
- the KeepCozy TEST-home path remains intact for `keepcozy_ops`

Primary files:

- [home/page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/home/page.tsx)
- [globals.css](/Users/danya/IOS%20-%20Apps/CHAT/app/globals.css)
- [index.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/i18n/index.ts)

### 3. Messenger Activity Now Reads As Message Activity

- `/activity` now renders a message-centric unread/recent surface for
  `messenger_full`
- the route stays shared, but the product language and structure differ by
  profile

Primary files:

- [activity/page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/activity/page.tsx)
- [index.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/i18n/index.ts)

### 4. Fresh Messenger Spaces Now Have Better Empty States

- `/inbox` no longer treats a clean messenger space as a dead-end
- a brand-new messenger space now points toward:
  create DM, create group, and manage members when local space governance
  allows it
- the create sheet can open directly into DM or group mode from messenger
  first-action links
- no new broad admin surface was introduced; member management stays scoped to
  the current space

Primary files:

- [inbox/page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/inbox/page.tsx)
- [inbox/inbox-filterable-content.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/inbox/inbox-filterable-content.tsx)
- [inbox/new-chat-sheet.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/inbox/new-chat-sheet.tsx)
- [home/page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/home/page.tsx)
- [index.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/i18n/index.ts)

## Practical Verification

### Verify Messenger vs KeepCozy Shell Split

1. Open a known `messenger_full` space from
   [spaces/page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/spaces/page.tsx).
2. Confirm it lands in `/inbox` and the bottom nav is `Home / Chats / Activity`.
3. Switch to the KeepCozy `TEST` space.
4. Confirm it lands in `/home` and the bottom nav is
   `Home / Rooms / Issues / Tasks / History`.

### Verify The New Messenger Bottom Nav

1. Inside a messenger space, tap `Home` and confirm the route is `/home`.
2. Tap `Chats` and confirm the route is `/inbox`.
3. Tap `Activity` and confirm the route is `/activity`.
4. Confirm the active tab highlights correctly on each route.

### Verify A Fresh Messenger Space Feels Usable

1. Open a newly created messenger space with no chats yet.
2. Confirm `/home` shows a clean messenger overview rather than a KeepCozy
   home shell.
3. Open `/inbox` and confirm the empty state exposes clear first actions.
4. If the space already has visible members, confirm the first actions can open
   the create sheet directly into DM or group mode.
5. If the current user can manage members for that space, confirm `Manage
   members` appears and stays scoped to the current `space_id`.
6. If the current user cannot manage members, confirm no broad member-management
   action is exposed.

### What Remains Shared

- auth and session handling
- active-space query/context seam
- profile-aware shell resolution through
  [server.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/spaces/server.ts)
- the underlying messaging runtime and conversation routes

## Remaining Highest-Value Follow-Ups

- tighten messenger settings/profile entry points so they feel secondary but
  still easy to reach after the bottom-nav demotion
- reduce duplicated lightweight chat-summary logic across messenger home and
  activity surfaces
- add a more deliberate local invite or member-add flow for fresh messenger
  spaces instead of relying only on the current member-management handoff
- keep dogfooding pressure on the create-chat sheet so fresh-space first-run
  flows stay smooth on mobile

## Guardrails

- do not split the app into a second messenger-only route tree
- do not add deeper capability gating yet
- do not let KeepCozy operational framing keep defining messenger copy
- do not let messenger shell polish reopen the broader shared-foundation
  architecture
- do not add future-domain entry points just to make the messenger shell feel
  fuller

## Remaining Ambiguities

- whether messenger `Home` should stay a lightweight overview or later become a
  more distinct route surface with richer chat continuity
- whether messenger `Activity` should stay blended between unread-first and
  recent-first or lean harder into one mode
- how much local member-management affordance should stay visible in fresh
  messenger spaces once an invite flow exists
- whether messenger-profile settings should later split into lighter `Profile`
  and `Chats settings` entry points without widening into a broader admin shell
