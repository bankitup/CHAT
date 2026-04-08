# Pre-Main Messenger Polish

This document defines the narrow, high-leverage polish work that should happen
before the shared CHAT + KeepCozy app is considered ready for a main-branch
messenger dogfood pass.

It builds on [messenger-space-shell-polish.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/messenger-space-shell-polish.md).

Scope for this pass:

- keep messenger spaces clearly chat-first
- remove the last obvious KeepCozy-first shell artifacts from messenger flows
- improve voice playback readiness and tap reliability
- make `Activity` feel like a useful in-app notifications and replies surface
- keep the work practical, reviewable, and pre-main sized

This is not a full product redesign and it is not a push-notifications project.

## Current Branch Reality

The messenger shell already has a real shape:

- messenger spaces use `Home / Chats / Activity` in
  [app-shell-frame.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/app-shell-frame.tsx)
- messenger `Home` exists in
  [home/page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/home/page.tsx)
- messenger `Activity` exists in
  [activity/page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/activity/page.tsx)
- voice playback and recovery are functional in
  [thread-history-viewport.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/chat/[conversationId]/thread-history-viewport.tsx)

The remaining issues are not about whether messenger shell exists. They are
about whether it feels intentional, stable, and clean enough for main.

## Desired Pre-Main Outcome

Before main, messenger spaces should feel like:

- a lightweight chat product, not a repurposed KeepCozy shell
- immediately understandable on mobile
- stable when opening chats and tapping voice messages
- clear about where notifications, unread replies, and recent activity belong
- secondary about space switching and session controls

Practical rule:

- `Home` should orient and move the user into chats quickly
- `Activity` should help the user catch up, not repeat `Home`
- shell transitions should never visually promise KeepCozy when the space is
  actually messenger-first

## Prioritized Issues

### P0. KeepCozy Shell Flash During Messenger Navigation

This is the highest-value visual trust issue before main.

Current cause:

- [loading.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/loading.tsx) is explicitly
  KeepCozy-shaped, including `keepcozy-loading-screen`,
  `keepcozy-loading-context`, `keepcozy-loading-hero`, and
  [homeDashboard](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/loading.tsx) copy
- messenger `Home` and `Activity` still reuse many `settings-*`, `activity-*`,
  and `keepcozy-*` layout classes from earlier shared shells

Why this matters:

- messenger navigation feels less trustworthy if route transitions briefly look
  like the wrong product
- this reads like shell instability even when routing is technically correct

Recommended narrow fix:

- replace the KeepCozy-specific app loading surface with a neutral shared shell
  skeleton or a messenger-aware skeleton when the requested `space` resolves to
  `messenger_full`
- trim the most visible KeepCozy-only class and copy leakage from messenger
  `Home` and `Activity` wrappers

Files to touch first:

- [loading.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/loading.tsx)
- [home/page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/home/page.tsx)
- [activity/page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/activity/page.tsx)
- [app-shell-frame.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/app-shell-frame.tsx)

### P0. Messenger Home Content Hierarchy Is Still Too Utility-Like

`Home` works, but it still feels like a generalized surface rather than the
best first screen for messenger spaces.

Current symptoms in
[home/page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/home/page.tsx):

- the hero gives equal visual weight to `Open chats`, `Activity`, and
  `Choose another space`
- the overview metrics are useful but feel more dashboard-like than
  messenger-like
- the final section is still `Profile and space`, which keeps utility actions
  visible at the same level as conversation continuity

Why this matters:

- `Home` should answer “what should I do next here?” quickly
- messenger `Home` should not read like a settings hub with chat links

Recommended narrow fix:

- keep one strong primary action into chats
- demote space-switching and profile actions into a quieter secondary footer
  region
- tighten the hero so the first visible story is current space plus recent or
  unread conversation continuity

Files to touch first:

- [home/page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/home/page.tsx)
- [globals.css](/Users/danya/IOS%20-%20Apps/CHAT/app/globals.css)
- [index.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/i18n/index.ts)

### P0. Activity Still Duplicates Home More Than It Catches The User Up

`Activity` is the main messenger tab that still lacks a truly separate reason
to exist.

Current symptoms in
[activity/page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/activity/page.tsx):

- it repeats the same hero pattern as `Home`
- it repeats the same summary-card grammar as `Home`
- it is split into `Unread` and `Recent`, but both still read like inbox
  variants rather than a notifications and replies surface
- `NotificationReadinessPanel` is embedded at the bottom, which dilutes the tab
  purpose even more

Why this matters:

- `Home` and `Activity` should not compete for the same mental role
- before main, `Activity` should become the lightweight “catch up on what needs
  attention” tab

Recommended narrow fix:

- make `Activity` unread-first and reply-first
- keep recent history secondary and more compact
- remove notification-readiness UI from the main messenger `Activity` body and
  keep that inside settings
- introduce compact grouped notification rows by conversation instead of trying
  to build a full event center

Files to touch first:

- [activity/page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/activity/page.tsx)
- [activity-conversation-live-item.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/activity/activity-conversation-live-item.tsx)
- [notification-readiness.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/settings/notification-readiness.tsx)

### P0. Voice Playback Readiness Still Has Double-Tap Friction

This is the highest-value runtime polish item before main.

Current cause in
[thread-history-viewport.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/chat/[conversationId]/thread-history-viewport.tsx):

- when a voice message is not yet `ready`, the first tap resolves a signed URL
  and returns
- the user then needs a second tap to actually start playback

Why this matters:

- it feels like playback failure or tap loss, especially on mobile
- it makes voice seem less reliable than plain text, even when recovery is
  possible

Recommended narrow fix:

- treat the first successful user tap as intent to play
- if a recoverable voice row needs signed URL hydration, continue automatically
  into playback once the URL is resolved instead of requiring another tap
- keep retry and recovery copy explicit when playback still cannot start

Files to touch first:

- [thread-history-viewport.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/chat/[conversationId]/thread-history-viewport.tsx)
- [optimistic-thread-messages.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/chat/[conversationId]/optimistic-thread-messages.tsx)

### P1. Admin-Only Space Switching And Logout Placement Is Too Prominent

Messenger shell currently exposes too much context-management chrome in everyday
surfaces.

Current symptoms:

- messenger `Home` still shows `Choose another space` in the hero and again in
  the profile/space section
- fresh-space empty states surface member-management or space-switch actions in
  a very primary position
- [settings/page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/settings/page.tsx)
  gives `Current space` and `Log out` strong standalone card treatment

Why this matters:

- normal messenger use should feel chat-first, not space-admin-first
- super-admin and space-admin utilities should stay available without becoming
  the visual center of the product

Recommended narrow fix:

- move space switching into a lighter profile/session area
- keep logout available, but visually quieter
- keep super-admin and space-admin actions reachable through `/spaces` and
  settings, not promoted in the main messenger task flow

Files to touch first:

- [home/page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/home/page.tsx)
- [settings/page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/settings/page.tsx)
- [spaces/page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/spaces/page.tsx)

### P1. Compact Grouped Notification UX Needs A Better First Pass

`Activity` should become more useful before it becomes more complex.

Current state:

- [activity-conversation-live-item.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/activity/activity-conversation-live-item.tsx)
  renders clean live rows, but each row still behaves like a conversation card
  rather than a compact notification unit
- there is no stronger distinction between “new replies that need me” and
  “recent chat movement”

Recommended narrow fix:

- keep grouping at the conversation level for now
- show more compact unread rows with tighter metadata
- bias toward reply and unread language, not general activity language
- avoid full event types, mention models, or push-driven notification
  complexity in this pass

This is a messenger-quality pass, not a notification platform build.

## Recommended Implementation Order

1. Remove the KeepCozy loading flash and neutralize messenger loading surfaces.
2. Tighten messenger `Home` so the primary action is chats, not utilities.
3. Reframe messenger `Activity` as unread and reply catch-up, and move
   notification readiness out of that tab.
4. Remove the voice-message second-tap requirement where recovery succeeds.
5. Demote space-switching and logout visuals in messenger flows.

## Guardrails

- do not redesign the whole app shell
- do not introduce push infrastructure in this pass
- do not widen into KeepCozy-specific feature work
- do not build a full notification center
- do not split messenger into a second app

## Definition Of Done For This Pre-Main Pass

The next implementation branch should make these things true:

- messenger route transitions no longer flash an obviously KeepCozy loading
  shell
- messenger `Home` feels like a clearer first screen than it does today
- messenger `Activity` has a stronger catch-up purpose than `Home`
- voice playback feels reliable on the first meaningful tap
- messenger everyday surfaces no longer over-emphasize space switching and
  logout utilities

When these are done, messenger spaces will feel much more intentional and much
safer to put in front of main-branch dogfood users.
