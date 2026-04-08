# Chat Runtime Performance Pass

This document captures the highest-value runtime bottlenecks in the current CHAT browser experience.

Scope for this pass:

- materially improve inbox responsiveness
- reduce thread open latency
- lower hydration and render cost
- make outgoing send behavior more predictable
- stabilize current non-encrypted voice draft, send, playback, and reopen behavior

This is intentionally a narrow runtime-performance audit, not a messaging-architecture rewrite.

## Current audit baseline

The current runtime is functionally broad, but the critical browser paths are doing too much work too early:

- `/inbox` server-rendering fetches conversation lists, archived conversations, available users, existing DM partner ids, participant identities, preview kinds, and avatar paths in the same entry path
- `/chat/[conversationId]` builds a dense first snapshot with messages, sender profiles, reactions, attachments, voice state, read state, and E2EE envelope hints before the route is ready
- thread hydration mounts a large client tree with message maps, attachment maps, reaction maps, sender maps, optimistic state, playback helpers, and recovery timers together
- voice draft/send/playback is still heavily memory-bound and route-bound on the client

## Prioritized bottlenecks

### P0. Inbox SSR is over-fetching before the route can feel fast

Primary files:

- `app/(app)/inbox/page.tsx`
- `src/modules/messaging/data/server.ts`

Current cost drivers:

- route entry fetches both main and archived conversation lists up front
- route entry fetches `availableUsers` even when the create sheet is closed
- route entry fetches existing DM partner ids even when no create action is happening
- inbox mapping resolves participant identities and avatar delivery paths for every visible conversation during SSR
- inbox preview mapping still does attachment-preview lookup work for latest messages

User-visible symptoms:

- entering inbox feels heavier than the number of visible rows suggests
- fresh messenger spaces still pay setup cost before the first useful frame
- filter/search UI hydrates after a large SSR payload instead of after a narrow first list

Recommended narrow fix:

- keep the initial inbox SSR path focused on the primary conversation list only
- defer archived conversations until the archived view is explicitly opened
- defer `availableUsers` and existing DM partner ids until the create sheet opens
- stop doing avatar and participant enrichment for rows that do not need it in the first paint path

### P0. Thread open is doing too much snapshot work before first paint

Primary files:

- `app/(app)/chat/[conversationId]/page.tsx`
- `src/modules/messaging/data/server.ts`

Current cost drivers:

- thread route prepares history, participants, read-state, sender profiles, reactions, attachments, and envelope metadata in the same open path
- `getConversationHistorySnapshot(...)` loads messages first, then immediately fans out to sender profiles, grouped reactions, attachments, and encrypted envelope fetches
- attachment loading still includes signed-URL resolution work for committed media and legacy attachments

User-visible symptoms:

- opening a conversation feels slower than inbox entry
- thread startup cost grows with richer message history even when only a small visible window is needed
- voice-heavy threads pay extra attachment and signed-URL overhead during open

Recommended narrow fix:

- split the thread open path into a strict first-paint snapshot and a secondary enrichment pass
- keep initial thread open focused on visible messages plus only the metadata required to render the first window truthfully
- move non-critical enrichment such as some attachment URL resolution and lower-priority read-state detail behind the first paint

### P0. Voice draft and voice send are not resilient across refresh or reopen

Primary files:

- `app/(app)/chat/[conversationId]/use-composer-voice-draft.ts`
- `app/(app)/chat/[conversationId]/use-conversation-outgoing-queue.ts`
- `app/(app)/chat/[conversationId]/thread-history-viewport.tsx`

Current cost drivers:

- voice drafts live only in memory as blob refs plus blob URLs
- outgoing queue lives only in memory and is lost on refresh/reopen
- playback recovery depends on thread-local state, in-memory singleton playback ownership, and retry timers

User-visible symptoms:

- a refresh can destroy an in-progress or ready-to-send voice draft
- reopen after a send can leave voice appearing delayed or unstable while attachment resolution catches up
- failed or retried voice sends feel brittle because queue state and draft state are not durable enough

Recommended narrow fix:

- persist the minimal local voice draft and outgoing upload/send job metadata per conversation in a lightweight client store
- keep binary blobs ephemeral, but preserve enough draft/job identity to recover UI state after refresh
- separate playback recovery state from the full thread viewport so voice reopen behavior is not coupled to the entire history tree

### P1. Inbox hydration surface is larger than the visible interaction model

Primary files:

- `app/(app)/inbox/inbox-filterable-content.tsx`

Current cost drivers:

- one large client component owns filters, views, search, create-sheet visibility, pull-to-refresh state, live summary subscription, and empty-state branching
- conversation filtering/searching runs in the same large tree that also owns create-sheet concerns
- URL replacement and live-summary updates can cause more reconciliation than the route needs

Recommended narrow fix:

- split filter/search/list rendering from create-sheet/runtime concerns
- keep the conversation list client subtree smaller and cheaper to hydrate
- isolate live-summary subscription effects so they do not invalidate unrelated inbox UI

### P1. Avatar and preview enrichment is still heavier than it should be

Primary files:

- `src/modules/messaging/data/server.ts`

Current cost drivers:

- `getProfileIdentities(...)` repeatedly resolves avatar delivery paths during profile enrichment
- inbox mapping resolves participant identities for conversation rows even when only a display label is needed
- inbox preview logic still queries attachment preview kinds by message id for latest-message rows
- `getMessageAttachments(...)` eagerly creates signed URLs for thread attachments during history projection

Recommended narrow fix:

- treat avatar delivery paths as cheap stable strings, not per-request enrichment work where avoidable
- use lighter-weight participant summary data for inbox rows
- avoid attachment-preview work unless the latest-message row actually needs media-specific preview labeling
- reduce eager signed-URL generation for attachments that are not immediately being opened or played

### P1. Outgoing queue processing is simple but inefficient and fragile

Primary files:

- `app/(app)/chat/[conversationId]/use-conversation-outgoing-queue.ts`
- `app/(app)/chat/[conversationId]/live-outgoing-message-status.tsx`

Current cost drivers:

- queue is strictly in-memory and serial
- queue removal uses array filtering after each item
- each item emits multiple lifecycle updates that can churn optimistic rendering

User-visible symptoms:

- refresh loses local send context
- retries feel like a brand-new path instead of a continuation
- busy threads can accumulate unnecessary optimistic status churn

Recommended narrow fix:

- keep the queue narrow but persistent per conversation
- reduce avoidable lifecycle emissions for unchanged status
- prepare the queue shape so later encrypted sends and media sends can reuse the same job identity model

### P1. Voice playback resolution is doing too much inside the thread viewport

Primary files:

- `app/(app)/chat/[conversationId]/thread-history-viewport.tsx`
- `src/modules/messaging/data/server.ts`

Current cost drivers:

- the viewport owns playback state, signed-URL recovery retries, voice readiness resolution, and cleanup timers
- voice attachment retries are embedded in the same large component that owns message rendering and history patching
- the first snapshot may still ship unresolved voice attachments that then need client-side recovery cycles

Recommended narrow fix:

- move voice playback resolution into a smaller voice-runtime helper that the viewport can consume
- keep the thread viewport focused on message rendering and patch application
- make recovery reasons and retry state narrower so refresh/reopen does not depend on long-lived component instances

### P2. Loading and failure states still hide the real cause of slowness or instability

Primary files:

- `app/(app)/inbox/inbox-filterable-content.tsx`
- `app/(app)/chat/[conversationId]/page.tsx`
- `app/(app)/chat/[conversationId]/composer-voice-draft-panel.tsx`

Current gaps:

- inbox loading does not distinguish initial list load from deferred create-sheet data load
- thread open does not clearly separate route-loading from attachment or voice-enrichment lag
- voice failure and recovery copy is better than before, but still does not explain refresh-loss vs upload failure vs playback resolution failure clearly enough

Recommended narrow fix:

- keep loading states truthful to the actual slow stage
- label deferred secondary work so the route can feel ready sooner without looking broken
- make voice recovery copy specific to the failure class

## Fix order for the next implementation pass

1. Reduce inbox SSR over-fetch.
2. Split thread open into first-paint snapshot vs secondary enrichment.
3. Persist minimal local outgoing-job and voice-draft state per conversation.
4. Shrink inbox hydration by separating list UI from create-sheet/runtime state.
5. Pull voice playback/recovery logic into a smaller runtime helper.
6. Trim avatar and preview enrichment work after the route feels fast.

## Practical implementation notes

### Inbox list and filter cost

First-pass rule:

- do not fetch create-sheet inputs on the initial `/inbox` request

Likely high-leverage changes:

- lazy-load `availableUsers`
- lazy-load existing DM partner ids
- lazy-load archived conversations
- cap participant-identity enrichment to the rows currently needed for display

### Conversation open latency

First-pass rule:

- first paint should not wait on every secondary mapping helper

Likely high-leverage changes:

- ship the initial visible message window first
- defer some signed-URL and non-critical attachment enrichment
- avoid repeating profile/reaction/read-state work when the same conversation is reopened quickly

### Repeated fetches and re-renders

Likely current repetition points:

- inbox route redoes broad SSR work on entry
- thread route rebuilds a dense snapshot on open
- large client components own unrelated state in the same subtree

### Avatar and media preview overhead

Guardrail:

- inbox and activity should remain summary-only

That means:

- no blob inspection for previews
- no thread-level attachment work in summary routes
- no unnecessary signed-URL creation for surfaces that only need labels

### Voice runtime stability

First-pass stability rule:

- preserve draft and pending-send intent across refresh even if the binary must be reacquired or retried

Likely high-leverage changes:

- persist draft/job descriptors locally
- separate playback recovery from full thread render lifecycle
- make reopen state deterministic when a voice send is still reconciling committed media metadata

## Future-proof constraints

This pass must not block or complicate later work in these areas.

### Encrypted groups

- do not hardwire optimizations to plaintext-only assumptions in shared queue or thread contracts
- keep message/job identity usable for later encrypted send flows
- avoid baking inbox or thread shortcuts that assume sender-profile or envelope work can never be deferred differently for encrypted threads

### Media evolution

- keep media metadata separate from message-row semantics
- do not move binary transport concerns back into inbox or route-level summary loaders
- preserve the `message_assets` / `message_asset_links` direction even when adding tactical fallbacks

### Eventual call integration

- do not let voice-message playback/runtime become the future call transport layer
- keep RTC and call-session concerns out of inbox summary and thread-history fetch paths
- prefer smaller media/runtime helpers that can coexist with later RTC modules instead of expanding route components further

## Definition of success for this pass

The next implementation batch should make these practical improvements visible:

- inbox enters faster because the first request is narrower
- opening a thread reaches a readable first paint faster
- refresh/reopen is less punishing for pending sends and voice drafts
- voice playback and recovery feels more deterministic
- summary routes stay lightweight enough for later encrypted groups, richer media, and eventual calls
