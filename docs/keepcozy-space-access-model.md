# KeepCozy Space Access Model

## Purpose

This document defines the intended role and access model for KeepCozy spaces.

It is architecture-first and implementation-oriented. The goal is to provide a
clear draft that can later drive:

- schema changes
- policy matrix design
- RLS work
- invitation and assignment flows
- operational thread visibility rules

This document does not change current production authorization behavior.

Related documents:

- [space-governance-role-matrix.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/space-governance-role-matrix.md)
- [space-governance-foundation.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/space-governance-foundation.md)
- [keepcozy-space-model-spec.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-model-spec.md)
- [keepcozy-role-layering.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-role-layering.md)
- [keepcozy-space-thread-model.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-thread-model.md)
- [space-model.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/space-model.md)
- [schema-assumptions.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/schema-assumptions.md)
- [schema-requirements.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/schema-requirements.md)
- [security/e2ee-security-model.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/security/e2ee-security-model.md)

## Access Layers

KeepCozy access should be modeled in three layers:

1. Global account role
   platform-level or workforce-level identity outside any one space
2. Space role
   operational role inside one managed property/home/object
3. Thread participation and moderation role
   per-conversation role used for membership and moderation inside one thread

Design principle:

- global roles should stay minimal
- space roles should carry the real operational meaning
- thread participation and moderation roles should stay generic and subordinate
  to space access

Current-runtime note:

- [model.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/spaces/model.ts)
  currently supports only `SpaceRole = 'owner' | 'admin' | 'member'`
- [access.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/spaces/access.ts)
  now exposes the shared platform membership and governance contract that
  KeepCozy should consume before layering any KeepCozy-specific business-role
  interpretation
- [group-policy.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/group-policy.ts)
  currently supports only generic conversation moderation roles
- this document therefore describes the target access model, not active runtime
  authorization behavior

## Operational Trust Modes

KeepCozy needs a clear distinction between operational visibility and private
message confidentiality.

### Operational threads

Default KeepCozy operational threads should be:

- operator-visible by policy
- auditable
- suitable for internal-only and restricted-external visibility rules
- non-E2EE by default unless a later product requirement proves otherwise

### Private messaging

Private messaging may continue to exist in the broader platform, including
current DM E2EE work, but it should be treated as a different trust mode.

Important rule:

- operator oversight for operational threads does not imply DM plaintext access
- `space` access policy and DM decryption policy must stay separate

## 1. Global Roles vs Space Roles

### Global roles

Global roles exist outside a specific space. They should be rare and should not
grant automatic data visibility across spaces.

Recommended initial global roles:

| Global role | Purpose | Default space access |
| --- | --- | --- |
| `authenticated_user` | Base signed-in account | None until assigned to a space |
| `platform_admin` | Environment, compliance, or maintenance tooling | No implicit read into spaces |
| `support_staff` | Internal support or operational tooling | No implicit read into spaces |

Guidance:

- the system can operate initially without custom global roles beyond the base
  authenticated account
- if `platform_admin` or `support_staff` exists later, they should still require
  explicit audited policy to enter a space
- global role is not a substitute for `space_members`

### Space roles

Space roles define what a user may do inside one managed property/home/object.
This is the main operational access model.

Recommended initial space roles:

- `owner`
- `resident`
- `operator`
- `internal_staff`
- `contractor`
- `supplier`
- `inspector`

These roles should be stored or derived at the space boundary, not only inside
conversation membership.

Preferred evolution path:

- do not assume these roles should be written directly into current
  `conversation_members.role`
- prefer a later mapping layer from space role to thread audience and generic
  thread participation behavior

## 2. Recommended Initial Space Roles

| Space role | Kind | Default intent | Typical duration |
| --- | --- | --- | --- |
| `owner` | external or client-side primary stakeholder | Sees owner-facing operational activity and outcomes | long-lived |
| `resident` | occupant/end user | Uses the space for service issues and day-to-day coordination | long-lived |
| `operator` | primary manager of the space | Oversees operational communication and workflow execution | long-lived |
| `internal_staff` | operator-side staff | Handles internal coordination and assigned support work | long-lived or semi-persistent |
| `contractor` | external service participant | Executes assigned work only | temporary |
| `supplier` | external vendor participant | Handles quoted/procured/delivered goods and related coordination | temporary |
| `inspector` | external reviewer or assessor | Performs inspections, reports, and limited follow-up | temporary |

Implementation guidance:

- the first practical expansion should happen at the space-role level
- thread-level `owner/admin/member` should remain generic thread participation
  and moderation roles
- do not overload conversation role enums with job-function semantics like
  `contractor` or `supplier`

## 3. What Each Role Can See

Recommended default visibility model:

| Space role | Default visibility |
| --- | --- |
| `owner` | Owner-facing operational threads, owner-visible records, assigned documents, status summaries; not internal-only threads by default |
| `resident` | Resident-facing threads, own requests/issues, assigned records and documents; not internal-only threads |
| `operator` | All standard operational threads and records in the space, plus internal-only threads |
| `internal_staff` | Internal-only threads and assigned/internal operational records; broader than external roles, narrower than full operator oversight by default |
| `contractor` | Only explicitly assigned threads, tasks, work orders, and relevant media/documents |
| `supplier` | Only explicitly assigned procurement/logistics threads and related records |
| `inspector` | Only explicitly assigned inspection threads, records, and relevant documents |

Visibility rules:

- external roles must not browse the whole space by default
- owner/resident visibility is product-facing, not internal-operational by default
- operator/internal visibility should be intentional and policy-driven, not an
  ad hoc support bypass

## 4. What Each Role Can Create

Recommended creation model:

| Space role | Default create rights |
| --- | --- |
| `owner` | Owner-visible request threads, comments, files, and updates in allowed surfaces |
| `resident` | Resident-visible requests, replies, files, and issue updates in allowed surfaces |
| `operator` | Standard operational threads, internal-only threads, assignments, and operational records inside the space |
| `internal_staff` | Internal-only threads and assigned workflow updates inside delegated scope |
| `contractor` | Replies, files, and work updates inside assigned threads only; no broad thread creation by default |
| `supplier` | Replies, files, quote/order/delivery updates inside assigned threads only |
| `inspector` | Inspection findings, files, and follow-up updates inside assigned threads only |

Guidance:

- only `operator` should have broad space-wide thread creation by default
- external roles should create within assigned scope, not at the whole-space level
- `owner` and `resident` may create request-style threads, but not internal-only
  threads

## 5. What Each Role Can Modify

Recommended modification model:

| Space role | Default modify rights |
| --- | --- |
| `owner` | Own messages/files and limited owner-facing profile or request metadata |
| `resident` | Own messages/files and own request metadata inside allowed flows |
| `operator` | Space-facing thread setup, assignments, standard thread membership, and operational records |
| `internal_staff` | Assigned/internal workflow records and own thread content; no broad space administration by default |
| `contractor` | Own updates, files, and assignment-scoped execution metadata only |
| `supplier` | Own quote/logistics updates and attached files only |
| `inspector` | Own inspection findings, attachments, and assigned inspection metadata only |

Restricted by default:

- only `operator` should modify broad space configuration
- `internal_staff` should not automatically inherit full space-admin power
- external roles should not modify roster, visibility policy, or unrelated threads

## 6. Which Roles Are Permanent vs Temporary

Recommended lifecycle split:

| Role type | Roles | Notes |
| --- | --- | --- |
| Persistent | `owner`, `resident`, `operator` | Usually present for the life of the managed relationship |
| Semi-persistent | `internal_staff` | May remain attached while the operating organization serves the space |
| Temporary | `contractor`, `supplier`, `inspector` | Should be bounded by assignment, engagement, or review window |

Operational rules:

- temporary roles should always have a clear assignment reason
- temporary roles should be easy to revoke without losing audit history
- removing access should not require deleting message or object history

## 7. Invitation and Assignment Model

Recommended target model:

- space entry should require explicit membership or explicit invitation
- thread access for external roles should require explicit assignment
- invitation and assignment should be separate concepts

Recommended meanings:

- invitation
  grants entrance into the space with a proposed space role
- assignment
  grants access to specific threads or operational objects within the space

Recommended first-pass assignment rules:

- `operator` may invite and assign any non-global participant inside the space
- `owner` may invite or request access for owner/resident-facing participants
  only if product policy allows it
- `internal_staff` may assign within delegated scope, but not administer the
  full space by default
- `contractor`, `supplier`, and `inspector` may not invite others

Current-state note:

- the repository does not yet contain a dedicated invitation or assignment table
- current runtime is membership-based and conversation-based, not invitation-based

## 8. External Participant Restrictions

External roles here means:

- `contractor`
- `supplier`
- `inspector`

Recommended restrictions:

- no default space-wide conversation browsing
- no access to internal-only threads
- no access to unrelated participant rosters
- no member-management actions
- no thread creation outside assigned scope
- no cross-space visibility based on company affiliation alone

Recommended visibility baseline:

- external participants should see only the minimum threads, files, and records
  needed to perform their assigned work

## 9. Operator Visibility Rules

Recommended target rule:

- `operator` is the primary oversight role inside a space

That should mean:

- operator can list all standard operational threads in the space
- operator can view owner/resident/external coordination threads when those
  threads are part of normal operation
- operator can create and manage internal-only threads
- operator can assign and revoke external participant access

Important boundary:

- operator oversight is a space/thread policy concept
- it must not become a hidden support bypass for encrypted DM plaintext
- if some future thread type is intentionally private from operator oversight,
  that exception must be explicit in policy, not accidental
- operator visibility should be modeled as policy and audience scope, not by
  reusing conversation moderation fields as a proxy for operational role

## 10. Internal-Only Visibility Rules

Internal-only visibility should be a thread or object classification, not just a
social convention.

Recommended rule:

- internal-only threads are visible only to `operator` and `internal_staff` by
  default

Not visible by default:

- `owner`
- `resident`
- `contractor`
- `supplier`
- `inspector`

Implementation guidance:

- internal-only must be expressed as an explicit thread/object audience policy
- do not approximate internal-only by client-side hiding alone
- do not use per-member history hiding such as `visible_from_seq` as the main
  model for internal-only access

Current-state note:

- the current repository does not yet have a dedicated thread visibility class
  for `internal-only`
- current group policy only supports `join_policy = open | closed`

## 11. Access Boundary Guardrails

The following guardrails should remain true as schema and policy evolve.

- global role must not imply automatic space access
- space membership is the outer allowlist
- conversation membership must not exceed the parent space boundary
- thread participation/moderation role is not the same thing as operational job
  role
- external roles should default to least privilege
- internal-only access must be modeled explicitly
- operator visibility must be deliberate and auditable
- media/storage access must follow the same space/thread boundary as thread access
- owner/admin/operator concepts must not imply DM plaintext access in encrypted flows
- do not map `operator` or `internal_staff` directly to `conversation_members.role`
  without a formal compatibility layer

## 12. Open Questions for Future Policy Matrix

- Should `owner` see every contractor/supplier thread, or only owner-facing ones?
- Should `resident` and `owner` be separate roles everywhere, or can some spaces
  use only one client-facing role?
- Should `internal_staff` be a pure space role, or partly derived from a future
  organization/global-role model?
- Should operator oversight be implemented through direct thread visibility policy
  or automatic membership materialization?
- Which operational objects should be first-class earliest: tasks, work orders,
  inspections, vendor records, or documents?
- Should external roles ever create new top-level threads, or only respond within
  assigned threads?
- How should time-bounded access be enforced for temporary roles?
- Do we need a separate thread audience model such as `standard`,
  `restricted-external`, and `internal-only`?

## Current State vs Target State

### Current state in this repository

Current active primitives are simpler than the target KeepCozy model:

- `public.space_members.role` supports only `owner`, `admin`, `member`
- `public.conversation_members.role` supports only generic thread
  participation/moderation roles
- group membership rules are driven by `owner/admin/member`
- group invite behavior is driven by `public.conversations.join_policy`
- DMs are restricted to two active `member` participants
- there is no current assignment layer for contractor/supplier/inspector scope
- there is no explicit internal-only audience class in active schema

### Target state for KeepCozy

KeepCozy needs richer operational meaning at the space layer:

- space roles such as `resident`, `operator`, `contractor`, `supplier`,
  `inspector`, and `internal_staff`
- explicit internal-only visibility
- explicit assignment rules for external participants
- policy-driven operator oversight
- a clear separation between operational-thread visibility and private-message
  confidentiality

Recommended translation rule:

- keep thread roles generic
- expand the space role model
- add thread/object audience policy later where needed
- prefer a role-mapping layer before changing current core role enums

## Practical Guidance for Later Schema Work

When schema and policy work begins, prefer this order:

1. define the role-layering and mapping contract
2. define invitation and assignment records
3. add thread/object audience policy for internal-only and restricted-external use
4. align RLS with the same outer-space then inner-thread boundary

If a proposed rule cannot clearly answer both of these questions, it is not yet
well-modeled:

- what space role is the person in?
- what thread/object audience is this resource intended for?
