import 'server-only';

import { getRequestSupabaseServerClient } from '@/lib/request-context/server';
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service';
import {
  buildAvatarDeliveryPath,
  isAbsoluteAvatarUrl,
} from '@/modules/messaging/avatar-delivery';
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

export type ExactUserSpaceAccessState = {
  activeSpace: UserSpaceRecord;
  activeSpaceGovernance: ResolvedSpaceGovernanceState;
  activeSpaceProfile: ResolvedSpaceProfile;
  globalGovernance: ResolvedSpaceGovernanceGlobalRole;
  requestedSpaceId: string;
  spaces: UserSpaceRecord[];
};

export type SpaceParticipantRecord = {
  userId: string;
  role: SpaceRole;
  createdAt: string | null;
  displayName: string | null;
  username: string | null;
  email: string | null;
  emailLocalPart: string | null;
  avatarPath: string | null;
  statusEmoji: string | null;
  statusText: string | null;
  statusUpdatedAt: string | null;
  isCurrentUser: boolean;
};

export const INITIAL_SUPER_ADMIN_EMAIL_ALLOWLIST = new Set([
  'dmtest1@chat.local',
  'dmtest2@chat.local',
]);

function normalizeStoredSpaceProfile(profile: string | null | undefined) {
  if (profile === 'messenger_full' || profile === 'keepcozy_ops') {
    return profile;
  }

  return null;
}

/**
 * Runtime profile resolver that prefers persisted profile storage when present
 * and falls back to the earlier name-based compatibility rule otherwise.
 *
 * Current fallback rule:
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
  const storedProfile = normalizeStoredSpaceProfile(input.storedProfile);

  if (storedProfile) {
    return {
      profile: storedProfile,
      source: 'space_profile_column',
      defaultShellRoute: getDefaultShellRouteForSpaceProfile(storedProfile),
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

function resolveParticipantAvatarPath(value: string | null | undefined) {
  const normalizedValue = value?.trim() || null;

  if (!normalizedValue) {
    return null;
  }

  if (isAbsoluteAvatarUrl(normalizedValue)) {
    return normalizedValue;
  }

  return buildAvatarDeliveryPath(normalizedValue);
}

type SpaceParticipantProfileRow = {
  user_id: string;
  display_name: string | null;
  username?: string | null;
  email_local_part?: string | null;
  avatar_path?: string | null;
  status_emoji?: string | null;
  status_text?: string | null;
  status_updated_at?: string | null;
};

async function loadSpaceParticipantProfiles(input: {
  client:
    | Awaited<ReturnType<typeof getRequestSupabaseServerClient>>
    | NonNullable<ReturnType<typeof createSupabaseServiceRoleClient>>;
  userIds: string[];
}) {
  if (input.userIds.length === 0) {
    return [] as Array<{
      avatarPath: string | null;
      displayName: string | null;
      emailLocalPart: string | null;
      statusEmoji: string | null;
      statusText: string | null;
      statusUpdatedAt: string | null;
      userId: string;
      username: string | null;
    }>;
  }

  const withStatuses = await input.client
    .from('profiles')
    .select(
      [
        'user_id',
        'display_name',
        'username',
        'email_local_part',
        'avatar_path',
        'status_emoji',
        'status_text',
        'status_updated_at',
      ].join(', '),
    )
    .in('user_id', input.userIds);

  if (!withStatuses.error) {
    return ((withStatuses.data ?? []) as unknown as SpaceParticipantProfileRow[]).map(
      (profile) => ({
        avatarPath: resolveParticipantAvatarPath(profile.avatar_path),
        displayName: profile.display_name?.trim() || null,
        emailLocalPart: profile.email_local_part?.trim() || null,
        statusEmoji: profile.status_emoji?.trim() || null,
        statusText: profile.status_text?.trim() || null,
        statusUpdatedAt: profile.status_updated_at?.trim() || null,
        userId: profile.user_id,
        username: profile.username?.trim() || null,
      }),
    );
  }

  const identityFallback = await input.client
    .from('profiles')
    .select('user_id, display_name, username, email_local_part, avatar_path')
    .in('user_id', input.userIds);

  if (!identityFallback.error) {
    return ((identityFallback.data ?? []) as unknown as SpaceParticipantProfileRow[]).map(
      (profile) => ({
        avatarPath: resolveParticipantAvatarPath(profile.avatar_path),
        displayName: profile.display_name?.trim() || null,
        emailLocalPart: profile.email_local_part?.trim() || null,
        statusEmoji: null,
        statusText: null,
        statusUpdatedAt: null,
        userId: profile.user_id,
        username: profile.username?.trim() || null,
      }),
    );
  }

  const minimalFallback = await input.client
    .from('profiles')
    .select('user_id, display_name')
    .in('user_id', input.userIds);

  if (minimalFallback.error) {
    throw new Error(minimalFallback.error.message);
  }

  return ((minimalFallback.data ?? []) as unknown as SpaceParticipantProfileRow[]).map(
    (profile) => ({
      avatarPath: null,
      displayName: profile.display_name?.trim() || null,
      emailLocalPart: null,
      statusEmoji: null,
      statusText: null,
      statusUpdatedAt: null,
      userId: profile.user_id,
      username: null,
    }),
  );
}

async function loadSpaceParticipantEmails(input: {
  serviceClient: NonNullable<ReturnType<typeof createSupabaseServiceRoleClient>> | null;
  userIds: string[];
}) {
  const emailsByUserId = new Map<string, string | null>();

  if (!input.serviceClient || input.userIds.length === 0) {
    return emailsByUserId;
  }

  const responses = await Promise.allSettled(
    input.userIds.map(async (userId) => {
      const response = await input.serviceClient!.auth.admin.getUserById(userId);
      return {
        email: response.data.user?.email?.trim() || null,
        userId,
      };
    }),
  );

  for (const response of responses) {
    if (response.status !== 'fulfilled') {
      continue;
    }

    emailsByUserId.set(response.value.userId, response.value.email);
  }

  return emailsByUserId;
}

function getSpaceParticipantSortWeight(role: SpaceRole) {
  if (role === 'owner') {
    return 0;
  }

  if (role === 'admin') {
    return 1;
  }

  return 2;
}

function getSpaceParticipantSortLabel(participant: SpaceParticipantRecord) {
  return (
    participant.displayName?.trim() ||
    participant.username?.trim() ||
    participant.emailLocalPart?.trim() ||
    participant.email?.split('@')[0]?.trim() ||
    participant.userId
  ).toLowerCase();
}

function isMissingRelationErrorMessage(message: string, relationName: string) {
  const normalizedMessage = message.toLowerCase();
  return (
    normalizedMessage.includes('relation') &&
    normalizedMessage.includes(relationName.toLowerCase())
  );
}

function isMissingSpaceProfileColumnErrorMessage(message: string) {
  const normalizedMessage = message.toLowerCase();

  return (
    normalizedMessage.includes('spaces.profile') &&
    (normalizedMessage.includes('does not exist') ||
      normalizedMessage.includes('schema cache'))
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

  type SpaceQueryRow = {
    id: string;
    name: string;
    created_by: string;
    created_at: string | null;
    profile?: string | null;
  };

  const spacesWithProfileResult = await supabase
    .from('spaces')
    .select('id, name, created_by, created_at, profile')
    .in('id', spaceIds);
  const spacesResult = (
    spacesWithProfileResult.error &&
    isMissingSpaceProfileColumnErrorMessage(spacesWithProfileResult.error.message)
  )
    ? await (async () => {
        logSpacesDiagnostics('spaces:query-profile-fallback', {
          source,
          message: spacesWithProfileResult.error.message,
        });

        return supabase
          .from('spaces')
          .select('id, name, created_by, created_at')
          .in('id', spaceIds);
      })()
    : spacesWithProfileResult;

  const spaces = (spacesResult.data ?? []) as SpaceQueryRow[];
  const spacesError = spacesResult.error;

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
    (spaces ?? []).map((space) => [
      space.id,
      {
        id: space.id,
        name: space.name,
        profile: normalizeSpaceProfile(space.profile),
        createdBy: space.created_by,
        createdAt: space.created_at,
        storedProfile: space.profile ?? null,
        updatedAt: null,
      } satisfies SpaceRecord & {
        storedProfile: string | null;
      },
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
        storedProfile: space.storedProfile,
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

export async function requireExactSpaceAccessForUser(input: {
  userId: string;
  userEmail?: string | null;
  requestedSpaceId?: string | null;
  source?: string;
}): Promise<ExactUserSpaceAccessState> {
  const requestedSpaceId = input.requestedSpaceId?.trim() || null;

  if (!requestedSpaceId) {
    throw new Error('An explicit space is required for this operation.');
  }

  const resolved = await resolveActiveSpaceForUser({
    requestedSpaceId,
    source: input.source ?? 'unknown',
    userEmail: input.userEmail ?? null,
    userId: input.userId,
  });

  if (
    !resolved.activeSpace ||
    !resolved.activeSpaceGovernance ||
    !resolved.activeSpaceProfile ||
    resolved.requestedSpaceWasInvalid ||
    resolved.activeSpace.id !== requestedSpaceId
  ) {
    throw new Error('You do not have access to this space.');
  }

  return {
    activeSpace: resolved.activeSpace,
    activeSpaceGovernance: resolved.activeSpaceGovernance,
    activeSpaceProfile: resolved.activeSpaceProfile,
    globalGovernance: resolved.globalGovernance,
    requestedSpaceId,
    spaces: resolved.spaces,
  };
}

export async function requireSpaceMemberManagementForUser(input: {
  userId: string;
  userEmail?: string | null;
  requestedSpaceId?: string | null;
  source?: string;
}): Promise<ExactUserSpaceAccessState> {
  const exactSpaceAccess = await requireExactSpaceAccessForUser(input);

  if (!exactSpaceAccess.activeSpaceGovernance.canManageMembers) {
    throw new Error('Only a space admin may manage members in this space.');
  }

  return exactSpaceAccess;
}

export async function getManageableSpaceParticipantsForUser(input: {
  userId: string;
  userEmail?: string | null;
  requestedSpaceId?: string | null;
  source?: string;
}) {
  const exactSpaceAccess = await requireSpaceMemberManagementForUser(input);
  const requestSupabase = await getRequestSupabaseServerClient();
  const serviceClient = createSupabaseServiceRoleClient();
  const queryClient = serviceClient ?? requestSupabase;
  const membershipResponse = await queryClient
    .from('space_members')
    .select('user_id, role, joined_at')
    .eq('space_id', exactSpaceAccess.activeSpace.id);

  if (membershipResponse.error) {
    throw new Error(membershipResponse.error.message);
  }

  const membershipRows = ((membershipResponse.data ?? []) as Array<{
    joined_at: string | null;
    role: SpaceRole;
    user_id: string;
  }>).filter((row) => Boolean(row.user_id));
  const userIds = Array.from(new Set(membershipRows.map((row) => row.user_id)));
  const profiles = await loadSpaceParticipantProfiles({
    client: queryClient,
    userIds,
  });
  const profileByUserId = new Map(
    profiles.map((profile) => [profile.userId, profile] as const),
  );
  const emailsByUserId = await loadSpaceParticipantEmails({
    serviceClient,
    userIds,
  });

  const participants = membershipRows
    .map((membership) => {
      const profile = profileByUserId.get(membership.user_id);

      return {
        avatarPath: profile?.avatarPath ?? null,
        createdAt: membership.joined_at ?? null,
        displayName: profile?.displayName ?? null,
        email: emailsByUserId.get(membership.user_id) ?? null,
        emailLocalPart: profile?.emailLocalPart ?? null,
        isCurrentUser: membership.user_id === input.userId,
        role: membership.role,
        statusEmoji: profile?.statusEmoji ?? null,
        statusText: profile?.statusText ?? null,
        statusUpdatedAt: profile?.statusUpdatedAt ?? null,
        userId: membership.user_id,
        username: profile?.username ?? null,
      } satisfies SpaceParticipantRecord;
    })
    .sort((left, right) => {
      const roleDelta =
        getSpaceParticipantSortWeight(left.role) -
        getSpaceParticipantSortWeight(right.role);

      if (roleDelta !== 0) {
        return roleDelta;
      }

      return getSpaceParticipantSortLabel(left).localeCompare(
        getSpaceParticipantSortLabel(right),
      );
    });

  return {
    activeSpace: exactSpaceAccess.activeSpace,
    participants,
  };
}

export async function resolveDefaultSpaceShellHrefForUser(input: {
  userId: string;
  userEmail?: string | null;
  requestedSpaceId?: string | null;
  source?: string;
}) {
  try {
    const globalGovernance = resolveSuperAdminGovernanceForUser({
      userEmail: input.userEmail ?? null,
    });

    if (globalGovernance.canCreateSpaces) {
      return '/spaces';
    }

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
