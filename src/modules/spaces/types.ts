import type { GroupConversationMemberRole } from '@/modules/messaging/group-policy';
import type { SpaceRole } from '@/modules/spaces/model';

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

/**
 * Future-facing operational role vocabulary for one KeepCozy space.
 *
 * This is intentionally separate from the current runtime `SpaceRole`, which
 * still remains the active schema/runtime contract today.
 */
export type KeepCozySpaceRole =
  | 'owner'
  | 'resident'
  | 'operator'
  | 'internal_staff'
  | 'contractor'
  | 'supplier'
  | 'inspector';

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

/**
 * Future-facing operational record kinds that threads or timeline events may
 * later reference through an additive companion layer.
 *
 * These names intentionally do not force a 1:1 relationship with
 * `KeepCozyThreadType`. A `job_coordination` thread may point at a
 * `work_order`, for example, and a `supplier_order` thread may later point at
 * a `procurement_request`.
 *
 * This union is a contract draft only. It does not imply these tables already
 * exist or that the final schema names are frozen.
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

/**
 * Minimal durable reference to an operational record that a thread or message
 * may later point at through an additive companion layer.
 *
 * Keep this shape intentionally small until real operational tables exist.
 */
export type KeepCozyOperationalObjectRef = {
  kind: KeepCozyOperationalObjectKind;
  id: string;
};

/**
 * Future-facing linkage metadata for a thread's primary or related operational
 * objects.
 *
 * This is a contract draft only. It does not imply current conversations
 * persist object links today.
 */
export type KeepCozyThreadOperationalObjectLink = {
  primaryObjectRef: KeepCozyOperationalObjectRef | null;
  relatedObjectRefs: KeepCozyOperationalObjectRef[];
  linkReason:
    | 'primary-work-record'
    | 'supporting-context'
    | 'assignment'
    | 'review-subject'
    | 'incident-anchor'
    | 'procurement-anchor'
    | null;
};

/**
 * Draft guidance for which object kinds an operational thread type will most
 * likely point to later.
 *
 * This is intentionally advisory and plural. It should help future schema and
 * UI work without forcing an early persistence design.
 */
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
 * Future-facing visibility metadata for an operational thread companion layer.
 *
 * `audienceMode` remains the main classification field. The other properties
 * make policy-relevant intent explicit without changing current authorization
 * behavior.
 */
export type KeepCozyThreadVisibilityMetadata = {
  audienceMode: KeepCozyThreadAudienceMode;
  operatorVisibleByPolicy: boolean;
  externalAccessRequiresAssignment: boolean;
  visibilityScopeNotes: string | null;
};

/**
 * Future-facing lifecycle metadata for an operational thread companion layer.
 *
 * Archive is intentionally excluded here because personal archive/hide remains
 * a per-member visibility concern in `conversation_members.hidden_at`, not a
 * thread-level workflow state.
 */
export type KeepCozyThreadLifecycleMetadata = {
  status: KeepCozyThreadStatus | null;
  openedAt: string | null;
  closedAt: string | null;
};

/**
 * Future-facing ownership metadata for one operational thread.
 *
 * This stays narrow on purpose. It captures operator-side accountability
 * without implying a full assignment model already exists.
 */
export type KeepCozyThreadOwnershipMetadata = {
  threadOwnerUserId: string | null;
};

/**
 * Draft candidate field names for a future thread companion metadata schema.
 *
 * This list is intentionally advisory. It is meant to help the next schema
 * branch stay aligned with the architecture docs without freezing the final
 * table shape too early.
 */
export const KEEP_COZY_THREAD_COMPANION_METADATA_FIELD_CANDIDATES_DRAFT = [
  'conversation_id',
  'thread_type',
  'audience_mode',
  'status',
  'operational_object_type',
  'operational_object_id',
  'thread_owner_user_id',
  'opened_at',
  'closed_at',
  'operator_visible_by_policy',
  'external_access_requires_assignment',
  'visibility_scope_notes',
] as const;

/**
 * Thread-local participation and moderation role.
 *
 * This intentionally reuses the current generic conversation role vocabulary
 * instead of introducing operational job-function semantics into thread
 * membership prematurely.
 */
export type KeepCozyThreadParticipationRole = GroupConversationMemberRole;

/**
 * Current DM runtime intentionally avoids `owner` and `admin` semantics.
 *
 * This exists to make the DM exception explicit in future compatibility work.
 */
export type KeepCozyCurrentRuntimeDmThreadParticipationRole = 'member';

/**
 * Narrow runtime role surfaces that exist today.
 *
 * These constants are useful as a reminder that the current production role
 * vocabulary is smaller than the future KeepCozy operational role model.
 */
export const KEEP_COZY_CURRENT_RUNTIME_SPACE_ROLE_SURFACE: readonly SpaceRole[] =
  ['owner', 'admin', 'member'];

export const KEEP_COZY_CURRENT_RUNTIME_GROUP_THREAD_ROLE_SURFACE: readonly GroupConversationMemberRole[] =
  ['owner', 'admin', 'member'];

export const KEEP_COZY_CURRENT_RUNTIME_DM_THREAD_ROLE_SURFACE: readonly KeepCozyCurrentRuntimeDmThreadParticipationRole[] =
  ['member'];

/**
 * Compatibility notes for future role translation work.
 *
 * These notes are intentionally advisory. They must not be treated as a
 * replacement for later policy, schema, or authorization design.
 */
export type KeepCozyRoleLayerCompatibilityNote =
  | 'runtime-space-role-is-lossy'
  | 'runtime-thread-role-is-not-an-operational-role'
  | 'thread-moderation-must-be-explicit'
  | 'assignment-scope-is-not-encoded-in-runtime-role'
  | 'dm-owner-admin-semantics-are-disabled'
  | 'operator-visibility-is-not-dm-decrypt-authority';

/**
 * Snapshot of the resolved role layers for one user in one space/thread
 * context.
 *
 * `runtime*` fields exist only to bridge current CHAT runtime state with the
 * future KeepCozy role model during the additive migration period.
 */
export type KeepCozyResolvedRoleLayers = {
  globalPlatformRole: KeepCozyGlobalPlatformRole;
  keepCozySpaceRole: KeepCozySpaceRole | null;
  threadParticipationRole: KeepCozyThreadParticipationRole | null;
  runtimeSpaceRole: SpaceRole | null;
  runtimeThreadParticipationRole: GroupConversationMemberRole | null;
};

/**
 * Future-facing compatibility contract that translates a KeepCozy operational
 * role into generic thread-local participation defaults and audience limits.
 *
 * This is a placeholder type for later policy helpers. It does not imply the
 * current schema already stores these mappings.
 */
export type KeepCozyRoleLayerTranslation = {
  spaceRole: KeepCozySpaceRole;
  runtimeSpaceRole: SpaceRole;
  defaultThreadParticipationRole: KeepCozyThreadParticipationRole;
  allowedAudienceModes: KeepCozyThreadAudienceMode[];
  requiresExplicitAssignment: boolean;
  operatorVisibleByDefault: boolean;
  compatibilityNotes: readonly KeepCozyRoleLayerCompatibilityNote[];
};

/**
 * Reverse-compatibility hint from current generic runtime space roles to the
 * future KeepCozy space-role surface.
 *
 * This is intentionally plural because the current runtime role layer is too
 * generic to imply a single business role safely.
 */
export const KEEP_COZY_RUNTIME_SPACE_ROLE_TO_CANDIDATE_SPACE_ROLES: Record<
  SpaceRole,
  readonly KeepCozySpaceRole[]
> = {
  owner: ['owner'],
  admin: ['operator', 'internal_staff'],
  member: ['resident', 'contractor', 'supplier', 'inspector'],
};

/**
 * Draft forward-compatibility mapping from KeepCozy operational roles to the
 * current generic runtime role surface.
 *
 * This mapping is intentionally lossy. It is suitable for compatibility
 * scaffolding only, not as a final authorization model.
 */
export const KEEP_COZY_ROLE_LAYER_TRANSLATION_DRAFT: Record<
  KeepCozySpaceRole,
  KeepCozyRoleLayerTranslation
> = {
  owner: {
    spaceRole: 'owner',
    runtimeSpaceRole: 'owner',
    defaultThreadParticipationRole: 'member',
    allowedAudienceModes: ['standard', 'external-facing', 'mixed'],
    requiresExplicitAssignment: false,
    operatorVisibleByDefault: false,
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
    allowedAudienceModes: ['standard', 'external-facing'],
    requiresExplicitAssignment: false,
    operatorVisibleByDefault: false,
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
    allowedAudienceModes: [
      'standard',
      'external-facing',
      'restricted-external',
      'internal-only',
      'mixed',
    ],
    requiresExplicitAssignment: false,
    operatorVisibleByDefault: true,
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
    allowedAudienceModes: ['standard', 'restricted-external', 'internal-only', 'mixed'],
    requiresExplicitAssignment: false,
    operatorVisibleByDefault: true,
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
    allowedAudienceModes: ['restricted-external'],
    requiresExplicitAssignment: true,
    operatorVisibleByDefault: false,
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
    allowedAudienceModes: ['restricted-external'],
    requiresExplicitAssignment: true,
    operatorVisibleByDefault: false,
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
    allowedAudienceModes: ['restricted-external'],
    requiresExplicitAssignment: true,
    operatorVisibleByDefault: false,
    compatibilityNotes: [
      'runtime-space-role-is-lossy',
      'runtime-thread-role-is-not-an-operational-role',
      'thread-moderation-must-be-explicit',
      'assignment-scope-is-not-encoded-in-runtime-role',
      'operator-visibility-is-not-dm-decrypt-authority',
    ],
  },
};

/**
 * Guardrails for compatibility work between current runtime roles and the
 * future KeepCozy role layers.
 */
export const KEEP_COZY_ROLE_LAYER_GUARDRAILS = [
  'Do not write operational roles into current conversation moderation fields.',
  'Do not infer thread moderation authority from KeepCozy business role alone.',
  'Do not treat runtime admin/owner thread roles as equivalent to operational job function.',
  'Do not project operator visibility into DM decrypt authority.',
  'Do not use current DM threads for owner/admin moderation semantics.',
] as const;

export function resolveKeepCozyRoleLayerTranslation(
  spaceRole: KeepCozySpaceRole,
) {
  return KEEP_COZY_ROLE_LAYER_TRANSLATION_DRAFT[spaceRole];
}

export function getCandidateKeepCozySpaceRolesForRuntimeSpaceRole(
  runtimeSpaceRole: SpaceRole,
) {
  return KEEP_COZY_RUNTIME_SPACE_ROLE_TO_CANDIDATE_SPACE_ROLES[runtimeSpaceRole];
}

/**
 * Future-facing companion metadata shape for a KeepCozy operational thread.
 *
 * This is the logical contract shape for a future companion layer keyed by
 * `conversation_id`.
 *
 * The active runtime does not yet persist this shape directly. The nested
 * groups are meant to keep responsibilities explicit for later schema/backend
 * work; they do not require the eventual physical schema to use JSON columns.
 */
export type KeepCozyThreadCompanionMetadata = {
  conversationId: string;
  threadType: KeepCozyThreadType;
  visibility: KeepCozyThreadVisibilityMetadata;
  lifecycle: KeepCozyThreadLifecycleMetadata;
  primaryOperationalObjectRef: KeepCozyOperationalObjectRef | null;
  operationalObjectLink: KeepCozyThreadOperationalObjectLink | null;
  ownership: KeepCozyThreadOwnershipMetadata;
};
