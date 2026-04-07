# KeepCozy and CHAT Role Alignment

## Purpose

This document defines the naming and semantics alignment between the existing
CHAT role surfaces and the future KeepCozy role model.

The goal is to make later KeepCozy work more consistent without pretending the
current CHAT runtime already has the full operational role system.

This is a naming and semantics reference only. It does not:

- expand active runtime enums
- change `dm | group` behavior
- implement final policy or RLS
- turn current moderation roles into business roles

Related documents:

- [keepcozy-role-layering.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-role-layering.md)
- [keepcozy-space-access-model.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-access-model.md)
- [keepcozy-space-policy-matrix.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-policy-matrix.md)
- [keepcozy-chat-shared-vocabulary.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-chat-shared-vocabulary.md)
- [keepcozy-space-contract-types.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-contract-types.md)
- [types.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/spaces/types.ts)
- [model.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/spaces/model.ts)
- [group-policy.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/group-policy.ts)

## Current Role Surfaces

The repository currently has three active or future-facing role surfaces that
must stay conceptually separate.

| Layer | Current or future surface | Primary meaning |
| --- | --- | --- |
| Global platform role | `authenticated_user`, `platform_admin`, `support_staff` in future-facing contracts | platform identity and audited support context |
| Runtime space role | `SpaceRole = owner | admin | member` | current coarse space participation |
| Runtime thread participation/moderation role | `GroupConversationMemberRole = owner | admin | member`, DM `member` only | current thread-local membership and moderation |
| Future KeepCozy space role | `owner`, `resident`, `operator`, `internal_staff`, `contractor`, `supplier`, `inspector` | operational/business role inside a space |

Important rule:

- current CHAT runtime roles are still generic compatibility surfaces
- future KeepCozy space roles carry the real business meaning

## 1. Shared Roles That Should Use The Same Naming

The following role names should stay stable across CHAT docs, KeepCozy docs,
and the shared contract layer.

### Shared platform-role names

These should keep the same names anywhere they are referenced:

- `authenticated_user`
- `platform_admin`
- `support_staff`

Rule:

- these are platform-context roles, not implicit space or thread access roles

### Shared operational role names

These should keep the same business-role names in future KeepCozy-facing docs,
contracts, and policy work:

- `owner`
- `resident`
- `operator`
- `internal_staff`
- `contractor`
- `supplier`
- `inspector`

Rule:

- these are business/operational roles at the space layer
- they should not be renamed into current generic runtime labels like
  `admin` or `member` in product or policy docs

### Shared generic moderation names

These should keep the same generic runtime meaning where they already exist:

- `owner`
- `admin`
- `member`

Rule:

- these names are valid only when clearly qualified as thread participation or
  moderation roles, or as the current lossy runtime `SpaceRole`
- they are not the source-of-truth names for KeepCozy business roles

## 2. Business Roles vs Moderation Roles

This distinction must stay explicit.

| Role name | Layer | Meaning |
| --- | --- | --- |
| `owner` | KeepCozy space role | client-side primary stakeholder in the managed space |
| `resident` | KeepCozy space role | occupant/end user in the managed space |
| `operator` | KeepCozy space role | primary operational manager/overseer |
| `internal_staff` | KeepCozy space role | operator-side staff with narrower delegated scope |
| `contractor` | KeepCozy space role | temporary external service participant |
| `supplier` | KeepCozy space role | temporary external vendor participant |
| `inspector` | KeepCozy space role | temporary external reviewer/assessor |
| `owner` | runtime thread moderation role | highest generic thread moderation authority in a group |
| `admin` | runtime thread moderation role | generic delegated moderation authority |
| `member` | runtime thread participation role | ordinary participant without moderation authority |
| `owner` | current runtime `SpaceRole` | coarse top-level space participation role in current CHAT runtime |
| `admin` | current runtime `SpaceRole` | coarse current space-management compatibility role |
| `member` | current runtime `SpaceRole` | coarse current space-participation compatibility role |

Important rule:

- identical tokens like `owner` do not automatically mean identical semantics
- the layer must always be clear when the role is discussed

## 3. Roles That Should Remain CHAT-Internal For Now

The following role semantics should remain internal/runtime concepts until a
later reviewed schema change says otherwise.

| Role or surface | Why it stays CHAT-internal for now |
| --- | --- |
| runtime `SpaceRole.admin` | it is a lossy compatibility role, not the same thing as KeepCozy `operator` or `internal_staff` |
| runtime `SpaceRole.member` | it is too generic to stand in for `resident`, `contractor`, `supplier`, or `inspector` |
| thread moderation `admin` | generic moderation only; not a business title |
| thread moderation `member` | generic participation only; not an assignment or audience decision |
| thread moderation `owner` in groups | moderation authority only; not a synonym for KeepCozy property owner |

DM-specific rule:

- DM thread participation should remain `member` only in current runtime
- no KeepCozy business role should be projected into DM moderation semantics

## 4. Where A Translation Layer Is Required

An explicit translation layer is required in the following places.

### KeepCozy space role to current runtime space role

Future KeepCozy role semantics cannot be stored directly in the current
`SpaceRole` surface without loss.

Current translation draft already assumes:

- KeepCozy `owner` may map to runtime `owner`
- KeepCozy `operator` and `internal_staff` may map to runtime `admin`
- KeepCozy `resident`, `contractor`, `supplier`, and `inspector` may map to
  runtime `member`

Important rule:

- this is a compatibility translation, not an authorization truth table

### KeepCozy space role to thread participation role

Every future KeepCozy space role currently defaults to generic thread
participation `member` unless a later explicit moderation decision is made.

Reason:

- moderation authority must stay explicit and thread-local
- operational role alone must not silently grant moderation power

### KeepCozy business roles to current runtime copy/code

Later branches should translate role language as follows:

- product, policy, and object workflow docs should say `operator`,
  `contractor`, `supplier`, `resident`, and `internal_staff`
- current code that touches active runtime enums should continue to use
  `SpaceRole` and `GroupConversationMemberRole`

### Platform roles to space or thread visibility

`platform_admin` and `support_staff` require explicit audited policy and must
not be translated into ordinary space or thread roles by default.

## 5. Role Semantics That Must Never Be Conflated

These conflations should be treated as architectural errors.

- KeepCozy `operator` must never be treated as identical to runtime `admin`
- KeepCozy `internal_staff` must never be treated as identical to runtime
  `admin`
- KeepCozy `contractor`, `supplier`, and `inspector` must never be treated as
  equivalent to runtime `member`
- KeepCozy `owner` must never be treated as identical to thread moderation
  `owner`
- KeepCozy `resident` must never be collapsed into KeepCozy `owner`
- `platform_admin` and `support_staff` must never be treated as implicit space
  members
- DM `member` must never be used as a carrier for operational oversight or DM
  decrypt authority
- thread moderation authority must never be inferred from business role alone

## 6. Default Future Integration Contract

Later KeepCozy integration work should assume the following defaults unless a
reviewed branch intentionally changes them.

### Space role carries business meaning

- KeepCozy space role is the primary operational meaning layer
- it answers client-facing, internal, external, assignment-scoped, and
  oversight questions

### Runtime space role stays lossy

- current `SpaceRole = owner | admin | member` remains a compatibility surface
- it is not the final KeepCozy role vocabulary

### Thread moderation stays generic

- `owner | admin | member` remains the generic thread-local moderation and
  participation surface
- no business role should automatically grant thread moderation

### DM stays a separate trust mode

- DM thread participation remains `member` only
- KeepCozy operational visibility must not change DM moderation or decrypt
  assumptions

### Translation is required, not optional

- any branch that combines KeepCozy role meaning with current runtime enums
  should go through an explicit compatibility or policy layer
- direct field/value reuse should be treated as suspect unless the layer is
  clearly the same

## 7. Practical Naming Guidance

When later work asks “what role is this user?”, answer in this order:

1. what global platform role do they have
2. what KeepCozy space role do they have in this space
3. what current runtime `SpaceRole` compatibility value exists
4. what thread participation/moderation role do they have in this
   conversation

Practical rule:

- if a proposal jumps straight from KeepCozy business role to runtime
  `owner/admin/member`, it is probably skipping a required translation step

## 8. Remaining Ambiguities

The following questions remain open enough for later review:

- whether the current runtime `SpaceRole.owner` should remain the long-term
  compatibility target for KeepCozy `owner`, or whether a later schema redesign
  changes that relationship
- whether `operator` and `internal_staff` should keep sharing the same current
  runtime compatibility target before a richer role schema exists
- whether future admin/support exception flows need a separate documented role
  label beyond `platform_admin` and `support_staff`
- how future UI copy should distinguish thread moderation `owner` from
  KeepCozy property `owner` in admin/developer surfaces
