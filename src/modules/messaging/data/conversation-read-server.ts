import 'server-only';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service';
import type { ProfileIdentityRecord } from '@/modules/profile/types';
import {
  buildAvatarDeliveryPath,
  isAbsoluteAvatarUrl,
} from '@/modules/messaging/avatar-delivery';
import {
  resolveInboxAttachmentPreviewKind,
  resolveInboxAttachmentPreviewKindFromMetadata,
  type InboxAttachmentPreviewKind,
} from '@/modules/messaging/inbox/preview-kind';
import { getProfileIdentities } from './profiles-server';
import { normalizeGroupConversationJoinPolicy } from '@/modules/messaging/group-policy';
import {
  applyConversationVisibility,
  isHiddenAtVisibilityRuntimeError,
} from '@/modules/messaging/data/visibility';
import { requireExactSpaceAccessForUser } from '@/modules/spaces/server';

type ConversationRecord = {
  id: string;
  kind: string | null;
  title?: string | null;
  avatar_path?: string | null;
  join_policy?: string | null;
  space_id?: string | null;
  created_by?: string | null;
  last_message_at?: string | null;
  created_at?: string | null;
  last_message_id?: string | null;
  last_message_seq?: number | string | null;
  last_message_sender_id?: string | null;
  last_message_kind?: string | null;
  last_message_content_mode?: string | null;
  last_message_deleted_at?: string | null;
  last_message_body?: string | null;
};

type ConversationMemberRow = {
  conversation_id: string;
  state?: string | null;
  hidden_at?: string | null;
  notification_level?: string | null;
  last_read_message_seq?: number | null;
  last_read_at?: string | null;
  visible_from_seq?: number | null;
  conversations: ConversationRecord | ConversationRecord[] | null;
};

export type InboxConversation = {
  conversationId: string;
  spaceId: string | null;
  title: string | null;
  avatarPath: string | null;
  createdBy?: string | null;
  lastMessageAt: string | null;
  createdAt: string | null;
  kind?: string | null;
  hiddenAt: string | null;
  lastReadMessageSeq: number | null;
  lastReadAt: string | null;
  latestMessageId: string | null;
  latestMessageSeq: number | null;
  latestMessageSenderId: string | null;
  latestMessageAttachmentKind: InboxAttachmentPreviewKind | null;
  latestMessageBody: string | null;
  latestMessageKind: string | null;
  latestMessageContentMode: string | null;
  latestMessageDeletedAt: string | null;
  unreadCount: number;
};

export type InboxConversationSummarySnapshot = {
  conversationId: string;
  createdAt: string | null;
  hiddenAt: string | null;
  lastMessageAt: string | null;
  lastReadAt: string | null;
  lastReadMessageSeq: number | null;
  latestMessageAttachmentKind: InboxAttachmentPreviewKind | null;
  latestMessageBody: string | null;
  latestMessageContentMode: string | null;
  latestMessageDeletedAt: string | null;
  latestMessageId: string | null;
  latestMessageKind: string | null;
  latestMessageSenderId: string | null;
  latestMessageSeq: number | null;
  unreadCount: number;
};

export type ConversationNotificationLevel = 'default' | 'muted';

export type MessageSenderProfile = ProfileIdentityRecord;

export type AvailableUser = ProfileIdentityRecord;

export type ConversationReadState = {
  lastReadMessageSeq: number | null;
  lastReadAt: string | null;
};

export type ConversationMemberReadState = {
  userId: string;
  lastReadMessageSeq: number | null;
  lastReadAt: string | null;
};

export type ConversationParticipant = {
  userId: string;
  role: string | null;
  state: string | null;
};

export type ConversationParticipantIdentity = {
  conversationId: string;
  userId: string;
  displayName: string | null;
  username?: string | null;
  email?: string | null;
  emailLocalPart?: string | null;
  avatarPath?: string | null;
  statusEmoji?: string | null;
  statusText?: string | null;
  statusUpdatedAt?: string | null;
};

export type ConversationMessageStats = {
  totalMessages: number;
  perSenderCount: Map<string, number>;
};

type MessageAttachmentPreviewRow = {
  created_at: string | null;
  message_id: string;
  mime_type: string | null;
};

type MessageAssetPreviewRow = {
  created_at: string | null;
  message_assets:
    | {
        kind: 'image' | 'file' | 'audio' | 'voice-note';
        mime_type?: string | null;
      }
    | Array<{
        kind: 'image' | 'file' | 'audio' | 'voice-note';
        mime_type?: string | null;
      }>
    | null;
  message_id: string;
};

type ConversationNameInput = {
  kind: string | null;
  title?: string | null;
  participantLabels: string[];
  fallbackTitles?: {
    dm?: string;
    group?: string;
  };
};

type ConversationSummaryMessageRow = {
  id: string;
  seq: number | string;
  sender_id: string | null;
  body: string | null;
  kind: string | null;
  content_mode?: string | null;
  deleted_at: string | null;
  created_at: string | null;
};

type ConversationSummaryMessageRowWithConversationId =
  ConversationSummaryMessageRow & {
    conversation_id: string;
  };

type MessageAttachmentLookupClient =
  Awaited<ReturnType<typeof createSupabaseServerClient>>;

const PROFILE_AVATAR_BUCKET =
  process.env.SUPABASE_AVATARS_BUCKET?.trim() || 'avatars';

function getSupabaseErrorDiagnostics(error: unknown) {
  if (!error || typeof error !== 'object') {
    return {};
  }

  const details = error as {
    code?: string | null;
    status?: number | null;
    details?: string | null;
    hint?: string | null;
  };

  return {
    error_code: details.code ?? null,
    error_status: details.status ?? null,
    error_details: details.details ?? null,
    error_hint: details.hint ?? null,
  };
}

function isSupabasePermissionDeniedError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  const diagnostics = getSupabaseErrorDiagnostics(error);
  const errorCode =
    typeof diagnostics.error_code === 'string'
      ? diagnostics.error_code.toLowerCase()
      : null;

  return (
    errorCode === '42501' ||
    message.includes('row-level security') ||
    message.includes('permission denied')
  );
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

function logSpaceMembershipDiagnostics(
  stage: string,
  details?: Record<string, unknown>,
) {
  if (process.env.CHAT_DEBUG_SPACES_SSR !== '1') {
    return;
  }

  if (details) {
    console.info('[space-members-query]', stage, details);
    return;
  }

  console.info('[space-members-query]', stage);
}

function resolveStoredAvatarPath(
  _supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  value: string | null | undefined,
) {
  const normalizedValue = value?.trim() || null;

  if (!normalizedValue) {
    return null;
  }

  if (isAbsoluteAvatarUrl(normalizedValue)) {
    return normalizedValue;
  }

  const deliveryPath = buildAvatarDeliveryPath(normalizedValue);

  if (!deliveryPath) {
    return null;
  }

  if (process.env.CHAT_DEBUG_AVATARS === '1') {
    console.info('[avatar-storage]', {
      issue: 'stable-delivery-path',
      bucket: PROFILE_AVATAR_BUCKET,
      objectPath: normalizedValue,
      url: deliveryPath,
    });
  }

  return deliveryPath;
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

const CONVERSATION_SUMMARY_PROJECTION_COLUMNS = [
  'last_message_id',
  'last_message_seq',
  'last_message_sender_id',
  'last_message_kind',
  'last_message_content_mode',
  'last_message_deleted_at',
  'last_message_body',
] as const;

type ConversationSummaryProjectionAvailability =
  | 'unknown'
  | 'available'
  | 'missing';

let conversationSummaryProjectionAvailability: ConversationSummaryProjectionAvailability =
  'unknown';

function isMissingConversationSummaryProjectionErrorMessage(message: string) {
  return CONVERSATION_SUMMARY_PROJECTION_COLUMNS.some((columnName) =>
    isMissingColumnErrorMessage(message, columnName),
  );
}

function markConversationSummaryProjectionAvailability(
  next: ConversationSummaryProjectionAvailability,
  reason?: string,
) {
  if (conversationSummaryProjectionAvailability === next) {
    return;
  }

  conversationSummaryProjectionAvailability = next;

  logConversationSchemaDiagnostics(
    `conversation-summary-projection:${next}`,
    reason ? { reason } : undefined,
  );
}

function normalizeConversationLatestMessageSeq(
  value: number | string | null | undefined,
) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export function normalizeConversationMemberVisibleFromSeq(
  value: number | string | null | undefined,
) {
  const normalizedValue = normalizeConversationLatestMessageSeq(value);

  if (normalizedValue === null) {
    return null;
  }

  return normalizedValue > 0 ? normalizedValue : null;
}

function resolveConversationVisibleReadFloorSeq(
  visibleFromSeq: number | null,
) {
  if (visibleFromSeq === null) {
    return null;
  }

  return Math.max(0, visibleFromSeq - 1);
}

function resolveConversationEffectiveLastReadSeq(input: {
  lastReadMessageSeq: number | null;
  visibleFromSeq?: number | null;
}) {
  const baselineReadFloorSeq = resolveConversationVisibleReadFloorSeq(
    input.visibleFromSeq ?? null,
  );
  return input.lastReadMessageSeq === null
    ? baselineReadFloorSeq
    : baselineReadFloorSeq === null
      ? input.lastReadMessageSeq
      : Math.max(input.lastReadMessageSeq, baselineReadFloorSeq);
}

async function countConversationUnreadIncomingMessages(input: {
  conversationId: string;
  currentUserId: string;
  lastReadMessageSeq: number | null;
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  visibleFromSeq?: number | null;
}) {
  const effectiveLastReadSeq = resolveConversationEffectiveLastReadSeq({
    lastReadMessageSeq: input.lastReadMessageSeq,
    visibleFromSeq: input.visibleFromSeq ?? null,
  });

  let unreadQuery = input.supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('conversation_id', input.conversationId)
    .neq('sender_id', input.currentUserId);

  if (effectiveLastReadSeq !== null) {
    unreadQuery = unreadQuery.gt('seq', effectiveLastReadSeq);
  }

  const unreadResponse = await unreadQuery;

  if (unreadResponse.error) {
    throw new Error(unreadResponse.error.message);
  }

  return Number(unreadResponse.count ?? 0);
}

async function loadUnreadIncomingCountByConversation(input: {
  currentUserId: string;
  rows: ConversationMemberRow[];
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
}) {
  const unreadCounts = await Promise.all(
    input.rows.map(async (row) => {
      const lastReadMessageSeq =
        typeof row.last_read_message_seq === 'number'
          ? row.last_read_message_seq
          : null;
      const visibleFromSeq = normalizeConversationMemberVisibleFromSeq(
        row.visible_from_seq,
      );

      return [
        row.conversation_id,
        await countConversationUnreadIncomingMessages({
          conversationId: row.conversation_id,
          currentUserId: input.currentUserId,
          lastReadMessageSeq,
          supabase: input.supabase,
          visibleFromSeq,
        }),
      ] as const;
    }),
  );

  return new Map(unreadCounts);
}

function getConversationSummarySelect(input?: {
  includeAvatarPath?: boolean;
  includeGroupJoinPolicy?: boolean;
  includeSpaceId?: boolean;
  includeSummaryProjection?: boolean;
}) {
  const includeSummaryProjection =
    input?.includeSummaryProjection !== false &&
    conversationSummaryProjectionAvailability !== 'missing';
  const columns = [
    'id',
    'kind',
    'title',
    ...(input?.includeAvatarPath === false ? [] : ['avatar_path']),
    ...(input?.includeGroupJoinPolicy ? ['join_policy'] : []),
    ...(input?.includeSpaceId === false ? [] : ['space_id']),
    'created_by',
    'last_message_at',
    'created_at',
    ...(includeSummaryProjection
      ? [
          'last_message_id',
          'last_message_seq',
          'last_message_sender_id',
          'last_message_kind',
          'last_message_content_mode',
          'last_message_deleted_at',
          'last_message_body',
        ]
      : []),
  ];

  return columns.join(', ');
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

function uniqueNonEmptyLabels(labels: string[]) {
  return Array.from(
    new Set(labels.map((label) => label.trim()).filter(Boolean)),
  );
}

export function getConversationDisplayName({
  kind,
  title,
  participantLabels,
  fallbackTitles,
}: ConversationNameInput) {
  const normalizedTitle = title?.trim() ?? '';
  const labels = uniqueNonEmptyLabels(participantLabels);

  if (kind === 'group') {
    if (normalizedTitle) {
      return normalizedTitle;
    }

    return labels.join(', ') || fallbackTitles?.group || 'New group';
  }

  return labels[0] || fallbackTitles?.dm || 'New chat';
}

export function getDirectMessageDisplayName(
  participantLabels: string[],
  fallbackLabel: string,
) {
  const labels = uniqueNonEmptyLabels(participantLabels);
  return labels[0] || fallbackLabel.trim() || 'Unknown user';
}

async function getConversationsByVisibility(
  userId: string,
  archived: boolean,
  options?: {
    spaceId?: string | null;
  },
) {
  const supabase = await createSupabaseServerClient();
  const diagnosticsEnabled = process.env.CHAT_DEBUG_INBOX_SSR === '1';
  const logDiagnostics = (stage: string, details?: Record<string, unknown>) => {
    if (!diagnosticsEnabled) {
      return;
    }

    const prefix = archived
      ? '[inbox-visibility:archived]'
      : '[inbox-visibility:visible]';
    if (details) {
      console.info(prefix, stage, details);
      return;
    }

    console.info(prefix, stage);
  };
  logDiagnostics('start', { hasSpaceScope: Boolean(options?.spaceId) });
  const baseMembershipSelect =
    'conversation_id, state, last_read_message_seq, last_read_at, visible_from_seq';
  const baseMemberships = await supabase
    .from('conversation_members')
    .select(baseMembershipSelect)
    .eq('user_id', userId)
    .eq('state', 'active');
  const fallbackBaseMemberships =
    baseMemberships.error &&
    isMissingColumnErrorMessage(baseMemberships.error.message, 'visible_from_seq')
      ? await supabase
          .from('conversation_members')
          .select('conversation_id, state, last_read_message_seq, last_read_at')
          .eq('user_id', userId)
          .eq('state', 'active')
      : null;
  const resolvedBaseMemberships = fallbackBaseMemberships ?? baseMemberships;

  if (resolvedBaseMemberships.error) {
    logDiagnostics('base-memberships-error', {
      message: resolvedBaseMemberships.error.message,
    });
    throw new Error(resolvedBaseMemberships.error.message);
  }

  const membershipRows = (resolvedBaseMemberships.data ?? []) as ConversationMemberRow[];
  logDiagnostics('base-memberships-ok', { count: membershipRows.length });

  const fallbackVisibleConversations = async () =>
    mapInboxConversations(
      await attachConversationsToMembershipRows(membershipRows, supabase, options),
      supabase,
      userId,
    );

  try {
    logDiagnostics('visibility-lookup-start');
    const visibilityRows = await supabase
      .from('conversation_members')
      .select('conversation_id, hidden_at')
      .eq('user_id', userId)
      .eq('state', 'active');

    if (visibilityRows.error) {
      logDiagnostics('visibility-lookup-error', {
        message: visibilityRows.error.message,
        isHiddenAtRuntimeError: isHiddenAtVisibilityRuntimeError(
          visibilityRows.error.message,
        ),
      });
      if (isHiddenAtVisibilityRuntimeError(visibilityRows.error.message)) {
        logDiagnostics('fallback-from-visibility-error');
        return archived ? ([] satisfies InboxConversation[]) : fallbackVisibleConversations();
      }

      throw new Error(visibilityRows.error.message);
    }
    logDiagnostics('visibility-lookup-ok', {
      count: (visibilityRows.data ?? []).length,
    });

    const scopedMembershipRows = applyConversationVisibility(
      membershipRows,
      archived,
      (visibilityRows.data ?? []) as Array<{
        conversation_id: string;
        hidden_at: string | null;
      }>,
    ) as ConversationMemberRow[];

    return mapInboxConversations(
      await attachConversationsToMembershipRows(scopedMembershipRows, supabase, options),
      supabase,
      userId,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logDiagnostics('visibility-catch', {
      message,
      isHiddenAtRuntimeError: isHiddenAtVisibilityRuntimeError(message),
    });

    if (isHiddenAtVisibilityRuntimeError(message)) {
      logDiagnostics('fallback-from-catch');
      return archived ? ([] satisfies InboxConversation[]) : fallbackVisibleConversations();
    }

    throw error;
  }
}

async function getConversationsWithoutArchiveVisibility(
  userId: string,
  options?: {
    spaceId?: string | null;
  },
) {
  const supabase = await createSupabaseServerClient();
  const baseMembershipSelect =
    'conversation_id, state, last_read_message_seq, last_read_at, visible_from_seq';
  const baseMemberships = await supabase
    .from('conversation_members')
    .select(baseMembershipSelect)
    .eq('user_id', userId)
    .eq('state', 'active');
  const fallbackBaseMemberships =
    baseMemberships.error &&
    isMissingColumnErrorMessage(baseMemberships.error.message, 'visible_from_seq')
      ? await supabase
          .from('conversation_members')
          .select('conversation_id, state, last_read_message_seq, last_read_at')
          .eq('user_id', userId)
          .eq('state', 'active')
      : null;
  const resolvedBaseMemberships = fallbackBaseMemberships ?? baseMemberships;

  if (resolvedBaseMemberships.error) {
    throw new Error(resolvedBaseMemberships.error.message);
  }

  const membershipRows = (resolvedBaseMemberships.data ?? []) as ConversationMemberRow[];

  return mapInboxConversations(
    await attachConversationsToMembershipRows(membershipRows, supabase, options),
    supabase,
    userId,
  );
}

async function attachConversationsToMembershipRows(
  rows: ConversationMemberRow[],
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  options?: {
    includeGroupJoinPolicy?: boolean;
    spaceId?: string | null;
  },
) {
  const conversationIds = Array.from(
    new Set(rows.map((row) => row.conversation_id).filter(Boolean)),
  );

  if (conversationIds.length === 0) {
    return rows.map((row) => ({
      ...row,
      conversations: null,
    })) satisfies ConversationMemberRow[];
  }

  const { data, error } = await supabase
    .from('conversations')
    .select(
      getConversationSummarySelect({
        includeAvatarPath: true,
        includeGroupJoinPolicy: options?.includeGroupJoinPolicy,
        includeSpaceId: true,
        includeSummaryProjection: true,
      }),
    )
    .in('id', conversationIds);

  let conversations = (data ?? null) as ConversationRecord[] | null;

  if (error) {
    const missingSpaceId = isMissingColumnErrorMessage(error.message, 'space_id');
    const missingAvatarPath = isMissingColumnErrorMessage(error.message, 'avatar_path');
    const missingJoinPolicy = isMissingColumnErrorMessage(error.message, 'join_policy');
    const missingSummaryProjection =
      isMissingConversationSummaryProjectionErrorMessage(error.message);

    if (missingSummaryProjection) {
      markConversationSummaryProjectionAvailability('missing', error.message);
    }

    if (missingSpaceId || missingAvatarPath || missingJoinPolicy || missingSummaryProjection) {
      logConversationSchemaDiagnostics('attachConversationsToMembershipRows:select-error', {
        actualFailingColumn: missingAvatarPath
          ? 'avatar_path'
          : missingJoinPolicy
            ? 'join_policy'
            : missingSummaryProjection
              ? 'conversation-summary-projection'
              : missingSpaceId
                ? 'space_id'
                : 'unknown',
        helper: 'attachConversationsToMembershipRows',
        message: error.message,
        requestedSpaceId: options?.spaceId ?? null,
        schemaCheckAvatarPathMissing: missingAvatarPath,
        schemaCheckJoinPolicyMissing: missingJoinPolicy,
        schemaCheckSpaceIdMissing: missingSpaceId,
        schemaCheckSummaryProjectionMissing: missingSummaryProjection,
      });

      if (options?.spaceId && missingSpaceId) {
        logConversationSchemaDiagnostics(
          'attachConversationsToMembershipRows:throw-space-id-required',
          {
            actualFailingColumn: missingAvatarPath
              ? 'avatar_path'
              : missingJoinPolicy
                ? 'join_policy'
                : missingSummaryProjection
                  ? 'conversation-summary-projection'
                  : missingSpaceId
                    ? 'space_id'
                    : 'unknown',
            helper: 'attachConversationsToMembershipRows',
            message: error.message,
            requestedSpaceId: options.spaceId,
            schemaCheckAvatarPathMissing: missingAvatarPath,
            schemaCheckJoinPolicyMissing: missingJoinPolicy,
            schemaCheckSpaceIdMissing: missingSpaceId,
            schemaCheckSummaryProjectionMissing: missingSummaryProjection,
          },
        );
        throw createSchemaRequirementError(
          'Active space scoping requires public.conversations.space_id.',
        );
      }

      const fallback = await supabase
        .from('conversations')
        .select(
          getConversationSummarySelect({
            includeAvatarPath: !missingAvatarPath,
            includeGroupJoinPolicy:
              Boolean(options?.includeGroupJoinPolicy) && !missingJoinPolicy,
            includeSpaceId: !missingSpaceId,
            includeSummaryProjection: !missingSummaryProjection,
          }),
        )
        .in('id', conversationIds);

      if (fallback.error) {
        logConversationSchemaDiagnostics(
          'attachConversationsToMembershipRows:fallback-error',
          {
            actualFailingColumn:
              isMissingColumnErrorMessage(fallback.error.message, 'avatar_path')
                ? 'avatar_path'
                : isMissingColumnErrorMessage(fallback.error.message, 'join_policy')
                  ? 'join_policy'
                  : isMissingConversationSummaryProjectionErrorMessage(
                        fallback.error.message,
                    )
                    ? 'conversation-summary-projection'
                    : isMissingColumnErrorMessage(fallback.error.message, 'space_id')
                      ? 'space_id'
                      : 'unknown',
            helper: 'attachConversationsToMembershipRows',
            message: fallback.error.message,
            requestedSpaceId: options?.spaceId ?? null,
            schemaCheckAvatarPathMissing: isMissingColumnErrorMessage(
              fallback.error.message,
              'avatar_path',
            ),
            schemaCheckJoinPolicyMissing: isMissingColumnErrorMessage(
              fallback.error.message,
              'join_policy',
            ),
            schemaCheckSpaceIdMissing: isMissingColumnErrorMessage(
              fallback.error.message,
              'space_id',
            ),
            schemaCheckSummaryProjectionMissing:
              isMissingConversationSummaryProjectionErrorMessage(
                fallback.error.message,
              ),
          },
        );
        throw new Error(fallback.error.message);
      }

      conversations = (fallback.data ?? null) as unknown as ConversationRecord[] | null;
    } else {
      throw new Error(error.message);
    }
  } else if (conversationSummaryProjectionAvailability === 'unknown') {
    const projectionWasRequested =
      rows.length > 0 &&
      Object.prototype.hasOwnProperty.call(
        (conversations ?? [])[0] ?? {},
        'last_message_id',
      );
    if (projectionWasRequested) {
      markConversationSummaryProjectionAvailability('available');
    }
  }

  const conversationById = new Map(
    ((conversations ?? []) as ConversationRecord[]).map((conversation) => [
      conversation.id,
      conversation,
    ]),
  );

  const scopedRows = rows.filter((row) => {
    if (!options?.spaceId) {
      return true;
    }

    return (conversationById.get(row.conversation_id)?.space_id ?? null) === options.spaceId;
  });

  return scopedRows.map((row) => ({
    ...row,
    conversations: conversationById.get(row.conversation_id) ?? null,
  })) satisfies ConversationMemberRow[];
}

async function mapInboxConversations(
  rows: ConversationMemberRow[],
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  currentUserId: string,
) {
  const conversationIds = rows.map((row) => row.conversation_id);
  const latestMessageSeqByConversation = new Map<string, number>();
  const latestMessageByConversation = new Map<
    string,
    {
      createdAt: string | null;
      id: string | null;
      senderId: string | null;
      body: string | null;
      kind: string | null;
      contentMode: string | null;
      deletedAt: string | null;
    }
  >();
  const unreadCountByConversation =
    await loadUnreadIncomingCountByConversation({
      currentUserId,
      rows,
      supabase,
    });
  const latestMessageRowsByConversationId =
    await loadLatestConversationSummaryMessageRowsByConversationId(
      supabase,
      conversationIds,
    );

  for (const membershipRow of rows) {
    const latestRow =
      latestMessageRowsByConversationId.get(membershipRow.conversation_id) ?? null;
    const latestSeq = normalizeConversationLatestMessageSeq(latestRow?.seq ?? null);

    if (latestRow) {
      latestMessageByConversation.set(membershipRow.conversation_id, {
        createdAt: latestRow.created_at ?? null,
        id: latestRow.id ?? null,
        senderId: latestRow.sender_id ?? null,
        body: latestRow.body ?? null,
        kind: latestRow.kind ?? null,
        contentMode: latestRow.content_mode ?? null,
        deletedAt: latestRow.deleted_at ?? null,
      });
    }

    if (latestSeq !== null) {
      latestMessageSeqByConversation.set(membershipRow.conversation_id, latestSeq);
    }
  }

  const latestMessageAttachmentKindByMessageId =
    await getInboxAttachmentPreviewKindsByMessageId(
      supabase,
      Array.from(
        new Set(
          Array.from(latestMessageByConversation.values())
            .map((message) => message.id)
            .filter((messageId): messageId is string => Boolean(messageId)),
        ),
      ),
    );

  const mappedRows = rows.map((row) => {
    const conversation = normalizeConversation(row.conversations);
    const lastReadMessageSeq =
      typeof row.last_read_message_seq === 'number'
        ? row.last_read_message_seq
        : null;
    const visibleFromSeq = normalizeConversationMemberVisibleFromSeq(
      row.visible_from_seq,
    );
    const latestMessageSeq =
      latestMessageSeqByConversation.get(row.conversation_id) ?? null;
    const latestMessage = latestMessageByConversation.get(row.conversation_id);
    const unreadCount =
      unreadCountByConversation.get(row.conversation_id) ?? 0;
    const latestMessageVisible =
      latestMessageSeq !== null &&
      (visibleFromSeq === null || latestMessageSeq >= visibleFromSeq);

    return {
      conversationId: row.conversation_id,
      spaceId: conversation?.space_id ?? null,
      kind: conversation?.kind ?? null,
      title: conversation?.title ?? null,
      avatarPath: resolveStoredAvatarPath(
        supabase,
        conversation?.avatar_path ?? null,
      ),
      createdBy: conversation?.created_by ?? null,
      lastMessageAt: latestMessageVisible ? latestMessage?.createdAt ?? null : null,
      createdAt: conversation?.created_at ?? null,
      hiddenAt: row.hidden_at ?? null,
      lastReadMessageSeq,
      lastReadAt: row.last_read_at ?? null,
      latestMessageId: latestMessageVisible ? latestMessage?.id ?? null : null,
      latestMessageSeq: latestMessageVisible ? latestMessageSeq : null,
      latestMessageSenderId: latestMessageVisible
        ? latestMessage?.senderId ?? null
        : null,
      latestMessageAttachmentKind:
        latestMessageVisible && latestMessage?.id
          ? latestMessageAttachmentKindByMessageId.get(latestMessage.id) ?? null
          : null,
      latestMessageBody: latestMessageVisible ? latestMessage?.body ?? null : null,
      latestMessageKind: latestMessageVisible ? latestMessage?.kind ?? null : null,
      latestMessageContentMode: latestMessageVisible
        ? latestMessage?.contentMode ?? null
        : null,
      latestMessageDeletedAt: latestMessageVisible
        ? latestMessage?.deletedAt ?? null
        : null,
      unreadCount,
    };
  });

  return mappedRows.sort((left, right) => {
    const leftValue = left.lastMessageAt ?? left.createdAt ?? '';
    const rightValue = right.lastMessageAt ?? right.createdAt ?? '';

    return rightValue.localeCompare(leftValue);
  });
}

export async function getInboxConversations(
  userId: string,
  options?: {
    spaceId?: string | null;
  },
) {
  return getConversationsByVisibility(userId, false, options);
}

export async function getInboxConversationsStable(
  userId: string,
  options?: {
    spaceId?: string | null;
  },
) {
  return getConversationsWithoutArchiveVisibility(userId, options);
}

export async function getArchivedConversations(
  userId: string,
  options?: {
    spaceId?: string | null;
  },
) {
  return getConversationsByVisibility(userId, true, options);
}

export async function getConversationForUser(
  conversationId: string,
  userId: string,
  options?: {
    spaceId?: string | null;
  },
) {
  const supabase = await createSupabaseServerClient();
  let membershipResponse = await supabase
    .from('conversation_members')
    .select('conversation_id, notification_level, visible_from_seq')
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
    .eq('state', 'active')
    .maybeSingle();

  if (
    membershipResponse.error &&
    isMissingColumnErrorMessage(membershipResponse.error.message, 'visible_from_seq')
  ) {
    membershipResponse = await supabase
      .from('conversation_members')
      .select('conversation_id, notification_level')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .eq('state', 'active')
      .maybeSingle();
  }

  const { data, error } = membershipResponse;

  if (error) {
    if (isMissingColumnErrorMessage(error.message, 'notification_level')) {
      const fallback = await supabase
        .from('conversation_members')
        .select('conversation_id')
        .eq('conversation_id', conversationId)
        .eq('user_id', userId)
        .eq('state', 'active')
        .maybeSingle();

      if (fallback.error) {
        throw new Error(fallback.error.message);
      }

      if (!fallback.data) {
        return null;
      }

      const [scopedRow] = await attachConversationsToMembershipRows(
        [
          {
            conversation_id: (fallback.data as { conversation_id: string }).conversation_id,
            conversations: null,
          } satisfies ConversationMemberRow,
        ],
        supabase,
        {
          ...options,
          includeGroupJoinPolicy: true,
        },
      );

      const fallbackConversation = normalizeConversation(scopedRow?.conversations ?? null);

      if (!fallbackConversation || !scopedRow) {
        return null;
      }

      return {
        conversationId: scopedRow.conversation_id,
        spaceId: fallbackConversation.space_id ?? null,
        kind: fallbackConversation.kind,
        joinPolicy:
          fallbackConversation.kind === 'group'
            ? normalizeGroupConversationJoinPolicy(
                fallbackConversation.join_policy ?? null,
              )
            : null,
        title: fallbackConversation.title,
        avatarPath: resolveStoredAvatarPath(
          supabase,
          fallbackConversation.avatar_path ?? null,
        ),
        createdBy: fallbackConversation.created_by ?? null,
        lastMessageAt: fallbackConversation.last_message_at,
        createdAt: fallbackConversation.created_at,
        latestMessageSeq: normalizeConversationLatestMessageSeq(
          fallbackConversation.last_message_seq ?? null,
        ),
        notificationLevel: 'default' as const,
        visibleFromSeq: null,
      };
    }

    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  const [scopedRow] = await attachConversationsToMembershipRows(
    [
      {
        conversation_id: (data as { conversation_id: string }).conversation_id,
        notification_level:
          (data as { notification_level?: string | null }).notification_level ?? null,
        conversations: null,
      } satisfies ConversationMemberRow,
    ],
    supabase,
    {
      ...options,
      includeGroupJoinPolicy: true,
    },
  );
  const conversation = normalizeConversation(scopedRow?.conversations ?? null);

  if (!conversation || !scopedRow) {
    return null;
  }

  return {
    conversationId: scopedRow.conversation_id,
    spaceId: conversation.space_id ?? null,
    kind: conversation.kind,
    joinPolicy:
      conversation.kind === 'group'
        ? normalizeGroupConversationJoinPolicy(conversation.join_policy ?? null)
        : null,
    title: conversation.title,
    avatarPath: resolveStoredAvatarPath(
      supabase,
      conversation.avatar_path ?? null,
    ),
    createdBy: conversation.created_by ?? null,
    lastMessageAt: conversation.last_message_at,
    createdAt: conversation.created_at,
    latestMessageSeq: normalizeConversationLatestMessageSeq(
      conversation.last_message_seq ?? null,
    ),
    notificationLevel:
      scopedRow.notification_level === 'muted' ? 'muted' : 'default',
    visibleFromSeq: normalizeConversationMemberVisibleFromSeq(
      scopedRow.visible_from_seq,
    ),
  };
}

export async function getConversationSummaryForUser(
  conversationId: string,
  userId: string,
  options?: {
    spaceId?: string | null;
  },
) {
  const supabase = await createSupabaseServerClient();
  let membershipResponse = await supabase
    .from('conversation_members')
    .select(
      'conversation_id, hidden_at, last_read_message_seq, last_read_at, visible_from_seq',
    )
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
    .eq('state', 'active')
    .maybeSingle();

  if (
    membershipResponse.error &&
    isMissingColumnErrorMessage(membershipResponse.error.message, 'visible_from_seq')
  ) {
    membershipResponse = await supabase
      .from('conversation_members')
      .select('conversation_id, hidden_at, last_read_message_seq, last_read_at')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .eq('state', 'active')
      .maybeSingle();
  }

  if (membershipResponse.error) {
    throw new Error(membershipResponse.error.message);
  }

  if (!membershipResponse.data) {
    return null;
  }

  const [scopedRow] = await attachConversationsToMembershipRows(
    [
      {
        conversation_id: membershipResponse.data.conversation_id,
        hidden_at: membershipResponse.data.hidden_at ?? null,
        last_read_at: membershipResponse.data.last_read_at ?? null,
        last_read_message_seq:
          typeof membershipResponse.data.last_read_message_seq === 'number'
            ? membershipResponse.data.last_read_message_seq
            : null,
        visible_from_seq:
          typeof membershipResponse.data.visible_from_seq === 'number'
            ? membershipResponse.data.visible_from_seq
            : null,
        conversations: null,
      } satisfies ConversationMemberRow,
    ],
    supabase,
    options,
  );
  const conversation = normalizeConversation(scopedRow?.conversations ?? null);

  if (!scopedRow || !conversation) {
    return null;
  }

  const latestRow = await loadLatestConversationSummaryMessageRow(
    supabase,
    conversationId,
  );
  const latestMessageSeq = normalizeConversationLatestMessageSeq(latestRow?.seq ?? null);
  const latestMessage = latestRow
    ? {
        body: latestRow.body ?? null,
        contentMode: latestRow.content_mode ?? null,
        createdAt: latestRow.created_at ?? null,
        deletedAt: latestRow.deleted_at ?? null,
        id: latestRow.id ?? null,
        kind: latestRow.kind ?? null,
        senderId: latestRow.sender_id ?? null,
      }
    : null;

  const lastReadMessageSeq =
    typeof scopedRow.last_read_message_seq === 'number'
      ? scopedRow.last_read_message_seq
      : null;
  const visibleFromSeq = normalizeConversationMemberVisibleFromSeq(
    scopedRow.visible_from_seq,
  );
  const unreadCount = await countConversationUnreadIncomingMessages({
    conversationId,
    currentUserId: userId,
    lastReadMessageSeq,
    supabase,
    visibleFromSeq,
  });
  const latestMessageVisible =
    latestMessageSeq !== null &&
    (visibleFromSeq === null || latestMessageSeq >= visibleFromSeq);
  const latestMessageAttachmentKindByMessageId =
    latestMessage?.id
      ? await getInboxAttachmentPreviewKindsByMessageId(supabase, [latestMessage.id])
      : new Map<string, InboxAttachmentPreviewKind>();

  return {
    conversationId: scopedRow.conversation_id,
    createdAt: conversation.created_at ?? null,
    hiddenAt: scopedRow.hidden_at ?? null,
    lastMessageAt: latestMessageVisible ? latestMessage?.createdAt ?? null : null,
    lastReadAt: scopedRow.last_read_at ?? null,
    lastReadMessageSeq,
    latestMessageAttachmentKind:
      latestMessageVisible && latestMessage?.id
        ? latestMessageAttachmentKindByMessageId.get(latestMessage.id) ?? null
        : null,
    latestMessageBody: latestMessageVisible ? latestMessage?.body ?? null : null,
    latestMessageContentMode: latestMessageVisible
      ? latestMessage?.contentMode ?? null
      : null,
    latestMessageDeletedAt: latestMessageVisible
      ? latestMessage?.deletedAt ?? null
      : null,
    latestMessageId: latestMessageVisible ? latestMessage?.id ?? null : null,
    latestMessageKind: latestMessageVisible ? latestMessage?.kind ?? null : null,
    latestMessageSenderId: latestMessageVisible
      ? latestMessage?.senderId ?? null
      : null,
    latestMessageSeq: latestMessageVisible ? latestMessageSeq : null,
    unreadCount,
  } satisfies InboxConversationSummarySnapshot;
}

export async function getConversationReadState(
  conversationId: string,
  userId: string,
) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('conversation_members')
    .select('last_read_message_seq, last_read_at')
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    if (
      error.message.includes('last_read_message_seq') ||
      error.message.includes('last_read_at') ||
      error.message.includes('column')
    ) {
      return {
        lastReadMessageSeq: null,
        lastReadAt: null,
      } satisfies ConversationReadState;
    }

    throw new Error(error.message);
  }

  return {
    lastReadMessageSeq:
      typeof data?.last_read_message_seq === 'number'
        ? data.last_read_message_seq
        : null,
    lastReadAt:
      typeof data?.last_read_at === 'string' ? data.last_read_at : null,
  } satisfies ConversationReadState;
}

export async function getConversationMemberJoinedAt(
  conversationId: string,
  userId: string,
) {
  const boundary = await getConversationMemberHistoryBoundary(conversationId, userId);
  return boundary?.joinedAt ?? null;
}

export async function getConversationMemberHistoryBoundary(
  conversationId: string,
  userId: string,
) {
  const supabase = await createSupabaseServerClient();
  let response = await supabase
    .from('conversation_members')
    .select('created_at, visible_from_seq')
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
    .eq('state', 'active')
    .maybeSingle();

  if (
    response.error &&
    isMissingColumnErrorMessage(response.error.message, 'visible_from_seq')
  ) {
    response = await supabase
      .from('conversation_members')
      .select('created_at')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .eq('state', 'active')
      .maybeSingle();
  }

  const { data, error } = response;

  if (error) {
    if (
      error.message.includes('created_at') ||
      error.message.includes('column')
    ) {
      return {
        joinedAt: null,
        visibleFromSeq: null,
      };
    }

    throw new Error(error.message);
  }

  return {
    joinedAt: typeof data?.created_at === 'string' ? data.created_at : null,
    visibleFromSeq: normalizeConversationMemberVisibleFromSeq(
      typeof data?.visible_from_seq === 'number' ? data.visible_from_seq : null,
    ),
  };
}

export async function getConversationMemberReadStates(conversationId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('conversation_members')
    .select('user_id, last_read_message_seq, last_read_at')
    .eq('conversation_id', conversationId)
    .eq('state', 'active');

  if (error) {
    if (
      error.message.includes('last_read_message_seq') ||
      error.message.includes('last_read_at') ||
      error.message.includes('column')
    ) {
      const fallback = await supabase
        .from('conversation_members')
        .select('user_id')
        .eq('conversation_id', conversationId)
        .eq('state', 'active');

      if (fallback.error) {
        throw new Error(fallback.error.message);
      }

      return ((fallback.data ?? []) as { user_id: string }[]).map((row) => ({
        userId: row.user_id,
        lastReadMessageSeq: null,
        lastReadAt: null,
      })) satisfies ConversationMemberReadState[];
    }

    throw new Error(error.message);
  }

  return ((data ?? []) as {
    user_id: string;
    last_read_message_seq?: number | null;
    last_read_at?: string | null;
  }[]).map((row) => ({
    userId: row.user_id,
    lastReadMessageSeq:
      typeof row.last_read_message_seq === 'number'
        ? row.last_read_message_seq
        : null,
    lastReadAt: row.last_read_at ?? null,
  })) satisfies ConversationMemberReadState[];
}

async function getActiveConversationMembershipRows(
  conversationIds: string[],
  options?: {
    includeRole?: boolean;
  },
) {
  type ConversationMembershipRow = {
    conversation_id: string;
    user_id: string;
    role?: string | null;
    state?: string | null;
  };
  const uniqueConversationIds = Array.from(
    new Set(conversationIds.map((value) => value.trim()).filter(Boolean)),
  );

  if (uniqueConversationIds.length === 0) {
    return [] as ConversationMembershipRow[];
  }

  const buildMembershipRowsQuery = async (
    client: Awaited<ReturnType<typeof createSupabaseServerClient>>,
    includeRole: boolean,
  ) => {
    const select = includeRole
      ? 'conversation_id, user_id, role'
      : 'conversation_id, user_id';

    return client
      .from('conversation_members')
      .select(select)
      .in('conversation_id', uniqueConversationIds)
      .eq('state', 'active');
  };
  const supabase = await createSupabaseServerClient();
  const allowRoleFallback = options?.includeRole === true;
  let authResponse = await buildMembershipRowsQuery(
    supabase,
    options?.includeRole === true,
  );

  if (
    authResponse.error &&
    allowRoleFallback &&
    isMissingColumnErrorMessage(authResponse.error.message, 'role')
  ) {
    authResponse = await buildMembershipRowsQuery(supabase, false);
  }

  let baseRows: ConversationMembershipRow[] = [];

  if (authResponse.error) {
    const serviceSupabase = createSupabaseServiceRoleClient();

    if (!serviceSupabase || !isSupabasePermissionDeniedError(authResponse.error)) {
      throw new Error(authResponse.error.message);
    }

    let serviceResponse = await buildMembershipRowsQuery(
      serviceSupabase as Awaited<ReturnType<typeof createSupabaseServerClient>>,
      options?.includeRole === true,
    );

    if (
      serviceResponse.error &&
      allowRoleFallback &&
      isMissingColumnErrorMessage(serviceResponse.error.message, 'role')
    ) {
      serviceResponse = await buildMembershipRowsQuery(
        serviceSupabase as Awaited<ReturnType<typeof createSupabaseServerClient>>,
        false,
      );
    }

    if (serviceResponse.error) {
      throw new Error(serviceResponse.error.message);
    }

    baseRows = (serviceResponse.data ?? []) as unknown as ConversationMembershipRow[];
  } else {
    baseRows = (authResponse.data ?? []) as unknown as ConversationMembershipRow[];
  }

  const mergedRows = new Map<string, ConversationMembershipRow>(
    baseRows.map((row) => [`${row.conversation_id}:${row.user_id}`, row] as const),
  );

  const serviceSupabase = createSupabaseServiceRoleClient();

  if (serviceSupabase) {
    let serviceResponse = await buildMembershipRowsQuery(
      serviceSupabase as Awaited<ReturnType<typeof createSupabaseServerClient>>,
      options?.includeRole === true,
    );

    if (
      serviceResponse.error &&
      allowRoleFallback &&
      isMissingColumnErrorMessage(serviceResponse.error.message, 'role')
    ) {
      serviceResponse = await buildMembershipRowsQuery(
        serviceSupabase as Awaited<ReturnType<typeof createSupabaseServerClient>>,
        false,
      );
    }

    if (!serviceResponse.error) {
      for (const row of (serviceResponse.data ?? []) as unknown as ConversationMembershipRow[]) {
        mergedRows.set(`${row.conversation_id}:${row.user_id}`, row);
      }
    }
  }

  return Array.from(mergedRows.values());
}

export async function getConversationParticipants(conversationId: string) {
  const membershipRows = await getActiveConversationMembershipRows([conversationId], {
    includeRole: true,
  });

  const data = membershipRows
    .filter((membership) => membership.conversation_id === conversationId)
    .map((membership) => ({
      user_id: membership.user_id,
      role: membership.role ?? null,
      state: membership.state ?? null,
    }));

  const memberships = ((data ?? []) as {
    user_id: string;
    role?: string | null;
    state?: string | null;
  }[]).map((member) => ({
    userId: member.user_id,
    role: member.role ?? null,
    state: member.state ?? null,
  }));

  const uniqueMemberships = Array.from(
    new Map(memberships.map((member) => [member.userId, member])).values(),
  );
  const rolePriority = new Map([
    ['owner', 0],
    ['admin', 1],
    ['member', 2],
  ]);

  return uniqueMemberships.sort((left, right) => {
    const leftPriority = rolePriority.get(left.role ?? 'member') ?? 99;
    const rightPriority = rolePriority.get(right.role ?? 'member') ?? 99;

    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority;
    }

    return left.userId.localeCompare(right.userId);
  }) satisfies ConversationParticipant[];
}

export async function getConversationMessageStats(
  conversationId: string,
): Promise<ConversationMessageStats> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('messages')
    .select('sender_id')
    .eq('conversation_id', conversationId);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as Array<{ sender_id?: string | null }>;
  const perSenderCount = new Map<string, number>();

  for (const row of rows) {
    const senderId = row.sender_id?.trim();

    if (!senderId) {
      continue;
    }

    perSenderCount.set(senderId, (perSenderCount.get(senderId) ?? 0) + 1);
  }

  return {
    totalMessages: rows.length,
    perSenderCount,
  };
}

export async function getAvailableUsers(
  currentUserId: string,
  options?: {
    spaceId?: string | null;
    source?: string;
  },
) {
  const supabase = await createSupabaseServerClient();
  let userIds: string[] = [];
  const source = options?.source ?? 'unknown';
  const requestedSpaceId = options?.spaceId?.trim() || null;

  if (!requestedSpaceId) {
    throw new Error(
      'Space-scoped user lookup requires an explicit current space.',
    );
  }

  const exactSpaceAccess = await requireExactSpaceAccessForUser({
    requestedSpaceId,
    source: `${source}:available-users-space-access`,
    userId: currentUserId,
  });

  logSpaceMembershipDiagnostics('getAvailableUsers:space-members:start', {
    source,
    queryShape:
      "from('space_members').select('user_id').eq('space_id', ?).neq('user_id', ?).order('user_id')",
    requestedSpaceId,
    resolvedSpaceId: exactSpaceAccess.activeSpace.id,
  });
  const { data, error } = await supabase
    .from('space_members')
    .select('user_id')
    .eq('space_id', exactSpaceAccess.activeSpace.id)
    .neq('user_id', currentUserId)
    .order('user_id', { ascending: true });

  if (error) {
    logSpaceMembershipDiagnostics('getAvailableUsers:space-members:error', {
      source,
      message: error.message,
    });
    if (isMissingRelationErrorMessage(error.message, 'space_members')) {
      throw createSchemaRequirementError(
        'Space-scoped user lookup requires public.space_members.',
      );
    }

    throw new Error(error.message);
  }

  userIds = ((data ?? []) as { user_id: string }[]).map((row) => row.user_id);
  logSpaceMembershipDiagnostics('getAvailableUsers:space-members:ok', {
    source,
    count: userIds.length,
  });

  const identities = await getProfileIdentities(userIds);
  const identityByUserId = new Map<string, MessageSenderProfile>(
    identities.map((identity) => [identity.userId, identity] as const),
  );

  return userIds.map((userId) => {
    const identity = identityByUserId.get(userId);

    return {
      userId,
      displayName: identity?.displayName ?? null,
      username: identity?.username ?? null,
      emailLocalPart: identity?.emailLocalPart ?? null,
      avatarPath: identity?.avatarPath ?? null,
      statusEmoji: identity?.statusEmoji ?? null,
      statusText: identity?.statusText ?? null,
      statusUpdatedAt: identity?.statusUpdatedAt ?? null,
    };
  }) satisfies AvailableUser[];
}

export async function getConversationParticipantIdentities(
  conversationIds: string[],
) {
  const uniqueConversationIds = Array.from(
    new Set(conversationIds.map((value) => value.trim()).filter(Boolean)),
  );

  if (uniqueConversationIds.length === 0) {
    return [] as ConversationParticipantIdentity[];
  }

  const memberships = await getActiveConversationMembershipRows(uniqueConversationIds);
  const identities = await getProfileIdentities(
    memberships.map((membership) => membership.user_id),
    {
      includeStatuses: false,
    },
  );
  const identityByUserId = new Map<string, MessageSenderProfile>(
    identities.map((identity) => [identity.userId, identity] as const),
  );

  return memberships.map((membership) => {
    const identity = identityByUserId.get(membership.user_id);

    return {
      conversationId: membership.conversation_id,
      userId: membership.user_id,
      displayName: identity?.displayName ?? null,
      username: identity?.username ?? null,
      emailLocalPart: identity?.emailLocalPart ?? null,
      avatarPath: identity?.avatarPath ?? null,
      statusEmoji: identity?.statusEmoji ?? null,
      statusText: identity?.statusText ?? null,
      statusUpdatedAt: identity?.statusUpdatedAt ?? null,
    };
  }) satisfies ConversationParticipantIdentity[];
}

async function loadLatestConversationSummaryMessageRowsByConversationId(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  conversationIds: string[],
) {
  const uniqueConversationIds = Array.from(new Set(conversationIds.filter(Boolean)));

  if (uniqueConversationIds.length === 0) {
    return new Map<string, ConversationSummaryMessageRowWithConversationId>();
  }

  const loadLatestRowsWithContentMode = async () =>
    supabase
      .from('messages')
      .select(
        'id, conversation_id, seq, sender_id, body, kind, content_mode, deleted_at, created_at',
      )
      .in('conversation_id', uniqueConversationIds)
      .order('conversation_id', { ascending: true })
      .order('seq', { ascending: false });

  const loadLatestRowsWithoutContentMode = async () =>
    supabase
      .from('messages')
      .select(
        'id, conversation_id, seq, sender_id, body, kind, deleted_at, created_at',
      )
      .in('conversation_id', uniqueConversationIds)
      .order('conversation_id', { ascending: true })
      .order('seq', { ascending: false });

  const responseWithContentMode = await loadLatestRowsWithContentMode();
  let rows: ConversationSummaryMessageRowWithConversationId[] = [];

  if (responseWithContentMode.error) {
    if (isMissingColumnErrorMessage(responseWithContentMode.error.message, 'content_mode')) {
      const fallbackResponse = await loadLatestRowsWithoutContentMode();

      if (fallbackResponse.error) {
        throw new Error(fallbackResponse.error.message);
      }

      rows =
        (fallbackResponse.data ?? []) as ConversationSummaryMessageRowWithConversationId[];
    } else {
      throw new Error(responseWithContentMode.error.message);
    }
  } else {
    rows =
      (responseWithContentMode.data ?? []) as ConversationSummaryMessageRowWithConversationId[];
  }

  const latestRowsByConversationId = new Map<
    string,
    ConversationSummaryMessageRowWithConversationId
  >();

  for (const row of rows) {
    const conversationId = row.conversation_id?.trim();

    if (!conversationId || latestRowsByConversationId.has(conversationId)) {
      continue;
    }

    const normalizedSeq = normalizeConversationLatestMessageSeq(row.seq ?? null);

    if (normalizedSeq === null) {
      continue;
    }

    latestRowsByConversationId.set(conversationId, row);
  }

  return latestRowsByConversationId;
}

async function loadLatestConversationSummaryMessageRow(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  conversationId: string,
) {
  const response = await supabase
    .from('messages')
    .select('id, seq, sender_id, body, kind, content_mode, deleted_at, created_at')
    .eq('conversation_id', conversationId)
    .order('seq', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (response.error) {
    if (isMissingColumnErrorMessage(response.error.message, 'content_mode')) {
      const fallback = await supabase
        .from('messages')
        .select('id, seq, sender_id, body, kind, deleted_at, created_at')
        .eq('conversation_id', conversationId)
        .order('seq', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fallback.error) {
        throw new Error(fallback.error.message);
      }

      return (fallback.data ?? null) as ConversationSummaryMessageRow | null;
    }

    throw new Error(response.error.message);
  }

  return (response.data ?? null) as ConversationSummaryMessageRow | null;
}

async function getInboxAttachmentPreviewKindsByMessageId(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  messageIds: string[],
) {
  const uniqueMessageIds = Array.from(new Set(messageIds.filter(Boolean)));

  if (uniqueMessageIds.length === 0) {
    return new Map<string, InboxAttachmentPreviewKind>();
  }

  const previewKindsByMessageId = new Map<string, InboxAttachmentPreviewKind>();
  const serviceSupabase = createSupabaseServiceRoleClient();
  const canIgnoreMessageAssetPreviewError = (message: string) =>
    isMissingRelationErrorMessage(message, 'message_asset_links') ||
    isMissingRelationErrorMessage(message, 'message_assets');
  const loadAssetRows = async (client: MessageAttachmentLookupClient) =>
    client
      .from('message_asset_links')
      .select('message_id, created_at, message_assets!inner(kind, mime_type)')
      .in('message_id', uniqueMessageIds)
      .order('created_at', { ascending: true });

  let assetResponse = await loadAssetRows(supabase);

  if (assetResponse.error) {
    if (!canIgnoreMessageAssetPreviewError(assetResponse.error.message) && serviceSupabase) {
      assetResponse = await loadAssetRows(
        serviceSupabase as MessageAttachmentLookupClient,
      );
    }

    if (assetResponse.error && !canIgnoreMessageAssetPreviewError(assetResponse.error.message)) {
      throw new Error(assetResponse.error.message);
    }
  }

  if (!assetResponse.error) {
    for (const row of (assetResponse.data ?? []) as MessageAssetPreviewRow[]) {
      if (previewKindsByMessageId.has(row.message_id)) {
        continue;
      }

      const asset = normalizeJoinedRecord(row.message_assets);

      if (!asset) {
        continue;
      }

      previewKindsByMessageId.set(
        row.message_id,
        resolveInboxAttachmentPreviewKindFromMetadata({
          assetKind: asset.kind,
          mimeType: asset.mime_type ?? null,
        }),
      );
    }
  }

  const remainingMessageIds = uniqueMessageIds.filter(
    (messageId) => !previewKindsByMessageId.has(messageId),
  );

  if (remainingMessageIds.length === 0) {
    return previewKindsByMessageId;
  }

  const loadLegacyRows = async (client: MessageAttachmentLookupClient) => {
    return client
      .from('message_attachments')
      .select('message_id, mime_type, created_at')
      .in('message_id', remainingMessageIds)
      .order('created_at', { ascending: true });
  };

  let response = await loadLegacyRows(supabase);

  if (response.error) {
    if (isMissingRelationErrorMessage(response.error.message, 'message_attachments')) {
      return previewKindsByMessageId;
    }

    if (!serviceSupabase) {
      throw new Error(response.error.message);
    }

    const serviceResponse = await loadLegacyRows(
      serviceSupabase as MessageAttachmentLookupClient,
    );

    if (serviceResponse.error) {
      if (
        isMissingRelationErrorMessage(
          serviceResponse.error.message,
          'message_attachments',
        )
      ) {
        return previewKindsByMessageId;
      }

      throw new Error(serviceResponse.error.message);
    }

    response = serviceResponse;
  }

  const rows = (response.data ?? []) as MessageAttachmentPreviewRow[];

  for (const row of rows) {
    if (previewKindsByMessageId.has(row.message_id)) {
      continue;
    }

    previewKindsByMessageId.set(
      row.message_id,
      resolveInboxAttachmentPreviewKind(row.mime_type),
    );
  }

  return previewKindsByMessageId;
}
