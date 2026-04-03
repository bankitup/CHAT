# Voice Message Foundation

This note describes the current foundation for voice messages in CHAT. It is intentionally scoped to message architecture and honest UI support, not a finished recording feature.

## Implemented now

- Audio files can fit into the existing message attachment path.
- Message records can now distinguish between:
  - `text`
  - `voice`
- The existing file/image attachment flow stays on current `text` message semantics for now.
- Voice messages still use the existing `public.message_attachments` table and Supabase Storage bucket.
- Audio attachments stored under a `/voice/` object-path segment are treated as voice messages in the UI.
- The chat thread can render supported audio attachments with native audio playback controls.

## Storage and model assumptions

- Voice messages stay in the current attachment bucket.
- Storage paths now separate attachment categories:
  - regular files/images: `.../files/...`
  - voice messages: `.../voice/...`
- `public.messages.kind = 'voice'` is the message-level cue for a voice message.
- `public.message_attachments.mime_type` remains the attachment-level source of truth for actual audio format.

## Intentionally not implemented yet

- No in-app recording UI
- No microphone permission flow
- No waveform generation
- No duration metadata
- No scrubber polish beyond native audio controls
- No transcription
- No call architecture

## Required schema change

If the live database restricts `public.messages.kind`, it must allow `voice`.

Migration file:

- [2026-04-03-messages-kind-voice.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-03-messages-kind-voice.sql)

## Recommended next steps

1. Add a dedicated voice-record action in the composer with real capture/send flow.
2. Store duration metadata so the thread can show compact voice-note summaries.
3. Add playback polish such as progress UI and better audio-specific row styling.
