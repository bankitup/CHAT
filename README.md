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

<<<<<<< HEAD
The immediate job is to document and then gradually align the repo to the
platform-first shape without destabilizing the current products.

## Current Active Product Slices

The current active product slices on the platform are:

- Messenger as the private community messaging product
- KeepCozy as the home-operations product, currently centered on:
  - home
  - room
  - issue
  - task
  - update/history
  - resolution

Broader home-ops expansion, marketplace expansion, and richer chat-centric
expansion should not redefine the current product slices ahead of the platform
cleanup and stability work.

## Core Architecture Direction

The repository should preserve a clear separation between:

- platform foundation: shared auth, shell/runtime infrastructure, spaces,
  membership, governance, devices, storage, and common access boundaries
- Messenger product: inbox, chat, community messaging UX, and product-specific
  messaging flows
- KeepCozy product: home-operations flows, domain objects, and product-specific
  operational UX
- shared capabilities: reusable modules such as messaging that may be consumed
  by more than one product through bounded contracts

The current Next.js app is the live shared shell for the platform, but it
should not absorb responsibilities that belong to reusable platform or
capability modules.

Supabase is the backend truth. It owns:

- authentication state
- persisted data
- authorization boundaries
- storage and delivery policies
- long-term backend consistency across platform and product surfaces

## Main Stack

- Next.js App Router for the active shared web/PWA shell
- TypeScript for application and domain code
- Vercel for deployment
- Supabase for auth, database, storage, and realtime infrastructure
- ESLint for code quality

## Schema And Security References

Current schema/runtime assumptions are documented in:

- [docs/schema-assumptions.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/schema-assumptions.md)

Current security references are documented in:

- [docs/security/mvp-security-posture.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/security/mvp-security-posture.md)
- [docs/security/mvp-security-target.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/security/mvp-security-target.md)

## Working Principles

- strengthen platform foundations before feature breadth
- keep Messenger strong as a product without making it the center of the whole repo
- keep KeepCozy separate as a product without layering it on top of Messenger
- reuse shared capabilities only through clean contracts
- preserve the shared-repo model
- optimize for mobile-first product usage without collapsing platform boundaries
- prefer stability, clean ownership, and controlled execution over fast feature sprawl

## Guidance For Collaborators And AI Agents

Approach this repository as a real BWC platform codebase with multiple products
sharing one foundation.

- Treat the repo as platform-first, not chat-first.
- Keep platform logic, product logic, and shared capabilities clearly separated.
- Do not couple KeepCozy to Messenger shell/runtime decisions.
- Do not let Messenger route structure become the architecture for the whole repo.
- Prefer execution-focused documentation, boundary cleanup, and stability work
  over speculative expansion.
- When in doubt, choose the path that improves platform clarity and preserves
  clean reuse.
