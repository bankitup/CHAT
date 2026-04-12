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

Follow-up architecture contract:

- [voice-derived-playback-contract.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/voice-derived-playback-contract.md)
- [voice-cross-device-manual-matrix.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/voice-cross-device-manual-matrix.md)

## Current Capture Policy

The recorder MIME preference in `use-composer-voice-draft.ts` is now
platform-aware:

- WebKit-mobile environments prefer:
  1. `audio/mp4`
  2. `audio/webm;codecs=opus`
  3. `audio/webm`
  4. `audio/ogg;codecs=opus`
- other environments keep the Chromium-friendly order:
  1. `audio/webm;codecs=opus`
  2. `audio/webm`
  3. `audio/mp4`
  4. `audio/ogg;codecs=opus`

That means Apple/WebKit-style recording no longer blindly prefers WebM first
when MP4 is available, while Chromium-like browsers keep the current WebM-first
path.

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

- capture used to prefer WebM/Opus before MP4 everywhere
- mobile failure affects at least some messages, while desktop works
- delivery routes already support authenticated content resolution and warmed blob playback

The current repo also had one more risky behavior in the playback path:

- `voice-playback-source.ts` preferred warmed local `blob:` playback URLs when one
  was available
- on WebKit-mobile environments, WebM/Opus-like voice payloads can be more
  failure-prone through that blob/object-URL path than through direct transport
  playback

That means the mobile failure was not just "cache confusion". The warmed
blob/object-URL path itself was part of the likely failure surface for risky
platform/media combinations.

So codec/container incompatibility is the most likely primary cause until the new logs prove otherwise.

## Current Hotfix

The current runtime now bypasses blob warming for risky combinations:

- WebKit-mobile environment
- WebM/Opus-like committed voice payload

For that path, the player now prefers direct transport playback first instead
of defaulting to a warmed `blob:` URL. Desktop and other non-risky browser/media
combinations still keep the existing warmed playback path.

The current capture path now also reduces future risky uploads by preferring
`audio/mp4` first on WebKit-mobile environments when the recorder reports that
format as supported.

The current playback controller also now treats a newly claimed owner as
`starting` until playback actually settles. That reduces a mobile-specific race
where transient pause events during source assignment or `load()` could tear
down ownership before the audio element reached a stable playing state.

The next runtime pass also moved the local playback state machine out of
`thread-voice-message-bubble.tsx` and into
`use-thread-voice-playback-runtime.ts`. The bubble is now mainly responsible
for rendering and gesture composition, while the hook owns source preparation,
play intent, one-at-a-time ownership coordination, audio lifecycle events, and
cleanup.

That lifecycle seam now also has lightweight regression coverage in
[voice-playback-controller.test.ts](/Users/danya/IOS%20-%20Apps/CHAT/tests/e2ee/voice-playback-controller.test.ts),
so ownership logic is less likely to drift back into the bubble runtime.

The thread viewport also no longer treats every recent voice row with a missing
attachment `signedUrl` as a thread-level recovery case. If a voice row already
has a local playback path through variant transport metadata or a committed
recoverable locator, the viewport now leaves it alone instead of dispatching a
by-id history sync that can make unrelated attachments appear to refresh.

The current regression bar also treats scroll stability as part of voice
runtime correctness:

- voice play/pause/progress should stay local to the active voice row
- starting playback should not cause a visible thread jump on mobile
- scroll/viewport coordination should stay in thread viewport seams, not drift
  back into local voice runtime files

Manual verification for that path lives in
[conversation-runtime-manual-matrix.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/conversation-runtime-manual-matrix.md).

## Next Narrow Step After Proof

Once mobile logs confirm the failing stage:

- If `canPlayType` rejects WebM-like MIME on mobile, the next step is a capture compatibility fix, not a transport rewrite.
- If source preparation fails before playability is checked, the next step is transport/content-route debugging.
- If playability looks fine but playback still stalls, the next step is hidden-audio lifecycle/runtime debugging in `thread-voice-message-bubble.tsx`.
- If playback still flickers between play and pause on mobile after source
  selection succeeds, inspect the proof logs around
  `audio-pause-ignored-during-start` before widening the fix.

## Current Runtime Guard

The voice bubble now resolves a device-aware playability verdict before treating a committed voice attachment as normally playable.

- If the browser reports the MIME/container as unsupported, the bubble moves to an explicit unavailable state.
- Unsupported voice formats no longer masquerade as generic loading or buffering.
- This is still a proof-friendly guard, not transcoding and not a capture-policy change.

## Architecture Outcome

This proof does not point at a cache-reset solution.

It points at a committed-media architecture solution:

- preserve the original capture asset
- allow a normalized derived playback asset when needed
- let the playback resolver choose the best playable committed source for the
  current device

That target contract is defined in
[voice-derived-playback-contract.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/voice-derived-playback-contract.md).
