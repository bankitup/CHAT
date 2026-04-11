# Platform Architecture Target Shape

## Purpose

This document defines the intended platform-first architecture for this shared
repository without requiring a repo split or a domain rewrite.

## Target Model

The repository should be read as four layers:

1. BWC platform foundation
2. shared capabilities
3. Messenger product
4. KeepCozy product

## 1. BWC Platform Foundation

The platform foundation owns the parts of the repo that should stay shared
regardless of which product surface is active.

Platform foundation includes:

- auth and session continuity
- Supabase client and service-role wiring
- request-context helpers
- App Router shell and shared authenticated layout
- space selection and `space_members` runtime boundary
- common routing helpers and URL scoping
- common i18n
- shared profile identity surface where it is truly cross-product

Primary current files:

- `app/(app)/layout.tsx`
- `app/(app)/app-shell-frame.tsx`
- `app/(app)/actions.ts`
- `src/lib/request-context/server.ts`
- `src/lib/supabase/**`
- `src/modules/i18n/**`
- `src/modules/spaces/**`

## 2. Shared Capability Layer

Shared capabilities are not the same thing as platform foundation.

They are domain-capable systems that can be consumed by more than one product,
while still having one implementation home.

### Messaging capability

This repository already has a substantial messaging capability layer.

It should remain primarily implemented in:

- `src/modules/messaging/**`
- `app/api/messaging/**`

That capability currently owns:

- conversations and membership runtime
- message send/load/edit/delete paths
- message assets and attachment delivery
- reactions
- push lifecycle
- realtime sync
- DM E2EE runtime

Messenger is the main product consumer today.
KeepCozy may compose parts of this capability later where business value
justifies it.

Important rule:

- KeepCozy may reuse messaging capability
- KeepCozy does not become a messaging profile
- messaging capability does not define KeepCozy as a sub-shell of Messenger

## 3. Messenger Product Layer

Messenger is a standalone product built on:

- BWC platform foundation
- the messaging capability
- the shared spaces boundary

Messenger product ownership includes:

- inbox
- chat thread experience
- message-centric activity
- DM and group creation flows
- product-facing conversation UX and thread presentation

Primary current files:

- `app/(app)/inbox/**`
- `app/(app)/chat/[conversationId]/**`
- `app/(app)/activity/page.tsx`

Messenger should be documented and evolved as a product, not as a helper
inside KeepCozy.

## 4. KeepCozy Product Layer

KeepCozy is a separate product built on:

- BWC platform foundation
- shared spaces boundary
- KeepCozy domain runtime and writes
- selective shared capabilities where justified

KeepCozy product ownership includes:

- home-ops dashboard and product framing
- rooms
- issues
- tasks
- operational history
- future marketplace-adjacent operations, when that work is explicitly in scope

Primary current files:

- `src/modules/keepcozy/**`
- `app/(app)/home/page.tsx`
- `app/(app)/rooms/**`
- `app/(app)/issues/**`
- `app/(app)/tasks/**`

Important rule:

- KeepCozy should remain its own product domain
- it should not be documented as a Messenger mode

## 5. Role Of Spaces In The Target Shape

`spaces` should remain the key current shared boundary.

Spaces should continue to mean:

- outer access boundary
- selected runtime context
- shared container for product-scoped work

Spaces should not be redefined as:

- Messenger-only teams
- KeepCozy-only homes
- a disguised product switcher

Instead:

- the platform owns the space boundary
- products interpret that boundary according to their own domain needs

## 6. Target Ownership Reading For Current Routes

| Route area | Target ownership |
| --- | --- |
| `app/(app)/spaces/**` | platform foundation |
| `app/(app)/settings/**` | mostly platform/shared identity surface, with product-specific copy where needed |
| `app/(app)/inbox/**` | Messenger product |
| `app/(app)/chat/[conversationId]/**` | Messenger product on shared messaging capability |
| `app/(app)/activity/page.tsx` | product-specific surface; currently Messenger-oriented when `messenger_full` |
| `app/(app)/home/page.tsx` | currently mixed; should be documented as a shared route with product-dependent rendering until later cleanup |
| `app/(app)/rooms/**`, `issues/**`, `tasks/**` | KeepCozy product |

## 7. Target Ownership Reading For Current Modules

| Module area | Target ownership |
| --- | --- |
| `src/modules/spaces/**` | platform foundation |
| `src/modules/messaging/**` | shared capability, Messenger-first consumer |
| `src/modules/keepcozy/**` | KeepCozy product domain |
| `src/modules/i18n/**` | platform foundation |

## 8. What This Target Shape Does Not Require

It does not require:

- splitting into multiple repos
- creating separate deployments right now
- moving all product code into separate app trees immediately
- renaming current messaging tables
- redesigning the space/conversation/message model
- implementing billing or marketplace work in this branch

## 9. Practical Rule For Follow-Up Branches

When deciding where new work belongs:

- if it is auth, shell, space selection, or shared routing context, it belongs
  to platform foundation
- if it is conversation/message transport or thread runtime, it belongs to the
  messaging capability
- if it is inbox/chat as a product experience, it belongs to Messenger
- if it is rooms/issues/tasks/home-ops workflow, it belongs to KeepCozy
- if KeepCozy needs messaging later, it should compose the capability rather
  than absorb Messenger’s product identity
