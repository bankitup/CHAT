import type {
  ResolvedSpaceGovernanceGlobalRole,
  ResolvedSpaceGovernanceRole,
  SpaceGovernanceRoleSource,
  SpaceRole,
} from './model';

export const INITIAL_SUPER_ADMIN_EMAIL_ALLOWLIST = new Set([
  'dmtest1@chat.local',
  'dmtest2@chat.local',
]);

function normalizeGovernanceEmail(value: string | null | undefined) {
  const normalizedValue = value?.trim().toLowerCase() ?? null;
  return normalizedValue && normalizedValue.length > 0 ? normalizedValue : null;
}

export function resolveSuperAdminGovernanceForUser(input: {
  userEmail?: string | null;
}): ResolvedSpaceGovernanceGlobalRole {
  const normalizedEmail = normalizeGovernanceEmail(input.userEmail);
  const isSuperAdmin = normalizedEmail
    ? INITIAL_SUPER_ADMIN_EMAIL_ALLOWLIST.has(normalizedEmail)
    : false;

  return {
    globalRole: isSuperAdmin ? 'super_admin' : null,
    globalRoleSource: isSuperAdmin
      ? 'initial_email_allowlist'
      : 'not_super_admin',
    canCreateSpaces: isSuperAdmin,
  };
}

export function resolveSpaceGovernanceRoleForRuntimeSpaceRole(
  role: SpaceRole,
): ResolvedSpaceGovernanceRole {
  let governanceRole: ResolvedSpaceGovernanceRole['governanceRole'] =
    'space_member';
  let governanceRoleSource: SpaceGovernanceRoleSource =
    'runtime_space_role_member';

  if (role === 'owner') {
    governanceRole = 'space_admin';
    governanceRoleSource = 'runtime_space_role_owner';
  } else if (role === 'admin') {
    governanceRole = 'space_admin';
    governanceRoleSource = 'runtime_space_role_admin';
  }

  return {
    governanceRole,
    governanceRoleSource,
    canManageMembers: governanceRole === 'space_admin',
  };
}
