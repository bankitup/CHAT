# Voice Derived Playback Contract

## Purpose

This document defines the narrowest architecture for reliable cross-device voice
playback in this repository.

It preserves the current product/runtime shape:

- Messenger thread voice playback stays behind
  [app/(app)/chat/[conversationId]/voice-playback-source.ts](/Users/danya/IOS%20-%20Apps/CHAT/app/%28app%29/chat/%5BconversationId%5D/voice-playback-source.ts)
- committed voice history still uses:
  - `messages`
  - `message_assets`
  - `message_asset_links`
- the original capture asset remains preserved
- current plaintext voice keeps working during transition

This is a design contract only:

- no schema migration in this branch
- no transcoding worker in this branch
- no playback UI redesign in this branch

Related documents:

- [voice-message-foundation.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/voice-message-foundation.md)
- [voice-mobile-playback-proof.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/voice-mobile-playback-proof.md)
- [encrypted-voice-asset-contract.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/encrypted-voice-asset-contract.md)
- [src/modules/messaging/media/message-assets.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/media/message-assets.ts)
- [src/modules/messaging/data/server.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/data/server.ts)

## Current Contract

Today the repo works like this:

1. The browser records a voice draft in its selected MIME/container.
   - current policy is platform-aware:
     - WebKit-mobile prefers `audio/mp4` first when supported
     - Chromium-like environments keep the current WebM-first path
2. Send persists one committed voice asset row.
3. The committed asset stores:
   - `storage_bucket`
   - `storage_object_path`
   - `mime_type`
   - `file_name`
   - `size_bytes`
   - `duration_ms`
4. The signed-url/content route chain serves that same original asset back to the
   client.
5. The thread player resolves one transport source and then one local playable
   source URL.

That is enough for same-browser or desktop-friendly playback, but not enough for
reliable cross-device playback because the original browser-selected format is
not guaranteed to be decodable everywhere.

## Problem Statement

The proof pass in
[voice-mobile-playback-proof.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/voice-mobile-playback-proof.md)
showed that at least some failures occur after delivery succeeds and at the
device/browser decoder boundary.

So the correct fix is not:

- “clear cache”
- “retry loading forever”
- making the player guess harder in the UI

The correct fix is:

- preserve original capture truth
- allow a normalized playback asset variant
- let the source resolver choose the best committed playback source for the
  current device

## Core Decision

Every committed voice message should eventually support two media roles:

1. Original capture asset
2. Optional derived playback asset variant

The original capture asset remains the durable truth.
The derived asset exists only to improve playback compatibility.

The player should not need to know which one it received.

## Current Durable Truth

The current durable truth remains unchanged:

- `messages.kind = 'voice'`
- one committed `message_assets` voice-note row exists
- one `message_asset_links` row connects that asset to the message

That original committed asset is the “capture truth” and must remain preserved
even after playback variants exist.

## Target Contract

### Original asset

The original committed voice asset remains the canonical source-of-record for:

- who sent it
- when it was sent
- what was originally uploaded
- original MIME/container metadata
- original storage locator

The original asset is not replaced by derived playback variants.

### Derived playback variant

An optional derived asset variant may exist for playback compatibility.

The derived playback variant is:

- additive
- reversible
- not the message-history source of truth
- not a reason to discard or mutate the original asset

The variant is specifically a playback optimization and compatibility artifact.

## Where Variant Metadata Belongs

Variant metadata belongs in the committed media layer, adjacent to
`message_assets`, not in:

- `messages`
- inbox summary projection
- thread-local cache
- ad hoc frontend metadata blobs

The narrowest safe target shape for follow-up branches is a new additive table,
for example:

- `message_asset_variants`

Recommended ownership:

- one row per derived committed asset variant
- keyed to the original committed `message_assets.id`

Recommended fields:

- `id`
- `asset_id`
- `variant_role`
- `source`
- `storage_bucket`
- `storage_object_path`
- `mime_type`
- `file_name`
- `size_bytes`
- `duration_ms`
- `created_at`

Recommended first `variant_role`:

- `playback-normalized`

Why this belongs here:

- it keeps message history stable
- it keeps variant state server-authoritative
- it avoids stuffing playback fallback logic into route pages or client cache
- it scales to future encrypted voice, files, or images

## Source Selection Contract

Source selection should stay inside the existing voice playback seam, not in the
React bubble body.

Recommended selection flow:

1. Load committed voice attachment metadata from the current snapshot.
2. Resolve the original committed asset metadata.
3. Resolve any committed playback variants for that original asset.
4. Evaluate candidate sources in this order:
   - device-playable derived playback variant
   - device-playable original capture asset
   - unsupported state if neither candidate is playable
5. Hand one chosen source locator into the existing player-facing resolver.

That means the stable frontend contract remains:

- `resolveThreadVoicePlaybackSourceSnapshot(...)`
- `prepareThreadVoicePlaybackSource(...)`

The resolver becomes smarter, but the player contract stays the same.

## Preferred Route Ownership

Route ownership should remain server-authoritative.

The server/capability seam should decide which committed asset locator is the
best playback candidate.

That means follow-up branches should keep selection logic in or behind:

- [src/modules/messaging/data/server.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/data/server.ts)
- current content/signed-url resolution seams

not in:

- Messenger route pages
- KeepCozy code
- thread JSX branches

Practical transition-friendly rule:

- keep current content/signed-url route behavior working for the original asset
- make the voice source resolver selection-aware before changing broader route
  shapes

## Preferred Playback Source Selection Rules

For the first implementation pass, use simple truthful rules:

1. If a ready derived playback variant exists and the current device likely
   supports it, prefer that variant.
2. Else if the original committed asset is likely playable on this device, use
   the original asset.
3. Else surface an explicit unsupported/unavailable playback state.

The player should not silently spin in generic loading when rule 3 is reached.

## Unsupported-Device Fallback

If neither the original asset nor a derived playback variant is playable on the
current device:

- show unavailable/unsupported playback state
- do not pretend the file is still buffering
- keep voice diagnostics explicit

The unsupported fallback is truthful because:

- the message still exists
- the original asset still exists
- the problem is playback compatibility, not message loss

## Current Plaintext Transition Rule

During transition, plaintext voice should continue to work exactly as it does
now:

- original asset upload stays committed through the current path
- no derived asset is required for send success
- playback falls back to the original asset when no variant exists

This prevents the introduction of a hard new dependency on background
transcoding before the rest of the system is ready.

## Encrypted Voice Compatibility

Encrypted voice should reuse the same original-vs-derived contract later.

The difference is only the transport and decrypt boundary:

- original encrypted asset remains preserved
- derived playback variant may also be encrypted
- the same selection logic chooses the best committed variant
- the final player still receives one local playable source URL

That keeps plaintext and encrypted voice aligned at the media-model level.

## Safe Implementation Order

Follow-up branches should land in this order:

1. Add the committed variant metadata contract adjacent to `message_assets`.
2. Keep send/finalize preserving the original captured asset exactly as today.
3. Add background derivation for a single normalized playback role:
   - `playback-normalized`
4. Add server-side lookup that can list candidate playback sources for one
   committed voice asset.
5. Update
   [app/(app)/chat/[conversationId]/voice-playback-source.ts](/Users/danya/IOS%20-%20Apps/CHAT/app/%28app%29/chat/%5BconversationId%5D/voice-playback-source.ts)
   to choose:
   - best derived variant
   - else original
6. Keep the voice bubble/player contract stable while the resolver becomes
   selection-aware.
7. Only later add variant backfill, more formats, or encrypted-voice variant
   support.

## Explicit Non-Goals

This contract does not mean:

- client-side transcoding in the thread runtime
- replacing the original committed asset
- storing playback-variant choice in the message row
- exposing new user settings for format choice
- adding new UI surfaces in this branch
- requiring inbox/activity to understand variants
- redesigning the current signed-url/content route semantics immediately

## Acceptance Rule For Future Branches

When implementation starts, these boundaries should remain true:

- the original voice asset remains preserved
- variant metadata remains in the committed media layer
- source selection remains behind the voice playback resolver seam
- the UI only consumes one chosen playable source contract
- unsupported-device fallback remains explicit and honest
