export type SpaceRole = 'owner' | 'admin' | 'member';

export type SpaceGovernanceGlobalRole = 'super_admin';

export type SpaceGovernanceGlobalRoleSource =
  | 'initial_email_allowlist'
  | 'not_super_admin';

export type SpaceGovernanceRole = 'space_admin' | 'space_member';

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

export function normalizeSpaceProfile(
  value: string | null | undefined,
): SpaceProfile | null {
  const normalized = value?.trim() ?? '';

  if (!normalized) {
    return null;
  }

  return SPACE_PROFILES.includes(normalized as SpaceProfile)
    ? (normalized as SpaceProfile)
    : null;
}

export type SpaceProfileSource =
  | 'space_profile_column'
  | 'space_name_test_default'
  | 'fallback_messenger_default';

export type SpaceTheme = 'dark' | 'light';

export const SPACE_THEMES = [
  'dark',
  'light',
] as const satisfies readonly SpaceTheme[];

export function normalizeSpaceTheme(
  value: string | null | undefined,
): SpaceTheme | null {
  const normalized = value?.trim() ?? '';

  if (!normalized) {
    return null;
  }

  return SPACE_THEMES.includes(normalized as SpaceTheme)
    ? (normalized as SpaceTheme)
    : null;
}

export type SpaceThemeSource =
  | 'space_theme_column'
  | 'default_dark';

export type SpaceProfileDefaultShellRoute = '/inbox' | '/home';

export function getDefaultShellRouteForSpaceProfile(
  profile: SpaceProfile,
): SpaceProfileDefaultShellRoute {
  return profile === 'keepcozy_ops' ? '/home' : '/inbox';
}

export type ResolvedSpaceProfile = {
  profile: SpaceProfile;
  source: SpaceProfileSource;
  defaultShellRoute: SpaceProfileDefaultShellRoute;
};

export type ResolvedSpaceTheme = {
  theme: SpaceTheme;
  source: SpaceThemeSource;
};

export type SpaceRecord = {
  id: string;
  name: string;
  profile: SpaceProfile | null;
  theme: SpaceTheme | null;
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
