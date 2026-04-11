# BWC Platform Repository

This repository is the current shared BWC platform codebase.

It is not a chat app with KeepCozy layered on top.
It is not a KeepCozy shell with messaging beside it.

The intended platform-first model is:

- BWC platform foundation
- Messenger as one product on that foundation
- KeepCozy as a separate product on that foundation
- shared capabilities, including messaging, reused where justified

Current product reading:

- Messenger is the private community messaging product.
- KeepCozy is the home-operations product.
- KeepCozy may later reuse parts of the messaging capability for contractor or
  vendor communication, but it is not a profile layered on Messenger.

## Source Of Truth Docs

Use these as the current architecture reference:

- [docs/platform-architecture-current-state.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/platform-architecture-current-state.md)
- [docs/platform-architecture-target-shape.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/platform-architecture-target-shape.md)
- [docs/platform-foundation-vs-product-boundaries.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/platform-foundation-vs-product-boundaries.md)
- [docs/refactor-order-platform-first.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/refactor-order-platform-first.md)

The existing stability planning docs remain relevant for runtime hardening work:

- [docs/stability/chat-stability-baseline.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/stability/chat-stability-baseline.md)
- [docs/stability/chat-critical-paths.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/stability/chat-critical-paths.md)
- [docs/stability/manual-test-matrix.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/stability/manual-test-matrix.md)

## Current Repo Shape

The repo currently contains all of these in one shared Next.js App Router PWA:

- platform shell and auth/session infrastructure
- shared `spaces` boundary and membership runtime
- Messenger UI routes and messaging capability
- KeepCozy UI routes and home-ops domain logic

Key directories:

- `app/(app)` for the shared authenticated shell and both product surfaces
- `app/api/messaging` for messaging-related API routes
- `src/lib` for Supabase and request-context infrastructure
- `src/modules/spaces` for the shared space boundary
- `src/modules/messaging` for the messaging capability
- `src/modules/keepcozy` for the KeepCozy domain

## Working Interpretation

For current work in this repo:

- treat `spaces` as a shared platform boundary
- treat `src/modules/messaging` as a shared capability with Messenger as the
  first-class product consumer
- treat `src/modules/keepcozy` as a separate product domain
- keep the shared-repo approach
- avoid feature expansion while architecture and stability boundaries are being
  clarified

## Non-Goals Right Now

- no repo split
- no billing or commercial implementation
- no messaging domain rewrite
- no E2EE rewrite
- no schema redesign just to fit a cleaner narrative
- no large UI rewrite

The immediate job is to document and then gradually align the repo to the
platform-first shape without destabilizing the current products.
