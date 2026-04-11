import 'server-only';

import type { User } from '@supabase/supabase-js';
import { requireRequestViewer } from '@/lib/request-context/server';
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service';
import {
  getDefaultShellRouteForSpaceProfile,
  normalizeSpaceProfile,
  normalizeSpaceTheme,
  type SpaceProfile,
  type SpaceRole,
  type SpaceTheme,
} from './model';
import {
  getHomeSpacePlanDefinition,
  resolveCurrentHomeSpacePlanCode,
} from './plan-config';
import {
  requireSpaceMemberManagementForUser,
  resolveSuperAdminGovernanceForUser,
} from './server';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

type ParsedSpaceIdentifier = {
  kind: 'email' | 'user_id';
  normalized: string;
  raw: string;
};

type ResolvedProvisionUser = {
  userId: string;
};

function trimToNullable(value: string | null | undefined) {
  const normalized = value?.trim() ?? '';
  return normalized ? normalized : null;
}

function isReservedTestSpaceName(value: string | null | undefined) {
  return value?.trim().toUpperCase() === 'TEST';
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

function parseSpaceUserIdentifiers(rawValue: string | null | undefined) {
  const unique = new Set<string>();
  const valid: ParsedSpaceIdentifier[] = [];
  const invalid: string[] = [];

  for (const rawPart of String(rawValue ?? '').split(/[\n,]+/)) {
    const raw = rawPart.trim();

    if (!raw) {
      continue;
    }

    if (raw.includes('@')) {
      const normalized = raw.toLowerCase();

      if (!EMAIL_PATTERN.test(normalized)) {
        invalid.push(raw);
        continue;
      }

      const key = `email:${normalized}`;

      if (!unique.has(key)) {
        unique.add(key);
        valid.push({
          kind: 'email',
          normalized,
          raw,
        });
      }

      continue;
    }

    if (!UUID_PATTERN.test(raw)) {
      invalid.push(raw);
      continue;
    }

    const normalized = raw.toLowerCase();
    const key = `user_id:${normalized}`;

    if (!unique.has(key)) {
      unique.add(key);
      valid.push({
        kind: 'user_id',
        normalized,
        raw,
      });
    }
  }

  return { invalid, valid };
}

function parseSelectedSpaceMemberUserIds(rawValue: string | null | undefined) {
  const unique = new Set<string>();
  const valid: string[] = [];
  const invalid: string[] = [];

  for (const rawPart of String(rawValue ?? '').split(/[\n,]+/)) {
    const raw = rawPart.trim();

    if (!raw) {
      continue;
    }

    if (!UUID_PATTERN.test(raw)) {
      invalid.push(raw);
      continue;
    }

    const normalized = raw.toLowerCase();

    if (!unique.has(normalized)) {
      unique.add(normalized);
      valid.push(normalized);
    }
  }

  return {
    invalid,
    valid,
  };
}

function sumFinitePositiveNumbers(values: Array<number | null | undefined>) {
  return values.reduce<number>((total, value) => {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
      return total;
    }

    return total + value;
  }, 0);
}

async function getGovernedSpaceStorageUsageBytes(input: {
  serviceClient: NonNullable<ReturnType<typeof createSupabaseServiceRoleClient>>;
  spaceId: string;
}) {
  const { data: conversationRows, error: conversationsError } =
    await input.serviceClient
      .from('conversations')
      .select('id')
      .eq('space_id', input.spaceId);

  if (conversationsError) {
    throw new Error(conversationsError.message);
  }

  const conversationIds = ((conversationRows ?? []) as Array<{ id: string }>)
    .map((row) => row.id)
    .filter(Boolean);

  if (conversationIds.length === 0) {
    return 0;
  }

  const { data: assetRows, error: assetsError } = await input.serviceClient
    .from('message_assets')
    .select('size_bytes')
    .eq('source', 'supabase-storage')
    .in('conversation_id', conversationIds);

  if (assetsError) {
    throw new Error(assetsError.message);
  }

  return sumFinitePositiveNumbers(
    ((assetRows ?? []) as Array<{ size_bytes?: number | null }>).map(
      (row) => row.size_bytes ?? null,
    ),
  );
}

async function listUsersByEmail(input: {
  emails: string[];
  serviceClient: NonNullable<ReturnType<typeof createSupabaseServiceRoleClient>>;
}) {
  const remainingEmails = new Set(input.emails.map((email) => email.toLowerCase()));
  const resolvedByEmail = new Map<string, User>();
  let page = 1;
  let lastPage = 1;

  while (remainingEmails.size > 0 && page <= lastPage) {
    const response = await input.serviceClient.auth.admin.listUsers({
      page,
      perPage: 1000,
    });

    if (response.error) {
      throw new Error(response.error.message);
    }

    lastPage = response.data.lastPage || 1;

    for (const user of response.data.users) {
      const normalizedEmail = user.email?.trim().toLowerCase() ?? null;

      if (!normalizedEmail || !remainingEmails.has(normalizedEmail)) {
        continue;
      }

      resolvedByEmail.set(normalizedEmail, user);
      remainingEmails.delete(normalizedEmail);
    }

    page += 1;
  }

  return resolvedByEmail;
}

async function resolveProvisionUsers(
  identifiers: ParsedSpaceIdentifier[],
  serviceClient: NonNullable<ReturnType<typeof createSupabaseServiceRoleClient>>,
) {
  const emailIdentifiers = identifiers.filter((identifier) => identifier.kind === 'email');
  const userIdIdentifiers = identifiers.filter(
    (identifier) => identifier.kind === 'user_id',
  );
  const resolvedByIdentifier = new Map<string, ResolvedProvisionUser>();
  const unresolvedIdentifiers: string[] = [];

  if (emailIdentifiers.length > 0) {
    const usersByEmail = await listUsersByEmail({
      emails: emailIdentifiers.map((identifier) => identifier.normalized),
      serviceClient,
    });

    for (const identifier of emailIdentifiers) {
      const user = usersByEmail.get(identifier.normalized);

      if (!user?.id) {
        unresolvedIdentifiers.push(identifier.raw);
        continue;
      }

      resolvedByIdentifier.set(identifier.normalized, {
        userId: user.id,
      });
    }
  }

  if (userIdIdentifiers.length > 0) {
    const responses = await Promise.all(
      userIdIdentifiers.map(async (identifier) => ({
        identifier,
        response: await serviceClient.auth.admin.getUserById(identifier.normalized),
      })),
    );

    for (const { identifier, response } of responses) {
      if (response.error || !response.data.user?.id) {
        unresolvedIdentifiers.push(identifier.raw);
        continue;
      }

      resolvedByIdentifier.set(identifier.normalized, {
        userId: response.data.user.id,
      });
    }
  }

  return {
    resolvedByIdentifier,
    unresolvedIdentifiers,
  };
}

function buildResolvedUserOrder(input: {
  adminIdentifiers: ParsedSpaceIdentifier[];
  participantIdentifiers: ParsedSpaceIdentifier[];
  resolvedByIdentifier: Map<string, ResolvedProvisionUser>;
}) {
  const orderedUsers = new Map<string, ResolvedProvisionUser>();

  for (const identifier of [
    ...input.participantIdentifiers,
    ...input.adminIdentifiers,
  ]) {
    const resolvedUser = input.resolvedByIdentifier.get(identifier.normalized);

    if (!resolvedUser || orderedUsers.has(resolvedUser.userId)) {
      continue;
    }

    orderedUsers.set(resolvedUser.userId, resolvedUser);
  }

  return orderedUsers;
}

function buildInitialMembershipRows(input: {
  adminIdentifiers: ParsedSpaceIdentifier[];
  participantIdentifiers: ParsedSpaceIdentifier[];
  resolvedByIdentifier: Map<string, ResolvedProvisionUser>;
  spaceId: string;
}) {
  const orderedUsers = buildResolvedUserOrder(input);

  const seenAdminIds = new Set<string>();

  for (const identifier of input.adminIdentifiers) {
    const resolvedUser = input.resolvedByIdentifier.get(identifier.normalized);

    if (!resolvedUser || seenAdminIds.has(resolvedUser.userId)) {
      continue;
    }

    seenAdminIds.add(resolvedUser.userId);
  }

  if (seenAdminIds.size === 0) {
    throw new Error('At least one initial space admin is required.');
  }

  const ownerUserId = Array.from(seenAdminIds)[0] ?? null;
  const rows = Array.from(orderedUsers.values()).map((resolvedUser) => {
    let role: SpaceRole = 'member';

    if (resolvedUser.userId === ownerUserId) {
      role = 'owner';
    } else if (seenAdminIds.has(resolvedUser.userId)) {
      role = 'admin';
    }

    return {
      role,
      space_id: input.spaceId,
      user_id: resolvedUser.userId,
    };
  });

  return {
    rows,
  };
}

async function requireServiceRoleClient() {
  const serviceClient = createSupabaseServiceRoleClient();

  if (!serviceClient) {
    throw new Error(
      'Space creation is not configured right now. Missing Supabase service role access.',
    );
  }

  return serviceClient;
}

async function assertSuperAdminViewer(surface: string) {
  const viewer = await requireRequestViewer(surface);
  const globalGovernance = resolveSuperAdminGovernanceForUser({
    userEmail: viewer.email ?? null,
  });

  if (!globalGovernance.canCreateSpaces) {
    throw new Error('Only a super admin may create a new space.');
  }

  return viewer;
}

async function insertSpaceRow(input: {
  createdBy: string;
  name: string;
  profile: SpaceProfile;
  theme: SpaceTheme;
  serviceClient: NonNullable<ReturnType<typeof createSupabaseServiceRoleClient>>;
}) {
  const now = new Date().toISOString();
  const insertPayload: {
    created_by: string;
    name: string;
    profile?: SpaceProfile;
    theme?: SpaceTheme;
    updated_at: string;
  } = {
    created_by: input.createdBy,
    name: input.name,
    profile: input.profile,
    theme: input.theme,
    updated_at: now,
  };

  let response = await input.serviceClient
    .from('spaces')
    .insert(insertPayload)
    .select('id, name')
    .single();

  let profilePersisted = true;
  let themePersisted = true;

  if (
    response.error &&
    isMissingColumnErrorMessage(response.error.message, 'theme')
  ) {
    themePersisted = false;
    delete insertPayload.theme;
    response = await input.serviceClient
      .from('spaces')
      .insert(insertPayload)
      .select('id, name')
      .single();
  }

  if (
    response.error &&
    isMissingColumnErrorMessage(response.error.message, 'profile')
  ) {
    profilePersisted = false;
    delete insertPayload.profile;
    response = await input.serviceClient
      .from('spaces')
      .insert(insertPayload)
      .select('id, name')
      .single();
  }

  if (response.error || !response.data?.id) {
    throw new Error(response.error?.message ?? 'Unable to create the new space.');
  }

  return {
    id: response.data.id,
    name: response.data.name ?? input.name,
    profilePersisted,
    themePersisted,
  };
}

export async function createGovernedSpace(input: {
  adminIdentifiers: string;
  participantIdentifiers: string;
  profile: string;
  spaceName: string;
}) {
  const viewer = await assertSuperAdminViewer('spaces:create-space');
  const serviceClient = await requireServiceRoleClient();
  const spaceName = trimToNullable(input.spaceName);
  const profile = normalizeSpaceProfile(input.profile) ?? 'messenger_full';
  const participantIdentifiers = parseSpaceUserIdentifiers(input.participantIdentifiers);
  const adminIdentifiers = parseSpaceUserIdentifiers(input.adminIdentifiers);

  if (!spaceName) {
    throw new Error('Space name is required.');
  }

  if (isReservedTestSpaceName(spaceName)) {
    throw new Error(
      'TEST is reserved for the existing KeepCozy sandbox. Use a different name for a new messenger space.',
    );
  }

  if (participantIdentifiers.invalid.length > 0) {
    throw new Error(
      `Initial participants must be entered as one email or user ID per line. Invalid: ${participantIdentifiers.invalid.join(', ')}`,
    );
  }

  if (adminIdentifiers.invalid.length > 0) {
    throw new Error(
      `Initial space admins must be entered as one email or user ID per line. Invalid: ${adminIdentifiers.invalid.join(', ')}`,
    );
  }

  if (adminIdentifiers.valid.length === 0) {
    throw new Error('At least one initial space admin is required.');
  }

  const allIdentifiers = [
    ...participantIdentifiers.valid,
    ...adminIdentifiers.valid,
  ];
  const { resolvedByIdentifier, unresolvedIdentifiers } = await resolveProvisionUsers(
    allIdentifiers,
    serviceClient,
  );

  if (unresolvedIdentifiers.length > 0) {
    throw new Error(
      `Unable to find these people yet: ${unresolvedIdentifiers.join(', ')}.`,
    );
  }

  const createdSpace = await insertSpaceRow({
    createdBy: viewer.id,
    name: spaceName,
    profile,
    theme: 'dark',
    serviceClient,
  });

  try {
    const membershipRows = buildInitialMembershipRows({
      adminIdentifiers: adminIdentifiers.valid,
      participantIdentifiers: participantIdentifiers.valid,
      resolvedByIdentifier,
      spaceId: createdSpace.id,
    });

    const membershipInsert = await serviceClient
      .from('space_members')
      .insert(membershipRows.rows);

    if (membershipInsert.error) {
      throw new Error(membershipInsert.error.message);
    }

    const creatorIsMember = membershipRows.rows.some((row) => row.user_id === viewer.id);

    return {
      creatorIsMember,
      defaultShellRoute: getDefaultShellRouteForSpaceProfile(profile),
      profile,
      profilePersisted: createdSpace.profilePersisted,
      spaceId: createdSpace.id,
      spaceName: createdSpace.name,
    };
  } catch (error) {
    await serviceClient.from('spaces').delete().eq('id', createdSpace.id);
    throw error;
  }
}

export async function addMembersToGovernedSpace(input: {
  adminIdentifiers: string;
  participantIdentifiers: string;
  spaceId: string;
}) {
  const viewer = await requireRequestViewer('spaces:manage-members');
  const exactSpaceAccess = await requireSpaceMemberManagementForUser({
    requestedSpaceId: input.spaceId,
    source: 'spaces:manage-members',
    userEmail: viewer.email ?? null,
    userId: viewer.id,
  });
  const serviceClient = await requireServiceRoleClient();
  const participantIdentifiers = parseSpaceUserIdentifiers(input.participantIdentifiers);
  const adminIdentifiers = parseSpaceUserIdentifiers(input.adminIdentifiers);

  if (participantIdentifiers.invalid.length > 0) {
    throw new Error(
      `Space members must be entered as one email or user ID per line. Invalid: ${participantIdentifiers.invalid.join(', ')}`,
    );
  }

  if (adminIdentifiers.invalid.length > 0) {
    throw new Error(
      `Space admins must be entered as one email or user ID per line. Invalid: ${adminIdentifiers.invalid.join(', ')}`,
    );
  }

  if (
    participantIdentifiers.valid.length === 0 &&
    adminIdentifiers.valid.length === 0
  ) {
    throw new Error('Add at least one member or admin.');
  }

  const allIdentifiers = [
    ...participantIdentifiers.valid,
    ...adminIdentifiers.valid,
  ];
  const { resolvedByIdentifier, unresolvedIdentifiers } = await resolveProvisionUsers(
    allIdentifiers,
    serviceClient,
  );

  if (unresolvedIdentifiers.length > 0) {
    throw new Error(
      `Unable to find these people yet: ${unresolvedIdentifiers.join(', ')}.`,
    );
  }

  const orderedUsers = buildResolvedUserOrder({
    adminIdentifiers: adminIdentifiers.valid,
    participantIdentifiers: participantIdentifiers.valid,
    resolvedByIdentifier,
  });
  const adminUserIds = new Set<string>();

  for (const identifier of adminIdentifiers.valid) {
    const resolvedUser = resolvedByIdentifier.get(identifier.normalized);

    if (resolvedUser?.userId) {
      adminUserIds.add(resolvedUser.userId);
    }
  }

  const targetUserIds = Array.from(orderedUsers.keys());
  const { data: existingMemberships, error: existingMembershipsError } =
    targetUserIds.length > 0
      ? await serviceClient
          .from('space_members')
          .select('user_id, role')
          .eq('space_id', exactSpaceAccess.activeSpace.id)
          .in('user_id', targetUserIds)
      : { data: [], error: null };

  if (existingMembershipsError) {
    throw new Error(existingMembershipsError.message);
  }

  const existingByUserId = new Map(
    ((existingMemberships ?? []) as Array<{
      role: SpaceRole;
      user_id: string;
    }>).map((membership) => [membership.user_id, membership.role]),
  );
  const insertRows: Array<{
    role: SpaceRole;
    space_id: string;
    user_id: string;
  }> = [];
  const promoteToAdminUserIds: string[] = [];

  for (const resolvedUser of orderedUsers.values()) {
    const existingRole = existingByUserId.get(resolvedUser.userId) ?? null;

    if (!existingRole) {
      insertRows.push({
        role: adminUserIds.has(resolvedUser.userId) ? 'admin' : 'member',
        space_id: exactSpaceAccess.activeSpace.id,
        user_id: resolvedUser.userId,
      });
      continue;
    }

    if (existingRole === 'member' && adminUserIds.has(resolvedUser.userId)) {
      promoteToAdminUserIds.push(resolvedUser.userId);
    }
  }

  if (insertRows.length > 0) {
    const insertMemberships = await serviceClient
      .from('space_members')
      .insert(insertRows);

    if (insertMemberships.error) {
      throw new Error(insertMemberships.error.message);
    }
  }

  if (promoteToAdminUserIds.length > 0) {
    const promotionResults = await Promise.all(
      promoteToAdminUserIds.map((userId) =>
        serviceClient
          .from('space_members')
          .update({ role: 'admin' })
          .eq('space_id', exactSpaceAccess.activeSpace.id)
          .eq('user_id', userId),
      ),
    );

    const failedPromotion = promotionResults.find((result) => result.error);

    if (failedPromotion?.error) {
      throw new Error(failedPromotion.error.message);
    }
  }

  return {
    addedCount: insertRows.length,
    promotedCount: promoteToAdminUserIds.length,
    spaceId: exactSpaceAccess.activeSpace.id,
    spaceName: exactSpaceAccess.activeSpace.name,
  };
}

export async function updateGovernedSpaceTheme(input: {
  spaceId: string;
  theme: string;
}) {
  const viewer = await requireRequestViewer('spaces:update-theme');
  const exactSpaceAccess = await requireSpaceMemberManagementForUser({
    requestedSpaceId: input.spaceId,
    source: 'spaces:update-theme',
    userEmail: viewer.email ?? null,
    userId: viewer.id,
  });
  const serviceClient = await requireServiceRoleClient();
  const theme = normalizeSpaceTheme(input.theme) ?? 'dark';
  const response = await serviceClient
    .from('spaces')
    .update({
      theme,
      updated_at: new Date().toISOString(),
    })
    .eq('id', exactSpaceAccess.activeSpace.id);

  if (!response.error) {
    return {
      spaceId: exactSpaceAccess.activeSpace.id,
      theme,
    };
  }

  if (isMissingColumnErrorMessage(response.error.message, 'theme')) {
    throw new Error(
      'Space theme persistence requires public.spaces.theme. Apply /Users/danya/IOS - Apps/CHAT/docs/sql/2026-04-10-spaces-theme-column.sql.',
    );
  }

  throw new Error(response.error.message);
}

export async function removeMembersFromGovernedSpace(input: {
  selectedUserIds: string;
  spaceId: string;
}) {
  const viewer = await requireRequestViewer('spaces:remove-members');
  const exactSpaceAccess = await requireSpaceMemberManagementForUser({
    requestedSpaceId: input.spaceId,
    source: 'spaces:remove-members',
    userEmail: viewer.email ?? null,
    userId: viewer.id,
  });
  const serviceClient = await requireServiceRoleClient();
  const selectedUserIds = parseSelectedSpaceMemberUserIds(input.selectedUserIds);

  if (selectedUserIds.invalid.length > 0) {
    throw new Error(
      `Selected participants are invalid. Use the current-space list only: ${selectedUserIds.invalid.join(', ')}`,
    );
  }

  if (selectedUserIds.valid.length === 0) {
    throw new Error('Choose at least one participant to remove.');
  }

  const { data: targetMembershipRows, error: targetMembershipError } =
    await serviceClient
      .from('space_members')
      .select('user_id, role')
      .eq('space_id', exactSpaceAccess.activeSpace.id)
      .in('user_id', selectedUserIds.valid);

  if (targetMembershipError) {
    throw new Error(targetMembershipError.message);
  }

  const targetMemberships = (targetMembershipRows ?? []) as Array<{
    role: SpaceRole;
    user_id: string;
  }>;

  if (targetMemberships.length !== selectedUserIds.valid.length) {
    throw new Error('Those participants are no longer active in this space.');
  }

  if (targetMemberships.some((membership) => membership.user_id === viewer.id)) {
    throw new Error(
      'Remove your own account through a reviewed staff flow, not from Home.',
    );
  }

  if (targetMemberships.some((membership) => membership.role === 'owner')) {
    throw new Error('The current space owner cannot be removed here.');
  }

  const { data: allMembershipRows, error: allMembershipError } = await serviceClient
    .from('space_members')
    .select('user_id, role')
    .eq('space_id', exactSpaceAccess.activeSpace.id);

  if (allMembershipError) {
    throw new Error(allMembershipError.message);
  }

  const selectedUserIdSet = new Set(
    targetMemberships.map((membership) => membership.user_id),
  );
  const remainingAdminCount = ((allMembershipRows ?? []) as Array<{
    role: SpaceRole;
    user_id: string;
  }>).filter(
    (membership) =>
      !selectedUserIdSet.has(membership.user_id) &&
      (membership.role === 'owner' || membership.role === 'admin'),
  ).length;

  if (remainingAdminCount === 0) {
    throw new Error('Keep at least one space admin in this space.');
  }

  const removableUserIds = Array.from(selectedUserIdSet);
  const { error: removeError } = await serviceClient
    .from('space_members')
    .delete()
    .eq('space_id', exactSpaceAccess.activeSpace.id)
    .in('user_id', removableUserIds);

  if (removeError) {
    throw new Error(removeError.message);
  }

  console.info('[spaces-membership]', {
    action: 'remove-members',
    actingUserId: viewer.id,
    removedUserIds: removableUserIds,
    source: 'home-space-participants',
    spaceId: exactSpaceAccess.activeSpace.id,
  });

  return {
    removedCount: removableUserIds.length,
    spaceId: exactSpaceAccess.activeSpace.id,
  };
}

export async function promoteMembersToAdminInGovernedSpace(input: {
  selectedUserIds: string;
  spaceId: string;
}) {
  const viewer = await requireRequestViewer('spaces:promote-members');
  const exactSpaceAccess = await requireSpaceMemberManagementForUser({
    requestedSpaceId: input.spaceId,
    source: 'spaces:promote-members',
    userEmail: viewer.email ?? null,
    userId: viewer.id,
  });
  const serviceClient = await requireServiceRoleClient();
  const selectedUserIds = parseSelectedSpaceMemberUserIds(input.selectedUserIds);

  if (selectedUserIds.invalid.length > 0) {
    throw new Error(
      `Selected participants are invalid. Use the current-space list only: ${selectedUserIds.invalid.join(', ')}`,
    );
  }

  if (selectedUserIds.valid.length === 0) {
    throw new Error('Select at least one member to promote.');
  }

  const { data: targetMembershipRows, error: targetMembershipError } =
    await serviceClient
      .from('space_members')
      .select('user_id, role')
      .eq('space_id', exactSpaceAccess.activeSpace.id)
      .in('user_id', selectedUserIds.valid);

  if (targetMembershipError) {
    throw new Error(targetMembershipError.message);
  }

  const targetMemberships = (targetMembershipRows ?? []) as Array<{
    role: SpaceRole;
    user_id: string;
  }>;

  if (targetMemberships.length === 0) {
    throw new Error('Those participants are no longer active in this space.');
  }

  if (targetMemberships.some((membership) => membership.role !== 'member')) {
    throw new Error(
      'Select member accounts only. Owners and existing admins cannot be promoted here.',
    );
  }

  const { data: allMembershipRows, error: allMembershipError } = await serviceClient
    .from('space_members')
    .select('user_id, role')
    .eq('space_id', exactSpaceAccess.activeSpace.id);

  if (allMembershipError) {
    throw new Error(allMembershipError.message);
  }

  const memberships = (allMembershipRows ?? []) as Array<{
    role: SpaceRole;
    user_id: string;
  }>;
  const adminsUsed = memberships.filter(
    (membership) =>
      membership.role === 'owner' || membership.role === 'admin',
  ).length;
  const membersUsed = memberships.length;
  const storageUsedBytes = await getGovernedSpaceStorageUsageBytes({
    serviceClient,
    spaceId: exactSpaceAccess.activeSpace.id,
  });
  const plan = resolveCurrentHomeSpacePlanCode({
    adminsUsed,
    membersUsed,
    storageUsedBytes,
  });
  const adminSeatLimit = getHomeSpacePlanDefinition(plan).limits.admins;
  const remainingAdminSeats = Math.max(adminSeatLimit - adminsUsed, 0);

  if (remainingAdminSeats <= 0) {
    throw new Error(
      'Admin seats are full for this space. Remove an admin or upgrade the plan first.',
    );
  }

  if (targetMemberships.length > remainingAdminSeats) {
    throw new Error(
      'Selected members exceed the remaining admin seats for this space.',
    );
  }

  const promoteUserIds = targetMemberships.map((membership) => membership.user_id);
  const { error: promoteError } = await serviceClient
    .from('space_members')
    .update({ role: 'admin' })
    .eq('space_id', exactSpaceAccess.activeSpace.id)
    .in('user_id', promoteUserIds);

  if (promoteError) {
    throw new Error(promoteError.message);
  }

  console.info('[spaces-membership]', {
    action: 'promote-members',
    actingUserId: viewer.id,
    promotedUserIds: promoteUserIds,
    source: 'home-space-participants',
    spaceId: exactSpaceAccess.activeSpace.id,
  });

  return {
    adminSeatLimit,
    promotedCount: promoteUserIds.length,
    spaceId: exactSpaceAccess.activeSpace.id,
  };
}

export async function requestAdditionalAccountsForGovernedSpace(input: {
  spaceId: string;
}) {
  const viewer = await requireRequestViewer('spaces:request-accounts');
  const exactSpaceAccess = await requireSpaceMemberManagementForUser({
    requestedSpaceId: input.spaceId,
    source: 'spaces:request-accounts',
    userEmail: viewer.email ?? null,
    userId: viewer.id,
  });

  console.info('[spaces-membership]', {
    action: 'request-additional-accounts',
    actingUserEmail: viewer.email ?? null,
    actingUserId: viewer.id,
    requestedAt: new Date().toISOString(),
    source: 'home-space-participants',
    spaceId: exactSpaceAccess.activeSpace.id,
    spaceName: exactSpaceAccess.activeSpace.name,
  });

  return {
    spaceId: exactSpaceAccess.activeSpace.id,
    spaceName: exactSpaceAccess.activeSpace.name,
  };
}
