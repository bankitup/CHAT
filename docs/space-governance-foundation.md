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

The repository does not yet have:

- a dedicated super-admin provisioning path
- invitation tables
- assignment tables
- a persisted governance-specific admin model beyond current generic
  `owner | admin | member`

That means the governance foundation must distinguish clearly between:

- what is already structurally true
- what still needs later enforcement work

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
space-scoped path for product flows when `spaceId` is present.

Governance rule:

- all ordinary product flows must use the space-scoped path
- the no-`spaceId` global fallback should be treated as a hardening target and
  later removed or tightly admin-gated

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
| Space creation | no documented reviewed provisioning-only runtime path yet | super-admin-only controlled backend provisioning |
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

Use the following review model when sanity-checking this branch before the next
profile/runtime phase.

### One super-admin-created messenger space

Reason about a messenger-first space like this:

- a `super_admin` provisions the space
- the first governing admin is seeded explicitly into `space_members`
- the space may later resolve to profile `messenger_full`
- the profile changes shell posture, not ownership or isolation
- members of that messenger space remain invisible to unrelated spaces unless
  they also have explicit membership there

### One super-admin-created KeepCozy space

Reason about a KeepCozy-first space like this:

- a `super_admin` provisions the space or later creates/binds it through the
  controlled KeepCozy create-or-bind backend path
- the first governing admin is seeded explicitly into `space_members`
- the space may later resolve to profile `keepcozy_ops`
- homes, objects, threads, and later timeline rows inherit that same
  governing `space_id`
- the KeepCozy product surface changes, but the space boundary stays the same

### What a space admin should and should not be able to do

A `space_admin` should be able to:

- manage members inside the governed `space_id`
- operate later invite/remove/change-role flows for that same `space_id`
- manage space-local conversations and operational records inside that same
  boundary

A `space_admin` should not be able to:

- create new spaces
- manage unrelated spaces
- browse the global user base in ordinary product flows
- treat business role alone as proof of thread-moderation or cross-space power

### What a member should and should not be able to do

A `space_member` should be able to:

- participate inside allowed space-scoped product flows
- create or reply where later product policy allows

A `space_member` should not be able to:

- manage the general roster
- invite unrelated users by default
- widen access through thread mechanics
- infer access to another space because the same person belongs to both

### What must still wait for later branches

The following are intentionally not final on this branch:

- persisted super-admin storage and reviewed provisioning tooling
- final invite/add/remove/change-role runtime implementation
- audited mutation logging for sensitive actions
- KeepCozy create-or-bind backend automation
- final RLS and policy enforcement
- profile-aware capability gating beyond the governance seam

## Remaining Ambiguities

- whether the future super-admin capability should be implemented as a formal
  `platform_admin` runtime role, a narrower service-path permission, or both
- whether initial member-management policy should treat current runtime
  `owner` and `admin` identically for governance or refine them earlier
- how later audited exception tooling should be represented without weakening
  the “no implicit cross-space access” rule
- whether future KeepCozy provisioning should always create one space per home,
  or sometimes bind multiple governed objects into one preexisting space
