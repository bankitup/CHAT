# Voice Mobile Playback Proof

## Scope

This is a proof-pass for the current voice runtime. It does not change capture policy, delivery routes, storage shape, or playback UX.

Relevant code paths:

- `app/(app)/chat/[conversationId]/use-composer-voice-draft.ts`
- `app/(app)/chat/[conversationId]/thread-voice-message-bubble.tsx`
- `app/(app)/chat/[conversationId]/voice-playback-source.ts`
- `app/api/messaging/conversations/[conversationId]/messages/[messageId]/attachments/[attachmentId]/content/route.ts`
- `app/api/messaging/conversations/[conversationId]/messages/[messageId]/attachments/[attachmentId]/signed-url/route.ts`
- `src/modules/messaging/data/server.ts`
- `src/modules/messaging/media/message-assets.ts`

## Current Capture Order

The current recorder MIME preference order in `use-composer-voice-draft.ts` is:

1. `audio/webm;codecs=opus`
2. `audio/webm`
3. `audio/mp4`
4. `audio/ogg;codecs=opus`

That means the current implementation will prefer WebM/Opus whenever the browser reports support.

## What Is Logged Now

With `NEXT_PUBLIC_CHAT_DEBUG_VOICE=1`, the runtime now logs proof data for:

- recorded MIME type and draft file extension from the composer
- stored MIME type and persisted file extension from the server write seam
- playback source kind: `transport` vs `blob`
- resolved blob MIME type when a transport URL is warmed locally
- audio element `currentSrc`
- `audio.error.code`
- `audio.networkState`
- `audio.readyState`
- `audio.canPlayType(...)` result for the resolved stored MIME type when available

Main log families:

- `[voice-composer]`
- `[voice-send]`
- `[voice-proof]`
- `[voice-thread]`

## Proof Interpretation

### Codec or container incompatibility

This is the leading hypothesis from the current repo shape.

It is strongly suggested when the logs show:

- `[voice-composer] draft:finalized` with `mimeType` or `blobMimeType` as WebM/Opus-like
- `[voice-send] send:start` and `message-assets-insert:started` with stored voice metadata present
- `[voice-proof] voice-source-prepared` succeeds
- `[voice-proof] audio-element-ready` or `voice-audio-play-requested` shows:
  - `storedMimeType` like `audio/webm`
  - `canPlayType: "no"` or empty-equivalent
- `[voice-proof] voice-audio-element-error` or `voice-audio-play-rejected` follows

If that sequence appears on mobile while desktop succeeds, the earliest real failure is the browser decoder/playability boundary, not storage or auth.

### Transport or auth delivery failure

This is indicated when the logs stop earlier:

- `[voice-proof] voice-source-resolver-entered`
- then either no `voice-source-prepared`, or
- `voice-source-prepared` has no playback source, or
- `[voice-thread] proof-source-prepare-failed`

If the warmed blob MIME never appears and the source resolver fails first, the failure is before the audio decoder and should be treated as delivery/auth/runtime fetch failure.

### Audio element lifecycle or runtime state failure

This is indicated when:

- `voice-source-prepared` succeeds
- `canPlayType` looks playable
- but the audio element never reaches `audio-element-ready`, or
- `voice-owner-requested` / `voice-audio-play-requested` never progress cleanly

That points to client runtime gating, owner state, or element lifecycle instead of codec support.

## Likely Root Cause

Inference from the current code:

- capture prefers WebM/Opus before MP4
- mobile failure affects at least some messages, while desktop works
- delivery routes already support authenticated content resolution and warmed blob playback

So codec/container incompatibility is the most likely primary cause until the new logs prove otherwise.

## Next Narrow Step After Proof

Once mobile logs confirm the failing stage:

- If `canPlayType` rejects WebM-like MIME on mobile, the next step is a capture compatibility fix, not a transport rewrite.
- If source preparation fails before playability is checked, the next step is transport/content-route debugging.
- If playability looks fine but playback still stalls, the next step is hidden-audio lifecycle/runtime debugging in `thread-voice-message-bubble.tsx`.
