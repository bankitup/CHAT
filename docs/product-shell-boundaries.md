# Product Shell Boundaries

## Purpose

This document defines how the shared authenticated shell should host Messenger
and KeepCozy as separate product surfaces inside one BWC platform repo.

It is intentionally narrow:

- no new routes
- no visual redesign
- no product split into separate apps

The goal is to make product posture explicit so the shell is easier to evolve
without hiding Messenger-first or KeepCozy-first behavior inside scattered page
checks.

## Shared Shell Ownership

The shared shell owns:

- active-space selection
- product-posture resolution from the active space
- route-surface resolution for the current pathname
- shared bottom-nav posture
- shared space-scoped route generation

Current platform files:

- [layout.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/layout.tsx)
- [app-shell-frame.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/app-shell-frame.tsx)
- [shell.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/spaces/shell.ts)
- [server.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/spaces/server.ts)
- [url.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/spaces/url.ts)

Important rule:

- the shared shell decides product posture
- product pages decide product composition

## Product Posture Contract

The current shell contract resolves one explicit product posture for each
space:

- `messenger`
- `keepcozy`

Current source of truth:

- [shell.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/spaces/shell.ts)
  `resolveSpaceProductPosture(...)`

Current mapping:

- `messenger_full` -> `messenger`
- `keepcozy_ops` -> `keepcozy`

This keeps the platform layer responsible for posture resolution while letting
product routes stay focused on rendering their own surface.

## Route Surface Contract

The shared shell also resolves the current route surface:

- `platform`
- `messenger`
- `keepcozy`

Current source of truth:

- [shell.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/spaces/shell.ts)
  `resolveAppShellState(...)`

Current route posture:

- Messenger routes:
  - `/inbox`
  - `/chat/[conversationId]`
- KeepCozy routes:
  - `/rooms`
  - `/issues`
  - `/tasks`
- Hybrid posture routes:
  - `/home`
  - `/activity`
  - `/settings`

For hybrid routes, the platform layer resolves the active space first, then
the route composes the correct product surface from the resolved posture.

## Current Product Ownership

Messenger product pages own:

- [page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/inbox/page.tsx)
- [page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/chat/[conversationId]/page.tsx)
- Messenger branch inside [page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/activity/page.tsx)

KeepCozy product pages own:

- KeepCozy branch inside [page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/home/page.tsx)
- KeepCozy branch inside [page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/activity/page.tsx)
- [page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/rooms/page.tsx)
- [page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/issues/page.tsx)
- [page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/tasks/page.tsx)

Shared account/settings posture currently lives in:

- [page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/settings/page.tsx)

Current behavior is intentionally preserved:

- Messenger spaces redirect settings traffic back toward the Messenger home
  posture instead of exposing a KeepCozy-style home/settings shell
- KeepCozy spaces keep the shared settings hub reachable from the KeepCozy
  shell posture

## Bottom Navigation Contract

Bottom navigation remains shared infrastructure, but it is no longer treated
as one mixed product nav with ad hoc branching.

Current source of truth:

- [shell.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/spaces/shell.ts)

Current behavior:

- Messenger posture gets Messenger nav items:
  - home
  - chats
  - activity
- KeepCozy posture gets KeepCozy nav items:
  - home
  - rooms
  - issues
  - tasks
  - activity

The shared shell frame renders whichever nav model the platform resolver
returns. Product pages do not define bottom-nav structure locally.

## What This Refactor Does Not Do

It does not:

- create separate route trees for Messenger and KeepCozy
- split the repo
- split the PWA shell
- change active-space semantics
- change the current `space` query seam
- redesign the product visuals

## Follow-on Guidance

Future branches should keep using this split:

1. platform resolves active space and product posture
2. platform resolves shared shell/nav posture
3. product routes render their own surface for that posture

If a page needs a new posture branch, add it to the shared shell resolver
instead of reintroducing raw `messenger_full` / `keepcozy_ops` checks across
many pages.
