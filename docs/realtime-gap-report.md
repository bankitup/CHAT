# Realtime Gap Report

## Purpose

This document lists the main gaps between the current realtime behavior and a stable daily-use Messenger contract.

It is intentionally narrow:
- what is weak today
- why it matters
- where the evidence lives
- what should be fixed first

## Ranked Gaps

### P0. Inbox Has No Explicit Reconnect Catch-Up Contract

**Why it matters**

The thread route has a clear resubscribe recovery path. The inbox route does not. That means websocket reconnects can leave inbox state stale until another trigger happens, such as visibility return, route re-entry, manual refresh, or a later event.

**Evidence**
- `src/modules/messaging/realtime/active-chat-sync.tsx`
- `src/modules/messaging/realtime/inbox-sync.tsx`

**Recommended cleanup priority**

First.

**Likely fix direction**

Give inbox the same explicit reconnect catch-up contract that thread already has:
- detect resubscribe/reconnect
- refetch tracked summaries immediately
- avoid waiting for visibility or user navigation

### P0. Route Re-Entry Is A Stronger Recovery Path Than Staying Mounted

**Why it matters**

Users should not need to leave and re-enter a route to see fresh state correctly. When re-entry heals stale state more reliably than the mounted route, the realtime contract is too weak.

**Evidence**
- server thread truth from `src/modules/messaging/server/thread-page.ts`
- thread mount recovery from `app/(app)/chat/[conversationId]/thread-history-viewport.tsx`
- thread sync runtime from `app/(app)/chat/[conversationId]/use-thread-history-sync-runtime.ts`
- inbox server truth from `src/modules/messaging/server/inbox-page.ts`

**Recommended cleanup priority**

First.

**Likely fix direction**

Strengthen in-place catch-up so mounted routes can re-establish authoritative state without needing a full route reset.

### P1. There Is No Single Authoritative Realtime Contract Across Thread, Inbox, And Unread

**Why it matters**

Thread, inbox, unread badge, presence, and typing all use different truth models. That makes consistency harder to reason about and increases the chance that one surface looks fresh while another still looks stale.

**Evidence**
- thread authority via history snapshot and history route
- inbox authority via server summary building and summary refetch
- unread authority via unread badge API and server aggregation
- local stores in `src/modules/messaging/realtime/thread-live-state-store.ts` and `src/modules/messaging/realtime/inbox-summary-store.ts`

**Recommended cleanup priority**

Second wave.

**Likely fix direction**

Document and then standardize:
- what each route may patch locally
- what always requires authoritative refetch
- how thread and inbox stay consistent after message, read, edit, delete, and reaction changes

### P1. Deferred Realtime Mounting Creates A Freshness Gap At Route Entry

**Why it matters**

The current deferred mount strategy is good for performance, but it means the user can briefly sit on a route before its live contract is fully active. On a busy chat product, that can be enough to notice staleness.

**Evidence**
- `app/(app)/chat/[conversationId]/thread-page-deferred-effects.tsx`
- `app/(app)/inbox/inbox-page-deferred-effects.tsx`
- `app/(app)/inbox/deferred-inbox-realtime-sync.tsx`

**Recommended cleanup priority**

Second wave.

**Likely fix direction**

Keep the performance wins, but make the catch-up boundary explicit:
- fast initial authoritative snapshot
- predictable post-mount catch-up
- avoid silent “mounted but not truly live yet” gaps

### P1. Thread Recovery Is Spread Across Too Many Ad Hoc Repair Paths

**Why it matters**

The thread route has many recovery triggers, which is better than having none, but the contract is hard to reason about. That increases fragility and makes future fixes slower.

**Evidence**
- `app/(app)/chat/[conversationId]/use-thread-history-recovery.ts`
- `app/(app)/chat/[conversationId]/use-thread-history-sync-runtime.ts`
- `src/modules/messaging/realtime/thread-history-sync-events.ts`

**Recommended cleanup priority**

Second wave.

**Likely fix direction**

Converge local repair paths onto a smaller explicit contract:
- what triggers patch-only updates
- what triggers authoritative history catch-up
- what is allowed to remain optimistic temporarily

### P2. Presence And Typing Are Easy To Overread As Truth

**Why it matters**

Presence and typing are currently hint-only channels. If future work treats them as durable truth, the repo will regress into confusing state semantics.

**Evidence**
- `app/(app)/chat/[conversationId]/conversation-presence-provider.tsx`
- `app/(app)/chat/[conversationId]/composer-typing-textarea.tsx`
- `app/(app)/chat/[conversationId]/typing-indicator.tsx`
- `src/modules/messaging/push/presence-sync.tsx`

**Recommended cleanup priority**

Later, mostly as discipline and documentation.

**Likely fix direction**

Keep these channels explicitly classified as hints in docs and architecture acceptance rules.

### P2. Realtime Documentation In The Module Itself Is Out Of Date

**Why it matters**

The repo now contains meaningful realtime logic, but the local messaging realtime README still describes realtime as largely unimplemented. That creates onboarding drift and makes the actual contract harder to discover.

**Evidence**
- `src/modules/messaging/realtime/README.md`

**Recommended cleanup priority**

Later, after the contract is clarified.

## Highest-Priority Fix Shortlist

### 1. Add Explicit Inbox Reconnect Recovery

Bring inbox up to the same reconnect standard as thread:
- detect resubscribe
- immediately refetch tracked summaries
- avoid relying on visibility return or route re-entry

### 2. Make In-Place Catch-Up Stronger Than Route Re-Entry

Users should not need navigation as a recovery mechanism. Mounted routes need a clear authoritative refresh path.

### 3. Define One Written Reconciliation Contract Across Thread, Inbox, And Unread

Before more runtime work lands, the repo needs a shared rulebook for:
- local optimistic patches
- server catch-up triggers
- cross-surface consistency

### 4. Consolidate Thread Recovery Triggers

The current thread repair behavior works through many local triggers. That should be reduced to a smaller, easier-to-audit contract.

## Practical Recommendation

The next implementation wave should not start from “fix the subscription”.

It should start from:
- what is authoritative
- what counts as a live hint
- when a mounted route must force catch-up
- how inbox and thread re-establish consistency after reconnect or missed events

That is the narrowest path to making the current Messenger runtime feel reliable without over-designing a generic live-state system.
