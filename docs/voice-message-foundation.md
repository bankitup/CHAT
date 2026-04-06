# Voice Message Foundation

This document defines the durable MVP foundation for voice messages in CHAT.

It is intentionally scoped to architecture and minimal scaffolding:

- preserve the newly restored chat runtime
- keep inbox/activity summary-only
- keep thread history focused on committed message metadata
- keep binary upload transport separate from message rows
- keep future live calls in the dedicated RTC boundary

Related boundary documents:

- [media-rtc-architecture.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/media-rtc-architecture.md)
- [docs/sql/2026-04-06-message-assets-foundation.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-06-message-assets-foundation.sql)
- [src/modules/messaging/media/README.md](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/media/README.md)
- [src/modules/messaging/media/message-assets.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/media/message-assets.ts)
- [src/modules/messaging/rtc/README.md](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/rtc/README.md)

## Current stable runtime

The current production-safe baseline already gives us the right top-level shape:

- `public.messages.kind` can distinguish `text`, `attachment`, and `voice`
- thread history loads:
  - message rows
  - attachment metadata
  - reactions
  - DM E2EE envelope metadata
- inbox/activity read conversation summary projection only
- audio attachments render on demand inside the thread only

Current attachment sending still couples:

- message insert
- storage upload
- attachment metadata insert
- summary projection update

That remains acceptable for the restored baseline, but this batch introduces the
forward schema/model landing zone so future voice work does not keep growing
through `message_attachments`.

## Core product rule

A voice message is a normal message row with media metadata.

That means:

- the message row remains the durable history entity
- the binary recording/upload is a separate runtime concern
- committed voice metadata is linked to the message
- inbox/activity never need the media blob to render list previews

## MVP foundation shape

### Message row

Voice messages should continue to use a normal `messages` row:

- `kind = 'voice'`
- `content_mode = 'plaintext'` for the first foundation batch
- `body = null` unless a later product decision adds captions/transcripts
- `reply_to_message_id` works the same as other messages

### Committed media metadata

This batch introduces the durable committed media model:

- `public.message_assets`
- `public.message_asset_links`
- Supabase Storage object for the binary payload

The important boundary is now explicit:

- thread renders committed asset metadata
- upload jobs stay outside durable history
- inbox/activity never inspect asset rows or blobs to build previews
- calls remain outside this model entirely

### Upload lifecycle

Voice sending should eventually follow this narrow lifecycle:

1. local recording draft
2. local encoding / blob preparation
3. upload job creation
4. storage upload
5. asset metadata commit
6. message create/finalize
7. local thread patch and inbox summary patch

Only steps 5-7 belong to durable message history.

## Thread runtime contract

The thread should eventually care about two separate kinds of state:

### Durable committed state

- message row
- committed asset metadata
- message-to-asset links
- reply linkage
- reactions/read state

### Ephemeral local voice runtime state

- capture state
- upload progress
- retry/cancel state
- playback progress
- buffering / paused / playing state

Ephemeral voice runtime must not be stored inside route query params or route-level history expansion.

## Summary behavior

Inbox and activity should stay honest and lightweight.

For the first durable voice foundation:

- voice summary is derived from message summary projection
- `last_message_kind = 'voice'` is enough to render a truthful preview label
- inbox/activity should not read `message_assets`, waveform data, duration, or blobs

Later optional upgrades may add richer projection fields such as:

- `last_message_media_duration_ms`
- `last_message_media_kind`
- `last_message_media_preview_label`

Those are future additive optimizations, not requirements for the first foundation batch.

## Minimal schema / model proposal

This batch adds the forward schema proposal here:

- [docs/sql/2026-04-06-message-assets-foundation.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-06-message-assets-foundation.sql)

The intended durable model is:

- `messages`
  - durable ordering and semantics
  - `kind = 'voice'` for voice notes
- `message_assets`
  - committed binary metadata and storage identity
- `message_asset_links`
  - links committed assets to durable message rows
- local upload-job runtime
  - not part of the durable conversation history query

Minimal committed asset fields for voice are:

- `id`
- `conversation_id`
- `created_by`
- `kind = 'voice-note'`
- `source`
- `storage_bucket`
- `storage_object_path`
- `mime_type`
- `file_name`
- `size_bytes`
- `duration_ms`
- `created_at`

Minimal message linkage fields are:

- `message_id`
- `asset_id`
- `ordinal`
- `render_as_primary`
- `created_at`

The current runtime does not switch to these tables yet.
That is deliberate:

- keep restored chat sending stable
- add the durable schema/model now
- migrate runtime attachment/voice commit paths later in a controlled pass

## Voice vs files

Voice messages and file attachments should share the same transport philosophy:

- upload bytes through the media boundary
- commit narrow metadata
- patch thread locally
- update inbox summary from message-level projection only

The difference is product semantics:

- file/image messages may remain `kind = 'attachment'`
- voice notes remain `kind = 'voice'`

That distinction keeps inbox preview, thread rendering, and future search/filtering honest.

## Voice vs calls

Voice messages are not call runtime.

Keep these separate:

- voice message:
  - recorded asset
  - uploaded and committed
  - replayed asynchronously in thread history
- call:
  - live RTC transport
  - dedicated session/signaling state
  - not part of normal thread history loading

Supabase may support auth, storage metadata, and signaling state.
It should not become live call media transport.

## Existing code boundaries to preserve

The current safe evolution path is:

- leave inbox/activity on summary projection
- leave thread history on committed row snapshots
- move future recording/upload runtime into `src/modules/messaging/media`
- treat `message_assets` + `message_asset_links` as the committed media layer
- keep future call runtime in `src/modules/messaging/rtc`

Do not overload:

- [app/(app)/chat/[conversationId]/page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/%28app%29/chat/%5BconversationId%5D/page.tsx)
- [src/modules/messaging/data/server.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/data/server.ts)

with long-lived media orchestration state.

## What this batch intentionally does not implement

- no recording UI
- no microphone permission flow
- no waveform rendering
- no duration chips in thread/inbox
- no media E2EE
- no upload-job UI
- no RTC/call implementation

The goal is a clean landing zone for future work, not a rushed end-to-end feature.
