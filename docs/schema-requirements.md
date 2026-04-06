# Supabase Schema Requirements

This repo now relies on a few messaging schema fields that must exist in Supabase for the current inbox, archive, read-state, notification, and identity flows to work cleanly.

## Required tables

- `public.conversations`
- `public.conversation_members`
- `public.messages`
- `public.profiles`
- `public.message_reactions`
- `public.message_attachments`
- `public.message_assets` (required for committed voice/media runtime)
- `public.message_asset_links` (required for committed voice/media runtime)

## Required columns used by current code

### `public.conversations`

- `id`
- `kind`
- `title`
- `created_by`
- `last_message_at`
- `created_at`
- `space_id` (required for current space-scoped inbox/activity/chat entry)

Optional hardening support:

- `dm_key`

Notes:

- `dm_key` is the canonical unordered DM pair key. Strict one-DM-per-pair enforcement depends on the cleanup-aware migration in `docs/sql/2026-04-04-dm-uniqueness-hardening.sql`.

### `public.conversation_members`

- `conversation_id`
- `user_id`
- `role`
- `state`
- `last_read_message_seq`
- `last_read_at`
- `hidden_at`
- `notification_level`

Notes:

- `hidden_at` is required for the archive/hide and archived-chats surfaces.
- `notification_level` is required for per-conversation notification preferences.
- `last_read_message_seq` and `last_read_at` are required for unread/read and DM seen state.

### `public.messages`

- `id`
- `conversation_id`
- `sender_id`
- `sender_device_id` (required by current E2EE-aware chat shell selects)
- `reply_to_message_id`
- `seq`
- `kind`
- `client_id`
- `body`
- `content_mode` (required by current E2EE-aware chat/inbox logic)
- `edited_at`
- `deleted_at`
- `created_at`

Current runtime contract:

- `kind` must allow exactly `text`, `attachment`, and `voice`

### `public.profiles`

- `user_id`
- `display_name`

Optional but supported:

- `avatar_path`

The code already falls back if `avatar_path` is missing.

Operational note:

- avatar files are expected to live in the configured avatars bucket
- current default bucket is `avatars` (override with `SUPABASE_AVATARS_BUCKET` if needed)
- new `avatar_path` writes store bucket object paths, not baked public URLs

### `storage.buckets` / `storage.objects`

Required current buckets:

- `avatars`
- `message-media`

Current attachment runtime note:

- chat attachments and voice notes default to the `message-media` bucket
- current default bucket is `message-media`
- server runtime may override with `SUPABASE_ATTACHMENTS_BUCKET`
- client-exposed fallback may override with `NEXT_PUBLIC_SUPABASE_ATTACHMENTS_BUCKET`, but code and SQL must stay aligned

### `public.message_reactions`

- `id`
- `message_id`
- `emoji`
- `user_id`
- `created_at`

### `public.message_attachments`

- `id`
- `message_id`
- `bucket`
- `object_path`
- `mime_type`
- `size_bytes`
- `created_at`

### `public.message_assets`

- `id`
- `conversation_id`
- `created_by`
- `kind`
- `source`
- `storage_bucket`
- `storage_object_path`
- `mime_type`
- `file_name`
- `size_bytes`
- `duration_ms`
- `created_at`

### `public.message_asset_links`

- `id`
- `message_id`
- `asset_id`
- `ordinal`
- `render_as_primary`
- `created_at`

## Required SQL files in this repo

Apply these if the fields are not yet present in your Supabase project:

- [2026-04-03-conversation-member-hidden-at.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-03-conversation-member-hidden-at.sql)
- [2026-04-03-conversation-member-notification-level.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-03-conversation-member-notification-level.sql)
- [2026-04-03-conversations-space-id-v1-align.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-03-conversations-space-id-v1-align.sql)
- [2026-04-04-dm-uniqueness-hardening.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-04-dm-uniqueness-hardening.sql)
- [2026-04-03-messages-shell-e2ee-v1-align.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-03-messages-shell-e2ee-v1-align.sql)
- [2026-04-06-messages-kind-runtime-align.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-06-messages-kind-runtime-align.sql)
- [2026-04-06-message-assets-runtime-align.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-06-message-assets-runtime-align.sql)
- [2026-04-03-avatars-storage-policies.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-03-avatars-storage-policies.sql)
- [2026-04-06-message-attachments-storage-policies.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-06-message-attachments-storage-policies.sql)

## Defensive behavior currently in code

- If `public.profiles.avatar_path` is missing, identity UI falls back to display names only.
- If `public.conversation_members.last_read_message_seq` or `last_read_at` are missing, read-state queries fall back to `null` values instead of crashing.
- If `public.conversation_members.hidden_at` is missing, the main inbox falls back to non-archived loading, and archive actions now fail with a clear migration message.
- If `public.conversation_members.notification_level` is missing, conversation loading falls back to `default`, and preference updates now fail with a clear migration message.
- If `public.conversations.dm_key` is missing, DM creation still falls back to active-member lookup, but strict one-DM-per-pair enforcement depends on `docs/sql/2026-04-04-dm-uniqueness-hardening.sql`.
