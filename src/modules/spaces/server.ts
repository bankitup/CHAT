import 'server-only';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { SpaceRecord, SpaceRole } from './model';

export type UserSpaceRecord = SpaceRecord & {
  role: SpaceRole;
};

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
  return (
    normalizedMessage.includes('column') &&
    normalizedMessage.includes(columnName.toLowerCase())
  );
}

export function isSpaceMembersSchemaCacheErrorMessage(message: string) {
  const normalizedMessage = message.toLowerCase();
  return (
    normalizedMessage.includes('space_members') &&
    (normalizedMessage.includes('schema cache') ||
      normalizedMessage.includes('could not find the table') ||
      normalizedMessage.includes('relation'))
  );
}

export async function getUserSpaces(userId: string) {
  const supabase = await createSupabaseServerClient();
  logSpacesDiagnostics('getUserSpaces:start');
  logSpacesDiagnostics('space_members:query-start', { queried: true });
  const { data: memberships, error: membershipError } = await supabase
    .from('space_members')
    .select('space_id, role, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (membershipError) {
    logSpacesDiagnostics('space_members:query-error', {
      queried: true,
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
    count: (memberships ?? []).length,
  });

  const membershipRows = (memberships ?? []) as Array<{
    space_id: string;
    role: SpaceRole;
    created_at?: string | null;
  }>;

  const spaceIds = Array.from(
    new Set(membershipRows.map((membership) => membership.space_id).filter(Boolean)),
  );

  if (spaceIds.length === 0) {
    logSpacesDiagnostics('getUserSpaces:done', { count: 0 });
    return [] as UserSpaceRecord[];
  }

  const { data: spaces, error: spacesError } = await supabase
    .from('spaces')
    .select('id, name, created_by, created_at, updated_at')
    .in('id', spaceIds);

  if (spacesError) {
    logSpacesDiagnostics('spaces:query-error', {
      message: spacesError.message,
    });
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

  const resolvedSpaces = membershipRows
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

  logSpacesDiagnostics('getUserSpaces:done', { count: resolvedSpaces.length });
  return resolvedSpaces;
}

export async function resolveActiveSpaceForUser(input: {
  userId: string;
  requestedSpaceId?: string | null;
  source?: string;
}) {
  logSpacesDiagnostics('resolveActiveSpaceForUser:start', {
    source: input.source ?? 'unknown',
    hasRequestedSpaceId: Boolean(input.requestedSpaceId?.trim()),
  });
  const spaces = await getUserSpaces(input.userId);
  const requestedSpaceId = input.requestedSpaceId?.trim() || null;
  const requestedSpace =
    requestedSpaceId
      ? spaces.find((space) => space.id === requestedSpaceId) ?? null
      : null;
  const activeSpace = requestedSpace ?? spaces[0] ?? null;

  logSpacesDiagnostics('resolveActiveSpaceForUser:done', {
    source: input.source ?? 'unknown',
    spaceCount: spaces.length,
    hasActiveSpace: Boolean(activeSpace),
    requestedSpaceWasInvalid: Boolean(requestedSpaceId && !requestedSpace),
  });

  return {
    spaces,
    activeSpace,
    requestedSpaceId,
    requestedSpaceWasInvalid: Boolean(requestedSpaceId && !requestedSpace),
  };
}
