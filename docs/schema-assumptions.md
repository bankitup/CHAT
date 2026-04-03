# Schema Assumptions

This document lists the Supabase schema elements the current app code depends on today. It is meant to prevent code from drifting ahead of the real database.

Use this as the operational schema checklist before deploys and before adding new data-dependent features.

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

## Current defensive behavior in code

- Missing `profiles.avatar_path` is tolerated.
- Missing `profiles.preferred_language` falls back to cookie/default language for reads, but language preference updates still require the migration.
- Missing `conversation_members.last_read_message_seq` / `last_read_at` falls back to `null` read state.
- Missing `conversation_members.hidden_at` no longer causes a raw confusing crash on the main inbox path, but archive-related behavior still requires the migration.
- Missing `conversation_members.notification_level` falls back to `default` for conversation loading, but preference updates still require the migration.
- If `messages.kind` is restricted to older values, voice-message inserts require the migration before they can be stored safely.
- If `conversations.dm_key` is missing, direct-message creation still falls back to active-member lookup, but race-safe DM uniqueness depends on the migration.

## Highest-risk assumptions right now

- `conversation_members.hidden_at`
- `conversation_members.notification_level`
- `profiles.preferred_language`
- `conversation_members.last_read_message_seq`
- `conversation_members.last_read_at`

These fields directly affect language preference persistence, inbox loading, archive behavior, notification preferences, and read/unread UX.
