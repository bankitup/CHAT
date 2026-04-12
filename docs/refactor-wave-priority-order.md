# Refactor Wave Priority Order

## Purpose

This document converts the current doctrine and classification work into a
branch-ready refactor order.

Use it when choosing the next cleanup branch.
If a proposed branch does not fit this order, the burden is on that branch to
show why it should jump the queue.

## Ordering Rules

- correctness and containment come before doctrine polish
- ownership cleanup comes before broad platform strengthening
- performance cleanup should follow clearer ownership, not replace it
- future-product preparation must stay smaller than current-product pain

## Priority Order

### 1. P0-A: Messenger Runtime Correctness And Containment

Objective:

- finish the highest-value runtime containment work around broken threads,
  poisoned DMs, local voice behavior, and narrow conversation recovery

Why now:

- this is still the most direct trust and support burden problem in the repo

Likely files/modules affected:

- `app/(app)/chat/[conversationId]/**`
- `app/(app)/inbox/actions.ts`
- `src/modules/messaging/data/server.ts`
- `src/modules/messaging/realtime/**`

Risks:

- accidental broad thread rewrite

What must not be touched:

- schema
- product redesign
- storage contract redesign

Acceptance criteria:

- failure stays local and recoverable
- DM reopen behavior is operationally safe
- voice/runtime state remains isolated

### 2. P1-A: Product Posture Extraction From `spaces`

Objective:

- stop using shared `spaces` foundation as the main carrier of product identity

Why now:

- it is the highest-ranked doctrine drift and affects shell behavior, route
  posture, and future product admission

Likely files/modules affected:

- `src/modules/spaces/model.ts`
- `src/modules/spaces/posture.ts`
- `src/modules/spaces/shell.ts`
- `app/(app)/layout.tsx`

Risks:

- destabilizing shared shell/runtime posture

What must not be touched:

- `spaces` access and governance model
- membership semantics

Acceptance criteria:

- product posture no longer sits one layer too high
- shared `spaces` reads more like shared foundation than product dispatch

### 3. P1-B: Shared Profile/Settings Ownership Cleanup

Objective:

- move shared profile/settings and related support/error seams out of Messenger
  gravity

Why now:

- shared identity/profile is already real, but current ownership is still
  misleading

Likely files/modules affected:

- `app/(app)/settings/page.tsx`
- `src/modules/profile/server.ts`
- `src/modules/messaging/data/profiles-server.ts`
- `src/modules/messaging/server/settings-page.ts`
- `src/modules/messaging/ui/user-facing-errors.ts`

Risks:

- mixing rename work with behavioral changes

What must not be touched:

- auth/session behavior
- Messenger inbox/thread product logic

Acceptance criteria:

- shared profile/settings becomes a genuine shared seam
- cross-product support/error helpers no longer teach Messenger ownership by
  default

### 4. P1-C: Mixed Route Decomposition

Objective:

- make `/home` and `/activity` easier to read as composed product surfaces

Why now:

- mixed routes still block clean metrics, ownership, and future refactors

Likely files/modules affected:

- `app/(app)/home/page.tsx`
- `app/(app)/activity/page.tsx`
- nearby KeepCozy and Messenger page composition helpers

Risks:

- turning cleanup into route churn

What must not be touched:

- external route shape unless clearly justified
- product feature behavior

Acceptance criteria:

- mixed product branching is pushed downward into clearer seams
- route ownership becomes easier to explain

### 5. P1-PERF-A: Shared Shell Startup Narrowing

Objective:

- remove Messenger-specific runtime ownership from the shared shell wherever it
  does not need to mount by default

Why now:

- mobile startup cost still matters and the shell still sits too high

Likely files/modules affected:

- `app/(app)/app-shell-frame.tsx`
- `src/modules/messaging/push/**`
- `src/modules/messaging/e2ee/local-state-boundary.tsx`
- `src/modules/messaging/performance/warm-nav-client.tsx`

Risks:

- breaking Messenger behavior on thread/inbox routes

What must not be touched:

- shared authenticated layout contract

Acceptance criteria:

- non-Messenger routes stop paying Messenger startup tax by default
- Messenger routes remain correct

### 6. P1-PERF-B: Messenger Monolith Reduction

Objective:

- keep shrinking the biggest runtime and loader gravity points so performance
  and stability work are safer

Why now:

- current monoliths still block clean ownership and route slimming

Likely files/modules affected:

- `src/modules/messaging/data/server.ts`
- `app/(app)/chat/[conversationId]/thread-history-viewport.tsx`
- `app/(app)/chat/[conversationId]/thread-message-row.tsx`
- `app/(app)/inbox/inbox-filterable-content.tsx`
- `src/modules/messaging/server/*.ts`

Risks:

- extracting too much at once

What must not be touched:

- messaging schema
- product semantics

Acceptance criteria:

- the largest files shrink behind narrower seams
- product/runtime work depends on smaller modules

### 7. P2-A: Active Foundation V1 Hardening

Objective:

- clean up the names and boundaries of what is already truly active BWC
  foundation

Why now:

- this becomes safer after the ownership-heavy cleanup lands

Likely files/modules affected:

- `src/modules/spaces/**`
- `src/modules/profile/**`
- `src/modules/i18n/**`
- small shared admin/recovery helpers

Risks:

- over-generalizing platform

What must not be touched:

- Messenger capability internals that are not actually foundation
- speculative ops domains

Acceptance criteria:

- active foundation v1 becomes easier to identify in both code and docs

### 8. P2-B: Reuse Preparation For Future Products

Objective:

- define the smallest credible capability seams that future products can reuse
  without pulling in Messenger product posture

Why now:

- this should only happen after current ownership is cleaner

Likely files/modules affected:

- `src/modules/messaging/**`
- `app/api/messaging/**`
- selected doctrine/admission docs

Risks:

- designing for hypothetical products

What must not be touched:

- current product delivery shapes just to satisfy theory

Acceptance criteria:

- Messenger remains a product
- messaging becomes easier to consume as a bounded capability
- future Lioka compatibility is handled through disciplined contracts, not
  forced runtime sharing

## Parallelism Guidance

Safe partial overlap is likely only after the early ownership work lands:

- P1-PERF-A can overlap with late P1-B or P1-C if file ownership is separated
- P1-PERF-B should usually follow P1-A through P1-C, because monolith reduction
  is easier after ownership is clearer
- P2 work should wait until the earlier waves have actually changed the repo

## What Should Wait

Do not jump ahead to these before the earlier waves land:

- repo/package split
- schema redesign for cleaner product separation
- company-ops software expansion
- broad AI-agent platform work
- Lioka-specific runtime structure
