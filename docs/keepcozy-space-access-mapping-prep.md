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

Keep these guardrails explicit:

- do not overload current runtime role fields with business-role semantics
- do not treat `join_policy` as a future audience model
- do not treat `hidden_at` as a future audience or lifecycle model
- do not let global platform roles bypass explicit space membership
- do not let `operator_visible_by_policy` imply DM plaintext access
- do not let timeline rows bypass parent thread/object visibility
- do not implement final authorization behavior in this branch

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
