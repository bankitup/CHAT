# Chat Runtime Performance Pass

This document captures the highest-value runtime, density, and voice-clarity bottlenecks in the current CHAT browser experience.

Scope for this pass:

- materially improve inbox responsiveness
- reduce conversation open latency
- lower thread render and hydration cost
- make message rows denser and easier to scan
- stabilize current non-encrypted voice draft, send, reopen, and playback behavior
- improve header and voice-bubble clarity without redesigning the whole app

This is intentionally a narrow runtime-performance audit, not a messaging-architecture rewrite.

## Current branch reality

The current branch already moved a few important pieces in the right direction:

- inbox now defers create-target loading and trims some avoidable row/runtime work on first entry
- conversation entry does less first-paint work than before, especially around attachment and sender mapping
- message density and same-sender grouping are tighter, so more useful thread content fits on screen
- the header now follows the intended mobile hierarchy: back left, centered title, avatar right
- voice bubbles are cleaner: stronger play affordance, inline duration, and less metadata noise
- voice drafts can recover after refresh instead of disappearing silently
- optimistic and committed voice states are clearer, especially while uploading, recovering, or retrying
- quick message actions are lighter than the old popup pattern

Even with those improvements, the live browser experience still feels heavier than it should because the app is paying cost in three places at once:

- server entry paths still fetch and map too much data before first useful paint
- the message list is visually too tall for its information density
- voice and header surfaces still spend too much UI space while communicating too little

## Prioritized bottlenecks

### P0. Message density and grouping are still too wasteful

Primary files:

- `app/(app)/chat/[conversationId]/thread-history-viewport.tsx`
- `app/globals.css`

Current cost drivers:

- `.message-card` is capped at `336px`, so short bubbles still occupy a wide visual block with extra breathing room
- `.message-bubble` uses `12px 14px` padding and `20px` radii, which reads polished but wastes too much vertical space in a fast-moving thread
- `.message-row` spacing still adds `6px`, `3px`, and `12px` gaps between rows depending on adjacency, so three short messages can consume most of the viewport
- reply references, optimistic rows, and meta lines all stack with generous spacing, which compounds the vertical cost
- the thread treats each message as a standalone card instead of visually grouping fast consecutive messages tightly enough

User-visible symptoms:

- three short messages can take most of the screen
- scanning a conversation feels slower than it should because the eye has to travel too far
- the thread feels less like a chat feed and more like a stack of cards

Recommended narrow fix:

- tighten row and bubble spacing first before changing deeper thread structure
- reduce same-sender vertical gaps more aggressively than sender-switch gaps
- shrink padding, radii, and meta spacing on common text bubbles
- keep full spacing only where it earns its keep: sender switches, replies, failure stacks, and attachments

### P0. Conversation open still does too much before first paint

Primary files:

- `app/(app)/chat/[conversationId]/page.tsx`
- `src/modules/messaging/data/server.ts`

Current cost drivers:

- route entry still loads history snapshot, read state, member read states, and participants together
- `getConversationHistorySnapshot(...)` still fans out immediately into sender profiles, grouped reactions, attachments, and encrypted envelope hints
- the chat page still follows the snapshot with supplemental sender-profile work for participants and settings-only users
- voice-heavy threads still pay attachment mapping cost during open

User-visible symptoms:

- opening a conversation still feels heavier than it should relative to the visible window size
- richer threads pay extra startup cost even when the user only needs the first screenful
- the route can feel “busy” before the user has even started reading

Recommended narrow fix:

- split thread open into strict first-paint data and secondary enrichment
- keep the first pass focused on visible messages, essential sender labels, and only immediately renderable media state
- move lower-priority read detail, supplemental profile work, and some attachment enrichment behind first paint

### P0. Inbox SSR still over-maps before the route feels instant

Primary files:

- `app/(app)/inbox/page.tsx`
- `app/(app)/inbox/inbox-filterable-content.tsx`
- `src/modules/messaging/data/server.ts`

Current cost drivers:

- the create-sheet inputs are now deferred correctly, but participant identity mapping still runs across all visible conversations after the main list loads
- archived conversations still remain in the same entry-path shape even when the user is not in archived view
- inbox rows still carry more participant and preview structure than summary-first rendering really needs
- the large `InboxFilterableContent` client tree still owns filters, search, create sheet, pull-to-refresh, and live summary behavior together

User-visible symptoms:

- entering inbox feels heavier than the number of visible rows suggests
- fresh messenger spaces still pay row-enrichment cost before the route feels “done”
- search and filter interactions are attached to a broader hydration surface than necessary

Recommended narrow fix:

- keep the SSR path focused on the main visible list plus only the minimum row summary fields
- trim participant identity and preview mapping to the data actually rendered on first paint
- split list/filter state from create-sheet/runtime concerns so the list hydrates as a smaller subtree

### P0. Voice bubble clarity is still not strong enough

Primary files:

- `app/(app)/chat/[conversationId]/thread-history-viewport.tsx`
- `app/globals.css`

Current cost drivers:

- the play affordance is visually small and too close in emphasis to a disabled or loading state
- voice bubbles still carry a separate meta line that can show extra status noise
- ready-state voice rows still show file size, which adds clutter without helping playback
- duration is visually separated from the main action instead of reading as an inline part of the bubble

User-visible symptoms:

- it is too easy to hesitate about whether the voice bubble is playable
- voice rows feel busier than text rows without providing better clarity
- file size adds noise while duration, which users care about, does not get enough visual weight

Recommended narrow fix:

- strengthen the play affordance and reduce ambiguity between ready, loading, and failed states
- remove file-size display from voice bubbles
- keep duration inline with the bubble head, not as a separate noisy label
- make the voice card shorter and more compact so it reads as a chat message, not a mini widget

### P0. Header layout is spending too much space while still not matching the desired hierarchy

Primary files:

- `app/(app)/chat/[conversationId]/page.tsx`
- `app/(app)/chat/[conversationId]/chat-header-avatar-preview-trigger.tsx`
- `app/(app)/chat/[conversationId]/chat-header-avatar-visual.tsx`
- `app/globals.css`

Current cost drivers:

- the current shell is `back button + avatar/title cluster`, not `back left / centered title / avatar right`
- the title is visually pulled left by the avatar block, so it never reads as truly centered
- the header card uses large padding, a large avatar, and generous internal gaps
- the entire header behaves more like a feature card than a compact mobile chat header

User-visible symptoms:

- the header takes more vertical and horizontal space than it should
- title hierarchy feels slightly off on mobile
- the avatar is important, but it currently competes with the thread title instead of framing it

Recommended narrow fix:

- restructure the header shell to a strict three-zone layout: back, centered title/meta, avatar
- shrink padding and avatar size slightly so the thread begins sooner
- keep settings/avatar affordances, but stop letting them dominate the main header line

### P1. Repeated fetches and re-renders are still broader than needed

Primary files:

- `app/(app)/inbox/inbox-filterable-content.tsx`
- `app/(app)/chat/[conversationId]/thread-history-viewport.tsx`
- `app/(app)/chat/[conversationId]/live-outgoing-message-status.tsx`

Current cost drivers:

- large client trees still own unrelated concerns in one subtree
- live summary and live thread state updates can invalidate more UI than the user actually touched
- per-message live status helpers and optimistic overlays add churn on dense threads
- encrypted message body effects still run per visible encrypted row

Recommended narrow fix:

- isolate live subscriptions from list and row layout work
- reduce per-row rerender pressure for status-only changes
- keep dense thread rows visually and reactively smaller

### P1. Heavy hydration and over-fetching are still coupled together

Primary files:

- `app/(app)/chat/[conversationId]/page.tsx`
- `app/(app)/chat/[conversationId]/thread-history-viewport.tsx`
- `src/modules/messaging/data/server.ts`

Current cost drivers:

- the initial thread payload still includes large attachment, reaction, sender, and encrypted-history maps
- the viewport still owns playback, recovery timers, optimistic rows, patch application, and reaction UI together
- first-load truth and secondary enrichment are still mixed into one route story

Recommended narrow fix:

- split first-load rendering concerns from follow-up enrichment and recovery concerns
- keep the viewport focused on rendering and patch application, not every runtime helper

### P1. Avatar and preview enrichment still costs more than it returns

Primary files:

- `src/modules/messaging/data/server.ts`
- `app/(app)/inbox/page.tsx`

Current cost drivers:

- inbox still resolves participant identities for every visible conversation, even when only one display label is essential
- avatar-related row work still happens before the user has even interacted with a conversation
- preview and identity mapping still do more summary-route work than a fast inbox should need

Recommended narrow fix:

- keep inbox rows summary-first
- reserve richer avatar/identity work for the row subset that truly needs it

### P1. Outgoing queue processing is still simple but fragile

Primary files:

- `app/(app)/chat/[conversationId]/use-conversation-outgoing-queue.ts`
- `app/(app)/chat/[conversationId]/optimistic-thread-messages.tsx`

Current cost drivers:

- queue remains in-memory and serial
- queue removal still filters the full array after each item
- retries still behave like fresh optimistic jobs instead of a durable local send record

User-visible symptoms:

- refresh during send can still lose local job state
- voice sends are clearer now, but still not durable enough under interruption

Recommended narrow fix:

- persist minimal per-conversation job descriptors
- keep lifecycle updates truthful, but avoid duplicate emissions for unchanged state

### P1. Voice draft, send, and reopen behavior is better but still not fully stable

Primary files:

- `app/(app)/chat/[conversationId]/use-composer-voice-draft.ts`
- `app/(app)/chat/[conversationId]/composer-voice-draft-panel.tsx`
- `app/(app)/chat/[conversationId]/thread-history-viewport.tsx`
- `src/modules/messaging/media/upload-jobs.ts`

Current cost drivers:

- restored drafts are now visible, but upload/send job state is still not durable through the whole send lifecycle
- voice recovery still depends on the large thread viewport and retry timers
- voice progress states are clearer than before, but they still live partly in optimistic UI and partly in attachment recovery

Recommended narrow fix:

- preserve the current draft-recovery seam
- extend the same “recoverable local intent” model to send jobs before touching deeper media architecture

### P1. Playback after refresh and reopen still depends on too much thread-local machinery

Primary files:

- `app/(app)/chat/[conversationId]/thread-history-viewport.tsx`
- `src/modules/messaging/media/message-assets.ts`

Current cost drivers:

- playback ownership, reopen recovery, and signed-URL recovery still live in the viewport
- committed voice readiness still depends on attachment hydration and signed URL state resolving in time

Recommended narrow fix:

- move voice playback/recovery into a smaller dedicated helper
- keep playback-specific retry logic separate from the main thread render tree

### P2. Loading and failure states are improved, but still not fully truthful

Primary files:

- `app/(app)/inbox/inbox-filterable-content.tsx`
- `app/(app)/chat/[conversationId]/page.tsx`
- `app/(app)/chat/[conversationId]/composer-voice-draft-panel.tsx`
- `app/(app)/chat/[conversationId]/encrypted-dm-message-body.tsx`

Current gaps:

- inbox still does not sharply distinguish route-ready versus secondary-data-ready
- thread entry still mixes route open cost with voice/media follow-up work
- encrypted message rows can still read as “loading forever” instead of “not available yet for a specific reason”
- voice recovery copy is better, but playback-not-ready versus hard-failed can still be clearer

Recommended narrow fix:

- keep status copy tied to the actual slow stage
- avoid generic “loading” where the runtime already knows whether it is queued, recovering, unavailable, or failed

## Fix order for the next implementation pass

1. Tighten thread density, grouping, and header layout.
2. Strengthen voice bubble clarity and remove nonessential voice metadata.
3. Split thread open into first-paint snapshot versus secondary enrichment.
4. Trim inbox row mapping and hydration surface further.
5. Persist minimal outgoing-job state per conversation.
6. Pull voice playback and recovery into a smaller helper.

## Practical implementation notes

### Inbox list and filter cost

Current reality:

- create-sheet target data is already deferred correctly
- participant identity mapping and row shaping are still heavier than they should be

High-leverage next step:

- keep `/inbox` summary-first and reduce row-enrichment work before hydration

### Conversation open latency

Current reality:

- thread open still waits on history, participants, read state, and snapshot fan-out work together

High-leverage next step:

- first paint should only pay for the visible thread window plus essential labels

### Message density and grouping

Current reality:

- the CSS is generous enough that three short messages can dominate the screen

High-leverage next step:

- treat density as a runtime improvement, not just a visual tweak

### Header efficiency

Current reality:

- the current header is attractive but not compact or properly centered

High-leverage next step:

- move to a strict mobile chat header hierarchy before doing broader visual tuning

### Voice clarity

Current reality:

- restored drafts and optimistic states are clearer now
- the bubble itself still needs a stronger play target and quieter metadata

High-leverage next step:

- improve play affordance, inline duration, and state wording before deeper media work

## Future-proof constraints

This pass must not block or complicate later work in these areas.

### Encrypted groups

- do not hardwire performance shortcuts to plaintext-only thread assumptions
- keep first-paint versus secondary-enrichment seams compatible with encrypted-group history
- avoid making density or header decisions that depend on a DM-only runtime model

### Media evolution

- keep voice and attachments on the same asset model even if their UI density diverges
- do not move binary or signed-URL concerns into inbox summary loaders
- preserve the current asset and upload-job seam so richer media can grow without re-bloating route entry

### Eventual call integration

- do not turn voice-message runtime into call runtime
- keep playback helpers, voice draft state, and RTC concerns separable
- prefer smaller media/runtime helpers over making the thread viewport even larger

## Definition of success for the next fix batch

The next implementation batch should make these improvements visible:

- inbox feels lighter on entry and less expensive to filter
- opening a conversation reaches a readable first frame faster
- the header reads as a true mobile chat header: back left, title centered, avatar right
- the thread fits more real conversation on screen without feeling cramped
- voice bubbles feel easier to understand and easier to play
- refresh, reopen, and delayed voice hydration feel recoverable rather than broken

## Practical verification

- General chat responsiveness: open `/inbox`, switch between main and archived views, and confirm the inbox feels ready before any create-chat flow is opened. Then send a few short text messages and make sure optimistic rows appear immediately instead of feeling blocked on the backend.
- Conversation-entry speed: from `/inbox`, open one busy conversation, return, then open another. The first readable frame should appear quickly, and the route should feel less “busy” before the first screenful is usable.
- Denser message grouping: use a thread with several short consecutive messages from the same sender. Confirm same-sender runs are tighter than sender-switches, replies still read clearly, and more messages fit on one mobile-height screen than before.
- Header layout: in both a DM and a group thread, confirm the back button stays on the left, the title/meta block reads as centered, and the avatar stays on the right without pulling the title off-axis.
- Voice send, reopen, and playback: record a voice draft, stop it, and send it. Confirm the optimistic row moves through clearer queued and uploading states. Then refresh before sending another draft and confirm the draft restores. Finally refresh or reopen shortly after sending and confirm the committed bubble shows recovering or retry guidance instead of landing in a dead-end unavailable state.

## Known limitations

- The outgoing queue is still in-memory during the actual upload/send step, so a hard refresh mid-send can still lose local job state.
- Thread open has not yet been fully split into strict first-paint snapshot versus secondary enrichment.
- Voice playback recovery still lives in the large thread viewport instead of a smaller dedicated helper.
- Final voice availability still depends on attachment hydration and signed-URL resolution completing successfully server-side.

## Recommended next branch

- `feature/chat-thread-snapshot-split`
