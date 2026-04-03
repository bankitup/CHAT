# E2EE Security Model

Purpose:

- define the current security model for encrypted direct messages in CHAT
- separate implemented behavior from planned behavior and unsupported behavior
- give future patches one security-focused source of truth

Maintenance rule:

- any patch that changes encryption behavior, trust boundaries, key handling, cache semantics, fallback behavior, recovery behavior, or security-related product claims must update this file in the same patch

## 1. Purpose

This document is the implementation-facing security reference for DM E2EE in this repository.

It is not a product brief and it is not a marketing document.

## 2. Current scope

Implemented now:

- direct-message text only
- client-side device registration and public prekey publication
- client-side encrypted DM send
- client-side encrypted DM receive/decrypt in-thread
- device-local decrypted preview cache for inbox rows
- controlled rollout gating for selected users

Prepared or documented but not fully implemented:

- Signal-style direction using asynchronous prekey setup now and ratcheting later
- schema for device records, one-time prekeys, message content mode, and ciphertext envelopes
- rollout checklist and testing guardrails
- explicit v1 space model for access scoping, with broader space-switcher UX still to come

Intentionally unsupported in v1:

- group E2EE
- attachment E2EE
- voice-note E2EE
- calls
- multi-device support
- encrypted DM edit flow
- local full-text search over encrypted DM text

## 3. Security goals

- the server must not read encrypted DM text
- encrypted DM text must be encrypted on the client before upload
- private device key material must remain client-side only
- decrypted DM text must remain in client memory or local device storage only
- server-visible fallback behavior must stay generic and truthful

## 4. Non-goals

- perfect multi-device recovery
- hardware-backed browser key storage
- operator-side decrypt or support recovery
- server-side encrypted message search
- full Signal feature parity in v1

## 5. Trust boundaries

Trusted for private key ownership:

- the authenticated client device running browser crypto and IndexedDB storage

Untrusted for DM plaintext:

- server actions
- API routes
- Supabase database
- Supabase storage
- operator/admin workflows

The server is allowed to route, store, and order encrypted DM traffic. It is not trusted to decrypt it.

Space access boundary note:

- spaces and space membership define who can enter a project/team/client context
- inbox, activity, and chat entry are scoped by the selected parent space
- current first-step rollout may place existing activity inside a default `TEST` space
- spaces do not define who can decrypt DM text
- space owners and space admins must not gain DM plaintext access by role alone

## 6. Key and data flow

Current implemented flow:

1. enabled authenticated client bootstraps a local DM E2EE device record
2. client stores private key material locally
3. client publishes only public device material to the server
4. sender client fetches recipient public device bundle
5. sender client encrypts DM text locally
6. server stores a message shell in `public.messages`
7. server stores opaque ciphertext in `public.message_e2ee_envelopes`
8. recipient client fetches shell plus its own envelope
9. recipient client decrypts locally for rendering

Current protocol boundary:

- the implementation uses a repository-specific prekey-bootstrap envelope design built with WebCrypto primitives
- it is directionally compatible with later Signal-style session evolution
- it is not a complete X3DH implementation
- it is not a complete Double Ratchet implementation

## 7. What the server can see

The server can see:

- space membership and space-role metadata
- conversation membership and message ordering metadata
- sender id
- sender device record id
- timestamps
- reply target message ids
- message kind
- `content_mode`
- opaque ciphertext envelope rows
- public device key material
- whether encrypted DM rollout is enabled for a given account

The server may also see generic fallback labels in rendered UX logic, but not decrypted DM text.

Current secondary-surface fallback policy:

- inbox and activity use generic encrypted labels only
- unread encrypted DM list surfaces may use a generic `New encrypted message` label
- reply references to encrypted DM text use a generic `Reply to encrypted message` label
- these labels must never be backed by server-readable decrypted content

## 8. What the server cannot see

The server must not see:

- encrypted DM plaintext body
- decrypted inbox preview text
- private identity keys
- private signed prekeys
- private one-time prekeys
- local decrypted preview cache content
- client-side decrypted message bodies

The implementation must not reintroduce plaintext via debug logs, helper columns, shadow fields, or analytics.

## 9. Client-side key ownership rules

Rules:

- private keys belong to the client device only
- browser IndexedDB is the current local persistence boundary
- server-side code must never receive private keys
- Supabase secrets must not hold private DM decrypt material
- a later device publication retires older device records because v1 assumes one active device per user

This is a pragmatic web boundary, not a hardware-secure boundary.

## 10. DM encryption state model

Current message-state split:

- `public.messages` is the ordering shell
- `public.messages.content_mode = 'dm_e2ee_v1'` marks encrypted DM text
- `public.messages.body` must be `null` for encrypted DM text
- `public.message_e2ee_envelopes` stores per-device opaque ciphertext

Current session/bootstrap state:

- first-contact and repeat sends currently use a prekey-style encrypted path
- bootstrap publication is cached locally and re-published only when needed
- stale sender registration can trigger one forced re-publish retry
- one-time prekey race can trigger one recipient-bundle refresh retry
- missing one-time prekeys do not authorize plaintext fallback
- encrypted DM send now relies on one atomic database function to claim recipient one-time prekeys, insert the message shell, insert ciphertext envelopes, and update conversation recency together

Prepared but not implemented yet:

- full Double Ratchet follow-up session state

## 11. Local preview cache rules

Implemented now:

- encrypted DM inbox preview cache is device-local only
- current storage is browser `localStorage`
- cache contains only minimum inbox-preview material:
  - conversation id
  - message id
  - normalized snippet
  - updated timestamp

Rules:

- cache is non-canonical
- cache is disposable
- cache is scoped to the authenticated user on the current device
- cache is written only after successful client-side decryption
- cache must never sync to the server
- cache must never be treated as a search index in v1
- cache should be cleared on logout, unauthenticated public/auth entry, rollout disable for that user, explicit encrypted-setup reinitialization, and account switch on the same browser
- cache should be invalidated when the latest message state no longer supports showing the cached decrypted snippet, including latest-message deletion or replacement by non-encrypted latest content

Local device-key lifecycle:

- device private material persists across app reload for the same authenticated enabled user
- device private material is cleared on logout/public unauthenticated entry
- device private material is cleared for users outside the current authenticated session on the same browser
- rollout-disabled users have their local DM E2EE device state cleared rather than left warm in the browser
- explicit encrypted setup reinitialization clears prior local device state before publishing a new local device record

## 12. Failure and recovery semantics

Current truthful failure states:

- rollout disabled for this account
- browser crypto/storage unsupported
- schema missing
- stale sender device registration
- incomplete local encrypted device state
- recipient device material unavailable
- one-time prekey race during send
- encrypted message unavailable on this device

Current recovery behavior:

- retry send or decrypt
- refresh encrypted setup on the current device
- reload chat
- one safe auto-retry for stale sender device publication
- one safe auto-retry for prekey race

Unsupported recovery:

- operator-side plaintext recovery
- cross-device recovery
- recovery of old encrypted messages after true local key loss

Error-surface rule:

- encrypted DM routes and UI should prefer stable, non-technical recovery copy over raw server/debug strings
- explicit structured error codes may still drive recovery actions
- user-facing recovery copy should avoid implying full ratcheted session semantics when the current implementation is still bootstrap-style

## 13. Reply / edit / delete policy for encrypted DMs

Current v1 policy:

- reply: allowed
- edit: not supported
- delete: allowed as sender-owned soft delete

Why:

- reply uses message references and generic encrypted labels
- edit would require a truthful re-encrypt flow and edit-history policy that does not exist yet
- delete operates on the message shell and does not require plaintext recovery

## 14. Search policy

Current v1 policy:

- names and participant identity remain searchable
- encrypted DM plaintext is not server-searchable
- generic fallback text such as `Encrypted message` must not act as fake searchable content
- local preview cache improves inbox display only
- there is no local encrypted full-text search index yet

## 15. Rollout guardrails

Runtime controls:

- `CHAT_DM_E2EE_ROLLOUT=disabled|selected|all`
- `CHAT_DM_E2EE_TESTER_USER_IDS=<comma-separated auth user ids>`

Rules:

- encrypted DMs are gated explicitly for closed-user rollout
- non-enabled users do not bootstrap DM E2EE device state
- non-enabled users cannot use DM E2EE device/bundle/send API paths
- rollout is not a support backdoor and does not weaken ciphertext storage

Operational checklist:

- use [dm-e2ee-rollout-checklist.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/dm-e2ee-rollout-checklist.md)
- use [e2ee-ops-playbook.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/security/e2ee-ops-playbook.md) for operator/support-safe rollout and incident handling

## 16. Security invariants that must not be violated

- encrypted DM plaintext must never be written to `public.messages.body`
- server-side code must never decrypt DM text
- private keys must never leave the client device
- no debug path may create plaintext server copies
- no operator/admin path may read DM plaintext
- no space owner/admin path may be treated as DM decrypt authority
- rollout guards must not degrade encrypted DMs into plaintext sends
- unsupported flows must fail explicitly rather than faking support

## 17. Known limitations and accepted tradeoffs

- one active device per user in v1
- browser storage is weaker than native secure storage
- no multi-device recovery
- space-scoped access is documented and prepared, but runtime selected-space scoping is not fully implemented yet
- no group or attachment E2EE
- current encrypted DM traffic is still bootstrap-style, not ratcheted follow-up messaging
- atomic encrypted DM send now depends on the `send_dm_e2ee_message_atomic` database function being present; if it is missing, encrypted DM send must fail explicitly rather than falling back to non-atomic behavior
- repeat sends are not yet backed by full ratcheted session state
- inbox previews can be useful only on the device that decrypted them
- encrypted DM search is intentionally limited
- local key loss can make existing encrypted DM content unavailable on that device

## Implemented now vs prepared vs unsupported

Implemented now:

- client-side DM encryption and decryption
- public-device bootstrap
- device-local preview cache
- explicit failure and recovery UX
- explicit rollout gating

Prepared or documented:

- ratcheting direction
- migration and rollout checklists
- future stronger storage or search options

Unsupported in v1:

- any server-readable DM plaintext path
- multi-device behavior
- encrypted edit
- group E2EE
- attachment E2EE
