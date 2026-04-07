import type { GroupConversationMemberRole } from '@/modules/messaging/group-policy';
import type { SpaceRole } from './model';

/**
 * Draft table name for the future additive companion metadata layer.
 *
 * This is documentation and contract scaffolding only. It must not be treated
 * as proof that the table is already active in current runtime reads/writes.
 */
export const KEEP_COZY_THREAD_COMPANION_METADATA_TABLE_NAME_DRAFT =
  'conversation_companion_metadata';

/**
 * Future-facing global role vocabulary for KeepCozy-aware policy work.
 *
 * These roles sit above any one space and must not be treated as implicit
 * space membership.
 */
export type KeepCozyGlobalPlatformRole =
  | 'authenticated_user'
  | 'platform_admin'
  | 'support_staff';

export const KEEP_COZY_GLOBAL_PLATFORM_ROLES = [
  'authenticated_user',
  'platform_admin',
  'support_staff',
] as const satisfies readonly KeepCozyGlobalPlatformRole[];

/**
 * Future-facing operational role vocabulary for one KeepCozy space.
 *
 * This stays intentionally separate from the current runtime `SpaceRole`
 * surface in `public.space_members`.
 */
export type KeepCozySpaceRole =
  | 'owner'
  | 'resident'
  | 'operator'
  | 'internal_staff'
  | 'contractor'
  | 'supplier'
  | 'inspector';

export const KEEP_COZY_SPACE_ROLES = [
  'owner',
  'resident',
  'operator',
  'internal_staff',
  'contractor',
  'supplier',
  'inspector',
] as const satisfies readonly KeepCozySpaceRole[];

/**
 * Thread-local participation and moderation role.
 *
 * This intentionally reuses the current generic conversation role vocabulary
 * instead of projecting operational job-function semantics into thread
 * membership prematurely.
 */
export type KeepCozyThreadParticipationRole = GroupConversationMemberRole;

/**
 * Current DM runtime intentionally avoids `owner` and `admin` semantics.
 *
 * This keeps the DM exception explicit in future compatibility work.
 */
export type KeepCozyCurrentRuntimeDmThreadParticipationRole = 'member';

export const KEEP_COZY_CURRENT_RUNTIME_SPACE_ROLE_SURFACE: readonly SpaceRole[] =
  ['owner', 'admin', 'member'];

export const KEEP_COZY_CURRENT_RUNTIME_GROUP_THREAD_ROLE_SURFACE: readonly GroupConversationMemberRole[] =
  ['owner', 'admin', 'member'];

export const KEEP_COZY_CURRENT_RUNTIME_DM_THREAD_ROLE_SURFACE: readonly KeepCozyCurrentRuntimeDmThreadParticipationRole[] =
  ['member'];

export type KeepCozyRoleLayerCompatibilityNote =
  | 'runtime-space-role-is-lossy'
  | 'runtime-thread-role-is-not-an-operational-role'
  | 'thread-moderation-must-be-explicit'
  | 'assignment-scope-is-not-encoded-in-runtime-role'
  | 'dm-owner-admin-semantics-are-disabled'
  | 'operator-visibility-is-not-dm-decrypt-authority';

export type KeepCozyResolvedRoleLayers = {
  globalPlatformRole: KeepCozyGlobalPlatformRole;
  keepCozySpaceRole: KeepCozySpaceRole | null;
  threadParticipationRole: KeepCozyThreadParticipationRole | null;
  runtimeSpaceRole: SpaceRole | null;
  runtimeThreadParticipationRole: GroupConversationMemberRole | null;
};

/**
 * Draft forward compatibility shape from KeepCozy operational roles to current
 * runtime role surfaces.
 *
 * This mapping is intentionally lossy. It is scaffolding for future policy and
 * migration work, not active authorization logic.
 */
export type KeepCozyRoleLayerTranslationDraft = {
  spaceRole: KeepCozySpaceRole;
  runtimeSpaceRole: SpaceRole;
  defaultThreadParticipationRole: KeepCozyThreadParticipationRole;
  compatibilityNotes: readonly KeepCozyRoleLayerCompatibilityNote[];
};

export const KEEP_COZY_ROLE_LAYER_TRANSLATION_DRAFT: Record<
  KeepCozySpaceRole,
  KeepCozyRoleLayerTranslationDraft
> = {
  owner: {
    spaceRole: 'owner',
    runtimeSpaceRole: 'owner',
    defaultThreadParticipationRole: 'member',
    compatibilityNotes: [
      'runtime-space-role-is-lossy',
      'runtime-thread-role-is-not-an-operational-role',
      'thread-moderation-must-be-explicit',
      'operator-visibility-is-not-dm-decrypt-authority',
    ],
  },
  resident: {
    spaceRole: 'resident',
    runtimeSpaceRole: 'member',
    defaultThreadParticipationRole: 'member',
    compatibilityNotes: [
      'runtime-space-role-is-lossy',
      'runtime-thread-role-is-not-an-operational-role',
      'thread-moderation-must-be-explicit',
      'operator-visibility-is-not-dm-decrypt-authority',
    ],
  },
  operator: {
    spaceRole: 'operator',
    runtimeSpaceRole: 'admin',
    defaultThreadParticipationRole: 'member',
    compatibilityNotes: [
      'runtime-space-role-is-lossy',
      'runtime-thread-role-is-not-an-operational-role',
      'thread-moderation-must-be-explicit',
      'dm-owner-admin-semantics-are-disabled',
      'operator-visibility-is-not-dm-decrypt-authority',
    ],
  },
  internal_staff: {
    spaceRole: 'internal_staff',
    runtimeSpaceRole: 'admin',
    defaultThreadParticipationRole: 'member',
    compatibilityNotes: [
      'runtime-space-role-is-lossy',
      'runtime-thread-role-is-not-an-operational-role',
      'thread-moderation-must-be-explicit',
      'dm-owner-admin-semantics-are-disabled',
      'operator-visibility-is-not-dm-decrypt-authority',
    ],
  },
  contractor: {
    spaceRole: 'contractor',
    runtimeSpaceRole: 'member',
    defaultThreadParticipationRole: 'member',
    compatibilityNotes: [
      'runtime-space-role-is-lossy',
      'runtime-thread-role-is-not-an-operational-role',
      'thread-moderation-must-be-explicit',
      'assignment-scope-is-not-encoded-in-runtime-role',
      'operator-visibility-is-not-dm-decrypt-authority',
    ],
  },
  supplier: {
    spaceRole: 'supplier',
    runtimeSpaceRole: 'member',
    defaultThreadParticipationRole: 'member',
    compatibilityNotes: [
      'runtime-space-role-is-lossy',
      'runtime-thread-role-is-not-an-operational-role',
      'thread-moderation-must-be-explicit',
      'assignment-scope-is-not-encoded-in-runtime-role',
      'operator-visibility-is-not-dm-decrypt-authority',
    ],
  },
  inspector: {
    spaceRole: 'inspector',
    runtimeSpaceRole: 'member',
    defaultThreadParticipationRole: 'member',
    compatibilityNotes: [
      'runtime-space-role-is-lossy',
      'runtime-thread-role-is-not-an-operational-role',
      'thread-moderation-must-be-explicit',
      'assignment-scope-is-not-encoded-in-runtime-role',
      'operator-visibility-is-not-dm-decrypt-authority',
    ],
  },
};

export const KEEP_COZY_ROLE_LAYER_GUARDRAILS = [
  'Do not write operational roles into current conversation moderation fields.',
  'Do not infer thread moderation authority from KeepCozy business role alone.',
  'Do not treat runtime admin or owner thread roles as equivalent to operational job function.',
  'Do not project operator visibility into DM decrypt authority.',
  'Do not use current DM threads for owner/admin moderation semantics.',
] as const;

/**
 * Future-facing operational thread classification.
 *
 * This is designed for a companion metadata layer keyed by `conversation_id`.
 * It must not be used to overload the current `public.conversations.kind`
 * discriminator, which remains `dm | group`.
 */
export type KeepCozyThreadType =
  | 'service_request'
  | 'job_coordination'
  | 'supplier_order'
  | 'incident_resolution'
  | 'inspection'
  | 'quality_review'
  | 'internal_ops'
  | 'general_space_coordination';

export const KEEP_COZY_THREAD_TYPES = [
  'service_request',
  'job_coordination',
  'supplier_order',
  'incident_resolution',
  'inspection',
  'quality_review',
  'internal_ops',
  'general_space_coordination',
] as const satisfies readonly KeepCozyThreadType[];

/**
 * Future-facing thread audience classification for operational visibility.
 *
 * This stays separate from current join-policy and moderation fields.
 */
export type KeepCozyThreadAudienceMode =
  | 'standard'
  | 'external-facing'
  | 'restricted-external'
  | 'internal-only'
  | 'mixed';

export const KEEP_COZY_THREAD_AUDIENCE_MODES = [
  'standard',
  'external-facing',
  'restricted-external',
  'internal-only',
  'mixed',
] as const satisfies readonly KeepCozyThreadAudienceMode[];

/**
 * Draft interpretation notes for future KeepCozy access-mapping work.
 *
 * These are not final authorization outcomes. They exist so later backend,
 * policy, and RLS branches can discuss the same boundary rules without
 * inventing new wording each time.
 */
export type KeepCozyAccessMappingInterpretationNote =
  | 'global-role-does-not-bypass-space-membership'
  | 'space-membership-is-outer-boundary'
  | 'current-thread-membership-remains-runtime-allowlist'
  | 'thread-audience-is-future-policy-input'
  | 'internal-only-requires-explicit-policy'
  | 'restricted-external-requires-assignment'
  | 'operator-visibility-is-policy-not-thread-admin'
  | 'timeline-visibility-follows-parent-resource'
  | 'archive-remains-user-scoped'
  | 'dm-trust-mode-remains-separate';

export const KEEP_COZY_ACCESS_MAPPING_INTERPRETATION_NOTES = [
  'global-role-does-not-bypass-space-membership',
  'space-membership-is-outer-boundary',
  'current-thread-membership-remains-runtime-allowlist',
  'thread-audience-is-future-policy-input',
  'internal-only-requires-explicit-policy',
  'restricted-external-requires-assignment',
  'operator-visibility-is-policy-not-thread-admin',
  'timeline-visibility-follows-parent-resource',
  'archive-remains-user-scoped',
  'dm-trust-mode-remains-separate',
] as const satisfies readonly KeepCozyAccessMappingInterpretationNote[];

/**
 * Future-facing input shape for access-mapping interpretation around one
 * operational thread.
 *
 * Important:
 *
 * - this is scaffolding only; it does not enforce authorization
 * - `hasCurrentRuntimeThreadMembership` reflects the active runtime allowlist,
 *   not the later policy model
 * - `isAssignedExternalParticipant` is nullable because assignment truth does
 *   not exist in active schema yet
 */
export type KeepCozyThreadAccessMappingContextDraft = {
  resolvedRoleLayers: KeepCozyResolvedRoleLayers;
  audienceMode: KeepCozyThreadAudienceMode | null;
  operatorVisibleByPolicy: boolean | null;
  externalAccessRequiresAssignment: boolean | null;
  hasCompanionMetadata: boolean;
  hasCurrentRuntimeThreadMembership: boolean;
  isAssignedExternalParticipant: boolean | null;
};

/**
 * Draft interpretation outcome for future thread-access mapping.
 *
 * These are deliberately advisory. Later policy work can refine them into real
 * backend or RLS decisions once assignment tables, audience policy, and
 * operator oversight semantics are settled.
 */
export type KeepCozyThreadAccessInterpretationOutcomeDraft =
  | 'allow_by_current_runtime_membership'
  | 'allow_internal_only'
  | 'allow_operator_visibility'
  | 'require_explicit_external_assignment'
  | 'defer_to_future_policy'
  | 'deny_by_default';

export const KEEP_COZY_THREAD_ACCESS_INTERPRETATION_OUTCOMES_DRAFT = [
  'allow_by_current_runtime_membership',
  'allow_internal_only',
  'allow_operator_visibility',
  'require_explicit_external_assignment',
  'defer_to_future_policy',
  'deny_by_default',
] as const satisfies readonly KeepCozyThreadAccessInterpretationOutcomeDraft[];

export type KeepCozyThreadAccessInterpretationDraft = {
  outcome: KeepCozyThreadAccessInterpretationOutcomeDraft;
  canRelyOnCurrentRuntimeMembership: boolean;
  requiresExternalAssignment: boolean;
  operatorVisibilityExpectedByPolicy: boolean;
  notes: readonly KeepCozyAccessMappingInterpretationNote[];
};

/**
 * Draft basis for later timeline-row visibility filtering.
 *
 * Timeline rows must not become their own authorization truth. Later policy
 * work should resolve their visibility from the parent thread, object, or
 * space policy boundary.
 */
export type KeepCozySpaceTimelineEventVisibilityBasisDraft =
  | 'conversation_audience'
  | 'operational_object_policy'
  | 'space_policy'
  | 'manual_admin_review';

export const KEEP_COZY_SPACE_TIMELINE_EVENT_VISIBILITY_BASES_DRAFT = [
  'conversation_audience',
  'operational_object_policy',
  'space_policy',
  'manual_admin_review',
] as const satisfies readonly KeepCozySpaceTimelineEventVisibilityBasisDraft[];

export type KeepCozySpaceTimelineEventAccessInterpretationDraft = {
  visibilityBasis: KeepCozySpaceTimelineEventVisibilityBasisDraft;
  requiresParentResourceVisibility: boolean;
  notes: readonly KeepCozyAccessMappingInterpretationNote[];
};

export const KEEP_COZY_ACCESS_MAPPING_GUARDRAILS = [
  'Do not let global platform roles bypass explicit space membership.',
  'Do not treat companion metadata as final authorization truth by itself.',
  'Do not let audience_mode widen current dm/group behavior directly.',
  'Do not treat operator_visible_by_policy as DM plaintext authority.',
  'Do not let timeline rows bypass parent thread or object visibility.',
  'Do not collapse per-user archive state into operational audience policy.',
] as const;

/**
 * Future-facing operational workflow status for typed KeepCozy threads.
 *
 * `archived` is intentionally excluded because archive remains a per-user
 * visibility action, not the same thing as workflow closure.
 */
export type KeepCozyThreadStatus =
  | 'open'
  | 'active'
  | 'blocked'
  | 'resolved'
  | 'closed';

export const KEEP_COZY_THREAD_STATUSES = [
  'open',
  'active',
  'blocked',
  'resolved',
  'closed',
] as const satisfies readonly KeepCozyThreadStatus[];

/**
 * Future-facing operational record kinds that threads or timeline events may
 * later reference through an additive companion layer.
 *
 * These names intentionally do not force a 1:1 relationship with
 * `KeepCozyThreadType`.
 */
export type KeepCozyOperationalObjectKind =
  | 'service_request'
  | 'work_order'
  | 'inspection'
  | 'procurement_request'
  | 'issue_case'
  | 'vendor_assignment'
  | 'quality_review'
  | 'space_document';

export const KEEP_COZY_OPERATIONAL_OBJECT_KINDS = [
  'service_request',
  'work_order',
  'inspection',
  'procurement_request',
  'issue_case',
  'vendor_assignment',
  'quality_review',
  'space_document',
] as const satisfies readonly KeepCozyOperationalObjectKind[];

/**
 * Minimal durable reference to an operational record that a thread or message
 * may later point at through an additive companion layer.
 *
 * `id` stays `string` on purpose so the contract does not prematurely force
 * every future operational table to use the same physical PK type.
 */
export type KeepCozyOperationalObjectRef = {
  kind: KeepCozyOperationalObjectKind;
  id: string;
};

/**
 * Deferred future-facing shape for secondary/supporting object links.
 *
 * The first schema pass intentionally does not persist these links in
 * `public.conversation_companion_metadata`. Related links are left for a later
 * additive step so the initial schema can stay 1:1, optional, and easy to
 * backfill.
 */
export type KeepCozyThreadRelatedOperationalObjectLinkDraft = {
  objectRef: KeepCozyOperationalObjectRef;
  linkReason:
    | 'supporting-context'
    | 'assignment'
    | 'review-subject'
    | 'incident-anchor'
    | 'procurement-anchor'
    | 'related-record';
};

export const KEEP_COZY_THREAD_TYPE_TO_OPERATIONAL_OBJECT_KINDS_DRAFT: Record<
  KeepCozyThreadType,
  readonly KeepCozyOperationalObjectKind[]
> = {
  service_request: ['service_request'],
  job_coordination: ['work_order', 'vendor_assignment'],
  supplier_order: ['procurement_request', 'vendor_assignment'],
  incident_resolution: ['issue_case'],
  inspection: ['inspection'],
  quality_review: ['quality_review', 'work_order'],
  internal_ops: [],
  general_space_coordination: [],
};

/**
 * Flat row shape that mirrors the first SQL draft directly.
 *
 * This exists so later backend work can map between the logical companion
 * metadata contract and the additive table columns without guessing nullability
 * or column naming.
 *
 * Important:
 *
 * - the row itself is still optional because not every conversation will have
 *   companion metadata
 * - `primaryOperationalObjectRef` is intentionally flattened into
 *   `operational_object_type` and `operational_object_id` here to match SQL
 */
export type KeepCozyThreadCompanionMetadataRowDraft = {
  conversation_id: string;
  space_id: string;
  thread_type: KeepCozyThreadType;
  audience_mode: KeepCozyThreadAudienceMode;
  status: KeepCozyThreadStatus;
  operational_object_type: KeepCozyOperationalObjectKind | null;
  operational_object_id: string | null;
  thread_owner_user_id: string | null;
  operator_visible_by_policy: boolean;
  external_access_requires_assignment: boolean;
  opened_at: string | null;
  closed_at: string | null;
  visibility_scope_notes: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * Defaulted values from the first SQL pass.
 *
 * These do not imply that the row itself is auto-created for every
 * conversation. They only mirror the non-null defaults once a companion row
 * exists.
 */
export const KEEP_COZY_THREAD_COMPANION_METADATA_DEFAULTS_DRAFT = {
  status: 'open',
  operator_visible_by_policy: true,
  external_access_requires_assignment: false,
} as const satisfies Pick<
  KeepCozyThreadCompanionMetadataRowDraft,
  'status' | 'operator_visible_by_policy' | 'external_access_requires_assignment'
>;

/**
 * Logical contract shape for a future companion metadata row keyed by
 * `conversation_id`.
 *
 * This type is future-facing and additive. It does not imply that current
 * runtime reads or writes already depend on this shape. It also intentionally
 * carries only the single primary operational object ref for the first schema
 * pass.
 */
export type KeepCozyThreadCompanionMetadata = {
  conversationId: string;
  spaceId: string;
  threadType: KeepCozyThreadType;
  audienceMode: KeepCozyThreadAudienceMode;
  status: KeepCozyThreadStatus;
  primaryOperationalObjectRef: KeepCozyOperationalObjectRef | null;
  threadOwnerUserId: string | null;
  operatorVisibleByPolicy: boolean;
  externalAccessRequiresAssignment: boolean;
  openedAt: string | null;
  closedAt: string | null;
  visibilityScopeNotes: string | null;
  createdAt: string;
  updatedAt: string;
};

/**
 * Advisory field list for the first additive schema pass.
 *
 * This points the next schema branch toward likely column names without
 * freezing the final persistence design.
 */
export const KEEP_COZY_THREAD_COMPANION_METADATA_FIELD_CANDIDATES_DRAFT = [
  'conversation_id',
  'space_id',
  'thread_type',
  'audience_mode',
  'status',
  'operational_object_type',
  'operational_object_id',
  'thread_owner_user_id',
  'operator_visible_by_policy',
  'external_access_requires_assignment',
  'opened_at',
  'closed_at',
  'visibility_scope_notes',
  'created_at',
  'updated_at',
] as const;

/**
 * Draft table name for future additive space-wide operational timeline events.
 *
 * This is timeline scaffolding only. It must not be treated as proof that the
 * current runtime already writes or reads a unified event stream.
 */
export const KEEP_COZY_SPACE_TIMELINE_EVENTS_TABLE_NAME_DRAFT =
  'space_timeline_events';

/**
 * First-pass structured event categories for the future space timeline.
 *
 * These are the first committed, space-wide operational/system event kinds.
 * They intentionally focus on stable thread/object state transitions rather
 * than transient UI actions or broad chat mirroring.
 */
export type KeepCozySpaceTimelineEventType =
  | 'thread_created'
  | 'thread_metadata_attached'
  | 'primary_object_linked'
  | 'status_changed'
  | 'thread_closed'
  | 'thread_reopened';

export const KEEP_COZY_SPACE_TIMELINE_EVENT_TYPES = [
  'thread_created',
  'thread_metadata_attached',
  'primary_object_linked',
  'status_changed',
  'thread_closed',
  'thread_reopened',
] as const satisfies readonly KeepCozySpaceTimelineEventType[];

/**
 * Deferred event categories that are intentionally not part of the first
 * committed space-timeline pass.
 *
 * These remain useful design vocabulary, but later branches should not assume
 * they are safe to emit until the related assignment, document/media, or
 * first-class operational-object flows exist.
 */
export const KEEP_COZY_SPACE_TIMELINE_DEFERRED_EVENT_TYPES_DRAFT = [
  'operator_joined',
  'contractor_assigned',
  'supplier_attached',
  'document_attached',
  'media_attached',
  'quality_review_opened',
  'issue_opened',
  'issue_resolved',
] as const;

/**
 * Future-facing source classification for structured timeline events.
 *
 * This records which backend layer emitted the event without implying that the
 * emitter owns authorization, object truth, or UI rendering semantics.
 */
export type KeepCozySpaceTimelineEventSourceKind =
  | 'conversation'
  | 'conversation_companion_metadata'
  | 'operational_object'
  | 'message_asset'
  | 'system_process'
  | 'manual_admin';

export const KEEP_COZY_SPACE_TIMELINE_EVENT_SOURCE_KINDS = [
  'conversation',
  'conversation_companion_metadata',
  'operational_object',
  'message_asset',
  'system_process',
  'manual_admin',
] as const satisfies readonly KeepCozySpaceTimelineEventSourceKind[];

/**
 * Compact renderable/event-local details for one space timeline row.
 *
 * This payload is intentionally small and additive. It is not meant to replace
 * first-class operational objects or the message body/history model.
 */
export type KeepCozySpaceTimelineEventSummaryPayloadDraft = Readonly<
  Record<string, unknown>
>;

/**
 * Flat row shape that mirrors the first SQL draft for unified space timeline
 * events directly.
 *
 * This row is append-oriented and separate from user-authored messages. It may
 * optionally point at a conversation shell, a message shell, or a primary
 * operational object reference.
 */
export type KeepCozySpaceTimelineEventRowDraft = {
  id: string;
  space_id: string;
  conversation_id: string | null;
  message_id: string | null;
  operational_object_type: KeepCozyOperationalObjectKind | null;
  operational_object_id: string | null;
  actor_user_id: string | null;
  event_type: KeepCozySpaceTimelineEventType;
  source_kind: KeepCozySpaceTimelineEventSourceKind;
  occurred_at: string;
  summary_payload: KeepCozySpaceTimelineEventSummaryPayloadDraft;
  created_at: string;
};

/**
 * Logical future-facing space timeline event contract.
 *
 * Important:
 *
 * - this is a structured event layer, not a replacement for `public.messages`
 * - `messageId` is optional correlation only and must not turn the timeline
 *   into a mirror of chat history
 * - `primaryOperationalObjectRef` remains optional because not every timeline
 *   event will anchor to a structured work record in the first pass
 */
export type KeepCozySpaceTimelineEvent = {
  id: string;
  spaceId: string;
  conversationId: string | null;
  messageId: string | null;
  primaryOperationalObjectRef: KeepCozyOperationalObjectRef | null;
  actorUserId: string | null;
  eventType: KeepCozySpaceTimelineEventType;
  sourceKind: KeepCozySpaceTimelineEventSourceKind;
  occurredAt: string;
  summaryPayload: KeepCozySpaceTimelineEventSummaryPayloadDraft;
  createdAt: string;
};

/**
 * Advisory field list for the first additive space timeline schema pass.
 *
 * This guides the first schema draft without forcing current runtime code to
 * depend on the table yet.
 */
export const KEEP_COZY_SPACE_TIMELINE_EVENT_FIELD_CANDIDATES_DRAFT = [
  'id',
  'space_id',
  'conversation_id',
  'message_id',
  'operational_object_type',
  'operational_object_id',
  'actor_user_id',
  'event_type',
  'source_kind',
  'occurred_at',
  'summary_payload',
  'created_at',
] as const;
