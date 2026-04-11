import type {
  ResolvedPlatformSpaceAccess,
  ResolvedSpaceAccessContract,
  ResolvedSpaceGovernanceRole,
  ResolvedSpaceMembershipState,
  SpaceProfile,
  SpaceRole,
} from './model';

function resolveSpaceMembershipState(
  role: SpaceRole,
): ResolvedSpaceMembershipState {
  return {
    canAccessSpace: true,
    isSpaceMember: true,
    membershipSource: 'space_members_row',
    role,
  };
}

function resolvePlatformSpaceAccess(input: {
  governance: ResolvedSpaceGovernanceRole;
  role: SpaceRole;
}): ResolvedPlatformSpaceAccess {
  return {
    governance: input.governance,
    membership: resolveSpaceMembershipState(input.role),
  };
}

/**
 * Shared platform access contract for one resolved space.
 *
 * Product surfaces should prefer this structure over open-coding access rules
 * from loose combinations of `role`, `profile`, and convenience booleans.
 */
export function resolveSpaceAccessContract(input: {
  governance: ResolvedSpaceGovernanceRole;
  profile: SpaceProfile;
  role: SpaceRole;
}): ResolvedSpaceAccessContract {
  const platform = resolvePlatformSpaceAccess({
    governance: input.governance,
    role: input.role,
  });
  const isKeepCozyPrimaryProfile = input.profile === 'keepcozy_ops';
  const canAccessSpace = platform.membership.canAccessSpace;
  const canManageMembers = platform.governance.canManageMembers;

  return {
    platform,
    products: {
      keepcozy: {
        canAccessOperationalActivity: canAccessSpace,
        canAccessOperationalShell: canAccessSpace,
        canManageMembers,
        isPrimaryProfile: isKeepCozyPrimaryProfile,
      },
      messenger: {
        canAccessChat: canAccessSpace,
        canAccessInbox: canAccessSpace,
        canManageMembers,
        isPrimaryProfile: !isKeepCozyPrimaryProfile,
      },
    },
  };
}
