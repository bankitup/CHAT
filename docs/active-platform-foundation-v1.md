# Active Platform Foundation V1

## Purpose

This document defines what is truly active now as BWC platform foundation v1.

It is intentionally strict.
If a concern is important but still mostly Messenger-owned, it does not qualify
as clean platform foundation v1 yet.

## Inclusion Rule

Count something as active platform foundation v1 only if it is:

1. already active in the repository now
2. genuinely needed across products or across the shared runtime
3. not primarily Messenger product logic
4. not primarily KeepCozy product logic
5. not just a future company/platform aspiration

## Active Foundation V1

| Area | Current paths | Why it qualifies now | Notes |
| --- | --- | --- | --- |
| Auth and session foundations | `src/lib/request-context/**`, `src/lib/supabase/**`, `app/(auth)/**` | Shared login, viewer resolution, and server/runtime auth wiring already serve the entire repo. | Clear platform base. |
| Shared authenticated route frame | `app/(app)/layout.tsx`, `app/(app)/loading.tsx`, `app/(app)/error.tsx`, `app/(app)/actions.ts`, `app/(app)/guarded-server-action-form.tsx` | These are shared route mechanics, not Messenger-only or KeepCozy-only screens. | `app-shell-frame.tsx` is adjacent, but not fully clean foundation yet because it still owns product posture and Messenger runtime. |
| Spaces, membership, governance, and access | `src/modules/spaces/access.ts`, `src/modules/spaces/governance.ts`, `src/modules/spaces/server.ts`, `src/modules/spaces/write-server.ts`, `src/modules/spaces/url.ts`, `app/(app)/spaces/**` | This is the clearest active shared access boundary across products. | `spaces/model.ts`, `spaces/posture.ts`, and `spaces/shell.ts` remain mixed and are not counted as clean v1 foundation. |
| Shared i18n and locale handling | `src/modules/i18n/**` | Shared copy and language runtime already serve Messenger and KeepCozy. | Clear active foundation. |
| Shared profile identity primitives | `src/modules/profile/types.ts`, `src/modules/profile/avatar.ts`, `src/modules/profile/ui/**`, `app/(app)/settings/profile-settings-form.tsx`, `app/(app)/settings/profile-status-form.tsx` | Shared profile vocabulary, avatar rules, and identity UI already exist beyond Messenger-only use. | `src/modules/profile/server.ts` is useful, but the backing persistence still drifts through messaging-owned code. |
| Shared UI/runtime preference rules | `src/modules/ui-preferences/**`, `app/(app)/home/home-app-zoom-control.tsx` | Cross-product runtime preference handling exists now and is not Messenger-specific. | Small but valid foundation seam. |
| Shared database and migration conventions | `src/lib/supabase/**`, `docs/schema-assumptions.md`, `docs/sql/**` | The repo already operates on shared Supabase conventions and shared migration discipline. | This is foundation as convention and runtime wiring, not a broad internal platform product. |
| Minimal shared support/admin and recovery baseline | `app/(app)/error.tsx`, `app/(app)/spaces/**`, `app/(app)/guarded-server-action-form.tsx` | There is a real, if small, shared baseline for route recovery, guarded submits, and shared member/admin surfaces. | This is not a full support/admin platform. It is only a minimal active baseline. |

## Boundary-Adjacent, But Not Clean Foundation V1 Yet

These areas are important and shared-adjacent, but they should not be counted
as clean platform foundation v1 yet.

| Area | Current paths | Why it is excluded from clean v1 |
| --- | --- | --- |
| Product posture encoded in `spaces` | `src/modules/spaces/model.ts`, `src/modules/spaces/posture.ts`, `src/modules/spaces/shell.ts` | Shared layer still encodes product-specific profiles and shell behavior. |
| Shared shell with Messenger runtime | `app/(app)/app-shell-frame.tsx` | Still owns Messenger-specific client runtime and product nav posture. |
| Shared profile server persistence | `src/modules/profile/server.ts`, `src/modules/messaging/data/profiles-server.ts` | Intended shared ownership exists, but persistence still routes through messaging-backed code. |
| Shared error/support helpers under messaging namespace | `src/modules/messaging/ui/user-facing-errors.ts` | Behavior is broader than Messenger, but ownership label is still misleading. |

## Explicitly Not Active Foundation Yet

These may be important later, but they are not active platform foundation v1
today.

### Not active foundation yet because they are shared capability, not platform

- `src/modules/messaging/**`
- `app/api/messaging/**`
- messaging push/device runtime
- messaging attachment delivery
- messaging realtime
- messaging E2EE
- messaging inbox/thread loaders

These are important and reusable, but they are still messaging capability, not
platform foundation.

### Not active foundation yet because they are product logic

- `app/(app)/inbox/**`
- `app/(app)/chat/[conversationId]/**`
- `app/(app)/rooms/**`
- `app/(app)/issues/**`
- `app/(app)/tasks/**`
- `src/modules/keepcozy/**`

### Not active foundation yet because they are mixed ownership surfaces

- `app/(app)/home/**`
- `app/(app)/activity/**`
- `app/(app)/settings/page.tsx`

### Not active foundation yet because they are planned later, not current software

- HR systems
- finance systems
- legal systems
- project pipeline tooling
- key metrics platform software
- broad internal ops software
- AI agent platform
- Lioka runtime code

## Practical Reading For Follow-Up Work

When someone says "put it in the platform", the safe default inside this repo
should be:

- first ask whether it belongs to active foundation v1
- if not, ask whether it is really a shared capability
- if not, keep it in the product

That discipline matters because active foundation v1 should stay:

- thin
- strong
- reusable
- easy to explain

## Honest Current Conclusion

BWC platform foundation v1 is real, but it is smaller than the whole repo.

Today, v1 is mostly:

- auth/session/runtime infrastructure
- spaces/governance/access foundations
- shared i18n
- shared profile primitives
- shared runtime preference rules
- shared route/admin/recovery basics

That is enough to support multiple products.
It is not yet a broad company-ops software platform, and it should not be
described as one in current engineering decisions.
