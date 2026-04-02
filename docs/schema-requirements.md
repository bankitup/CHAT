# Supabase Schema Requirements

This repo now relies on a few messaging schema fields that must exist in Supabase for the current inbox, archive, read-state, notification, and identity flows to work cleanly.

## Required tables

- `public.conversations`
- `public.conversation_members`
- `public.messages`
- `public.profiles`
- `public.message_reactions`
- `public.message_attachments`

## Required columns used by current code

### `public.conversations`

- `id`
- `kind`
- `title`
- `created_by`
- `last_message_at`
- `created_at`

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
- `reply_to_message_id`
- `seq`
- `kind`
- `client_id`
- `body`
- `edited_at`
- `deleted_at`
- `created_at`

### `public.profiles`

- `user_id`
- `display_name`

Optional but supported:

- `avatar_path`

The code already falls back if `avatar_path` is missing.

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

## Required SQL files in this repo

Apply these if the fields are not yet present in your Supabase project:

- [2026-04-03-conversation-member-hidden-at.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-03-conversation-member-hidden-at.sql)
- [2026-04-03-conversation-member-notification-level.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-03-conversation-member-notification-level.sql)

## Defensive behavior currently in code

- If `public.profiles.avatar_path` is missing, identity UI falls back to display names only.
- If `public.conversation_members.last_read_message_seq` or `last_read_at` are missing, read-state queries fall back to `null` values instead of crashing.
- If `public.conversation_members.hidden_at` is missing, the main inbox falls back to non-archived loading, and archive actions now fail with a clear migration message.
- If `public.conversation_members.notification_level` is missing, conversation loading falls back to `default`, and preference updates now fail with a clear migration message.
