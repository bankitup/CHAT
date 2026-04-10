# Messaging Media

This folder defines the current and long-term boundary for file, image, audio, and voice-note asset handling.

Current MVP contract:

- Composer/runtime picks camera, gallery, or file locally in the chat route.
- Binary objects upload into the private `message-media` Supabase Storage bucket.
- Committed media metadata lives in `public.message_assets`.
- Message-to-asset linkage lives in `public.message_asset_links`.
- Chat history rendering resolves media through membership-controlled same-origin delivery routes.
- The app no longer depends on exposing Supabase Storage signed object URLs directly to chat clients.
- Chat history rendering resolves membership-controlled signed URLs for reads.
- User-facing chat attachment delivery supports only storage-backed assets on the private `message-media` bucket. `external-url` asset rows are not treated as a public delivery shortcut.
- Inbox/activity preview logic uses message kind plus asset metadata, not public object URLs.
- Legacy `public.message_attachments` remains as a read fallback for historical rows only.

Current responsibilities here:

- Stable media asset contracts.
- Committed `message_assets` and `message_asset_links` helpers.
- Upload-job lifecycle types and orchestration interfaces.
- Message-to-media metadata separation.
- Voice-message draft, commit, and playback contracts.
- Shared asset kind / preview mode helpers that should not live in route code.

Deferred follow-up:

- Background orphan cleanup for uploaded objects whose metadata commit fails after retries.
- Legacy `message_attachments` retirement once historical rows are migrated or no longer needed.
- Richer media processing such as thumbnails or video-specific handling.

Keep this layer free of thread-route rendering assumptions where possible.
