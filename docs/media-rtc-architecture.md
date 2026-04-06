# Media and RTC Architecture

This document defines the long-term boundary for file sending, voice messages, and future calls in CHAT.

It is intentionally architectural and incremental:

- preserve the current product runtime
- keep the inbox/activity model lightweight
- keep the thread route focused on message history and visible message state
- move binary transport and call runtime concerns into dedicated modules

## Current reality

Today, committed attachments and voice notes still pass through the message send path in [src/modules/messaging/data/server.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/data/server.ts).

That is acceptable for the current restored baseline, but it couples too many concerns:

- message row creation
- storage upload
- attachment metadata persistence
- thread/inbox invalidation concerns

The new boundary should separate those concerns before voice/files/calls grow.

## Core principle

Message metadata and binary asset transport are separate concerns.

The message thread should render message rows and committed asset metadata.
It should not own:

- upload orchestration
- binary transfer state
- call session transport
- RTC peer lifecycle

## Target boundaries

### 1. Conversation summary boundary

Inbox and activity should continue to read only conversation summary data:

- conversation id
- identity/title/avatar
- last message summary
- unread state
- lightweight call/media indicators if needed later

They must not depend on:

- full message history loading
- `message_assets` scans
- upload job state
- RTC session event streams

### 2. Thread history boundary

The thread route should own:

- visible message window
- cursor-based older history loading
- message/reaction/read-state rendering
- already-committed attachment metadata
- already-committed voice-message metadata

The thread route should not own:

- file upload jobs
- recording state machines
- call signaling sessions

### 3. Media asset boundary

Media should have its own module contract for:

- logical asset identity
- storage location
- mime/size/duration metadata
- upload job lifecycle
- commit result back into message metadata

This batch introduces the forward schema/model foundation for that:

- [docs/sql/2026-04-06-message-assets-foundation.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-06-message-assets-foundation.sql)
- [src/modules/messaging/media/message-assets.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/media/message-assets.ts)

The intended durable split is:

- `messages`
  - sender, seq, kind, content mode, reply linkage, visible summary
- `message_assets`
  - committed binary identity, mime type, size, duration, storage path
- `message_asset_links`
  - which committed assets belong to which message

### 4. Voice-message boundary

Voice messages are a specialized media flow, not a special chat-route mode.

Recommended lifecycle:

1. local draft / capture
2. encoding / blob preparation
3. upload job execution
4. committed asset metadata
5. committed message row referencing that asset
6. thread playback state handled locally in a voice-ui/runtime layer

That keeps voice transport and playback evolution out of inbox summary and out of route-level refresh logic.

### 5. RTC / call boundary

Future calls must live in a dedicated RTC boundary.

Supabase may be used for:

- auth
- presence
- call session metadata
- signaling event persistence / fanout

Supabase must not be the actual media transport for calls.

Actual live audio/video transport should remain WebRTC-based, with:

- peer-to-peer for the smallest cases, or
- an SFU/media backend when scale requires it

The chat thread may later render call summary messages, but it should never become the runtime transport path for live calls.

## Recommended runtime shape

### Media upload pipeline

Client runtime:

- create local upload job
- track progress and retries
- upload asset bytes
- commit server-side asset metadata
- commit or patch message metadata

Server/runtime boundary:

- authorize upload intent
- validate asset metadata
- persist message-visible media metadata
- update conversation summary projection

### Message and asset separation

Use this mental split even if the current physical runtime still writes to `message_attachments`:

- `messages`
  - sender, seq, kind, content mode, reply linkage, visible summary
- `message_assets`
  - committed binary identity, mime type, size, duration, storage path
- `message_asset_links`
  - which committed assets belong to which message

That keeps future voice/files extensible without teaching inbox/thread loaders to understand upload internals.

### Voice-message runtime

Voice should add three sub-boundaries:

- capture boundary
  - permissions, recording, cancellation
- upload boundary
  - blob transfer, retries, job state
- playback boundary
  - duration/progress/waveform/play state

Only the final committed metadata belongs in the durable message history path.

### Call runtime

Call runtime should split into:

- call session records
- participant records
- signaling events
- RTC transport runtime

The thread route may launch or resume a call surface, but it should not subscribe to the full signaling stream as part of normal history rendering.

## Local module layout

This scaffolding keeps two top-level messaging boundaries:

- `src/modules/messaging/media`
- `src/modules/messaging/rtc`

Current media scaffolding entrypoints:

- `src/modules/messaging/media/message-assets.ts`
- `src/modules/messaging/media/message-metadata.ts`
- `src/modules/messaging/media/upload-jobs.ts`
- `src/modules/messaging/media/voice.ts`

Use them for all future work in these areas before adding feature logic to:

- `app/(app)/chat/[conversationId]/page.tsx`
- `src/modules/messaging/data/server.ts`
- inbox/activity summary loaders

## Integration guidance

### For future file and voice sending

- composer UI creates or resumes a media upload job
- upload runtime publishes narrow job state to local stores
- message commit returns a narrow mutation result
- thread patches only the affected message / media row
- inbox summary updates from committed message metadata only

### For future calls

- call launcher uses RTC session boundary
- call UI mounts a dedicated call surface
- thread receives at most lightweight call summary effects
- inbox/activity may show “active call” or “missed call” summary states from call-session projection, not from raw signaling replay

## Migration path from current code

The current code can evolve in this order:

1. Keep current attachment sending behavior working.
2. Introduce `message_assets` / `message_asset_links` as the committed media model.
3. Move file/voice transport orchestration out of generic message server helpers.
4. Switch thread rendering from `message_attachments` reads to committed asset reads.
5. Add RTC signaling/session metadata without putting transport into chat history.

## Non-goals of this scaffolding

- No call implementation yet
- No recording UI yet
- No upload-job UI yet
- No media E2EE yet
- No inbox redesign

The goal is to make future work land in stable boundaries, not to ship the features in this pass.
