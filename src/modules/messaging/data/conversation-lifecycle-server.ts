import 'server-only';

import {
  getRequestSupabaseServerClient,
  requireRequestViewer,
} from '@/lib/request-context/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service';
import { getConversationForUser } from './conversation-read-server';
import { isHiddenAtVisibilityRuntimeError } from './visibility';

type ConversationRecord = {
  id: string;
  kind: string | null;
  created_at?: string | null;
  last_message_at?: string | null;
};

class ExistingDmConversationConflictError extends Error {
  conversationId: string;

  constructor(conversationId: string) {
    super('Active direct chat already exists and must be resolved by the caller.');
    this.conversationId = conversationId;
  }
}

export function isExistingDmConversationConflictError(
  error: unknown,
): error is ExistingDmConversationConflictError {
  return (
    error instanceof Error &&
    'conversationId' in error &&
    typeof (error as { conversationId?: unknown }).conversationId === 'string'
  );
}

function createExistingDmConversationConflictError(conversationId: string) {
  return new ExistingDmConversationConflictError(conversationId);
}

function logConversationSchemaDiagnostics(
  stage: string,
  details?: Record<string, unknown>,
) {
  if (process.env.CHAT_DEBUG_SCHEMA !== '1') {
    return;
  }

  if (details) {
    console.info('[conversation-schema]', stage, details);
    return;
  }

  console.info('[conversation-schema]', stage);
}

function normalizeConversation(
  value: ConversationRecord | ConversationRecord[] | null,
) {
  if (!value) {
    return null;
  }

  return Array.isArray(value) ? value[0] ?? null : value;
}

function normalizeJoinedRecord<T>(value: T | T[] | null) {
  if (!value) {
    return null;
  }

  return Array.isArray(value) ? value[0] ?? null : value;
}

function isMissingColumnErrorMessage(message: string, columnName: string) {
  const normalizedMessage = message.toLowerCase();
  return (
    normalizedMessage.includes('column') &&
    normalizedMessage.includes(columnName.toLowerCase())
  );
}

function createSchemaRequirementError(details: string) {
  return new Error(
    `${details} Apply the documented Supabase changes in /Users/danya/IOS - Apps/CHAT/docs/schema-assumptions.md.`,
  );
}

function isMissingRelationErrorMessage(message: string, relationName: string) {
  const normalizedMessage = message.toLowerCase();
  return (
    normalizedMessage.includes('relation') &&
    normalizedMessage.includes(relationName.toLowerCase())
  );
}

export function isUniqueConstraintErrorMessage(
  message: string,
  constraintName?: string,
) {
  const normalizedMessage = message.toLowerCase();
  return (
    normalizedMessage.includes('duplicate key') ||
    normalizedMessage.includes('unique constraint') ||
    (constraintName
      ? normalizedMessage.includes(constraintName.toLowerCase())
      : false)
  );
}

function buildCanonicalDmConversationKey(leftUserId: string, rightUserId: string) {
  return [leftUserId, rightUserId].filter(Boolean).sort().join(':');
}

function buildSpaceScopedDmConversationKey(input: {
  leftUserId: string;
  rightUserId: string;
  spaceId?: string | null;
}) {
  const canonicalKey = buildCanonicalDmConversationKey(
    input.leftUserId,
    input.rightUserId,
  );
  const normalizedSpaceId = input.spaceId?.trim() || null;

  if (!canonicalKey || !normalizedSpaceId) {
    return canonicalKey;
  }

  return `${normalizedSpaceId}::${canonicalKey}`;
}

function buildDmConversationLookupKeys(input: {
  leftUserId: string;
  rightUserId: string;
  spaceId?: string | null;
}) {
  const canonicalKey = buildCanonicalDmConversationKey(
    input.leftUserId,
    input.rightUserId,
  );
  const spaceScopedKey = buildSpaceScopedDmConversationKey(input);

  return Array.from(
    new Set(
      [canonicalKey, spaceScopedKey]
        .map((value) => value?.trim())
        .filter(Boolean),
    ),
  );
}

async function findExistingDmConversationByKey(input: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  creatorUserId: string;
  otherUserId: string;
  spaceId?: string | null;
}) {
  const dmConversationKeys = buildDmConversationLookupKeys({
    leftUserId: input.creatorUserId,
    rightUserId: input.otherUserId,
    spaceId: input.spaceId ?? null,
  });

  if (dmConversationKeys.length === 0) {
    return null;
  }

  let directKeyLookup = input.supabase
    .from('conversations')
    .select(
      input.spaceId
        ? 'id, kind, dm_key, space_id, created_at, last_message_at'
        : 'id, kind, dm_key, created_at, last_message_at',
    )
    .eq('kind', 'dm')
    .in('dm_key', dmConversationKeys);

  if (input.spaceId) {
    directKeyLookup = directKeyLookup.eq('space_id', input.spaceId);
  }

  const { data, error } = await directKeyLookup
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: true })
    .limit(1);

  if (error) {
    if (
      isMissingColumnErrorMessage(error.message, 'dm_key') ||
      isMissingColumnErrorMessage(error.message, 'space_id')
    ) {
      return null;
    }

    throw new Error(error.message);
  }

  return ((data ?? []) as Array<{ id?: string | null }>)[0]?.id?.trim() || null;
}

type DmConversationLookupCandidate = {
  conversationId: string;
  createdAt: string | null;
  lastMessageAt: string | null;
};

async function selectCanonicalExactPairDmConversationId(input: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  candidateRows: Array<{
    conversation_id: string;
    conversations:
      | {
          id: string;
          kind: string | null;
          created_at?: string | null;
          last_message_at?: string | null;
        }
      | Array<{
          id: string;
          kind: string | null;
          created_at?: string | null;
          last_message_at?: string | null;
        }>
      | null;
  }>;
  expectedUserIds: string[];
}) {
  const candidateConversations = input.candidateRows
    .map((row) => {
      const conversation = normalizeConversation(row.conversations);

      if (!conversation || conversation.kind !== 'dm') {
        return null;
      }

      return {
        conversationId: row.conversation_id,
        createdAt: conversation.created_at ?? null,
        lastMessageAt: conversation.last_message_at ?? null,
      } satisfies DmConversationLookupCandidate;
    })
    .filter((row): row is DmConversationLookupCandidate => Boolean(row));

  if (candidateConversations.length === 0) {
    return null;
  }

  const { data: candidateMembers, error: candidateMembersError } =
    await input.supabase
      .from('conversation_members')
      .select('conversation_id, user_id')
      .in(
        'conversation_id',
        candidateConversations.map(
          (conversation) => conversation.conversationId,
        ),
      )
      .eq('state', 'active');

  if (candidateMembersError) {
    throw new Error(candidateMembersError.message);
  }

  const expectedUserIds = new Set(input.expectedUserIds);
  const memberIdsByConversation = new Map<string, Set<string>>();

  for (const row of (candidateMembers ?? []) as Array<{
    conversation_id: string;
    user_id: string;
  }>) {
    const memberIds =
      memberIdsByConversation.get(row.conversation_id) ?? new Set<string>();
    memberIds.add(row.user_id);
    memberIdsByConversation.set(row.conversation_id, memberIds);
  }

  const exactPairCandidates = candidateConversations.filter((conversation) => {
    const memberIds = memberIdsByConversation.get(conversation.conversationId);

    if (!memberIds || memberIds.size !== expectedUserIds.size) {
      return false;
    }

    for (const userId of expectedUserIds) {
      if (!memberIds.has(userId)) {
        return false;
      }
    }

    return true;
  });

  if (exactPairCandidates.length === 0) {
    return null;
  }

  exactPairCandidates.sort((left, right) => {
    const leftRank = left.lastMessageAt ?? left.createdAt ?? '';
    const rightRank = right.lastMessageAt ?? right.createdAt ?? '';

    if (leftRank !== rightRank) {
      return rightRank.localeCompare(leftRank);
    }

    const leftCreatedAt = left.createdAt ?? '';
    const rightCreatedAt = right.createdAt ?? '';

    if (leftCreatedAt !== rightCreatedAt) {
      return leftCreatedAt.localeCompare(rightCreatedAt);
    }

    return left.conversationId.localeCompare(right.conversationId);
  });

  return exactPairCandidates[0]?.conversationId ?? null;
}

function dedupeParticipantIds(ids: string[]) {
  return Array.from(new Set(ids.map((value) => value.trim()).filter(Boolean)));
}

export async function getExistingActiveDmPartnerUserIds(
  currentUserId: string,
  options?: {
    spaceId?: string | null;
  },
) {
  const supabase = await createSupabaseServerClient();
  let activeDmMembershipQuery = supabase
    .from('conversation_members')
    .select(
      options?.spaceId
        ? 'conversation_id, conversations!inner(id, kind, space_id)'
        : 'conversation_id, conversations!inner(id, kind)',
    )
    .eq('user_id', currentUserId)
    .eq('state', 'active')
    .eq('conversations.kind', 'dm');

  if (options?.spaceId) {
    activeDmMembershipQuery = activeDmMembershipQuery.eq(
      'conversations.space_id',
      options.spaceId,
    );
  }

  const { data: activeDmMemberships, error: activeDmMembershipsError } =
    await activeDmMembershipQuery;

  if (activeDmMembershipsError) {
    throw new Error(activeDmMembershipsError.message);
  }

  const conversationIds = ((activeDmMemberships ?? []) as Array<{
    conversation_id: string;
  }>)
    .map((row) => row.conversation_id)
    .filter(Boolean);

  if (conversationIds.length === 0) {
    return [] as string[];
  }

  const { data: partnerMemberships, error: partnerMembershipsError } =
    await supabase
      .from('conversation_members')
      .select('conversation_id, user_id')
      .in('conversation_id', conversationIds)
      .eq('state', 'active')
      .neq('user_id', currentUserId);

  if (partnerMembershipsError) {
    throw new Error(partnerMembershipsError.message);
  }

  return Array.from(
    new Set(
      ((partnerMemberships ?? []) as Array<{ user_id: string }>).map(
        (row) => row.user_id,
      ),
    ),
  );
}

export async function getExistingActiveDmPartnerUserIdsForCandidates(
  currentUserId: string,
  candidateUserIds: string[],
  options?: {
    spaceId?: string | null;
  },
) {
  const uniqueCandidateUserIds = Array.from(
    new Set(
      candidateUserIds
        .map((value) => value.trim())
        .filter((value) => value && value !== currentUserId),
    ),
  );

  if (uniqueCandidateUserIds.length === 0) {
    return [] as string[];
  }

  const supabase = await createSupabaseServerClient();
  const lookupKeysByCandidateUserId = new Map(
    uniqueCandidateUserIds.map((candidateUserId) => [
      candidateUserId,
      buildDmConversationLookupKeys({
        leftUserId: currentUserId,
        rightUserId: candidateUserId,
        spaceId: options?.spaceId ?? null,
      }),
    ]),
  );
  const dmConversationKeys = Array.from(
    new Set(
      Array.from(lookupKeysByCandidateUserId.values()).flatMap((keys) => keys),
    ),
  );

  if (dmConversationKeys.length === 0) {
    return [] as string[];
  }

  let keyedLookupQuery = supabase
    .from('conversations')
    .select(
      options?.spaceId
        ? 'id, kind, dm_key, space_id, created_at, last_message_at'
        : 'id, kind, dm_key, created_at, last_message_at',
    )
    .eq('kind', 'dm')
    .in('dm_key', dmConversationKeys);

  if (options?.spaceId) {
    keyedLookupQuery = keyedLookupQuery.eq('space_id', options.spaceId);
  }

  const { data: keyedRows, error: keyedLookupError } = await keyedLookupQuery;

  if (keyedLookupError) {
    if (
      isMissingColumnErrorMessage(keyedLookupError.message, 'dm_key') ||
      isMissingColumnErrorMessage(keyedLookupError.message, 'space_id')
    ) {
      const existingPartnerUserIds = await getExistingActiveDmPartnerUserIds(
        currentUserId,
        options,
      );

      return uniqueCandidateUserIds.filter((candidateUserId) =>
        existingPartnerUserIds.includes(candidateUserId),
      );
    }

    throw new Error(keyedLookupError.message);
  }

  const candidateConversationRows = ((keyedRows ?? []) as unknown as Array<{
    id: string;
    dm_key?: string | null;
    created_at?: string | null;
    last_message_at?: string | null;
  }>).map((row) => ({
    conversationId: row.id,
    conversationKey: row.dm_key?.trim() || null,
    createdAt: row.created_at ?? null,
    lastMessageAt: row.last_message_at ?? null,
  }));

  if (candidateConversationRows.length === 0) {
    return [] as string[];
  }

  const { data: candidateMembers, error: candidateMembersError } =
    await supabase
      .from('conversation_members')
      .select('conversation_id, user_id')
      .in(
        'conversation_id',
        candidateConversationRows.map(
          (conversation) => conversation.conversationId,
        ),
      )
      .eq('state', 'active');

  if (candidateMembersError) {
    throw new Error(candidateMembersError.message);
  }

  const memberIdsByConversation = new Map<string, Set<string>>();

  for (const row of (candidateMembers ?? []) as Array<{
    conversation_id: string;
    user_id: string;
  }>) {
    const memberIds =
      memberIdsByConversation.get(row.conversation_id) ?? new Set<string>();
    memberIds.add(row.user_id);
    memberIdsByConversation.set(row.conversation_id, memberIds);
  }

  const existingPartnerUserIds = new Set<string>();

  for (const candidateUserId of uniqueCandidateUserIds) {
    const expectedConversationKeys = new Set(
      lookupKeysByCandidateUserId.get(candidateUserId) ?? [],
    );
    const matchingConversations = candidateConversationRows
      .filter((conversation) =>
        conversation.conversationKey
          ? expectedConversationKeys.has(conversation.conversationKey)
          : false,
      )
      .filter((conversation) => {
        const memberIds = memberIdsByConversation.get(conversation.conversationId);

        if (!memberIds || memberIds.size !== 2) {
          return false;
        }

        return memberIds.has(currentUserId) && memberIds.has(candidateUserId);
      });

    if (matchingConversations.length > 0) {
      existingPartnerUserIds.add(candidateUserId);
    }
  }

  return Array.from(existingPartnerUserIds);
}

export async function findExistingActiveDmConversation(
  creatorUserId: string,
  otherUserId: string,
  options?: {
    spaceId?: string | null;
  },
) {
  const supabase = await createSupabaseServerClient();
  const dmConversationKeys = buildDmConversationLookupKeys({
    leftUserId: creatorUserId,
    rightUserId: otherUserId,
    spaceId: options?.spaceId ?? null,
  });
  let keyedLookupQuery = supabase
    .from('conversation_members')
    .select(
      options?.spaceId
        ? 'conversation_id, conversations!inner(id, kind, dm_key, space_id, created_at, last_message_at)'
        : 'conversation_id, conversations!inner(id, kind, dm_key, created_at, last_message_at)',
    )
    .eq('user_id', creatorUserId)
    .eq('state', 'active')
    .eq('conversations.kind', 'dm')
    .in('conversations.dm_key', dmConversationKeys);

  if (options?.spaceId) {
    keyedLookupQuery = keyedLookupQuery.eq(
      'conversations.space_id',
      options.spaceId,
    );
  }

  const { data: keyedMemberships, error: keyedLookupError } =
    await keyedLookupQuery;

  if (keyedLookupError) {
    if (
      !isMissingColumnErrorMessage(keyedLookupError.message, 'dm_key') &&
      !isMissingColumnErrorMessage(keyedLookupError.message, 'space_id')
    ) {
      throw new Error(keyedLookupError.message);
    }
  } else {
    const keyedMatch = await selectCanonicalExactPairDmConversationId({
      supabase,
      candidateRows: (keyedMemberships ?? []) as Array<{
        conversation_id: string;
        conversations:
          | {
              id: string;
              kind: string | null;
              dm_key?: string | null;
              space_id?: string | null;
              created_at?: string | null;
              last_message_at?: string | null;
            }
          | Array<{
              id: string;
              kind: string | null;
              dm_key?: string | null;
              space_id?: string | null;
              created_at?: string | null;
              last_message_at?: string | null;
            }>
          | null;
      }>,
      expectedUserIds: [creatorUserId, otherUserId],
    });

    if (keyedMatch) {
      return keyedMatch;
    }

    const directKeyMatch = await findExistingDmConversationByKey({
      supabase,
      creatorUserId,
      otherUserId,
      spaceId: options?.spaceId ?? null,
    });

    if (directKeyMatch) {
      return directKeyMatch;
    }
  }

  const { data: creatorMemberships, error: creatorError } = await supabase
    .from('conversation_members')
    .select('conversation_id')
    .eq('user_id', creatorUserId)
    .eq('state', 'active');

  if (creatorError) {
    throw new Error(creatorError.message);
  }

  const conversationIds = (creatorMemberships ?? []).map(
    (row) => row.conversation_id as string,
  );

  if (conversationIds.length === 0) {
    return null;
  }

  let otherMembershipQuery = supabase
    .from('conversation_members')
    .select(
      options?.spaceId
        ? 'conversation_id, conversations!inner(id, kind, space_id, created_at, last_message_at)'
        : 'conversation_id, conversations!inner(id, kind, created_at, last_message_at)',
    )
    .eq('user_id', otherUserId)
    .eq('state', 'active')
    .in('conversation_id', conversationIds)
    .eq('conversations.kind', 'dm');

  if (options?.spaceId) {
    otherMembershipQuery = otherMembershipQuery.eq(
      'conversations.space_id',
      options.spaceId,
    );
  }

  const { data: otherMemberships, error: otherError } = await otherMembershipQuery;

  if (otherError) {
    if (
      options?.spaceId &&
      isMissingColumnErrorMessage(otherError.message, 'space_id')
    ) {
      logConversationSchemaDiagnostics(
        'findExistingActiveDmConversation:throw-space-id-required',
        {
          actualFailingColumn: isMissingColumnErrorMessage(
            otherError.message,
            'avatar_path',
          )
            ? 'avatar_path'
            : isMissingColumnErrorMessage(otherError.message, 'space_id')
              ? 'space_id'
              : 'unknown',
          helper: 'findExistingActiveDmConversation',
          message: otherError.message,
          requestedSpaceId: options.spaceId,
          schemaCheckAvatarPathMissing: isMissingColumnErrorMessage(
            otherError.message,
            'avatar_path',
          ),
          schemaCheckSpaceIdMissing: isMissingColumnErrorMessage(
            otherError.message,
            'space_id',
          ),
        },
      );
      throw createSchemaRequirementError(
        'Space-scoped DM lookup requires public.conversations.space_id.',
      );
    }

    throw new Error(otherError.message);
  }

  const exactMembershipMatch = await selectCanonicalExactPairDmConversationId({
    supabase,
    candidateRows: (otherMemberships ?? []) as Array<{
      conversation_id: string;
      conversations:
        | {
            id: string;
            kind: string | null;
            space_id?: string | null;
            created_at?: string | null;
            last_message_at?: string | null;
          }
        | Array<{
            id: string;
            kind: string | null;
            space_id?: string | null;
            created_at?: string | null;
            last_message_at?: string | null;
          }>
        | null;
    }>,
    expectedUserIds: [creatorUserId, otherUserId],
  });

  if (exactMembershipMatch) {
    return exactMembershipMatch;
  }

  return findExistingDmConversationByKey({
    supabase,
    creatorUserId,
    otherUserId,
    spaceId: options?.spaceId ?? null,
  });
}

export async function createConversationWithMembers(
  input: {
    kind: 'dm' | 'group';
    creatorUserId: string;
    participantUserIds: string[];
    title?: string | null;
    spaceId?: string | null;
  },
  options?: {
    existingDmBehavior?: 'reuse-existing' | 'throw-conflict';
  },
) {
  const supabase = await getRequestSupabaseServerClient();
  const conversationId = crypto.randomUUID();
  const normalizedSpaceId = input.spaceId?.trim() || null;
  const existingDmBehavior = options?.existingDmBehavior ?? 'reuse-existing';

  if (!input.creatorUserId) {
    throw new Error('Authenticated user is required to create a conversation.');
  }

  if (!normalizedSpaceId) {
    throw new Error('Active space is required to create a conversation.');
  }

  const user = await requireRequestViewer('Conversation creation debug');

  if (!user) {
    throw new Error(
      'Conversation creation debug: no authenticated user found in the server action client.',
    );
  }

  if (!user.id) {
    throw new Error(
      'Conversation creation debug: authenticated user is present but user.id is missing.',
    );
  }

  const participantUserIds = dedupeParticipantIds(input.participantUserIds).filter(
    (userId) => userId !== input.creatorUserId,
  );

  if (participantUserIds.length === 0) {
    throw new Error('At least one participant is required.');
  }

  if (input.kind === 'dm' && participantUserIds.length !== 1) {
    throw new Error(
      'Direct-message creation requires exactly one other participant.',
    );
  }

  if (input.kind === 'dm') {
    const existingConversationId = await findExistingActiveDmConversation(
      input.creatorUserId,
      participantUserIds[0] ?? '',
      {
        spaceId: normalizedSpaceId,
      },
    );

    if (existingConversationId) {
      if (existingDmBehavior === 'throw-conflict') {
        throw createExistingDmConversationConflictError(existingConversationId);
      }
      return existingConversationId;
    }
  }

  const canonicalDmConversationKey =
    input.kind === 'dm'
      ? buildCanonicalDmConversationKey(
          input.creatorUserId,
          participantUserIds[0] ?? '',
        )
      : null;
  const spaceScopedDmConversationKey =
    input.kind === 'dm'
      ? buildSpaceScopedDmConversationKey({
          leftUserId: input.creatorUserId,
          rightUserId: participantUserIds[0] ?? '',
          spaceId: normalizedSpaceId,
        })
      : null;

  const conversationPayloadBase =
    input.kind === 'group'
      ? {
          id: conversationId,
          created_by: input.creatorUserId,
          kind: 'group',
          title: input.title?.trim() || null,
        }
      : {
          id: conversationId,
          created_by: input.creatorUserId,
          kind: 'dm',
          title: null,
        };

  const conversationPayload =
    input.kind === 'dm'
      ? {
          ...conversationPayloadBase,
          space_id: normalizedSpaceId,
          dm_key: canonicalDmConversationKey,
        }
      : {
          ...conversationPayloadBase,
          space_id: normalizedSpaceId,
        };

  const conversationPayloadWithScopedDmKey =
    input.kind === 'dm' && spaceScopedDmConversationKey
      ? {
          ...conversationPayloadBase,
          space_id: normalizedSpaceId,
          dm_key: spaceScopedDmConversationKey,
        }
      : null;

  const conversationPayloadWithoutDmKey = {
    ...conversationPayloadBase,
    space_id: normalizedSpaceId,
  };

  if (conversationPayload.created_by !== input.creatorUserId) {
    throw new Error('Conversation created_by must match the authenticated user.');
  }

  if (conversationPayload.created_by !== user.id) {
    throw new Error(
      `Conversation creation debug: created_by mismatch. auth user id=${user.id}, payload created_by=${conversationPayload.created_by}.`,
    );
  }

  let conversationError: { message: string } | null = null;
  const { error: initialConversationError } = await supabase
    .from('conversations')
    .insert(conversationPayload);
  conversationError = initialConversationError;

  if (
    conversationError &&
    input.kind === 'dm' &&
    isMissingColumnErrorMessage(conversationError.message, 'dm_key')
  ) {
    const { error: fallbackConversationError } = await supabase
      .from('conversations')
      .insert(conversationPayloadWithoutDmKey);
    conversationError = fallbackConversationError;
  }

  if (conversationError) {
    if (
      input.kind === 'dm' &&
      isUniqueConstraintErrorMessage(conversationError.message, 'dm_key')
    ) {
      const existingConversationId = await findExistingActiveDmConversation(
        input.creatorUserId,
        participantUserIds[0] ?? '',
        {
          spaceId: normalizedSpaceId,
        },
      );

      if (existingConversationId) {
        if (existingDmBehavior === 'throw-conflict') {
          throw createExistingDmConversationConflictError(existingConversationId);
        }
        return existingConversationId;
      }

      if (
        conversationPayloadWithScopedDmKey &&
        conversationPayloadWithScopedDmKey.dm_key !== canonicalDmConversationKey
      ) {
        const { error: scopedConversationError } = await supabase
          .from('conversations')
          .insert(conversationPayloadWithScopedDmKey);

        if (!scopedConversationError) {
          conversationError = null;
        } else if (
          isUniqueConstraintErrorMessage(scopedConversationError.message, 'dm_key')
        ) {
          const scopedExistingConversationId =
            await findExistingActiveDmConversation(
              input.creatorUserId,
              participantUserIds[0] ?? '',
              {
                spaceId: normalizedSpaceId,
              },
            );

          if (scopedExistingConversationId) {
            if (existingDmBehavior === 'throw-conflict') {
              throw createExistingDmConversationConflictError(
                scopedExistingConversationId,
              );
            }
            return scopedExistingConversationId;
          }

          conversationError = scopedConversationError;
        } else {
          conversationError = scopedConversationError;
        }
      }
    }

    if (conversationError?.message.includes('row-level security policy')) {
      throw new Error(
        `Conversation creation debug: insert blocked by conversations RLS. auth user id=${user.id}, payload created_by=${conversationPayload.created_by}. Values match, so the failure is likely in database policy state or auth context rather than payload construction.`,
      );
    }

    throw new Error(
      conversationError?.message ?? 'Unable to create conversation right now.',
    );
  }

  const membershipRows =
    input.kind === 'dm'
      ? [
          {
            conversation_id: conversationId,
            user_id: input.creatorUserId,
            role: 'member',
            state: 'active',
          },
          ...participantUserIds.map((userId) => ({
            conversation_id: conversationId,
            user_id: userId,
            role: 'member',
            state: 'active',
          })),
        ]
      : [
          {
            conversation_id: conversationId,
            user_id: input.creatorUserId,
            role: 'owner',
            state: 'active',
          },
          ...participantUserIds.map((userId) => ({
            conversation_id: conversationId,
            user_id: userId,
            role: 'member',
            state: 'active',
          })),
        ];

  const { error: membershipError } = await supabase
    .from('conversation_members')
    .insert(membershipRows);

  if (membershipError) {
    await supabase.from('conversations').delete().eq('id', conversationId);
    throw new Error(membershipError.message);
  }

  return conversationId;
}

export async function assertConversationMembership(
  conversationId: string,
  userId: string,
) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('conversation_members')
    .select('conversation_id')
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
    .eq('state', 'active')
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data);
}

export async function markConversationRead(input: {
  conversationId: string;
  userId: string;
  lastReadMessageSeq: number;
}) {
  const supabase = await getRequestSupabaseServerClient();

  if (!input.userId) {
    throw new Error('Read state debug: authenticated user is required.');
  }

  if (
    !Number.isFinite(input.lastReadMessageSeq) ||
    input.lastReadMessageSeq < 0
  ) {
    throw new Error('Read state debug: invalid last read message sequence.');
  }

  const user = await requireRequestViewer('Read state debug');

  if (!user?.id) {
    throw new Error('Read state debug: no authenticated user found.');
  }

  if (user.id !== input.userId) {
    throw new Error(
      `Read state debug: user mismatch. auth user id=${user.id}, payload user id=${input.userId}.`,
    );
  }

  const { data: membershipRow, error: membershipError } = await supabase
    .from('conversation_members')
    .select('last_read_message_seq')
    .eq('conversation_id', input.conversationId)
    .eq('user_id', input.userId)
    .eq('state', 'active')
    .maybeSingle();

  if (membershipError) {
    if (isHiddenAtVisibilityRuntimeError(membershipError.message)) {
      throw createSchemaRequirementError(
        'Inbox archive/hide requires public.conversation_members.hidden_at.',
      );
    }

    throw new Error(membershipError.message);
  }

  if (!membershipRow) {
    throw new Error(
      'Read state debug: authenticated user is not an active member of this conversation.',
    );
  }

  const currentReadSeq =
    typeof membershipRow.last_read_message_seq === 'number'
      ? membershipRow.last_read_message_seq
      : null;

  const { data: latestMessageRow, error: latestMessageError } = await supabase
    .from('messages')
    .select('seq')
    .eq('conversation_id', input.conversationId)
    .order('seq', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestMessageError) {
    throw new Error(latestMessageError.message);
  }

  const latestMessageSeq =
    typeof latestMessageRow?.seq === 'number'
      ? latestMessageRow.seq
      : typeof latestMessageRow?.seq === 'string'
        ? Number(latestMessageRow.seq)
        : null;

  if (latestMessageSeq === null || !Number.isFinite(latestMessageSeq)) {
    return {
      updated: false,
      lastReadMessageSeq: currentReadSeq,
    };
  }

  const nextReadSeq = Math.min(input.lastReadMessageSeq, latestMessageSeq);

  if (currentReadSeq !== null && currentReadSeq >= nextReadSeq) {
    return {
      updated: false,
      lastReadMessageSeq: currentReadSeq,
    };
  }

  const { error: updateError } = await supabase
    .from('conversation_members')
    .update({
      last_read_message_seq: nextReadSeq,
      last_read_at: new Date().toISOString(),
    })
    .eq('conversation_id', input.conversationId)
    .eq('user_id', input.userId)
    .eq('state', 'active');

  if (updateError) {
    if (updateError.message.includes('row-level security policy')) {
      throw new Error('Read state debug: update blocked by conversation_members RLS.');
    }

    throw new Error(updateError.message);
  }

  return {
    updated: true,
    lastReadMessageSeq: nextReadSeq,
  };
}

export async function hideConversationForUser(input: {
  conversationId: string;
  userId: string;
}) {
  const supabase = await getRequestSupabaseServerClient();

  if (!input.userId) {
    throw new Error('Conversation archive debug: authenticated user is required.');
  }

  const user = await requireRequestViewer('Conversation archive debug');

  if (!user?.id) {
    throw new Error('Conversation archive debug: no authenticated user found.');
  }

  if (user.id !== input.userId) {
    throw new Error(
      `Conversation archive debug: user mismatch. auth user id=${user.id}, payload user id=${input.userId}.`,
    );
  }

  const { data: membershipRow, error: membershipError } = await supabase
    .from('conversation_members')
    .select('hidden_at')
    .eq('conversation_id', input.conversationId)
    .eq('user_id', input.userId)
    .eq('state', 'active')
    .maybeSingle();

  if (membershipError) {
    if (isHiddenAtVisibilityRuntimeError(membershipError.message)) {
      throw createSchemaRequirementError(
        'Inbox archive/hide requires public.conversation_members.hidden_at.',
      );
    }

    throw new Error(membershipError.message);
  }

  if (!membershipRow) {
    throw new Error('Only an active participant can hide this chat.');
  }

  if (membershipRow.hidden_at) {
    return { updated: false };
  }

  const { error: updateError } = await supabase
    .from('conversation_members')
    .update({ hidden_at: new Date().toISOString() })
    .eq('conversation_id', input.conversationId)
    .eq('user_id', input.userId)
    .eq('state', 'active');

  if (updateError) {
    if (isHiddenAtVisibilityRuntimeError(updateError.message)) {
      throw createSchemaRequirementError(
        'Inbox archive/hide requires public.conversation_members.hidden_at.',
      );
    }

    if (updateError.message.includes('row-level security policy')) {
      throw new Error(
        'Conversation archive debug: update blocked by conversation_members RLS.',
      );
    }

    throw new Error(updateError.message);
  }

  return { updated: true };
}

export async function deleteDirectConversationForUser(input: {
  conversationId: string;
  userId: string;
}) {
  if (!input.userId) {
    throw new Error('Direct chat delete requires an authenticated user.');
  }

  const user = await requireRequestViewer('Direct chat delete debug');

  if (!user?.id) {
    throw new Error('Direct chat delete debug: no authenticated user found.');
  }

  if (user.id !== input.userId) {
    throw new Error(
      `Direct chat delete debug: user mismatch. auth user id=${user.id}, payload user id=${input.userId}.`,
    );
  }

  const conversation = await getConversationForUser(
    input.conversationId,
    input.userId,
  );

  if (!conversation) {
    throw new Error('This direct chat is no longer available.');
  }

  if (conversation.kind !== 'dm') {
    throw new Error('Delete chat is currently available for direct chats only.');
  }

  const serviceSupabase = createSupabaseServiceRoleClient();

  if (!serviceSupabase) {
    throw new Error('Delete chat requires server-side service access.');
  }

  const { data: messageRows, error: messageRowsError } = await serviceSupabase
    .from('messages')
    .select('id')
    .eq('conversation_id', input.conversationId);

  if (messageRowsError) {
    throw new Error(messageRowsError.message);
  }

  const messageIds = ((messageRows ?? []) as Array<{ id: string }>).map(
    (row) => row.id,
  );

  if (messageIds.length > 0) {
    const { error: reactionsError } = await serviceSupabase
      .from('message_reactions')
      .delete()
      .in('message_id', messageIds);

    if (
      reactionsError &&
      !isMissingRelationErrorMessage(reactionsError.message, 'message_reactions')
    ) {
      throw new Error(reactionsError.message);
    }

    const { data: attachmentRows, error: attachmentRowsError } =
      await serviceSupabase
        .from('message_attachments')
        .select('bucket, object_path')
        .in('message_id', messageIds);

    if (
      attachmentRowsError &&
      !isMissingRelationErrorMessage(
        attachmentRowsError.message,
        'message_attachments',
      )
    ) {
      throw new Error(attachmentRowsError.message);
    }

    const { data: assetLinkRows, error: assetLinkRowsError } =
      await serviceSupabase
        .from('message_asset_links')
        .select(
          'message_id, message_assets!inner(id, source, storage_bucket, storage_object_path)',
        )
        .in('message_id', messageIds);

    if (
      assetLinkRowsError &&
      !isMissingRelationErrorMessage(
        assetLinkRowsError.message,
        'message_asset_links',
      ) &&
      !isMissingRelationErrorMessage(assetLinkRowsError.message, 'message_assets')
    ) {
      throw new Error(assetLinkRowsError.message);
    }

    const assetIds = Array.from(
      new Set(
        ((assetLinkRows ?? []) as Array<{
          message_assets:
            | {
                id: string;
                source: 'supabase-storage' | 'external-url';
                storage_bucket?: string | null;
                storage_object_path?: string | null;
              }
            | Array<{
                id: string;
                source: 'supabase-storage' | 'external-url';
                storage_bucket?: string | null;
                storage_object_path?: string | null;
              }>
            | null;
        }>)
          .map((row) => normalizeJoinedRecord(row.message_assets)?.id?.trim() || '')
          .filter(Boolean),
      ),
    );

    const { error: attachmentsError } = await serviceSupabase
      .from('message_attachments')
      .delete()
      .in('message_id', messageIds);

    if (
      attachmentsError &&
      !isMissingRelationErrorMessage(attachmentsError.message, 'message_attachments')
    ) {
      throw new Error(attachmentsError.message);
    }

    const { error: envelopesError } = await serviceSupabase
      .from('message_e2ee_envelopes')
      .delete()
      .in('message_id', messageIds);

    if (
      envelopesError &&
      !isMissingRelationErrorMessage(
        envelopesError.message,
        'message_e2ee_envelopes',
      )
    ) {
      throw new Error(envelopesError.message);
    }

    const { error: assetLinksDeleteError } = await serviceSupabase
      .from('message_asset_links')
      .delete()
      .in('message_id', messageIds);

    if (
      assetLinksDeleteError &&
      !isMissingRelationErrorMessage(
        assetLinksDeleteError.message,
        'message_asset_links',
      )
    ) {
      throw new Error(assetLinksDeleteError.message);
    }

    const { error: messagesError } = await serviceSupabase
      .from('messages')
      .delete()
      .eq('conversation_id', input.conversationId);

    if (messagesError) {
      throw new Error(messagesError.message);
    }

    const storageObjectsByBucket = new Map<string, string[]>();

    for (const row of (attachmentRows ?? []) as Array<{
      bucket: string | null;
      object_path: string | null;
    }>) {
      const bucket = row.bucket?.trim();
      const objectPath = row.object_path?.trim();

      if (!bucket || !objectPath) {
        continue;
      }

      const existing = storageObjectsByBucket.get(bucket) ?? [];
      existing.push(objectPath);
      storageObjectsByBucket.set(bucket, existing);
    }

    for (const row of (assetLinkRows ?? []) as Array<{
      message_assets:
        | {
            id: string;
            source: 'supabase-storage' | 'external-url';
            storage_bucket?: string | null;
            storage_object_path?: string | null;
          }
        | Array<{
            id: string;
            source: 'supabase-storage' | 'external-url';
            storage_bucket?: string | null;
            storage_object_path?: string | null;
          }>
        | null;
    }>) {
      const asset = normalizeJoinedRecord(row.message_assets);

      if (
        !asset ||
        asset.source !== 'supabase-storage' ||
        !asset.storage_bucket?.trim() ||
        !asset.storage_object_path?.trim()
      ) {
        continue;
      }

      const existing =
        storageObjectsByBucket.get(asset.storage_bucket.trim()) ?? [];
      existing.push(asset.storage_object_path.trim());
      storageObjectsByBucket.set(asset.storage_bucket.trim(), existing);
    }

    for (const [bucket, objectPaths] of storageObjectsByBucket) {
      const uniqueObjectPaths = Array.from(new Set(objectPaths.filter(Boolean)));

      if (uniqueObjectPaths.length === 0) {
        continue;
      }

      await serviceSupabase.storage.from(bucket).remove(uniqueObjectPaths);
    }

    if (assetIds.length > 0) {
      const { error: assetsDeleteError } = await serviceSupabase
        .from('message_assets')
        .delete()
        .in('id', assetIds);

      if (
        assetsDeleteError &&
        !isMissingRelationErrorMessage(assetsDeleteError.message, 'message_assets')
      ) {
        throw new Error(assetsDeleteError.message);
      }
    }
  }

  const { error: membersError } = await serviceSupabase
    .from('conversation_members')
    .delete()
    .eq('conversation_id', input.conversationId);

  if (membersError) {
    throw new Error(membersError.message);
  }

  const { error: conversationDeleteError } = await serviceSupabase
    .from('conversations')
    .delete()
    .eq('id', input.conversationId)
    .eq('kind', 'dm');

  if (conversationDeleteError) {
    throw new Error(conversationDeleteError.message);
  }

  return {
    deleted: true,
    deletedMessageCount: messageIds.length,
  };
}

export async function restoreConversationForUser(input: {
  conversationId: string;
  userId: string;
}) {
  const supabase = await getRequestSupabaseServerClient();

  if (!input.userId) {
    throw new Error('Conversation archive debug: authenticated user is required.');
  }

  const user = await requireRequestViewer('Conversation archive debug');

  if (!user?.id) {
    throw new Error('Conversation archive debug: no authenticated user found.');
  }

  if (user.id !== input.userId) {
    throw new Error(
      `Conversation archive debug: user mismatch. auth user id=${user.id}, payload user id=${input.userId}.`,
    );
  }

  const { data: membershipRow, error: membershipError } = await supabase
    .from('conversation_members')
    .select('hidden_at')
    .eq('conversation_id', input.conversationId)
    .eq('user_id', input.userId)
    .eq('state', 'active')
    .maybeSingle();

  if (membershipError) {
    if (isHiddenAtVisibilityRuntimeError(membershipError.message)) {
      throw createSchemaRequirementError(
        'Inbox archive/hide requires public.conversation_members.hidden_at.',
      );
    }

    throw new Error(membershipError.message);
  }

  if (!membershipRow) {
    throw new Error('Only an active participant can restore this chat.');
  }

  if (!membershipRow.hidden_at) {
    return { updated: false };
  }

  const { error: updateError } = await supabase
    .from('conversation_members')
    .update({ hidden_at: null })
    .eq('conversation_id', input.conversationId)
    .eq('user_id', input.userId)
    .eq('state', 'active');

  if (updateError) {
    if (isHiddenAtVisibilityRuntimeError(updateError.message)) {
      throw createSchemaRequirementError(
        'Inbox archive/hide requires public.conversation_members.hidden_at.',
      );
    }

    if (updateError.message.includes('row-level security policy')) {
      throw new Error(
        'Conversation archive debug: update blocked by conversation_members RLS.',
      );
    }

    throw new Error(updateError.message);
  }

  return { updated: true };
}

export async function assertConversationExists(conversationId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('conversations')
    .select('id')
    .eq('id', conversationId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data);
}

export async function assertMessageInConversation(
  messageId: string,
  conversationId: string,
) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('messages')
    .select('id')
    .eq('id', messageId)
    .eq('conversation_id', conversationId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data);
}

export async function assertMessageOwnedByUser(
  messageId: string,
  conversationId: string,
  userId: string,
) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('messages')
    .select('id')
    .eq('id', messageId)
    .eq('conversation_id', conversationId)
    .eq('sender_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data);
}
