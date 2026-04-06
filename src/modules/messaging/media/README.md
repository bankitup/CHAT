# Messaging Media

This folder defines the long-term boundary for file, image, audio, and voice-note asset handling.

Planned responsibilities:

- Stable media asset contracts.
- Committed `message_assets` and `message_asset_links` model scaffolding.
- Upload-job lifecycle types and orchestration interfaces.
- Message-to-media metadata separation.
- Voice-message draft, commit, and playback contracts.
- Separation between binary upload transport and message-visible metadata.
- Future media-specific runtime helpers that should not live in the chat route.

Keep this layer free of thread-route rendering assumptions where possible.
