# Module Boundary Index

## Purpose

This document is a fast ownership map for the current repository.

Use it when someone asks:

- where should this work live?
- who owns this module today?
- what is the safest entry seam for this area?

This is a current-state index, not an idealized future tree.
Some rows are intentionally labeled `mixed / needs cleanup` because that is the
honest current state.

## Owner Layer Legend

- `platform`
- `shared capability`
- `product: Messenger`
- `product: KeepCozy`
- `mixed / needs cleanup`

## `src/lib/**`

| Path / module | Owner layer | Purpose | Common consumers | Notes |
| --- | --- | --- | --- | --- |
| `src/lib/request-context/server.ts` | `platform` | Request viewer/session resolution and request-scoped server helpers | `app/(app)/layout.tsx`, `src/modules/spaces/server.ts`, KeepCozy server loaders, messaging server loaders | Primary entry seam for authenticated server work. |
| `src/lib/supabase/server.ts` | `platform` | Request-scoped Supabase server client | shared route loaders, platform and product server modules | Use for viewer-scoped reads/writes. |
| `src/lib/supabase/service.ts` | `platform` | Service-role Supabase client creation | `src/modules/spaces/server.ts`, messaging data/server helpers | Use carefully; do not bypass access checks casually. |
| `src/lib/supabase/client.ts` | `platform` | Browser-side Supabase client wiring | client runtime that needs browser auth session access | Runtime utility, not product logic. |

## `src/modules/spaces/**`

| Path / module | Owner layer | Purpose | Common consumers | Notes |
| --- | --- | --- | --- | --- |
| `src/modules/spaces/access.ts` | `platform` | Shared space access contract and access-state rules | `src/modules/spaces/server.ts`, messaging route context | Clean platform seam. |
| `src/modules/spaces/governance.ts` | `platform` | Shared governance/admin role rules | `src/modules/spaces/server.ts`, `app/(app)/spaces/**` | Closest active platform admin/governance seam. |
| `src/modules/spaces/server.ts` | `platform` | Active-space resolution, shared membership/runtime access, participant lookup | `app/(app)/layout.tsx`, KeepCozy loaders, messaging server loaders | Preferred server entry point for space-scoped access work. |
| `src/modules/spaces/write-server.ts` | `platform` | Governed writes for shared space administration | `app/(app)/spaces/actions.ts` | Platform write/admin seam. |
| `src/modules/spaces/url.ts` | `platform` | Shared space URL shaping | messaging server loaders, shared routes, product routes | Preferred helper for preserving `space` query posture. |
| `src/modules/spaces/types.ts` | `platform` | Shared space-facing type helpers | shared route and module typing | Keep contracts small and neutral. |
| `src/modules/spaces/plan-config.ts` | `platform` | Shared space-plan config vocabulary | home/space admin surfaces | Platform-adjacent shared config. |
| `src/modules/spaces/model.ts` | `mixed / needs cleanup` | Space model plus current product posture vocabulary | `src/modules/spaces/server.ts`, shell posture helpers, shared layout | Still encodes `messenger_full` and `keepcozy_ops`; do not expand product posture here. |
| `src/modules/spaces/posture.ts` | `mixed / needs cleanup` | Space profile/theme resolution and shell defaults | `src/modules/spaces/server.ts`, `app/(app)/layout.tsx` | Platform-adjacent but still carries product defaults and legacy behavior. |
| `src/modules/spaces/shell.ts` | `mixed / needs cleanup` | Shared shell posture and nav shaping | `app/(app)/app-shell-frame.tsx` | Current drift seam; avoid adding more product policy here. |
| `src/modules/spaces/space-timeline-events.ts` | `platform` | Shared space timeline/event vocabulary | space/member/admin surfaces | Shared governance/support-adjacent seam. |

## `src/modules/profile/**`

| Path / module | Owner layer | Purpose | Common consumers | Notes |
| --- | --- | --- | --- | --- |
| `src/modules/profile/types.ts` | `platform` | Shared profile identity contracts | messaging read seams, settings surfaces, profile UI | Preferred type source for identity work. |
| `src/modules/profile/avatar.ts` | `platform` | Shared avatar rules and formatting helpers | profile UI, space/member surfaces, messaging identity rendering | Shared identity primitive. |
| `src/modules/profile/ui/**` | `platform` | Shared identity/avatar/status UI primitives | chat header, settings, shared profile rendering | Prefer these over legacy `messaging/ui/identity*` compatibility shims. |
| `src/modules/profile/server.ts` | `mixed / needs cleanup` | Shared server entry seam for current-user profile work | `app/(app)/settings/**`, other shared user-profile flows | Intended shared entry point, but currently backed by messaging-owned persistence. |

## `src/modules/ui-preferences/**`

| Path / module | Owner layer | Purpose | Common consumers | Notes |
| --- | --- | --- | --- | --- |
| `src/modules/ui-preferences/app-zoom.ts` | `platform` | Shared runtime zoom preference helpers | home zoom UI, client preference consumers | Small but clean shared seam. |
| `src/modules/ui-preferences/app-zoom-server.ts` | `platform` | Server-side zoom preference persistence/read seam | home/settings/shared shell consumers | Use for cross-product runtime preference work. |

## `src/modules/i18n/**`

| Path / module | Owner layer | Purpose | Common consumers | Notes |
| --- | --- | --- | --- | --- |
| `src/modules/i18n/index.ts` | `platform` | Full shared translation system | server loaders, route composition, some shared runtime | Broad entry; avoid in hot client code when narrower client dictionaries exist. |
| `src/modules/i18n/server.ts` | `platform` | Server-side language/request helpers | page loaders, server actions | Preferred server entry for locale resolution. |
| `src/modules/i18n/client.ts` | `platform` | Slim client-facing translation dictionaries | shell, inbox, chat, home client surfaces | Prefer in client-heavy surfaces over importing the full index. |

## `src/modules/messaging/**`

### Contracts, Reads, And Server Seams

| Path / module | Owner layer | Purpose | Common consumers | Notes |
| --- | --- | --- | --- | --- |
| `src/modules/messaging/contract/**` | `shared capability` | Messaging contracts and cross-runtime type vocabulary | data layer, E2EE, server loaders, API routes | Stable capability contract layer. |
| `src/modules/messaging/data/conversation-read-server.ts` | `shared capability` | Narrow conversation, inbox, participant, and read-state reads | `src/modules/messaging/server/inbox-page.ts`, thread loaders, product actions | Preferred narrow read seam for conversation/inbox work. |
| `src/modules/messaging/data/thread-read-server.ts` | `shared capability` | Narrow thread/history, sender, attachment, and auto-restore health reads | `src/modules/messaging/server/thread-page.ts`, thread recovery, inbox DM reuse guard | Preferred narrow read seam for thread/history work. |
| `src/modules/messaging/data/conversation-admin-server.ts` | `shared capability` | Conversation admin and destructive lifecycle writes | chat/settings actions, cleanup flows | Use for conversation-level admin writes. |
| `src/modules/messaging/data/reactions-server.ts` | `shared capability` | Reaction write/read helpers | thread route actions/runtime | Bounded domain seam. |
| `src/modules/messaging/data/message-shell.ts` | `shared capability` | Message-shell shaping helpers | thread and inbox shaping | Capability-side composition helper. |
| `src/modules/messaging/data/visibility.ts` | `shared capability` | Conversation visibility/hide semantics | inbox reads, DM lifecycle flows | Core lifecycle seam; avoid duplicating visibility logic. |
| `src/modules/messaging/data/profiles-server.ts` | `mixed / needs cleanup` | Messaging-owned profile persistence backing | `src/modules/profile/server.ts`, settings flows, identity helpers | Real drift seam; currently shared-adjacent but still messaging-owned. |
| `src/modules/messaging/data/server.ts` | `shared capability` | Compatibility facade and remaining large messaging data seam | older actions/loaders, capability exports, constants | Avoid new broad imports when a narrower seam already exists. |
| `src/modules/messaging/server/route-context.ts` | `shared capability` | Access-checked route context for messaging surfaces | thread/inbox loaders, operational consumers | Preferred access-checked messaging route seam. |
| `src/modules/messaging/server/operational-thread-context.ts` | `shared capability` | Access-checked operational thread context | KeepCozy or future operational consumers | Use instead of reaching into Messenger route files. |
| `src/modules/messaging/server/operational-activity.ts` | `shared capability` | Product-neutral activity shaping for messaging conversations | activity surfaces, operational consumers | Shared capability seam, not Messenger page code. |
| `src/modules/messaging/server/inbox-page.ts` | `product: Messenger` | Messenger inbox page loader and SSR shaping | `app/(app)/inbox/page.tsx` | Messenger-first loader living in capability-adjacent folder. |
| `src/modules/messaging/server/thread-page.ts` | `product: Messenger` | Messenger thread page loader and render orchestration | `app/(app)/chat/[conversationId]/page.tsx` | Product loader; do not treat as a generic capability read seam. |
| `src/modules/messaging/server/thread-settings-page.ts` | `product: Messenger` | Messenger thread settings loader | `app/(app)/chat/[conversationId]/settings/page.tsx` | Product-first orchestration. |
| `src/modules/messaging/server/settings-page.ts` | `mixed / needs cleanup` | Shared-looking settings loader still tied to Messenger posture | `app/(app)/settings/page.tsx` | Needs extraction toward shared profile/settings ownership. |

### Realtime, Push, E2EE, Media

| Path / module | Owner layer | Purpose | Common consumers | Notes |
| --- | --- | --- | --- | --- |
| `src/modules/messaging/realtime/**` | `shared capability` | Thread/inbox live state, optimistic updates, patch stores, realtime sync | chat runtime, inbox runtime | Messaging-owned realtime capability. |
| `src/modules/messaging/push/**` | `shared capability` | Messaging unread badge, presence sync, push contracts | shared shell, inbox, thread runtime | Shared capability, but do not mount from the shell too broadly. |
| `src/modules/messaging/e2ee/**` | `shared capability` | DM E2EE rollout, device state, UI policy, local state boundary | encrypted DM routes, thread and inbox runtime | Important messaging security capability, not platform foundation. |
| `src/modules/messaging/media/**` | `shared capability` | Message assets, media metadata, upload jobs, voice policy | composer, thread runtime, attachment delivery routes | Preferred entry area for asset/media contract changes. |
| `src/modules/messaging/rtc/**` | `shared capability` | RTC/media signaling contracts | future call/media paths | Capability-owned communications runtime. |
| `src/modules/messaging/privacy/**` | `shared capability` | Messaging privacy rules | inbox preview policy, route shaping | Capability-specific privacy seam. |
| `src/modules/messaging/sdk/**` | `shared capability` | SDK-style notifications/badge helpers | push/unread integrations | Bounded helper layer. |

### UI And Diagnostics

| Path / module | Owner layer | Purpose | Common consumers | Notes |
| --- | --- | --- | --- | --- |
| `src/modules/messaging/ui/user-facing-errors.ts` | `mixed / needs cleanup` | Shared user-facing error sanitation and fallbacks | Messenger actions, KeepCozy actions, spaces actions, home actions | Behavior is broader than messaging, namespace is not. |
| `src/modules/messaging/ui/identity*.tsx` | `shared capability` | Legacy messaging identity presentation shims | older messaging surfaces | Prefer `src/modules/profile/ui/**` for new shared identity work. |
| `src/modules/messaging/diagnostics/thread-history-proof.ts` | `shared capability` | Broken-thread proof helpers and history diagnostics | thread loader/runtime rescue diagnostics | Capability diagnostic seam, not general platform logging. |
| `src/modules/messaging/avatar-delivery.ts` | `shared capability` | Avatar delivery shaping in messaging contexts | messaging identity and attachment-adjacent flows | Messaging-owned delivery helper. |
| `src/modules/messaging/profile-avatar.ts` | `shared capability` | Messaging-facing avatar helper seam | messaging surfaces | Capability-specific compatibility helper. |

## `src/modules/keepcozy/**`

| Path / module | Owner layer | Purpose | Common consumers | Notes |
| --- | --- | --- | --- | --- |
| `src/modules/keepcozy/server.ts` | `product: KeepCozy` | Main KeepCozy server runtime and data shaping | home route, rooms/issues/tasks pages | Preferred KeepCozy read/composition entry point. |
| `src/modules/keepcozy/write-server.ts` | `product: KeepCozy` | KeepCozy write orchestration | issues/tasks/home actions | Preferred write seam for KeepCozy domain changes. |
| `src/modules/keepcozy/mvp-preview.ts` | `product: KeepCozy` | Preview/fallback shaping for early KeepCozy runtime | KeepCozy server entry, home route | Product shaping, not shared foundation. |
| `src/modules/keepcozy/messaging-adapter.ts` | `product: KeepCozy` | KeepCozy-owned integration seam into messaging capability | future/product-specific chat composition | Product adapter, not platform or messaging core. |
| `src/modules/keepcozy/contract-types.ts` | `product: KeepCozy` | KeepCozy domain contract vocabulary | KeepCozy route/server layers | Product contract layer. |

## `app/(app)/**`

### Shared Authenticated Shell And Shared Surfaces

| Path / module | Owner layer | Purpose | Common consumers | Notes |
| --- | --- | --- | --- | --- |
| `app/(app)/layout.tsx` | `platform` | Shared authenticated layout and route shell entry | all authenticated product routes | Shared entry point; currently depends on mixed posture helpers. |
| `app/(app)/loading.tsx` | `platform` | Shared loading shell | all authenticated product routes | Shared runtime shell behavior. |
| `app/(app)/error.tsx` | `platform` | Shared authenticated route error boundary | all authenticated product routes | Shared recovery seam. |
| `app/(app)/actions.ts` | `platform` | Shared auth/session actions such as logout | shared shell | Minimal platform action surface. |
| `app/(app)/guarded-server-action-form.tsx` | `platform` | Shared guarded submit pattern | settings, spaces, product forms | Shared recovery/protection seam. |
| `app/(app)/app-shell-frame.tsx` | `mixed / needs cleanup` | Shared shell frame, product posture, nav, gated Messenger runtime | all authenticated routes | Shared shell, but still too aware of Messenger runtime and product posture. |
| `app/(app)/spaces/**` | `platform` | Shared space selection/member admin surfaces | shared authenticated routes, admin/support flows | Active platform support/admin surface. |
| `app/(app)/settings/**` | `mixed / needs cleanup` | Shared profile/settings UI with mixed loader ownership | both products | Surface is shared; page loading is still mixed. |

### Messenger Product Routes

| Path / module | Owner layer | Purpose | Common consumers | Notes |
| --- | --- | --- | --- | --- |
| `app/(app)/inbox/**` | `product: Messenger` | Inbox list, create DM, previews, realtime list behavior | Messenger users, chat entry flow | Clear Messenger product route area. |
| `app/(app)/chat/[conversationId]/**` | `product: Messenger` | Thread route, message rows, composer, voice, rescue, viewer | Messenger thread entry and conversation runtime | Main Messenger product surface on top of messaging capability. |
| `app/(app)/activity/**` | `mixed / needs cleanup` | Messenger activity plus current mixed posture branch | authenticated product users | Still a mixed route that needs clearer composition. |

### KeepCozy Product Routes

| Path / module | Owner layer | Purpose | Common consumers | Notes |
| --- | --- | --- | --- | --- |
| `app/(app)/rooms/**` | `product: KeepCozy` | KeepCozy rooms product surface | KeepCozy users | Clear product route area. |
| `app/(app)/issues/**` | `product: KeepCozy` | KeepCozy issues product surface | KeepCozy users | Clear product route area. |
| `app/(app)/tasks/**` | `product: KeepCozy` | KeepCozy tasks product surface | KeepCozy users | Clear product route area. |

### Mixed Product Routes

| Path / module | Owner layer | Purpose | Common consumers | Notes |
| --- | --- | --- | --- | --- |
| `app/(app)/home/**` | `mixed / needs cleanup` | Shared route hosting current product-specific home behavior | Messenger and KeepCozy posture branches | One of the biggest mixed route seams in the repo. |

## `app/api/**`

| Path / module | Owner layer | Purpose | Common consumers | Notes |
| --- | --- | --- | --- | --- |
| `app/api/messaging/conversations/[conversationId]/history/route.ts` | `shared capability` | Membership-controlled history reads | Messenger thread runtime, possible future consumers | Prefer route/context and narrow read seams behind it. |
| `app/api/messaging/conversations/[conversationId]/messages/[messageId]/attachments/[attachmentId]/content/route.ts` | `shared capability` | Same-origin attachment content delivery | thread attachments, image viewer, voice/audio | Core delivery route for messaging media. |
| `app/api/messaging/conversations/[conversationId]/messages/[messageId]/attachments/[attachmentId]/signed-url/route.ts` | `shared capability` | Membership-controlled signed URL resolution | thread media/voice runtime | Delivery seam; keep route contract stable. |
| `app/api/messaging/avatar/[...objectPath]/route.ts` | `shared capability` | Avatar delivery route | messaging/profile consumers | Shared capability route, not generic platform media. |
| `app/api/messaging/inbox/create-targets/route.ts` | `shared capability` | DM/create target lookup | inbox create sheet | Messaging capability transport. |
| `app/api/messaging/unread-badge/route.ts` | `shared capability` | Unread badge data | badge sync, shell/runtime consumers | Messaging-owned unread surface. |
| `app/api/messaging/push-config/route.ts` | `shared capability` | Messaging push config | push registration flows | Messaging push transport. |
| `app/api/messaging/push-subscriptions/route.ts` | `shared capability` | Push subscription registration | shell and messaging runtime | Messaging push transport. |
| `app/api/messaging/push-test/route.ts` | `shared capability` | Push diagnostics/test route | internal verification flows | Capability debug surface. |
| `app/api/messaging/dm-e2ee/**` | `shared capability` | DM E2EE device, bundle, reset, send routes | encrypted DM runtime | Messaging security transport, not platform auth. |

## High-Risk Mixed Ownership Areas

These paths deserve extra caution because they are both important and easy to
misplace more logic into:

| Path / module | Why it is risky |
| --- | --- |
| `app/(app)/app-shell-frame.tsx` | Shared shell already carries product posture and Messenger runtime gravity. |
| `src/modules/spaces/model.ts` | Shared model still carries product posture vocabulary. |
| `src/modules/spaces/posture.ts` | Shared posture defaults still encode current products. |
| `src/modules/spaces/shell.ts` | Shared shell policy is still not cleanly platform-only. |
| `src/modules/profile/server.ts` | Shared-looking seam still routes through messaging-backed persistence. |
| `src/modules/messaging/data/profiles-server.ts` | Messaging-owned namespace still backs shared profile behavior. |
| `src/modules/messaging/ui/user-facing-errors.ts` | Cross-product helper still teaches the wrong ownership model. |
| `app/(app)/home/page.tsx` | Mixed product route and a large gravity point. |
| `app/(app)/activity/page.tsx` | Mixed route posture and product branching. |

## Practical Reading

When in doubt:

1. start from the narrowest seam in the right ownership layer
2. avoid expanding mixed seams just because they are already large
3. keep product policy out of platform code
4. keep route composition out of capability persistence modules
