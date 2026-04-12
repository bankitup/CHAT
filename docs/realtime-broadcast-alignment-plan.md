# Realtime Broadcast Alignment Plan

## Purpose

This document defines the practical transition path toward a cleaner
broadcast-first realtime model for Messenger.

It is intentionally incremental:
- server/database state stays authoritative
- broadcast stays the preferred low-latency hint path where it already fits
- presence remains separate
- Postgres Changes remains a recovery and authoritative patch path until a
  broader migration is actually safe

This is not a proposal for a one-branch rewrite.

## Current Delivery Modes

### Broadcast already used today

- `src/modules/messaging/realtime/live-refresh.ts`
  - local committed window event
  - `message-committed` broadcast
- `app/(app)/chat/[conversationId]/composer-typing-textarea.tsx`
  - typing broadcast send
- `app/(app)/chat/[conversationId]/typing-indicator.tsx`
  - typing broadcast receive
- `app/(app)/chat/[conversationId]/conversation-presence-provider.tsx`
  - Supabase Presence for ephemeral participant presence

### Postgres Changes still used today

- `src/modules/messaging/realtime/active-chat-sync.tsx`
  - `messages`
  - `conversation_members`
  - `conversations`
  - `message_reactions`
- `src/modules/messaging/realtime/inbox-sync.tsx`
  - `messages`
  - `conversation_members`
  - `conversations`

## Practical Long-Term Contract

### Authoritative

- thread history route and thread server snapshot
- inbox summary server reads and summary refetch
- unread badge API and server unread aggregation
- conversation/member read-state rows

### Broadcast-first hot path

Broadcast should be the preferred low-latency trigger for:
- new message arrival signal
- local commit propagation
- typing signal

Broadcast should not become the only source of truth.

### Presence-only path

Presence should remain separate from message truth:
- push subscription presence
- conversation presence
- typing

These are auxiliary signals, not message authority.

### Postgres Changes role after alignment

Postgres Changes should increasingly act as:
- authoritative patch feed for metadata and read-state changes
- recovery backstop when broadcast is missed
- authoritative catch-up trigger, not the preferred hot-path insert signal

## Narrow First-Pass Alignment Landed

Current first-pass alignment:
- `src/modules/messaging/realtime/active-chat-sync.tsx`
  now treats a recent local/broadcast committed message hint as enough to
  suppress the duplicate `messages INSERT` topology sync for that same message
  id.

This keeps current behavior intact while reducing one obvious duplicate path:

`broadcast/local commit hint -> by-id sync -> postgres insert -> same by-id sync again`

becomes:

`broadcast/local commit hint -> by-id sync -> postgres insert live row -> no duplicate by-id sync`

## What Should Move Toward Broadcast-first Next

### 1. Thread message insert hot path

Target model:
- broadcast says “message X committed in conversation Y”
- thread requests by-id or after-seq catch-up from server authority
- Postgres Changes remains fallback/backstop, not the preferred first trigger

### 2. Inbox latest-message summary refresh trigger

Target model:
- broadcast committed message triggers summary reconciliation first
- summary refetch stays authoritative when the inbox store is behind
- Postgres Changes remains fallback/backstop for drift and non-message metadata

### 3. Read-state propagation

Target model:
- local optimistic read patch for responsiveness
- authoritative member-row reconciliation from server truth
- avoid broad route refresh unless membership state is truly critical

### 4. Reactions and edits/deletes

Target model:
- keep authoritative reconciliation from server data
- do not force a broad message-list sync when a narrower patch is enough

## What Should Not Be Forced Yet

Do not force a broad migration of all message updates away from Postgres Changes
until the repo has one cleaner server-backed catch-up contract for:
- thread inserts
- inbox latest-message projection
- read-state reconciliation
- reaction and edit/delete reconciliation

Without that contract, a full broadcast-only move would be a half-migration.

## Recommended Next Branch Sequence

1. Keep thread inserts on the new broadcast-first dedupe path.
2. Tighten inbox latest-message refetch rules around broadcast-first message hints.
3. Make the route-local catch-up contract more explicit than the delivery
   transport.
4. Only then consider reducing more `messages` Postgres Changes dependence.
