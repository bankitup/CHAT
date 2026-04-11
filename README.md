# BWC Platform Repository

This repository is the current shared BWC platform codebase.

Read it as:

- BWC platform foundation
- Messenger as one product
- KeepCozy as another product
- shared capabilities, including messaging, reused where justified

Important framing:

- KeepCozy is not a profile layered on Messenger
- Messenger is not the implicit center of the entire repo
- `spaces` is a shared platform boundary, not a product-specific shell trick

## Current Repo Shape

The repo currently contains one shared Next.js App Router PWA with:

- platform shell and auth/session infrastructure
- shared `spaces`, membership, governance, and posture resolution
- Messenger routes and messaging capability
- KeepCozy routes and home-operations domain logic

Key areas:

- `app/(app)` for the shared authenticated shell and both product surfaces
- `app/api/messaging` for messaging-related API routes
- `src/lib` for Supabase and request-context infrastructure
- `src/modules/spaces` for shared platform space foundations
- `src/modules/messaging` for the messaging capability
- `src/modules/keepcozy` for the KeepCozy product domain

## Source Of Truth Docs

Use these as the main architecture entry points:

- [docs/platform-architecture-current-state.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/platform-architecture-current-state.md)
- [docs/platform-architecture-target-shape.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/platform-architecture-target-shape.md)
- [docs/platform-foundation-vs-product-boundaries.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/platform-foundation-vs-product-boundaries.md)
- [docs/refactor-order-platform-first.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/refactor-order-platform-first.md)

Use these for architecture regression protection and verification:

- [docs/architecture-acceptance.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/architecture-acceptance.md)
- [docs/architecture-manual-verification.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/architecture-manual-verification.md)

Use these for current runtime hardening work:

- [docs/stability/chat-stability-baseline.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/stability/chat-stability-baseline.md)
- [docs/stability/chat-critical-paths.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/stability/chat-critical-paths.md)
- [docs/stability/manual-test-matrix.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/stability/manual-test-matrix.md)

## Working Interpretation

For current work in this repository:

- treat `spaces` as platform foundation
- treat `src/modules/messaging` as a shared capability with Messenger as the
  first-class product consumer
- treat `src/modules/keepcozy` as a separate product domain
- keep the shared-repo approach
- prefer stability, ownership clarity, and bounded reuse over feature sprawl

## Out Of Scope Right Now

- no repo split
- no billing or commercial implementation
- no messaging domain rewrite
- no E2EE rewrite
- no schema redesign just to fit cleaner wording
- no large UI rewrite

The immediate job is to keep the repo clean, platform-first, and stable while
future branches tighten boundaries incrementally.
