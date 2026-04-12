# Architecture Drift PR Checklist

## Purpose

Use this checklist when a branch touches shared shell, shared foundation,
cross-product seams, or major mixed-ownership files.

This is not a long approval ritual.
It is a quick drift check so the repo does not quietly slide away from the BWC
platform model.

## When To Use It

Run this checklist when a branch touches any of these:

- `app/(app)/app-shell-frame.tsx`
- `app/(app)/layout.tsx`
- `app/(app)/home/**`
- `app/(app)/activity/**`
- `app/(app)/settings/**`
- `src/modules/spaces/**`
- `src/modules/profile/**`
- `src/modules/messaging/data/server.ts`
- `src/modules/messaging/ui/user-facing-errors.ts`

## Quick Questions

### 1. Did shared shell or platform code gain product logic

Check:

- Did `app-shell-frame.tsx` gain Messenger or KeepCozy workflow logic?
- Did `src/modules/spaces/**` gain product-specific posture, defaults, or
  route policy?
- Did a platform file start depending on product routes or product modules?

If yes, stop and re-check placement.

### 2. Did a product-specific flow start pretending to be platform

Check:

- Is the new code only needed by one product?
- Is the naming generic while the behavior clearly serves Messenger or
  KeepCozy?
- Would the abstraction break immediately if the product changed?

If yes, keep it in the product.

### 3. Did the branch reach for a broad monolith import even though a narrower seam exists

Check especially for:

- `@/modules/messaging/data/server`
- large mixed route files as “utility” sources

Prefer:

- `src/modules/messaging/data/thread-read-server.ts`
- `src/modules/messaging/data/conversation-read-server.ts`
- `src/modules/profile/server.ts`
- `src/modules/spaces/server.ts`

### 4. Did a mixed ownership file get larger without an explicit cleanup goal

High-risk files:

- `app/(app)/app-shell-frame.tsx`
- `app/(app)/home/page.tsx`
- `app/(app)/activity/page.tsx`
- `src/modules/spaces/model.ts`
- `src/modules/spaces/posture.ts`
- `src/modules/spaces/shell.ts`
- `src/modules/profile/server.ts`
- `src/modules/messaging/ui/user-facing-errors.ts`

If a branch grows one of these files, it should say why that growth is worth
it and why the work could not land behind a narrower seam.

### 5. Did the branch change ownership meaning without updating docs

Update the relevant source-of-truth docs if the answer is yes:

- `docs/bwc-platform-doctrine.md`
- `docs/layer-ownership-rules.md`
- `docs/repo-boundary-drift-report.md`
- `docs/module-boundary-index.md`
- `docs/module-entry-points.md`
- `docs/architecture-acceptance.md`

## Fast Pre-Merge Checks

Run at least:

1. `npm run test:e2ee`
2. `npm run lint`
3. `npm run typecheck`
4. `npm run build`

## Expected Good Outcome

A branch is in good shape when:

- platform files still read like platform files
- shared capability files still read like bounded capability files
- Messenger and KeepCozy still read like products, not platform modes
- mixed seams did not quietly become the default home for new logic
- narrow entry points were preferred over broad facades

## Common Smells

- “It was convenient to put it in `spaces`”
- “The shell already knew about Messenger, so I added one more thing”
- “I imported `data/server.ts` because it already exports everything”
- “This might be reusable later”

Those are usually drift signals, not reasons.
