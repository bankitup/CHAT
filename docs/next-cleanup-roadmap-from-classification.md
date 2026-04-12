# Next Cleanup Roadmap From Classification

## Purpose

This document turns the current BWC doctrine, repo classification, and drift
report into a practical cleanup roadmap for the current codebase.

It is intentionally operational.
The goal is not to describe an ideal future platform.
The goal is to define the next cleanup train that improves correctness,
ownership, and performance without inflating BWC into a generic system.

## Planning Rules

- stabilize Messenger first where current runtime pain is real
- keep KeepCozy separate as a product, not as a Messenger mode
- strengthen platform foundation only where it is already active and genuinely
  shared
- prefer narrower ownership seams over broad rewrites
- avoid schema redesign or capability inflation in these waves
- keep future Lioka compatibility in mind, but do not force PWA assumptions
  into future iOS work

## Current Pain That Drives This Roadmap

The classification pass showed that the highest-leverage cleanup work is not
abstract platform theory.
It is concentrated around a few practical repo problems:

- Messenger conversation runtime is still the biggest correctness/stability risk
- product posture still leaks into shared `spaces` and shell code
- `/home` and `/activity` still carry mixed product ownership
- shared settings/profile behavior still drifts through Messenger ownership
- Messenger runtime and data monoliths still block clean ownership and safe
  performance work

## Roadmap Summary

| Wave | Priority class | Why now |
| --- | --- | --- |
| P0-A | P0 correctness/stability | Messenger runtime trust is still the repo’s highest operational risk. |
| P1-A | P1 ownership cleanup | Product posture still sits too high in `spaces` and shell seams. |
| P1-B | P1 ownership cleanup | Shared profile/settings still route through Messenger gravity. |
| P1-C | P1 ownership cleanup | Mixed routes still blur product boundaries and metrics. |
| P1-PERF-A | P1 performance cleanup | Shared shell still carries too much Messenger startup tax. |
| P1-PERF-B | P1 performance cleanup | Thread/inbox monoliths still make performance work fragile. |
| P2-A | P2 future platform strengthening | Foundation v1 needs clearer names and smaller, cleaner seams. |
| P2-B | P2 future platform strengthening | Capability reuse should be prepared carefully, not generalized early. |

## P0 Correctness/Stability

### Wave P0-A: Messenger Conversation Runtime Containment

Objective:

- reduce the remaining risk that one broken DM, one malformed row, or one heavy
  interaction path destabilizes the whole Messenger thread experience

Why now:

- recent production issues were still conversation-runtime issues, not platform
  theory issues
- a reusable messaging capability is not credible if Messenger remains fragile
  in its primary product path
- future ownership cleanup gets safer after the main runtime failure seams are
  trustworthy

Likely files/modules affected:

- `app/(app)/chat/[conversationId]/**`
- `app/(app)/inbox/actions.ts`
- `src/modules/messaging/data/server.ts`
- `src/modules/messaging/realtime/**`
- `src/modules/messaging/e2ee/ui-policy.ts`
- `tests/e2ee/**` covering thread rescue, DM lifecycle, voice/runtime isolation

Risks:

- broadening the work into a full thread rewrite
- mixing stability fixes with product redesign
- reintroducing thread-wide invalidation while fixing local runtime problems

What must not be touched:

- message schema
- voice asset/storage contract
- E2EE architecture posture beyond narrow runtime correctness
- route tree redesign

Acceptance criteria:

- broken or poisoned conversations fail in a contained way with clear recovery
- DM reopen/recreate behavior does not silently revive known-bad conversations
- voice interactions remain local to the active row/runtime
- current lightweight regression coverage stays green

## P1 Ownership Cleanup

### Wave P1-A: Product Posture Out Of Shared `spaces` Foundation

Objective:

- remove product identity decisions from shared `spaces` foundation and move
  them closer to product composition seams

Why now:

- this is the highest-ranked doctrine drift item
- `spaces` is the most important active shared boundary in the repo
- future product admission becomes harder if platform membership/access keeps
  carrying Messenger and KeepCozy posture directly

Likely files/modules affected:

- `src/modules/spaces/model.ts`
- `src/modules/spaces/posture.ts`
- `src/modules/spaces/shell.ts`
- `app/(app)/layout.tsx`
- `app/(app)/app-shell-frame.tsx`

Risks:

- destabilizing current shell routing or selected-space behavior
- accidentally turning posture cleanup into a full navigation redesign
- forcing an abstract product registry too early

What must not be touched:

- core `spaces` access/governance rules
- membership schema
- authenticated route shape
- KeepCozy and Messenger runtime behavior beyond ownership placement

Acceptance criteria:

- shared `spaces` code no longer hard-codes product posture more than is needed
  for compatibility
- shell/product posture decisions are easier to trace to product seams
- the resulting seam remains small and explainable

### Wave P1-B: Shared Profile/Settings And Cross-Product Support Seams

Objective:

- finish extracting shared profile/settings behavior and cross-product
  user-facing error/support helpers out of Messenger-owned namespaces

Why now:

- the repo already has a real shared identity/profile foundation
- current persistence and loader ownership still routes through Messenger in
  ways that teach the wrong mental model
- this cleanup unblocks future product work without pretending everything is
  platform

Likely files/modules affected:

- `app/(app)/settings/page.tsx`
- `src/modules/messaging/server/settings-page.ts`
- `src/modules/profile/server.ts`
- `src/modules/messaging/data/profiles-server.ts`
- `src/modules/messaging/ui/user-facing-errors.ts`

Risks:

- pulling Messenger-specific copy/behavior into shared code
- renaming too much at once and increasing merge risk
- changing runtime behavior while trying to fix ownership labels

What must not be touched:

- user-facing settings behavior unless needed for ownership extraction
- Messenger-specific inbox/thread logic
- auth/session semantics

Acceptance criteria:

- shared settings/profile loaders no longer read as Messenger-owned by default
- cross-product error sanitation/support helpers sit in a shared-appropriate
  namespace
- Messenger product code becomes a consumer, not the hidden owner, of shared
  identity behavior

### Wave P1-C: Mixed Route Decomposition For `/home` And `/activity`

Objective:

- split the most mixed routes into clearer product composition seams without
  forcing a route redesign

Why now:

- `/home` and `/activity` are still the clearest mixed-ownership surfaces
- mixed routes make metrics, debugging, and future product work harder
- this is one of the fastest ways to align doctrine with real route behavior

Likely files/modules affected:

- `app/(app)/home/page.tsx`
- `app/(app)/activity/page.tsx`
- adjacent helpers under `src/modules/keepcozy/**`
- Messenger-facing activity composition helpers

Risks:

- turning a decomposition pass into URL churn
- duplicating layout/shared logic
- confusing current route semantics during cleanup

What must not be touched:

- public route shape unless there is a very strong reason
- product feature set
- messaging or KeepCozy schema

Acceptance criteria:

- `/home` and `/activity` are easier to read as composed product surfaces
- product-specific branching is pushed down into product seams
- route metrics and ownership become easier to reason about

## P1 Performance Cleanup

### Wave P1-PERF-A: Shared Shell Startup Narrowing

Objective:

- keep the authenticated shell as a host, not a long-term Messenger runtime
  home

Why now:

- the shared shell still carries Messenger tax conceptually and at startup
- this directly affects mobile performance outside core Messenger surfaces
- it is easier to do safely once posture ownership is clearer

Likely files/modules affected:

- `app/(app)/app-shell-frame.tsx`
- `app/(app)/layout.tsx`
- `src/modules/messaging/e2ee/local-state-boundary.tsx`
- `src/modules/messaging/push/**`
- `src/modules/messaging/performance/warm-nav-client.tsx`

Risks:

- breaking Messenger startup behavior on inbox/thread routes
- pushing too much into deferred code without preserving correctness
- reintroducing broad shell coupling through new helpers

What must not be touched:

- shared authenticated layout contract
- non-Messenger route behavior
- product navigation semantics outside mount timing/gating

Acceptance criteria:

- non-Messenger routes no longer mount Messenger runtime by default
- Messenger routes preserve current behavior
- shell runtime ownership is easier to explain and test

### Wave P1-PERF-B: Messenger Runtime Monolith Reduction

Objective:

- keep shrinking the biggest Messenger runtime gravity points so product work
  becomes safer and first-paint work becomes easier to reason about

Why now:

- the drift report still shows large files blocking clean ownership
- thread and inbox performance work remains fragile while the main files stay
  overgrown
- smaller seams also reduce the chance of one interaction path destabilizing
  unrelated behavior

Likely files/modules affected:

- `src/modules/messaging/data/server.ts`
- `app/(app)/chat/[conversationId]/thread-history-viewport.tsx`
- `app/(app)/chat/[conversationId]/thread-message-row.tsx`
- `app/(app)/inbox/inbox-filterable-content.tsx`
- `src/modules/messaging/server/*.ts`

Risks:

- broad refactor spillover
- losing behavior parity while extracting seams
- mixing ownership cleanup and performance cleanup in one unsafe pass

What must not be touched:

- messaging schema
- delivery routes and core message model
- product UX semantics beyond code-loading and ownership placement

Acceptance criteria:

- the largest Messenger runtime files continue to shrink behind stable seams
- route loaders and runtime files depend on narrower modules
- first-paint and stability work stop depending on giant mixed files

## P2 Future Platform Strengthening

### Wave P2-A: Active Foundation V1 Hardening

Objective:

- make active platform foundation v1 easier to recognize and safer to reuse,
  without widening it prematurely

Why now:

- after ownership cleanup, the repo will have a clearer line between foundation,
  capability, and product
- this is the right moment to harden names and seams that are already truly
  shared

Likely files/modules affected:

- `src/modules/profile/**`
- `src/modules/spaces/**`
- `src/modules/i18n/**`
- small shared admin/recovery helpers
- selected docs under `docs/`

Risks:

- turning small foundation cleanup into generic platformization
- dragging Messenger or KeepCozy product logic upward again
- renaming before ownership is actually settled

What must not be touched:

- product-specific runtime
- messaging capability internals that are not actually foundation
- speculative company-ops software

Acceptance criteria:

- active foundation v1 is easier to identify in code and docs
- naming reflects true ownership more consistently
- no new broad “platform” layer is invented just for symmetry

### Wave P2-B: Capability Reuse Preparation Without Premature Generalization

Objective:

- prepare the repo for careful future reuse of capabilities, including future
  product work and Lioka-compatible backend principles, without forcing a giant
  shared abstraction now

Why now:

- once the current ownership cleanup is done, the repo can define a smaller,
  more credible reusable core
- this supports future products more than broad early generalization would

Likely files/modules affected:

- `src/modules/messaging/**`
- `app/api/messaging/**`
- selected shared contracts/docs
- product admission and doctrine docs as needed

Risks:

- over-building for hypothetical future products
- confusing capability contracts with product UI/runtime
- locking Lioka into current PWA delivery assumptions

What must not be touched:

- runtime delivery shape just to satisfy future theory
- company-ops domains that are still only planned
- KeepCozy product logic that does not truly need messaging composition

Acceptance criteria:

- Messenger remains a product, not the center of the whole repo
- messaging becomes easier to consume as a bounded capability
- future Lioka compatibility is expressed through contracts and infrastructure
  discipline, not forced UI/runtime sharing

## Recommended Working Order

The safest near-term sequence is:

1. P0-A conversation/runtime containment
2. P1-A product posture out of `spaces`
3. P1-B shared profile/settings and support seams
4. P1-C mixed route decomposition
5. P1-PERF-A shared shell startup narrowing
6. P1-PERF-B Messenger monolith reduction
7. P2-A active foundation v1 hardening
8. P2-B capability reuse preparation

## Explicit Non-Goals For This Roadmap

This roadmap does not assume:

- a repo split
- a schema redesign
- a large route tree rewrite
- a broad internal ops software program
- turning BWC into a generic platform before the current products are cleaner
- forcing KeepCozy or Lioka to inherit Messenger product decisions
