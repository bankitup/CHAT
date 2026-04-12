# DM E2EE Architecture

This document defines the truthful direct-message text end-to-end encryption direction for CHAT.

Controlled rollout note:

- encrypted DMs are gated for closed-user rollout
- runtime enablement must stay explicit
- there is no operator plaintext bypass for testing or support

Scope of this phase:

- DM text only
- client-side encryption and decryption only
- device-based identity and session setup
- Signal-style asynchronous session establishment and ratcheting direction, without claiming full Signal parity today

Out of scope for this phase:

- group E2EE
- attachment E2EE
- voice-note E2EE
- calls
- deceptive UI claims such as "fully encrypted" before the real data path exists

Reference direction:

- X3DH for asynchronous prekey-based session establishment:
  [Signal X3DH](https://signal.org/docs/specifications/x3dh/)
- Double Ratchet for ongoing message secrecy and break-in recovery:
  [Signal Double Ratchet](https://signal.org/docs/specifications/doubleratchet/)

## Current implemented state

Today the repo has a limited DM-only encrypted path:

- direct-message text can be encrypted on the client before upload
- encrypted DM shells are stored in `public.messages`
- opaque ciphertext envelopes are stored in `public.message_e2ee_envelopes`
- encrypted DM text is decrypted only on the client for thread rendering
- inbox/activity use truthful generic fallback copy unless a safe local preview is available

What remains plaintext today:

- non-DM conversations
- non-encrypted message paths
- non-text message content such as attachments and voice messages

What is still not true today:

- full X3DH session establishment
- Double Ratchet follow-up messaging
- multi-device E2EE
- encrypted DM edit support

## Proposed DM-first architecture

### 1. Device identity

Encryption must be device-based, not only user-based.

Each logged-in client device will eventually have:

- a long-term identity key pair
- a signed prekey pair
- a rotating stock of one-time prekeys
- Double Ratchet session state for remote devices

The server stores only the public portions needed for session establishment and message routing.

### 2. Session establishment

For a DM, the sending device fetches the recipient device prekey bundle from the server and uses a prekey-bootstrap flow that is compatible with later Signal-style session evolution.

Server-visible material:

- recipient identity public key
- recipient signed prekey public key
- signed prekey signature
- one-time prekey public key, if available

The server never receives:

- identity private keys
- signed prekey private keys
- one-time prekey private keys
- Double Ratchet root or chain keys
- decrypted message text

### 3. Message transport

For encrypted DM text:

- `public.messages` remains the ordering and lifecycle shell
- plaintext `body` is not stored
- one ciphertext envelope is stored per target device

That keeps the current conversation ordering model, reactions, unread tracking, archive state, and soft-delete model compatible, while removing server access to DM text.

### 4. Ratcheting-friendly direction

After a future stronger session layer exists, devices should exchange opaque ratcheted message envelopes only.

The repo should treat these envelopes as opaque bytes:

- the client encrypts before upload
- the server only stores and routes
- the client decrypts after fetch

The current repo does not yet implement full Signal semantics. Future work should move closer to a standard session model rather than expanding the current bootstrap-only flow indefinitely.

## Data boundaries

### Device-only data

Must live only on the client device:

- identity private key
- signed prekey private key
- previous signed prekey private key during overlap window
- one-time prekey private keys until consumed
- Double Ratchet session state
- decrypted DM text cache
- any future local inbox-preview cache for encrypted DMs

V1 repository decision:

- browser clients persist private device key material in IndexedDB
- this is a pragmatic client-only boundary, not strong hardware-backed storage
- stronger device storage can replace this boundary later without changing the server schema
- v1 still assumes one active device per user; a later device publication retires earlier device records instead of attempting fake multi-device support

### Server-stored public material

Safe to store server-side:

- device registration metadata
- identity public key
- signed prekey public key
- signed prekey signature
- one-time prekey public keys
- message shell metadata such as sender, conversation, sequence, timestamps
- opaque ciphertext envelopes

### Encrypted message records

For DM E2EE text, the server stores:

- the message shell in `public.messages`
- one or more opaque ciphertext envelopes in `public.message_e2ee_envelopes`

The server must not store:

- plaintext DM text
- server-decryptable symmetric keys
- plaintext preview text for encrypted DMs

## Minimal schema direction

### `public.user_devices`

Purpose:

- register each active user device
- expose the public bundle needed to start a DM session

Key fields:

- `id`
- `user_id`
- `device_id`
- `registration_id`
- `identity_key_public`
- `signed_prekey_id`
- `signed_prekey_public`
- `signed_prekey_signature`
- `created_at`
- `last_seen_at`
- `retired_at`

### `public.device_one_time_prekeys`

Purpose:

- store one-time prekey public material per device
- allow one-time prekey claim/consumption without exposing private halves

Key fields:

- `id`
- `device_id`
- `prekey_id`
- `public_key`
- `claimed_at`
- `created_at`

### `public.messages`

Keep `public.messages` as the ordering shell, but add:

- `content_mode`
- `sender_device_id`

Required behavior:

- `kind` stays the semantic message kind such as `text` or `voice`
- `content_mode = 'plaintext'` for existing plaintext flows
- `content_mode = 'dm_e2ee_v1'` for encrypted DM text
- `body` must be `null` when `content_mode = 'dm_e2ee_v1'`

### `public.message_e2ee_envelopes`

Purpose:

- store one opaque encrypted payload per recipient device

Key fields:

- `id`
- `message_id`
- `recipient_device_id`
- `envelope_type`
- `ciphertext`
- `used_one_time_prekey_id`
- `created_at`

Notes:

- `envelope_type` distinguishes prekey-session bootstrap from regular Signal messages
- `ciphertext` is an opaque serialized envelope, not database-parsed crypto fields

## Send and receive model

### Send

Current implemented encrypted DM send flow:

1. The client resolves the current conversation as a DM.
2. The client loads the sender device keys from local secure storage.
3. The client fetches recipient device bundles from the server.
4. The client performs a prekey-bootstrap encryption step for the recipient device and a self-envelope for the sender device.
5. The client encrypts the plaintext locally into one envelope per target device.
6. The client uploads:
   - a `public.messages` shell row with `content_mode = 'dm_e2ee_v1'`
   - `body = null`
   - envelope rows in `public.message_e2ee_envelopes`

Current v1 hardening behavior:

- device bootstrap publication is cached locally and only re-published when needed
- if the local device binding is stale, the client re-publishes and retries once
- if a one-time prekey race occurs during send, the client refreshes the recipient bundle and retries once
- if recipient one-time prekeys are exhausted, bootstrap still uses the signed prekey only rather than downgrading to plaintext
- recipient one-time-prekey claim, encrypted message shell insert, ciphertext envelope insert, and conversation recency update now commit through one database function so they succeed or fail together
- failures remain explicit; the app does not silently fall back to server-readable DM text
- rollout can be limited to selected auth users without weakening ciphertext storage or server blindness

### Receive

Current implemented encrypted DM receive flow:

1. The client fetches message shell rows plus only the envelopes targeted to the local device.
2. The client loads local device private material.
3. The client decrypts locally.
4. The client renders plaintext only in memory or local protected storage.

## Product consequences

These changes are intentional and truthful:

- server-side DM text preview becomes unavailable
- inbox/activity/server search cannot read encrypted DM text
- encrypted DM previews must eventually come from client-local decrypted caches
- replies can still target message ids, but quoted plaintext preview for encrypted DMs must be client-derived

Current v1 search policy:

- inbox search still works for conversation names and participant names
- encrypted DM plaintext is not server-searchable
- local decrypted DM preview cache improves inbox display only; it is not treated as a device-wide search index
- until a real local-only encrypted search index exists, encrypted DM text is intentionally excluded from search matching

## Rollout and operator policy

Encrypted DMs in this closed-user product must keep these guardrails:

- no admin/operator path may read DM plaintext
- no debugging path may add plaintext logs or server-readable preview copies
- rollout should use explicit tester gating rather than hidden bypasses
- unsupported flows should be documented before testers are enabled

Operational checklist:

- use [dm-e2ee-rollout-checklist.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/dm-e2ee-rollout-checklist.md) before enabling selected testers
- use [security/dm-e2ee-mvp-decision.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/security/dm-e2ee-mvp-decision.md) for the product-stage decision on whether current strict device-bound history should stay in the MVP default path

For MVP rollout, the honest fallback is:

- show a generic preview like `Encrypted message` for encrypted DMs until a local preview cache exists

## Current DM reply / edit / delete policy

Current v1 behavior for encrypted direct messages:

- reply is allowed
- edit is not supported
- delete remains allowed as a sender-owned soft delete

Why:

- reply currently references the target `message_id` and uses generic encrypted labels instead of exposing plaintext snippets server-side
- edit is intentionally blocked because the current encrypted DM path does not yet have a truthful re-encrypt edit flow or edit-history policy
- delete still operates on the message shell and does not require decrypting or re-uploading plaintext

## Edits, deletes, and multi-device notes

This phase does not complete these behaviors:

- encrypted edit flow
- multi-device history recovery
- device verification UX
- safety-number comparison UX

Recommended product rule for the first encrypted rollout:

- allow server-truth soft delete via `deleted_at`
- defer encrypted text editing until the replacement semantics are designed cleanly

## What is implemented now in the repo

Prepared now:

- this architecture note
- SQL migration drafts for device/public-key and envelope storage
- contract types for a future client/server E2EE boundary
- schema documentation updates
- real client-side device bootstrap:
  - local device key generation
  - IndexedDB persistence of private material
  - publication of public device material and prekeys to the server
- first encrypted DM text send path:
  - DM-only client-side prekey-bundle verification
  - client-side text encryption before upload
  - `public.messages` shell insert with `content_mode = 'dm_e2ee_v1'`
  - ciphertext envelope insert into `public.message_e2ee_envelopes`
- first encrypted DM receive path:
  - current-device envelope selection from the server
  - client-side decryption in the DM thread only
  - local-only decrypted preview cache for inbox rows on the current device
  - truthful fallback of `Encrypted message` when no local preview cache exists

Not implemented now:

- Double Ratchet session resume after the first prekey-message exchange
- local encrypted preview cache
- any UI claim that DM text is already encrypted

Current implementation note:

- the first send path uses a prekey-message bootstrap envelope only
- it does not yet implement Double Ratchet message sending or session resume
- the client now decrypts those prekey envelopes for thread rendering only
- inbox previews can now use a device-local decrypted snippet cache when the latest encrypted DM has already been decrypted on that device
- activity previews remain generic on purpose because no local activity-preview cache exists yet

## Top risks and tradeoffs

1. Browser key storage is weaker than native secure enclave storage.
   On the web, device-private keys will likely need IndexedDB plus an additional wrapping strategy if stronger at-rest protection is required.

2. Server-side inbox previews for encrypted DMs disappear.
   This is a product tradeoff, not a bug. Honest E2EE means the server cannot derive DM preview text.

3. Multi-device recovery is not free.
   If a user loses the local device keys before multi-device sync or backup is designed, encrypted DM history can become unrecoverable.

4. Current server actions cannot keep receiving plaintext for encrypted DMs.
   Any future DM-E2EE send action must accept only opaque envelopes, never plaintext message text.

5. Group E2EE should not be bolted onto this design casually.
   Groups likely need a separate sender-key or MLS-style direction later.

## Recommended next implementation steps

1. Add device registration and public-prekey upload on the client, backed by local private-key storage and the new server tables.
2. Add a DM-only encrypted send path that uploads opaque envelopes and stops writing plaintext DM text into `public.messages.body`.
3. Replace server-derived DM previews with a client-local decrypted preview cache and a truthful `Encrypted message` fallback.
