# Repo Boundary Drift Report

## Purpose

This report lists the main places where the current codebase still drifts away
from the intended BWC doctrine.

The goal is not to call the repo "wrong".
The goal is to identify the cleanup moves that will improve ownership clarity,
reduce future coupling, and make later product work easier.

## Ranking Scale

- `High`: directly blocks clean platform/capability/product separation
- `Medium`: causes ongoing confusion or reuse mistakes, but does not block all progress
- `Low`: worth noting, but not urgent

Cleanup priority uses:

- `Now`
- `Next`
- `Later`

## Ranked Drift Items

| Rank | Drift item | Evidence paths | Severity | Why it matters | Cleanup priority |
| --- | --- | --- | --- | --- | --- |
| 1 | Product posture is still encoded inside shared `spaces` profile compatibility | `src/modules/spaces/model.ts`, `src/modules/spaces/posture.ts`, `app/(app)/layout.tsx` | High | The platform space model still directly carries product profiles like `messenger_full` and `keepcozy_ops`, plus legacy `TEST` behavior. That still makes platform-adjacent profile resolution carry product identity. | Now |
| 2 | Shared shell still owns product nav behavior and posture decisions | `app/(app)/app-shell-frame.tsx`, `src/modules/app-shell/state.ts`, `src/modules/app-shell/space-posture.ts` | High | Messenger runtime effects have moved lower into route-local seams, and shell posture is no longer owned by `spaces`, but the shared shell still decides Messenger/KeepCozy nav posture and product-facing shell behavior. Ownership still sits one layer too high. | Now |
| 3 | `/home` and `/activity` remain mixed-product routes | `app/(app)/home/page.tsx`, `app/(app)/activity/page.tsx` | High | These routes still branch between product experiences or product posture inside a single surface. That makes refactors, metrics, and product ownership harder to reason about. | Now |
| 4 | Shared settings/profile surface still routes through Messenger ownership | `app/(app)/settings/page.tsx`, `src/modules/messaging/server/settings-page.ts`, `src/modules/profile/server.ts`, `src/modules/messaging/data/profiles-server.ts` | High | Shared profile/settings behavior is active across products, but the loader and persistence chain still depend on Messenger/messaging ownership. This keeps profile foundation from becoming truly platform-owned. | Next |
| 5 | Shared error/support behavior still lives under `messaging/ui` | `src/modules/messaging/ui/user-facing-errors.ts`, reused from `app/(app)/home/actions.ts`, `app/(app)/issues/actions.ts`, `app/(app)/tasks/actions.ts`, `app/(app)/spaces/actions.ts`, `app/(app)/inbox/actions.ts` | Medium | The behavior is already broader than Messenger, but the namespace still teaches the wrong ownership model. This encourages accidental Messenger gravity in shared and KeepCozy code. | Next |
| 6 | Messaging data and thread runtime still have overgrown gravity points | `src/modules/messaging/data/server.ts`, `app/(app)/chat/[conversationId]/thread-history-viewport.tsx`, `app/(app)/chat/[conversationId]/thread-message-row.tsx`, `app/(app)/inbox/inbox-filterable-content.tsx` | High | Even after recent splits, the remaining large files still make it harder to enforce clean capability and product boundaries. They also keep thread and inbox work fragile. | Next |
| 7 | Messenger-first server loaders still sit inside capability space | `src/modules/messaging/server/inbox-page.ts`, `src/modules/messaging/server/thread-page.ts`, `src/modules/messaging/server/thread-settings-page.ts`, `src/modules/messaging/server/settings-page.ts` | Medium | This is workable today, but the folder mixes capability seams with Messenger-first page orchestration. The distinction is documented, but the directory shape still encourages blurred ownership. | Later |

## Drift Themes

### Messenger gravity leaking into shared shell/foundation

Main evidence:

- `app/(app)/app-shell-frame.tsx`
- `src/modules/app-shell/state.ts`
- `src/modules/app-shell/space-posture.ts`
- `app/(app)/layout.tsx`

Why it matters:

- non-Messenger routes still pay conceptual and runtime cost for Messenger decisions
- platform foundation becomes harder to reuse for future products
- product posture becomes harder to evolve independently

### KeepCozy-specific logic pretending to be shared

Main evidence:

- `src/modules/spaces/posture.ts`
- `src/modules/spaces/model.ts`
- legacy `TEST` fallback behavior

Why it matters:

- KeepCozy history leaks into platform vocabulary
- shared `spaces` semantics become tied to current products
- future products inherit old assumptions they did not ask for

### Mixed route posture

Main evidence:

- `app/(app)/home/page.tsx`
- `app/(app)/activity/page.tsx`
- `app/(app)/settings/page.tsx`

Why it matters:

- one route can no longer be read as one layer
- product-specific behavior becomes harder to measure and test
- refactors tend to touch multiple ownership layers at once

### Mixed identity/profile ownership

Main evidence:

- `src/modules/profile/server.ts`
- `src/modules/messaging/data/profiles-server.ts`
- `src/modules/messaging/server/settings-page.ts`

Why it matters:

- shared identity is already real
- persistence ownership is still not fully detached from messaging
- future products will keep routing through messaging unless this is tightened

### Runtime effects mounted too broadly

Main evidence:

- `app/(app)/chat/[conversationId]/thread-route-runtime-effects.tsx`
- `app/(app)/inbox/inbox-route-runtime-effects.tsx`
- `app/(app)/activity/activity-route-runtime-effects.tsx`
- route-level mounting inside `app/(app)/inbox/page.tsx`
- route-level mounting inside `app/(app)/chat/[conversationId]/thread-page-content.tsx`
- route-level mounting inside `app/(app)/activity/page.tsx`

Why it matters:

- Messenger runtime ownership is now lower, but still needs to stay off
  non-Messenger routes by default
- route-local seams are safer, but they still need guardrails against drifting
  back into shared shell code
- future cleanup should keep startup-sensitive effects near the product surfaces
  that actually need them

### Overgrown monoliths that block clean ownership

Main evidence:

- `src/modules/messaging/data/server.ts` at `5517` lines
- `app/(app)/chat/[conversationId]/thread-history-viewport.tsx` at `2746` lines
- `app/(app)/chat/[conversationId]/thread-message-row.tsx` at `2540` lines
- `app/(app)/inbox/inbox-filterable-content.tsx` at `1127` lines
- `app/(app)/home/page.tsx` at `1006` lines

Why it matters:

- large files keep multiple ownership concerns glued together
- one runtime problem can still spill across unrelated behaviors
- classification gets harder to enforce because the files themselves are mixed

## Recommended Cleanup Order

### 1. Untangle product posture from `spaces` foundation

Start by reducing product identity inside:

- `src/modules/spaces/model.ts`
- `src/modules/spaces/posture.ts`
- `src/modules/app-shell/state.ts`
- `src/modules/app-shell/space-posture.ts`

This is the highest-value doctrine cleanup because it affects shell behavior,
route posture, and future product admission.

### 2. Split mixed product routes

Prioritize:

- `/home`
- `/activity`

The goal is not necessarily new URLs first.
The goal is clearer composition seams and less mixed product branching inside
single route files.

### 3. Finish shared profile/settings extraction out of messaging ownership

Prioritize:

- `app/(app)/settings/page.tsx`
- `src/modules/messaging/server/settings-page.ts`
- `src/modules/profile/server.ts`
- `src/modules/messaging/data/profiles-server.ts`

### 4. Keep shrinking Messenger runtime in shared shell

Continue reducing product-specific runtime ownership in:

- `app/(app)/app-shell-frame.tsx`
- Messenger route runtime seams under `app/(app)/chat/[conversationId]/**`
- Messenger route runtime seams under `app/(app)/inbox/**`
- Messenger route runtime seams under `app/(app)/activity/**`

The shell should remain a host, not a long-term product-runtime home.

### 5. Continue capability/product monolith reduction

Prioritize:

- `src/modules/messaging/data/server.ts`
- Messenger thread runtime files
- inbox runtime files
- mixed `home/page.tsx`

### 6. Move cross-product error/support helpers out of Messenger namespace

`src/modules/messaging/ui/user-facing-errors.ts` is already serving more than
Messenger.
The namespace should eventually match that reality.

## Honest Current Conclusion

The codebase is already close enough to the BWC model to be useful.
The main problem is not absence of structure.
The main problem is that some of the oldest and strongest seams still sit one
layer too high or one namespace too deep.

That means the next cleanup wave should focus on:

1. posture and shell ownership
2. mixed routes
3. profile/settings ownership
4. remaining monoliths
