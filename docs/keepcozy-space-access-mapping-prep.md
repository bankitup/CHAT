# KeepCozy Space Access Mapping Prep

## Purpose

This document defines the first preparation layer for future KeepCozy access
mapping across operational threads and timeline history.

The goal is to make later policy and RLS work less ad hoc by naming:

- which inputs matter
- what order they should be interpreted in
- which visibility hints are only future-facing policy inputs
- which current runtime boundaries must remain stable

This is a preparation branch, not a final authorization branch.

Related documents:

- [keepcozy-role-layering.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-role-layering.md)
- [keepcozy-space-access-model.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-access-model.md)
- [keepcozy-space-contract-types.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-contract-types.md)
- [keepcozy-space-schema-companion-metadata.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-schema-companion-metadata.md)
- [keepcozy-space-backend-thread-object-links.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-backend-thread-object-links.md)
- [keepcozy-space-timeline-foundation.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-timeline-foundation.md)
- [keepcozy-space-timeline-runtime-boundaries.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-timeline-runtime-boundaries.md)
- [keepcozy-space-foundation-implementation-plan.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-foundation-implementation-plan.md)
- [types.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/spaces/types.ts)
- [server.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/spaces/server.ts)
- [server.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/data/server.ts)
- [visibility.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/data/visibility.ts)

## What This Branch Prepares

This branch is intended to prepare later access work around:

- global platform role
- KeepCozy space role
- thread participation and moderation role
- `audience_mode`
- `operator_visible_by_policy`
- `external_access_requires_assignment`
- timeline event visibility

It does not implement final authorization behavior.

## Current Runtime Inputs vs Future Policy Inputs

The current repository already exposes some useful access signals, but they do
not yet form a full KeepCozy policy model.

| Input | Current source | Meaning now | Future access-mapping role |
| --- | --- | --- | --- |
| Global platform role | mostly implicit | platform identity only | outer non-bypassing policy context |
| Space membership | `public.space_members` via [server.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/spaces/server.ts) | outer space allowlist | remains the outer boundary |
| Runtime space role | `owner \| admin \| member` | generic space participation | lossy compatibility surface only |
| Conversation membership | `public.conversation_members` | active runtime thread allowlist | still important until later policy layers exist |
| Runtime thread role | `owner \| admin \| member` or DM `member` | generic moderation/member semantics | must stay separate from business-role meaning |
| `join_policy` | `public.conversations.join_policy` | generic group self-join behavior | not a replacement for audience policy |
| `hidden_at` | `public.conversation_members.hidden_at` and [visibility.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/data/visibility.ts) | per-user archive/hide | must stay separate from audience or lifecycle |
| `audience_mode` | companion metadata draft | no active enforcement yet | future audience-policy input |
| `operator_visible_by_policy` | companion metadata draft | no active enforcement yet | future operator oversight input |
| `external_access_requires_assignment` | companion metadata draft | no active enforcement yet | future external-scope input |
| Timeline row linkage | `space_timeline_events` draft | additive history only | later visibility should inherit from parent resource |

## Ordered Interpretation Model

Later policy work should answer access questions in this order:

1. What global platform role does the user have?
2. Is the user explicitly inside the parent `space` boundary?
3. What KeepCozy space role should the user be treated as having in that
   space?
4. What current runtime thread membership or moderation role exists?
5. What future audience metadata exists on the companion row?
6. Does the thread require assignment-scoped external access?
7. Does operator visibility apply by policy?
8. If this is a timeline row, which parent thread/object/space resource should
   its visibility inherit from?

Important rule:

- no later helper should skip directly to `audience_mode` or timeline-row data
  and ignore the outer space boundary

## What Each Layer Should Mean

### Global platform role

This layer is context only.

It may matter later for:

- audited support access flows
- platform operations
- future organization-level tooling

It must not:

- bypass explicit space membership by default
- become a shortcut for thread visibility

### KeepCozy space role

This is the main operational meaning layer.

It should later answer:

- whether the person is internal or external to the operating team
- whether they are client-facing or operator-facing
- whether assignment scoping should apply
- whether internal-only visibility is even potentially relevant

### Thread participation and moderation role

This remains the generic conversation-level role layer.

It should continue answering:

- who is a member of this thread
- who may moderate or manage it

It should not answer:

- whether the person is a contractor or supplier
- whether they can see internal-only threads across the space
- whether timeline history should be visible outside one assigned scope

## Draft Audience Interpretation

The future companion metadata layer should be interpreted as policy input, not
as current runtime truth.

| `audience_mode` | Intended meaning later | Safe prep guidance now |
| --- | --- | --- |
| `standard` | ordinary operational thread inside the space | treat as normal operational scope; do not assume space-wide browse for external roles |
| `external-facing` | intended to include customer/client/external collaboration | still require explicit membership or future assignment rules; do not widen by metadata alone |
| `restricted-external` | external participation is allowed only within a narrower scope | later helpers should require explicit assignment-aware interpretation |
| `internal-only` | internal operator-side work only | later helpers should default to operator/internal-staff visibility only |
| `mixed` | blended internal/external workflow with explicit scoping rules | later helpers should defer to explicit policy, not broad defaults |

Important rule:

- `audience_mode` should guide later policy interpretation
- it must not silently rewrite current `dm/group` membership semantics on this
  branch

## Operator Visibility by Policy

`operator_visible_by_policy` should be treated as a future policy signal, not
as current thread-admin truth.

Recommended interpretation:

- if true, later operational-thread policy may grant operator oversight even
  when the operator is not the creator of the thread
- this does not imply current runtime moderation authority
- this does not imply DM plaintext or decrypt authority
- this does not require materializing conversation membership in this branch

Practical rule:

- operator visibility is later policy interpretation, not a shortcut for
  reusing `conversation_members.role`

## Assignment-Scoped External Access

`external_access_requires_assignment` exists to support future external
participant scoping.

Recommended interpretation:

- when true, external roles such as `contractor`, `supplier`, and `inspector`
  should later require explicit assignment-aware access
- space membership alone should not be enough
- current runtime thread membership is still relevant, but it does not encode
  assignment reason or scope yet

Important rule:

- this flag does not create assignment truth by itself
- later schema and backend branches still need a real assignment model

## First Practical Interpretation Matrix

The matrix below is not final enforcement.

It is the first practical reference point for later backend and RLS work when
interpreting thread visibility around space role, audience metadata, operator
visibility, and assignment scoping.

Recommended reading rule:

- start with space membership and current runtime thread membership
- then interpret the companion metadata hints
- if the case cannot be answered safely from those layers, defer it to the
  later policy matrix instead of inventing local behavior

### Thread visibility matrix

| Case | Role(s) in question | First-pass interpretation guidance | Draft outcome alignment | What remains deferred |
| --- | --- | --- | --- | --- |
| `internal-only` thread | `operator`, `internal_staff` | treat as later visible by policy inside the space if the parent space boundary is satisfied; do not require current thread-admin semantics to represent this | `allow_internal_only` | whether visibility is implemented by materialized membership, policy join, or another backend path |
| `internal-only` thread | `owner`, `resident`, `contractor`, `supplier`, `inspector` | treat as not visible by default even if they are client-facing or temporary participants elsewhere in the space | `deny_by_default` | whether rare product exceptions ever exist |
| `restricted-external` thread with `external_access_requires_assignment = true` | `contractor`, `supplier`, `inspector` | treat as requiring explicit assignment-aware visibility; current runtime membership may still matter, but space membership alone is not enough | `require_explicit_external_assignment` | what the real assignment record looks like and whether membership is materialized or derived |
| `restricted-external` thread with `external_access_requires_assignment = true` | `operator`, `internal_staff` | treat as still potentially visible because they are internal roles, but do not derive final scope from thread moderation fields alone | `defer_to_future_policy` or `allow_operator_visibility` depending on final policy | whether `internal_staff` matches full operator oversight or narrower delegated visibility |
| `standard` or `external-facing` thread | `owner`, `resident` | treat as potentially visible when the thread is meant to be client-facing and the user is inside the intended space boundary; do not turn this into automatic browse-all behavior | `defer_to_future_policy` | whether later policy uses audience plus membership, audience plus object linkage, or another client-facing rule |
| `standard` or `external-facing` thread | `operator` | treat as later visible by policy for normal operational oversight when the thread belongs to the operator-managed space | `allow_operator_visibility` | whether oversight requires explicit membership materialization |
| `standard` or `external-facing` thread | `contractor`, `supplier`, `inspector` | do not assume visibility without assignment or explicit membership just because the audience is externally collaborative | `require_explicit_external_assignment` or `deny_by_default` | which external-facing thread types permit external browsing vs explicit assignment only |
| any audience mode with `operator_visible_by_policy = true` | `operator` | treat as a strong future signal for operator oversight inside the space, but not as thread-admin authority and not as DM plaintext authority | `allow_operator_visibility` | whether visibility is always-on, exception-based, or audited per thread/object type |
| any audience mode with `operator_visible_by_policy = true` | `internal_staff` | treat as a possible but narrower internal-visibility candidate; do not assume parity with `operator` unless later policy says so | `defer_to_future_policy` | whether `internal_staff` inherits full oversight or delegated slices only |
| any audience mode without companion metadata | any role | keep relying on the current runtime shell and membership boundaries; do not invent audience policy from absence | `allow_by_current_runtime_membership` or `deny_by_default` | how older conversations are upgraded into richer policy interpretation |

### Timeline visibility matrix

| Timeline case | First-pass interpretation guidance | Draft visibility basis |
| --- | --- | --- |
| timeline row linked to `conversation_id` | inherit from the parent thread audience and access policy; the timeline row must not widen visibility by itself | `conversation_audience` |
| timeline row linked only to an operational object | inherit from the object's future policy boundary | `operational_object_policy` |
| timeline row linked only to `space_id` state | use conservative space-role policy later; do not assume broad visibility for all space members | `space_policy` |
| exceptional support/admin review case | require explicit audited handling later, not implicit platform-role bypass | `manual_admin_review` |

Practical rule:

- if the parent thread or object should be hidden, the derived timeline row
  should also be hidden
- timeline visibility must never become easier to grant than the visibility of
  the resource that produced the event

## Timeline Event Visibility

Timeline rows should not become their own authorization authority.

Recommended future basis order:

1. If a timeline row is linked to a conversation, later filtering should
   inherit from the parent thread audience and access policy.
2. If a timeline row is linked only to an operational object, later filtering
   should inherit from the object policy boundary.
3. If a timeline row is linked only to space-level state, later filtering
   should use conservative space-role policy.

Important rules:

- a visible timeline row must not leak a thread or object the user should not
  see
- timeline visibility must remain separate from per-user archive state
- later timeline filtering belongs to policy-aware backend work, not this
  branch's helper scaffolding

## Timeline Visibility Preparation

The future space timeline should be understood as a visibility-dependent
projection, not a separate permission system.

That means later policy work should answer two distinct questions:

1. What happened in the space?
2. Which subset of those committed events may this viewer actually see?

The second question must not be answered by timeline rows alone.

### Recommended inheritance order

Later timeline visibility should inherit or derive from the strongest parent
resource available:

1. parent conversation policy when `conversation_id` is present
2. parent operational-object policy when only object linkage is present
3. conservative space-level policy only when no narrower parent exists

Important rule:

- a timeline row should never be easier to see than the thread or object that
  produced it

### Space-wide vs thread-scoped vs policy-filtered later

Recommended later interpretation:

- space-wide:
  rows linked only to durable space-level operational changes may later be
  visible to a broader in-space audience, but still not to all members by
  default
- thread-scoped:
  rows linked to a specific conversation should later inherit from that
  thread's audience and participation rules
- policy-filtered:
  rows linked to mixed, internal-only, restricted-external, or object-scoped
  work should later be filtered through the final policy matrix rather than
  shown just because the viewer is in the same space

### Why generic thread role is not enough

Generic runtime thread role is not sufficient to decide future timeline
visibility by itself because it does not encode:

- whether the thread is internal-only
- whether external access is assignment-scoped
- whether operator oversight should apply by policy
- whether the event really belongs to a parent object rather than a thread
- whether the viewer is seeing a space-level summary vs one thread lane

That is why later timeline filtering must combine:

- outer space boundary
- role-layer interpretation
- audience metadata
- assignment-aware external scope
- parent thread/object linkage

and must not rely only on `conversation_members.role`.

### What Must Wait for Final Policy/RLS Work

This branch intentionally does not decide:

- the exact SQL/RLS predicates for timeline-row visibility
- whether operator oversight is implemented by membership materialization or
  policy joins
- whether some space-level events are visible to all internal roles or only a
  narrower operational subset
- whether some owner/resident-facing event types should be hidden even when the
  parent thread is client-facing
- how support or compliance review is audited for exceptional visibility cases

Practical boundary:

- this branch explains how later policy should think about timeline visibility
- the final policy/RLS branch must still decide how those rules are enforced
- the current runtime must remain unchanged until that later branch lands

Matrix note:

- the interpretation matrix above is the intended first reference point for
  later thread and timeline visibility work
- it is deliberately narrower than a final policy matrix and must not be read
  as active runtime enforcement

## Safe Backend Boundaries for Later Work

This branch should prepare interpretation seams without turning them into final
enforcement.

Recommended future homes:

- outer space-membership context:
  [server.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/spaces/server.ts)
- access-checked conversation shell:
  [server.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/data/server.ts)
  `getConversationForUser(...)`
- companion metadata enrichment:
  [conversation-thread-context.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/data/conversation-thread-context.ts)
- timeline emission and later filtering boundaries:
  [keepcozy-space-timeline-runtime-boundaries.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-timeline-runtime-boundaries.md)

Not on this branch:

- final RLS predicates
- final timeline filtering behavior
- mutation of current message-history payloads
- direct policy enforcement inside low-level companion-metadata helpers
- any change to DM/group semantics

## Guardrails and Non-Goals

This branch is intentionally preparation work, not enforcement work.

### Guardrails

- do not treat this branch as final authorization enforcement
- do not overload current runtime role fields with business-role semantics
- do not treat `join_policy` as a future audience model
- do not treat `hidden_at` as a future audience or lifecycle model
- do not let global platform roles bypass explicit space membership
- do not let `operator_visible_by_policy` imply DM plaintext access
- do not let timeline rows bypass parent thread/object visibility
- do not let UI badges, hiding, or presentation conventions become backend
  policy truth

### Practical non-goals

This branch must not:

- collapse operational role semantics into current moderation roles such as
  `owner | admin | member`
- use companion metadata as the only source of access truth without the outer
  space boundary and current runtime membership context
- assume timeline visibility is always identical to thread visibility in every
  case
- change current `dm | group` production semantics in order to model later
  access behavior
- mix UI policy assumptions into backend preparation too early
- define final allow/deny behavior for backend paths or RLS predicates

### Interpretation safety rules

- companion metadata is future policy input, not self-authorizing truth
- generic thread role is still generic moderation/member state, not operational
  job meaning
- timeline rows may inherit from thread, object, or conservative space policy
  later, so the branch must not flatten all visibility into one shortcut rule
- if a later proposal cannot explain the outer space boundary, it is probably
  trying to skip too directly to metadata-driven policy

## Current State vs Target State

### Current state

- current runtime access is still mostly space membership plus conversation
  membership
- runtime role enums remain generic
- `audience_mode`, `operator_visible_by_policy`, and
  `external_access_requires_assignment` are draft metadata inputs, not active
  enforcement
- timeline rows are additive foundation only and not yet filtered by a final
  policy model

### Target direction after this prep branch

- later policy work has named inputs and ordered interpretation rules
- role-layer translation stays explicit
- audience-mode interpretation stays separate from current membership fields
- timeline visibility is clearly modeled as inherited from parent resources,
  not self-authorizing

## Minimal Type Scaffolding Added

The shared spaces contract layer now also includes future-facing access-mapping
prep types in [types.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/spaces/types.ts):

- `KeepCozyAccessMappingInterpretationNote`
- `KeepCozyThreadAccessMappingContextDraft`
- `KeepCozyThreadAccessInterpretationOutcomeDraft`
- `KeepCozyThreadAccessInterpretationDraft`
- `KeepCozySpaceTimelineEventVisibilityBasisDraft`
- `KeepCozySpaceTimelineEventAccessInterpretationDraft`
- `KEEP_COZY_ACCESS_MAPPING_GUARDRAILS`

These are intentionally advisory only.

They exist to give later backend and RLS work one shared vocabulary without
claiming that current runtime helpers already enforce the future policy model.
