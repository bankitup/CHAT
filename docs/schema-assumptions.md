# Schema Assumptions

This document lists the Supabase schema elements the current app code depends on today. It is meant to prevent code from drifting ahead of the real database.

Use this as the operational schema checklist before deploys and before adding new data-dependent features.

This document distinguishes between:

- schema required by the current running app
- schema prepared for future work but not yet active in production behavior

The current running app now expects active-space scoping for inbox, activity,
and chat entry. The explicit multi-space model below is no longer only a
future foundation: selected-space routing currently depends on
`public.spaces`, `public.space_members`, and `public.conversations.space_id`,
even though full space-switcher UX is still not implemented.

Current rollout assumption:

- existing messaging activity is backfilled into one default space named `TEST`

## Tables in active use

- `public.profiles`
- `public.conversations`
- `public.conversation_members`
- `public.messages`
- `public.message_assets`
- `public.message_asset_links`
- `public.message_attachments` (still active as a transitional legacy/non-voice attachment layer)
- `public.message_reactions`

## `public.profiles`

Required columns used by current code:

- `user_id`
- `display_name`

Optional / fallback-supported:

- `avatar_path`
- `preferred_language` is read defensively, but authenticated language persistence requires it
- `status_emoji`
- `status_text`
- `status_updated_at`

Notes:

- `user_id` is treated as one profile per auth user and should remain unique.
- If `avatar_path` is missing, the app falls back to initials/name-based identity rendering.
- Profile editing writes `display_name` and, when avatar upload succeeds, `avatar_path`.
- `avatar_path` is now treated as storage-backed avatar location data. New writes store the avatars bucket object path; older absolute URLs are still tolerated for backward compatibility.
- Profile reads resolve `avatar_path` into a renderable URL server-side, so avatar rendering no longer depends on the database storing a permanently public URL.
- Replacing or removing an avatar stores the updated `avatar_path` state and attempts to remove the prior avatar object when it was also storage-backed.
- Managed avatar cleanup is restricted to user-owned object paths in the form `<user_id>/...`.
- Legacy absolute avatar URLs remain renderable, but they are not automatically deletable because they do not carry a trusted storage object path.
- Settings language preference writes `preferred_language` when the column exists.
- Profile status writes `status_emoji`, `status_text`, and `status_updated_at` when the columns exist.
- If the status columns are missing, the current user's own profile status falls back to authenticated `user_metadata` for save/read on the settings screen.
- Cross-user status rendering on chat surfaces still depends on the `profiles.status_*` columns being present.

## `public.conversations`

Required columns used by current code:

- `id`
- `kind`
- `title`
- `space_id`
- `created_by`
- `last_message_at`
- `last_message_id`
- `last_message_seq`
- `last_message_sender_id`
- `last_message_kind`
- `last_message_content_mode`
- `last_message_deleted_at`
- `last_message_body`
- `created_at`

Optional / hardening support:

- `dm_key`
- `avatar_path`
- `join_policy`

Assumptions:

- `kind` is used as a conversation-type discriminator (`dm` or `group`).
- `space_id` is now required by the running app because inbox, activity, chat
  entry, and conversation creation are all active-space-scoped.
- `created_by` is used for group ownership-sensitive UI like title editing.
- `last_message_at` drives inbox ordering and recency labels.
- the `last_message_*` projection columns are now the canonical list-surface summary for inbox and activity; list rendering no longer depends on scanning `public.messages` across visible conversations to discover the latest message.
- `dm_key`, when present, is the canonical unordered DM pair key (`sorted(user_a,user_b).join(':')`) used to make direct-message creation race-safe and reuse exactly one DM for the same pair.
- `avatar_path`, when present, stores group chat avatar identity in the private avatars bucket; inbox/chat loading tolerates it being absent, but editable group avatars require it.
- `join_policy`, when present, stores group privacy as `open` or `closed`; the runtime currently falls back to `closed` when the column is absent, but editable group privacy requires it.
- `space_id` makes each conversation belong to exactly one space.
- direct-message uniqueness must now be enforced per space via `space_id` plus `dm_key`; the runtime no longer treats DMs as global.
- there is currently no separate global messenger-admin role in the app; closed-group member management is enforced through actual group membership roles (`owner` / `admin`) only.

Operational note:

- production group/privacy rollouts should now treat `join_policy` as part of the active runtime contract, not only as a future hardening column.
- some helper paths still degrade safely when `join_policy` is absent, but current `/chat/[conversationId]` production rendering has already shown that missing `public.conversations.join_policy` can break route rendering before those fallbacks are enough.
- if production is missing both newer group columns, apply [2026-04-06-conversations-group-runtime-align.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-06-conversations-group-runtime-align.sql).

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
- `visible_from_seq`

Assumptions:

- `state` is used for active membership truth (`active`, `left`, `removed`).
- `role` is used for owner/admin/member UI and permission checks.
- `last_read_message_seq` and `last_read_at` power unread state and DM seen state.
- `hidden_at` powers per-user archive/hide and archived chats.
- `notification_level` powers per-conversation notification preference.
- `visible_from_seq` powers member-scoped clean history baselines without deleting stored message rows.

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
- `kind` is part of the current active runtime contract and must allow `text`, `attachment`, and `voice`.
- `body` remains the plaintext source of truth for non-encrypted message rendering and previews.
- `deleted_at` is used for soft-deleted message rendering.
- `kind = 'voice'` is now active production behavior for committed voice-message rows; the binary media metadata for those rows lives in `public.message_assets` and `public.message_asset_links`, not in `public.message_attachments`.

Required additions when DM E2EE is enabled:

- `content_mode`
- `sender_device_id`

Additional assumptions when DM E2EE is enabled:

- `content_mode = 'dm_e2ee_v1'` means direct-message text lives in ciphertext envelopes, not in `body`
- `body` must be `null` for encrypted DM text
- inbox and activity must use either a local device preview cache or a truthful generic fallback for encrypted DMs

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

- This table is still active, but no longer represents the full committed media runtime.
- Historical attachment rows and the current non-voice attachment send path still read/write here.
- Chat history loading still reads this table alongside `public.message_assets` / `public.message_asset_links`.
- Message cleanup still deletes legacy attachment objects from here when present.
- This table should now be treated as transitional for media evolution, not as the sole attachment source of truth.

## `public.message_assets`

Required columns used by current code:

- `id`
- `conversation_id`
- `created_by`
- `kind`
- `source`
- `storage_bucket`
- `storage_object_path`
- `external_url`
- `mime_type`
- `file_name`
- `size_bytes`
- `duration_ms`
- `created_at`

Assumptions:

- This is the active committed media metadata table for current voice-note runtime.
- Current voice sends upload the binary first, then persist one committed asset row here with `kind = 'voice-note'`.
- `storage_bucket` and `storage_object_path` must point at the real media object in Supabase Storage when `source = 'supabase-storage'`.
- `duration_ms` is the committed voice-note duration used by thread UI; inbox/activity must not load the blob to derive it.
- This table is also the intended forward path for future image/file/audio media work beyond voice.

## `public.message_asset_links`

Required columns used by current code:

- `id`
- `message_id`
- `asset_id`
- `ordinal`
- `render_as_primary`
- `created_at`

Assumptions:

- This table links committed media assets to their parent message rows.
- Current voice sends create exactly one link row from the committed `messages.kind = 'voice'` row to the committed `message_assets.kind = 'voice-note'` row.
- `ordinal` and `render_as_primary` are part of the active projection contract used by current thread history mapping.
- Missing this table or its expected columns is now a real production blocker for committed voice/media rendering.

## `storage.buckets` / canonical media bucket

Required current buckets:

- `avatars`
- `message-media`

Assumptions:

- Active chat media and voice uploads use the canonical `message-media` bucket.
- The older `message-attachments` bucket name should now be treated as stale legacy naming, not an active runtime target.
- Current voice/media debugging should verify the actual upload target against `message-media`.

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

## DM E2EE foundation

These schema elements support the current authenticated device-bootstrap path, encrypted DM send, encrypted DM receive, and local-preview-compatible rendering. They do not mean full encrypted messenger feature parity.

### `public.user_devices`

Active role when DM E2EE is enabled:

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

Active role when DM E2EE is enabled:

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

Active additions when DM E2EE is enabled:

- `content_mode`
- `sender_device_id`

Current assumptions once DM E2EE is enabled:

- `kind` remains the semantic message kind such as `text` or `voice`
- `content_mode = 'plaintext'` keeps current behavior
- `content_mode = 'dm_e2ee_v1'` means `body` must be `null`
- encrypted DM text must live only in per-device ciphertext envelopes, not in `body`

### `public.message_e2ee_envelopes`

Active role when DM E2EE is enabled:

- one opaque ciphertext envelope per target device for encrypted DM text

Planned columns:

- `id`
- `message_id`
- `recipient_device_id`
- `envelope_type`
- `ciphertext`
- `used_one_time_prekey_id`
- `created_at`

## Prepared v1 space model

These schema elements define the v1 tenancy and access boundary for CHAT.
They are intentionally separate from DM E2EE confidentiality. Space ownership
or admin rights do not grant access to encrypted DM plaintext.

### `public.spaces`

Prepared role for space-scoped messaging:

- one top-level container per project, team, or client context
- owns its own naming and broader settings boundary
- contains both direct messages and group chats
- one selected space should become the active app context at runtime

Planned columns:

- `id`
- `name`
- `created_by`
- `created_at`
- `updated_at`

Current assumptions:

- one auth user can own a space
- a user can belong to multiple spaces
- spaces are the outer access boundary for conversations
- active-space routing resolves against this table at runtime
- current first-step rollout expects a default `TEST` space to exist

### `public.space_members`

Prepared role for space access:

- membership table for who can enter a space
- minimal role support for v1: `owner`, `admin`, `member`

Planned columns:

- `space_id`
- `user_id`
- `role`
- `created_at`

Current assumptions:

- conversation membership should remain inside the parent space membership set
- space roles are access and administration primitives, not decryption privileges
- exactly one owner per space is the intended v1 default
- `space_members` is broader than `conversation_members`; it is the outer access boundary, not the per-chat participant list
- inbox, activity, and chat access rely on `space_members` to decide which spaces a user may actively enter
- current first-step rollout backfills current conversation participants into the default `TEST` space

### `public.conversations.space_id`

Prepared role for space scoping:

- every DM and every group chat belongs to exactly one space
- no cross-space conversations
- no global DMs outside spaces

Current required migration shape:

- add `space_id` first for safe rollout on drifted databases
- backfill legacy conversations into the default `TEST` space first
- tighten to `not null` before treating the production runtime as healthy
- conversation membership should only be considered valid when it remains inside the parent space boundary
- inbox and activity filters already scope by selected `space_id`
- chat entry already validates that the conversation belongs to the current parent `space_id`

### Query and routing surfaces that still need fuller active-space treatment

These are the main runtime surfaces that already accept or depend on an active
`spaceId`, but still need fuller UX or redirect normalization:

- [server.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/data/server.ts)
  `getInboxConversations`, `getArchivedConversations`, `getConversationForUser`,
  `getAvailableUsers`, `findExistingActiveDmConversation`,
  `createConversationWithMembers`
- [actions.ts](/Users/danya/IOS%20-%20Apps/CHAT/app/%28app%29/inbox/actions.ts)
- [actions.ts](/Users/danya/IOS%20-%20Apps/CHAT/app/%28app%29/chat/%5BconversationId%5D/actions.ts)
- [page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/%28app%29/inbox/page.tsx)
- [page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/%28app%29/activity/page.tsx)
- [page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/%28app%29/chat/%5BconversationId%5D/page.tsx)
- [inbox-sync.tsx](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/realtime/inbox-sync.tsx)
- [active-chat-sync.tsx](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/realtime/active-chat-sync.tsx)

## Required migrations before deploy

These schema changes must exist in Supabase for the current app to run safely:

1. `public.conversation_members.hidden_at`
   Source file: [2026-04-03-conversation-member-hidden-at.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-03-conversation-member-hidden-at.sql)

2. `public.conversation_members.notification_level`
   Source file: [2026-04-03-conversation-member-notification-level.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-03-conversation-member-notification-level.sql)

3. `public.profiles.preferred_language`
   Source file: [2026-04-03-profiles-preferred-language.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-03-profiles-preferred-language.sql)

4. `public.messages.kind` runtime align for active `voice` support
   Source file: [2026-04-06-messages-kind-runtime-align.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-06-messages-kind-runtime-align.sql)

5. `public.message_assets` and `public.message_asset_links` runtime align for committed voice/media
   Source file: [2026-04-06-message-assets-runtime-align.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-06-message-assets-runtime-align.sql)

6. `storage.objects` / `storage.buckets` policy setup for canonical `message-media`
   Source file: [2026-04-06-message-attachments-storage-policies.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-06-message-attachments-storage-policies.sql)

7. `public.conversations.space_id` final active-space alignment
   Source file: [2026-04-05-conversations-space-id-required.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-05-conversations-space-id-required.sql)

Operational note:

- keep `public.message_attachments` in place for now; current runtime still reads it for legacy/non-voice attachment rows even though committed voice now depends on `message_assets` / `message_asset_links`

## Recommended hardening before broader testing

1. `public.conversations.dm_key`
   Source file: [2026-04-04-dm-uniqueness-hardening.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-04-dm-uniqueness-hardening.sql)

2. `public.conversations.avatar_path`
   Source file: [2026-04-05-conversations-avatar-path.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-05-conversations-avatar-path.sql)

## Historical space-scoping migrations

These earlier files are still useful for understanding rollout history, but the
current production target should apply the final required alignment file above
when `public.conversations.space_id` is missing, nullable, or not backfilled.

1. `public.spaces`, `public.space_members`, and `public.conversations.space_id`
   Source file: [2026-04-03-spaces-v1.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-03-spaces-v1.sql)

2. default `TEST` space seed and backfill of current conversations/members
   Source file: [2026-04-03-spaces-default-test-backfill.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-03-spaces-default-test-backfill.sql)

3. production alignment patch when `spaces`/`space_members` already exist but
   `conversations.space_id` is missing or not backfilled
   Source file: [2026-04-03-conversations-space-id-v1-align.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-03-conversations-space-id-v1-align.sql)

## Required migrations before enabling DM E2EE bootstrap

Do not apply these as a user-facing "encrypted messaging is live" claim by themselves. They enable device registration, public prekey publication, and ciphertext DM send storage only.

1. `public.user_devices` and `public.device_one_time_prekeys`
   Source file: [2026-04-03-user-devices-and-prekeys.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-03-user-devices-and-prekeys.sql)

2. `public.messages.content_mode` and `public.messages.sender_device_id`
   Source file: [2026-04-03-messages-content-mode.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-03-messages-content-mode.sql)

3. `public.message_e2ee_envelopes`
   Source file: [2026-04-03-message-e2ee-envelopes.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-03-message-e2ee-envelopes.sql)

4. `public.send_dm_e2ee_message_atomic(...)`
   Source file: [2026-04-03-dm-e2ee-send-atomic.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-03-dm-e2ee-send-atomic.sql)

Operational alignment note for partial production rollouts:

- if chat loading fails with missing `messages.sender_device_id` or
  `messages.content_mode`, apply:
  [2026-04-03-messages-shell-e2ee-v1-align.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-03-messages-shell-e2ee-v1-align.sql)

- if encrypted DM send fails with generic send errors or policy-blocked prekey
  claims, apply:
  [2026-04-03-dm-e2ee-send-atomic-rls-align.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-03-dm-e2ee-send-atomic-rls-align.sql)

## Current defensive behavior in code

- Missing `profiles.avatar_path` is tolerated.
- Missing `profiles.preferred_language` falls back to cookie/default language for reads, but language preference updates still require the migration.
- Missing `profiles.status_emoji` / `status_text` / `status_updated_at` now falls back to authenticated `user_metadata` for the current user's own settings screen, but shared chat/profile surfaces still require the migration.
- Missing `conversation_members.last_read_message_seq` / `last_read_at` falls back to `null` read state.
- Missing `conversation_members.hidden_at` no longer causes a raw confusing crash on the main inbox path, but archive-related behavior still requires the migration.
- Missing `conversation_members.notification_level` falls back to `default` for conversation loading, but preference updates still require the migration.
- If `messages.kind` is restricted to older values, voice-message inserts require the runtime-align migration before they can be stored safely.
- If `message_assets` / `message_asset_links` or their expected columns are missing, committed voice send and chat-thread media projection can fail even when the base `messages` row exists.
- If the canonical `message-media` storage bucket or its policies are missing, committed voice upload fails before asset persistence completes.
- Legacy `message_attachments` absence is now less critical for committed voice than missing `message_assets` / `message_asset_links`, but non-voice attachments and historical attachment rows still depend on it.
- If `conversations.dm_key` is missing, direct-message creation still falls back to active-member lookup, but race-safe one-DM-per-pair enforcement depends on the migration set in [2026-04-04-dm-uniqueness-hardening.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-04-dm-uniqueness-hardening.sql).
- DM text E2EE is only partially active today. Direct-message text can now be uploaded as ciphertext for the DM-only encrypted send path, and the current device can decrypt those encrypted DM messages in-thread. Inbox rows may use a device-local decrypted preview cache when available; the server still cannot read DM preview text.
- DM search remains server-blind for encrypted text. Current search continues to work for conversation and participant identity, but not encrypted DM plaintext.
- Runtime rollout is also gated by environment configuration:
  - `CHAT_DM_E2EE_ROLLOUT=disabled|selected|all`
  - `CHAT_DM_E2EE_TESTER_USER_IDS=<comma-separated auth user ids>`
  - `CHAT_DM_E2EE_TESTER_EMAILS=<comma-separated auth emails>` (optional convenience allowlist)
- The recommended operational checklist lives in [dm-e2ee-rollout-checklist.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/dm-e2ee-rollout-checklist.md).

## Highest-risk assumptions right now

- `conversation_members.hidden_at`
- `conversation_members.notification_level`
- `profiles.preferred_language`
- `conversation_members.last_read_message_seq`
- `conversation_members.last_read_at`

These fields directly affect language preference persistence, inbox loading, archive behavior, notification preferences, and read/unread UX.

Current media/voice production blockers to watch with equal priority:

- `messages.kind` allowing `voice`
- `message_assets`
- `message_asset_links`
- canonical `message-media` bucket and policies
