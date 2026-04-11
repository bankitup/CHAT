# Platform Foundation Vs Product Boundaries

## Purpose

This document gives a practical ownership split for follow-up branches.

It answers:

- what belongs to platform foundation
- what belongs to Messenger
- what belongs to KeepCozy
- what can be shared safely
- what should stay out of scope during the current architecture pass

## Boundary Rules

### Platform foundation owns

- auth/session resolution
- shared shell and route framing
- active space selection
- `space_members` and governance resolution
- common profile identity primitives
- shared URL scoping
- i18n
- shared deployment/runtime assumptions

Primary files today:

- `app/(app)/layout.tsx`
- `app/(app)/app-shell-frame.tsx`
- `app/(app)/actions.ts`
- `src/lib/request-context/server.ts`
- `src/lib/supabase/**`
- `src/modules/spaces/**`
- `src/modules/i18n/**`

Important current split inside `src/modules/spaces`:

- `model.ts` for shared platform types
- `governance.ts` for shared governance resolution
- `posture.ts` for shared profile/theme posture resolution
- `shell.ts` for shared product posture, route-surface, and shell decision helpers
- `server.ts` for access-loading and runtime resolution
- `write-server.ts` for governed space writes

### Messenger product owns

- inbox
- create DM / create group product flows
- chat thread UX
- thread composer UX
- message-centric activity UX
- Messenger-facing settings copy and navigation decisions

Primary files today:

- `app/(app)/inbox/**`
- `app/(app)/chat/[conversationId]/**`
- `app/(app)/activity/page.tsx`

### KeepCozy product owns

- home-ops dashboard behavior
- rooms
- issues
- tasks
- issue/task updates and resolution flows
- KeepCozy-specific product copy and operational workflow framing

Primary files today:

- `app/(app)/home/page.tsx`
- `app/(app)/rooms/**`
- `app/(app)/issues/**`
- `app/(app)/tasks/**`
- `src/modules/keepcozy/**`

### Shared capability owns

- conversation/message runtime
- attachments and asset delivery
- reactions
- push registration and delivery
- realtime sync
- DM E2EE

Primary files today:

- `src/modules/messaging/**`
- `app/api/messaging/**`

## Ownership Split By Delivery Layer

### Frontend

Platform frontend:

- `app/(app)/layout.tsx`
- `app/(app)/app-shell-frame.tsx`
- `app/(app)/spaces/**`
- `app/(app)/settings/**` where the concern is shared identity/settings

Messenger frontend:

- `app/(app)/inbox/**`
- `app/(app)/chat/[conversationId]/**`
- Messenger-specific activity presentation in `app/(app)/activity/page.tsx`

KeepCozy frontend:

- `app/(app)/home/page.tsx` when rendering KeepCozy mode
- `app/(app)/rooms/**`
- `app/(app)/issues/**`
- `app/(app)/tasks/**`

### Backend

Platform backend:

- `src/lib/request-context/server.ts`
- `src/modules/spaces/server.ts`
- `src/modules/spaces/write-server.ts`

Messenger/shared messaging backend:

- `src/modules/messaging/data/server.ts`
- `app/api/messaging/**`

KeepCozy backend:

- `src/modules/keepcozy/server.ts`
- `src/modules/keepcozy/write-server.ts`
- `app/(app)/issues/actions.ts`
- `app/(app)/tasks/actions.ts`

### Database

Platform/shared boundary tables:

- `spaces`
- `space_members`

Messaging capability tables:

- `conversations`
- `conversation_members`
- `messages`
- `message_assets`
- `message_asset_links`
- `message_reactions`
- `push_subscriptions`
- `user_devices`

KeepCozy product tables:

- `rooms`
- `issues`
- `tasks`
- related update/history tables introduced by KeepCozy persistence work

### Auth

Platform owns auth.

Keep it centered in:

- `src/lib/request-context/server.ts`
- `src/lib/supabase/server.ts`
- `src/lib/supabase/service.ts`

Products should consume auth context, not reinvent it.

### Storage

Storage is shared platform infrastructure with capability-specific semantics.

Messaging/shared capability storage:

- avatars and message assets currently delivered through messaging-owned helpers
- `app/api/messaging/avatar/[...objectPath]/route.ts`
- attachment content and signed-url routes under `app/api/messaging/**`

KeepCozy should not create a separate storage stack unless a real product need
forces it later.

### Docs

Architecture source of truth now lives in:

- `README.md`
- `docs/platform-architecture-current-state.md`
- `docs/platform-architecture-target-shape.md`
- `docs/platform-foundation-vs-product-boundaries.md`
- `docs/product-shell-boundaries.md`
- `docs/refactor-order-platform-first.md`

### Ops

Ops should observe:

- platform health
- messaging capability health
- Messenger product health
- KeepCozy product health

Ops should not assume one product’s failure model defines the whole repo.

## Shared Seams That Are Safe To Preserve

These should be preserved, not treated as architectural mistakes:

- one shared Next.js repo
- one shared authenticated app shell
- one shared `spaces` boundary
- one shared messaging capability implementation
- one shared Supabase backend

## Current Mismatches To Fix Gradually

These are the safest future cleanup targets:

- generic helpers currently living under `src/modules/messaging/**` even when
  KeepCozy uses them too
- route-level product branching inside `app/(app)/home/page.tsx`
- profile defaults in `src/modules/spaces/server.ts` that still encode product
  posture in a shared platform module
- documentation that still frames one product as layered on the other
- compatibility re-exports such as `src/modules/spaces/types.ts`, which should
  shrink over time now that the real KeepCozy draft contracts live in
  `src/modules/keepcozy/contract-types.ts`

## Non-Goals

During this architecture pass and the next narrow refactor branches:

- do not split the repo
- do not redesign the schema for cleaner product storytelling
- do not add billing/commercial implementation
- do not move KeepCozy into Messenger
- do not move Messenger into KeepCozy
- do not rewrite the messaging runtime just to achieve cleaner directory names
