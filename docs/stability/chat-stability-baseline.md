# Chat Stability Baseline

## Scope

This baseline is for the current private-space messaging product in this repo.
It is intentionally limited to reliability, action-path clarity, and runtime hardening.

In scope:

- create DM
- create group in a space
- governed space creation and governed member management
- send text, photo, file, voice, and encrypted DM messages
- add/remove members
- profile name and avatar writes
- inbox/chat/settings loading
- realtime refresh and reconnect
- push registration lifecycle

Out of scope for this phase:

- new product features
- commercial or billing work
- conversation model rewrites
- schema redesign without evidence
- E2EE protocol redesign
- attachment architecture replacement

## Repo Baseline

Current runtime shape, based on the checked-in code:

- Next.js App Router routes in `/app`
- Supabase SSR/browser clients in `/src/lib/supabase`
- messaging data and write logic in `/src/modules/messaging/data/server.ts`
- client-side composer, optimistic queue, and thread runtime in `/app/(app)/chat/[conversationId]`
- inbox/chat realtime refresh in `/src/modules/messaging/realtime`
- push registration and fanout in `/src/modules/messaging/sdk/notifications.ts`, `/app/api/messaging/push-subscriptions/route.ts`, and `/src/modules/messaging/push/server.ts`
- governed space creation and member management in `/app/(app)/spaces/actions.ts` and `/src/modules/spaces/write-server.ts`

Existing automated coverage is narrow:

- `tests/e2ee/conversation-visibility-boundaries.test.ts`
- `tests/e2ee/inbox-preview-boundaries.test.ts`
- `tests/e2ee/inbox-ssr-visibility-stability.test.ts`
- `tests/e2ee/message-shell-boundaries.test.ts`
- `tests/e2ee/ui-boundaries.test.ts`

There is no browser-level automated coverage yet for the critical action paths that testers are currently being warned about.

## Focused File-By-File Audit

| Path | Role | Stability note |
| --- | --- | --- |
| `/Users/danya/IOS - Apps/CHAT/app/(app)/guarded-server-action-form.tsx` | Native form duplicate-submit guard | Helpful, but only covers native server-action form submits. Client-side queue paths still need their own acknowledgment and lock discipline. |
| `/Users/danya/IOS - Apps/CHAT/src/lib/request-context/server.ts` | Shared request viewer resolution | Every write path depends on this. If auth continuity drifts, actions fail late with generic auth errors. |
| `/Users/danya/IOS - Apps/CHAT/src/lib/supabase/server.ts` | SSR Supabase client | Cookie writes are best-effort. That is fine for SSR, but it means stability work should assume session refresh can be fragile around long-lived flows. |
| `/Users/danya/IOS - Apps/CHAT/app/(app)/inbox/new-chat-sheet.tsx` | DM/group creation UI | The entrypoint for create DM and create group. Needs immediate pending/error clarity because this is a modal action surface. |
| `/Users/danya/IOS - Apps/CHAT/app/(app)/inbox/actions.ts` | Create DM, create group, restore conversation, inbox settings | Core server-action entry for new chat creation. DM creation already retries uniqueness collisions, which is good evidence that duplicate-entry races are a real repo concern. |
| `/Users/danya/IOS - Apps/CHAT/src/modules/messaging/data/server.ts` | Core messaging data/write layer | Highest-risk file in the repo. Conversation creation, summary projection, profile/avatar writes, reactions, message sends, encrypted DM sends, attachment finalization, and group membership all converge here. |
| `/Users/danya/IOS - Apps/CHAT/app/(app)/chat/[conversationId]/thread-composer-runtime.tsx` | Composer router | Chooses plaintext vs encrypted DM composer and binds reply/typing/runtime state. |
| `/Users/danya/IOS - Apps/CHAT/app/(app)/chat/[conversationId]/plaintext-chat-composer-form.tsx` | Plaintext/group composer | In-memory outgoing queue, local optimistic flow, attachment/voice entry, and local send guards all live here. |
| `/Users/danya/IOS - Apps/CHAT/app/(app)/chat/[conversationId]/encrypted-dm-composer-form.tsx` | Encrypted DM composer | Separate reliability surface from group send. Adds device bootstrap, recipient bundle lookup, encryption, multipart send, and debug-state handling. |
| `/Users/danya/IOS - Apps/CHAT/app/(app)/chat/[conversationId]/composer-attachment-picker.tsx` | Photo/file capture and selection | Camera, gallery, and file selection are client-only and route-scoped. Large-file rejection and invalid-type handling happen here before send. |
| `/Users/danya/IOS - Apps/CHAT/app/(app)/chat/[conversationId]/use-conversation-outgoing-queue.ts` | Optimistic send queue | Queue is in-memory and route-local. It serializes sends well, but pending state is not durable across refresh, crash, or navigation. |
| `/Users/danya/IOS - Apps/CHAT/app/(app)/chat/[conversationId]/actions.ts` | Send/edit/delete/reaction/group settings actions | Main chat server-action boundary for non-E2EE writes. It mixes validation, membership checks, send calls, summary refresh, and push send side effects. |
| `/Users/danya/IOS - Apps/CHAT/app/api/messaging/dm-e2ee/send/route.ts` | Encrypted DM send API | Separate transport for encrypted DM text and multipart attachment sends. Must stay stable, but should not be rewritten during stability phase. |
| `/Users/danya/IOS - Apps/CHAT/app/(app)/chat/[conversationId]/page.tsx` | Chat SSR loader | Large page-level loading surface with active-space resolution, fallback paths, history window selection, participant data, and settings wiring. |
| `/Users/danya/IOS - Apps/CHAT/app/(app)/inbox/page.tsx` | Inbox SSR loader | Similar loading risk to chat page. Contains active-space fallbacks and stable-vs-precise loading choices. |
| `/Users/danya/IOS - Apps/CHAT/src/modules/messaging/data/inbox-ssr-stability.ts` | Inbox SSR strategy seam | Small file, but important: the repo already codifies “stable” vs “precise” inbox loading, which is a signal that list stability is an active concern. |
| `/Users/danya/IOS - Apps/CHAT/src/modules/messaging/realtime/inbox-sync.tsx` | Inbox realtime sync | Uses debounce, cooldown, local patching, and router refresh. High-value place for reconnect and stale-state hardening. |
| `/Users/danya/IOS - Apps/CHAT/src/modules/messaging/realtime/active-chat-sync.tsx` | Chat realtime sync | Handles chat refresh, resubscribe recovery, thread patching, and refresh fallbacks. Critical for reconnect stability and duplicate-refresh control. |
| `/Users/danya/IOS - Apps/CHAT/src/modules/messaging/realtime/live-refresh.ts` | Local + broadcast commit signaling | Bridges optimistic sends to live refresh. Timeouts or channel failures here can leave UI lagging behind a successful write. |
| `/Users/danya/IOS - Apps/CHAT/app/(app)/settings/profile-settings-form.tsx` | Profile name/avatar UI | Profile avatar crop/upload is multi-step, object-URL heavy, and easy to make feel inert if pending state is weak. |
| `/Users/danya/IOS - Apps/CHAT/app/(app)/settings/actions.ts` | Profile, avatar, status, language writes | Server-action boundary for profile changes. Revalidates multiple surfaces after save. |
| `/Users/danya/IOS - Apps/CHAT/app/(app)/chat/[conversationId]/group-chat-settings-form.tsx` | Group title/avatar/join-policy UI | Another multi-step upload + save surface with local draft state and server settings writes. |
| `/Users/danya/IOS - Apps/CHAT/src/modules/messaging/group-policy.ts` | Group permission rules | Small but central for “governed group” behavior inside a space: who can edit identity, add members, or remove members. |
| `/Users/danya/IOS - Apps/CHAT/app/(app)/spaces/actions.ts` | Governed space creation/member actions | Server-action boundary for governed space creation and governed membership expansion. |
| `/Users/danya/IOS - Apps/CHAT/src/modules/spaces/write-server.ts` | Governed space write layer | Another high-risk multi-step write surface. Creates spaces, seeds `space_members`, and updates governed membership with service-role writes. |
| `/Users/danya/IOS - Apps/CHAT/src/modules/spaces/server.ts` | Active space resolution and governance | Critical loading dependency for inbox, chat, home, and settings. Temporary bypasses here are strong evidence that this area needs hardening, not feature work. |
| `/Users/danya/IOS - Apps/CHAT/src/modules/messaging/sdk/notifications.ts` | Browser push lifecycle | Client-side readiness, service worker registration, permission flow, subscription persistence, and test send entry all converge here. |
| `/Users/danya/IOS - Apps/CHAT/app/api/messaging/push-config/route.ts` | Runtime push config | Small but required for runtime key/config resolution. |
| `/Users/danya/IOS - Apps/CHAT/app/api/messaging/push-subscriptions/route.ts` | Push subscription persistence API | Save/delete/presence state API for browser subscriptions. |
| `/Users/danya/IOS - Apps/CHAT/src/modules/messaging/push/server.ts` | Push fanout and subscription state | Critical push delivery server surface. Handles storage, preview policy, suppression, and delivery errors. |

## Top Stability Risks

### 1. Multi-step write paths without one end-to-end transaction

Highest-risk examples:

- `/Users/danya/IOS - Apps/CHAT/src/modules/messaging/data/server.ts#L9795`
- `/Users/danya/IOS - Apps/CHAT/src/modules/messaging/data/server.ts#L8702`
- `/Users/danya/IOS - Apps/CHAT/src/modules/messaging/data/server.ts#L5438`
- `/Users/danya/IOS - Apps/CHAT/src/modules/spaces/write-server.ts#L461`

Why this is high risk:

- message send with attachment is `message shell -> storage upload -> asset insert -> link insert -> summary sync -> optional push`
- encrypted DM attachment send is a separate but similarly multi-step path
- governed space creation is `space row -> membership rows`, with cleanup on failure but not a single DB transaction

User symptom risk:

- actions take 1 to 2 seconds
- user sees weak acknowledgment
- partial cleanup or delayed summary refresh can make success look like failure

### 2. Client-side action acknowledgment is uneven across native form vs queue-driven flows

Evidence:

- `/Users/danya/IOS - Apps/CHAT/app/(app)/guarded-server-action-form.tsx`
- `/Users/danya/IOS - Apps/CHAT/app/(app)/chat/[conversationId]/plaintext-chat-composer-form.tsx`
- `/Users/danya/IOS - Apps/CHAT/app/(app)/chat/[conversationId]/encrypted-dm-composer-form.tsx`
- `/Users/danya/IOS - Apps/CHAT/app/(app)/chat/[conversationId]/use-conversation-outgoing-queue.ts`

Why this is high risk:

- native server-action forms already have submit locking
- composer sends rely on local queue state, local guards, and optimistic patches instead
- that makes “tap did nothing” most likely on client-managed send paths, photo capture, voice, and encrypted DM setup

### 3. Active-space and SSR loading already contain fallback/bypass logic

Evidence:

- `/Users/danya/IOS - Apps/CHAT/app/(app)/inbox/page.tsx`
- `/Users/danya/IOS - Apps/CHAT/app/(app)/chat/[conversationId]/page.tsx`
- `/Users/danya/IOS - Apps/CHAT/src/modules/spaces/server.ts`

Why this is high risk:

- chat and inbox both contain explicit `v1 test bypass` and schema-cache fallback handling
- that is direct evidence that active-space resolution has been fragile in production-like conditions
- if active space resolution drifts, every write and loading surface inherits that instability

### 4. Realtime recovery still depends on router refresh and timed debounce/cooldown behavior

Evidence:

- `/Users/danya/IOS - Apps/CHAT/src/modules/messaging/realtime/inbox-sync.tsx`
- `/Users/danya/IOS - Apps/CHAT/src/modules/messaging/realtime/active-chat-sync.tsx`
- `/Users/danya/IOS - Apps/CHAT/src/modules/messaging/realtime/live-refresh.ts`

Why this is high risk:

- local patching helps, but router refresh remains the fallback recovery mechanism
- hidden-tab minimum intervals and refresh cooldowns can make the app feel stale after reconnects
- this is exactly the sort of repo shape that produces “it worked, but the UI didn’t move”

### 5. Auth continuity is checked late and repeatedly during writes

Evidence:

- `/Users/danya/IOS - Apps/CHAT/src/lib/request-context/server.ts`
- `/Users/danya/IOS - Apps/CHAT/src/lib/supabase/server.ts`
- nearly every action in `/Users/danya/IOS - Apps/CHAT/app/(app)/chat/[conversationId]/actions.ts`
- profile and space writes in `/Users/danya/IOS - Apps/CHAT/app/(app)/settings/actions.ts` and `/Users/danya/IOS - Apps/CHAT/app/(app)/spaces/actions.ts`

Why this is high risk:

- a write can begin from a valid UI state and still fail at execution time with “please log in” or “no authenticated user”
- this is correct behavior, but currently it is mostly surfaced as terminal failure rather than a recoveryable continuity state

### 6. Push lifecycle is real, but observability is still limited

Evidence:

- `/Users/danya/IOS - Apps/CHAT/src/modules/messaging/sdk/notifications.ts`
- `/Users/danya/IOS - Apps/CHAT/app/api/messaging/push-subscriptions/route.ts`
- `/Users/danya/IOS - Apps/CHAT/src/modules/messaging/push/server.ts`

Why this is lower than write-path risk but still important:

- many degraded states are already supported
- however, this area has several valid “unconfigured but not broken” branches, which makes production diagnosis harder without explicit metrics

## Recommended Hardening Order

### `stability/01-action-entry-and-pending-ack`

Target:

- make every critical action produce immediate visible acknowledgment
- unify submit lock and pending state expectations across native forms and queue-driven composers

Primary files:

- `/Users/danya/IOS - Apps/CHAT/app/(app)/guarded-server-action-form.tsx`
- `/Users/danya/IOS - Apps/CHAT/app/(app)/chat/[conversationId]/plaintext-chat-composer-form.tsx`
- `/Users/danya/IOS - Apps/CHAT/app/(app)/chat/[conversationId]/encrypted-dm-composer-form.tsx`
- `/Users/danya/IOS - Apps/CHAT/app/(app)/inbox/new-chat-sheet.tsx`
- `/Users/danya/IOS - Apps/CHAT/app/(app)/settings/profile-settings-form.tsx`
- `/Users/danya/IOS - Apps/CHAT/app/(app)/chat/[conversationId]/group-chat-settings-form.tsx`

### `stability/02-message-send-and-asset-finalization`

Target:

- harden message send, attachment finalization, and failure surfacing without changing the messaging model

Primary files:

- `/Users/danya/IOS - Apps/CHAT/app/(app)/chat/[conversationId]/actions.ts`
- `/Users/danya/IOS - Apps/CHAT/src/modules/messaging/data/server.ts`
- `/Users/danya/IOS - Apps/CHAT/app/api/messaging/dm-e2ee/send/route.ts`
- `/Users/danya/IOS - Apps/CHAT/app/(app)/chat/[conversationId]/use-conversation-outgoing-queue.ts`

### `stability/03-chat-and-inbox-realtime-recovery`

Target:

- tighten live refresh, reconnect, resubscribe, and post-commit UI convergence

Primary files:

- `/Users/danya/IOS - Apps/CHAT/src/modules/messaging/realtime/inbox-sync.tsx`
- `/Users/danya/IOS - Apps/CHAT/src/modules/messaging/realtime/active-chat-sync.tsx`
- `/Users/danya/IOS - Apps/CHAT/src/modules/messaging/realtime/live-refresh.ts`
- `/Users/danya/IOS - Apps/CHAT/app/(app)/chat/[conversationId]/thread-history-viewport.tsx`

### `stability/04-space-resolution-and-ssr-loading`

Target:

- remove fragile loading ambiguity around active-space resolution and SSR fallbacks

Primary files:

- `/Users/danya/IOS - Apps/CHAT/app/(app)/inbox/page.tsx`
- `/Users/danya/IOS - Apps/CHAT/app/(app)/chat/[conversationId]/page.tsx`
- `/Users/danya/IOS - Apps/CHAT/src/modules/spaces/server.ts`
- `/Users/danya/IOS - Apps/CHAT/src/modules/messaging/data/inbox-ssr-stability.ts`

### `stability/05-group-governance-and-membership-writes`

Target:

- harden create group, group settings, add/remove member, leave group, and governed-space membership changes

Primary files:

- `/Users/danya/IOS - Apps/CHAT/app/(app)/inbox/actions.ts`
- `/Users/danya/IOS - Apps/CHAT/app/(app)/chat/[conversationId]/actions.ts`
- `/Users/danya/IOS - Apps/CHAT/src/modules/messaging/data/server.ts`
- `/Users/danya/IOS - Apps/CHAT/app/(app)/spaces/actions.ts`
- `/Users/danya/IOS - Apps/CHAT/src/modules/spaces/write-server.ts`
- `/Users/danya/IOS - Apps/CHAT/src/modules/messaging/group-policy.ts`

### `stability/06-profile-avatar-and-photo-capture`

Target:

- harden avatar/photo selection, upload, save, and cleanup paths

Primary files:

- `/Users/danya/IOS - Apps/CHAT/app/(app)/settings/profile-settings-form.tsx`
- `/Users/danya/IOS - Apps/CHAT/app/(app)/settings/actions.ts`
- `/Users/danya/IOS - Apps/CHAT/app/(app)/chat/[conversationId]/composer-attachment-picker.tsx`
- `/Users/danya/IOS - Apps/CHAT/app/(app)/chat/[conversationId]/group-chat-settings-form.tsx`

### `stability/07-push-registration-and-delivery-observability`

Target:

- harden registration lifecycle visibility and delivery diagnostics

Primary files:

- `/Users/danya/IOS - Apps/CHAT/src/modules/messaging/sdk/notifications.ts`
- `/Users/danya/IOS - Apps/CHAT/app/api/messaging/push-config/route.ts`
- `/Users/danya/IOS - Apps/CHAT/app/api/messaging/push-subscriptions/route.ts`
- `/Users/danya/IOS - Apps/CHAT/src/modules/messaging/push/server.ts`

## Stability Ownership Map

### Frontend

- action acknowledgment and duplicate-submit safety
- optimistic queue behavior and recovery after slow writes
- attachment picker, camera/gallery/file flow clarity
- voice, replay, and thread interaction determinism
- visible failure states for chat, inbox, settings, and group settings

Primary files:

- `/Users/danya/IOS - Apps/CHAT/app/(app)/inbox/new-chat-sheet.tsx`
- `/Users/danya/IOS - Apps/CHAT/app/(app)/chat/[conversationId]/plaintext-chat-composer-form.tsx`
- `/Users/danya/IOS - Apps/CHAT/app/(app)/chat/[conversationId]/encrypted-dm-composer-form.tsx`
- `/Users/danya/IOS - Apps/CHAT/app/(app)/chat/[conversationId]/composer-attachment-picker.tsx`
- `/Users/danya/IOS - Apps/CHAT/app/(app)/settings/profile-settings-form.tsx`
- `/Users/danya/IOS - Apps/CHAT/app/(app)/chat/[conversationId]/group-chat-settings-form.tsx`

### Backend

- server-action validation and error shaping
- API route stability for encrypted DM and push subscription writes
- explicit stage diagnostics for long-running write paths

Primary files:

- `/Users/danya/IOS - Apps/CHAT/app/(app)/inbox/actions.ts`
- `/Users/danya/IOS - Apps/CHAT/app/(app)/chat/[conversationId]/actions.ts`
- `/Users/danya/IOS - Apps/CHAT/app/(app)/settings/actions.ts`
- `/Users/danya/IOS - Apps/CHAT/app/(app)/spaces/actions.ts`
- `/Users/danya/IOS - Apps/CHAT/app/api/messaging/dm-e2ee/send/route.ts`
- `/Users/danya/IOS - Apps/CHAT/app/api/messaging/push-subscriptions/route.ts`

### Database

- RLS correctness
- summary projection reliability
- schema compatibility guards for message assets, join policy, profile avatar paths, and push subscriptions
- duplicate-prevention and cleanup semantics

Primary files:

- `/Users/danya/IOS - Apps/CHAT/src/modules/messaging/data/server.ts`
- `/Users/danya/IOS - Apps/CHAT/docs/sql/`

### Auth

- viewer/session continuity during writes
- error handling when a valid-looking client action reaches an expired or missing auth state

Primary files:

- `/Users/danya/IOS - Apps/CHAT/src/lib/request-context/server.ts`
- `/Users/danya/IOS - Apps/CHAT/src/lib/supabase/server.ts`
- `/Users/danya/IOS - Apps/CHAT/app/(auth)/actions.ts`

### Storage

- avatar upload lifecycle
- message attachment upload lifecycle
- cleanup of replaced or failed uploads
- private attachment delivery path correctness

Primary files:

- `/Users/danya/IOS - Apps/CHAT/src/modules/messaging/data/server.ts`
- `/Users/danya/IOS - Apps/CHAT/src/modules/messaging/profile-avatar.ts`
- `/Users/danya/IOS - Apps/CHAT/src/modules/messaging/media/message-assets.ts`
- `/Users/danya/IOS - Apps/CHAT/app/api/messaging/conversations/[conversationId]/messages/[messageId]/attachments/[attachmentId]/content/route.ts`
- `/Users/danya/IOS - Apps/CHAT/app/api/messaging/conversations/[conversationId]/messages/[messageId]/attachments/[attachmentId]/signed-url/route.ts`

### Deployment

- ensure env-backed runtime config is present and debuggable
- keep Vercel runtime assumptions visible for push, auth, and SSR loads

Primary files:

- `/Users/danya/IOS - Apps/CHAT/next.config.ts`
- `/Users/danya/IOS - Apps/CHAT/app/api/messaging/push-config/route.ts`
- `/Users/danya/IOS - Apps/CHAT/docs/deployment.md`

### Docs

- keep this baseline current as implementation branches close risks
- record exact failure signatures and migrations instead of rewriting architecture docs

Primary files:

- `/Users/danya/IOS - Apps/CHAT/docs/stability/chat-stability-baseline.md`
- `/Users/danya/IOS - Apps/CHAT/docs/stability/chat-critical-paths.md`
- `/Users/danya/IOS - Apps/CHAT/docs/stability/manual-test-matrix.md`

### Ops

- collect structured logs from existing debug gates
- track exact failure stage before changing runtime behavior
- keep manual verification evidence tied to specific branches and deployments

Primary files:

- `/Users/danya/IOS - Apps/CHAT/src/modules/messaging/push/server.ts`
- `/Users/danya/IOS - Apps/CHAT/app/(app)/chat/[conversationId]/encrypted-dm-composer-form.tsx`
- `/Users/danya/IOS - Apps/CHAT/app/(app)/chat/[conversationId]/thread-history-viewport.tsx`
- `/Users/danya/IOS - Apps/CHAT/docs/stability/manual-test-matrix.md`

## High-Value Metrics To Add Later

- action start to first visible acknowledgment, by surface
- queue dwell time for `local_pending -> sending -> sent|failed`
- attachment send failure rate by exact stage:
  - message shell insert
  - storage upload
  - `message_assets` insert
  - `message_asset_links` insert
  - summary projection sync
- encrypted DM send failure rate by exact stage:
  - local device lookup
  - recipient bundle lookup
  - encryption
  - API send
  - attachment finalize
- router refresh count and debounce-skipped refresh count in inbox/chat realtime
- realtime channel subscribe timeout / channel error / resubscribe recovery count
- `getRequestViewer` auth-missing rate on write surfaces
- push readiness funnel:
  - permission granted
  - worker ready
  - subscription created
  - subscription persisted
  - delivery configured

## What Must Not Change During Stability Phase

- do not add new messaging surfaces, routes, or product capabilities
- do not add billing, plans, monetization, or commercial logic
- do not change the core tables or relationships for `spaces`, `space_members`, `conversations`, `conversation_members`, `messages`, `message_assets`, `message_asset_links`, `push_subscriptions`, or `user_devices` unless an audited stability fix absolutely requires a targeted migration
- do not rewrite the DM E2EE protocol or replace the current envelope/device model
- do not replace Supabase auth, SSR client wiring, or realtime transport
- do not replace the attachment model with a job system, queue service, or new storage backend
- do not redesign inbox/chat/settings UX beyond what is needed to expose truthful pending, success, and failure states
- do not widen scope into calls, commercial workflows, or non-messaging product work

## Immediate Stability Principle

The current tester instruction, “do not tap too quickly because some actions take 1–2 seconds and appear to do nothing,” should be treated as a product defect.

During stability work, every critical action should satisfy this baseline:

- first tap gets an immediate visible acknowledgment
- repeated taps are either ignored safely or coalesced deterministically
- slow work is shown as in flight, not silent
- final success or failure is explicit
