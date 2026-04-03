# Schema Assumptions

This document lists the Supabase schema elements the current app code depends on today. It is meant to prevent code from drifting ahead of the real database.

Use this as the operational schema checklist before deploys and before adding new data-dependent features.

This document distinguishes between:

- schema required by the current running app
- schema prepared for future work but not yet active in production behavior

## Tables in active use

- `public.profiles`
- `public.conversations`
- `public.conversation_members`
- `public.messages`
- `public.message_attachments`
- `public.message_reactions`

## `public.profiles`

Required columns used by current code:

- `user_id`
- `display_name`

Optional / fallback-supported:

- `avatar_path`
- `preferred_language` is read defensively, but authenticated language persistence requires it

Notes:

- `user_id` is treated as one profile per auth user and should remain unique.
- If `avatar_path` is missing, the app falls back to initials/name-based identity rendering.
- Profile editing writes `display_name` and, when avatar upload succeeds, `avatar_path`.
- Settings language preference writes `preferred_language` when the column exists.

## `public.conversations`

Required columns used by current code:

- `id`
- `kind`
- `title`
- `created_by`
- `last_message_at`
- `created_at`

Optional / hardening support:

- `dm_key`

Assumptions:

- `kind` is used as a conversation-type discriminator (`dm` or `group`).
- `created_by` is used for group ownership-sensitive UI like title editing.
- `last_message_at` drives inbox ordering and recency labels.
- `dm_key`, when present, is used to make direct-message creation race-safe and reuse an existing DM for the same user pair.

## `public.conversation_members`

Required columns used by current code:

- `conversation_id`
- `user_id`
- `role`
- `state`
- `last_read_message_seq`
- `last_read_at`
- `hidden_at`
- `notification_level`

Assumptions:

- `state` is used for active membership truth (`active`, `left`, `removed`).
- `role` is used for owner/admin/member UI and permission checks.
- `last_read_message_seq` and `last_read_at` power unread state and DM seen state.
- `hidden_at` powers per-user archive/hide and archived chats.
- `notification_level` powers per-conversation notification preference.

Optional / future-facing:

- Nothing else is currently assumed here by the app code.

## `public.messages`

Required columns used by current code:

- `id`
- `conversation_id`
- `sender_id`
- `reply_to_message_id`
- `seq`
- `kind`
- `client_id`
- `body`
- `edited_at`
- `deleted_at`
- `created_at`

Assumptions:

- `seq` is the per-conversation ordering/read-position anchor.
- `kind` is currently used for current text messaging flows and future-facing `voice` message support.
- `body` is still the current plaintext source of truth for message rendering, inbox previews, and activity previews.
- `deleted_at` is used for soft-deleted message rendering.

## `public.message_attachments`

Required columns used by current code:

- `id`
- `message_id`
- `bucket`
- `object_path`
- `mime_type`
- `size_bytes`
- `created_at`

Assumptions:

- Attachment metadata lives here; file bytes live in Supabase Storage.
- `bucket` and `object_path` must match the actual storage layout.
- Voice messages reuse this table; current object paths use `/voice/` for voice-note files and `/files/` for other attachments.

## `public.message_reactions`

Required columns used by current code:

- `id`
- `message_id`
- `emoji`
- `user_id`
- `created_at`

Assumptions:

- Reaction grouping is computed from raw rows.
- Current app logic enforces max reaction selection behavior in code, not here.

## DM E2EE bootstrap foundation

These schema elements support the current authenticated device-bootstrap path and the first DM-text encrypted send path. They do not mean full encrypted DM read/render is already live.

### `public.user_devices`

Planned role:

- one row per active user device
- public device identity material only
- no private keys stored server-side
- current app behavior assumes one active device per user in v1; publishing a new device record retires earlier ones

Planned columns:

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

Planned role:

- public one-time prekey supply for asynchronous DM session setup

Current v1 behavior:

- missing or exhausted one-time prekeys do not permit plaintext fallback
- encrypted DM bootstrap may continue using the signed prekey only until fresh one-time prekeys are published

Planned columns:

- `id`
- `device_id`
- `prekey_id`
- `public_key`
- `claimed_at`
- `created_at`

### `public.messages` additions for DM E2EE

Prepared additions:

- `content_mode`
- `sender_device_id`

Future assumptions once DM E2EE rolls out:

- `kind` remains the semantic message kind such as `text` or `voice`
- `content_mode = 'plaintext'` keeps current behavior
- `content_mode = 'dm_e2ee_v1'` means `body` must be `null`
- encrypted DM text must live only in per-device ciphertext envelopes, not in `body`

### `public.message_e2ee_envelopes`

Planned role:

- one opaque ciphertext envelope per target device for encrypted DM text

Planned columns:

- `id`
- `message_id`
- `recipient_device_id`
- `envelope_type`
- `ciphertext`
- `used_one_time_prekey_id`
- `created_at`

## Required migrations before deploy

These schema changes must exist in Supabase for the current app to run safely:

1. `public.conversation_members.hidden_at`
   Source file: [2026-04-03-conversation-member-hidden-at.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-03-conversation-member-hidden-at.sql)

2. `public.conversation_members.notification_level`
   Source file: [2026-04-03-conversation-member-notification-level.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-03-conversation-member-notification-level.sql)

3. `public.profiles.preferred_language`
   Source file: [2026-04-03-profiles-preferred-language.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-03-profiles-preferred-language.sql)

4. `public.messages.kind` must allow `voice`
   Source file: [2026-04-03-messages-kind-voice.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-03-messages-kind-voice.sql)

## Recommended hardening before broader testing

1. `public.conversations.dm_key`
   Source file: [2026-04-03-conversations-dm-key.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-03-conversations-dm-key.sql)

## Required migrations before enabling DM E2EE bootstrap

Do not apply these as a user-facing "encrypted messaging is live" claim by themselves. They enable device registration, public prekey publication, and ciphertext DM send storage only.

1. `public.user_devices` and `public.device_one_time_prekeys`
   Source file: [2026-04-03-user-devices-and-prekeys.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-03-user-devices-and-prekeys.sql)

2. `public.messages.content_mode` and `public.messages.sender_device_id`
   Source file: [2026-04-03-messages-content-mode.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-03-messages-content-mode.sql)

3. `public.message_e2ee_envelopes`
   Source file: [2026-04-03-message-e2ee-envelopes.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-03-message-e2ee-envelopes.sql)

## Current defensive behavior in code

- Missing `profiles.avatar_path` is tolerated.
- Missing `profiles.preferred_language` falls back to cookie/default language for reads, but language preference updates still require the migration.
- Missing `conversation_members.last_read_message_seq` / `last_read_at` falls back to `null` read state.
- Missing `conversation_members.hidden_at` no longer causes a raw confusing crash on the main inbox path, but archive-related behavior still requires the migration.
- Missing `conversation_members.notification_level` falls back to `default` for conversation loading, but preference updates still require the migration.
- If `messages.kind` is restricted to older values, voice-message inserts require the migration before they can be stored safely.
- If `conversations.dm_key` is missing, direct-message creation still falls back to active-member lookup, but race-safe DM uniqueness depends on the migration.
- DM text E2EE is only partially active today. Direct-message text can now be uploaded as ciphertext for the DM-only encrypted send path, and the current device can decrypt those encrypted DM messages in-thread. Inbox rows may use a device-local decrypted preview cache when available; the server still cannot read DM preview text.
- DM search remains server-blind for encrypted text. Current search continues to work for conversation and participant identity, but not encrypted DM plaintext.
- Runtime rollout is also gated by environment configuration:
  - `CHAT_DM_E2EE_ROLLOUT=disabled|selected|all`
  - `CHAT_DM_E2EE_TESTER_USER_IDS=<comma-separated auth user ids>`
- The recommended operational checklist lives in [dm-e2ee-rollout-checklist.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/dm-e2ee-rollout-checklist.md).

## Highest-risk assumptions right now

- `conversation_members.hidden_at`
- `conversation_members.notification_level`
- `profiles.preferred_language`
- `conversation_members.last_read_message_seq`
- `conversation_members.last_read_at`

These fields directly affect language preference persistence, inbox loading, archive behavior, notification preferences, and read/unread UX.
