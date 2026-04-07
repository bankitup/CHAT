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
- `KeepCozyThreadType`
- `KeepCozyThreadAudienceMode`
- `KeepCozyThreadStatus`
- `KeepCozyOperationalObjectKind`
- `KeepCozyOperationalObjectRef`
- `KeepCozyResolvedRoleLayers`
- `KeepCozyRoleLayerTranslation`
- `KeepCozyThreadCompanionMetadata`

## What Is Future-Facing Only

These contracts are intentionally ahead of the active runtime.

They describe the vocabulary for a later companion metadata and policy layer,
including:

- `thread_type`
- `audience_mode`
- thread workflow `status`
- `operational_object_type`
- `operational_object_id`
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
- `KeepCozyThreadCompanionMetadata`

### Data flow and implementation plan

[keepcozy-space-data-flow.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-data-flow.md)
and [keepcozy-space-foundation-implementation-plan.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-foundation-implementation-plan.md)
both call for additive thread metadata, operational object linkage, and a
future compatibility layer. These contracts are the low-risk phase-one
foundation for that work.

## Guardrails

These types should be used with the following explicit constraints:

- do not overload `public.conversations.kind` beyond `dm` and `group`
- do not expand `space_members.role` in this phase
- do not expand `conversation_members.role` with operational job-function roles
  in this phase
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
