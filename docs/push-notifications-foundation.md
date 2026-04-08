# Push Notifications Foundation

This document defines the current notification baseline in the shared CHAT + KeepCozy repo and the narrow first slice required to ship real browser push notifications for chat.

Scope for this foundation:

- keep the first implementation chat-first
- stay practical and implementation-oriented
- reuse existing unread and conversation-notification seams where possible
- avoid broad notification architecture work until the first end-to-end push slice exists

This is not a full notification product spec. It is the bridge from the current browser-readiness state to a real first push system.

## Current repo reality

The repo already has a few important pieces in place:

- [public/sw.js](/Users/danya/IOS%20-%20Apps/CHAT/public/sw.js) already installs a service worker, handles `push`, displays a notification, and routes `notificationclick` to a target URL.
- [src/modules/messaging/sdk/notifications.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/sdk/notifications.ts) already checks browser support, reads `Notification.permission`, and ensures `/sw.js` is registered when permission is granted.
- [app/(app)/settings/notification-readiness.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/settings/notification-readiness.tsx) already exposes a user-facing readiness panel and a permission request path.
- [app/manifest.ts](/Users/danya/IOS%20-%20Apps/CHAT/app/manifest.ts) already defines a standalone-capable PWA shell with icons and install metadata.
- [src/modules/messaging/data/server.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/data/server.ts) already computes unread counts from `last_read_message_seq`, `visible_from_seq`, and latest-message state.
- [docs/sql/2026-04-03-conversation-member-notification-level.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-03-conversation-member-notification-level.sql) already adds `conversation_members.notification_level`, and [src/modules/messaging/data/server.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/data/server.ts) already reads and writes that setting.
- [app/(app)/chat/[conversationId]/actions.ts](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/chat/[conversationId]/actions.ts) already has a narrow message-send mutation seam that could later trigger notification fan-out after a message commit succeeds.

This means the repo is already prepared for:

- browser permission checks
- service worker registration
- notification click routing
- per-conversation mute preferences
- unread-driven notification eligibility logic

It is not yet prepared for real end-to-end delivery.

## What already exists

### Browser and shell readiness

- Service worker registration and basic push event handling exist.
- Notification permission state is surfaced in product UI.
- The PWA shell already has icons and standalone metadata.

### Chat-state inputs that a push system can reuse

- Per-conversation unread counts already exist.
- Per-conversation mute state already exists as `notification_level`.
- Authenticated user resolution already exists through the request-context helpers and server Supabase clients.
- Notification click routing can already focus an open client or open a new one.

### Existing seams worth preserving

- `conversation_members.notification_level` should remain the first mute gate.
- Unread logic should continue to derive from committed read state, not from optimistic client guesses.
- Push routing should stay URL-driven, the same way the service worker already navigates on click.

## What is missing for real push notifications

### 1. Push subscription creation

The repo does not yet create a real `PushSubscription`.

Missing pieces:

- no `PushManager.subscribe(...)` flow
- no VAPID public key configuration
- no client serialization of `endpoint`, `p256dh`, and `auth`
- no resubscribe/refresh logic when a subscription expires or rotates

### 2. Subscription persistence

The repo does not yet persist subscriptions per authenticated user and browser/device.

Missing pieces:

- no `push_subscriptions` table or equivalent persistence layer
- no authenticated upsert/remove route for subscriptions
- no disable/cleanup path for expired endpoints
- no distinction between web-push subscriptions and unrelated messaging device concepts

Important boundary:

- the DM E2EE device path in [app/api/messaging/dm-e2ee/device/route.ts](/Users/danya/IOS%20-%20Apps/CHAT/app/api/messaging/dm-e2ee/device/route.ts) is not the push-device model and should not be reused for web push

### 3. Server-side send path

The repo does not yet have a server-side notification fan-out path after a new chat message is committed.

Missing pieces:

- no send helper that takes committed message data and emits a web push
- no target resolution across other active conversation members
- no filtering by `notification_level`
- no filtering by sender versus recipient
- no endpoint cleanup for `404` / `410` push responses
- no durable retry or dead-letter handling

### 4. Notification payload shaping

The service worker can display a notification, but the server does not yet shape real chat payloads.

Missing pieces:

- no payload contract for `title`, `body`, `url`, `conversationId`, `spaceId`, `messageId`
- no chat-safe preview policy for encrypted DMs versus plaintext chats
- no consistent click target into `/chat/[conversationId]?space=...`

### 5. User-level notification enablement beyond browser permission

The app currently treats notifications as “ready” once permission is granted and the service worker is available.

Missing pieces:

- no persisted user-level push-enabled state
- no separation between browser permission granted and app subscription active
- no subscription health status shown in settings

## What is missing for badge/count support

### 1. Badge API integration

The repo does not currently use the App Badging API.

Missing pieces:

- no `setAppBadge` / `clearAppBadge` capability detection
- no badge update logic on app load, unread changes, or read events
- no fallback strategy when badging is unsupported

### 2. Aggregate unread source of truth

Unread counts already exist per conversation, but there is no explicit device-level unread badge strategy.

The first badge source of truth should be:

- sum of unread counts across the current user’s active chat memberships
- optionally excluding conversations with `notification_level = 'muted'`
- derived from committed read state, not optimistic local state

### 3. Badge lifecycle rules

Missing pieces:

- no badge refresh on inbox/activity load
- no badge clear on zero unread
- no badge update after `markConversationRead(...)`
- no badge update after logout or account switch
- no push-receipt badge increment strategy

## Minimum first implementation slice

The first shippable slice should be narrow and chat-first.

### Slice goal

Ship browser push for new chat messages with reliable click routing and an unread-driven badge count.

### Required components

#### 1. Push subscription bootstrap

Add a chat notification client helper that:

- checks readiness from the existing notification SDK
- requests permission if needed
- waits for the service worker registration
- calls `registration.pushManager.subscribe(...)`
- serializes the subscription into a stable payload

#### 2. Subscription persistence

Add a minimal persistence layer for web push subscriptions.

Recommended first contract:

- `id`
- `user_id`
- `endpoint`
- `p256dh`
- `auth`
- `created_at`
- `updated_at`
- `disabled_at`
- optional lightweight client metadata such as `user_agent` or `platform`

Recommended first rules:

- one user may have multiple subscriptions
- uniqueness should be endpoint-based
- disabled or expired endpoints should be retained long enough to audit cleanup, not hard-deleted immediately on every failure

#### 3. Authenticated subscription routes

Add narrow authenticated routes or actions for:

- upsert current browser subscription
- remove current browser subscription
- refresh current browser subscription

These should use the same authenticated request viewer seam already used by chat actions.

#### 4. Server-side chat send hook

Add the first notification fan-out immediately after a message commit succeeds.

Best first seam:

- after the committed send path in [app/(app)/chat/[conversationId]/actions.ts](/Users/danya/IOS%20-%20Apps/CHAT/app/(app)/chat/[conversationId]/actions.ts)
- or one layer lower around the committed send helper if that keeps fan-out tied more closely to committed message state

First target rules:

- only notify other active members of the conversation
- skip the sender
- skip muted memberships
- start with direct messages and ordinary group chat messages
- keep eligibility chat-first, not KeepCozy-event-first

#### 5. Notification payload contract

The first payload should include:

- `title`
- `body`
- `url`
- `conversationId`
- `spaceId`
- `messageId`

First routing target:

- `/chat/[conversationId]?space=<spaceId>`

This keeps the current service worker click flow and shared space context intact.

#### 6. Unread-driven badge strategy

The first badge slice should:

- derive one aggregate unread count from server-truth chat summaries
- set the badge when the count is greater than zero
- clear the badge when the count is zero
- refresh on app load, inbox/activity load, and read-state-changing chat actions

Keep this badge account-level and chat-level first. Do not split the badge by product surface or by space profile yet.

## Chat-first versus deferred

### Chat-first in the first slice

These belong in the first implementation:

- new message pushes for DM and group chat
- subscription creation and persistence
- sender-excluded recipient targeting
- per-conversation mute respect
- notification click routing into the exact chat
- unread-driven badge count from chat unread state

### Defer for later

These should wait until the first slice is proven:

- KeepCozy task/issue/home notifications
- mention-specific or reaction-specific push fan-out
- notification digests or batching
- rich notification actions
- media thumbnails in push payloads
- per-space notification centers
- push delivery for future operational domains outside chat

## Recommended implementation order

1. Add `push_subscriptions` persistence and authenticated upsert/remove endpoints.
2. Extend the browser notification SDK with real `PushManager` subscription support.
3. Add a settings-level “enabled and subscribed” path on top of the current readiness panel.
4. Add server-side chat notification fan-out after committed message send.
5. Add unread-driven app-icon badge calculation and refresh hooks.
6. Add endpoint cleanup for expired subscriptions and basic delivery diagnostics.

## First-slice guardrails

- Do not turn the first slice into a general notification platform.
- Do not reuse DM E2EE device records for web push subscriptions.
- Do not couple badge counts to optimistic client state.
- Do not broaden the first slice into KeepCozy domain events yet.
- Do not ship push delivery without respecting `conversation_members.notification_level`.

## Definition of done for the first implementation branch

The first implementation branch should make these things true:

- a signed-in chat user can subscribe this browser for push
- the subscription is persisted server-side
- a newly committed chat message can trigger a server-side push to other eligible members
- clicking the notification opens the correct chat in the correct space
- the app icon badge reflects aggregate unread chat count on supported browsers

When those are working, the repo will have a real push-notification foundation instead of only browser-readiness scaffolding.
