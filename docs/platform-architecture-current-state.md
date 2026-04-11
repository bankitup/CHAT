# Platform Architecture Current State

## Purpose

This document describes the repo as it actually exists today.

It is intentionally honest about:

- what is already platform foundation
- what is Messenger product logic
- what is KeepCozy product logic
- what is shared capability
- where accidental coupling still exists

## Current Reading

The repository already behaves like a multi-product platform codebase, but the
top-level framing and some ownership seams still describe it as a shared
legacy single-product shell.

That mismatch is documentation and boundary clarity debt more than a missing
feature problem.

## 1. Platform Foundation

These areas already behave like platform-level foundation:

| Area | Current role | Real repo paths |
| --- | --- | --- |
| Auth and request viewer resolution | Shared runtime auth/session seam | `src/lib/request-context/server.ts`, `src/lib/supabase/server.ts`, `src/lib/supabase/service.ts` |
| Shared authenticated shell | One app shell hosting both product surfaces | `app/(app)/layout.tsx`, `app/(app)/app-shell-frame.tsx`, `app/(app)/actions.ts` |
| Shared space boundary | Outer tenancy and membership boundary for both messaging and KeepCozy data | `src/modules/spaces/server.ts`, `src/modules/spaces/write-server.ts`, `src/modules/spaces/model.ts`, `src/modules/spaces/governance.ts`, `src/modules/spaces/posture.ts`, `src/modules/spaces/shell.ts`, `src/modules/spaces/url.ts`, `app/(app)/spaces/**` |
| Shared i18n and copy system | Used across both products | `src/modules/i18n/**` |
| Shared profile/settings shell | Shared current-user profile/status entry surface | `app/(app)/settings/**` |

Why this already reads as platform:

- `spaces` is not Messenger-only.
- `spaces` is not KeepCozy-only.
- auth, routing, layout, and active-space resolution are already shared runtime
  infrastructure.

## 2. Messenger Product Logic

These areas are Messenger product surfaces or Messenger-first orchestration:

| Area | Current role | Real repo paths |
| --- | --- | --- |
| Inbox and new chat creation | Messenger product entry | `app/(app)/inbox/**` |
| Thread UI and composer runtime | Messenger product conversation surface | `app/(app)/chat/[conversationId]/**` |
| Messaging API routes | Messaging capability transport layer, currently serving Messenger product flows first | `app/api/messaging/**` |
| Messaging data/runtime modules | Messaging capability and Messenger-first orchestration | `src/modules/messaging/**` |
| Messenger activity surface | Messenger-facing activity route when profile is `messenger_full` | `app/(app)/activity/page.tsx` |

Important nuance:

- `src/modules/messaging` is broader than a UI feature folder.
- It already contains a substantial reusable capability:
  contracts, data writes, media, push, realtime, E2EE, and SDK-style helpers.
- Messenger is the main product surface that consumes that capability today.

## 3. KeepCozy Product Logic

These areas are clearly KeepCozy product domain code:

| Area | Current role | Real repo paths |
| --- | --- | --- |
| KeepCozy runtime reads and fallback preview model | KeepCozy product domain | `src/modules/keepcozy/server.ts`, `src/modules/keepcozy/mvp-preview.ts` |
| KeepCozy writes | KeepCozy product write orchestration | `src/modules/keepcozy/write-server.ts` |
| KeepCozy route surfaces | Rooms, issues, tasks, home-ops product UX | `app/(app)/rooms/**`, `app/(app)/issues/**`, `app/(app)/tasks/**` |
| KeepCozy-first home flow | Current shared route with product branching | `app/(app)/home/page.tsx` |

KeepCozy is not a Messenger profile in product terms.
It is already its own domain with its own write-server and route surfaces.

## 4. Shared Capability Seams

These seams should be treated as shared platform capabilities, even if their
current naming is still Messenger-heavy:

| Shared seam | Current repo paths | Why it is shared |
| --- | --- | --- |
| Spaces and membership | `src/modules/spaces/**` | Outer access boundary for both products |
| Messaging capability | `src/modules/messaging/**`, `app/api/messaging/**` | Messenger uses it directly now; KeepCozy may later compose parts of it |
| KeepCozy future contract drafts | `src/modules/keepcozy/contract-types.ts` | Product-specific future contract language no longer needs to live inside shared `spaces` runtime modules |
| Avatar/media delivery | `src/modules/messaging/avatar-delivery.ts`, `app/api/messaging/avatar/[...objectPath]/route.ts` | Shared delivery concern even if currently named under messaging |
| Push and unread | `src/modules/messaging/push/**`, `src/modules/messaging/sdk/notifications.ts` | Shared messaging capability with platform-level operational value |
| Shared error sanitation | `src/modules/messaging/ui/user-facing-errors.ts` | Already used outside Messenger routes |

## 5. Accidental Coupling

These are the main places where current naming or control flow still blurs
platform, Messenger, and KeepCozy boundaries.

### A. Top-level documentation still frames the repo incorrectly

Current mismatch:

- `README.md` previously described the repo as `KeepCozy + CHAT Foundation`
- many docs still talk about a shared shell with one product layered around the
  other

Concrete examples:

- `README.md`
- `docs/keepcozy-chat-integration-seam.md`
- `docs/messenger-space-shell-polish.md`

### B. Product posture is still encoded inside shared space resolution

Concrete examples:

- `src/modules/spaces/server.ts`
- `src/modules/spaces/posture.ts`

Current coupling:

- `resolveSpaceProfileForSpace(...)` treats the `TEST` space as
  `keepcozy_ops`
- everything else falls back to `messenger_full`

That is workable for runtime compatibility, but it means product posture still
leaks into a shared platform module.

### C. One shared shell still contains both product nav models

Concrete example:

- `app/(app)/app-shell-frame.tsx`

Current coupling:

- the shared shell owns both Messenger bottom navigation and KeepCozy bottom
  navigation
- product split is currently done by `space.profile`, not by clearer product
  ownership seams

### D. The `/home` route still branches between product experiences

Concrete example:

- `app/(app)/home/page.tsx`

Current coupling:

- the route serves as Messenger home for `messenger_full`
- the same route serves as KeepCozy home for `keepcozy_ops`

That is a practical shared-repo choice today, but it is still a mixed ownership
surface.

### E. KeepCozy already uses helpers that are named as messaging-specific

Concrete examples:

- `app/(app)/issues/actions.ts`
- `app/(app)/tasks/actions.ts`
- `src/modules/messaging/ui/user-facing-errors.ts`
- `src/modules/spaces/types.ts` before this pass

Current coupling:

- KeepCozy actions reuse a generic error-sanitizing helper that lives under a
  `messaging/ui` namespace
- the behavior is shared, but the ownership label is misleading
- KeepCozy future contract drafts used to live directly in `src/modules/spaces`
  even though they are product-specific, not platform-runtime types

## 6. Current Docs That No Longer Match The Intended Shape

These documents are still useful, but they are no longer safe as top-level
architecture framing:

- `README.md` if read as the main architecture story
- `docs/keepcozy-chat-integration-seam.md`
- `docs/messenger-space-shell-polish.md`
- any doc that implies KeepCozy is a layer on top of Messenger or that
  Messenger is merely a reusable shell around KeepCozy

These documents should now be read as:

- historical integration notes
- branch-scoped runtime notes
- product-specific polish notes

They should not override the platform-first reading in the new architecture
docs.

## 7. Honest Current Conclusion

The codebase is already closest to this truth:

- BWC platform foundation at the repo root
- Messenger as one product
- KeepCozy as another product
- messaging as a shared capability, not a shell that defines every product
- spaces as the main current shared boundary

The main work now is documentation alignment and careful boundary tightening,
not a runtime rewrite.
