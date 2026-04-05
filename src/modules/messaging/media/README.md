# Messaging Media

This folder defines the long-term boundary for file, image, audio, and voice-note asset handling.

Planned responsibilities:

- Stable media asset contracts.
- Upload-job lifecycle types and orchestration interfaces.
- Separation between binary upload transport and message-visible metadata.
- Future media-specific runtime helpers that should not live in the chat route.

Keep this layer free of thread-route rendering assumptions where possible.
