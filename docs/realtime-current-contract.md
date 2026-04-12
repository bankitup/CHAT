# Realtime Current Contract

## Purpose

This document describes how Messenger realtime actually works in the repository today.

It is intentionally practical:
- what is authoritative
- what is only a live hint
- where subscriptions are mounted
- what recovery exists today
- where the contract is currently weak

This is a proof document for current behavior, not a target architecture.

## Honest Summary

The current model is **not** a single authoritative realtime system.

Today the repository uses a hybrid contract:
- server-rendered snapshots and server refetches are the authority
- client stores hold route-local working state
- realtime events act as hints, patch triggers, and catch-up triggers
- route re-entry often heals stale state because it re-establishes server truth

In practice, this means the app behaves more like:

`SSR truth -> local store -> opportunistic realtime hint -> targeted server catch-up`

than:

`single live stream -> fully authoritative client state`

## Current Source Of Truth

### Thread Messages

**Authoritative today**
- Server thread snapshot from `src/modules/messaging/server/thread-page.ts`
- History API from `app/api/messaging/conversations/[conversationId]/history/route.ts`

**Route-local working state**
- `app/(app)/chat/[conversationId]/thread-history-viewport.tsx`
- `app/(app)/chat/[conversationId]/use-thread-history-sync-runtime.ts`
- `src/modules/messaging/realtime/thread-live-state-store.ts`
- `src/modules/messaging/realtime/thread-message-patch-store.ts`

**Live inputs**
- `src/modules/messaging/realtime/active-chat-sync.tsx`
- local committed-message events
- local patch updates for message body/edit/delete changes
- targeted topology sync requests

**Current contract**
- Realtime can insert, patch, or request catch-up.
- Realtime is **not** the final authority for thread history.
- When the client suspects drift, it falls back to history refetch/topology sync.

### Inbox Summaries

**Authoritative today**
- Server-built summary arrays from `src/modules/messaging/server/inbox-page.ts`
- Per-conversation summary refetches inside `src/modules/messaging/realtime/inbox-sync.tsx`

**Route-local working state**
- `src/modules/messaging/realtime/inbox-summary-store.ts`
- live row consumers such as `app/(app)/inbox/inbox-conversation-live-row.tsx`

**Current contract**
- The inbox store is a hydrated cache plus patch layer.
- Realtime does not deliver authoritative full inbox summaries.
- Instead, realtime events trigger summary refetches for affected conversations.
- Thread-originated local projections may patch inbox summary state directly, and inbox sync now suppresses redundant refetch when the current summary already reflects the latest message or read-state projection.

### Unread State

**Authoritative today**
- Server conversation/member rows
- badge API from `app/api/messaging/unread-badge/route.ts`
- server unread aggregation in `src/modules/messaging/push/server.ts`

**Route-local working state**
- thread read-state patches inside thread live state
- inbox summary unread counts in the inbox summary store
- badge refresh events from `src/modules/messaging/push/chat-unread-badge-sync.tsx`

**Current contract**
- Local unread patches are hints for responsiveness.
- Server-derived unread remains authoritative.
- Badge state is deliberately decoupled from route-local stores.

### Presence And Typing

**Presence**
- Push-subscription presence from `src/modules/messaging/push/presence-sync.tsx` is an operational signal used for delivery/suppression behavior.
- Conversation presence from `app/(app)/chat/[conversationId]/conversation-presence-provider.tsx` is an ephemeral UI hint.

**Typing**
- `app/(app)/chat/[conversationId]/composer-typing-textarea.tsx`
- `app/(app)/chat/[conversationId]/typing-indicator.tsx`

**Current contract**
- Presence and typing are live hints only.
- They are not durable truth and should not be treated as authoritative state.
- They should not promote message delivery status, drive inbox summary truth, or trigger authoritative catch-up.

## What Mounts Where

### Shared Shell

The shared authenticated shell no longer owns broad Messenger realtime directly.

Messenger runtime is mounted through route-local seams such as:
- `app/(app)/chat/[conversationId]/thread-route-runtime-effects.tsx`
- `app/(app)/inbox/inbox-route-runtime-effects.tsx`
- `app/(app)/activity/activity-route-runtime-effects.tsx`

This keeps non-Messenger authenticated routes from paying the same base realtime cost.

### Thread Route

Thread-specific live behavior is mounted below the route and mostly deferred:
- `app/(app)/chat/[conversationId]/thread-page-deferred-effects.tsx`
- `src/modules/messaging/realtime/active-chat-sync.tsx`
- local presence and typing providers inside the thread subtree

This means thread realtime is route-scoped, not shell-global.

### Inbox Route

Inbox live behavior is also route-scoped and deferred:
- `app/(app)/inbox/inbox-page-deferred-effects.tsx`
- `app/(app)/inbox/deferred-inbox-realtime-sync.tsx`
- `src/modules/messaging/realtime/inbox-sync.tsx`

Live rows upgrade after the initial static SSR list.

## Lifecycle Behavior Today

### Initial Route Load

**Thread**
- Server loads the thread snapshot and read-state data.
- The viewport initializes from the server snapshot.
- Session cache may be merged back in.
- Deferred realtime mounts later.
- On mount, the thread requests a recovery sync with reason `thread-mount-recovery`.

**Inbox**
- Server loads main and archived summaries.
- The page renders a static list first.
- Live summary store hydration and realtime sync mount later.

### Background -> Foreground

**Thread**
- If the tab was hidden long enough, thread sync requests a newer-than-latest catch-up on visibility return.
- Push presence and unread badge refresh also resync on visibility/focus.

**Inbox**
- If hidden long enough, inbox sync refetches tracked conversation summaries on visibility return.

### Websocket Reconnect

**Thread**
- Thread has an explicit reconnect contract.
- `src/modules/messaging/realtime/active-chat-sync.tsx` detects resubscribe and requests both newer-than-latest catch-up and an authoritative latest-window reconciliation pass.

**Inbox**
- Inbox sync has visibility-based refresh, event-driven refetch, and an explicit resubscribe summary catch-up path.

### Route Transition

**Thread**
- Realtime channels unmount on route exit.
- Re-entering the route re-applies fresh server truth and mount recovery.
- This is a major reason stale/broken threads often look healthier after leaving and re-entering.

**Inbox**
- Re-entering the route rehydrates the store from fresh server summaries.

### Missed Event Or Stale Store

**Thread**
- The route can fall back to by-id or after-seq sync requests.
- Multiple recovery paths trigger targeted sync when the local state looks suspicious.
- If recovery fetch fails, the route usually preserves degraded local state instead of hard-resetting.

**Inbox**
- The route can refetch affected conversation summaries.
- Some failures fall back to `router.refresh()`.
- Quiet reconnect gaps are still weaker here than on thread.

## What Is Authoritative vs What Is Only A Hint

### Authoritative
- server thread snapshot and history route
- server-built inbox summaries and summary refetch
- server unread aggregation
- server conversation/member read-state rows

### Live Hint / Patch / Catch-Up Trigger
- message insert/update realtime events
- reaction realtime events
- typing broadcasts
- conversation presence channel state
- push-subscription presence
- local optimistic thread and inbox patches

## Current Weak Points

### 1. Thread And Inbox Do Not Share One Clear Realtime Contract

Both routes use server truth plus local stores plus live hints, but they do not reconcile through one shared authoritative model.

### 2. Inbox Reconnect Recovery Is Weaker Than Thread

Both routes now have explicit reconnect recovery, but thread still has a stronger authoritative latest-window reconciliation path than inbox.

### 3. Route Re-Entry Is Stronger Than In-Place Healing

That is a sign that SSR re-establishment is currently more trustworthy than the mounted realtime contract.

### 4. Deferred Mounting Trades Freshness For Startup Cost

That performance trade is intentional, but it creates a short freshness gap during route entry and fast route transitions.

### 5. Too Many Recovery Paths Are Ad Hoc

Thread recovery is robust in spirit, but it is spread across multiple local repair triggers rather than one explicit catch-up contract.

## Current Practical Conclusion

If we describe the repository honestly today:

- thread truth is server history, not the websocket stream
- inbox truth is server summary shape, not the inbox store
- unread truth is server-derived, not route-local
- presence and typing are hints only
- route-local realtime improves responsiveness, but it is still secondary to server catch-up

That is the current contract the team should reason from before changing runtime behavior.
