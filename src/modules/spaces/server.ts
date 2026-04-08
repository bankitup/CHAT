import 'server-only';

import { getRequestSupabaseServerClient } from '@/lib/request-context/server';
import type {
  ResolvedSpaceProfile,
  ResolvedSpaceGovernanceGlobalRole,
  ResolvedSpaceGovernanceRole,
  ResolvedSpaceGovernanceState,
  SpaceProfile,
  SpaceProfileDefaultShellRoute,
  SpaceProfileSource,
  SpaceGovernanceRoleSource,
  SpaceRecord,
  SpaceRole,
} from './model';
import { getDefaultShellRouteForSpaceProfile, normalizeSpaceProfile } from './model';
import { withSpaceParam } from './url';

export type UserSpaceRecord = SpaceRecord & {
  role: SpaceRole;
  governanceRole: ResolvedSpaceGovernanceRole['governanceRole'];
  governanceRoleSource: ResolvedSpaceGovernanceRole['governanceRoleSource'];
  canManageMembers: boolean;
  profile: SpaceProfile;
  profileSource: SpaceProfileSource;
  defaultShellRoute: SpaceProfileDefaultShellRoute;
};

export type ResolvedActiveSpaceState = {
  spaces: UserSpaceRecord[];
  activeSpace: UserSpaceRecord | null;
  activeSpaceGovernance: ResolvedSpaceGovernanceState | null;
  activeSpaceProfile: ResolvedSpaceProfile | null;
  globalGovernance: ResolvedSpaceGovernanceGlobalRole;
  requestedSpaceId: string | null;
  requestedSpaceWasInvalid: boolean;
};

export const INITIAL_SUPER_ADMIN_EMAIL_ALLOWLIST = new Set([
  'dmtest1@chat.local',
  'dmtest2@chat.local',
]);

/**
 * Persisted-first runtime profile resolver.
 *
 * Current rule:
 *
 * - an explicit stored profile on `public.spaces.profile` wins when present
 * - the shared `TEST` space remains the canonical KeepCozy operational
 *   fallback when storage is absent or null
 * - every other space falls back to the messenger-first profile
 */
export function resolveSpaceProfileForSpace(input: {
  spaceId: string;
  spaceName: string | null;
  storedProfile?: string | null;
}): ResolvedSpaceProfile {
  const persistedProfile = normalizeSpaceProfile(input.storedProfile);

  if (persistedProfile) {
    return {
      profile: persistedProfile,
      source: 'persisted_space_profile',
      defaultShellRoute: getDefaultShellRouteForSpaceProfile(persistedProfile),
    };
  }

  const normalizedSpaceName = input.spaceName?.trim().toUpperCase() ?? '';

  if (normalizedSpaceName === 'TEST') {
    return {
      profile: 'keepcozy_ops',
      source: 'space_name_test_default',
      defaultShellRoute: getDefaultShellRouteForSpaceProfile('keepcozy_ops'),
    };
  }

  return {
    profile: 'messenger_full',
    source: 'fallback_messenger_default',
    defaultShellRoute: getDefaultShellRouteForSpaceProfile('messenger_full'),
  };
}

export function resolveSpaceProfileShellHref(input: {
  profile: SpaceProfile;
  spaceId: string;
}) {
  return withSpaceParam(
    getDefaultShellRouteForSpaceProfile(input.profile),
    input.spaceId,
  );
}

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

function getSafeSupabaseHostFragment() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();

  if (!rawUrl) {
    return null;
  }

  try {
    const hostname = new URL(rawUrl).hostname;
    return hostname.split('.')[0] ?? hostname;
  } catch {
    return null;
  }
}

function getBuildMarker() {
  return (
    process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) ||
    process.env.VERCEL_URL ||
    'local'
  );
}

function logSpacesDiagnostics(
  stage: string,
  details?: Record<string, unknown>,
) {
  if (process.env.CHAT_DEBUG_SPACES_SSR !== '1') {
    return;
  }

  const base = {
    build: getBuildMarker(),
    supabaseProject: getSafeSupabaseHostFragment(),
  };

  if (details) {
    console.info('[spaces-ssr]', stage, {
      ...base,
      ...details,
    });
    return;
  }

  console.info('[spaces-ssr]', stage, base);
}

function createSpaceSchemaRequirementError(details: string) {
  return new Error(
    `${details} Apply the documented Supabase changes in /Users/danya/IOS - Apps/CHAT/docs/space-model.md.`,
  );
}

function isMissingRelationErrorMessage(message: string, relationName: string) {
  const normalizedMessage = message.toLowerCase();
  return (
    normalizedMessage.includes('relation') &&
    normalizedMessage.includes(relationName.toLowerCase())
  );
}

function isMissingColumnErrorMessage(message: string, columnName: string) {
  const normalizedMessage = message.toLowerCase();
  const normalizedColumnName = columnName.toLowerCase();

  return (
    normalizedMessage.includes(normalizedColumnName) &&
    (normalizedMessage.includes('column') ||
      normalizedMessage.includes('schema cache') ||
      normalizedMessage.includes('could not find'))
  );
}

export function isSpaceMembersSchemaCacheErrorMessage(message: string) {
  const normalizedMessage = message.toLowerCase();
  return (
    normalizedMessage.includes('space_members') &&
    (normalizedMessage.includes('schema cache') ||
      normalizedMessage.includes('could not find the table') ||
      normalizedMessage.includes('relation') ||
      normalizedMessage.includes('requires public.space_members'))
  );
}

export async function resolveV1TestSpaceFallback(input: {
  requestedSpaceId?: string | null;
  source?: string;
}) {
  const requestedSpaceId = input.requestedSpaceId?.trim() || null;

  if (!requestedSpaceId) {
    return null;
  }

  const supabase = await getRequestSupabaseServerClient();
  logSpacesDiagnostics('v1-test-fallback:lookup-start', {
    source: input.source ?? 'unknown',
    hasRequestedSpaceId: true,
  });
  const { data, error } = await supabase
    .from('spaces')
    .select('id, name')
    .eq('id', requestedSpaceId)
    .maybeSingle();

  if (error) {
    logSpacesDiagnostics('v1-test-fallback:lookup-error', {
      source: input.source ?? 'unknown',
      message: error.message,
    });
    return null;
  }

  const row = data as { id: string; name: string | null } | null;
  const spaceName = row?.name?.trim().toUpperCase() ?? '';

  if (!row || spaceName !== 'TEST') {
    logSpacesDiagnostics('v1-test-fallback:not-eligible', {
      source: input.source ?? 'unknown',
      requestedSpaceId,
    });
    return null;
  }

  logSpacesDiagnostics('v1-test-fallback:resolved', {
    source: input.source ?? 'unknown',
    requestedSpaceId,
  });
  return {
    id: row.id,
    name: row.name ?? 'TEST',
  };
}

export async function getUserSpaces(
  userId: string,
  options?: {
    source?: string;
  },
) {
  const supabase = await getRequestSupabaseServerClient();
  const source = options?.source ?? 'unknown';
  logSpacesDiagnostics('getUserSpaces:start', { source });
  logSpacesDiagnostics('space_members:query-start', {
    queried: true,
    source,
    queryShape:
      "from('space_members').select('space_id, role, joined_at').eq('user_id', ?).order('joined_at')",
  });
  const { data: memberships, error: membershipError } = await supabase
    .from('space_members')
    .select('space_id, role, joined_at')
    .eq('user_id', userId)
    .order('joined_at', { ascending: true });

  if (membershipError) {
    logSpacesDiagnostics('space_members:query-error', {
      queried: true,
      source,
      message: membershipError.message,
    });
    if (isMissingRelationErrorMessage(membershipError.message, 'space_members')) {
      throw createSpaceSchemaRequirementError(
        'Active space resolution requires public.space_members.',
      );
    }

    throw new Error(membershipError.message);
  }
  logSpacesDiagnostics('space_members:query-ok', {
    queried: true,
    source,
    count: (memberships ?? []).length,
  });

  const membershipRows = (memberships ?? []) as Array<{
    space_id: string;
    role: SpaceRole;
    joined_at?: string | null;
  }>;

  const spaceIds = Array.from(
    new Set(membershipRows.map((membership) => membership.space_id).filter(Boolean)),
  );

  if (spaceIds.length === 0) {
    logSpacesDiagnostics('getUserSpaces:done', { count: 0, source });
    return [] as UserSpaceRecord[];
  }

  const spacesWithProfileResponse = await supabase
    .from('spaces')
    .select('id, name, created_by, created_at, profile')
    .in('id', spaceIds);
  const spacesFallbackResponse =
    spacesWithProfileResponse.error &&
    isMissingColumnErrorMessage(spacesWithProfileResponse.error.message, 'profile')
      ? await supabase
          .from('spaces')
          .select('id, name, created_by, created_at')
          .in('id', spaceIds)
      : null;
  const spaces =
    (spacesFallbackResponse?.data ?? spacesWithProfileResponse.data) as Array<{
      id: string;
      name: string;
      created_by: string;
      created_at: string | null;
      profile?: string | null;
    }> | null;
  const spacesError =
    spacesFallbackResponse?.error ?? spacesWithProfileResponse.error;

  if (spacesError) {
    logSpacesDiagnostics('spaces:query-error', {
      source,
      message: spacesError.message,
    });
    if (isMissingRelationErrorMessage(spacesError.message, 'spaces')) {
      throw createSpaceSchemaRequirementError(
        'Active space resolution requires public.spaces.',
      );
    }

    throw new Error(spacesError.message);
  }

  const spaceById = new Map(
    ((spaces ?? []) as Array<{
      id: string;
      name: string;
      created_by: string;
      created_at: string | null;
      profile?: string | null;
    }>).map((space) => [
      space.id,
      {
        id: space.id,
        name: space.name,
        createdBy: space.created_by,
        createdAt: space.created_at,
        profile: normalizeSpaceProfile(space.profile),
        updatedAt: null,
      } satisfies SpaceRecord,
    ]),
  );
  const joinedAtBySpaceId = new Map(
    membershipRows.map((membership) => [membership.space_id, membership.joined_at ?? '']),
  );

  const resolvedSpaces = membershipRows
    .map((membership) => {
      const space = spaceById.get(membership.space_id);

      if (!space) {
        return null;
      }

      const profileResolution = resolveSpaceProfileForSpace({
        spaceId: space.id,
        spaceName: space.name,
        storedProfile: space.profile,
      });
      const governanceResolution = resolveSpaceGovernanceRoleForRuntimeSpaceRole(
        membership.role,
      );

      return {
        ...space,
        canManageMembers: governanceResolution.canManageMembers,
        defaultShellRoute: profileResolution.defaultShellRoute,
        governanceRole: governanceResolution.governanceRole,
        governanceRoleSource: governanceResolution.governanceRoleSource,
        profile: profileResolution.profile,
        profileSource: profileResolution.source,
        role: membership.role,
      } satisfies UserSpaceRecord;
    })
    .filter(Boolean)
    .sort((left, right) => {
      const leftValue = joinedAtBySpaceId.get(left?.id ?? '') ?? '';
      const rightValue = joinedAtBySpaceId.get(right?.id ?? '') ?? '';

      if (leftValue !== rightValue) {
        return leftValue.localeCompare(rightValue);
      }

      return (left?.name ?? '').localeCompare(right?.name ?? '');
    }) as UserSpaceRecord[];

  logSpacesDiagnostics('getUserSpaces:done', {
    count: resolvedSpaces.length,
    source,
  });
  return resolvedSpaces;
}

export async function resolveActiveSpaceForUser(input: {
  userId: string;
  userEmail?: string | null;
  requestedSpaceId?: string | null;
  source?: string;
}): Promise<ResolvedActiveSpaceState> {
  logSpacesDiagnostics('resolveActiveSpaceForUser:start', {
    source: input.source ?? 'unknown',
    hasRequestedSpaceId: Boolean(input.requestedSpaceId?.trim()),
  });
  const spaces = await getUserSpaces(input.userId, {
    source: input.source ?? 'unknown',
  });
  const requestedSpaceId = input.requestedSpaceId?.trim() || null;
  const requestedSpace =
    requestedSpaceId
      ? spaces.find((space) => space.id === requestedSpaceId) ?? null
      : null;
  const activeSpace = requestedSpace ?? spaces[0] ?? null;
  const globalGovernance = resolveSuperAdminGovernanceForUser({
    userEmail: input.userEmail ?? null,
  });
  const activeSpaceGovernance = activeSpace
    ? ({
        canCreateSpaces: globalGovernance.canCreateSpaces,
        canManageMembers: activeSpace.canManageMembers,
        globalRole: globalGovernance.globalRole,
        globalRoleSource: globalGovernance.globalRoleSource,
        governanceRole: activeSpace.governanceRole,
        governanceRoleSource: activeSpace.governanceRoleSource,
      } satisfies ResolvedSpaceGovernanceState)
    : null;
  const activeSpaceProfile = activeSpace
    ? ({
        defaultShellRoute: activeSpace.defaultShellRoute,
        profile: activeSpace.profile,
        source: activeSpace.profileSource,
      } satisfies ResolvedSpaceProfile)
    : null;

  logSpacesDiagnostics('resolveActiveSpaceForUser:done', {
    source: input.source ?? 'unknown',
    activeSpaceDefaultShellRoute: activeSpace?.defaultShellRoute ?? null,
    activeSpaceGovernanceRole: activeSpace?.governanceRole ?? null,
    activeSpaceProfile: activeSpace?.profile ?? null,
    globalGovernanceRole: globalGovernance.globalRole,
    spaceCount: spaces.length,
    hasActiveSpace: Boolean(activeSpace),
    requestedSpaceWasInvalid: Boolean(requestedSpaceId && !requestedSpace),
  });

  return {
    spaces,
    activeSpace,
    activeSpaceGovernance,
    activeSpaceProfile,
    globalGovernance,
    requestedSpaceId,
    requestedSpaceWasInvalid: Boolean(requestedSpaceId && !requestedSpace),
  };
}

export async function resolveDefaultSpaceShellHrefForUser(input: {
  userId: string;
  requestedSpaceId?: string | null;
  source?: string;
}) {
  try {
    const { activeSpace } = await resolveActiveSpaceForUser(input);

    if (!activeSpace) {
      return '/spaces';
    }

    return resolveSpaceProfileShellHref({
      profile: activeSpace.profile,
      spaceId: activeSpace.id,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (isSpaceMembersSchemaCacheErrorMessage(message)) {
      return '/spaces';
    }

    throw error;
  }
}

export async function resolveChatsHrefForUser(input: {
  userId: string;
  requestedSpaceId?: string | null;
  source?: string;
}) {
  try {
    const { activeSpace } = await resolveActiveSpaceForUser(input);

    if (!activeSpace) {
      return '/spaces';
    }

    return withSpaceParam('/inbox', activeSpace.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (isSpaceMembersSchemaCacheErrorMessage(message)) {
      return '/spaces';
    }

    throw error;
  }
}

export async function resolveHomeHrefForUser(input: {
  userId: string;
  requestedSpaceId?: string | null;
  source?: string;
}) {
  try {
    const { activeSpace } = await resolveActiveSpaceForUser(input);

    if (!activeSpace) {
      return '/spaces';
    }

    return withSpaceParam('/home', activeSpace.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (isSpaceMembersSchemaCacheErrorMessage(message)) {
      return '/spaces';
    }

    throw error;
  }
}
