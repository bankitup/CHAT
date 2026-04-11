# Messaging Server Seams

This folder holds access-checked messaging capability helpers that sit above
raw data access but below product route composition.

Use this layer for:

- active-space resolution needed by messaging capability surfaces
- conversation-route access resolution and canonicalization
- shared server-side capability seams that Messenger routes can consume
- Messenger product page loaders that keep route files focused on composition

Do not place in this folder:

- page or component rendering logic
- web-only shell behavior
- KeepCozy product orchestration
- low-level table adapters that belong in `data/`

Current seams:

- [route-context.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/server/route-context.ts)
  centralizes shared inbox/chat route access resolution so other products do
  not need to depend on Messenger route files just to reuse messaging
  capability behavior.
- [operational-activity.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/server/operational-activity.ts)
  owns product-neutral conversation activity shaping for KeepCozy and future
  operational consumers.
- [operational-thread-context.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/server/operational-thread-context.ts)
  exposes the access-checked operational thread context seam without forcing
  consumers into `data/conversation-thread-context.ts`.
- [inbox-page.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/server/inbox-page.ts)
  owns Messenger inbox page loading and SSR shaping.
- [thread-page.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/server/thread-page.ts)
  owns Messenger thread page loading, canonicalization, and thread data
  orchestration.
- [thread-settings-page.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/server/thread-settings-page.ts)
  owns Messenger thread-settings page loading and participant/settings shaping.
- [settings-page.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/server/settings-page.ts)
  owns Messenger settings page loading and product-posture redirects.
