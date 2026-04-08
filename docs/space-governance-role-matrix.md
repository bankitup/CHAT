# Space Governance Role Matrix

## Purpose

This document defines the role-separation contract that later governance,
profile, policy, and RLS work should follow for shared CHAT + KeepCozy spaces.

The goal is to keep four different kinds of meaning separate:

- platform-wide governance authority
- one-space governance authority
- KeepCozy business/operational meaning
- thread-local participation and moderation mechanics

This is a semantics and enforcement-prep document. It does not:

- expand current runtime enums
- implement final RLS or policy
- turn business roles into thread roles
- turn thread roles into space-governance roles

Related documents:

- [space-creation-and-membership-rules.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/space-creation-and-membership-rules.md)
- [space-governance-foundation.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/space-governance-foundation.md)
- [keepcozy-role-layering.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-role-layering.md)
- [keepcozy-chat-role-alignment.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-chat-role-alignment.md)
- [keepcozy-space-access-model.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-access-model.md)
- [keepcozy-space-policy-matrix.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-policy-matrix.md)
- [types.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/spaces/types.ts)
- [model.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/spaces/model.ts)
- [group-policy.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/group-policy.ts)

## Current Repo Reality

The repository currently has three relevant active or future-facing role
surfaces:

- current runtime `SpaceRole = owner | admin | member` in
  [model.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/spaces/model.ts)
- current runtime group-thread moderation role
  `owner | admin | member` in
  [group-policy.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/group-policy.ts)
- future-facing global and KeepCozy business roles in
  [types.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/spaces/types.ts)

What is still missing is one explicit governance matrix saying which layer owns
which meaning.

This document provides that matrix.

## 1. Four Role Planes

| Plane | Examples | Scope | Primary question it answers |
| --- | --- | --- | --- |
| Global governance role | `super_admin` | platform-wide, audited, exceptional | who may provision or retire spaces at all |
| Space governance role | `space_admin`, `space_member` | one `space_id` only | who governs membership and boundary enforcement for this one space |
| KeepCozy business role | `owner`, `resident`, `operator`, `internal_staff`, `contractor`, `supplier`, `inspector` | one KeepCozy-governed space | what job or stakeholder meaning this person has in the space |
| Thread participation/moderation role | `owner`, `admin`, `member` | one conversation only | who participates in or moderates this one thread |

Hard rule:

- identical words across planes do not imply identical semantics

## 2. Practical Matrix

| Role label | Plane | Scope | Can create spaces | Can manage space members | Can manage thread participants | Meaning |
| --- | --- | --- | --- | --- | --- | --- |
| `super_admin` | global governance | platform-wide | yes | only for provisioning or audited exception | not by default | audited platform authority for space lifecycle |
| `space_admin` | space governance | one space | no | yes, inside own space only | only if also granted thread-local moderation authority | governs one space boundary and its roster |
| `space_member` | space governance | one space | no | no | no by governance role alone | ordinary participant inside one space boundary |
| `owner` | KeepCozy business role | one KeepCozy space | no | no by business role alone | no by business role alone | primary client-side stakeholder in the space |
| `resident` | KeepCozy business role | one KeepCozy space | no | no | no by business role alone | occupant or end user in the space |
| `operator` | KeepCozy business role | one KeepCozy space | no | no by business role alone | no by business role alone | primary operational manager for the space |
| `internal_staff` | KeepCozy business role | one KeepCozy space | no | no by business role alone | no by business role alone | delegated operator-side staff role |
| `contractor` | KeepCozy business role | one KeepCozy space | no | no | no by business role alone | temporary execution role |
| `supplier` | KeepCozy business role | one KeepCozy space | no | no | no by business role alone | temporary vendor/logistics role |
| `inspector` | KeepCozy business role | one KeepCozy space | no | no | no by business role alone | temporary reviewer/assessor role |
| thread `owner` | thread moderation | one conversation | no | no | yes, per thread policy | highest thread-local moderation authority |
| thread `admin` | thread moderation | one conversation | no | no | yes, within thread policy limits | delegated thread-local moderation authority |
| thread `member` | thread participation | one conversation | no | no | no | ordinary participant in one thread |

Important reading rule:

- “can manage thread participants” is not the same as “can manage space
  members”
- thread moderation always remains subordinate to the outer `space_members`
  boundary

## 3. Global Roles

### `super_admin`

`super_admin` is the governance term for the authority that may provision,
retire, or exceptionally repair spaces.

This role is governance-only.

It may:

- create spaces
- seed the initial governing membership set
- approve exceptional rebinding or migration through audited tooling
- operate the later KeepCozy create-or-bind backend path for homes/objects

It must not:

- become an implicit member of every space
- browse ordinary space data just because it can provision spaces
- behave like a thread moderator unless explicitly added in a narrower layer

### `platform_admin` and `support_staff`

Current future-facing contracts in
[types.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/spaces/types.ts) use
`platform_admin` and `support_staff` as platform-level labels.

Governance rule:

- these are not synonyms for `super_admin`
- they are platform-context roles that still require explicit audited policy
  before entering a space

Practical later expectation:

- `super_admin` may later be implemented by a narrower service permission, by a
  tightly scoped `platform_admin` capability, or by both
- the governance meaning should stay `super_admin` even if runtime plumbing
  uses a different internal label

## 4. Space Governance Roles

### `space_admin`

`space_admin` is the governance label for someone who may manage one space and
its membership boundary.

This role is governance-only.

It may:

- manage members inside its own space only
- operate later invite and removal flows for its own space only
- govern boundary-preserving space settings inside its own space only

It must not:

- create spaces
- govern unrelated spaces
- gain cross-space visibility
- inherit thread moderation automatically

Current runtime compatibility note:

- today this is still represented only through the coarse runtime
  `SpaceRole = owner | admin | member`
- for governance interpretation, current runtime `owner` and `admin` should be
  read as `space_admin` compatibility values, not as KeepCozy business roles

### `space_member`

`space_member` is the governance label for an ordinary non-admin participant in
one space.

This role is governance-only.

It may:

- participate inside allowed space-scoped flows
- create or reply only where later product policy allows

It must not:

- manage the general roster
- create spaces
- widen its access through thread mechanics

Current runtime compatibility note:

- current runtime `SpaceRole.member` should be read as the coarse compatibility
  value for `space_member`, not as a business role

## 5. KeepCozy Business Roles

KeepCozy business roles are:

- `owner`
- `resident`
- `operator`
- `internal_staff`
- `contractor`
- `supplier`
- `inspector`

These roles are business-only.

They answer questions such as:

- who is the primary stakeholder
- who manages operations
- who is internal staff
- who is a temporary external participant

They do not answer:

- who may create a space
- who governs the space roster
- who moderates a specific conversation

Hard rule:

- if a person needs business meaning and governance power, they hold roles in
  two planes
- governance power must not be inferred from a business title alone

Examples:

- an `operator` may also be a `space_admin`, but only if explicitly granted
  that governance role
- an `owner` in KeepCozy business language is not automatically thread `owner`
- a `contractor` may be a `space_member` without becoming a space admin or
  thread admin

## 6. Thread Participation and Moderation Roles

Current runtime thread roles remain:

- `owner`
- `admin`
- `member`

These roles are thread-local mechanics only.

They answer:

- who can rename or manage one group thread
- who can add or remove participants from one group thread within thread policy
- who is an ordinary participant in that thread

They do not answer:

- who governs the whole space
- who may create spaces
- what KeepCozy business role the person has

Hard rule:

- thread `owner` is not KeepCozy property `owner`
- thread `admin` is not `space_admin`
- thread `member` is not a business-role substitute

## 7. Who Can Create Spaces

Only one role may create spaces:

- `super_admin`

The following must not create spaces:

- `space_admin`
- `space_member`
- any KeepCozy business role by itself
- any thread participation or moderation role

Future KeepCozy rule:

- home/object creation should later call a controlled backend flow that uses
  `super_admin`-level provisioning authority or an equivalent audited service
  path
- business flows must not let users pick arbitrary unrelated `space_id` values

## 8. Who Can Manage Members

### Space membership management

The following governance rule should hold:

- `super_admin` may seed or exceptionally repair membership through audited
  tooling
- `space_admin` may manage members inside its own space only
- `space_member` may not manage the general space roster
- KeepCozy business roles may not manage the space roster by business title
  alone
- thread roles may not manage the space roster

### Thread participant management

The following thread-local rule should hold:

- thread `owner` and thread `admin` may manage participants only inside the
  current conversation and only within thread policy
- thread `member` may not moderate
- thread-local participant control must never bypass the outer space boundary

## 9. Semantics That Must Never Be Conflated

Treat the following as architectural errors:

- `super_admin` and `platform_admin` as automatic synonyms
- `platform_admin` or `support_staff` as implicit members of every space
- `space_admin` and KeepCozy `operator` as automatic synonyms
- `space_admin` and thread `admin` as automatic synonyms
- KeepCozy `owner` and thread `owner` as automatic synonyms
- KeepCozy `owner` and current runtime `SpaceRole.owner` as automatic synonyms
- KeepCozy `resident`, `contractor`, `supplier`, or `inspector` as equivalent
  to runtime `member`
- business-role assignment as proof of governance authority
- thread moderation as proof of business authority
- thread membership as proof of space membership

## 10. Translation Layer Needed Later

Later implementation work needs an explicit translation and compatibility layer
across these planes.

### A. Global governance to runtime/admin plumbing

Needed because:

- the governance concept is `super_admin`
- current future-facing contracts talk about `platform_admin` and
  `support_staff`

Required later output:

- one narrow backend or policy seam that says who is actually allowed to act as
  `super_admin`

### B. Space governance to current runtime `SpaceRole`

Needed because:

- current runtime only has `owner | admin | member`
- later governance work wants explicit `space_admin | space_member` semantics

Recommended current interpretation:

- runtime `owner` -> `space_admin`
- runtime `admin` -> `space_admin`
- runtime `member` -> `space_member`

Hard rule:

- this is a governance interpretation layer, not proof of KeepCozy business
  meaning

### C. KeepCozy business role to runtime compatibility

Needed because:

- the business layer in [types.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/spaces/types.ts)
  is already richer than the active runtime role enums

Current draft reality:

- business roles may map lossily to current runtime `SpaceRole`
- that mapping is compatibility-only and must not become the authorization
  truth table

Hard rule:

- business role should drive business policy and product language
- governance authority should still be assigned explicitly

### D. Space governance and business role to thread mechanics

Needed because:

- thread moderation must stay explicit and thread-local

Required later rule:

- no business role or space-admin role should silently materialize thread
  `owner` or thread `admin`
- thread moderation must be granted or derived through an explicit reviewed
  policy layer

## 11. Current State vs Target State

| Topic | Current state | Target state |
| --- | --- | --- |
| Global governance term | implicit or mixed with future-facing `platform_admin` wording | explicit `super_admin` governance term with narrow implementation path |
| Space governance meaning | coarse runtime `owner | admin | member` | explicit `space_admin | space_member` interpretation |
| KeepCozy business meaning | future-facing docs and contracts only | explicit business-role layer used by policy and object workflows |
| Thread moderation meaning | generic `owner | admin | member` | still generic and still thread-local |
| Translation between layers | mostly implicit | explicit compatibility and policy mapping |
| Space creation authority | not yet represented as a clean role matrix | `super_admin` only |
| Member-management authority | partly implied by current generic runtime labels | explicit separation between space-roster management and thread moderation |

## 12. Practical Guidance

When a later branch asks “what authority does this user have?”, answer in this
order:

1. do they have `super_admin` authority for audited provisioning or exception
2. are they a `space_admin` or `space_member` in this one space
3. what KeepCozy business role do they hold in this one space
4. what thread-local participation or moderation role do they hold in this one
   conversation

If a proposal cannot keep those four answers separate, it is probably mixing
governance, business semantics, and messaging mechanics too early.

## Remaining Ambiguities

- whether future runtime language should ever expose `space_admin` directly in
  product/admin surfaces, or keep it as an enforcement-only interpretation
- whether `super_admin` should eventually be represented as a formal runtime
  role label, a service-path permission, or both
- whether some later product policies should let business-role holders request
  roster changes without becoming actual `space_admin`
- how much later tooling should expose the lossy compatibility mapping from
  business roles to current runtime `SpaceRole`
