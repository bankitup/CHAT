# Voice Cross-Device Manual Matrix

## Purpose

This document is the manual verification companion for the current voice
stability work.

Use it to verify:

- source selection still works when only the original asset exists
- unsupported-device handling stays explicit and honest
- desktop/mobile playback failures are classified as codec/playability vs
  transport/runtime
- risky mobile playback paths prefer direct transport over warmed `blob:` URLs
  when the current hotfix says they should

Related documents:

- [voice-mobile-playback-proof.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/voice-mobile-playback-proof.md)
- [voice-derived-playback-contract.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/voice-derived-playback-contract.md)
- [manual-test-matrix.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/stability/manual-test-matrix.md)

## Preconditions

- Use a build that includes the current voice proof logging and
  source-selection foundation.
- Enable `NEXT_PUBLIC_CHAT_DEBUG_VOICE=1` when practical.
- Use one known test conversation and at least two real devices when possible.
- Record the exact recording device/browser and playback device/browser for each
  run.

## Evidence To Capture

For every matrix row, capture:

- recording device and browser
- playback device and browser
- stored MIME type
- file extension
- chosen playback source origin: `original` or `derived`
- chosen playback source kind: `transport` or `blob`
- `canPlayType`
- `supportStatus`
- final user-visible result: plays, explicit unsupported, explicit failure

Main proof logs to grep:

- `[voice-composer]`
- `[voice-send]`
- `[voice-proof] source-snapshot-resolved`
- `[voice-proof] voice-device-playability-resolved`
- `[voice-proof] voice-source-prepared`
- `[voice-proof] voice-audio-play-requested`
- `[voice-proof] voice-audio-play-fulfilled`
- `[voice-proof] voice-audio-play-rejected`
- `[voice-proof] voice-audio-element-error`

## Cross-Device Matrix

| Capture path | Playback path | Expected result | What to watch closely |
| --- | --- | --- | --- |
| Desktop Chrome record | Desktop Chrome play | Must play successfully. This is the baseline “same environment” control. | Confirm original source still works when no derived variant exists. |
| Desktop Chrome record | iPhone Safari play | Must either play successfully or land in explicit unsupported state. It must not look like endless loading. | Watch for `audio/webm` or WebM/Opus-like MIME with `canPlayType: "no"` and unsupported state. |
| iPhone Safari record | Desktop Chrome play | Must either play successfully or fail explicitly. | Compare stored MIME/extension against what Safari captured. Confirm source resolver does not regress to missing-source behavior. |
| iPhone Safari record | iPhone Safari play | Must play successfully. This is the mobile same-environment control. | Confirm mobile record/mobile replay keeps current UX and does not enter false unsupported state. |
| Android Chrome record | Android Chrome play | If Android path is available in the current test surface, it should behave like a same-environment control. | Capture stored MIME and whether playback uses original source only. |
| Android Chrome record | iPhone Safari play | If Android path is available, result must be truthful: plays or explicit unsupported. | Good case for catching Android-recorded WebM/Opus playback incompatibility on Safari. |

## Per-Scenario Steps

For each matrix row:

1. Record a short voice note with a recognizable spoken label.
2. Send it once.
3. Confirm the message commits once in thread history.
4. Open the same message on the playback device.
5. Tap play once.
6. If it plays, also verify pause, resume, and replay.
7. If it does not play, verify the bubble lands in explicit unsupported or failed
   state, not generic loading.

## Minimum Release Subset

Before shipping voice changes, run at least these three rows:

- desktop Chrome record -> iPhone Safari play
- iPhone Safari record -> desktop Chrome play
- iPhone Safari record -> iPhone Safari play

If Android Chrome is part of the active QA device pool, add Android Chrome
record/play as a fourth row.

## Expected Truth Rules

- If the device can likely decode the format, the bubble should move to normal
  ready/play/pause behavior.
- If the device cannot likely decode the format, the bubble should move to the
  explicit unsupported path.
- If transport fails before playability is evaluated, the logs should stop at
  source preparation rather than pretending the problem is codec support.
- When only one source exists, source selection should still choose that
  original source cleanly.
- On risky WebKit-mobile plus WebM/Opus-like cases, the chosen playback source
  kind should prefer `transport` over warmed `blob` playback.

## Failure Signatures

Treat these as separate categories:

- Decoder/playability failure:
  `voice-source-prepared` exists, `canPlayType` is negative or empty-like, and
  playback rejects or the audio element errors.
- Transport/source failure:
  `voice-source-resolver-entered` exists but `voice-source-prepared` does not
  produce a usable playback source.
- Runtime/element failure:
  source preparation succeeds and playability looks positive, but playback does
  not enter a stable playing or paused state.

## Current Non-Goals

This matrix does not assume:

- a transcoding worker already exists
- a normalized playback variant already exists for every message
- a new UI settings surface
- backfill of older voice assets
