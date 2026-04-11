# Messaging Data

This folder will hold persistence-facing messaging logic.

Planned responsibilities:

- Supabase data access for messaging entities.
- Query and mutation boundaries for conversations and messages.
- Repository-style logic that translates between the database model and messaging contracts.

Do not place page or component logic here.

Route-level access resolution now belongs in:

- [server/README.md](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/server/README.md)

Keep `data/` focused on persistence-facing logic rather than Messenger page
composition.

Current KeepCozy companion-metadata note:

- [conversation-companion-metadata.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/data/conversation-companion-metadata.ts)
  is the only file on the current backend branch that should touch
  `public.conversation_companion_metadata` directly
- [conversation-thread-context.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/data/conversation-thread-context.ts)
  is the first access-checked conversation-level composition helper that can
  layer optional companion metadata beside the existing conversation shell
- `server.ts` is currently a compatibility facade plus the remaining
  conversation/message-heavy loaders that have not been split yet
- domain-focused write ownership is being moved into files such as
  [profiles-server.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/data/profiles-server.ts),
  [reactions-server.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/data/reactions-server.ts),
  and
  [conversation-admin-server.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/data/conversation-admin-server.ts)
- this branch-level helper boundary is not a policy engine and not a timeline
  writer; later branches should keep access mapping and event emission separate
- do not add direct companion-metadata reads/writes in page actions, history
  loaders, or UI code first
