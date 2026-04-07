# Messaging Data

This folder will hold persistence-facing messaging logic.

Planned responsibilities:

- Supabase data access for messaging entities.
- Query and mutation boundaries for conversations and messages.
- Repository-style logic that translates between the database model and messaging contracts.

Do not place page or component logic here.

Current KeepCozy companion-metadata note:

- [conversation-companion-metadata.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/data/conversation-companion-metadata.ts)
  is the only file on the current backend branch that should touch
  `public.conversation_companion_metadata` directly
- [conversation-thread-context.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/data/conversation-thread-context.ts)
  is the first access-checked conversation-level composition helper that can
  layer optional companion metadata beside the existing conversation shell
- `server.ts` remains the place for later access-checked conversation-level
  shell loaders that this companion-context helper builds on
- do not add direct companion-metadata reads/writes in page actions, history
  loaders, or UI code first
