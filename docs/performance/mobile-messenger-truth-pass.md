# Mobile Messenger Truth Pass

## Scope

This is a repo-specific baseline for current mobile Messenger performance on:

- `/chat/[conversationId]`
- `/inbox`
- the shared authenticated app shell

This pass is intentionally analysis-only.
It does not propose a route redesign in this branch.

Field direction already observed:

- TTFB is good enough
- INP is acceptable
- the main mobile problems are FCP, LCP, and CLS

That means the current problem is primarily client weight, hydration depth, and layout stability.

## How This Pass Was Measured

Primary build command:

```bash
npx next build --turbo --experimental-analyze
```

Artifacts inspected:

- `.next/diagnostics/route-bundle-stats.json`
- `.next/static/chunks/**`

Repo paths inspected directly:

- `/Users/danya/IOS - Apps/CHAT/app/(app)/app-shell-frame.tsx`
- `/Users/danya/IOS - Apps/CHAT/app/(app)/chat/[conversationId]/page.tsx`
- `/Users/danya/IOS - Apps/CHAT/app/(app)/chat/[conversationId]/thread-page-content.tsx`
- `/Users/danya/IOS - Apps/CHAT/app/(app)/chat/[conversationId]/thread-history-viewport.tsx`
- `/Users/danya/IOS - Apps/CHAT/app/(app)/chat/[conversationId]/thread-voice-message-bubble.tsx`
- `/Users/danya/IOS - Apps/CHAT/app/(app)/chat/[conversationId]/thread-composer-runtime.tsx`
- `/Users/danya/IOS - Apps/CHAT/app/(app)/chat/[conversationId]/encrypted-dm-composer-form.tsx`
- `/Users/danya/IOS - Apps/CHAT/app/(app)/inbox/page.tsx`
- `/Users/danya/IOS - Apps/CHAT/app/(app)/inbox/inbox-filterable-content.tsx`
- `/Users/danya/IOS - Apps/CHAT/src/modules/i18n/index.ts`
- `/Users/danya/IOS - Apps/CHAT/src/modules/messaging/realtime/active-chat-sync.tsx`
- `/Users/danya/IOS - Apps/CHAT/src/modules/messaging/realtime/inbox-sync.tsx`
- `/Users/danya/IOS - Apps/CHAT/src/modules/messaging/e2ee/local-state-boundary.tsx`
- `/Users/danya/IOS - Apps/CHAT/src/modules/messaging/push/chat-unread-badge-sync.tsx`
- `/Users/danya/IOS - Apps/CHAT/src/modules/messaging/push/presence-sync.tsx`

Important note on units:

- the route sizes below are uncompressed first-load JS from Next diagnostics
- they are useful for relative route comparison, not network-transfer prediction

## Measured Route Baseline

| Surface | First-load JS |
| --- | ---: |
| `/chat/[conversationId]` | 1,199,496 bytes |
| `/inbox` | 972,715 bytes |
| `/issues` | 685,608 bytes |

`/issues` is a useful proxy baseline for shared authenticated shell tax because it rides the same platform shell without paying the full Messenger runtime.

## Weight Map

Derived from the current analyzer output:

| Layer | Bytes | Meaning |
| --- | ---: | --- |
| Shared authenticated shell baseline | 685,608 | Common tax already paid by authenticated app routes |
| Messenger-common layer above shell | 225,220 | JS shared by `/chat/[conversationId]` and `/inbox` on top of shell |
| Chat-only layer | 288,668 | Incremental cost unique to thread route |
| Inbox-only layer | 61,887 | Incremental cost unique to inbox route |

Interpretation:

- mobile Messenger is not only a chat-route problem
- the authenticated shell is already heavy before route-specific work begins
- after that shell cost, chat still adds a large route-only runtime
- inbox is materially lighter than chat, but still inherits a large Messenger-common layer

## Largest Bundle Hotspots

### Shared authenticated shell tax

Most likely contributors from current source shape:

- `/Users/danya/IOS - Apps/CHAT/app/(app)/app-shell-frame.tsx`
  - client shell for all authenticated routes
  - directly mounts:
    - `DmE2eeAuthenticatedBoundary`
    - `ChatUnreadBadgeSync`
    - `PushSubscriptionPresenceSync`
    - `WarmNavRouteObserver`
  - also pulls translations through `getTranslations(...)`
- `/Users/danya/IOS - Apps/CHAT/src/modules/i18n/index.ts`
  - `3,083` lines
  - `162,217` bytes source
  - imported directly into many client components
- `/Users/danya/IOS - Apps/CHAT/src/modules/messaging/e2ee/local-state-boundary.tsx`
  - always-on device/bootstrap boundary for authenticated shell
  - focus and visibility listeners
  - delayed retry bootstrap
- `/Users/danya/IOS - Apps/CHAT/src/modules/messaging/push/chat-unread-badge-sync.tsx`
  - immediate fetch on mount
  - focus and visibility listeners
  - `60s` polling interval
- `/Users/danya/IOS - Apps/CHAT/src/modules/messaging/push/presence-sync.tsx`
  - route-aware presence sync
  - focus, visibility, and pagehide listeners
  - `25s` heartbeat interval

Why this matters:

- mobile Messenger currently pays a large amount of client startup tax before thread or inbox specifics begin
- this shell tax directly hurts FCP/LCP on low-end devices even when TTFB is good

### Messenger-common tax shared by chat and inbox

Current evidence points to a substantial Messenger-wide client layer above the authenticated shell:

- realtime subscriptions and local stores
- warm-nav probes/observers
- Messenger route composition and translation lookups
- shared identity, preview, and live-summary shaping

This layer is not yet small enough to treat `/inbox` as a cheap lightweight route.

### `/chat/[conversationId]` route-specific tax

Current route-only chunk split:

- `.next/static/chunks/0b-drlh93_xpy.js` — `232,322` bytes
- `.next/static/chunks/1309_k67bsisz.js` — `49,567` bytes
- `.next/static/chunks/0sxvw.0d4okx_.js` — `6,779` bytes

Most likely source owners:

- `/Users/danya/IOS - Apps/CHAT/app/(app)/chat/[conversationId]/thread-history-viewport.tsx`
  - `5,485` lines
  - `169,052` bytes source
  - currently mixes:
    - message row rendering
    - optimistic history
    - reaction state and menus
    - progressive history behavior
    - encrypted/plaintext row cases
    - voice row integration
    - live patching and read-state behavior
- `/Users/danya/IOS - Apps/CHAT/app/(app)/chat/[conversationId]/thread-voice-message-bubble.tsx`
  - `2,303` lines
  - `74,015` bytes source
- `/Users/danya/IOS - Apps/CHAT/app/(app)/chat/[conversationId]/encrypted-dm-composer-form.tsx`
  - `2,024` lines
  - `76,812` bytes source
- `/Users/danya/IOS - Apps/CHAT/app/(app)/chat/[conversationId]/thread-composer-runtime.tsx`
  - statically imports `EncryptedDmComposerForm`
  - statically imports `PlaintextChatComposerForm`
  - statically mounts `JumpToLatestButton` and `TypingIndicator`
- `/Users/danya/IOS - Apps/CHAT/app/(app)/chat/[conversationId]/thread-page-content.tsx`
  - composes:
    - `ActiveChatRealtimeSync`
    - `ThreadLiveStateHydrator`
    - `ComposerKeyboardOffset`
    - `ThreadHistoryViewport`
    - `ThreadComposerRuntime`
    - header/presence/avatar subtree

Bottom line:

- chat is the dominant Messenger performance problem on mobile
- the thread route currently pays for too much client runtime up front

### `/inbox` route-specific tax

Current route-only chunk split:

- `.next/static/chunks/0lvumo5e~1ruj.js` — `40,132` bytes
- `.next/static/chunks/0-it9zq37m22w.js` — `21,755` bytes

Most likely source owners:

- `/Users/danya/IOS - Apps/CHAT/app/(app)/inbox/inbox-filterable-content.tsx`
  - `1,680` lines
  - `51,093` bytes source
  - currently owns:
    - filters
    - search
    - live summary derivation
    - pull-to-refresh
    - URL sync
    - create-sheet state
    - candidate loading
- `/Users/danya/IOS - Apps/CHAT/app/(app)/inbox/inbox-conversation-live-row.tsx`
  - live row shaping
  - encrypted preview handling
  - unread and preview settlement
- `/Users/danya/IOS - Apps/CHAT/app/(app)/inbox/new-chat-sheet.tsx`
  - create DM/group modal logic

Bottom line:

- inbox is lighter than chat, but it is still a large client island for a route that should feel instant on mobile

## Manual Verification Matrix

Use these as the minimum human checks after mobile-performance changes:

| Surface | Scenario | Steps | Expected result | Evidence to capture |
| --- | --- | --- | --- | --- |
| `/chat/[conversationId]` | Mobile first load | Hard-refresh a real mobile thread route and do not interact for the first second | Header, thread body, and composer settle without obvious late layout jumps; secondary features like reactions, edit/delete, diagnostics, and voice runtime do not need to block first paint | First visual paint timing, whether the bottom nav/header shifts, whether any late overlay/runtime mounts are visible |
| `/inbox` | Mobile first load | Hard-refresh inbox on a real mobile device with several rows present | The list appears from SSR quickly, new-chat sheet code is not needed until opened, and realtime/warm-nav work does not visibly block first render | Time to first visible list, whether the create sheet opens only on demand, whether the list jumps when live sync attaches |

For the broader stability matrix, see
[manual-test-matrix.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/stability/manual-test-matrix.md).

Current lightweight regression coverage for these startup and CLS-sensitive
surfaces now also lives in:

- [mobile-messenger-performance-boundaries.test.ts](/Users/danya/IOS%20-%20Apps/CHAT/tests/e2ee/mobile-messenger-performance-boundaries.test.ts)
- [layout-stability-boundaries.test.ts](/Users/danya/IOS%20-%20Apps/CHAT/tests/e2ee/layout-stability-boundaries.test.ts)

## Likely CLS Sources

### 1. Chat header presence and status settlement

Primary files:

- `/Users/danya/IOS - Apps/CHAT/app/(app)/chat/[conversationId]/thread-page-content.tsx`
- `/Users/danya/IOS - Apps/CHAT/app/(app)/chat/[conversationId]/conversation-presence-status.tsx`

Why it is suspicious:

- DM header conditionally renders different structures:
  - title + emoji
  - status bubble
  - group member summary
  - live presence row
- `ConversationPresenceStatus` returns `null` until presence resolves, then inserts a `<p>` block
- `visibleRouteError` inserts a notice between header and thread only when present

Likely effect:

- top-of-screen content shifts after hydration or realtime presence settlement

### 2. Thread row settlement and progressive history

Primary file:

- `/Users/danya/IOS - Apps/CHAT/app/(app)/chat/[conversationId]/thread-history-viewport.tsx`

Why it is suspicious:

- one large client surface owns:
  - progressive history
  - optimistic rows
  - reaction groups/pickers
  - edit/delete states
  - encrypted fallbacks
  - media row expansion states
  - live message patching

Likely effect:

- row heights can change after hydration, optimistic replacement, live patching, or media state settlement

### 3. Voice bubble runtime settlement

Primary file:

- `/Users/danya/IOS - Apps/CHAT/app/(app)/chat/[conversationId]/thread-voice-message-bubble.tsx`

Why it is suspicious:

- the voice row still settles through multiple states:
  - pending
  - uploading
  - processing
  - ready
  - failed
  - unsupported-device
- playback diagnostics, selected source, and playability state can alter secondary UI within the bubble

Likely effect:

- voice rows can change height or visual density after state resolution

### 4. Composer-region footprint changes

Primary file:

- `/Users/danya/IOS - Apps/CHAT/app/(app)/chat/[conversationId]/thread-composer-runtime.tsx`

Why it is suspicious:

- the composer card conditionally inserts:
  - `JumpToLatestButton`
  - `TypingIndicator`
  - reply preview
  - DM fallback states
- `ComposerKeyboardOffset` also updates viewport-related layout behavior

Likely effect:

- bottom-of-screen height changes can shift visible thread content during initial settle and keyboard transitions

### 5. Inbox row preview and filter settlement

Primary files:

- `/Users/danya/IOS - Apps/CHAT/app/(app)/inbox/inbox-filterable-content.tsx`
- `/Users/danya/IOS - Apps/CHAT/app/(app)/inbox/inbox-conversation-live-row.tsx`

Why it is suspicious:

- inbox rows derive preview text, unread state, and timestamps from live summaries after hydration
- filter/search state and archived/main view changes live in the same large subtree
- route-level error notice also conditionally inserts above the list

Likely effect:

- row metadata and preview length changes can shift list density after mount

## Ranked Implementation Order

### 1. Reduce shared shell tax first

Highest leverage because it improves both `/chat/[conversationId]` and `/inbox`.

Primary targets:

- `/Users/danya/IOS - Apps/CHAT/src/modules/i18n/index.ts`
- `/Users/danya/IOS - Apps/CHAT/app/(app)/app-shell-frame.tsx`
- `/Users/danya/IOS - Apps/CHAT/src/modules/messaging/e2ee/local-state-boundary.tsx`
- `/Users/danya/IOS - Apps/CHAT/src/modules/messaging/push/chat-unread-badge-sync.tsx`
- `/Users/danya/IOS - Apps/CHAT/src/modules/messaging/push/presence-sync.tsx`

Goal:

- shrink always-on authenticated client work before touching deep route runtime

### 2. Reduce chat-only runtime next

Primary targets:

- `/Users/danya/IOS - Apps/CHAT/app/(app)/chat/[conversationId]/thread-history-viewport.tsx`
- `/Users/danya/IOS - Apps/CHAT/app/(app)/chat/[conversationId]/thread-voice-message-bubble.tsx`
- `/Users/danya/IOS - Apps/CHAT/app/(app)/chat/[conversationId]/encrypted-dm-composer-form.tsx`
- `/Users/danya/IOS - Apps/CHAT/app/(app)/chat/[conversationId]/thread-composer-runtime.tsx`

Goal:

- split route-critical first paint from heavy secondary thread runtime
- reduce the 288.7 KB chat-only layer before chasing micro-optimizations

### 3. Reduce inbox island breadth

Primary targets:

- `/Users/danya/IOS - Apps/CHAT/app/(app)/inbox/inbox-filterable-content.tsx`
- `/Users/danya/IOS - Apps/CHAT/app/(app)/inbox/inbox-conversation-live-row.tsx`
- `/Users/danya/IOS - Apps/CHAT/app/(app)/inbox/new-chat-sheet.tsx`

Goal:

- keep list hydration focused on visible rows
- move create-sheet and candidate loading out of the main list island

### 4. Stabilize CLS in header, thread rows, and composer

Primary targets:

- `/Users/danya/IOS - Apps/CHAT/app/(app)/chat/[conversationId]/thread-page-content.tsx`
- `/Users/danya/IOS - Apps/CHAT/app/(app)/chat/[conversationId]/conversation-presence-status.tsx`
- `/Users/danya/IOS - Apps/CHAT/app/(app)/chat/[conversationId]/thread-history-viewport.tsx`
- `/Users/danya/IOS - Apps/CHAT/app/(app)/chat/[conversationId]/thread-voice-message-bubble.tsx`
- `/Users/danya/IOS - Apps/CHAT/app/(app)/chat/[conversationId]/thread-composer-runtime.tsx`
- `/Users/danya/IOS - Apps/CHAT/app/(app)/inbox/inbox-filterable-content.tsx`

Goal:

- reserve space where stateful subtrees currently appear late
- reduce above-the-fold reflow after hydration and realtime settlement

### 5. Re-run analyzer and compare field metrics after each branch

Do not stack multiple deep slimming moves without re-measuring.

Minimum follow-up measurements per branch:

- route first-load JS from `.next/diagnostics/route-bundle-stats.json`
- field FCP/LCP/CLS deltas on mobile
- any new hydration or route-visible regressions

## Recommended Follow-up Branches

- `performance/01-auth-shell-tax-pass`
- `performance/02-chat-thread-runtime-slimming`
- `performance/03-inbox-client-island-slimming`
- `performance/04-mobile-cls-stabilization`

## Relationship To Existing Docs

This truth pass complements:

- `/Users/danya/IOS - Apps/CHAT/docs/chat-runtime-performance-pass.md`
- `/Users/danya/IOS - Apps/CHAT/docs/stability/chat-stability-baseline.md`
- `/Users/danya/IOS - Apps/CHAT/docs/stability/chat-critical-paths.md`

Use this document for route/client-weight decisions.
Use the stability docs for action-path reliability work.
