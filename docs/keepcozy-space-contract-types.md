# KeepCozy Space Contract Types

## Purpose

This document explains the shared TypeScript contract layer for future
KeepCozy space-aware messaging work.

The goal is to introduce a stable vocabulary for:

- role layering
- operational thread metadata
- future object references
- additive schema planning

without changing current production schema, runtime enums, RLS behavior, or
conversation/message contracts.

Primary source file:

- [types.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/spaces/types.ts)

Related documents:

- [keepcozy-space-model-spec.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-model-spec.md)
- [keepcozy-space-access-model.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-access-model.md)
- [keepcozy-space-thread-model.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-thread-model.md)
- [keepcozy-space-data-flow.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-data-flow.md)
- [keepcozy-space-access-mapping-prep.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-access-mapping-prep.md)
- [keepcozy-space-schema-companion-metadata.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-schema-companion-metadata.md)
- [keepcozy-space-timeline-foundation.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-timeline-foundation.md)
- [keepcozy-space-backend-thread-object-links.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-backend-thread-object-links.md)
- [keepcozy-space-foundation-implementation-plan.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-foundation-implementation-plan.md)
- [keepcozy-role-layering.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-role-layering.md)

## What This Contract Layer Introduces

The shared types file now defines future-facing contracts for:

- global platform roles
- KeepCozy space roles
- thread participation and moderation roles
- role-layer compatibility notes and draft translation shapes
- access-mapping interpretation notes and draft visibility outcomes
- operational thread types
- audience modes
- operational object kinds and stable object refs
- a future companion metadata row shape
- a future space timeline event vocabulary and row shape
- a draft table name and draft field candidates for the first schema pass

Main exported names:

- `KeepCozyGlobalPlatformRole`
- `KeepCozySpaceRole`
- `KeepCozyThreadParticipationRole`
- `KeepCozyCurrentRuntimeDmThreadParticipationRole`
- `KeepCozyResolvedRoleLayers`
- `KeepCozyRoleLayerTranslationDraft`
- `KeepCozyAccessMappingInterpretationNote`
- `KeepCozyThreadAccessMappingContextDraft`
- `KeepCozyThreadAccessInterpretationOutcomeDraft`
- `KeepCozyThreadAccessInterpretationDraft`
- `KeepCozySpaceTimelineEventVisibilityBasisDraft`
- `KeepCozySpaceTimelineEventAccessInterpretationDraft`
- `KEEP_COZY_GLOBAL_PLATFORM_ROLES`
- `KEEP_COZY_SPACE_ROLES`
- `KeepCozyThreadType`
- `KeepCozyThreadAudienceMode`
- `KeepCozyThreadStatus`
- `KeepCozyOperationalObjectKind`
- `KeepCozyOperationalObjectRef`
- `KeepCozyThreadRelatedOperationalObjectLinkDraft`
- `KeepCozyThreadCompanionMetadataRowDraft`
- `KeepCozyThreadCompanionMetadata`
- `KeepCozySpaceTimelineEventType`
- `KeepCozySpaceTimelineEventSourceKind`
- `KeepCozySpaceTimelineEventSummaryPayloadDraft`
- `KeepCozySpaceTimelineEventRowDraft`
- `KeepCozySpaceTimelineEvent`
- `KEEP_COZY_THREAD_TYPES`
- `KEEP_COZY_THREAD_AUDIENCE_MODES`
- `KEEP_COZY_THREAD_STATUSES`
- `KEEP_COZY_OPERATIONAL_OBJECT_KINDS`
- `KEEP_COZY_THREAD_COMPANION_METADATA_TABLE_NAME_DRAFT`
- `KEEP_COZY_THREAD_COMPANION_METADATA_FIELD_CANDIDATES_DRAFT`
- `KEEP_COZY_THREAD_COMPANION_METADATA_DEFAULTS_DRAFT`
- `KEEP_COZY_ACCESS_MAPPING_INTERPRETATION_NOTES`
- `KEEP_COZY_THREAD_ACCESS_INTERPRETATION_OUTCOMES_DRAFT`
- `KEEP_COZY_SPACE_TIMELINE_EVENT_VISIBILITY_BASES_DRAFT`
- `KEEP_COZY_ACCESS_MAPPING_GUARDRAILS`
- `KEEP_COZY_SPACE_TIMELINE_EVENTS_TABLE_NAME_DRAFT`
- `KEEP_COZY_SPACE_TIMELINE_EVENT_TYPES`
- `KEEP_COZY_SPACE_TIMELINE_DEFERRED_EVENT_TYPES_DRAFT`
- `KEEP_COZY_SPACE_TIMELINE_EVENT_SOURCE_KINDS`
- `KEEP_COZY_SPACE_TIMELINE_EVENT_FIELD_CANDIDATES_DRAFT`

## What Is Future-Facing Only

These contracts are intentionally ahead of the active runtime.

They describe vocabulary for a later companion metadata and policy layer,
including:

- `thread_type`
- `audience_mode`
- operational workflow `status`
- `operational_object_type`
- `operational_object_id`
- policy-oriented visibility flags
- structured space timeline event categories and sources
- KeepCozy-specific operational roles such as `operator` and `contractor`

They do not mean:

- the current database already stores these fields
- the current runtime already reads or writes them
- current membership enums should expand yet
- `public.conversations.kind` should change from `dm | group`

The exported readonly value lists exist for the same reason: they help future
schema, backend, and UI branches reuse one vocabulary without implying that the
active database already stores every value.

## Current Runtime Models Intentionally Not Mutated

The contract layer is additive and intentionally leaves current active models
alone:

- [model.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/spaces/model.ts)
  still defines `SpaceRole = 'owner' | 'admin' | 'member'`
- [group-policy.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/group-policy.ts)
  still defines `GroupConversationMemberRole = 'owner' | 'admin' | 'member'`
- `public.conversations.kind` still means only `dm` or `group`
- [message-shell.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/data/message-shell.ts)
  still uses current message-shell semantics
- [message-metadata.ts](/Users/danya/IOS%20-%20Apps/CHAT/src/modules/messaging/media/message-metadata.ts)
  still uses current chat/media semantics

This contract layer exists beside those models rather than replacing them.

It also intentionally does not update the active-runtime scope of:

- [schema-assumptions.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/schema-assumptions.md)
- [schema-requirements.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/schema-requirements.md)

Those files should continue to describe only what current runtime actively
depends on. The future companion metadata layer becomes part of that active
schema picture only after later read/write integration work lands.

## Role Layering Contracts

The role contracts keep three layers explicit:

1. global platform role
2. KeepCozy space role
3. thread participation and moderation role

Important boundary:

- operational roles still must not be written directly into current
  conversation moderation fields
- current DM runtime still intentionally avoids owner/admin moderation
  semantics

The draft role-translation types are intentionally lossy and advisory. They
exist to reduce future confusion, not to implement authorization behavior yet.

## Access Mapping Prep Contracts

The shared contract layer now also includes a narrow preparation vocabulary for
later policy and RLS work:

- `KeepCozyAccessMappingInterpretationNote`
- `KeepCozyThreadAccessMappingContextDraft`
- `KeepCozyThreadAccessInterpretationOutcomeDraft`
- `KeepCozyThreadAccessInterpretationDraft`
- `KeepCozySpaceTimelineEventVisibilityBasisDraft`
- `KeepCozySpaceTimelineEventAccessInterpretationDraft`

These contracts are meant to answer questions like:

- what policy inputs should later backend helpers consider
- which thread-audience cases require explicit assignment-aware interpretation
- how operator visibility should stay separate from thread moderation
- how timeline visibility should inherit from parent thread/object/space
  boundaries

Important boundaries:

- these types are advisory and future-facing only
- they must not be mistaken for active authorization behavior
- they do not widen current `dm/group` runtime semantics
- they do not make companion metadata or timeline rows self-authorizing

## Operational Thread and Object Contracts

The metadata and object contracts are shaped around the KeepCozy docs:

- `KeepCozyThreadType`
- `KeepCozyThreadAudienceMode`
- `KeepCozyThreadStatus`
- `KeepCozyOperationalObjectKind`
- `KeepCozyOperationalObjectRef`
- `KeepCozyThreadCompanionMetadataRowDraft`
- `KeepCozyThreadCompanionMetadata`

Important boundaries:

- thread type is not the same thing as `public.conversations.kind`
- object kind is not the same thing as thread type
- one thread may have no linked object at first
- the first schema pass stores only the single primary object ref on the
  companion metadata row
- related or secondary object links are deferred

Why this is the current preference:

- it keeps the first table 1:1 by `conversation_id`
- it avoids introducing a second new link table before read/write paths exist
- it keeps backfill and later policy work simpler
- it matches the current architecture guidance that one thread usually centers
  on one primary operational record

## Space Timeline Event Contracts

The shared contract layer now also defines the first structured timeline-event
vocabulary for future KeepCozy operational history:

- `KeepCozySpaceTimelineEventType`
- `KeepCozySpaceTimelineEventSourceKind`
- `KeepCozySpaceTimelineEventRowDraft`
- `KeepCozySpaceTimelineEvent`

Important boundaries:

- timeline events are not user-authored `public.messages`
- timeline events may correlate to a `message_id`, but they do not replace the
  message model
- timeline events may point to a primary operational object ref, but they do
  not replace first-class operational object tables
- the first committed timeline pass focuses on stable operational/system state
  transitions, not on mirroring every chat event into a space feed

First-pass committed event vocabulary:

- `thread_created`
- `thread_metadata_attached`
- `primary_object_linked`
- `status_changed`
- `thread_closed`
- `thread_reopened`

Deferred event vocabulary draft:

- `KEEP_COZY_SPACE_TIMELINE_DEFERRED_EVENT_TYPES_DRAFT`

Those deferred categories intentionally stay out of the first committed pass
until later branches define the related assignment, document/media, or
first-class object flows well enough to avoid noisy or ambiguous history.

The event contracts are designed to support:

- append-oriented operational history
- later audit and automation work
- future thread-local system-event rendering without changing
  `messages.kind`

## First Schema Alignment On These Branches

The current contract layer now aligns with two additive schema directions:

- `public.conversation_companion_metadata`
- `public.space_timeline_events`

### Companion metadata alignment

The corresponding contract constants are:

- `KEEP_COZY_THREAD_COMPANION_METADATA_TABLE_NAME_DRAFT`
- `KEEP_COZY_THREAD_COMPANION_METADATA_FIELD_CANDIDATES_DRAFT`
- `KEEP_COZY_THREAD_TYPES`
- `KEEP_COZY_THREAD_AUDIENCE_MODES`
- `KEEP_COZY_THREAD_STATUSES`
- `KEEP_COZY_OPERATIONAL_OBJECT_KINDS`

The companion-metadata field candidates are:

- `conversation_id`
- `space_id`
- `thread_type`
- `audience_mode`
- `status`
- `operational_object_type`
- `operational_object_id`
- `thread_owner_user_id`
- `operator_visible_by_policy`
- `external_access_requires_assignment`
- `opened_at`
- `closed_at`
- `visibility_scope_notes`
- `created_at`
- `updated_at`

### Space timeline alignment

The corresponding contract constants are:

- `KEEP_COZY_SPACE_TIMELINE_EVENTS_TABLE_NAME_DRAFT`
- `KEEP_COZY_SPACE_TIMELINE_EVENT_TYPES`
- `KEEP_COZY_SPACE_TIMELINE_DEFERRED_EVENT_TYPES_DRAFT`
- `KEEP_COZY_SPACE_TIMELINE_EVENT_SOURCE_KINDS`
- `KEEP_COZY_SPACE_TIMELINE_EVENT_FIELD_CANDIDATES_DRAFT`

The first committed space-timeline field candidates are:

- `id`
- `space_id`
- `conversation_id`
- `message_id`
- `operational_object_type`
- `operational_object_id`
- `actor_user_id`
- `event_type`
- `source_kind`
- `occurred_at`
- `summary_payload`
- `created_at`

Timeline-alignment note:

- the first committed event set is intentionally narrower than the full
  long-term event vocabulary the product may eventually need
- the deferred event constant exists so later branches can see what has been
  intentionally held back from automatic emission

Important scope note:

- this first draft covers only the primary object ref fields on the companion
  metadata row
- related-object link tables remain deferred
- the existence of `KeepCozyThreadRelatedOperationalObjectLinkDraft` is
  intentional scaffolding, not proof that the first physical schema pass should
  store secondary links yet

Type alignment note:

- `KeepCozyThreadCompanionMetadata` is the logical future-facing contract shape
- `KeepCozyThreadCompanionMetadataRowDraft` mirrors the first SQL pass more
  directly, including snake_case column names and nullable object-ref columns
- `KEEP_COZY_THREAD_COMPANION_METADATA_DEFAULTS_DRAFT` mirrors the first SQL
  defaults for `status`, `operator_visible_by_policy`, and
  `external_access_requires_assignment`

## How This Relates To The KeepCozy Docs

The contract layer directly supports the polished architecture set:

- [keepcozy-space-thread-model.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-thread-model.md)
  defines `thread_type`, `audience_mode`, lifecycle, and operator-side
  ownership expectations
- [keepcozy-space-data-flow.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-data-flow.md)
  defines object linkage, additive metadata, and space-scoped querying needs
- [keepcozy-space-timeline-foundation.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-timeline-foundation.md)
  defines the first structured event layer for future space-wide operational
  history
- [keepcozy-role-layering.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-role-layering.md)
  defines the separation between operational roles and moderation roles
- [keepcozy-space-foundation-implementation-plan.md](/Users/danya/IOS%20-%20Apps/CHAT/docs/keepcozy-space-foundation-implementation-plan.md)
  defines companion metadata and schema work as the next additive phase

## Guardrails

These contracts should be used with the following explicit constraints:

- do not overload `public.conversations.kind` beyond `dm` and `group`
- do not expand `space_members.role` in this phase
- do not expand `conversation_members.role` with operational job-function
  roles in this phase
- do not infer thread moderation from KeepCozy business role by default
- do not treat runtime `admin` as identical to `operator`
- do not treat runtime `member` as enough to distinguish resident vs
  contractor vs supplier vs inspector
- do not treat operational thread visibility as equivalent to DM decryption
  authority
- do not treat the draft table name or field list as proof that schema/RLS
  work is fully complete
- do not turn the timeline-event vocabulary into a second message-kind system
- do not mirror all chat transport events into the timeline by default

## Intended Next Use

The intended immediate follow-on is:

1. additive SQL for `public.conversation_companion_metadata`
2. additive SQL for `public.space_timeline_events`
3. later backend helper boundaries for reading and validating companion rows
4. later event-writing and policy/RLS work after the policy matrix is ready

This file is meant to give those next steps one shared, reviewable language.
