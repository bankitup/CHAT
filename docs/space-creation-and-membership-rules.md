# Space Creation and Membership Rules

## Purpose

This document defines the creation and membership rules that must protect the
shared CHAT + KeepCozy repository from cross-space leakage and uncontrolled
space proliferation.

It is intentionally enforcement-oriented.

The goal is to make later provisioning, invitation, object binding, policy,
and RLS work build on one explicit contract for:

- who may create spaces
- how the first governing admin is assigned
- how members are added, removed, and scoped
- how future KeepCozy home/object creation must create or bind spaces safely
- which actions require auditable records

This document does not:

- implement a full invite UX
- add admin panels
- change current runtime enums
- grant new runtime powers by itself

Related documents:

- [space-governance-foundation.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/space-governance-foundation.md)
- [space-governance-role-matrix.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/space-governance-role-matrix.md)
- [keepcozy-chat-integration-seam.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-chat-integration-seam.md)
- [keepcozy-space-policy-matrix.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-policy-matrix.md)
- [space-profiles.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/space-profiles.md)
- [model.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/spaces/model.ts)
- [server.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/spaces/server.ts)
- [server.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/data/server.ts)

## Current Repo Reality

The repository already has the outer boundary primitives:

- `public.spaces` is the top-level shared container
- `public.space_members` is the outer membership boundary
- active-space resolution in
  [server.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/spaces/server.ts)
  reads spaces only through `space_members`
- ordinary space-scoped user discovery in
  [server.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/data/server.ts)
  already has the correct `getAvailableUsers(currentUserId, { spaceId })` path
- a first super-admin-only create-space flow now exists through
  [page.tsx](/Users/danya/IOS%20-%20Apps/CHAT/app/%28app%29/spaces/new/page.tsx)
  and
  [write-server.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/spaces/write-server.ts)
  using exact email or user-id identifiers instead of a global user browser

The repository does not yet have:

- invitation tables
- membership-audit tables
- a reviewed admin UX for member management
- a broad provisioning/admin system beyond the first narrow super-admin flow

That means this document must distinguish:

- the rules that are already structurally true
- the rules that later runtime implementation must harden explicitly

## 1. Hard Rules

The following rules are non-negotiable.

- only `super_admin` may create a new space
- every member belongs to a space through an explicit `space_id` binding
- space admins may govern only their own `space_id`
- no ordinary product flow may browse or discover unrelated users across
  spaces
- adding a person to a conversation or governed object must never bypass the
  outer space-membership boundary
- future KeepCozy home/object creation must use controlled space create-or-bind
  logic, not arbitrary client-picked `space_id` values

## 2. Who Can Create Spaces

Only one governance actor may create spaces:

- `super_admin`

This means:

- ordinary users must not see a self-serve “create space” flow
- space admins must not create sibling or child spaces from the client
- chat creation must not silently create new spaces
- KeepCozy home/object flows must not silently create unmanaged spaces from the
  client

Recommended later implementation shape:

1. a trusted backend provisioning path receives the request
2. the path verifies `super_admin` authority or an audited equivalent service
   permission
3. the path creates the `public.spaces` row
4. the path seeds the first governing membership set
5. the path writes an audit event for provisioning
6. the path returns only the explicitly provisioned space

Hard rule:

- no unaudited direct client insert into `public.spaces`

## 3. How The First Space Admin Is Assigned

Each newly created space must leave provisioning with an explicit governing
admin.

Required rule:

- the first `space_admin` is assigned during space creation, not in a later
  ad hoc cleanup step

Recommended first-pass shape:

1. `super_admin` creates the space
2. `super_admin` seeds one initial governing person into
   `public.space_members`
3. the seeded runtime compatibility role is one of:
   - `owner`, or
   - `admin`
4. governance interpretation treats that seeded person as `space_admin`

Recommended default:

- exactly one initial governing admin should be required
- additional starting admins may be seeded if the provisioning request
  explicitly names them

Must not be allowed:

- creating a space with no governing admin
- assuming the creator is a space admin without writing membership explicitly
- inferring initial admin from later business-role assignment

Important rule:

- first-admin assignment is a governance step
- it is not a KeepCozy business-role decision

## 4. How Space Admin Can Add, Invite, Remove, and Change Members

`space_admin` may govern membership only inside its own space.

This should later mean:

- invite only into the admin's own `space_id`
- add only into the admin's own `space_id`
- remove only from the admin's own `space_id`
- change membership role only inside the admin's own `space_id`

Must remain impossible:

- adding members to a different space by editing URL or payload values
- bulk browsing unrelated users across the whole platform and picking from them
- moving a member from one space to another as an implicit side effect of a
  role change
- changing membership for a space the actor does not govern

Recommended later enforcement shape:

1. resolve the acting user
2. resolve the target `space_id`
3. verify the actor is a `space_admin` for that exact `space_id`
4. verify the target person is being added, removed, or changed only inside
   that same `space_id`
5. write the audited mutation

Important rule:

- invitation and membership mutation are space-boundary actions
- they must never be implemented as mere thread-participant edits

## 5. How Members Are Bound To A Specific Space

Membership must always be explicit and space-local.

Current runtime reality:

- a member is represented through `public.space_members`
- the active runtime compatibility role is still `owner | admin | member`

Required rule:

- membership is the tuple of one `user_id` and one `space_id`

Practical consequences:

- a user may be a member of multiple spaces
- each membership remains separate and independently governed
- membership in space A must grant nothing in space B
- every downstream access decision must start from the relevant `space_id`

What later code should assume:

- `space_members` is the outer allowlist
- `conversation_members` is narrower and subordinate
- KeepCozy object access must never widen beyond the parent `space_id`

## 6. Why Ordinary Space Admin Must Not Have A Global User Browser

Ordinary space admins must not browse the global user base because that would
weaken the space boundary into a platform-wide directory.

Why this is unsafe:

- it turns member management into cross-space user discovery
- it leaks the existence of people outside the admin's own governed space
- it makes accidental or malicious cross-space invites easier
- it conflicts with the rule that ordinary product flows stay space-scoped

Current runtime note:

- [server.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/data/server.ts)
  already has the correct space-scoped path:
  `getAvailableUsers(currentUserId, { spaceId })`
- current runtime now rejects the no-`spaceId` fallback for ordinary flows
- the helper also verifies the actor actually belongs to the exact requested
  `space_id` instead of trusting the client-provided scope alone

Recommended later member-add shape:

- invite by explicit identifier, invite token, email, or reviewed search inside
  the current space context
- never expose a global browse-all-users picker to ordinary `space_admin`

## 7. How Future KeepCozy Home/Object Creation Must Trigger Space Creation Or Binding

KeepCozy home/object creation must not invent a parallel tenancy model.

Required rule:

- each governed home/object must end up bound to one explicit `space_id`

Controlled later flow:

1. a trusted backend create-home or create-object flow receives the request
2. the flow decides whether to:
   - create a new governing space, or
   - bind to an existing governed space
3. if a new space is required, the flow uses `super_admin`-level provisioning
   authority or an audited equivalent service path
4. the flow ensures the first governing admin exists for the resulting space
5. the flow writes the home/object with that `space_id`
6. later threads, updates, attachments, and timeline rows inherit the same
   boundary

Must not be allowed:

- client-side arbitrary `space_id` selection
- object creation without a governing space
- silent creation of duplicate spaces around one already-governed home/object
- rebinding a governed home/object to another space without an audited action

## 8. Audit Expectations For Sensitive Actions

The following actions should be audited explicitly once the runtime mutation
layer is implemented:

- create space
- add member
- remove member
- change role
- bind home/object to space

Minimum audit shape for each sensitive action:

- action type
- actor user or service identity
- target `space_id`
- affected user or affected object when relevant
- old value and new value when relevant
- timestamp
- reviewed reason or source

### Create space

Must record:

- who requested provisioning
- who actually executed provisioning
- which first admin set was seeded
- whether the space was created directly or through a KeepCozy create-or-bind
  flow

### Add member

Must record:

- who added the member
- which `space_id` the member was added to
- what role was assigned
- whether this came from invite acceptance, direct admin add, or provisioning

### Remove member

Must record:

- who removed the member
- which `space_id` was affected
- whether removal was ordinary governance, cleanup, or audited exception

### Change role

Must record:

- who changed the role
- old role
- new role
- which `space_id` was affected

### Bind home/object to space

Must record:

- who triggered the bind
- whether the action created a new space or bound to an existing one
- the resulting `space_id`
- the affected home/object identifier

Hard rule:

- auditability must apply to both direct admin actions and backend automation

## 9. Current State vs Target State

| Topic | Current state | Target state |
| --- | --- | --- |
| Space creation | first narrow `super_admin` runtime provisioning path exists | `super_admin`-only controlled provisioning with fuller audit/tooling |
| First admin assignment | explicit during current provisioning flow | explicit during provisioning |
| Member management | no dedicated invite runtime yet | own-space-only invite/add/remove/change-role flow |
| Membership boundary | `public.space_members` already exists | remains the hard outer allowlist |
| User discovery for admin actions | space-scoped path exists and now rejects no-`spaceId` ordinary fallback | no ordinary global user browser for `space_admin` |
| KeepCozy create-or-bind flow | not yet implemented | controlled audited backend create-or-bind path |
| Sensitive-action audit | not yet defined in runtime | explicit audit expectations for provisioning and membership changes |

## 10. Practical Guidance For Later Branches

When a later branch asks “can this person create or change membership?”, answer
in this order:

1. is this a space-creation action or a membership action
2. if it is space creation, does the actor have `super_admin` authority
3. if it is membership mutation, is the actor a `space_admin` for this exact
   `space_id`
4. is the target user or object being changed only inside that same `space_id`
5. is the action auditable and attributable

If a proposal cannot answer all five questions cleanly, it is probably opening
the door to uncontrolled space creation or cross-space leakage.

## Remaining Ambiguities

- whether first-pass member add should require explicit invitation acceptance,
  allow direct admin add, or support both
- whether first-admin provisioning should require exactly one seeded admin or
  allow multiple from day one
- how later audited support or repair tooling should expose exceptional member
  changes without normalizing them into ordinary admin behavior
- whether future KeepCozy create-or-bind should always create one space per
  home, or sometimes bind multiple governed objects into one preexisting space
