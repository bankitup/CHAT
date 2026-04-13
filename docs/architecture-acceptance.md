# Architecture Acceptance

## Purpose

This document defines the lean acceptance bar for the current platform-first
refactor of the BWC repository.

It exists to keep three things true at the same time:

- `spaces` stays the shared platform foundation
- Messenger remains a distinct product surface
- KeepCozy consumes shared capabilities only through bounded platform or
  capability seams

This is not a product-feature test plan. It is an architecture-integrity
acceptance guide.

## Current Acceptance Targets

The current acceptance bar focuses on these boundaries:

1. Platform governance and membership remain product-independent
2. Messenger shell posture remains chat-first where expected
3. KeepCozy shell posture remains operations-first where expected
4. KeepCozy does not depend directly on Messenger route files or shell wiring
5. Messenger route entry continues to consume shared messaging capability seams
   instead of open-coding space access in route files
6. Shared profile and identity entry points stay under platform ownership by
   default
7. Messenger thread runtime stays split across slimmer page, viewport, and
   voice-runtime seams
8. Messaging server seams stay independent from app-route and KeepCozy product
   code
9. Voice playback source selection stays honest about original-vs-derived
   sources and unsupported-device behavior
10. Messenger mobile startup boundaries stay in place across route-local
    Messenger surfaces while the shared shell stays free of direct Messenger
    runtime mounts
11. Voice playback lifecycle ownership stays isolated in the extracted
    controller seam
12. CLS-sensitive shell, chat, and inbox layout reservations stay in place
13. `src/modules/messaging/data/server.ts` stays in compatibility-facade
    territory instead of regrowing as the main read hub
14. A broken conversation body stays contained behind a local rescue boundary
    instead of trapping the user inside a dead chat route
15. Poisoned direct-conversation cleanup stays able to retire a bad DM fully
    enough that recreate flows do not reopen the same broken conversation
16. Conversation-runtime failure modes stay locally contained instead of
    invalidating the whole thread or collapsing the mobile viewer layout
17. Unavailable encrypted-history states stay truthful and local instead of
    degrading into misleading recovery UI
18. Shared shell and `spaces` foundation seams stay free of product-route
    reach-through and broad product-module ownership drift
19. High-risk mixed-ownership files stay small enough that regrowth is visible
    early instead of silently becoming the default place for new logic
20. Future branches have a lightweight architecture-drift checklist before they
    widen shared seams or monolith imports
21. Route-scoped Messenger i18n and CSS boundaries stay in place so heavy
    client routes do not drift back to broad shared dictionaries or global
    Messenger style tax
22. Messenger realtime ownership stays route-scoped, catch-up stays
    authoritative, and presence/typing stay auxiliary to message truth
23. Core Messenger mobile row/card layouts stay structurally intact across
    inbox, chat, composer, settings, and bottom-nav shell fit checks

## Shared Platform Seams Under Acceptance

These files are the main architecture acceptance seams for the current repo:

- [src/modules/spaces/model.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/spaces/model.ts)
- [src/modules/spaces/access.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/spaces/access.ts)
- [src/modules/spaces/governance.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/spaces/governance.ts)
- [src/modules/spaces/server.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/spaces/server.ts)
- [src/modules/spaces/shell.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/spaces/shell.ts)
- [src/modules/messaging/server/route-context.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/server/route-context.ts)
- [src/modules/keepcozy/messaging-adapter.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/keepcozy/messaging-adapter.ts)

## Automated Coverage

The repository already uses small `node:test` files for focused behavior and
boundary checks. The current architecture acceptance coverage stays inside that
pattern.

Current acceptance tests:

- [tests/e2ee/platform-space-access-contract.test.ts](/Users/danya/IOS%20-%20Apps/CHAT/tests/e2ee/platform-space-access-contract.test.ts)
  verifies the shared platform access contract:
  - platform membership remains the outer source of truth
  - governance resolution stays product-independent
  - Messenger and KeepCozy product branches are derived from one shared rule
- [tests/e2ee/product-shell-posture-boundaries.test.ts](/Users/danya/IOS%20-%20Apps/CHAT/tests/e2ee/product-shell-posture-boundaries.test.ts)
  verifies shell posture:
  - Messenger spaces keep the chat-first nav contract
  - KeepCozy spaces keep the operations-first nav contract
- [tests/e2ee/keepcozy-messaging-boundaries.test.ts](/Users/danya/IOS%20-%20Apps/CHAT/tests/e2ee/keepcozy-messaging-boundaries.test.ts)
  verifies static product boundaries:
  - KeepCozy messaging adapter does not import Messenger route files
  - KeepCozy activity route consumes the bounded adapter instead of raw
    Messenger data wiring
  - Messenger inbox route consumes the shared messaging route-context seam
- [tests/e2ee/messaging-server-boundaries.test.ts](/Users/danya/IOS%20-%20Apps/CHAT/tests/e2ee/messaging-server-boundaries.test.ts)
  verifies messaging capability/server ownership:
  - messaging server seams do not reach into app route files
  - messaging server seams do not depend on KeepCozy product code
  - canonical route-context helpers remain the access-resolution seam
- [tests/e2ee/messenger-route-seams.test.ts](/Users/danya/IOS%20-%20Apps/CHAT/tests/e2ee/messenger-route-seams.test.ts)
  verifies Messenger route posture:
  - route pages stay loader-driven instead of importing heavy messaging data
    helpers directly
  - the chat entry route stays composition-light after the thread split
- [tests/e2ee/profile-boundaries.test.ts](/Users/danya/IOS%20-%20Apps/CHAT/tests/e2ee/profile-boundaries.test.ts)
  verifies shared identity/profile ownership:
  - shared entry surfaces use the platform profile seam
  - shared identity/avatar consumers do not fall back into messaging by
    default
- [tests/e2ee/thread-runtime-boundaries.test.ts](/Users/danya/IOS%20-%20Apps/CHAT/tests/e2ee/thread-runtime-boundaries.test.ts)
  verifies the thread runtime split:
  - `page.tsx` stays slim
  - thread composition remains in `thread-page-content.tsx`
  - voice runtime remains extracted from the viewport
  - first-pass file-size boundaries stay within the agreed range
- [tests/e2ee/voice-playback-foundation.test.ts](/Users/danya/IOS%20-%20Apps/CHAT/tests/e2ee/voice-playback-foundation.test.ts)
  verifies the current voice playback foundation:
  - original-only source behavior remains stable
  - derived playback candidates stay additive
  - device playability classification stays truthful
  - unsupported-device handling stays distinct from generic loading
- [tests/e2ee/mobile-messenger-performance-boundaries.test.ts](/Users/danya/IOS%20-%20Apps/CHAT/tests/e2ee/mobile-messenger-performance-boundaries.test.ts)
  verifies the current mobile Messenger startup boundaries:
  - Messenger-only shell effects stay route/posture-gated
  - chat-only secondary interactions remain dynamically loaded
  - inbox create and realtime startup paths remain deferred
- [tests/e2ee/voice-playback-controller.test.ts](/Users/danya/IOS%20-%20Apps/CHAT/tests/e2ee/voice-playback-controller.test.ts)
  verifies the current voice playback lifecycle seam:
  - the extracted controller remains the ownership home for one-at-a-time
    playback state
  - the bubble keeps consuming that controller instead of reintroducing inline
    ownership globals
- [tests/e2ee/layout-stability-boundaries.test.ts](/Users/danya/IOS%20-%20Apps/CHAT/tests/e2ee/layout-stability-boundaries.test.ts)
  verifies the current CLS-sensitive layout reservations:
  - shared shell nav space stays reserved
  - chat composer and voice loading shells keep stable footprints
  - inbox rows keep preview-line reservation during live settlement
- [tests/e2ee/messenger-mobile-layout-boundaries.test.ts](/Users/danya/IOS%20-%20Apps/CHAT/tests/e2ee/messenger-mobile-layout-boundaries.test.ts)
  verifies the current Messenger mobile layout structure:
  - inbox rows keep avatar/content/title-meta/preview composition instead of
    falling into broken stacking
  - the chat route keeps header, message thread, composer, and attached
    per-message metadata inside one coherent mobile shell
  - composer controls stay attached to one shell and keep native file inputs
    hidden behind the intended UI
  - settings keeps its stacked shell and editable top-row alignment seams
  - Messenger bottom-nav keeps a bounded shell with non-wrapping labels on
    narrow widths
- [tests/e2ee/messaging-data-facade-boundaries.test.ts](/Users/danya/IOS%20-%20Apps/CHAT/tests/e2ee/messaging-data-facade-boundaries.test.ts)
  verifies the current messaging data split:
  - `server.ts` stays under the current reduced size cap
  - the facade continues re-exporting narrowed read seams
  - product/server loaders keep preferring `conversation-read-server.ts` and
    `thread-read-server.ts` for reads
- [tests/e2ee/chat-thread-rescue-boundaries.test.ts](/Users/danya/IOS%20-%20Apps/CHAT/tests/e2ee/chat-thread-rescue-boundaries.test.ts)
  verifies the current broken-conversation containment seam:
  - thread history stays wrapped in a contained rescue boundary
  - the rescue state keeps retry, back-to-chats, and info escape paths local
    to the conversation body
- [tests/e2ee/ui-boundaries.test.ts](/Users/danya/IOS%20-%20Apps/CHAT/tests/e2ee/ui-boundaries.test.ts)
  verifies current encrypted-DM truthfulness boundaries:
  - unavailable encrypted history stays explicitly unavailable or
    policy-blocked instead of drifting into generic recovery UI
  - send-side encrypted composer failures still map to user-safe messaging
- [tests/e2ee/poisoned-dm-cleanup-boundaries.test.ts](/Users/danya/IOS%20-%20Apps/CHAT/tests/e2ee/poisoned-dm-cleanup-boundaries.test.ts)
  verifies the current poisoned-DM operational cleanup seam:
  - direct-chat delete runs through the full delete helper instead of hide-only
    inbox removal
  - message/media metadata cleanup stays attached to the full delete path
  - DM recreation still reuses only an actually existing active conversation
- [tests/e2ee/conversation-runtime-failure-boundaries.test.ts](/Users/danya/IOS%20-%20Apps/CHAT/tests/e2ee/conversation-runtime-failure-boundaries.test.ts)
  verifies the recent production-sensitive conversation-runtime boundaries:
  - broken history isolation leaves header/composer usable outside the rescue
    seam
  - voice playback runtime stays isolated from thread-wide sync and unrelated
    attachment invalidation seams
  - voice playback keeps scroll-stability-sensitive work out of the local
    playback runtime seam
  - mobile image preview keeps a full-viewport sizing contract
- [tests/e2ee/architecture-drift-guards.test.ts](/Users/danya/IOS%20-%20Apps/CHAT/tests/e2ee/architecture-drift-guards.test.ts)
  verifies lightweight BWC doctrine guardrails:
  - shared shell and `spaces` seams do not start importing product routes or
    product domain modules directly
  - shared and mixed seams do not fall back to the broad messaging data facade
    when narrower entry points already exist
  - mixed routes stay composed through bounded module seams instead of route
    reach-through
  - key mixed-ownership files stay within lean size caps so drift is visible
    early
- [tests/e2ee/global-weight-boundaries.test.ts](/Users/danya/IOS%20-%20Apps/CHAT/tests/e2ee/global-weight-boundaries.test.ts)
  verifies the current global-weight boundaries:
  - heavy Messenger client surfaces stay on route-scoped i18n seams instead of
    broad shared dictionaries
  - Messenger route styling stays mounted through route-local CSS instead of
    regrowing inside `app/globals.css`
  - current hot files stay under lightweight size caps so performance and
    ownership cleanup does not silently erode
- [tests/e2ee/realtime-recovery-boundaries.test.ts](/Users/danya/IOS%20-%20Apps/CHAT/tests/e2ee/realtime-recovery-boundaries.test.ts)
  verifies the current realtime recovery contract:
  - Messenger realtime mounts stay route-scoped instead of drifting back into
    the shared shell
  - thread and inbox keep explicit background/reconnect catch-up paths
  - thread live state and inbox summary state stay separated
  - presence and typing stay auxiliary instead of influencing message truth or
    authoritative recovery

Run them with:

```bash
npm run test:e2ee
```

## What This Acceptance Layer Intentionally Does Not Cover

This layer does not try to prove:

- all runtime permissions for every route
- full browser UX polish
- flaky click-through E2E across the whole shell
- every future KeepCozy operational-thread rule
- cross-product commercial logic

Those belong to later stability, integration, or product-specific acceptance
work.

## Failure Meanings

If one of these architecture tests fails, treat it as a boundary regression,
not as a low-priority test nuisance.

Examples:

- if the access-contract test fails, platform membership/governance likely
  drifted into product-specific assumptions
- if the shell-posture test fails, Messenger and KeepCozy may be collapsing
  back into one mixed shell posture
- if the KeepCozy boundary test fails, a product route may have started
  depending on Messenger route internals again
- if a messaging-server boundary test fails, capability seams may be reaching
  back into product routes or product-specific code
- if a profile-boundary test fails, shared identity/profile work may be
  sliding back under messaging ownership
- if a thread-runtime boundary test fails, the Messenger thread route may be
  collapsing back into one oversized runtime file
- if a mobile-performance boundary test fails, non-critical Messenger startup
  work may be drifting back into first paint on shared, inbox, or chat routes
- if a Messenger mobile layout boundary test fails, a cleanup pass may have
  broken row/card composition or shell structure without changing data flow
- if a global-weight boundary test fails, heavy routes may be regressing back
  toward broad shared i18n or global Messenger CSS tax
- if a realtime-recovery boundary test fails, Messenger live ownership may be
  drifting back into the shared shell, reconnect healing may be weakening, or
  auxiliary presence/typing state may be leaking back into core message truth
- if a conversation-runtime failure boundary test fails, a single bad
  conversation row, voice interaction, or mobile attachment preview may be
  widening back into a thread-wide failure
- if a poisoned-DM cleanup boundary test fails, a broken direct chat may remain
  revivable even after the user tries to retire and recreate it

## Minimum Verification After Architecture Changes

After changing platform/product boundaries, run at least:

1. `npm run test:e2ee`
2. `npm run lint`
3. `npm run typecheck`
4. `npm run build`

Then use the manual checklist in
[architecture-manual-verification.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/architecture-manual-verification.md)
for human sanity checks, and the PR drift checklist in
[architecture-drift-pr-checklist.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/architecture-drift-pr-checklist.md)
when a branch touches shared or mixed-ownership seams.

## Non-Goals

During this acceptance phase, do not:

- merge Messenger and KeepCozy shell rules back into raw profile checks spread
  across route files
- let KeepCozy consume Messenger pages or page-local runtime helpers directly
- move product-specific policy into generic `spaces` modules without a shared
  platform reason
- widen the acceptance suite into a brittle UI-heavy browser harness unless the
  repo later develops a stable pattern for that
