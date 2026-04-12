# Repo Classification Current State

## Purpose

This document classifies the current repository against the BWC platform
doctrine.

It is intentionally practical:

- what is clearly platform foundation
- what is clearly shared capability
- what is clearly product logic
- what is mixed and should be cleaned up later

It does not assume that every important part of the repo is platform.
It does not treat future aspirations as active architecture.

## Layer Legend

- `platform foundation`
- `shared capability`
- `product-specific (Messenger)`
- `product-specific (KeepCozy)`
- `product-specific (future Lioka compatibility only)`
- `ops/company support`
- `drift / mixed ownership`
- `docs`

## Repo Entry And Docs

| Path | Current role | Intended layer | Notes |
| --- | --- | --- | --- |
| `README.md` | Repo entry posture | `docs` | Already reads the repo as BWC platform foundation plus separate products. |
| `docs/bwc-platform-doctrine.md` | Core BWC doctrine | `docs` | Source-of-truth for platform/company framing. |
| `docs/layer-ownership-rules.md` | Ownership decision rules | `docs` | Source-of-truth for platform vs capability vs product placement. |
| `docs/new-product-admission-checklist.md` | New-product gate | `docs` | Source-of-truth before adding Messenger/KeepCozy/Lioka-style products. |
| `docs/platform-architecture-*.md` | Current/target architecture reading | `docs` | Useful architecture truth docs; should align with doctrine docs above. |
| `docs/architecture-acceptance.md` and `docs/architecture-manual-verification.md` | Regression and verification guidance | `docs` | Cross-cutting operational documentation, not runtime ownership. |
| `docs/performance/**`, `docs/stability/**`, `docs/security/**` | Runtime hardening and product/capability notes | `docs` | Important, but not themselves platform code. |
| `docs/keepcozy-*.md` | KeepCozy product notes | `docs` | Product-specific documentation, not shared doctrine. |
| `docs/messaging-*.md`, `docs/dm-e2ee-*.md`, `docs/voice-*.md` | Messaging capability and Messenger runtime notes | `docs` | Capability/product docs, not platform doctrine. |

## Shared Runtime And Foundation

| Path | Current role | Intended layer | Notes |
| --- | --- | --- | --- |
| `src/lib/request-context/**` | Request viewer/session resolution | `platform foundation` | Clear cross-product base. |
| `src/lib/supabase/**` | Supabase client/service wiring | `platform foundation` | Clear platform infrastructure. |
| `app/(auth)/**` | Login/signup entry surfaces | `platform foundation` | Shared auth entry, not product-owned. |
| `app/(app)/layout.tsx` | Shared authenticated layout | `platform foundation` | Core shell entry; depends on `spaces` posture helpers. |
| `app/(app)/loading.tsx` | Shared authenticated route loading | `platform foundation` | Shared route behavior. |
| `app/(app)/error.tsx` | Shared authenticated route error boundary | `platform foundation` | Shared recovery shell, not product-specific. |
| `app/(app)/actions.ts` | Shared logout action | `platform foundation` | Minimal shared authenticated action. |
| `app/(app)/guarded-server-action-form.tsx` | Shared submit-lock form guard | `platform foundation` | Cross-surface runtime protection. |
| `src/modules/i18n/**` | Shared language/copy system | `platform foundation` | Used across Messenger and KeepCozy. |
| `src/modules/profile/types.ts` | Shared profile contracts | `platform foundation` | Clean shared identity vocabulary. |
| `src/modules/profile/avatar.ts` | Shared avatar rules | `platform foundation` | Shared profile/avatar foundation. |
| `src/modules/profile/ui/**` | Shared identity/avatar/status UI | `platform foundation` | Cross-product profile UI primitives. |
| `src/modules/profile/server.ts` | Shared profile server seam | `drift / mixed ownership` | Intended platform, but currently re-exports messaging-backed persistence. |
| `src/modules/ui-preferences/**` | Shared runtime preferences | `platform foundation` | Cross-product app-zoom/runtime preference seam. |
| `src/modules/spaces/access.ts` | Shared space access contract | `platform foundation` | Real cross-product access boundary. |
| `src/modules/spaces/governance.ts` | Shared space governance rules | `platform foundation` | Active platform governance base. |
| `src/modules/spaces/server.ts` | Shared active-space resolution | `platform foundation` | Clear platform runtime seam. |
| `src/modules/spaces/write-server.ts` | Shared governed space writes | `platform foundation` | Platform write/admin seam. |
| `src/modules/spaces/url.ts` | Shared space-scoped routing helpers | `platform foundation` | Cross-product routing utility. |
| `app/(app)/spaces/**` | Shared space selection/admin surfaces | `platform foundation` | Closest active support/admin surface in the repo. |
| `src/modules/spaces/model.ts` | Space model plus product posture vocabulary | `drift / mixed ownership` | Platform-adjacent, but currently encodes product profiles like `messenger_full` and `keepcozy_ops`. |
| `src/modules/spaces/posture.ts` | Space profile/theme resolution | `drift / mixed ownership` | Shared layer still contains product defaults and legacy KeepCozy-specific fallback. |
| `src/modules/spaces/shell.ts` | Shared shell posture and nav decisions | `drift / mixed ownership` | Shared layer currently owns Messenger/KeepCozy product posture logic. |
| `app/(app)/settings/**` | Shared profile/settings surface | `drift / mixed ownership` | Intended shared identity/settings area, but page loading still routes through Messenger loader logic. |
| `app/(app)/app-shell-frame.tsx` | Shared authenticated shell frame | `drift / mixed ownership` | Shared shell, but still owns product posture and Messenger runtime mounting. |

## Shared Capability

| Path | Current role | Intended layer | Notes |
| --- | --- | --- | --- |
| `src/modules/messaging/contract/**` | Messaging contracts | `shared capability` | Clear capability vocabulary. |
| `src/modules/messaging/data/conversation-read-server.ts` | Conversation/inbox reads | `shared capability` | Good narrowed read seam. |
| `src/modules/messaging/data/thread-read-server.ts` | Thread/history/media reads | `shared capability` | Good narrowed read seam. |
| `src/modules/messaging/data/conversation-admin-server.ts` | Conversation admin writes | `shared capability` | Capability-owned admin logic. |
| `src/modules/messaging/data/profiles-server.ts` | Profile persistence backing | `drift / mixed ownership` | Still messaging-owned even though profile concerns are now shared. |
| `src/modules/messaging/data/server.ts` | Compatibility facade + remaining monolith | `shared capability` | Still capability-owned, but overgrown and still a gravity source. |
| `src/modules/messaging/server/**` | Access-checked capability/server seams | `shared capability` | Correct direction; some files are Messenger-first page loaders. |
| `src/modules/messaging/realtime/**` | Messaging realtime runtime | `shared capability` | Bounded messaging runtime, Messenger-first consumer. |
| `src/modules/messaging/media/**` | Message media and voice handling | `shared capability` | Bounded messaging/media domain. |
| `src/modules/messaging/push/**` | Messaging push/device runtime | `shared capability` | Still Messaging-owned, not yet clean platform foundation. |
| `src/modules/messaging/e2ee/**` | DM E2EE runtime | `shared capability` | Messaging-owned security/runtime layer. |
| `src/modules/messaging/privacy/**` | Messaging privacy rules | `shared capability` | Capability-specific privacy policy, not platform baseline. |
| `src/modules/messaging/sdk/**` | Messaging SDK-style helpers | `shared capability` | Reusable capability surface. |
| `src/modules/messaging/rtc/**` | Media/RTC runtime | `shared capability` | Capability-specific communication runtime. |
| `src/modules/messaging/ui/identity*.tsx` | Compatibility shims for shared profile UI | `shared capability` | Kept for compatibility; not the source of truth anymore. |
| `src/modules/messaging/ui/user-facing-errors.ts` | Shared user-facing error sanitation | `drift / mixed ownership` | Behavior is reused beyond messaging, but namespace still says `messaging/ui`. |
| `app/api/messaging/**` | Messaging transport and delivery routes | `shared capability` | Capability APIs, not platform APIs. |

## Product-Specific: Messenger

| Path | Current role | Intended layer | Notes |
| --- | --- | --- | --- |
| `app/(app)/inbox/**` | Inbox and create-chat product surface | `product-specific (Messenger)` | Clear Messenger product entry. |
| `app/(app)/chat/[conversationId]/**` | Thread, composer, message-row, recovery, viewer, voice runtime | `product-specific (Messenger)` | Clear Messenger product surface on top of messaging capability. |
| `src/modules/messaging/server/inbox-page.ts` | Inbox page loader | `product-specific (Messenger)` | Lives in capability folder, but purpose is Messenger product composition. |
| `src/modules/messaging/server/thread-page.ts` | Thread page loader | `product-specific (Messenger)` | Capability-adjacent but Messenger-first orchestration. |
| `src/modules/messaging/server/thread-settings-page.ts` | Thread settings loader | `product-specific (Messenger)` | Messenger page orchestration. |
| `app/(app)/inbox/settings/**` | Inbox preferences/settings | `product-specific (Messenger)` | Messenger-specific settings surface. |

## Product-Specific: KeepCozy

| Path | Current role | Intended layer | Notes |
| --- | --- | --- | --- |
| `src/modules/keepcozy/**` | KeepCozy runtime, writes, adapters, product shaping | `product-specific (KeepCozy)` | Clear KeepCozy product domain. |
| `app/(app)/rooms/**` | KeepCozy rooms | `product-specific (KeepCozy)` | Clear KeepCozy surface. |
| `app/(app)/issues/**` | KeepCozy issues | `product-specific (KeepCozy)` | Clear KeepCozy surface. |
| `app/(app)/tasks/**` | KeepCozy tasks | `product-specific (KeepCozy)` | Clear KeepCozy surface. |
| `src/modules/keepcozy/messaging-adapter.ts` | KeepCozy entry seam into messaging capability | `product-specific (KeepCozy)` | Product-owned integration seam, not shared platform. |

## Mixed Product Routes

| Path | Current role | Intended layer | Notes |
| --- | --- | --- | --- |
| `app/(app)/home/**` | Shared route with Messenger and KeepCozy posture branches | `drift / mixed ownership` | One route still hosts multiple product experiences plus shared settings/admin pieces. |
| `app/(app)/activity/**` | Messenger activity plus KeepCozy operational branch | `drift / mixed ownership` | Current route is usable, but still mixes product posture and capability composition. |
| `app/(app)/settings/page.tsx` | Shared settings route | `drift / mixed ownership` | Reads like shared identity/settings, but currently loads through `loadMessengerSettingsPageData`. |

## Product-Specific: Future Lioka

| Path | Current role | Intended layer | Notes |
| --- | --- | --- | --- |
| No visible runtime code | No Lioka implementation present | `product-specific (future Lioka compatibility only)` | Lioka currently exists only as doctrine/admission guidance, not as active repo code. |
| `docs/bwc-platform-doctrine.md` and `docs/new-product-admission-checklist.md` | Lioka alignment guidance | `docs` | Useful for future compatibility, but not runtime ownership. |

## Ops / Company Support

| Path | Current role | Intended layer | Notes |
| --- | --- | --- | --- |
| `app/(app)/spaces/**` | Shared member/admin management surfaces | `platform foundation` with admin/support flavor | This is active support/admin behavior, but still platform governance, not a separate company-ops software layer. |
| `src/modules/spaces/governance.ts` | Governance/admin rules | `platform foundation` with admin/support flavor | Closest active shared admin/governance seam. |
| No standalone finance / HR / legal / pipeline modules | Not implemented as software yet | `ops/company support` planned later | Doctrine includes these roles, but the repo does not yet contain reusable runtime modules for them. |

## Clear Examples By Layer

### Clearly platform foundation

- `src/lib/request-context/**`
- `src/lib/supabase/**`
- `src/modules/i18n/**`
- `src/modules/profile/ui/**`
- `src/modules/spaces/access.ts`
- `src/modules/spaces/governance.ts`
- `src/modules/spaces/server.ts`
- `app/(auth)/**`
- `app/(app)/spaces/**`

### Clearly shared capability

- `src/modules/messaging/contract/**`
- `src/modules/messaging/realtime/**`
- `src/modules/messaging/media/**`
- `src/modules/messaging/e2ee/**`
- `app/api/messaging/**`

### Clearly Messenger product logic

- `app/(app)/inbox/**`
- `app/(app)/chat/[conversationId]/**`

### Clearly KeepCozy product logic

- `src/modules/keepcozy/**`
- `app/(app)/rooms/**`
- `app/(app)/issues/**`
- `app/(app)/tasks/**`

### Mixed and needing later cleanup

- `app/(app)/app-shell-frame.tsx`
- `src/modules/spaces/shell.ts`
- `src/modules/spaces/posture.ts`
- `app/(app)/home/**`
- `app/(app)/activity/**`
- `app/(app)/settings/page.tsx`
- `src/modules/profile/server.ts`
- `src/modules/messaging/data/profiles-server.ts`
- `src/modules/messaging/ui/user-facing-errors.ts`

## Honest Current Conclusion

The repo already has a real platform shape, but it is not a pure platform tree.

The current honest reading is:

- platform foundations are real
- messaging is a real shared capability
- Messenger and KeepCozy are real separate products
- Lioka is future doctrine only
- ops/company software is mostly not implemented yet
- the main cleanup work is around mixed shell posture, mixed routes, and a few
  lingering Messenger-centered seams inside shared areas
