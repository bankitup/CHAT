# Module Entry Points

## Purpose

This document tells engineers and AI assistants where to start for common work
in this repo.

The goal is speed and boundary discipline:

- start from the narrowest correct seam
- avoid broad monolith imports when a better entry point exists
- avoid pushing product policy into platform or capability layers

## Entry-Point Rules

- prefer narrow read/write seams over broad facades
- prefer shared profile and spaces seams over product route files when the work
  is truly shared
- prefer product route loaders for product page composition
- treat large mixed files as places to contain work, not as default entry
  points

## Auth / Session Work

Start here:

- `src/lib/request-context/server.ts`
- `src/lib/supabase/server.ts`
- `src/lib/supabase/service.ts`
- `app/(auth)/**`

Use for:

- request viewer resolution
- auth/session-aware server loaders
- request-scoped Supabase access
- login/signup and authenticated-route boundaries

Avoid:

- adding auth/session policy inside product routes first
- bypassing request-context helpers with ad hoc session reads

Notes:

- if the work is shared across products, it almost always starts here

## Profile / Identity Work

Start here:

- `src/modules/profile/types.ts`
- `src/modules/profile/avatar.ts`
- `src/modules/profile/ui/**`
- `src/modules/profile/server.ts`

Use for:

- shared profile vocabulary
- avatar and identity formatting
- shared identity UI
- current-user profile update/read flows

Avoid:

- starting new shared identity work in `src/modules/messaging/ui/identity*.tsx`
- importing `src/modules/messaging/data/profiles-server.ts` directly unless
  you are intentionally touching the current persistence backing seam

Warning:

- `src/modules/profile/server.ts` is the preferred shared entry seam, but its
  backing persistence is still mixed and currently routes through messaging

## Space / Membership / Governance Work

Start here:

- `src/modules/spaces/access.ts`
- `src/modules/spaces/governance.ts`
- `src/modules/spaces/server.ts`
- `src/modules/spaces/write-server.ts`
- `src/modules/spaces/url.ts`
- `app/(app)/spaces/**`

Use for:

- active-space resolution
- shared membership/access checks
- shared governance/admin flows
- space-scoped URL shaping

Avoid:

- adding new product posture into `src/modules/spaces/model.ts`
- adding new shell/product dispatch rules into `src/modules/spaces/shell.ts`
- treating `spaces` as a Messenger or KeepCozy feature folder

Warning:

- `src/modules/spaces/model.ts`, `posture.ts`, and `shell.ts` are active drift
  seams; use them carefully and avoid expanding product-specific behavior there

## Messaging Thread Work

Start here:

- product route composition:
  - `src/modules/messaging/server/thread-page.ts`
  - `app/(app)/chat/[conversationId]/page.tsx`
  - `app/(app)/chat/[conversationId]/thread-page-content.tsx`
- capability reads:
  - `src/modules/messaging/data/thread-read-server.ts`
  - `src/modules/messaging/server/route-context.ts`
- runtime state:
  - `src/modules/messaging/realtime/**`
  - `app/(app)/chat/[conversationId]/**`

Use for:

- thread page loading
- history shaping
- access-checked thread context
- thread runtime, row rendering, rescue, voice, and viewer behavior

Avoid:

- starting new thread reads from `src/modules/messaging/data/server.ts` if
  `thread-read-server.ts` already covers the need
- putting product route behavior into `src/modules/messaging/data/**`
- reaching into `thread-history-viewport.tsx` when a narrower extracted seam
  already exists

Warnings:

- `app/(app)/chat/[conversationId]/thread-history-viewport.tsx` and
  `thread-message-row.tsx` are still large gravity points
- prefer extracted hooks and row/runtime seams before touching the main file

## Inbox Work

Start here:

- product route composition:
  - `src/modules/messaging/server/inbox-page.ts`
  - `app/(app)/inbox/page.tsx`
  - `app/(app)/inbox/inbox-filterable-content.tsx`
- capability reads:
  - `src/modules/messaging/data/conversation-read-server.ts`
- realtime/runtime:
  - `src/modules/messaging/realtime/inbox-sync.tsx`
  - `src/modules/messaging/realtime/inbox-summary-store.ts`

Use for:

- inbox SSR shaping
- conversation summary reads
- create DM flows
- live inbox summary upgrades

Avoid:

- defaulting to `src/modules/messaging/data/server.ts` for inbox reads when
  `conversation-read-server.ts` already has a narrower seam
- putting inbox product behavior into shared shell code

Warning:

- `app/(app)/inbox/inbox-filterable-content.tsx` is still a significant product
  gravity point even after recent splits

## Messaging Media / File Delivery Work

Start here:

- `src/modules/messaging/media/message-assets.ts`
- `src/modules/messaging/media/message-metadata.ts`
- `src/modules/messaging/media/voice.ts`
- `src/modules/messaging/media/upload-jobs.ts`
- `app/api/messaging/conversations/[conversationId]/messages/[messageId]/attachments/[attachmentId]/content/route.ts`
- `app/api/messaging/conversations/[conversationId]/messages/[messageId]/attachments/[attachmentId]/signed-url/route.ts`

Use for:

- asset metadata and message-asset linking
- media/voice contract changes
- attachment delivery behavior
- upload job and playback-source shaping

Avoid:

- putting storage/delivery rules directly into thread components
- adding public object URL assumptions into product UI
- changing asset semantics first in route files instead of the media layer

Warning:

- keep media contract changes inside `src/modules/messaging/media/**` whenever
  possible; route files should mostly enforce delivery and access

## Messaging Realtime / Live State Work

Start here:

- `src/modules/messaging/realtime/thread-live-state-store.ts`
- `src/modules/messaging/realtime/thread-message-patch-store.ts`
- `src/modules/messaging/realtime/optimistic-thread.ts`
- `src/modules/messaging/realtime/inbox-summary-store.ts`
- `src/modules/messaging/realtime/inbox-sync.tsx`

Use for:

- optimistic message flows
- patch application
- live thread/inbox summaries
- realtime refresh behavior

Avoid:

- storing thread-wide live state inside individual row components
- mixing realtime coordination into shared shell modules

Warning:

- local row/runtime state should stay local; do not let realtime helpers become
  a back door for broad invalidation

## Messenger Voice Work

Start here:

- `app/(app)/chat/[conversationId]/use-thread-voice-playback-runtime.ts`
- `app/(app)/chat/[conversationId]/thread-voice-message-bubble.tsx`
- `app/(app)/chat/[conversationId]/voice-playback-source.ts`
- `app/(app)/chat/[conversationId]/use-composer-voice-draft.ts`
- `src/modules/messaging/media/voice.ts`

Use for:

- playback controller/runtime behavior
- capture MIME policy
- source selection and transport-vs-blob rules
- voice row rendering

Avoid:

- coupling voice playback state to thread-wide refresh logic
- adding voice asset contract changes directly inside row components
- putting broad list or scroll policy into voice runtime

Warning:

- keep voice behavior local to the active row/runtime whenever possible

## KeepCozy Domain Work

Start here:

- `src/modules/keepcozy/server.ts`
- `src/modules/keepcozy/write-server.ts`
- `src/modules/keepcozy/mvp-preview.ts`
- `src/modules/keepcozy/messaging-adapter.ts`
- `app/(app)/rooms/**`
- `app/(app)/issues/**`
- `app/(app)/tasks/**`

Use for:

- KeepCozy reads/writes
- product-specific route composition
- KeepCozy preview/fallback shaping
- bounded integration into messaging capability

Avoid:

- putting KeepCozy domain logic into `src/modules/spaces/**`
- putting KeepCozy integration logic directly into Messenger route files
- treating KeepCozy as a Messenger mode

Warning:

- if KeepCozy needs messaging, prefer `messaging-adapter.ts` or another
  product-owned adapter seam instead of expanding Messenger product files

## Support / Admin / Recovery Work

Start here:

- shared/admin base:
  - `app/(app)/error.tsx`
  - `app/(app)/guarded-server-action-form.tsx`
  - `app/(app)/spaces/**`
  - `src/modules/spaces/governance.ts`
- conversation rescue:
  - `app/(app)/chat/[conversationId]/thread-body-rescue-boundary.tsx`
  - `src/modules/messaging/diagnostics/thread-history-proof.ts`
- operational docs:
  - `docs/architecture-acceptance.md`
  - `docs/conversation-runtime-manual-matrix.md`

Use for:

- shared recovery patterns
- governed admin/member actions
- conversation rescue/failure isolation
- operational verification guidance

Avoid:

- inventing product-specific recovery flows in shared platform files
- treating Messenger rescue boundaries as generic platform error handling

Warning:

- today’s active support/admin baseline is real, but still small; do not turn
  every recovery problem into a new “platform support module”

## Shell / Route Posture Work

Start here:

- `app/(app)/layout.tsx`
- `app/(app)/app-shell-frame.tsx`
- `src/modules/spaces/server.ts`
- `src/modules/spaces/url.ts`

Use for:

- shared authenticated shell mechanics
- shared layout composition
- route posture driven by active space and access context

Avoid:

- putting new Messenger product policy into `app-shell-frame.tsx`
- putting shell navigation policy into messaging capability modules
- expanding `src/modules/spaces/shell.ts` with more product branching unless
  that cleanup is the explicit branch goal

Warning:

- `app-shell-frame.tsx` is a host seam, not the long-term home for product
  runtime ownership

## Common Bad Patterns

### 1. Importing broad monoliths when a narrower seam exists

Prefer:

- `src/modules/messaging/data/thread-read-server.ts`
- `src/modules/messaging/data/conversation-read-server.ts`

Avoid defaulting to:

- `src/modules/messaging/data/server.ts`

### 2. Putting product logic into platform code

Do not put:

- Messenger product posture into `src/modules/spaces/**`
- KeepCozy workflow logic into shared shell/runtime modules

### 3. Putting shell policy into capability modules

Do not let:

- messaging capability modules decide shared authenticated shell behavior
- push/unread/presence seams become the home for app-wide shell policy

### 4. Using route files as reusable cross-product entry points

Do not reuse:

- `app/(app)/chat/[conversationId]/**`
- `app/(app)/inbox/**`

as cross-product capability seams.

Use:

- `src/modules/messaging/server/**`
- `src/modules/messaging/data/**`
- product-owned adapters such as `src/modules/keepcozy/messaging-adapter.ts`

### 5. Treating mixed seams as safe default homes

Be careful with:

- `app/(app)/home/page.tsx`
- `app/(app)/activity/page.tsx`
- `app/(app)/app-shell-frame.tsx`
- `src/modules/spaces/shell.ts`
- `src/modules/profile/server.ts`

These are real files, but they are not good default homes for new shared logic.

## Quick Shortcut

If you need a fast heuristic:

1. shared auth/session or shared route mechanics -> `src/lib/**` or shared
   `app/(app)` shell files
2. shared profile, shared identity UI, shared preferences -> `src/modules/profile/**`,
   `src/modules/ui-preferences/**`, `src/modules/i18n/**`
3. space access/governance -> `src/modules/spaces/**`
4. messaging capability reads/writes -> `src/modules/messaging/data/**` or
   `src/modules/messaging/server/**`
5. Messenger product UX -> `app/(app)/inbox/**` or
   `app/(app)/chat/[conversationId]/**`
6. KeepCozy domain work -> `src/modules/keepcozy/**` plus its route surfaces
