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
