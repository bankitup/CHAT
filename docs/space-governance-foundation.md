# Space Governance Foundation

## Purpose

This document defines the hard governance, ownership, and isolation contract
for all spaces in the shared CHAT + KeepCozy repository.

The goal is to make future space profiles, KeepCozy object provisioning, and
product-surface splits build on one explicit rule set instead of relying on
implicit assumptions about who owns a space, who may create one, and what data
may cross a boundary.

This is a governance and isolation foundation document, not a UI branch.

Related documents:

- [space-creation-and-membership-rules.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/space-creation-and-membership-rules.md)
- [space-governance-role-matrix.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/space-governance-role-matrix.md)
- [space-profiles.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/space-profiles.md)
- [keepcozy-chat-shared-vocabulary.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-chat-shared-vocabulary.md)
- [keepcozy-chat-role-alignment.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-chat-role-alignment.md)
- [keepcozy-chat-integration-seam.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-chat-integration-seam.md)
- [keepcozy-space-policy-matrix.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-policy-matrix.md)
- [keepcozy-space-access-model.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-access-model.md)
- [keepcozy-role-layering.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-role-layering.md)
- [types.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/spaces/types.ts)
- [model.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/spaces/model.ts)
- [server.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/spaces/server.ts)
- [server.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/data/server.ts)
- [2026-04-03-spaces-v1.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-03-spaces-v1.sql)
- [2026-04-08-spaces-runtime-contract-align.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-08-spaces-runtime-contract-align.sql)
- [2026-04-08-spaces-profile-column.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-08-spaces-profile-column.sql)

## Why This Comes Before Broader Profile Rollout

Space profiles, KeepCozy object binding, and future product-shell differences
are only safe if the space boundary itself is governed first.

This branch therefore locks the governance contract before later work expands:

- profile-aware shell routing
- invitation and assignment models
- KeepCozy home/object provisioning
- richer role and policy enforcement

Important rule:

- product surface differences must always remain subordinate to space
  governance and isolation

## Current Repo Reality

The repository already has the first hard boundary primitives:

- `public.spaces` is the top-level shared container
- `public.space_members` is the outer membership boundary
- `public.conversations.space_id` scopes DMs and groups to one space
- active space resolution flows through
  [server.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/spaces/server.ts)
- ordinary app flows that discover other users inside a space already use the
  space-scoped path in
  [server.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/data/server.ts)
  `getAvailableUsers(currentUserId, { spaceId })`
- a first super-admin-only create-space flow now exists on
  [page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/%28app%29/spaces/new/page.tsx)
  with provisioning logic in
  [write-server.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/spaces/write-server.ts)

The repository does not yet have:

- invitation tables
- assignment tables
- a persisted governance-specific admin model beyond current generic
  `owner | admin | member`
- broad admin tooling beyond the first narrow super-admin provisioning path

That means the governance foundation must distinguish clearly between:

- what is already structurally true
- what still needs later enforcement work

### Current `public.spaces` Runtime Contract

The current runtime now assumes a narrow base schema for `public.spaces`.

Required columns:

- `id`
- `name`
- `created_by`
- `created_at`
- `updated_at`

Optional persisted column:

- `profile`

Current runtime usage:

- active-space reads in
  [server.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/spaces/server.ts)
  read `id`, `name`, `created_by`, and `created_at`
- create-space provisioning in
  [write-server.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/spaces/write-server.ts)
  now writes `created_by`, `name`, and `updated_at`
- persisted profile storage is optional because the read path already falls
  back safely when `public.spaces.profile` is absent

Apply these SQL files in this order when an environment is behind:

1. [2026-04-03-spaces-v1.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-03-spaces-v1.sql)
   for the base `spaces` and `space_members` contract
2. [2026-04-08-spaces-runtime-contract-align.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-08-spaces-runtime-contract-align.sql)
   for older existing `spaces` tables that are missing `updated_at`
3. [2026-04-08-spaces-profile-column.sql](/Users/danya/IOS%20-%20Apps/CHAT/docs/sql/2026-04-08-spaces-profile-column.sql)
   when the environment should persist profile routing instead of relying on
   the runtime fallback

### Current Runtime Governance Seam

The repository now has a narrow governance-aware runtime seam, even though
final enforcement is still deferred.

- [model.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/spaces/model.ts)
  defines explicit governance labels for:
  - global governance role: `super_admin`
  - space governance role: `space_admin | space_member`
- [server.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/spaces/server.ts)
  derives current space governance from runtime `space_members.role`:
  - runtime `owner` or `admin` -> `space_admin`
  - runtime `member` -> `space_member`
- the same server layer resolves global super-admin capability through an
  opt-in runtime seam:
  - `CHAT_SUPER_ADMIN_USER_IDS`
  - `CHAT_SUPER_ADMIN_EMAILS`
- when those allowlists are not configured, global governance resolves to no
  active `super_admin` binding by default
- `resolveActiveSpaceForUser(...)` can now expose:
  - active space profile state
  - active space governance state
  - resolved global governance state

Important current-state note:

- this seam is for awareness and later routing/policy plumbing only
- it is not final invitation, provisioning, audit, or RLS enforcement

## 1. Absolute Boundary Rule

The absolute rule for spaces is:

- no user, thread, message, object, media, timeline row, or policy decision
  may leave its space boundary unless an explicit later audited migration says
  so

In plain language:

- a space is an isolation boundary, not just a UI grouping
- belonging to one space must never imply visibility into another space
- profile differences must never widen access across spaces
- KeepCozy and CHAT must share the same boundary, not maintain parallel
  ownership systems

Practical consequences:

- every conversation belongs to exactly one `space_id`
- future KeepCozy homes/objects must bind to one governing `space_id`
- media and documents inherit the parent space/object/thread boundary
- a user may belong to multiple spaces, but each access decision remains
  space-local

## 2. Governance Actors and Responsibilities

This branch should treat governance responsibilities in three layers.

### Super admin

`super admin` is the governance term for the platform-side authority that may
provision or retire spaces.

Important alignment note:

- this is not currently a `space_members` role
- this should later be implemented through a tightly controlled platform-level
  admin capability or audited backend service path
- it must not become an implicit ordinary member of every space

Super admin responsibilities:

- create new spaces
- seed or transfer the initial space owner/admin set
- approve exceptional rebinding or migration of governed data
- operate the controlled backend path that later auto-creates or binds spaces
  for KeepCozy homes/objects
- intervene in governance only through audited tooling

Super admin must not:

- browse ordinary space data by default just because they can provision spaces
- become a hidden bypass around `space_members`
- behave like a space-local admin unless explicitly added or granted an audited
  exception

### Space admin

`space admin` is the governance responsibility for managing one space only.

Current runtime note:

- today this maps loosely to the current generic `space_members.role` surface
  of `owner | admin`
- later branches may refine this, but the governance rule is already stable

Space admin responsibilities:

- manage members inside their own space only
- manage conversations, operational records, and later assignments inside
  their own space only
- maintain the boundary between space members and non-members
- operate any later invite flow only for their own space

Space admin must not:

- create new spaces
- administer unrelated spaces
- discover or browse users outside their own governed space through ordinary
  product flows
- rebind a home/object into another space without a higher audited path

### Space member

`space member` is any non-admin participant inside one space.

Space member responsibilities:

- use the space only inside the access granted by membership and later
  assignment/object policy
- create or reply only within allowed space-scoped flows
- remain fully contained inside the space boundary

Space member must not:

- invite or manage unrelated members by default
- discover users outside the current space
- access other spaces through profile or shell differences

## 3. Who Can Create Spaces

Hard rule:

- only the super admin may create a new space

Required implications:

- there must be no self-serve client-space creation path for ordinary users
- there must be no “create a new chat/group/home” shortcut that silently
  provisions a new space from the client side
- creation must later happen through a controlled backend path with auditability

Recommended later implementation shape:

1. a trusted backend provisioning path receives the creation request
2. the path validates that the caller is allowed to provision a space
3. the path creates the `public.spaces` row
4. the path seeds the initial owner/admin membership set
5. the path returns only the space that was explicitly provisioned

## 4. Who Can Invite and Manage Members Inside a Space

The governance default should remain intentionally narrow.

### Super admin

May:

- seed the initial membership set during provisioning
- perform exceptional audited intervention later

Should not:

- act as the ordinary day-to-day member manager for every space

### Space admin

May later:

- invite members into their own space
- remove members from their own space
- change space-local membership within reviewed policy bounds

Must remain limited to:

- their own `space_id`
- their own governed membership list
- reviewed invite/removal semantics once invitation records exist

### Space member

Must not:

- manage the general roster by default
- invite unrelated people into the space by default
- use chat or object flows as a side door for membership creation

Important rule:

- invitation is a governance function at the space boundary
- assignment is a narrower later function inside the space
- neither may widen access across spaces

## 5. What Must Never Be Possible Across Spaces

The following should be treated as architectural violations.

- global user discovery across unrelated spaces in ordinary product flows
- adding a non-member to a conversation or operational object without first
  satisfying the outer space boundary
- one conversation belonging to multiple spaces
- one KeepCozy home/object being casually shared across multiple spaces
  without an explicit reviewed migration model
- browsing rooms, issues, tasks, attachments, or messages from another space
  through URL guessing or shell switching
- profile-aware routing widening access into a different space
- space admin authority in space A carrying into space B automatically
- super admin being treated as an implicit space member everywhere
- DM privacy being widened by space admin or super-admin status alone

Important clarification:

- a person may legitimately belong to multiple spaces
- what must never happen is implicit mixing between those spaces

## 6. How Future KeepCozy Home/Object Creation Must Interact With Spaces

Future KeepCozy home/object creation must not invent an unmanaged parallel
container model.

Required rule:

- a KeepCozy home/object must later be created through a controlled backend
  path that either creates the correct governed space or binds to an existing
  governed space

Recommended later shape:

1. a trusted backend flow receives a request to create a home/object
2. the flow decides whether the request should:
   - create a new governing space, or
   - bind to an existing governing space
3. the flow writes the home/object with the resulting `space_id`
4. the flow seeds or validates the correct owner/admin membership
5. later object-linked threads and timeline rows inherit that same `space_id`

Must not be allowed:

- client-side free selection of arbitrary `space_id` values across unrelated
  spaces
- object creation without a governing space
- silent creation of a second parallel space around an already-governed object
- object rebinding across spaces without a reviewed audited path

## 7. Governance Guardrails for Shared CHAT + KeepCozy Architecture

These guardrails should remain explicit in later branches.

### Space boundary first

- `space_members` is the outer allowlist
- `conversation_members` is narrower and subordinate
- no later helper should skip the outer space boundary

### Profiles do not change ownership

- `messenger_full` vs `keepcozy_ops` may change shell posture
- profiles must never create different ownership or isolation rules

### Chat remains shared but bounded

- `public.conversations.kind` stays `dm | group`
- all conversations still belong to one `space_id`
- message/media history remains shared infrastructure, not cross-space glue

### No ordinary global user discovery

The current `getAvailableUsers(...)` helper already has the correct
space-scoped path for product flows when `spaceId` is present, and current
runtime now rejects the no-`spaceId` ordinary fallback.

Governance rule:

- all ordinary product flows must use the space-scoped path
- the helper must verify the actor actually belongs to the exact requested
  `space_id`
- no ordinary global user-discovery fallback should remain in place

### Roles stay layered

- platform governance authority is not a space role
- space role is not a thread moderation role
- thread moderation role is not a bypass around space governance

### Audit before exception

- exceptional cross-boundary repair, migration, or support access must be
  explicit and audited
- “temporary exception” must never become the default architecture

## 8. Current State vs Target State

| Topic | Current state | Target state |
| --- | --- | --- |
| Outer isolation boundary | `public.spaces`, `public.space_members`, and `conversations.space_id` already exist | remains the hard non-negotiable boundary |
| Space creation | first narrow super-admin provisioning path exists through `/spaces/new` | super-admin-only controlled backend provisioning with fuller audit/tooling |
| Space admin scope | current runtime has generic `owner | admin | member`; scope is coarse | explicit own-space-only governance responsibilities |
| Member management | no dedicated invite records yet | explicit invite/removal model, still limited to one space |
| User discovery | ordinary app flows use space-scoped lookup when `spaceId` is provided | no ordinary global discovery path across unrelated spaces |
| KeepCozy home/object binding | not yet governed by a dedicated provisioning/binding flow | backend auto-create-or-bind through governed `space_id` logic |
| Profile and shell differences | may later vary by space | must stay subordinate to the same governance contract |
| Cross-space exceptions | not formalized | explicit audited exception path only, never ordinary behavior |

## 9. Practical Enforcement Guidance For Later Branches

When a later branch asks “can this action happen?”, answer in this order:

1. is there an explicit governing `space_id`
2. is the actor an explicit member of that space
3. is the actor acting in the right governance role for that one space
4. is the action still confined to that same space
5. if not, is there an explicit audited exceptional path

If a proposal cannot answer those five questions cleanly, it is probably
violating the governance foundation.

## 10. Practical Verification

Use the current runtime seam on this branch:

- `dmtest1@chat.local` is an initial `super_admin`
- `dmtest2@chat.local` is an initial `super_admin`
- ordinary users are not `super_admin`
- current ordinary user discovery remains space-scoped only

### Test With `dmtest1@chat.local`

1. Sign in as `dmtest1@chat.local`.
2. Open [spaces/page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/%28app%29/spaces/page.tsx).
3. Verify the `Create space` card is visible.
4. Open [page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/%28app%29/spaces/new/page.tsx).
5. Create a space with:
   - a name
   - at least one admin identifier
   - optional participant identifiers
6. Verify the created people are seeded into `public.space_members` and the
   first listed admin is written as `owner`.
7. If you include `dmtest1@chat.local` in the member/admin list, verify the
   new space appears in the selector afterward.

### Test With `dmtest2@chat.local`

1. Repeat the same flow as `dmtest1@chat.local`.
2. Verify `dmtest2@chat.local` also sees the `Create space` entry point.
3. Verify a created space can be provisioned without changing behavior for
   ordinary users.

### Verify A Space Admin Cannot Leave The Space Boundary

1. Use a user who is `owner` or `admin` in one space but not a member of a
   second space.
2. Confirm that user does not see the global `Create space` action.
3. Confirm they cannot open the `/spaces/new` flow successfully; it redirects
   back to `/spaces`.
4. Confirm ordinary participant lookup continues to require an explicit
   `spaceId` and that the actor must actually belong to that exact space.
5. Confirm the user cannot discover unrelated users through ordinary inbox/chat
   flows outside their own space boundary.

### Verify Ordinary Members Cannot Create Spaces

1. Sign in as a user who is only a `member`.
2. Open the space selector.
3. Verify there is no `Create space` card.
4. Try to open `/spaces/new` directly.
5. Verify the user is redirected back to `/spaces` and no space is created.

### What Still Waits For Later Branches

- persisted and audited `super_admin` storage beyond the email allowlist
- own-space add/remove/change-role UI for `space_admin`
- invite records and acceptance flow
- audit logging for provisioning and member mutations
- KeepCozy create-or-bind automation on top of the same governed `space_id`

## Remaining Ambiguities

- whether the future super-admin capability should be implemented as a formal
  `platform_admin` runtime role, a narrower service-path permission, or both
- whether initial member-management policy should treat current runtime
  `owner` and `admin` identically for governance or refine them earlier
- how later audited exception tooling should be represented without weakening
  the “no implicit cross-space access” rule
- whether future KeepCozy provisioning should always create one space per home,
  or sometimes bind multiple governed objects into one preexisting space
