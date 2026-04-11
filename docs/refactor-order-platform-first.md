# Refactor Order Platform First

## Purpose

This document defines the safest follow-up branch order after the
documentation-first architecture pass.

The goal is to move the repo toward a platform-first shape without destabilizing
current runtime behavior.

## Order

### 1. `platform/01-docs-and-top-level-framing`

Goal:

- make the repo’s top-level documentation consistently platform-first

Scope:

- `README.md`
- new platform architecture docs
- add “historical framing” notes to older architecture docs only where needed

Do not:

- move code
- rename modules
- change routes

### 2. `platform/02-boundary-labeling-without-runtime-rewrite`

Goal:

- clarify ownership in the codebase using the smallest safe naming/documentation
  cleanup only

Primary targets:

- comments and docblocks in `src/modules/spaces/server.ts`
- comments/docblocks in `app/(app)/app-shell-frame.tsx`
- comments/docblocks in `app/(app)/home/page.tsx`

Why second:

- these files currently encode mixed product posture and are the biggest source
  of architectural ambiguity

### 3. `platform/03-shared-foundation-extraction-by-name`

Goal:

- move only obviously generic helpers out of messaging-specific names when they
  are already used by both products

Best candidates:

- `src/modules/messaging/ui/user-facing-errors.ts`

Why here:

- this is a naming/boundary cleanup with low product risk
- it improves future ownership without touching the domain model

Do not:

- split `src/modules/messaging`
- move E2EE, realtime, or message data code yet

### 4. `platform/04-messenger-product-boundary-clarity`

Goal:

- document and lightly tighten the Messenger product surface as a product,
  separate from KeepCozy

Primary files:

- `app/(app)/inbox/**`
- `app/(app)/chat/[conversationId]/**`
- `app/(app)/activity/page.tsx`
- Messenger-oriented docs under `docs/`

Focus:

- product ownership and docs
- not a UI redesign
- not a capability rewrite

### 5. `platform/05-keepcozy-product-boundary-clarity`

Goal:

- document and lightly tighten KeepCozy product ownership without changing the
  current shared-repo approach

Primary files:

- `app/(app)/home/page.tsx`
- `app/(app)/rooms/**`
- `app/(app)/issues/**`
- `app/(app)/tasks/**`
- `src/modules/keepcozy/**`

Focus:

- explicit KeepCozy product ownership
- reduce the narrative that KeepCozy is merely a profile on top of Messenger

### 6. `platform/06-product-posture-out-of-spaces-foundation`

Goal:

- reduce product-specific posture encoded directly inside platform `spaces`
  runtime

Primary files:

- `src/modules/spaces/server.ts`
- `src/modules/spaces/model.ts`
- `app/(app)/home/page.tsx`
- `app/(app)/app-shell-frame.tsx`

Focus:

- clarify which parts are runtime compatibility defaults
- move product posture decisions closer to product surfaces over time

This should be done carefully because `spaces` is an important current shared
boundary and should not be destabilized.

### 7. `platform/07-cross-product-messaging-composition`

Goal:

- only after the earlier branches land, define where KeepCozy should compose
  the messaging capability for contractor/vendor communication

Primary areas:

- KeepCozy docs
- Messenger/shared messaging capability docs
- selected KeepCozy product flows that actually justify messaging reuse

Do not do earlier:

- do not pre-build marketplace or vendor features
- do not widen the messaging domain model without a concrete product need

## What To Preserve While Refactoring

- one shared repository
- one shared App Router shell
- `spaces` as a shared platform boundary
- `src/modules/messaging` as the messaging capability home
- `src/modules/keepcozy` as a real separate domain
- current Messenger runtime behavior
- current KeepCozy runtime behavior

## What To Defer

Defer these until the architectural story and ownership are cleaner:

- major route-tree reshaping
- schema redesign for cleaner product separation
- repo/package split
- billing/commercial implementation
- broad marketplace implementation
- large shell redesign

## Practical Decision Rule

For any future branch, ask:

1. Is this platform foundation?
2. Is this shared capability?
3. Is this Messenger product behavior?
4. Is this KeepCozy product behavior?

If the answer is unclear, fix the documentation and ownership framing before
adding more runtime complexity.
