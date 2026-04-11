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

## Minimum Verification After Architecture Changes

After changing platform/product boundaries, run at least:

1. `npm run test:e2ee`
2. `npm run lint`
3. `npm run typecheck`
4. `npm run build`

Then use the manual checklist in
[architecture-manual-verification.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/architecture-manual-verification.md)
for human sanity checks.

## Non-Goals

During this acceptance phase, do not:

- merge Messenger and KeepCozy shell rules back into raw profile checks spread
  across route files
- let KeepCozy consume Messenger pages or page-local runtime helpers directly
- move product-specific policy into generic `spaces` modules without a shared
  platform reason
- widen the acceptance suite into a brittle UI-heavy browser harness unless the
  repo later develops a stable pattern for that
