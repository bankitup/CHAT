import 'server-only';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { SpaceRecord, SpaceRole } from './model';

export type UserSpaceRecord = SpaceRecord & {
  role: SpaceRole;
};

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
  return (
    normalizedMessage.includes('column') &&
    normalizedMessage.includes(columnName.toLowerCase())
  );
}

export async function getUserSpaces(userId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: memberships, error: membershipError } = await supabase
    .from('space_members')
    .select('space_id, role, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (membershipError) {
    if (isMissingRelationErrorMessage(membershipError.message, 'space_members')) {
      throw createSpaceSchemaRequirementError(
        'Active space resolution requires public.space_members.',
      );
    }

    throw new Error(membershipError.message);
  }

  const membershipRows = (memberships ?? []) as Array<{
    space_id: string;
    role: SpaceRole;
    created_at?: string | null;
  }>;

  const spaceIds = Array.from(
    new Set(membershipRows.map((membership) => membership.space_id).filter(Boolean)),
  );

  if (spaceIds.length === 0) {
    return [] as UserSpaceRecord[];
  }

  const { data: spaces, error: spacesError } = await supabase
    .from('spaces')
    .select('id, name, created_by, created_at, updated_at')
    .in('id', spaceIds);

  if (spacesError) {
    if (isMissingRelationErrorMessage(spacesError.message, 'spaces')) {
      throw createSpaceSchemaRequirementError(
        'Active space resolution requires public.spaces.',
      );
    }

    if (isMissingColumnErrorMessage(spacesError.message, 'updated_at')) {
      throw createSpaceSchemaRequirementError(
        'Active space resolution requires public.spaces.updated_at.',
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
      updated_at: string | null;
    }>).map((space) => [
      space.id,
      {
        id: space.id,
        name: space.name,
        createdBy: space.created_by,
        createdAt: space.created_at,
        updatedAt: space.updated_at,
      } satisfies SpaceRecord,
    ]),
  );

  return membershipRows
    .map((membership) => {
      const space = spaceById.get(membership.space_id);

      if (!space) {
        return null;
      }

      return {
        ...space,
        role: membership.role,
      } satisfies UserSpaceRecord;
    })
    .filter(Boolean)
    .sort((left, right) => {
      const leftValue = left?.createdAt ?? '';
      const rightValue = right?.createdAt ?? '';

      if (leftValue !== rightValue) {
        return leftValue.localeCompare(rightValue);
      }

      return (left?.name ?? '').localeCompare(right?.name ?? '');
    }) as UserSpaceRecord[];
}

export async function resolveActiveSpaceForUser(input: {
  userId: string;
  requestedSpaceId?: string | null;
}) {
  const spaces = await getUserSpaces(input.userId);
  const requestedSpaceId = input.requestedSpaceId?.trim() || null;
  const requestedSpace =
    requestedSpaceId
      ? spaces.find((space) => space.id === requestedSpaceId) ?? null
      : null;
  const activeSpace = requestedSpace ?? spaces[0] ?? null;

  return {
    spaces,
    activeSpace,
    requestedSpaceId,
    requestedSpaceWasInvalid: Boolean(requestedSpaceId && !requestedSpace),
  };
}
