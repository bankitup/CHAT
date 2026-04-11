# Encrypted Voice Asset Contract

This document defines the intended private-media design for encrypted voice
notes in direct messages.

It is intentionally architectural:

- no full implementation in this batch
- no RTC/call transport
- no blob-in-envelope hacks
- no weakening of the current summary/message shell boundaries

Related documents:

- [voice-message-foundation.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/voice-message-foundation.md)
- [media-rtc-architecture.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/media-rtc-architecture.md)
- [dm-e2ee-architecture.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/dm-e2ee-architecture.md)
- [src/modules/messaging/media/message-assets.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/media/message-assets.ts)
- [src/modules/messaging/contract/dm-e2ee.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/contract/dm-e2ee.ts)

## Core decision

Private voice notes remain:

- a normal `public.messages` row
- a committed `public.message_assets` row
- a committed `public.message_asset_links` row
- one per-device encrypted access package delivered through the DM E2EE envelope path

The binary audio payload is never stored as plaintext-readable private media in
its final model.

## Message shell contract

For encrypted DM voice notes:

- `messages.kind = 'voice'`
- `messages.content_mode = 'dm_e2ee_v1'`
- `messages.body = null`
- `reply_to_message_id` keeps working as usual

Why:

- `kind` stays the semantic message type for thread and inbox preview behavior
- `content_mode` marks that playback requires DM-private cryptographic access
- the message row remains the durable ordering/history shell

This keeps encrypted voice aligned with encrypted DM text without pretending the
audio bytes belong inside the text-envelope payload itself.

## Durable split of responsibilities

### `public.message_assets`

This table keeps committed asset identity and non-secret transport metadata.

For private encrypted voice notes it should store:

- `id`
- `conversation_id`
- `created_by`
- `kind = 'voice-note'`
- `source = 'supabase-storage'`
- `storage_bucket`
- `storage_object_path`
- `size_bytes`
- `created_at`

For private encrypted media, these fields should be treated as optional public
hints, not required cleartext truth:

- `mime_type`
- `duration_ms`
- `file_name`
- `external_url`

Recommended rule:

- prefer `null` or generic values for private-media-only presentation metadata
- do not rely on `file_name` for private voice notes
- do not require `duration_ms` to be public for playback to work

This keeps `message_assets` reusable for future encrypted files and images
without forcing sensitive presentation metadata into public rows.

### `public.message_asset_links`

This stays unchanged:

- links committed assets to committed message rows
- preserves `ordinal`
- preserves `render_as_primary`

It is a durable history relationship, not a crypto carrier.

### `public.message_e2ee_envelopes`

This remains the per-device key-distribution path for DM-private media.

It should carry a small encrypted media-access package, not the audio blob.

The existing outer Signal envelope remains the same:

- one envelope per target device
- sender self-envelope included
- server stores opaque ciphertext only

## Encrypted media-access package

Inside the Signal-encrypted envelope payload, the client should send a compact
private-media package.

Suggested shape:

```ts
type DmEncryptedMediaAccessPackageV1 = {
  payloadKind: 'media-asset-access';
  mediaVersion: 1;
  assetKind: 'voice-note';
  locator: {
    assetId: string;
    bucket: string;
    objectPath: string;
  };
  crypto: {
    algorithm: 'aes-gcm-256';
    mediaKeyB64: string;
    nonceB64: string;
    ciphertextSha256B64: string;
    plaintextSha256B64?: string | null;
  };
  playback: {
    mimeType: string | null;
    durationMs: number | null;
    sizeBytes: number | null;
  };
};
```

Important properties:

- no raw audio bytes in the envelope payload
- enough information to fetch, verify, decrypt, and play the asset
- generic enough to later support `image` and `file`

For future encrypted files/images, the same package can be reused with:

- `assetKind = 'image' | 'file'`
- optional `display.fileName`
- optional image dimensions

## End-to-end lifecycle

Recommended lifecycle for encrypted DM voice notes:

1. A local draft exists in the composer.
2. The client generates:
   - a fresh media key
   - a fresh nonce / IV
   - a local upload id
3. The client encrypts the audio blob locally.
4. The client uploads the encrypted blob to storage.
5. The client asks the server to finalize the committed history entry.
6. Finalize persists:
   - `public.messages` shell row with `kind = 'voice'`
   - `public.message_assets` row for the encrypted blob locator
   - `public.message_asset_links` row
   - per-device `public.message_e2ee_envelopes` rows carrying the media-access package
   - conversation summary projection update
7. The client reconciles the optimistic voice bubble into the committed row.

Why staged upload first:

- upload failure does not create a fake committed message
- finalization can become a narrow atomic metadata commit
- the same shape can later support encrypted files and images

## Sender-own playback

The sender playback path should work through the same private-media resolver as
recipients.

Suggested flow:

1. Thread loads the committed message row plus asset row/link row.
2. When the sender taps play, the client fetches the sender self-envelope for
   that message.
3. The client decrypts the envelope locally using the sender device keys.
4. The client verifies that:
   - the package `assetId` matches the linked asset
   - the locator matches the committed asset row
5. The client fetches the encrypted blob from storage.
6. The client decrypts it locally and creates an object URL.
7. The existing voice playback runtime plays the object URL.

This keeps sender-own playback honest:

- no server-readable fallback
- no special-case plaintext sender shortcut

## Recipient playback

Recipient playback uses the same resolver:

1. load committed message row + asset row/link row
2. fetch the recipient-device envelope
3. decrypt the media-access package locally
4. fetch the encrypted blob
5. verify + decrypt locally
6. hand the object URL to the voice playback UI

If any of these steps fail:

- the voice row stays truthful
- show unavailable / failed playback state
- do not pretend the asset is readable

## Thread runtime boundary

The current voice playback runtime already expects an on-demand source.

For encrypted private media, insert one extra resolver layer before playback:

1. resolve committed asset metadata
2. resolve local decryptable source
3. feed the resulting object URL into the existing audio player

That means the thread UI contract can stay stable while the source resolution
changes from:

- plaintext asset -> signed storage URL

to:

- encrypted asset -> signed ciphertext URL -> local decrypt -> object URL

Today that thread-side boundary is intentionally narrow and frontend-local in
[app/(app)/chat/[conversationId]/voice-playback-source.ts](/Users/danya/IOS%20-%20Apps/CHAT/app/%28app%29/chat/%5BconversationId%5D/voice-playback-source.ts),
so encrypted voice can replace:

- committed transport-source lookup
- local playable-source preparation

without rewriting the player UI again.

## Inbox and activity behavior

Inbox and activity stay blob-free.

They continue to derive preview from committed message summary only:

- `last_message_kind = 'voice'`
- optional generic masked labels like `Voice message`

They must not depend on:

- `message_assets` scanning
- media-key resolution
- blob fetches
- decryption state

## Compatibility with future encrypted files and images

This design should generalize cleanly.

Shared reusable pieces:

- `messages` remains the history shell
- `message_assets` remains the committed asset locator table
- `message_asset_links` remains the durable relationship table
- `message_e2ee_envelopes` remains the per-device key-distribution path
- the encrypted media-access package carries:
  - asset locator
  - media key
  - nonce
  - integrity fields
  - optional presentation metadata

Per-type UI differs, but the transport/encryption boundary stays the same.

## What stays out of scope

This design is not for:

- live voice calls
- RTC session signaling
- streaming audio transport
- real-time peer media

Calls remain a separate RTC boundary, with separate session and transport
contracts.

## Recommended next implementation steps

1. Add a private-media source resolver interface in `src/modules/messaging/media`.
2. Keep plaintext voice runtime working through the current signed-URL path.
3. Add an encrypted-voice finalize shape that can persist:
   - message shell
   - asset row
   - asset link row
   - media-access envelopes
4. Update thread playback to accept either:
   - a direct signed URL, or
   - an asynchronously resolved local object URL
5. Reuse the same resolver contract for future encrypted files/images.
