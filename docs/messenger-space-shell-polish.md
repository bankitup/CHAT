# Messenger Space Shell Polish

This document defines the highest-value shell polish work for
`messenger_full` spaces in the shared CHAT + KeepCozy app.

It assumes the repo already has:

- profile-aware space resolution through
  [server.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/spaces/server.ts)
- a profile-aware shared shell in
  [app-shell-frame.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/app-shell-frame.tsx)
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

## Current Shell Reality

The repository already has the first messenger-profile shell split:

- `messenger_full` spaces land in `/inbox`
- `keepcozy_ops` spaces land in `/home`
- the shared bottom nav swaps between the two profiles in
  [app-shell-frame.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/app-shell-frame.tsx)
- the shared space selector in
  [spaces/page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/spaces/page.tsx)
  opens each space into its profile-default shell

The main remaining gap is not routing. It is shell identity.

`messenger_full` currently still feels like a shared fallback shell because:

- its bottom nav is `Chats / Spaces / Settings`, not the intended
  `Home / Chats / Activity` messenger loop
- `/activity` is still a KeepCozy operational history surface rather than a
  messenger activity hub
- `/settings` remains too prominent in the primary messenger shell
- active space context is still stronger on KeepCozy routes than on messenger
  routes
- a fresh messenger space opens correctly, but still lacks messenger-shaped
  empty-state guidance and shell continuity

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

## Priority Order

## P0

### 1. Bottom Navigation Should Be Messenger-Centered

Current gap:

- messenger spaces currently use `Chats / Spaces / Settings`
- that makes the shell feel like a utility wrapper around inbox instead of a
  full messenger product
- `Settings` is over-promoted for a primary mobile tab
- `Spaces` is important for switching context, but not as a daily primary tab

Required outcome:

- `messenger_full` bottom nav becomes `Home / Chats / Activity`
- `Spaces` and `Settings` remain reachable without dominating the primary
  mobile shell
- active-tab behavior stays profile-aware and space-aware

Primary file targets:

- [app-shell-frame.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/app-shell-frame.tsx)
- [layout.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/layout.tsx)
- [index.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/i18n/index.ts)

Implementation note:

- do not invent a second permanent nav system
- keep the shared shell frame, but make the messenger branch of it feel like a
  real messenger shell

### 2. Messenger Needs Its Own Shell Hierarchy For Home, Chats, And Activity

Current gap:

- the repo has `/inbox`, but no clear messenger `Home` shell
- `/activity` is currently a KeepCozy operational history route, not a
  messenger activity route
- messenger users can land in chat, but they do not get a chat-first overview
  page that frames the space

Required outcome:

- messenger spaces get a lightweight chat-first shell hierarchy:
  `Home -> Chats -> Activity`
- `Home` introduces the active messenger space and its next actions
- `Activity` becomes message-centric for messenger spaces rather than reusing
  KeepCozy operational framing
- KeepCozy activity language no longer leaks into messenger-profile routes

Primary file targets:

- [inbox/page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/inbox/page.tsx)
- [activity/page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/activity/page.tsx)
- [app-shell-frame.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/app-shell-frame.tsx)

Implementation note:

- this does not require a new architecture
- the first pass can be conditional profile-aware framing on existing routes

### 3. Active Space Visibility Is Too Weak On Messenger Surfaces

Current gap:

- active space context is visible on `/spaces`, but is much less explicit once
  the user is back in `/inbox`
- the messenger shell does not strongly remind the user which space they are
  chatting inside
- switching spaces works, but the shell does not make the current space feel
  like the main context anchor

Required outcome:

- messenger routes show the current active space clearly
- switching spaces remains one or two taps away
- the active space reads like the current workspace, not just a query param

Primary file targets:

- [app-shell-frame.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/app-shell-frame.tsx)
- [spaces/page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/spaces/page.tsx)
- [inbox/page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/inbox/page.tsx)
- [settings/page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/settings/page.tsx)

Implementation note:

- prefer one compact shared messenger context treatment over repeating a large
  context card on every page

### 4. Fresh Messenger Spaces Need Better Empty States

Current gap:

- a new messenger space can be created cleanly, but `/inbox` still reads like
  a general chat list rather than a fresh workspace start
- empty-space copy is stronger in KeepCozy than in messenger surfaces
- the first actions for a new messenger space are not obvious enough

Required outcome:

- a fresh messenger space explains the next useful steps clearly
- empty-state actions point toward starting chats and adding the right people
- the shell distinguishes between “no chats yet” and “wrong space or broken
  state”

Primary file targets:

- [inbox/page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/inbox/page.tsx)
- [spaces/page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/spaces/page.tsx)
- [index.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/i18n/index.ts)

Implementation note:

- keep this concise and product-shaped
- do not turn messenger spaces into a tutorial system

## P1

### 5. Settings Should Be Secondary In Messenger Spaces

Current gap:

- the current messenger bottom nav promotes `Settings` to a top-level tab
- `/settings` itself is still shaped like a broad shared account/settings hub
- messenger-specific settings continuity already exists in
  [inbox/settings/page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/inbox/settings/page.tsx),
  but the shell does not reflect that hierarchy

Required outcome:

- settings remain reachable, but no longer define the primary messenger shell
- profile and preferences feel like secondary account surfaces
- inbox-specific settings read as chat settings, not a shell destination

Primary file targets:

- [app-shell-frame.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/app-shell-frame.tsx)
- [settings/page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/settings/page.tsx)
- [inbox/settings/page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/inbox/settings/page.tsx)

### 6. Messenger And KeepCozy Shells Need Stronger Differentiation

Current gap:

- the routing split exists, but some shared copy and structure still feel
  KeepCozy-first
- `/activity` is the biggest leak today, because it is operational by design
- the messenger shell still feels like the shared app with a chat tab, not a
  profile-aware messenger posture

Required outcome:

- messenger spaces no longer inherit operational language by default
- KeepCozy spaces stay operations-first without weakening the messenger shell
- shared shell pieces remain shared, but the product emphasis is visibly
  different between profiles

Primary file targets:

- [app-shell-frame.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/app-shell-frame.tsx)
- [activity/page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/activity/page.tsx)
- [index.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/i18n/index.ts)

## P2

### 7. Mobile-First Messenger Action Placement Can Be Cleaner

Current gap:

- messenger actions are mostly correct, but the shell does not consistently
  foreground the next message-centric step on small screens
- the inbox surface carries a lot of logic, but its surrounding shell does not
  simplify the mental model enough for a fresh test space
- space switching and settings still compete visually with core chat actions

Required outcome:

- messenger spaces expose one obvious next step on each top-level route
- primary actions stay thumb-friendly
- secondary navigation stays secondary

Primary file targets:

- [inbox/page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/inbox/page.tsx)
- [spaces/page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/spaces/page.tsx)
- [app-shell-frame.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/app-shell-frame.tsx)
- [globals.css](/Users/danya/IOS%20-%20Apps/CHAT/app/globals.css)

## Recommended First Code Pass

The first implementation pass after this doc should stay narrow:

1. change messenger bottom-nav posture from `Chats / Spaces / Settings` to
   `Home / Chats / Activity`
2. add one compact active-space context treatment for messenger-profile routes
3. make `/activity` render a messenger-oriented shell posture for
   `messenger_full` spaces
4. tighten fresh-space empty states on `/inbox`
5. demote direct settings prominence without hiding settings entirely

## Guardrails

- do not split the app into a second messenger-only route tree
- do not add deeper capability gating yet
- do not let KeepCozy operational framing keep defining messenger copy
- do not let messenger shell polish reopen the broader shared-foundation
  architecture
- do not add future-domain entry points just to make the messenger shell feel
  fuller

## Remaining Ambiguities

- whether messenger `Home` should be a lightly reframed `/inbox` overview or a
  distinct route surface later
- whether messenger `Activity` should be a recent-chat view, unread-first
  digest, or a blend of both
- how much `/spaces` should remain visible from messenger routes once
  switching-space patterns are stronger elsewhere
- whether messenger-profile settings should eventually split into lightweight
  `Profile` and `Chats settings` entry points without growing a broader admin
  shell
