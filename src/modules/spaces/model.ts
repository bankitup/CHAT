export type SpaceRole = 'owner' | 'admin' | 'member';

export type SpaceGovernanceGlobalRole = 'super_admin';

export const SPACE_GOVERNANCE_GLOBAL_ROLES = [
  'super_admin',
] as const satisfies readonly SpaceGovernanceGlobalRole[];

export type SpaceGovernanceGlobalRoleSource =
  | 'env_user_id_allowlist'
  | 'env_email_allowlist'
  | 'deferred_no_runtime_binding';

export type SpaceGovernanceRole = 'space_admin' | 'space_member';

export const SPACE_GOVERNANCE_ROLES = [
  'space_admin',
  'space_member',
] as const satisfies readonly SpaceGovernanceRole[];

export type SpaceGovernanceRoleSource =
  | 'runtime_space_role_owner'
  | 'runtime_space_role_admin'
  | 'runtime_space_role_member';

export type ResolvedSpaceGovernanceGlobalRole = {
  globalRole: SpaceGovernanceGlobalRole | null;
  globalRoleSource: SpaceGovernanceGlobalRoleSource;
  canCreateSpaces: boolean;
};

export type ResolvedSpaceGovernanceRole = {
  governanceRole: SpaceGovernanceRole;
  governanceRoleSource: SpaceGovernanceRoleSource;
  canManageMembers: boolean;
};

export type ResolvedSpaceGovernanceState =
  ResolvedSpaceGovernanceGlobalRole & ResolvedSpaceGovernanceRole;

export type SpaceProfile = 'messenger_full' | 'keepcozy_ops';

export const SPACE_PROFILES = [
  'messenger_full',
  'keepcozy_ops',
] as const satisfies readonly SpaceProfile[];

export type SpaceProfileSource =
  | 'space_profile_column'
  | 'space_name_test_default'
  | 'fallback_messenger_default';

export type SpaceProfileDefaultShellRoute = '/inbox' | '/home';

export type ResolvedSpaceProfile = {
  profile: SpaceProfile;
  source: SpaceProfileSource;
  defaultShellRoute: SpaceProfileDefaultShellRoute;
};

export type SpaceRecord = {
  id: string;
  name: string;
  createdBy: string;
  createdAt: string | null;
  updatedAt: string | null;
};

export type SpaceMemberRecord = {
  spaceId: string;
  userId: string;
  role: SpaceRole;
  createdAt: string | null;
};
