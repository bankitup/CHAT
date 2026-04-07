# KeepCozy Space Contract Types

## Purpose

This document explains the first low-risk TypeScript contract layer added for
future KeepCozy space-aware messaging work.

The goal is to introduce a shared vocabulary for operational thread metadata
and role layering without changing current production schema, runtime enums,
RLS behavior, or conversation/message contracts.

Primary source file:

- [types.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/spaces/types.ts)

Related documents:

- [keepcozy-space-model-spec.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-model-spec.md)
- [keepcozy-space-access-model.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-access-model.md)
- [keepcozy-space-thread-model.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-thread-model.md)
- [keepcozy-space-data-flow.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-data-flow.md)
- [keepcozy-space-foundation-implementation-plan.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-foundation-implementation-plan.md)
- [keepcozy-role-layering.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-role-layering.md)

## What Was Introduced

The new shared contract file adds future-facing types for:

- global platform roles
- KeepCozy space roles
- thread participation and moderation roles
- operational thread types
- thread audience modes
- operational object kinds and refs
- placeholder role-layer translation contracts
- companion metadata for future operational thread fields

The main exported names are:

- `KeepCozyGlobalPlatformRole`
- `KeepCozySpaceRole`
- `KeepCozyThreadParticipationRole`
- `KeepCozyCurrentRuntimeDmThreadParticipationRole`
- `KeepCozyThreadType`
- `KeepCozyThreadAudienceMode`
- `KeepCozyThreadStatus`
- `KeepCozyOperationalObjectKind`
- `KeepCozyOperationalObjectRef`
- `KeepCozyThreadOperationalObjectLink`
- `KeepCozyResolvedRoleLayers`
- `KeepCozyRoleLayerCompatibilityNote`
- `KeepCozyRoleLayerTranslation`
- `KeepCozyThreadCompanionMetadata`
- `KEEP_COZY_CURRENT_RUNTIME_SPACE_ROLE_SURFACE`
- `KEEP_COZY_CURRENT_RUNTIME_GROUP_THREAD_ROLE_SURFACE`
- `KEEP_COZY_CURRENT_RUNTIME_DM_THREAD_ROLE_SURFACE`
- `KEEP_COZY_RUNTIME_SPACE_ROLE_TO_CANDIDATE_SPACE_ROLES`
- `KEEP_COZY_ROLE_LAYER_TRANSLATION_DRAFT`
- `KEEP_COZY_ROLE_LAYER_GUARDRAILS`
- `KEEP_COZY_THREAD_TYPE_TO_OPERATIONAL_OBJECT_KINDS_DRAFT`

## What Is Future-Facing Only

These contracts are intentionally ahead of the active runtime.

They describe the vocabulary for a later companion metadata and policy layer,
including:

- `thread_type`
- `audience_mode`
- thread workflow `status`
- `operational_object_type`
- `operational_object_id`
- thread-to-object linkage hints
- KeepCozy-specific operational role meanings such as `operator` and
  `contractor`

They do not mean the current database already stores those fields, and they do
not mean the current runtime should begin writing those values into existing
conversation or membership tables.

## Current Runtime Mapping

The current runtime contracts remain unchanged:

- [model.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/spaces/model.ts)
  still defines `SpaceRole = 'owner' | 'admin' | 'member'`
- [group-policy.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/group-policy.ts)
  still defines `GroupConversationMemberRole = 'owner' | 'admin' | 'member'`
- `public.conversations.kind` still represents only `dm` and `group`
- message shell and media contracts still use the active chat-first runtime
  vocabulary

The new types deliberately sit beside those models rather than mutating them.

## Current Runtime Role Surface

The contract file now makes the current role surface explicit:

- space runtime roles: `owner | admin | member`
- group-thread moderation roles: `owner | admin | member`
- DM-thread participation role: `member` only

The DM rule is important.

It reflects the current architecture choice that DM flows intentionally avoid
owner/admin moderation semantics, and that operational oversight must not be
confused with DM decrypt or moderation authority.

## Future KeepCozy Role Surface

The future-facing surface remains the one defined by the KeepCozy architecture
docs:

- global platform roles such as `authenticated_user`, `platform_admin`, and
  `support_staff`
- space roles such as `owner`, `resident`, `operator`, `internal_staff`,
  `contractor`, `supplier`, and `inspector`
- generic thread participation and moderation roles that remain thread-local
  and intentionally narrower than business-role meaning

## Future Operational Object Reference Surface

The object-link contract is intentionally small and future-facing.

The current draft object kinds are:

- `service_request`
- `work_order`
- `inspection`
- `procurement_request`
- `issue_case`
- `vendor_assignment`
- `quality_review`
- `space_document`

Two design rules matter here:

1. these are reference kinds, not proof that those tables already exist
2. object kinds are not the same thing as thread types

Examples:

- a `job_coordination` thread may later point at a `work_order`
- a `supplier_order` thread may later point at a `procurement_request`
- a thread may also point at a `vendor_assignment` record without changing its
  main thread type

The new contracts keep that distinction explicit through:

- `KeepCozyOperationalObjectRef`
- `KeepCozyThreadOperationalObjectLink`
- `KEEP_COZY_THREAD_TYPE_TO_OPERATIONAL_OBJECT_KINDS_DRAFT`

## Draft Translation Layer

The new compatibility draft is intentionally small and explicit.

It now provides:

- current runtime role-surface constants
- a reverse candidate map from current generic runtime `SpaceRole` values to
  possible future `KeepCozySpaceRole` values
- a forward draft translation from `KeepCozySpaceRole` to:
  - a compatible current runtime `SpaceRole`
  - a safe default thread participation role
  - allowed audience modes
  - explicit compatibility notes
- a guardrail constant set and tiny lookup helpers

Most importantly, the forward draft translation is intentionally lossy.

Examples:

- `operator` currently maps to runtime `admin` only as a temporary
  compatibility shape, not as a claim that the two roles are equivalent
- `contractor`, `supplier`, and `inspector` all currently collapse to runtime
  `member`, because current runtime space roles do not yet encode assignment
  scope
- all future KeepCozy space roles default to thread participation role
  `member`, because moderation should be granted explicitly per thread rather
  than inferred from business role

## Explicit Non-Equivalence Notes

The translation draft now encodes the following facts directly:

- current runtime space roles are lower-fidelity than future KeepCozy space
  roles
- current thread moderation roles are not operational job-function roles
- current runtime does not encode assignment scope for external participants
- operator visibility is not the same thing as DM decrypt authority
- DM threads intentionally avoid owner/admin moderation semantics

These are compatibility notes, not policy outcomes.

They are meant to prevent later code from silently treating one layer as a
drop-in substitute for another.

## How These Contracts Map to the Architecture Docs

### Space model

[keepcozy-space-model-spec.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-model-spec.md)
locks the rule that `space` is the operational container and that richer
thread meaning should live in a companion metadata layer. The new thread and
object-reference types give that companion layer one shared vocabulary.

### Access model and role layering

[keepcozy-space-access-model.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-access-model.md)
and [keepcozy-role-layering.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-role-layering.md)
separate:

- global platform role
- space role
- thread participation and moderation role

The new role types and placeholder translation types encode that separation
without forcing current runtime enums to expand yet.

### Thread model

[keepcozy-space-thread-model.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-thread-model.md)
defines the target metadata vocabulary for operational threads. The new
contracts mirror that vocabulary directly:

- `KeepCozyThreadType`
- `KeepCozyThreadAudienceMode`
- `KeepCozyThreadStatus`
- `KeepCozyOperationalObjectRef`
- `KeepCozyThreadOperationalObjectLink`
- `KeepCozyThreadCompanionMetadata`

### Data flow and implementation plan

[keepcozy-space-data-flow.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-data-flow.md)
and [keepcozy-space-foundation-implementation-plan.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-foundation-implementation-plan.md)
both call for additive thread metadata, operational object linkage, and a
future compatibility layer. These contracts are the low-risk phase-one
foundation for that work.

The object-linking draft is intentionally narrow:

- one stable object ref shape
- one optional thread-link metadata shape
- one advisory mapping from thread type to likely object kinds

That keeps future schema work open while still giving backend and UI scaffolds
one shared language.

## Guardrails

These types should be used with the following explicit constraints:

- do not overload `public.conversations.kind` beyond `dm` and `group`
- do not expand `space_members.role` in this phase
- do not expand `conversation_members.role` with operational job-function roles
  in this phase
- do not assume every thread must point at an operational object
- do not assume one thread type maps to exactly one object kind
- do not treat the current object-kind union as a frozen database naming
  decision
- do not infer thread moderation from KeepCozy business role by default
- do not treat runtime `admin` as identical to `operator`
- do not treat runtime `member` as sufficient to distinguish resident vs
  contractor vs supplier vs inspector
- do not treat placeholder translation types as proof that policy or schema
  work is finished
- do not treat operational thread visibility as equivalent to DM decryption
  authority

## Intended Next Use

The next safe uses for these contracts are:

1. additive schema planning for a thread companion metadata layer
2. backend helper boundaries for thread/object linkage
3. early policy-prep code that needs role-layer vocabulary
4. UI scaffolding that needs typed future thread metadata without changing
   active runtime behavior

This document and the new type file are meant to keep that next phase additive,
reviewable, and aligned with the existing KeepCozy architecture docs.
