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
 * First-class operational record kinds called out by the current KeepCozy
 * architecture docs.
 */
export type KeepCozyOperationalObjectKind =
  | 'service_request'
  | 'work_order'
  | 'supplier_order'
  | 'inspection'
  | 'incident_case'
  | 'quality_review'
  | 'space_document';

/**
 * Minimal durable reference to an operational record that a thread or message
 * may later point at through an additive companion layer.
 */
export type KeepCozyOperationalObjectRef = {
  kind: KeepCozyOperationalObjectKind;
  id: string;
};

/**
 * Thread-local participation and moderation role.
 *
 * This intentionally reuses the current generic conversation role vocabulary
 * instead of introducing operational job-function semantics into thread
 * membership prematurely.
 */
export type KeepCozyThreadParticipationRole = GroupConversationMemberRole;

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
  defaultThreadParticipationRole: KeepCozyThreadParticipationRole;
  allowedAudienceModes: KeepCozyThreadAudienceMode[];
  requiresExplicitAssignment: boolean;
  operatorVisibleByDefault: boolean;
};

/**
 * Future-facing companion metadata shape for a KeepCozy operational thread.
 *
 * The active runtime does not yet persist this shape directly. It exists so
 * later schema, backend, and UI work can share one low-risk vocabulary.
 */
export type KeepCozyThreadCompanionMetadata = {
  conversationId: string;
  threadType: KeepCozyThreadType;
  audienceMode: KeepCozyThreadAudienceMode;
  status: KeepCozyThreadStatus | null;
  operationalObjectRef: KeepCozyOperationalObjectRef | null;
  threadOwnerUserId: string | null;
  openedAt: string | null;
  closedAt: string | null;
  visibilityScopeNotes: string | null;
};
