import 'server-only';

import { cookies } from 'next/headers';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service';
import { normalizeLanguage, type AppLanguage } from '@/modules/i18n';
import { buildMessageInsertPayload } from '@/modules/messaging/data/message-shell';
import { DM_E2EE_CURRENT_DEVICE_COOKIE } from '@/modules/messaging/e2ee/current-device-cookie';
import {
  applyConversationVisibility,
  isHiddenAtVisibilityRuntimeError,
} from '@/modules/messaging/data/visibility';
import type {
  DmE2eeApiErrorCode,
  DmE2eeBootstrapDebugState,
  DmE2eeDevicePublishResultKind,
  DmE2eeRecipientReadinessDebugState,
  DmE2eeRecipientBundleResponse,
  DmE2eeSendDebugState,
  DmE2eeSendRequest,
  PublishDmE2eeDeviceRequest,
  PublishDmE2eeDeviceResult,
  StoredDmE2eeEnvelope,
  UserDevicePublicBundle,
} from '@/modules/messaging/contract/dm-e2ee';

class DmE2eeOperationError extends Error {
  code: DmE2eeApiErrorCode;

  constructor(code: DmE2eeApiErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

export function isDmE2eeOperationError(
  error: unknown,
): error is DmE2eeOperationError {
  return (
    error instanceof Error &&
    'code' in error &&
    typeof (error as { code?: unknown }).code === 'string'
  );
}

function createDmE2eeOperationError(
  code: DmE2eeApiErrorCode,
  message: string,
) {
  return new DmE2eeOperationError(code, message);
}

function applyRecipientReadinessDebugState(
  error: Error,
  details?: DmE2eeRecipientReadinessDebugState,
) {
  const target = error as Error & DmE2eeRecipientReadinessDebugState;
  target.recipientBundleQueryStage = details?.recipientBundleQueryStage ?? null;
  target.recipientUserIdChecked = details?.recipientUserIdChecked ?? null;
  target.recipientDeviceRowsFound = details?.recipientDeviceRowsFound ?? null;
  target.recipientActiveDeviceRowsFound =
    details?.recipientActiveDeviceRowsFound ?? null;
  target.recipientSelectedDeviceRowId =
    details?.recipientSelectedDeviceRowId ?? null;
  target.recipientSelectedDeviceLogicalId =
    details?.recipientSelectedDeviceLogicalId ?? null;
  target.recipientSelectedDeviceRetiredAt =
    details?.recipientSelectedDeviceRetiredAt ?? null;
  target.recipientSelectedDeviceIdentityKeyPresent =
    details?.recipientSelectedDeviceIdentityKeyPresent ?? null;
  target.recipientSelectedDeviceSignedPrekeyPresent =
    details?.recipientSelectedDeviceSignedPrekeyPresent ?? null;
  target.recipientSelectedDeviceSignaturePresent =
    details?.recipientSelectedDeviceSignaturePresent ?? null;
  target.recipientSelectedDeviceAvailablePrekeyCount =
    details?.recipientSelectedDeviceAvailablePrekeyCount ?? null;
  target.recipientPrekeyQueryDeviceRef =
    details?.recipientPrekeyQueryDeviceRef ?? null;
  target.recipientBundleQueryErrorMessage =
    details?.recipientBundleQueryErrorMessage ?? null;
  target.recipientBundleQueryErrorCode =
    details?.recipientBundleQueryErrorCode ?? null;
  target.recipientBundleQueryErrorDetails =
    details?.recipientBundleQueryErrorDetails ?? null;
  target.recipientMismatchLeft = details?.recipientMismatchLeft ?? null;
  target.recipientMismatchRight = details?.recipientMismatchRight ?? null;
  target.recipientReadinessFailedReason =
    details?.recipientReadinessFailedReason ?? null;
  return target;
}

function createDmE2eeRecipientReadinessError(
  code: DmE2eeApiErrorCode,
  message: string,
  details?: DmE2eeRecipientReadinessDebugState,
) {
  return applyRecipientReadinessDebugState(
    createDmE2eeOperationError(code, message),
    details,
  );
}

function createDmE2eeRecipientLookupError(
  message: string,
  details?: DmE2eeRecipientReadinessDebugState,
) {
  return applyRecipientReadinessDebugState(new Error(message), details);
}

function applyDmE2eeSendDebugState(
  error: Error,
  details?: DmE2eeSendDebugState,
) {
  const target = error as Error & DmE2eeSendDebugState;
  target.sendExactFailureStage = details?.sendExactFailureStage ?? null;
  target.sendFailedOperation = details?.sendFailedOperation ?? null;
  target.sendReasonCode = details?.sendReasonCode ?? null;
  target.sendErrorMessage = details?.sendErrorMessage ?? null;
  target.sendErrorCode = details?.sendErrorCode ?? null;
  target.sendErrorDetails = details?.sendErrorDetails ?? null;
  target.sendErrorHint = details?.sendErrorHint ?? null;
  target.sendSelectedConversationId = details?.sendSelectedConversationId ?? null;
  target.sendSenderUserId = details?.sendSenderUserId ?? null;
  target.sendRecipientUserId = details?.sendRecipientUserId ?? null;
  target.sendSelectedSenderDeviceRowId =
    details?.sendSelectedSenderDeviceRowId ?? null;
  target.sendSelectedRecipientDeviceRowId =
    details?.sendSelectedRecipientDeviceRowId ?? null;
  return target;
}

function createDmE2eeSendProofError(
  message: string,
  details?: DmE2eeSendDebugState,
) {
  return applyDmE2eeSendDebugState(new Error(message), details);
}

function logDmE2eeRecipientBundleDiagnostics(
  stage: string,
  details?: Record<string, unknown>,
) {
  if (process.env.CHAT_DEBUG_DM_E2EE_BUNDLE !== '1') {
    return;
  }

  if (details) {
    console.info('[dm-e2ee-recipient-bundle]', stage, details);
    return;
  }

  console.info('[dm-e2ee-recipient-bundle]', stage);
}

function logDmE2eeSendDiagnostics(
  stage: string,
  details?: Record<string, unknown>,
) {
  if (process.env.CHAT_DEBUG_DM_E2EE_SEND !== '1') {
    return;
  }

  if (details) {
    console.info('[dm-e2ee-send]', stage, details);
    return;
  }

  console.info('[dm-e2ee-send]', stage);
}

function logDmE2eeBootstrapDiagnostics(
  stage: string,
  details?: Record<string, unknown>,
) {
  if (process.env.CHAT_DEBUG_DM_E2EE_BOOTSTRAP !== '1') {
    return;
  }

  if (details) {
    console.info('[dm-e2ee-bootstrap]', stage, details);
    return;
  }

  console.info('[dm-e2ee-bootstrap]', stage);
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

function isDmE2eeDevResetEnabled() {
  return (
    process.env.NODE_ENV !== 'production' ||
    process.env.CHAT_DEBUG_DM_E2EE_BOOTSTRAP === '1'
  );
}

type ConversationRecord = {
  id: string;
  kind: string | null;
  title?: string | null;
  avatar_path?: string | null;
  space_id?: string | null;
  created_by?: string | null;
  last_message_at?: string | null;
  created_at?: string | null;
};

type ConversationMemberRow = {
  conversation_id: string;
  state?: string | null;
  hidden_at?: string | null;
  notification_level?: string | null;
  last_read_message_seq?: number | null;
  last_read_at?: string | null;
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
  latestMessageBody: string | null;
  latestMessageKind: string | null;
  latestMessageContentMode: string | null;
  latestMessageDeletedAt: string | null;
  unreadCount: number;
};

export type ConversationNotificationLevel = 'default' | 'muted';

export type ConversationMessage = {
  id: string;
  conversation_id: string;
  sender_id: string | null;
  reply_to_message_id: string | null;
  seq: number | string;
  kind: string;
  client_id: string | null;
  body: string | null;
  content_mode?: string | null;
  sender_device_id?: string | null;
  edited_at: string | null;
  deleted_at: string | null;
  created_at: string | null;
};

type MessageAttachmentRow = {
  id: string;
  message_id: string;
  bucket: string;
  object_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string | null;
};

export type MessageAttachment = {
  id: string;
  messageId: string;
  bucket: string;
  objectPath: string;
  mimeType: string | null;
  sizeBytes: number | null;
  createdAt: string | null;
  fileName: string;
  signedUrl: string | null;
  isImage: boolean;
  isAudio: boolean;
  isVoiceMessage: boolean;
};

export type MessageSenderProfile = {
  userId: string;
  displayName: string | null;
  username?: string | null;
  email?: string | null;
  emailLocalPart?: string | null;
  avatarPath?: string | null;
};

export type AvailableUser = {
  userId: string;
  displayName: string | null;
  username?: string | null;
  email?: string | null;
  emailLocalPart?: string | null;
  avatarPath?: string | null;
};

export type CurrentUserProfile = {
  userId: string;
  email: string | null;
  displayName: string | null;
  avatarPath: string | null;
  preferredLanguage: AppLanguage | null;
};

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
};

export type ConversationMessageStats = {
  totalMessages: number;
  perSenderCount: Map<string, number>;
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

type MessageReactionRow = {
  id: string;
  message_id: string;
  emoji: string;
  user_id: string;
  created_at: string | null;
};

export type MessageReactionGroup = {
  emoji: string;
  count: number;
  selectedByCurrentUser: boolean;
};

type MessageE2eeEnvelopeRow = {
  message_id: string;
  recipient_device_id: string;
  envelope_type: string;
  ciphertext: string;
  used_one_time_prekey_id: number | null;
  created_at: string | null;
  messages:
    | { sender_device_id?: string | null }
    | Array<{ sender_device_id?: string | null }>
    | null;
};

export const STARTER_REACTIONS = ['❤️', '👍', '😂', '😮', '😢', '🎉'] as const;
export const CHAT_ATTACHMENT_MAX_SIZE_BYTES = 10 * 1024 * 1024;
export const CHAT_ATTACHMENT_ACCEPT =
  'image/jpeg,image/png,image/webp,image/gif,application/pdf,text/plain,audio/webm,audio/mp4,audio/mpeg,audio/ogg,audio/wav,audio/x-wav,audio/aac,audio/mp3,audio/m4a';
export const CHAT_ATTACHMENT_HELP_TEXT =
  'Supported files: JPG, PNG, WEBP, GIF, PDF, TXT, and common audio files up to 10 MB.';
export const PROFILE_AVATAR_MAX_SIZE_BYTES = 5 * 1024 * 1024;
export const PROFILE_AVATAR_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif';

const CHAT_ATTACHMENT_BUCKET =
  process.env.NEXT_PUBLIC_SUPABASE_ATTACHMENTS_BUCKET ?? 'message-attachments';
const PROFILE_AVATAR_BUCKET =
  process.env.SUPABASE_AVATARS_BUCKET?.trim() || 'avatars';
const SUPPORTED_ATTACHMENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'text/plain',
  'audio/webm',
  'audio/mp4',
  'audio/mpeg',
  'audio/ogg',
  'audio/wav',
  'audio/x-wav',
  'audio/aac',
  'audio/mp3',
  'audio/m4a',
]);
const SUPPORTED_VOICE_ATTACHMENT_TYPES = new Set([
  'audio/webm',
  'audio/mp4',
  'audio/ogg',
  'audio/mpeg',
  'audio/mp3',
  'audio/m4a',
  'audio/aac',
  'audio/wav',
  'audio/x-wav',
]);
const SUPPORTED_PROFILE_AVATAR_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

export function isSupportedChatAttachmentType(mimeType: string) {
  return SUPPORTED_ATTACHMENT_TYPES.has(mimeType);
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

function createDmE2eeBootstrapPublishError(
  failurePoint: string,
  message: string,
  details?: DmE2eeBootstrapDebugState,
) {
  const error = new Error(`[${failurePoint}] ${message}`) as Error &
    DmE2eeBootstrapDebugState;
  error.authRetireAttempted = details?.authRetireAttempted ?? null;
  error.authRetireFailed = details?.authRetireFailed ?? null;
  error.serviceRetireAvailable = details?.serviceRetireAvailable ?? null;
  error.serviceRetireSkipReason = details?.serviceRetireSkipReason ?? null;
  error.serviceRetireAttempted = details?.serviceRetireAttempted ?? null;
  error.serviceRetireSucceeded = details?.serviceRetireSucceeded ?? null;
  error.serviceRetireFailed = details?.serviceRetireFailed ?? null;
  error.serviceRetireErrorMessage = details?.serviceRetireErrorMessage ?? null;
  error.serviceRetireErrorCode = details?.serviceRetireErrorCode ?? null;
  error.serviceRetireErrorStatus = details?.serviceRetireErrorStatus ?? null;
  error.currentDeviceRowId = details?.currentDeviceRowId ?? null;
  error.retireTargetIds = details?.retireTargetIds ?? null;
  return error;
}

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

function logProfileSettingsDiagnostics(
  stage: string,
  details?: Record<string, unknown>,
) {
  if (details) {
    console.error('[profile-settings]', stage, details);
    return;
  }

  console.error('[profile-settings]', stage);
}

function isMissingRelationErrorMessage(message: string, relationName: string) {
  const normalizedMessage = message.toLowerCase();
  return (
    normalizedMessage.includes('relation') &&
    normalizedMessage.includes(relationName.toLowerCase())
  );
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

function isMissingFunctionErrorMessage(message: string, functionName: string) {
  const normalizedMessage = message.toLowerCase();
  return (
    (normalizedMessage.includes('function') ||
      normalizedMessage.includes('could not find the function')) &&
    normalizedMessage.includes(functionName.toLowerCase())
  );
}

export function isUniqueConstraintErrorMessage(message: string, constraintName?: string) {
  const normalizedMessage = message.toLowerCase();
  return (
    normalizedMessage.includes('duplicate key') ||
    normalizedMessage.includes('unique constraint') ||
    (constraintName ? normalizedMessage.includes(constraintName.toLowerCase()) : false)
  );
}

function uniqueNonEmptyLabels(labels: string[]) {
  return Array.from(
    new Set(labels.map((label) => label.trim()).filter(Boolean)),
  );
}

function buildDmConversationKey(leftUserId: string, rightUserId: string) {
  return [leftUserId, rightUserId].filter(Boolean).sort().join(':');
}

async function findExistingDmConversationByKey(input: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  creatorUserId: string;
  otherUserId: string;
  spaceId?: string | null;
}) {
  const dmConversationKey = buildDmConversationKey(
    input.creatorUserId,
    input.otherUserId,
  );

  let directKeyLookup = input.supabase
    .from('conversations')
    .select(
      input.spaceId
        ? 'id, kind, dm_key, space_id, created_at, last_message_at'
        : 'id, kind, dm_key, created_at, last_message_at',
    )
    .eq('kind', 'dm')
    .eq('dm_key', dmConversationKey);

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

  const match = ((data ?? []) as Array<{ id?: string | null }>)[0]?.id?.trim() || null;
  return match;
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

  const { data: candidateMembers, error: candidateMembersError } = await input.supabase
    .from('conversation_members')
    .select('conversation_id, user_id')
    .in(
      'conversation_id',
      candidateConversations.map((conversation) => conversation.conversationId),
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

export function getConversationParticipantSummary(
  participantLabels: string[],
  maxVisible?: number,
) {
  const labels = uniqueNonEmptyLabels(participantLabels);

  if (labels.length === 0) {
    return null;
  }

  if (!maxVisible || labels.length <= maxVisible) {
    return labels.join(', ');
  }

  const preview = labels.slice(0, maxVisible);
  const remaining = labels.length - preview.length;

  return `${preview.join(', ')} +${remaining}`;
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
    'conversation_id, state, last_read_message_seq, last_read_at';
  const baseMemberships = await supabase
    .from('conversation_members')
    .select(baseMembershipSelect)
    .eq('user_id', userId)
    .eq('state', 'active');

  if (baseMemberships.error) {
    logDiagnostics('base-memberships-error', {
      message: baseMemberships.error.message,
    });
    throw new Error(baseMemberships.error.message);
  }

  const membershipRows = (baseMemberships.data ?? []) as ConversationMemberRow[];
  logDiagnostics('base-memberships-ok', { count: membershipRows.length });

  const fallbackVisibleConversations = async () =>
    mapInboxConversations(
      await attachConversationsToMembershipRows(membershipRows, supabase, options),
      supabase,
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
    'conversation_id, state, last_read_message_seq, last_read_at';
  const baseMemberships = await supabase
    .from('conversation_members')
    .select(baseMembershipSelect)
    .eq('user_id', userId)
    .eq('state', 'active');

  if (baseMemberships.error) {
    throw new Error(baseMemberships.error.message);
  }

  const membershipRows = (baseMemberships.data ?? []) as ConversationMemberRow[];

  return mapInboxConversations(
    await attachConversationsToMembershipRows(membershipRows, supabase, options),
    supabase,
  );
}

async function attachConversationsToMembershipRows(
  rows: ConversationMemberRow[],
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  options?: {
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
    .select('id, kind, title, avatar_path, space_id, created_by, last_message_at, created_at')
    .in('id', conversationIds);

  let conversations = (data ?? null) as ConversationRecord[] | null;

  if (error) {
    const missingSpaceId = isMissingColumnErrorMessage(error.message, 'space_id');
    const missingAvatarPath = isMissingColumnErrorMessage(error.message, 'avatar_path');

    if (missingSpaceId || missingAvatarPath) {
      logConversationSchemaDiagnostics('attachConversationsToMembershipRows:select-error', {
        actualFailingColumn: missingAvatarPath
          ? 'avatar_path'
          : missingSpaceId
            ? 'space_id'
            : 'unknown',
        helper: 'attachConversationsToMembershipRows',
        message: error.message,
        requestedSpaceId: options?.spaceId ?? null,
        schemaCheckAvatarPathMissing: missingAvatarPath,
        schemaCheckSpaceIdMissing: missingSpaceId,
      });

      if (options?.spaceId && missingSpaceId) {
        logConversationSchemaDiagnostics('attachConversationsToMembershipRows:throw-space-id-required', {
          actualFailingColumn: missingAvatarPath
            ? 'avatar_path'
            : missingSpaceId
              ? 'space_id'
              : 'unknown',
          helper: 'attachConversationsToMembershipRows',
          message: error.message,
          requestedSpaceId: options.spaceId,
          schemaCheckAvatarPathMissing: missingAvatarPath,
          schemaCheckSpaceIdMissing: missingSpaceId,
        });
        throw createSchemaRequirementError(
          'Active space scoping requires public.conversations.space_id.',
        );
      }

      const fallback =
        missingAvatarPath && !missingSpaceId
          ? await supabase
              .from('conversations')
              .select('id, kind, title, space_id, created_by, last_message_at, created_at')
              .in('id', conversationIds)
          : await supabase
              .from('conversations')
              .select('id, kind, title, created_by, last_message_at, created_at')
              .in('id', conversationIds);

      if (fallback.error) {
        logConversationSchemaDiagnostics('attachConversationsToMembershipRows:fallback-error', {
          actualFailingColumn:
            isMissingColumnErrorMessage(fallback.error.message, 'avatar_path')
              ? 'avatar_path'
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
          schemaCheckSpaceIdMissing: isMissingColumnErrorMessage(
            fallback.error.message,
            'space_id',
          ),
        });
        throw new Error(fallback.error.message);
      }

      conversations = (fallback.data ?? null) as ConversationRecord[] | null;
    } else {
      throw new Error(error.message);
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
) {
  type LatestMessageRow = {
    conversation_id: string;
    id: string;
    seq: number | string;
    body: string | null;
    kind: string | null;
    content_mode?: string | null;
    deleted_at: string | null;
  };

  const conversationIds = rows.map((row) => row.conversation_id);
  const latestMessageSeqByConversation = new Map<string, number>();
  const latestMessageByConversation = new Map<
    string,
    {
      id: string | null;
      body: string | null;
      kind: string | null;
      contentMode: string | null;
      deletedAt: string | null;
    }
  >();
  const unreadCountByConversation = new Map<string, number>();

  if (conversationIds.length > 0) {
    const latestMessagesWithContentMode = await supabase
      .from('messages')
      .select('id, conversation_id, seq, body, kind, content_mode, deleted_at')
      .in('conversation_id', conversationIds)
      .order('conversation_id', { ascending: true })
      .order('seq', { ascending: false });

    let messageRows = (latestMessagesWithContentMode.data ?? null) as
      | LatestMessageRow[]
      | null;

    if (latestMessagesWithContentMode.error) {
      if (
        isMissingColumnErrorMessage(
          latestMessagesWithContentMode.error.message,
          'content_mode',
        )
      ) {
        const fallbackLatestMessages = await supabase
          .from('messages')
          .select('id, conversation_id, seq, body, kind, deleted_at')
          .in('conversation_id', conversationIds)
          .order('conversation_id', { ascending: true })
          .order('seq', { ascending: false });

        if (fallbackLatestMessages.error) {
          throw new Error(fallbackLatestMessages.error.message);
        }

        messageRows = (fallbackLatestMessages.data ?? null) as LatestMessageRow[] | null;
      } else {
        throw new Error(latestMessagesWithContentMode.error.message);
      }
    }

    for (const row of messageRows ?? []) {
      const messageSeq =
        typeof row.seq === 'number' ? row.seq : Number(row.seq);

      if (!Number.isFinite(messageSeq)) {
        continue;
      }

      if (!latestMessageSeqByConversation.has(row.conversation_id)) {
        latestMessageSeqByConversation.set(row.conversation_id, messageSeq);
        latestMessageByConversation.set(row.conversation_id, {
          id: row.id ?? null,
          body: row.body ?? null,
          kind: row.kind ?? null,
          contentMode: row.content_mode ?? null,
          deletedAt: row.deleted_at ?? null,
        });
      }
    }

    for (const membershipRow of rows) {
      const lastReadSeq =
        typeof membershipRow.last_read_message_seq === 'number'
          ? membershipRow.last_read_message_seq
          : null;
      const latestSeq =
        latestMessageSeqByConversation.get(membershipRow.conversation_id) ?? null;

      if (latestSeq === null) {
        unreadCountByConversation.set(membershipRow.conversation_id, 0);
        continue;
      }

      if (lastReadSeq === null) {
        unreadCountByConversation.set(membershipRow.conversation_id, latestSeq);
        continue;
      }

      unreadCountByConversation.set(
        membershipRow.conversation_id,
        Math.max(0, latestSeq - lastReadSeq),
      );
    }
  }

  const mappedRows = await Promise.all(
    rows.map(async (row) => {
      const conversation = normalizeConversation(row.conversations);
      const lastReadMessageSeq =
        typeof row.last_read_message_seq === 'number'
          ? row.last_read_message_seq
          : null;
      const latestMessageSeq =
        latestMessageSeqByConversation.get(row.conversation_id) ?? null;
      const latestMessage = latestMessageByConversation.get(row.conversation_id);
      const unreadCount =
        unreadCountByConversation.get(row.conversation_id) ?? 0;

      return {
        conversationId: row.conversation_id,
        spaceId: conversation?.space_id ?? null,
        kind: conversation?.kind ?? null,
        title: conversation?.title ?? null,
        avatarPath: await resolveStoredAvatarPath(
          supabase,
          conversation?.avatar_path ?? null,
        ),
        createdBy: conversation?.created_by ?? null,
        lastMessageAt: conversation?.last_message_at ?? null,
        createdAt: conversation?.created_at ?? null,
        hiddenAt: row.hidden_at ?? null,
        lastReadMessageSeq,
        lastReadAt: row.last_read_at ?? null,
        latestMessageId: latestMessage?.id ?? null,
        latestMessageSeq,
        latestMessageBody: latestMessage?.body ?? null,
        latestMessageKind: latestMessage?.kind ?? null,
        latestMessageContentMode: latestMessage?.contentMode ?? null,
        latestMessageDeletedAt: latestMessage?.deletedAt ?? null,
        unreadCount,
      };
    }),
  );

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
  const { data, error } = await supabase
    .from('conversation_members')
    .select('conversation_id, notification_level')
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
    .eq('state', 'active')
    .maybeSingle();

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
        options,
      );

      const fallbackConversation = normalizeConversation(scopedRow?.conversations ?? null);

      if (!fallbackConversation || !scopedRow) {
        return null;
      }

      return {
        conversationId: scopedRow.conversation_id,
        spaceId: fallbackConversation.space_id ?? null,
        kind: fallbackConversation.kind,
        title: fallbackConversation.title,
        avatarPath: await resolveStoredAvatarPath(
          supabase,
          fallbackConversation.avatar_path ?? null,
        ),
        createdBy: fallbackConversation.created_by ?? null,
        lastMessageAt: fallbackConversation.last_message_at,
        createdAt: fallbackConversation.created_at,
        notificationLevel: 'default' as const,
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
    options,
  );
  const conversation = normalizeConversation(scopedRow?.conversations ?? null);

  if (!conversation || !scopedRow) {
    return null;
  }

  return {
    conversationId: scopedRow.conversation_id,
    spaceId: conversation.space_id ?? null,
    kind: conversation.kind,
    title: conversation.title,
    avatarPath: await resolveStoredAvatarPath(
      supabase,
      conversation.avatar_path ?? null,
    ),
    createdBy: conversation.created_by ?? null,
    lastMessageAt: conversation.last_message_at,
    createdAt: conversation.created_at,
    notificationLevel:
      scopedRow.notification_level === 'muted' ? 'muted' : 'default',
  };
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
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('conversation_members')
    .select('created_at')
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
    .eq('state', 'active')
    .maybeSingle();

  if (error) {
    if (
      error.message.includes('created_at') ||
      error.message.includes('column')
    ) {
      return null;
    }

    throw new Error(error.message);
  }

  return typeof data?.created_at === 'string' ? data.created_at : null;
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

  const select = options?.includeRole
    ? 'conversation_id, user_id, role, state'
    : 'conversation_id, user_id';
  const supabase = await createSupabaseServerClient();
  const authResponse = await supabase
    .from('conversation_members')
    .select(select)
    .in('conversation_id', uniqueConversationIds)
    .eq('state', 'active');

  if (authResponse.error) {
    throw new Error(authResponse.error.message);
  }

  const mergedRows = new Map<
    string,
    ConversationMembershipRow
  >(
    ((authResponse.data ?? []) as unknown as ConversationMembershipRow[]).map(
      (row) => [`${row.conversation_id}:${row.user_id}`, row] as const,
    ),
  );

  const serviceSupabase = createSupabaseServiceRoleClient();

  if (serviceSupabase) {
    const serviceResponse = await serviceSupabase
      .from('conversation_members')
      .select(select)
      .in('conversation_id', uniqueConversationIds)
      .eq('state', 'active');

    if (!serviceResponse.error) {
      for (const row of (serviceResponse.data ?? []) as unknown as ConversationMembershipRow[]) {
        mergedRows.set(`${row.conversation_id}:${row.user_id}`, row);
      }
    }
  }

  return Array.from(mergedRows.values());
}

async function getActiveGroupMembership(
  conversationId: string,
  userId: string,
) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('conversation_members')
    .select('user_id, role, state, conversations!inner(id, kind)')
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
    .eq('state', 'active')
    .eq('conversations.kind', 'group')
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as
    | {
        user_id: string;
        role: string | null;
        state: string | null;
      }
    | null;
}

function dedupeParticipantIds(ids: string[]) {
  return Array.from(new Set(ids.map((value) => value.trim()).filter(Boolean)));
}

function sanitizeAttachmentFileName(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return 'attachment';
  }

  return trimmed
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function sanitizeProfileFileName(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return 'avatar';
  }

  return trimmed
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function isAbsoluteAvatarUrl(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  return value.startsWith('https://') || value.startsWith('http://');
}

function isManagedAvatarObjectPath(
  userId: string,
  value: string | null | undefined,
) {
  const normalizedValue = value?.trim() || null;

  if (!normalizedValue || isAbsoluteAvatarUrl(normalizedValue)) {
    return false;
  }

  return normalizedValue.startsWith(`${userId}/`);
}

function isManagedConversationAvatarObjectPath(
  conversationId: string,
  value: string | null | undefined,
) {
  const normalizedValue = value?.trim() || null;

  if (!normalizedValue || isAbsoluteAvatarUrl(normalizedValue)) {
    return false;
  }

  return normalizedValue.startsWith(`conversations/${conversationId}/`);
}

function isBucketNotFoundStorageErrorMessage(message: string) {
  return message.toLowerCase().includes('bucket not found');
}

function getAvatarBucketRequirementErrorMessage() {
  console.error('[avatar-storage]', {
    issue: 'bucket-not-found',
    bucket: PROFILE_AVATAR_BUCKET,
    setupSql: 'docs/sql/2026-04-03-avatars-storage-policies.sql',
  });

  return 'Avatar uploads are not available right now.';
}

const PROFILE_AVATAR_SIGNED_URL_TTL_SECONDS = 60 * 60 * 24;
const avatarDiagnosticsEnabled = process.env.CHAT_DEBUG_AVATARS === '1';
const AVATAR_SIGNED_URL_CACHE_TTL_MS =
  (PROFILE_AVATAR_SIGNED_URL_TTL_SECONDS - 60) * 1000;
const avatarSignedUrlCache = new Map<
  string,
  {
    source: 'auth' | 'service';
    url: string;
    expiresAt: number;
  }
>();
const avatarSignedUrlInflight = new Map<string, Promise<string | null>>();

async function resolveStoredAvatarPath(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  value: string | null | undefined,
) {
  const normalizedValue = value?.trim() || null;

  if (!normalizedValue) {
    return null;
  }

  if (isAbsoluteAvatarUrl(normalizedValue)) {
    return normalizedValue;
  }

  const cached = avatarSignedUrlCache.get(normalizedValue);

  if (cached && cached.expiresAt > Date.now()) {
    if (avatarDiagnosticsEnabled) {
      console.info('[avatar-storage]', {
        issue: 'signed-url-cache-hit',
        bucket: PROFILE_AVATAR_BUCKET,
        objectPath: normalizedValue,
        source: cached.source,
      });
    }
    return cached.url;
  }

  const inflight = avatarSignedUrlInflight.get(normalizedValue);

  if (inflight) {
    return inflight;
  }

  const nextLookup = (async () => {
    const signed = await supabase.storage
      .from(PROFILE_AVATAR_BUCKET)
      .createSignedUrl(normalizedValue, PROFILE_AVATAR_SIGNED_URL_TTL_SECONDS);

    if (!signed.error) {
      if (avatarDiagnosticsEnabled) {
        console.info('[avatar-storage]', {
          issue: 'signed-url-auth-ok',
          bucket: PROFILE_AVATAR_BUCKET,
          objectPath: normalizedValue,
        });
      }
      avatarSignedUrlCache.set(normalizedValue, {
        source: 'auth',
        url: signed.data.signedUrl,
        expiresAt: Date.now() + AVATAR_SIGNED_URL_CACHE_TTL_MS,
      });
      return signed.data.signedUrl;
    }

    const serviceSupabase = createSupabaseServiceRoleClient();

    if (serviceSupabase) {
      const serviceSigned = await serviceSupabase.storage
        .from(PROFILE_AVATAR_BUCKET)
        .createSignedUrl(normalizedValue, PROFILE_AVATAR_SIGNED_URL_TTL_SECONDS);

      if (!serviceSigned.error) {
        if (avatarDiagnosticsEnabled) {
          console.info('[avatar-storage]', {
            issue: 'signed-url-service-fallback',
            bucket: PROFILE_AVATAR_BUCKET,
            objectPath: normalizedValue,
          });
        }
        avatarSignedUrlCache.set(normalizedValue, {
          source: 'service',
          url: serviceSigned.data.signedUrl,
          expiresAt: Date.now() + AVATAR_SIGNED_URL_CACHE_TTL_MS,
        });
        return serviceSigned.data.signedUrl;
      }

      console.error('[avatar-storage]', {
        issue: 'signed-url-service-failed',
        bucket: PROFILE_AVATAR_BUCKET,
        objectPath: normalizedValue,
        message: serviceSigned.error.message,
      });
    }

    console.error('[avatar-storage]', {
      issue: 'signed-url-failed',
      bucket: PROFILE_AVATAR_BUCKET,
      objectPath: normalizedValue,
      message: signed.error.message,
    });

    return null;
  })();

  avatarSignedUrlInflight.set(normalizedValue, nextLookup);

  try {
    return await nextLookup;
  } finally {
    avatarSignedUrlInflight.delete(normalizedValue);
  }
}

function getAttachmentFileName(objectPath: string) {
  const rawName = objectPath.split('/').pop()?.trim() || 'attachment';

  try {
    return decodeURIComponent(rawName);
  } catch {
    return rawName;
  }
}

function isImageAttachment(mimeType: string | null) {
  return Boolean(mimeType?.startsWith('image/'));
}

export function isAudioAttachment(mimeType: string | null) {
  return Boolean(mimeType?.startsWith('audio/'));
}

export function isSupportedVoiceAttachmentType(mimeType: string | null) {
  return Boolean(mimeType && SUPPORTED_VOICE_ATTACHMENT_TYPES.has(mimeType));
}

function getAttachmentMessageKind(mimeType: string | null) {
  if (isSupportedVoiceAttachmentType(mimeType)) {
    return 'voice' as const;
  }

  return 'text' as const;
}

export async function getProfileIdentities(userIds: string[]) {
  const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));

  if (uniqueUserIds.length === 0) {
    return [] as MessageSenderProfile[];
  }

  const supabase = await createSupabaseServerClient();
  const serviceSupabase = createSupabaseServiceRoleClient();
  const loadProfiles = async (
    client: Awaited<ReturnType<typeof createSupabaseServerClient>>,
    ids: string[],
  ) => {
    const withIdentityFallbacksAndAvatars = await client
      .from('profiles')
      .select('user_id, display_name, username, email_local_part, avatar_path')
      .in('user_id', ids);

    if (!withIdentityFallbacksAndAvatars.error) {
      const profiles = ((withIdentityFallbacksAndAvatars.data ?? []) as {
        user_id: string;
        display_name: string | null;
        username?: string | null;
        email_local_part?: string | null;
        avatar_path?: string | null;
      }[]);

      return Promise.all(
        profiles.map(async (profile) => ({
          userId: profile.user_id,
          displayName: profile.display_name?.trim() || null,
          username: profile.username?.trim() || null,
          emailLocalPart: profile.email_local_part?.trim() || null,
          avatarPath: await resolveStoredAvatarPath(client, profile.avatar_path),
        })),
      );
    }

    const withDisplayNamesAndAvatars = await client
      .from('profiles')
      .select('user_id, display_name, avatar_path')
      .in('user_id', ids);

    if (!withDisplayNamesAndAvatars.error) {
      const profiles = ((withDisplayNamesAndAvatars.data ?? []) as {
        user_id: string;
        display_name: string | null;
        avatar_path?: string | null;
      }[]);

      return Promise.all(
        profiles.map(async (profile) => ({
          userId: profile.user_id,
          displayName: profile.display_name?.trim() || null,
          username: null,
          emailLocalPart: null,
          avatarPath: await resolveStoredAvatarPath(client, profile.avatar_path),
        })),
      );
    }

    const withIdentityFallbacks = await client
      .from('profiles')
      .select('user_id, display_name, username, email_local_part')
      .in('user_id', ids);

    if (!withIdentityFallbacks.error) {
      return ((withIdentityFallbacks.data ?? []) as {
        user_id: string;
        display_name: string | null;
        username?: string | null;
        email_local_part?: string | null;
      }[]).map((profile) => ({
        userId: profile.user_id,
        displayName: profile.display_name?.trim() || null,
        username: profile.username?.trim() || null,
        emailLocalPart: profile.email_local_part?.trim() || null,
        avatarPath: null,
      }));
    }

    const withDisplayNames = await client
      .from('profiles')
      .select('user_id, display_name')
      .in('user_id', ids);

    if (!withDisplayNames.error) {
      return ((withDisplayNames.data ?? []) as {
        user_id: string;
        display_name: string | null;
      }[]).map((profile) => ({
        userId: profile.user_id,
        displayName: profile.display_name?.trim() || null,
        username: null,
        emailLocalPart: null,
        avatarPath: null,
      }));
    }

    const fallback = await client.from('profiles').select('user_id').in('user_id', ids);

    if (fallback.error) {
      throw new Error(fallback.error.message);
    }

    return ((fallback.data ?? []) as { user_id: string }[]).map((profile) => ({
      userId: profile.user_id,
      displayName: null,
      username: null,
      emailLocalPart: null,
      avatarPath: null,
    }));
  };
  const mergeIdentity = (
    base: MessageSenderProfile | undefined,
    fallback: MessageSenderProfile,
  ) => ({
    userId: fallback.userId,
    displayName: base?.displayName ?? fallback.displayName ?? null,
    username: base?.username ?? fallback.username ?? null,
    emailLocalPart: base?.emailLocalPart ?? fallback.emailLocalPart ?? null,
    avatarPath: base?.avatarPath ?? fallback.avatarPath ?? null,
  });

  const authProfiles = await loadProfiles(supabase, uniqueUserIds);
  const profilesByUserId = new Map(
    authProfiles.map((profile) => [profile.userId, profile]),
  );

  const missingUserIds = uniqueUserIds.filter(
    (userId) => !profilesByUserId.has(userId),
  );

  if (missingUserIds.length > 0 && serviceSupabase) {
    // DM titles and avatars must reflect the counterpart's current public profile
    // identity even when auth-scoped profile reads are narrower than chat UX needs.
    const fallbackProfiles = await loadProfiles(serviceSupabase, missingUserIds);

    for (const profile of fallbackProfiles) {
      profilesByUserId.set(
        profile.userId,
        mergeIdentity(profilesByUserId.get(profile.userId), profile),
      );
    }
  }

  const orderedProfiles: MessageSenderProfile[] = [];

  for (const userId of uniqueUserIds) {
    const profile = profilesByUserId.get(userId);

    if (profile) {
      orderedProfiles.push(profile);
    }
  }

  return orderedProfiles;
}

export async function getCurrentUserProfile(userId: string, email?: string | null) {
  const supabase = await createSupabaseServerClient();
  const [identity] = await getProfileIdentities([userId]);
  let preferredLanguage: AppLanguage | null = null;

  const withLanguage = await supabase
    .from('profiles')
    .select('preferred_language')
    .eq('user_id', userId)
    .maybeSingle();

  if (!withLanguage.error) {
    const rawLanguage = (
      withLanguage.data as { preferred_language?: string | null } | null
    )?.preferred_language;
    preferredLanguage = rawLanguage ? normalizeLanguage(rawLanguage) : null;
  } else if (!isMissingColumnErrorMessage(withLanguage.error.message, 'preferred_language')) {
    throw new Error(withLanguage.error.message);
  }

  return {
    userId,
    email: email?.trim() || null,
    displayName: identity?.displayName ?? null,
    avatarPath: identity?.avatarPath ?? null,
    preferredLanguage,
  } satisfies CurrentUserProfile;
}

export async function getStoredProfileLanguage(userId: string) {
  const supabase = await createSupabaseServerClient();
  const response = await supabase
    .from('profiles')
    .select('preferred_language')
    .eq('user_id', userId)
    .maybeSingle();

  if (!response.error) {
    const rawLanguage = (
      response.data as { preferred_language?: string | null } | null
    )?.preferred_language;
    return rawLanguage ? normalizeLanguage(rawLanguage) : null;
  }

  if (isMissingColumnErrorMessage(response.error.message, 'preferred_language')) {
    return null;
  }

  throw new Error(response.error.message);
}

export async function publishCurrentUserDmE2eeDevice(
  input: PublishDmE2eeDeviceRequest & { userId: string },
) {
  const supabase = await createSupabaseServerClient();
  const now = new Date().toISOString();
  let resultKind: DmE2eeDevicePublishResultKind = 'first_publish';
  logDmE2eeBootstrapDiagnostics('publish:start', {
    hasUserId: Boolean(input.userId),
    oneTimePrekeyCount: input.oneTimePrekeys.length,
  });

  const profileLookup = await supabase
    .from('profiles')
    .select('user_id')
    .eq('user_id', input.userId)
    .maybeSingle();

  if (profileLookup.error) {
    logDmE2eeBootstrapDiagnostics('publish:profile-lookup-error', {
      message: profileLookup.error.message,
    });

    if (
      isMissingRelationErrorMessage(profileLookup.error.message, 'profiles') ||
      isMissingColumnErrorMessage(profileLookup.error.message, 'user_id')
    ) {
      throw createSchemaRequirementError(
        'DM E2EE bootstrap schema is missing.',
      );
    }

    throw createDmE2eeBootstrapPublishError(
      'profile lookup',
      profileLookup.error.message,
    );
  }

  if (!profileLookup.data) {
    logDmE2eeBootstrapDiagnostics('publish:profile-missing-insert:start');
    const profileInsert = await supabase.from('profiles').insert({
      user_id: input.userId,
    });

    if (profileInsert.error) {
      logDmE2eeBootstrapDiagnostics('publish:profile-missing-insert:error', {
        message: profileInsert.error.message,
      });

      if (
        isMissingRelationErrorMessage(profileInsert.error.message, 'profiles') ||
        isMissingColumnErrorMessage(profileInsert.error.message, 'user_id')
      ) {
        throw createSchemaRequirementError(
          'DM E2EE bootstrap schema is missing.',
        );
      }

      throw createDmE2eeBootstrapPublishError(
        'profile seed insert',
        `DM E2EE profile seed failed: ${profileInsert.error.message}`,
      );
    }

    logDmE2eeBootstrapDiagnostics('publish:profile-missing-insert:ok');
  } else {
    logDmE2eeBootstrapDiagnostics('publish:profile-existing');
  }

  const existingDeviceLookup = await supabase
    .from('user_devices')
    .select(
      'id, device_id, registration_id, identity_key_public, signed_prekey_id, signed_prekey_public, signed_prekey_signature, retired_at',
    )
    .eq('user_id', input.userId)
    .eq('device_id', input.deviceId)
    .maybeSingle();

  if (existingDeviceLookup.error) {
    if (
      isMissingRelationErrorMessage(existingDeviceLookup.error.message, 'user_devices') ||
      isMissingColumnErrorMessage(existingDeviceLookup.error.message, 'identity_key_public') ||
      isMissingColumnErrorMessage(existingDeviceLookup.error.message, 'signed_prekey_public')
    ) {
      throw createSchemaRequirementError(
        'DM E2EE bootstrap schema is missing.',
      );
    }

    throw createDmE2eeBootstrapPublishError(
      'existing device lookup',
      existingDeviceLookup.error.message,
    );
  }

  const existingDevice = existingDeviceLookup.data as
    | {
        id?: string | null;
        registration_id?: number | null;
        identity_key_public?: string | null;
        signed_prekey_id?: number | null;
        signed_prekey_public?: string | null;
        signed_prekey_signature?: string | null;
        retired_at?: string | null;
      }
    | null;
  const existingDeviceRecordId = String(existingDevice?.id ?? '').trim() || null;
  const hasExistingActiveSameDevice =
    Boolean(existingDeviceRecordId) && !existingDevice?.retired_at;
  const sameDevicePayloadMatches =
    hasExistingActiveSameDevice &&
    existingDevice?.registration_id === input.registrationId &&
    (existingDevice?.identity_key_public?.trim() ?? '') ===
      input.identityKeyPublic.trim() &&
    existingDevice?.signed_prekey_id === input.signedPrekeyId &&
    (existingDevice?.signed_prekey_public?.trim() ?? '') ===
      input.signedPrekeyPublic.trim() &&
    (existingDevice?.signed_prekey_signature?.trim() ?? '') ===
      input.signedPrekeySignature.trim();

  if (hasExistingActiveSameDevice && !sameDevicePayloadMatches) {
    logDmE2eeBootstrapDiagnostics('publish:conflicting-device-publish', {
      current_device_row_id: existingDeviceRecordId,
      device_id: input.deviceId,
      user_id_present: Boolean(input.userId),
    });
    throw createDmE2eeBootstrapPublishError(
      'conflicting device publish',
      'Conflicting DM E2EE publish detected for an existing device id.',
    );
  }

  if (hasExistingActiveSameDevice) {
    const activePrekeyLookup = await supabase
      .from('device_one_time_prekeys')
      .select('prekey_id', { count: 'exact' })
      .eq('device_id', existingDeviceRecordId)
      .is('claimed_at', null)
      .limit(1);

    if (activePrekeyLookup.error) {
      if (
        isMissingRelationErrorMessage(
          activePrekeyLookup.error.message,
          'device_one_time_prekeys',
        ) ||
        isMissingColumnErrorMessage(activePrekeyLookup.error.message, 'claimed_at')
      ) {
        throw createSchemaRequirementError(
          'DM E2EE bootstrap schema is missing.',
        );
      }

      throw createDmE2eeBootstrapPublishError(
        'existing device prekey lookup',
        activePrekeyLookup.error.message,
      );
    }

    const sameDeviceAvailablePrekeyCount = Number(activePrekeyLookup.count ?? 0);
    const otherActiveDevicesLookup = await supabase
      .from('user_devices')
      .select('id', { count: 'exact' })
      .eq('user_id', input.userId)
      .neq('id', existingDeviceRecordId)
      .is('retired_at', null)
      .limit(1);

    if (otherActiveDevicesLookup.error) {
      throw createDmE2eeBootstrapPublishError(
        'existing device sibling lookup',
        otherActiveDevicesLookup.error.message,
      );
    }

    const otherActiveDeviceCount = Number(otherActiveDevicesLookup.count ?? 0);
    const sameDeviceReady =
      sameDeviceAvailablePrekeyCount > 0 && otherActiveDeviceCount === 0;

    if (sameDeviceReady) {
      const touchExistingDevice = await supabase
        .from('user_devices')
        .update({
          last_seen_at: now,
          retired_at: null,
        })
        .eq('id', existingDeviceRecordId)
        .select('id')
        .single();

      if (touchExistingDevice.error) {
        throw createDmE2eeBootstrapPublishError(
          'existing device touch',
          touchExistingDevice.error.message,
        );
      }

      logDmE2eeBootstrapDiagnostics('publish:already-initialized-same-device', {
        current_device_row_id: existingDeviceRecordId,
        available_prekey_count: sameDeviceAvailablePrekeyCount,
      });

      return {
        deviceRecordId: existingDeviceRecordId as string,
        publishedPrekeyCount: 0,
        resultKind: 'already_initialized_same_device',
      } satisfies PublishDmE2eeDeviceResult;
    }

    resultKind = 'refresh_existing_device';
  }

  const userDevices = await supabase
    .from('user_devices')
    .upsert(
      {
        user_id: input.userId,
        device_id: input.deviceId,
        registration_id: input.registrationId,
        identity_key_public: input.identityKeyPublic,
        signed_prekey_id: input.signedPrekeyId,
        signed_prekey_public: input.signedPrekeyPublic,
        signed_prekey_signature: input.signedPrekeySignature,
        last_seen_at: now,
        retired_at: null,
      },
      {
        onConflict: 'user_id,device_id',
      },
    )
    .select('id')
    .single();

  if (userDevices.error) {
    logDmE2eeBootstrapDiagnostics('publish:user-devices-error', {
      message: userDevices.error.message,
    });
    if (
      isMissingRelationErrorMessage(userDevices.error.message, 'user_devices') ||
      isMissingColumnErrorMessage(userDevices.error.message, 'identity_key_public') ||
      isMissingColumnErrorMessage(userDevices.error.message, 'signed_prekey_public')
    ) {
      throw createSchemaRequirementError(
        'DM E2EE bootstrap schema is missing.',
      );
    }

    throw createDmE2eeBootstrapPublishError(
      'user device upsert',
      userDevices.error.message,
    );
  }

  const deviceRecordId = String((userDevices.data as { id: string } | null)?.id ?? '').trim();

  if (!deviceRecordId) {
    throw createDmE2eeBootstrapPublishError(
      'persist device identity',
      'Unable to persist DM E2EE device identity.',
    );
  }
  logDmE2eeBootstrapDiagnostics('publish:user-device-ok');

  const serviceRoleSupabase = createSupabaseServiceRoleClient();
  const serviceRetireAvailable = Boolean(serviceRoleSupabase);
  const retireOtherDevices = async (
    client: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  ) =>
    client
      .from('user_devices')
      .update({
        retired_at: now,
      })
      .eq('user_id', input.userId)
      .neq('id', deviceRecordId)
      .is('retired_at', null);

  const listOtherActiveDevices = async (
    client: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  ) =>
    client
      .from('user_devices')
      .select('id')
      .eq('user_id', input.userId)
      .neq('id', deviceRecordId)
      .is('retired_at', null);

  const summarizeOtherActiveDevices = (
    rows: Array<{ id: string }> | null | undefined,
  ) => {
    const ids = (rows ?? [])
      .map((row) => String(row.id ?? '').trim())
      .filter(Boolean);

    return {
      otherDeviceIds: ids,
      otherDeviceCount: ids.length,
      includesCurrentDevice: ids.includes(deviceRecordId),
    };
  };

  const otherActiveDevicesLookup = await listOtherActiveDevices(supabase);

  if (otherActiveDevicesLookup.error) {
    logDmE2eeBootstrapDiagnostics('publish:retire-others:prepare-error', {
      current_device_row_id: deviceRecordId,
      message: otherActiveDevicesLookup.error.message,
    });
    throw createDmE2eeBootstrapPublishError(
      'retire other devices: prepare failed',
      otherActiveDevicesLookup.error.message,
      {
        currentDeviceRowId: deviceRecordId,
      },
    );
  }

  const otherActiveDevices = summarizeOtherActiveDevices(
    otherActiveDevicesLookup.data as Array<{ id: string }> | null,
  );

  logDmE2eeBootstrapDiagnostics('publish:retire-others:prepare', {
    current_device_row_id: deviceRecordId,
    other_device_count: otherActiveDevices.otherDeviceCount,
    includes_current_device: otherActiveDevices.includesCurrentDevice,
    retire_target_ids: otherActiveDevices.otherDeviceIds,
    auth_retire_attempted: false,
    auth_retire_failed: false,
    service_retire_available: serviceRetireAvailable,
    service_retire_skip_reason: null,
    service_retire_attempted: false,
    service_retire_succeeded: false,
    service_retire_failed: false,
    service_retire_error_message: null,
    service_retire_error_code: null,
    service_retire_error_status: null,
  });

  if (otherActiveDevices.includesCurrentDevice) {
    logDmE2eeBootstrapDiagnostics('publish:retire-others:current-device-included', {
      current_device_row_id: deviceRecordId,
      other_device_count: otherActiveDevices.otherDeviceCount,
      includes_current_device: true,
      retire_target_ids: otherActiveDevices.otherDeviceIds,
      service_retire_available: serviceRetireAvailable,
      service_retire_skip_reason: 'current device included by mistake',
    });
    throw createDmE2eeBootstrapPublishError(
      'retire other devices: current device included by mistake',
      'The current device row was unexpectedly included in the retire-others candidate set.',
      {
        serviceRetireAvailable,
        serviceRetireSkipReason: 'current device included by mistake',
        currentDeviceRowId: deviceRecordId,
        retireTargetIds: otherActiveDevices.otherDeviceIds,
      },
    );
  }

  if (otherActiveDevices.otherDeviceCount === 0) {
    logDmE2eeBootstrapDiagnostics('publish:retire-others:none-found', {
      current_device_row_id: deviceRecordId,
      other_device_count: 0,
      includes_current_device: false,
      retire_target_ids: [],
      auth_retire_attempted: false,
      auth_retire_failed: false,
      service_retire_available: serviceRetireAvailable,
      service_retire_skip_reason: 'no retire targets',
      service_retire_attempted: false,
      service_retire_succeeded: false,
      service_retire_failed: false,
      service_retire_error_message: null,
      service_retire_error_code: null,
      service_retire_error_status: null,
    });
  } else {
    logDmE2eeBootstrapDiagnostics('publish:retire-others:auth-attempt', {
      current_device_row_id: deviceRecordId,
      other_device_count: otherActiveDevices.otherDeviceCount,
      includes_current_device: false,
      retire_target_ids: otherActiveDevices.otherDeviceIds,
      auth_retire_attempted: true,
      auth_retire_failed: false,
      service_retire_available: serviceRetireAvailable,
      service_retire_skip_reason: null,
      service_retire_attempted: false,
      service_retire_succeeded: false,
      service_retire_failed: false,
      service_retire_error_message: null,
      service_retire_error_code: null,
      service_retire_error_status: null,
    });
  }

  let retireOthers = otherActiveDevices.otherDeviceCount
    ? await retireOtherDevices(supabase)
    : { error: null };
  let usedPrivilegedRetireOthers = false;

  if (retireOthers.error) {
    const authErrorDiagnostics = getSupabaseErrorDiagnostics(retireOthers.error);
    logDmE2eeBootstrapDiagnostics('publish:retire-others:auth-failed', {
      current_device_row_id: deviceRecordId,
      other_device_count: otherActiveDevices.otherDeviceCount,
      retire_target_ids: otherActiveDevices.otherDeviceIds,
      auth_retire_attempted: true,
      auth_retire_failed: true,
      service_retire_available: serviceRetireAvailable,
      service_retire_skip_reason: serviceRetireAvailable
        ? null
        : 'service client unavailable',
      service_retire_attempted: false,
      service_retire_succeeded: false,
      service_retire_failed: false,
      service_retire_error_message: null,
      service_retire_error_code: null,
      service_retire_error_status: null,
      message: retireOthers.error.message,
      ...authErrorDiagnostics,
    });

    if (!serviceRoleSupabase) {
      logDmE2eeBootstrapDiagnostics('publish:retire-others:service-unavailable', {
        current_device_row_id: deviceRecordId,
        other_device_count: otherActiveDevices.otherDeviceCount,
        retire_target_ids: otherActiveDevices.otherDeviceIds,
        auth_retire_attempted: true,
        auth_retire_failed: true,
        service_retire_available: false,
        service_retire_skip_reason: 'service client unavailable',
        service_retire_attempted: false,
        service_retire_succeeded: false,
        service_retire_failed: false,
        service_retire_error_message: null,
        service_retire_error_code: null,
        service_retire_error_status: null,
      });
      throw createDmE2eeBootstrapPublishError(
        'retire other devices: service fallback unavailable',
        retireOthers.error.message,
        {
          authRetireAttempted: true,
          authRetireFailed: true,
          serviceRetireAvailable: false,
          serviceRetireSkipReason: 'service client unavailable',
          serviceRetireAttempted: false,
          serviceRetireSucceeded: false,
          serviceRetireFailed: false,
          serviceRetireErrorMessage: null,
          serviceRetireErrorCode: null,
          serviceRetireErrorStatus: null,
          currentDeviceRowId: deviceRecordId,
          retireTargetIds: otherActiveDevices.otherDeviceIds,
        },
      );
    }

    logDmE2eeBootstrapDiagnostics('publish:retire-others:service-entered', {
      current_device_row_id: deviceRecordId,
      other_device_count: otherActiveDevices.otherDeviceCount,
      retire_target_ids: otherActiveDevices.otherDeviceIds,
      auth_retire_attempted: true,
      auth_retire_failed: true,
      service_retire_available: true,
      service_retire_skip_reason: null,
      service_retire_attempted: true,
      service_retire_succeeded: false,
      service_retire_failed: false,
      service_retire_error_message: null,
      service_retire_error_code: null,
      service_retire_error_status: null,
    });
    const privilegedRetireOthers = await retireOtherDevices(serviceRoleSupabase);

    if (privilegedRetireOthers.error) {
      const serviceErrorDiagnostics = getSupabaseErrorDiagnostics(
        privilegedRetireOthers.error,
      );
      logDmE2eeBootstrapDiagnostics('publish:retire-others:service-failed', {
        current_device_row_id: deviceRecordId,
        other_device_count: otherActiveDevices.otherDeviceCount,
        retire_target_ids: otherActiveDevices.otherDeviceIds,
        auth_retire_attempted: true,
        auth_retire_failed: true,
        service_retire_available: true,
        service_retire_skip_reason: null,
        service_retire_attempted: true,
        service_retire_succeeded: false,
        service_retire_failed: true,
        service_retire_error_message: privilegedRetireOthers.error.message,
        service_retire_error_code: serviceErrorDiagnostics.error_code,
        service_retire_error_status: serviceErrorDiagnostics.error_status,
        message: privilegedRetireOthers.error.message,
        ...serviceErrorDiagnostics,
      });
      throw createDmE2eeBootstrapPublishError(
        'retire other devices: service fallback failed',
        privilegedRetireOthers.error.message,
        {
          authRetireAttempted: true,
          authRetireFailed: true,
          serviceRetireAvailable: true,
          serviceRetireSkipReason: null,
          serviceRetireAttempted: true,
          serviceRetireSucceeded: false,
          serviceRetireFailed: true,
          serviceRetireErrorMessage: privilegedRetireOthers.error.message,
          serviceRetireErrorCode:
            serviceErrorDiagnostics.error_code ?? null,
          serviceRetireErrorStatus:
            serviceErrorDiagnostics.error_status !== null &&
            serviceErrorDiagnostics.error_status !== undefined
              ? String(serviceErrorDiagnostics.error_status)
              : null,
          currentDeviceRowId: deviceRecordId,
          retireTargetIds: otherActiveDevices.otherDeviceIds,
        },
      );
    }

    retireOthers = privilegedRetireOthers;
    usedPrivilegedRetireOthers = true;
    logDmE2eeBootstrapDiagnostics('publish:retire-others:service-succeeded', {
      current_device_row_id: deviceRecordId,
      other_device_count: otherActiveDevices.otherDeviceCount,
      retire_target_ids: otherActiveDevices.otherDeviceIds,
      auth_retire_attempted: true,
      auth_retire_failed: true,
      service_retire_available: true,
      service_retire_skip_reason: null,
      service_retire_attempted: true,
      service_retire_succeeded: true,
      service_retire_failed: false,
      service_retire_error_message: null,
      service_retire_error_code: null,
      service_retire_error_status: null,
    });
  }

  const verifyRemainingOtherActiveDevices = await listOtherActiveDevices(
    usedPrivilegedRetireOthers && serviceRoleSupabase
      ? serviceRoleSupabase
      : supabase,
  );

  if (verifyRemainingOtherActiveDevices.error) {
    logDmE2eeBootstrapDiagnostics('publish:retire-others:verify-error', {
      current_device_row_id: deviceRecordId,
      other_device_count: otherActiveDevices.otherDeviceCount,
      retire_target_ids: otherActiveDevices.otherDeviceIds,
      auth_retire_attempted: otherActiveDevices.otherDeviceCount > 0,
      auth_retire_failed: Boolean(retireOthers.error),
      service_retire_available: serviceRetireAvailable,
      service_retire_skip_reason: null,
      service_retire_attempted: usedPrivilegedRetireOthers,
      service_retire_succeeded: usedPrivilegedRetireOthers,
      service_retire_failed: false,
      service_retire_error_message: null,
      service_retire_error_code: null,
      service_retire_error_status: null,
      message: verifyRemainingOtherActiveDevices.error.message,
    });
    throw createDmE2eeBootstrapPublishError(
      usedPrivilegedRetireOthers
        ? 'retire other devices: service fallback failed'
        : 'retire other devices: update returned unexpected result',
      verifyRemainingOtherActiveDevices.error.message,
      {
        authRetireAttempted: otherActiveDevices.otherDeviceCount > 0,
        authRetireFailed: false,
        serviceRetireAvailable,
        serviceRetireSkipReason: null,
        serviceRetireAttempted: usedPrivilegedRetireOthers,
        serviceRetireSucceeded: usedPrivilegedRetireOthers,
        serviceRetireFailed: false,
        serviceRetireErrorMessage: null,
        serviceRetireErrorCode: null,
        serviceRetireErrorStatus: null,
        currentDeviceRowId: deviceRecordId,
        retireTargetIds: otherActiveDevices.otherDeviceIds,
      },
    );
  }

  const remainingOtherActiveDevices = summarizeOtherActiveDevices(
    verifyRemainingOtherActiveDevices.data as Array<{ id: string }> | null,
  );

  if (remainingOtherActiveDevices.otherDeviceCount > 0) {
    logDmE2eeBootstrapDiagnostics('publish:retire-others:remaining-active', {
      current_device_row_id: deviceRecordId,
      other_device_count: otherActiveDevices.otherDeviceCount,
      retire_target_ids: otherActiveDevices.otherDeviceIds,
      remaining_other_device_count: remainingOtherActiveDevices.otherDeviceCount,
      auth_retire_attempted: otherActiveDevices.otherDeviceCount > 0,
      auth_retire_failed: false,
      service_retire_available: serviceRetireAvailable,
      service_retire_skip_reason: null,
      service_retire_attempted: usedPrivilegedRetireOthers,
      service_retire_succeeded: usedPrivilegedRetireOthers,
      service_retire_failed: false,
      service_retire_error_message: null,
      service_retire_error_code: null,
      service_retire_error_status: null,
    });
    throw createDmE2eeBootstrapPublishError(
      usedPrivilegedRetireOthers
        ? 'retire other devices: rows still active after fallback'
        : 'retire other devices: update returned unexpected result',
      'Other active device rows remained after the retire-others update.',
      {
        authRetireAttempted: otherActiveDevices.otherDeviceCount > 0,
        authRetireFailed: false,
        serviceRetireAvailable: serviceRetireAvailable,
        serviceRetireSkipReason: null,
        serviceRetireAttempted: usedPrivilegedRetireOthers,
        serviceRetireSucceeded: usedPrivilegedRetireOthers,
        serviceRetireFailed: false,
        serviceRetireErrorMessage: null,
        serviceRetireErrorCode: null,
        serviceRetireErrorStatus: null,
        currentDeviceRowId: deviceRecordId,
        retireTargetIds: otherActiveDevices.otherDeviceIds,
      },
    );
  }

  logDmE2eeBootstrapDiagnostics('publish:retire-others:ok', {
    current_device_row_id: deviceRecordId,
    other_device_count: otherActiveDevices.otherDeviceCount,
    retire_target_ids: otherActiveDevices.otherDeviceIds,
    auth_retire_attempted: otherActiveDevices.otherDeviceCount > 0,
    auth_retire_failed: false,
    service_retire_available: serviceRetireAvailable,
    service_retire_skip_reason: otherActiveDevices.otherDeviceCount
      ? null
      : 'no retire targets',
    service_retire_attempted: usedPrivilegedRetireOthers,
    service_retire_succeeded: usedPrivilegedRetireOthers,
    service_retire_failed: false,
    service_retire_error_message: null,
    service_retire_error_code: null,
    service_retire_error_status: null,
  });

  // A repaired device publish must replace the full server-side prekey batch for
  // this device record. Keeping previously claimed rows around can block
  // re-insert on the unique (device_id, prekey_id) constraint during republish.
  const deleteExistingPrekeys = await supabase
    .from('device_one_time_prekeys')
    .delete()
    .eq('device_id', deviceRecordId);

  if (deleteExistingPrekeys.error) {
    logDmE2eeBootstrapDiagnostics('publish:delete-prekeys-error', {
      message: deleteExistingPrekeys.error.message,
    });
    if (
      isMissingRelationErrorMessage(
        deleteExistingPrekeys.error.message,
        'device_one_time_prekeys',
      ) ||
      isMissingColumnErrorMessage(deleteExistingPrekeys.error.message, 'claimed_at')
    ) {
      throw createSchemaRequirementError(
        'DM E2EE bootstrap schema is missing.',
      );
    }

    throw createDmE2eeBootstrapPublishError(
      'delete prekeys',
      deleteExistingPrekeys.error.message,
    );
  }

  if (input.oneTimePrekeys.length > 0) {
    const insertedPrekeys = await supabase
      .from('device_one_time_prekeys')
      .upsert(
        input.oneTimePrekeys.map((prekey) => ({
          device_id: deviceRecordId,
          prekey_id: prekey.prekeyId,
          public_key: prekey.publicKey,
        })),
        {
          onConflict: 'device_id,prekey_id',
        },
      );

    if (insertedPrekeys.error) {
      logDmE2eeBootstrapDiagnostics('publish:insert-prekeys-error', {
        message: insertedPrekeys.error.message,
      });
      throw createDmE2eeBootstrapPublishError(
        'insert prekeys',
        insertedPrekeys.error.message,
      );
    }
  }

  logDmE2eeBootstrapDiagnostics('publish:done', {
    resultKind,
    publishedPrekeyCount: input.oneTimePrekeys.length,
  });

  return {
    deviceRecordId,
    publishedPrekeyCount: input.oneTimePrekeys.length,
    resultKind,
  } satisfies PublishDmE2eeDeviceResult;
}

export async function getCurrentUserDmE2eeRecipientBundle(input: {
  conversationId: string;
  userId: string;
}) {
  const supabase = await createSupabaseServerClient();
  const serviceRoleSupabase = createSupabaseServiceRoleClient();
  const conversation = await getConversationForUser(
    input.conversationId,
    input.userId,
  );

  if (!conversation) {
    throw new Error('Conversation is not available.');
  }

  if (conversation.kind !== 'dm') {
    throw new Error('Encrypted DM send is only available for direct chats.');
  }

  const recipientDebugState: DmE2eeRecipientReadinessDebugState = {
    recipientBundleQueryStage: 'participants:auth-query',
    recipientUserIdChecked: null,
    recipientDeviceRowsFound: null,
    recipientActiveDeviceRowsFound: null,
    recipientSelectedDeviceRowId: null,
    recipientSelectedDeviceLogicalId: null,
    recipientSelectedDeviceRetiredAt: null,
    recipientSelectedDeviceIdentityKeyPresent: null,
    recipientSelectedDeviceSignedPrekeyPresent: null,
    recipientSelectedDeviceSignaturePresent: null,
    recipientSelectedDeviceAvailablePrekeyCount: null,
    recipientPrekeyQueryDeviceRef: null,
    recipientBundleQueryErrorMessage: null,
    recipientBundleQueryErrorCode: null,
    recipientBundleQueryErrorDetails: null,
    recipientMismatchLeft: null,
    recipientMismatchRight: null,
    recipientReadinessFailedReason: null,
  };
  const lookupRecipientParticipant = async (
    client: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  ) =>
    client
      .from('conversation_members')
      .select('user_id, role, state')
      .eq('conversation_id', input.conversationId)
      .eq('state', 'active')
      .neq('user_id', input.userId)
      .order('user_id', { ascending: true })
      .limit(1)
      .maybeSingle();

  let recipientParticipantLookup = await lookupRecipientParticipant(supabase);

  if (
    !recipientParticipantLookup.error &&
    !recipientParticipantLookup.data &&
    serviceRoleSupabase
  ) {
    recipientDebugState.recipientBundleQueryStage = 'participants:service-query';
    const privilegedLookup =
      await lookupRecipientParticipant(serviceRoleSupabase);

    if (!privilegedLookup.error) {
      recipientParticipantLookup = privilegedLookup;
    }
  }

  if (recipientParticipantLookup.error) {
    const errorDiagnostics = getSupabaseErrorDiagnostics(
      recipientParticipantLookup.error,
    );
    recipientDebugState.recipientBundleQueryStage = 'participants:error';
    recipientDebugState.recipientBundleQueryErrorMessage =
      recipientParticipantLookup.error.message;
    recipientDebugState.recipientBundleQueryErrorCode =
      typeof errorDiagnostics.error_code === 'string'
        ? errorDiagnostics.error_code
        : null;
    recipientDebugState.recipientBundleQueryErrorDetails =
      typeof errorDiagnostics.error_details === 'string'
        ? errorDiagnostics.error_details
        : null;
    recipientDebugState.recipientReadinessFailedReason =
      'recipient readiness: lookup query failed';
    throw createDmE2eeRecipientLookupError(
      recipientParticipantLookup.error.message,
      recipientDebugState,
    );
  }

  const recipientParticipant = recipientParticipantLookup.data
    ? {
        userId: recipientParticipantLookup.data.user_id,
        role: recipientParticipantLookup.data.role ?? null,
        state: recipientParticipantLookup.data.state ?? null,
      }
    : null;
  recipientDebugState.recipientBundleQueryStage = 'participants:selected';
  recipientDebugState.recipientUserIdChecked = recipientParticipant?.userId ?? null;

  if (!recipientParticipant?.userId) {
    recipientDebugState.recipientBundleQueryStage =
      'participants:selected-recipient-missing';
    recipientDebugState.recipientReadinessFailedReason =
      'recipient readiness: recipient participant missing';
    recipientDebugState.recipientMismatchLeft = input.userId;
    recipientDebugState.recipientMismatchRight =
      recipientParticipantLookup.data?.user_id ?? null;
    throw createDmE2eeRecipientReadinessError(
      'dm_e2ee_recipient_unavailable',
      'Direct-message recipient is not available.',
      recipientDebugState,
    );
  }
  const lookupRecipientDevices = async (
    client: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  ) =>
    client
      .from('user_devices')
      .select(
        'id, user_id, device_id, registration_id, identity_key_public, signed_prekey_id, signed_prekey_public, signed_prekey_signature, retired_at, created_at',
      )
      .eq('user_id', recipientParticipant.userId)
      .order('created_at', { ascending: false })
      .returns<
        {
          id: string;
          user_id: string;
          device_id: number;
          registration_id: number;
          identity_key_public: string | null;
          signed_prekey_id: number | null;
          signed_prekey_public: string | null;
          signed_prekey_signature: string | null;
          retired_at: string | null;
          created_at: string | null;
        }[]
      >();

  recipientDebugState.recipientBundleQueryStage = 'device-query:auth';
  let deviceLookup = await lookupRecipientDevices(supabase);
  let usedPrivilegedDeviceLookup = false;

  if (
    !deviceLookup.error &&
    (!deviceLookup.data || deviceLookup.data.length === 0) &&
    serviceRoleSupabase
  ) {
    recipientDebugState.recipientBundleQueryStage = 'device-query:service';
    logDmE2eeRecipientBundleDiagnostics('device-lookup:auth-empty', {
      conversationId: input.conversationId,
      recipientUserId: recipientParticipant.userId,
    });
    const privilegedLookup = await lookupRecipientDevices(serviceRoleSupabase);

    if (!privilegedLookup.error) {
      deviceLookup = privilegedLookup;
      usedPrivilegedDeviceLookup = Array.isArray(privilegedLookup.data)
        ? privilegedLookup.data.length > 0
        : false;
    }
  }

  if (deviceLookup.error) {
    const errorDiagnostics = getSupabaseErrorDiagnostics(deviceLookup.error);
    recipientDebugState.recipientBundleQueryStage = 'device-query:error';
    recipientDebugState.recipientBundleQueryErrorMessage =
      deviceLookup.error.message;
    recipientDebugState.recipientBundleQueryErrorCode =
      typeof errorDiagnostics.error_code === 'string'
        ? errorDiagnostics.error_code
        : null;
    recipientDebugState.recipientBundleQueryErrorDetails =
      typeof errorDiagnostics.error_details === 'string'
        ? errorDiagnostics.error_details
        : null;
    recipientDebugState.recipientReadinessFailedReason =
      'recipient readiness: lookup query failed';
    if (
      isMissingRelationErrorMessage(deviceLookup.error.message, 'user_devices') ||
      isMissingColumnErrorMessage(deviceLookup.error.message, 'signed_prekey_public')
    ) {
      throw createDmE2eeRecipientLookupError(
        'DM E2EE bootstrap schema is missing.',
        recipientDebugState,
      );
    }

    throw createDmE2eeRecipientLookupError(
      deviceLookup.error.message,
      recipientDebugState,
    );
  }

  const recipientDeviceRows = Array.isArray(deviceLookup.data)
    ? deviceLookup.data
    : [];
  const activeRecipientDeviceRows = recipientDeviceRows.filter(
    (device) => device.retired_at === null,
  );
  const selectedRecipientDevice = activeRecipientDeviceRows[0] ?? null;
  recipientDebugState.recipientDeviceRowsFound = recipientDeviceRows.length;
  recipientDebugState.recipientActiveDeviceRowsFound =
    activeRecipientDeviceRows.length;
  recipientDebugState.recipientSelectedDeviceRowId =
    selectedRecipientDevice?.id ?? null;
  recipientDebugState.recipientSelectedDeviceLogicalId =
    selectedRecipientDevice?.device_id ?? null;
  recipientDebugState.recipientSelectedDeviceRetiredAt =
    selectedRecipientDevice?.retired_at ?? null;
  recipientDebugState.recipientSelectedDeviceIdentityKeyPresent =
    Boolean(selectedRecipientDevice?.identity_key_public?.trim());
  recipientDebugState.recipientSelectedDeviceSignedPrekeyPresent =
    Boolean(selectedRecipientDevice?.signed_prekey_public?.trim());
  recipientDebugState.recipientSelectedDeviceSignaturePresent =
    Boolean(selectedRecipientDevice?.signed_prekey_signature?.trim());

  if (recipientDeviceRows.length === 0) {
    recipientDebugState.recipientBundleQueryStage = 'device-selection:none';
    recipientDebugState.recipientReadinessFailedReason =
      'recipient readiness: no device rows found';
    throw createDmE2eeRecipientReadinessError(
      'dm_e2ee_recipient_device_missing',
      'Recipient does not have a DM E2EE device registered yet.',
      recipientDebugState,
    );
  }

  if (activeRecipientDeviceRows.length === 0 || !selectedRecipientDevice) {
    recipientDebugState.recipientBundleQueryStage = 'device-selection:no-active';
    recipientDebugState.recipientReadinessFailedReason =
      'recipient readiness: no active device rows found';
    throw createDmE2eeRecipientReadinessError(
      'dm_e2ee_recipient_device_missing',
      'Recipient does not have an active DM E2EE device registered yet.',
      recipientDebugState,
    );
  }

  if (selectedRecipientDevice.retired_at !== null) {
    recipientDebugState.recipientBundleQueryStage =
      'device-selection:selected-retired';
    recipientDebugState.recipientReadinessFailedReason =
      'recipient readiness: selected device is retired';
    throw createDmE2eeRecipientReadinessError(
      'dm_e2ee_recipient_unavailable',
      'Recipient DM E2EE device is retired.',
      recipientDebugState,
    );
  }

  if (!selectedRecipientDevice.identity_key_public?.trim()) {
    recipientDebugState.recipientBundleQueryStage =
      'device-selection:identity-missing';
    recipientDebugState.recipientReadinessFailedReason =
      'recipient readiness: identity key missing';
    throw createDmE2eeRecipientReadinessError(
      'dm_e2ee_recipient_unavailable',
      'Recipient DM E2EE identity material is incomplete.',
      recipientDebugState,
    );
  }

  if (
    !Number.isInteger(selectedRecipientDevice.signed_prekey_id) ||
    !selectedRecipientDevice.signed_prekey_public?.trim()
  ) {
    recipientDebugState.recipientBundleQueryStage =
      'device-selection:signed-prekey-missing';
    recipientDebugState.recipientReadinessFailedReason =
      'recipient readiness: signed prekey missing';
    throw createDmE2eeRecipientReadinessError(
      'dm_e2ee_recipient_unavailable',
      'Recipient DM E2EE signed prekey is missing.',
      recipientDebugState,
    );
  }

  if (!selectedRecipientDevice.signed_prekey_signature?.trim()) {
    recipientDebugState.recipientBundleQueryStage =
      'device-selection:signature-missing';
    recipientDebugState.recipientReadinessFailedReason =
      'recipient readiness: signed prekey signature missing';
    throw createDmE2eeRecipientReadinessError(
      'dm_e2ee_recipient_unavailable',
      'Recipient DM E2EE signed prekey signature is missing.',
      recipientDebugState,
    );
  }

  const recipientSignedPrekeyId = selectedRecipientDevice.signed_prekey_id as number;
  const recipientSignedPrekeyPublic =
    selectedRecipientDevice.signed_prekey_public as string;
  const recipientSignedPrekeySignature =
    selectedRecipientDevice.signed_prekey_signature as string;
  const recipientIdentityKeyPublic =
    selectedRecipientDevice.identity_key_public as string;
  // Enforce one identifier contract in this path:
  // - user_devices.id (UUID) is the relational device row id for DB lookups
  // - user_devices.device_id (integer) is protocol metadata returned to the client
  const selectedRecipientDeviceRowId = selectedRecipientDevice.id;
  const selectedRecipientLogicalDeviceId = selectedRecipientDevice.device_id;
  recipientDebugState.recipientBundleQueryStage = 'device-selection:selected';
  recipientDebugState.recipientPrekeyQueryDeviceRef =
    selectedRecipientDeviceRowId;

  const lookupAvailableOneTimePrekey = async (
    client: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  ) =>
    client
      .from('device_one_time_prekeys')
      .select('prekey_id, public_key', { count: 'exact' })
      .eq('device_id', selectedRecipientDeviceRowId)
      .is('claimed_at', null)
      .order('created_at', { ascending: true })
      .limit(1)
      .returns<
        {
          prekey_id: number;
          public_key: string;
        }[]
      >();

  recipientDebugState.recipientBundleQueryStage = 'prekey-query:auth';
  let oneTimePrekeyLookup = await lookupAvailableOneTimePrekey(supabase);
  let usedPrivilegedPrekeyLookup = false;

  if (
    !oneTimePrekeyLookup.error &&
    (!oneTimePrekeyLookup.data || oneTimePrekeyLookup.data.length === 0) &&
    serviceRoleSupabase
  ) {
    recipientDebugState.recipientBundleQueryStage = 'prekey-query:service';
    logDmE2eeRecipientBundleDiagnostics('prekey-lookup:auth-empty', {
      conversationId: input.conversationId,
      recipientUserId: recipientParticipant.userId,
      recipientDeviceRecordId: selectedRecipientDeviceRowId,
      recipientLogicalDeviceId: selectedRecipientLogicalDeviceId,
      usedPrivilegedDeviceLookup,
    });
    const privilegedLookup =
      await lookupAvailableOneTimePrekey(serviceRoleSupabase);

    if (!privilegedLookup.error) {
      oneTimePrekeyLookup = privilegedLookup;
      usedPrivilegedPrekeyLookup = Array.isArray(privilegedLookup.data)
        ? privilegedLookup.data.length > 0
        : false;
    }
  }

  if (oneTimePrekeyLookup.error) {
    const errorDiagnostics = getSupabaseErrorDiagnostics(oneTimePrekeyLookup.error);
    recipientDebugState.recipientBundleQueryStage = 'prekey-query:error';
    recipientDebugState.recipientBundleQueryErrorMessage =
      oneTimePrekeyLookup.error.message;
    recipientDebugState.recipientBundleQueryErrorCode =
      typeof errorDiagnostics.error_code === 'string'
        ? errorDiagnostics.error_code
        : null;
    recipientDebugState.recipientBundleQueryErrorDetails =
      typeof errorDiagnostics.error_details === 'string'
        ? errorDiagnostics.error_details
        : null;
    recipientDebugState.recipientReadinessFailedReason =
      'recipient readiness: lookup query failed';
    if (
      isMissingRelationErrorMessage(
        oneTimePrekeyLookup.error.message,
        'device_one_time_prekeys',
      ) ||
      isMissingColumnErrorMessage(oneTimePrekeyLookup.error.message, 'claimed_at')
    ) {
      throw createDmE2eeRecipientLookupError(
        'DM E2EE bootstrap schema is missing.',
        recipientDebugState,
      );
    }

    throw createDmE2eeRecipientLookupError(
      oneTimePrekeyLookup.error.message,
      recipientDebugState,
    );
  }

  const availablePrekeys = Array.isArray(oneTimePrekeyLookup.data)
    ? oneTimePrekeyLookup.data
    : [];
  const availablePrekeyCount = oneTimePrekeyLookup.count ?? 0;
  recipientDebugState.recipientSelectedDeviceAvailablePrekeyCount =
    availablePrekeyCount;

  if (availablePrekeyCount < 1 || availablePrekeys.length === 0) {
    recipientDebugState.recipientBundleQueryStage = 'prekey-query:none-available';
    recipientDebugState.recipientReadinessFailedReason =
      'recipient readiness: no available one-time prekeys';
    throw createDmE2eeRecipientReadinessError(
      'dm_e2ee_recipient_unavailable',
      'Recipient does not have available one-time prekeys for encrypted direct messages.',
      recipientDebugState,
    );
  }

  recipientDebugState.recipientBundleQueryStage = 'bundle:resolved';
  logDmE2eeRecipientBundleDiagnostics('bundle:resolved', {
    conversationId: input.conversationId,
    recipientUserId: recipientParticipant.userId,
    usedPrivilegedDeviceLookup,
    usedPrivilegedPrekeyLookup,
    ...recipientDebugState,
    hasRecipientDevice: true,
    hasOneTimePrekey: availablePrekeys.length > 0,
  });

  return {
    conversationId: input.conversationId,
    recipient: {
      deviceRecordId: selectedRecipientDeviceRowId,
      userId: selectedRecipientDevice.user_id,
      deviceId: selectedRecipientLogicalDeviceId,
      registrationId: selectedRecipientDevice.registration_id,
      identityKeyPublic: recipientIdentityKeyPublic,
      signedPrekeyId: recipientSignedPrekeyId,
      signedPrekeyPublic: recipientSignedPrekeyPublic,
      signedPrekeySignature: recipientSignedPrekeySignature,
      oneTimePrekeyId: availablePrekeys[0]?.prekey_id ?? null,
      oneTimePrekeyPublic: availablePrekeys[0]?.public_key ?? null,
    } satisfies UserDevicePublicBundle,
  } satisfies DmE2eeRecipientBundleResponse;
}

export async function resetCurrentUserDmE2eeDeviceForDev(input: {
  userId: string;
}) {
  if (!isDmE2eeDevResetEnabled()) {
    throw new Error('DM E2EE dev reset is disabled.');
  }

  const supabase = await createSupabaseServerClient();
  const now = new Date().toISOString();
  logDmE2eeBootstrapDiagnostics('dev-reset:start', {
    hasUserId: Boolean(input.userId),
  });

  const deviceLookup = await supabase
    .from('user_devices')
    .select('id')
    .eq('user_id', input.userId)
    .is('retired_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (deviceLookup.error) {
    logDmE2eeBootstrapDiagnostics('dev-reset:device-lookup-error', {
      message: deviceLookup.error.message,
    });
    throw createDmE2eeBootstrapPublishError(
      'dev reset device lookup',
      deviceLookup.error.message,
    );
  }

  const activeDeviceId = String(
    (deviceLookup.data as { id: string } | null)?.id ?? '',
  ).trim();

  if (!activeDeviceId) {
    logDmE2eeBootstrapDiagnostics('dev-reset:device-not-found');
    return {
      foundDevice: false,
      clearedPrekeys: 0,
      retiredDevice: false,
    };
  }

  logDmE2eeBootstrapDiagnostics('dev-reset:device-found');

  const deletePrekeys = await supabase
    .from('device_one_time_prekeys')
    .delete()
    .eq('device_id', activeDeviceId)
    .select('id');

  if (deletePrekeys.error) {
    logDmE2eeBootstrapDiagnostics('dev-reset:delete-prekeys-error', {
      message: deletePrekeys.error.message,
    });
    throw createDmE2eeBootstrapPublishError(
      'dev reset delete prekeys',
      deletePrekeys.error.message,
    );
  }

  const clearedPrekeys = ((deletePrekeys.data ?? []) as Array<{ id: string }>)
    .length;
  logDmE2eeBootstrapDiagnostics('dev-reset:prekeys-cleared', {
    clearedPrekeys,
  });

  const retireDevice = await supabase
    .from('user_devices')
    .update({
      retired_at: now,
      last_seen_at: now,
    })
    .eq('id', activeDeviceId)
    .is('retired_at', null)
    .select('id')
    .maybeSingle();

  if (retireDevice.error) {
    logDmE2eeBootstrapDiagnostics('dev-reset:retire-device-error', {
      message: retireDevice.error.message,
    });
    throw createDmE2eeBootstrapPublishError(
      'dev reset retire device',
      retireDevice.error.message,
    );
  }

  const retiredDevice = Boolean((retireDevice.data as { id: string } | null)?.id);
  logDmE2eeBootstrapDiagnostics('dev-reset:device-retired', {
    retiredDevice,
  });

  return {
    foundDevice: true,
    clearedPrekeys,
    retiredDevice,
  };
}

async function getCurrentUserActiveDmE2eeDeviceInfo(userId: string) {
  const supabase = await createSupabaseServerClient();
  const cookieStore = await cookies();
  const hintedDeviceRecordId =
    cookieStore.get(DM_E2EE_CURRENT_DEVICE_COOKIE)?.value?.trim() || null;
  const resolveDevice = async (hintedId: string | null) =>
    hintedId
      ? supabase
          .from('user_devices')
          .select('id, created_at')
          .eq('user_id', userId)
          .eq('id', hintedId)
          .is('retired_at', null)
          .maybeSingle()
      : supabase
          .from('user_devices')
          .select('id, created_at')
          .eq('user_id', userId)
          .is('retired_at', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

  let response = await resolveDevice(hintedDeviceRecordId);

  if (!response.error && !response.data && hintedDeviceRecordId) {
    response = await resolveDevice(null);
  }

  if (response.error) {
    if (
      isMissingRelationErrorMessage(response.error.message, 'user_devices') ||
      isMissingColumnErrorMessage(response.error.message, 'retired_at')
    ) {
      return null;
    }

    throw new Error(response.error.message);
  }

  const row = response.data as
    | { id?: string | null; created_at?: string | null }
    | null;

  return {
    createdAt: row?.created_at ?? null,
    id: (row?.id ?? null) as string | null,
    selectionSource:
      hintedDeviceRecordId && row?.id === hintedDeviceRecordId
        ? 'cookie'
        : 'latest-active',
  } as const;
}

export async function getCurrentUserDmE2eeEnvelopesForMessages(input: {
  debugRequestId?: string | null;
  userId: string;
  messageIds: string[];
}) {
  const diagnosticsEnabled = process.env.CHAT_DEBUG_DM_E2EE_BOOTSTRAP === '1';
  const logDiagnostics = (stage: string, details?: Record<string, unknown>) => {
    if (!diagnosticsEnabled) {
      return;
    }

    if (details) {
      console.info('[dm-e2ee-history]', stage, details);
      return;
    }

    console.info('[dm-e2ee-history]', stage);
  };
  const uniqueMessageIds = Array.from(
    new Set(input.messageIds.map((value) => value.trim()).filter(Boolean)),
  );

  if (uniqueMessageIds.length === 0) {
    return {
      activeDeviceCreatedAt: null,
      activeDeviceRecordId: null,
      envelopesByMessage: new Map<string, StoredDmE2eeEnvelope>(),
      selectionSource: null,
    };
  }

  const activeDevice = await getCurrentUserActiveDmE2eeDeviceInfo(input.userId);
  const activeDeviceRecordId = activeDevice?.id ?? null;
  logDiagnostics('envelopes:active-device-resolved', {
    currentUserId: input.userId,
    activeDeviceRecordId,
    activeDeviceCreatedAt: activeDevice?.createdAt ?? null,
    debugRequestId: input.debugRequestId ?? null,
    messageCount: uniqueMessageIds.length,
    selectionSource: activeDevice?.selectionSource ?? null,
  });

  if (!activeDeviceRecordId) {
    logDiagnostics('envelopes:no-active-device', {
      currentUserId: input.userId,
      debugRequestId: input.debugRequestId ?? null,
    });
    return {
      activeDeviceCreatedAt: null,
      activeDeviceRecordId: null,
      envelopesByMessage: new Map<string, StoredDmE2eeEnvelope>(),
      selectionSource: null,
    };
  }

  const supabase = await createSupabaseServerClient();
  const response = await supabase
    .from('message_e2ee_envelopes')
    .select(
      'message_id, recipient_device_id, envelope_type, ciphertext, used_one_time_prekey_id, created_at, messages!inner(sender_device_id)',
    )
    .eq('recipient_device_id', activeDeviceRecordId)
    .in('message_id', uniqueMessageIds);

  if (response.error) {
    if (
      isMissingRelationErrorMessage(
        response.error.message,
        'message_e2ee_envelopes',
      ) ||
      isMissingColumnErrorMessage(response.error.message, 'sender_device_id') ||
      isMissingColumnErrorMessage(response.error.message, 'ciphertext')
    ) {
      return {
        activeDeviceCreatedAt: activeDevice?.createdAt ?? null,
        activeDeviceRecordId,
        envelopesByMessage: new Map<string, StoredDmE2eeEnvelope>(),
        selectionSource: activeDevice?.selectionSource ?? null,
      };
    }

    throw new Error(response.error.message);
  }

  let malformedEnvelopeCount = 0;
  const envelopes = ((response.data ?? []) as MessageE2eeEnvelopeRow[]).flatMap<
    [string, StoredDmE2eeEnvelope]
  >((row) => {
      const messageRecord = normalizeJoinedRecord(row.messages);
      const senderDeviceRecordId = String(
        messageRecord?.sender_device_id ?? '',
      ).trim();
      const ciphertext = String(row.ciphertext ?? '').trim();

      if (!senderDeviceRecordId || !ciphertext) {
        malformedEnvelopeCount += 1;
        logDiagnostics('envelopes:skip-malformed', {
          currentUserId: input.userId,
          debugRequestId: input.debugRequestId ?? null,
          hasCiphertext: Boolean(ciphertext),
          messageId: row.message_id,
          recipientDeviceRecordId: row.recipient_device_id,
          senderDeviceRecordId,
        });
        return [];
      }

      return [[
        row.message_id,
        {
          messageId: row.message_id,
          senderDeviceRecordId,
          recipientDeviceRecordId: row.recipient_device_id,
          envelopeType:
            row.envelope_type === 'signal_message'
              ? 'signal_message'
              : 'prekey_signal_message',
          ciphertext,
          usedOneTimePrekeyId: row.used_one_time_prekey_id ?? null,
          createdAt: row.created_at ?? null,
        } satisfies StoredDmE2eeEnvelope,
      ]];
    });
  logDiagnostics('envelopes:loaded', {
    currentUserId: input.userId,
    activeDeviceRecordId,
    activeDeviceCreatedAt: activeDevice?.createdAt ?? null,
    debugRequestId: input.debugRequestId ?? null,
    malformedEnvelopeCount,
    requestedMessageCount: uniqueMessageIds.length,
    envelopeCount: envelopes.length,
    selectionSource: activeDevice?.selectionSource ?? null,
  });

  return {
    activeDeviceCreatedAt: activeDevice?.createdAt ?? null,
    activeDeviceRecordId,
    envelopesByMessage: new Map(envelopes),
    selectionSource: activeDevice?.selectionSource ?? null,
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

  if (options?.spaceId) {
    logSpaceMembershipDiagnostics('getAvailableUsers:space-members:start', {
      source,
      queryShape:
        "from('space_members').select('user_id').eq('space_id', ?).neq('user_id', ?).order('user_id')",
      spaceId: options.spaceId,
    });
    const { data, error } = await supabase
      .from('space_members')
      .select('user_id')
      .eq('space_id', options.spaceId)
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
  } else {
    const { data, error } = await supabase
      .from('profiles')
      .select('user_id')
      .neq('user_id', currentUserId)
      .order('user_id', { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    userIds = ((data ?? []) as { user_id: string }[]).map(
      (profile) => profile.user_id,
    );
  }

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
    };
  }) satisfies ConversationParticipantIdentity[];
}

export async function findExistingActiveDmConversation(
  creatorUserId: string,
  otherUserId: string,
  options?: {
    spaceId?: string | null;
  },
) {
  const supabase = await createSupabaseServerClient();
  const dmConversationKey = buildDmConversationKey(creatorUserId, otherUserId);
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
    .eq('conversations.dm_key', dmConversationKey);

  if (options?.spaceId) {
    keyedLookupQuery = keyedLookupQuery.eq('conversations.space_id', options.spaceId);
  }

  const { data: keyedMemberships, error: keyedLookupError } = await keyedLookupQuery;

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
      candidateRows: ((keyedMemberships ?? []) as Array<{
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
      }>),
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
    if (options?.spaceId && isMissingColumnErrorMessage(otherError.message, 'space_id')) {
      logConversationSchemaDiagnostics('findExistingActiveDmConversation:throw-space-id-required', {
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
      });
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

export async function createConversationWithMembers(input: {
  kind: 'dm' | 'group';
  creatorUserId: string;
  participantUserIds: string[];
  title?: string | null;
  spaceId?: string | null;
}) {
  const supabase = await createSupabaseServerClient();
  const conversationId = crypto.randomUUID();
  const normalizedSpaceId = input.spaceId?.trim() || null;

  if (!input.creatorUserId) {
    throw new Error('Authenticated user is required to create a conversation.');
  }

  if (!normalizedSpaceId) {
    throw new Error('Active space is required to create a conversation.');
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

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
    throw new Error('Direct-message creation requires exactly one other participant.');
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
      return existingConversationId;
    }
  }

  const dmConversationKey =
    input.kind === 'dm'
      ? buildDmConversationKey(input.creatorUserId, participantUserIds[0] ?? '')
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
          dm_key: dmConversationKey,
        }
      : {
          ...conversationPayloadBase,
          space_id: normalizedSpaceId,
        };

  const conversationPayloadWithoutDmKey = {
    ...conversationPayloadBase,
    space_id: normalizedSpaceId,
  };

  if (conversationPayload.created_by !== input.creatorUserId) {
    throw new Error(
      'Conversation created_by must match the authenticated user.',
    );
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
        return existingConversationId;
      }
    }

    if (conversationError.message.includes('row-level security policy')) {
      throw new Error(
        `Conversation creation debug: insert blocked by conversations RLS. auth user id=${user.id}, payload created_by=${conversationPayload.created_by}. Values match, so the failure is likely in database policy state or auth context rather than payload construction.`,
      );
    }

    throw new Error(conversationError.message);
  }

  const membershipRows = [
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

export async function updateCurrentUserProfile(input: {
  userId: string;
  displayName: string | null;
  avatarObjectPath?: string | null;
  avatarFile?: File | null;
  removeAvatar?: boolean;
}) {
  const supabase = await createSupabaseServerClient();

  if (!input.userId) {
    throw new Error('Authenticated user is required to update a profile.');
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    throw new Error('Profile settings debug: no authenticated user found.');
  }

  if (user.id !== input.userId) {
    throw new Error(
      `Profile settings debug: user mismatch. auth user id=${user.id}, payload user id=${input.userId}.`,
    );
  }

  const nextDisplayName = input.displayName?.trim() || null;
  const existingProfileResponse = await supabase
    .from('profiles')
    .select('avatar_path')
    .eq('user_id', input.userId)
    .maybeSingle();

  if (existingProfileResponse.error) {
    logProfileSettingsDiagnostics('profile-lookup-error', {
      userId: input.userId,
      ...getSupabaseErrorDiagnostics(existingProfileResponse.error),
      message: existingProfileResponse.error.message,
    });
    throw new Error(existingProfileResponse.error.message);
  }

  const existingAvatarPath =
    (
      existingProfileResponse.data as
        | {
            avatar_path?: string | null;
          }
        | null
    )?.avatar_path?.trim() || null;

  if (nextDisplayName && nextDisplayName.length > 40) {
    throw new Error('Display name can be up to 40 characters.');
  }

  let nextAvatarPath: string | null | undefined;
  let uploadedAvatarObjectPath: string | null = null;
  const requestedAvatarObjectPath = input.avatarObjectPath?.trim() || null;
  const shouldRemoveAvatar =
    Boolean(input.removeAvatar) &&
    !requestedAvatarObjectPath &&
    !(input.avatarFile && input.avatarFile.size > 0);

  if (requestedAvatarObjectPath) {
    if (!isManagedAvatarObjectPath(input.userId, requestedAvatarObjectPath)) {
      throw new Error('Avatar upload path is invalid for this user.');
    }

    uploadedAvatarObjectPath = requestedAvatarObjectPath;
    nextAvatarPath = requestedAvatarObjectPath;
  } else if (input.avatarFile && input.avatarFile.size > 0) {
    if (input.avatarFile.size > PROFILE_AVATAR_MAX_SIZE_BYTES) {
      throw new Error('Avatar images can be up to 5 MB.');
    }

    if (!SUPPORTED_PROFILE_AVATAR_TYPES.has(input.avatarFile.type)) {
      throw new Error('Avatar must be a JPG, PNG, WEBP, or GIF image.');
    }

    const fileName = sanitizeProfileFileName(input.avatarFile.name);
    const objectPath = `${input.userId}/${crypto.randomUUID()}-${fileName}`;
    const { error: uploadError } = await supabase.storage
      .from(PROFILE_AVATAR_BUCKET)
      .upload(objectPath, input.avatarFile, {
        upsert: false,
        contentType: input.avatarFile.type,
      });

    if (uploadError) {
      if (isBucketNotFoundStorageErrorMessage(uploadError.message)) {
        throw new Error(getAvatarBucketRequirementErrorMessage());
      }

      throw new Error(uploadError.message);
    }

    uploadedAvatarObjectPath = objectPath;
    nextAvatarPath = objectPath;
  } else if (shouldRemoveAvatar) {
    nextAvatarPath = null;
  }

  const profilePayload = {
    user_id: input.userId,
    display_name: nextDisplayName,
    ...(nextAvatarPath !== undefined ? { avatar_path: nextAvatarPath } : {}),
  };

  const profileExists = Boolean(existingProfileResponse.data);
  const profileWrite = profileExists
    ? await supabase
        .from('profiles')
        .update({
          display_name: nextDisplayName,
          ...(nextAvatarPath !== undefined ? { avatar_path: nextAvatarPath } : {}),
        })
        .eq('user_id', input.userId)
    : await supabase.from('profiles').insert(profilePayload);

  if (profileWrite.error) {
    if (uploadedAvatarObjectPath) {
      await supabase.storage.from(PROFILE_AVATAR_BUCKET).remove([uploadedAvatarObjectPath]);
    }

    logProfileSettingsDiagnostics('profile-write-error', {
      operation: profileExists ? 'update-existing-profile' : 'insert-missing-profile',
      userId: input.userId,
      hasDisplayName: nextDisplayName !== null,
      hasAvatarPath: nextAvatarPath !== undefined,
      ...getSupabaseErrorDiagnostics(profileWrite.error),
      message: profileWrite.error.message,
    });

    if (profileWrite.error.message.includes('row-level security policy')) {
      throw new Error('Profile settings update was blocked by profiles RLS.');
    }

    throw new Error(profileWrite.error.message);
  }

  if (
    existingAvatarPath &&
    isManagedAvatarObjectPath(input.userId, existingAvatarPath) &&
    existingAvatarPath !== uploadedAvatarObjectPath &&
    (uploadedAvatarObjectPath || shouldRemoveAvatar)
  ) {
    await supabase.storage.from(PROFILE_AVATAR_BUCKET).remove([existingAvatarPath]);
  }
}

export async function removeCurrentUserAvatar(userId: string) {
  const supabase = await createSupabaseServerClient();

  if (!userId) {
    throw new Error('Authenticated user is required to update a profile.');
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    throw new Error('Profile settings debug: no authenticated user found.');
  }

  if (user.id !== userId) {
    throw new Error(
      `Profile settings debug: user mismatch. auth user id=${user.id}, payload user id=${userId}.`,
    );
  }

  const existingProfileResponse = await supabase
    .from('profiles')
    .select('avatar_path')
    .eq('user_id', userId)
    .maybeSingle();

  if (existingProfileResponse.error) {
    logProfileSettingsDiagnostics('avatar-remove-profile-lookup-error', {
      userId,
      ...getSupabaseErrorDiagnostics(existingProfileResponse.error),
      message: existingProfileResponse.error.message,
    });
    throw new Error(existingProfileResponse.error.message);
  }

  const existingAvatarPath =
    (
      existingProfileResponse.data as
        | {
            avatar_path?: string | null;
          }
        | null
    )?.avatar_path?.trim() || null;

  const profileExists = Boolean(existingProfileResponse.data);
  const profileWrite = profileExists
    ? await supabase
        .from('profiles')
        .update({ avatar_path: null })
        .eq('user_id', userId)
    : await supabase.from('profiles').insert({
        user_id: userId,
        avatar_path: null,
      });

  if (profileWrite.error) {
    logProfileSettingsDiagnostics('avatar-remove-profile-write-error', {
      operation: profileExists ? 'update-existing-profile' : 'insert-missing-profile',
      userId,
      ...getSupabaseErrorDiagnostics(profileWrite.error),
      message: profileWrite.error.message,
    });

    if (profileWrite.error.message.includes('row-level security policy')) {
      throw new Error('Profile settings update was blocked by profiles RLS.');
    }

    throw new Error(profileWrite.error.message);
  }

  if (isManagedAvatarObjectPath(userId, existingAvatarPath)) {
    await supabase.storage
      .from(PROFILE_AVATAR_BUCKET)
      .remove([existingAvatarPath ?? '']);
  }
}

export async function updateCurrentUserLanguagePreference(input: {
  userId: string;
  preferredLanguage: AppLanguage;
}) {
  const supabase = await createSupabaseServerClient();

  if (!input.userId) {
    throw new Error('Authenticated user is required to update language.');
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    throw new Error('Language update debug: no authenticated user found.');
  }

  if (user.id !== input.userId) {
    throw new Error(
      `Language update debug: user mismatch. auth user id=${user.id}, payload user id=${input.userId}.`,
    );
  }

  const existingProfileResponse = await supabase
    .from('profiles')
    .select('user_id')
    .eq('user_id', input.userId)
    .maybeSingle();

  if (existingProfileResponse.error) {
    logProfileSettingsDiagnostics('language-profile-lookup-error', {
      userId: input.userId,
      ...getSupabaseErrorDiagnostics(existingProfileResponse.error),
      message: existingProfileResponse.error.message,
    });
    throw new Error(existingProfileResponse.error.message);
  }

  const profileExists = Boolean(existingProfileResponse.data);
  const profileWrite = profileExists
    ? await supabase
        .from('profiles')
        .update({
          preferred_language: input.preferredLanguage,
        })
        .eq('user_id', input.userId)
    : await supabase.from('profiles').insert({
        user_id: input.userId,
        preferred_language: input.preferredLanguage,
      });

  if (profileWrite.error) {
    logProfileSettingsDiagnostics('language-profile-write-error', {
      operation: profileExists ? 'update-existing-profile' : 'insert-missing-profile',
      userId: input.userId,
      ...getSupabaseErrorDiagnostics(profileWrite.error),
      message: profileWrite.error.message,
    });

    if (isMissingColumnErrorMessage(profileWrite.error.message, 'preferred_language')) {
      throw createSchemaRequirementError(
        'Profile language preference requires profiles.preferred_language.',
      );
    }

    if (profileWrite.error.message.includes('row-level security policy')) {
      throw new Error('Language preference update was blocked by profiles RLS.');
    }

    throw new Error(profileWrite.error.message);
  }
}

export async function getConversationMessages(
  conversationId: string,
  options?: {
    debugRequestId?: string | null;
    limitLatest?: number | null;
  },
) {
  const supabase = await createSupabaseServerClient();
  const normalizedLimit =
    typeof options?.limitLatest === 'number' &&
    Number.isFinite(options.limitLatest) &&
    options.limitLatest > 0
      ? Math.floor(options.limitLatest)
      : null;
  const queryLimit = normalizedLimit !== null ? normalizedLimit + 1 : null;
  const response =
    queryLimit !== null
      ? await supabase
          .from('messages')
          .select(
            'id, conversation_id, sender_id, sender_device_id, reply_to_message_id, seq, kind, client_id, body, content_mode, edited_at, deleted_at, created_at',
          )
          .eq('conversation_id', conversationId)
          .order('seq', { ascending: false })
          .limit(queryLimit)
      : await supabase
          .from('messages')
          .select(
            'id, conversation_id, sender_id, sender_device_id, reply_to_message_id, seq, kind, client_id, body, content_mode, edited_at, deleted_at, created_at',
          )
          .eq('conversation_id', conversationId)
          .order('seq', { ascending: false });

  const normalizeMessages = (data: ConversationMessage[]) => {
    const hasMoreOlder =
      normalizedLimit !== null && data.length > normalizedLimit;
    const pagedRows =
      normalizedLimit !== null && hasMoreOlder
        ? data.slice(0, normalizedLimit)
        : data;

    const normalizedMessages = [...pagedRows].reverse();

    if (process.env.CHAT_DEBUG_DM_E2EE_BOOTSTRAP === '1') {
      console.info('[chat-history-load]', 'messages:loaded', {
        conversationId,
        count: normalizedMessages.length,
        debugRequestId: options?.debugRequestId ?? null,
        deploymentId: process.env.VERCEL_DEPLOYMENT_ID ?? null,
        firstMessageId: normalizedMessages[0]?.id ?? null,
        gitCommitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
        hasMoreOlder,
        lastMessageId:
          normalizedMessages[normalizedMessages.length - 1]?.id ?? null,
        limitLatest: normalizedLimit,
        queryLimit,
        vercelUrl: process.env.VERCEL_URL ?? null,
      });
    }

    return {
      hasMoreOlder,
      messages: normalizedMessages,
    };
  };

  if (response.error) {
    if (isMissingColumnErrorMessage(response.error.message, 'content_mode')) {
      const fallback =
        queryLimit !== null
          ? await supabase
              .from('messages')
              .select(
                'id, conversation_id, sender_id, reply_to_message_id, seq, kind, client_id, body, edited_at, deleted_at, created_at',
              )
              .eq('conversation_id', conversationId)
              .order('seq', { ascending: false })
              .limit(queryLimit)
          : await supabase
              .from('messages')
              .select(
                'id, conversation_id, sender_id, reply_to_message_id, seq, kind, client_id, body, edited_at, deleted_at, created_at',
              )
              .eq('conversation_id', conversationId)
              .order('seq', { ascending: false });

      if (fallback.error) {
        throw new Error(fallback.error.message);
      }

      return normalizeMessages((fallback.data ?? []) as ConversationMessage[]);
    }

    throw new Error(response.error.message);
  }

  return normalizeMessages((response.data ?? []) as ConversationMessage[]);
}

export async function getMessageSenderProfiles(userIds: string[]) {
  return getProfileIdentities(userIds);
}

export async function getGroupedReactionsForMessages(
  messageIds: string[],
  currentUserId: string,
) {
  if (messageIds.length === 0) {
    return new Map<string, MessageReactionGroup[]>();
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('message_reactions')
    .select('id, message_id, emoji, user_id, created_at')
    .in('message_id', messageIds);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as MessageReactionRow[];
  const grouped = new Map<string, Map<string, MessageReactionGroup>>();

  for (const row of rows) {
    const perMessage = grouped.get(row.message_id) ?? new Map<string, MessageReactionGroup>();
    const current = perMessage.get(row.emoji) ?? {
      emoji: row.emoji,
      count: 0,
      selectedByCurrentUser: false,
    };

    current.count += 1;
    current.selectedByCurrentUser ||= row.user_id === currentUserId;

    perMessage.set(row.emoji, current);
    grouped.set(row.message_id, perMessage);
  }

  return new Map(
    Array.from(grouped.entries()).map(([messageId, reactions]) => {
      const groups = Array.from(reactions.values())
        .sort((left, right) => {
          if (left.selectedByCurrentUser !== right.selectedByCurrentUser) {
            return left.selectedByCurrentUser ? -1 : 1;
          }

          if (left.count !== right.count) {
            return right.count - left.count;
          }

          return left.emoji.localeCompare(right.emoji);
        })
        .slice(0, 5);

      return [messageId, groups];
    }),
  );
}

export async function getMessageAttachments(messageIds: string[]) {
  const uniqueMessageIds = Array.from(new Set(messageIds.filter(Boolean)));

  if (uniqueMessageIds.length === 0) {
    return new Map<string, MessageAttachment[]>();
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('message_attachments')
    .select('id, message_id, bucket, object_path, mime_type, size_bytes, created_at')
    .in('message_id', uniqueMessageIds)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as MessageAttachmentRow[];
  const attachments = await Promise.all(
    rows.map(async (row) => {
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from(row.bucket)
        .createSignedUrl(row.object_path, 60 * 60);

      if (signedUrlError) {
        return {
          id: row.id,
          messageId: row.message_id,
          bucket: row.bucket,
          objectPath: row.object_path,
          mimeType: row.mime_type,
          sizeBytes: row.size_bytes,
          createdAt: row.created_at,
          fileName: getAttachmentFileName(row.object_path),
          signedUrl: null,
          isImage: isImageAttachment(row.mime_type),
          isAudio: isAudioAttachment(row.mime_type),
          isVoiceMessage: row.object_path.includes('/voice/'),
        } satisfies MessageAttachment;
      }

      return {
        id: row.id,
        messageId: row.message_id,
        bucket: row.bucket,
        objectPath: row.object_path,
        mimeType: row.mime_type,
        sizeBytes: row.size_bytes,
        createdAt: row.created_at,
        fileName: getAttachmentFileName(row.object_path),
        signedUrl: signedUrlData.signedUrl,
        isImage: isImageAttachment(row.mime_type),
        isAudio: isAudioAttachment(row.mime_type),
        isVoiceMessage: row.object_path.includes('/voice/'),
      } satisfies MessageAttachment;
    }),
  );

  const grouped = new Map<string, MessageAttachment[]>();

  for (const attachment of attachments) {
    const existing = grouped.get(attachment.messageId) ?? [];
    existing.push(attachment);
    grouped.set(attachment.messageId, existing);
  }

  return grouped;
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
  const supabase = await createSupabaseServerClient();

  if (!input.userId) {
    throw new Error('Read state debug: authenticated user is required.');
  }

  if (!Number.isFinite(input.lastReadMessageSeq) || input.lastReadMessageSeq < 0) {
    throw new Error('Read state debug: invalid last read message sequence.');
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

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
      throw new Error(
        'Read state debug: update blocked by conversation_members RLS.',
      );
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
  const supabase = await createSupabaseServerClient();

  if (!input.userId) {
    throw new Error('Conversation archive debug: authenticated user is required.');
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

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
  const supabase = await createSupabaseServerClient();

  if (!input.userId) {
    throw new Error('Direct chat delete requires an authenticated user.');
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    throw new Error('Direct chat delete debug: no authenticated user found.');
  }

  if (user.id !== input.userId) {
    throw new Error(
      `Direct chat delete debug: user mismatch. auth user id=${user.id}, payload user id=${input.userId}.`,
    );
  }

  const conversation = await getConversationForUser(input.conversationId, input.userId);

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

  const messageIds = ((messageRows ?? []) as Array<{ id: string }>).map((row) => row.id);

  if (messageIds.length > 0) {
    const { error: reactionsError } = await serviceSupabase
      .from('message_reactions')
      .delete()
      .in('message_id', messageIds);

    if (reactionsError && !isMissingRelationErrorMessage(reactionsError.message, 'message_reactions')) {
      throw new Error(reactionsError.message);
    }

    const { data: attachmentRows, error: attachmentRowsError } = await serviceSupabase
      .from('message_attachments')
      .select('bucket, object_path')
      .in('message_id', messageIds);

    if (attachmentRowsError && !isMissingRelationErrorMessage(attachmentRowsError.message, 'message_attachments')) {
      throw new Error(attachmentRowsError.message);
    }

    const { error: attachmentsError } = await serviceSupabase
      .from('message_attachments')
      .delete()
      .in('message_id', messageIds);

    if (attachmentsError && !isMissingRelationErrorMessage(attachmentsError.message, 'message_attachments')) {
      throw new Error(attachmentsError.message);
    }

    const { error: envelopesError } = await serviceSupabase
      .from('message_e2ee_envelopes')
      .delete()
      .in('message_id', messageIds);

    if (envelopesError && !isMissingRelationErrorMessage(envelopesError.message, 'message_e2ee_envelopes')) {
      throw new Error(envelopesError.message);
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

    for (const [bucket, objectPaths] of storageObjectsByBucket) {
      const uniqueObjectPaths = Array.from(new Set(objectPaths.filter(Boolean)));

      if (uniqueObjectPaths.length === 0) {
        continue;
      }

      await serviceSupabase.storage.from(bucket).remove(uniqueObjectPaths);
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
  const supabase = await createSupabaseServerClient();

  if (!input.userId) {
    throw new Error('Conversation archive debug: authenticated user is required.');
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

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

export async function updateConversationNotificationLevel(input: {
  conversationId: string;
  userId: string;
  notificationLevel: ConversationNotificationLevel;
}) {
  const supabase = await createSupabaseServerClient();

  if (!input.userId) {
    throw new Error('Conversation notifications debug: authenticated user is required.');
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    throw new Error('Conversation notifications debug: no authenticated user found.');
  }

  if (user.id !== input.userId) {
    throw new Error(
      `Conversation notifications debug: user mismatch. auth user id=${user.id}, payload user id=${input.userId}.`,
    );
  }

  if (input.notificationLevel !== 'default' && input.notificationLevel !== 'muted') {
    throw new Error('Choose a valid notification preference.');
  }

  const { data: membershipRow, error: membershipError } = await supabase
    .from('conversation_members')
    .select('conversation_id')
    .eq('conversation_id', input.conversationId)
    .eq('user_id', input.userId)
    .eq('state', 'active')
    .maybeSingle();

  if (membershipError) {
    throw new Error(membershipError.message);
  }

  if (!membershipRow) {
    throw new Error('Only an active participant can change this setting.');
  }

  const { error: updateError } = await supabase
    .from('conversation_members')
    .update({ notification_level: input.notificationLevel })
    .eq('conversation_id', input.conversationId)
    .eq('user_id', input.userId)
    .eq('state', 'active');

  if (updateError) {
    if (isMissingColumnErrorMessage(updateError.message, 'notification_level')) {
      throw createSchemaRequirementError(
        'Per-chat notification preferences require public.conversation_members.notification_level.',
      );
    }

    if (updateError.message.includes('row-level security policy')) {
      throw new Error(
        'Conversation notifications debug: update blocked by conversation_members RLS.',
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

export async function toggleMessageReaction(input: {
  messageId: string;
  userId: string;
  emoji: string;
}) {
  const supabase = await createSupabaseServerClient();
  const { data: existingRows, error: existingError } = await supabase
    .from('message_reactions')
    .select('id, emoji')
    .eq('message_id', input.messageId)
    .eq('user_id', input.userId);

  if (existingError) {
    throw new Error(existingError.message);
  }

  const userRows = existingRows ?? [];
  const sameEmojiRows = userRows.filter((row) => row.emoji === input.emoji);

  if (sameEmojiRows.length > 0) {
    const ids = sameEmojiRows.map((row) => row.id);
    const { error: deleteError } = await supabase
      .from('message_reactions')
      .delete()
      .in('id', ids);

    if (deleteError) {
      throw new Error(deleteError.message);
    }

    return;
  }

  if (userRows.length >= 3) {
    throw new Error('You can add up to 3 reactions to a single message.');
  }

  const { error: insertError } = await supabase.from('message_reactions').insert({
    message_id: input.messageId,
    user_id: input.userId,
    emoji: input.emoji,
  });

  if (insertError) {
    throw new Error(insertError.message);
  }
}

export async function sendTextMessage(input: {
  conversationId: string;
  body: string;
  senderId: string;
  replyToMessageId?: string | null;
}) {
  await createMessageRecord({
    conversationId: input.conversationId,
    senderId: input.senderId,
    body: input.body,
    replyToMessageId: input.replyToMessageId ?? null,
  });
}

export async function sendEncryptedDmTextMessage(
  input: DmE2eeSendRequest & { senderId: string },
) {
  const sendDebugState: DmE2eeSendDebugState = {
    sendExactFailureStage: 'send:start',
    sendFailedOperation: null,
    sendReasonCode: null,
    sendErrorMessage: null,
    sendErrorCode: null,
    sendErrorDetails: null,
    sendErrorHint: null,
    sendSelectedConversationId: input.conversationId,
    sendSenderUserId: input.senderId,
    sendRecipientUserId: null,
    sendSelectedSenderDeviceRowId: input.senderDeviceRecordId,
    sendSelectedRecipientDeviceRowId:
      input.envelopes[0]?.recipientDeviceRecordId ?? null,
  };
  logDmE2eeSendDiagnostics('start', {
    hasConversationId: Boolean(input.conversationId),
    hasSenderDeviceRecordId: Boolean(input.senderDeviceRecordId),
    envelopeCount: input.envelopes.length,
  });
  const conversation = await getConversationForUser(
    input.conversationId,
    input.senderId,
  );

  if (!conversation) {
    sendDebugState.sendExactFailureStage = 'send:conversation-missing';
    sendDebugState.sendFailedOperation = 'conversation lookup';
    sendDebugState.sendReasonCode = 'send: selected conversation unavailable';
    sendDebugState.sendErrorMessage = 'This chat is no longer available.';
    throw createDmE2eeSendProofError(
      'This chat is no longer available.',
      sendDebugState,
    );
  }

  if (conversation.kind !== 'dm') {
    sendDebugState.sendExactFailureStage = 'send:conversation-not-dm';
    sendDebugState.sendFailedOperation = 'conversation kind check';
    sendDebugState.sendReasonCode = 'send: selected conversation unavailable';
    sendDebugState.sendErrorMessage =
      'Encrypted DM send is only available for direct chats.';
    throw createDmE2eeSendProofError(
      'Encrypted DM send is only available for direct chats.',
      sendDebugState,
    );
  }

  sendDebugState.sendExactFailureStage = 'send:conversation-ok';

  const participants = await getConversationParticipants(input.conversationId);
  sendDebugState.sendRecipientUserId =
    participants.find((participant) => participant.userId !== input.senderId)
      ?.userId ?? null;

  if (!input.envelopes.length) {
    sendDebugState.sendExactFailureStage = 'send:missing-envelopes';
    sendDebugState.sendFailedOperation = 'envelope validation';
    sendDebugState.sendReasonCode = 'send: envelope build failed';
    sendDebugState.sendErrorMessage =
      'Encrypted DM send requires at least one ciphertext envelope.';
    throw createDmE2eeSendProofError(
      'Encrypted DM send requires at least one ciphertext envelope.',
      sendDebugState,
    );
  }

  const supabase = await createSupabaseServerClient();
  sendDebugState.sendExactFailureStage = 'send:sender-device-lookup';
  const deviceOwnership = await supabase
    .from('user_devices')
    .select('id')
    .eq('id', input.senderDeviceRecordId)
    .eq('user_id', input.senderId)
    .is('retired_at', null)
    .maybeSingle();

  if (deviceOwnership.error) {
    const diagnostics = getSupabaseErrorDiagnostics(deviceOwnership.error);
    sendDebugState.sendFailedOperation = 'sender device lookup';
    sendDebugState.sendReasonCode = 'send: sender device lookup failed';
    sendDebugState.sendErrorMessage = deviceOwnership.error.message;
    sendDebugState.sendErrorCode =
      typeof diagnostics.error_code === 'string'
        ? diagnostics.error_code
        : null;
    sendDebugState.sendErrorDetails =
      typeof diagnostics.error_details === 'string'
        ? diagnostics.error_details
        : null;
    sendDebugState.sendErrorHint =
      typeof diagnostics.error_hint === 'string'
        ? diagnostics.error_hint
        : null;
    if (
      isMissingRelationErrorMessage(deviceOwnership.error.message, 'user_devices') ||
      isMissingColumnErrorMessage(deviceOwnership.error.message, 'retired_at')
    ) {
      sendDebugState.sendExactFailureStage = 'send:sender-device-lookup:schema';
      throw createDmE2eeSendProofError(
        createSchemaRequirementError(
          'DM E2EE bootstrap schema is missing.',
        ).message,
        sendDebugState,
      );
    }

    sendDebugState.sendExactFailureStage = 'send:sender-device-lookup:error';
    throw createDmE2eeSendProofError(
      deviceOwnership.error.message,
      sendDebugState,
    );
  }

  if (!deviceOwnership.data) {
    sendDebugState.sendExactFailureStage = 'send:sender-device-lookup:stale';
    sendDebugState.sendFailedOperation = 'sender device ownership';
    sendDebugState.sendReasonCode = 'send: sender device lookup failed';
    sendDebugState.sendErrorMessage =
      'Sending device is not registered for DM E2EE.';
    throw applyDmE2eeSendDebugState(
      createDmE2eeOperationError(
        'dm_e2ee_sender_device_stale',
        'Sending device is not registered for DM E2EE.',
      ),
      sendDebugState,
    );
  }
  logDmE2eeSendDiagnostics('sender-device-ok');

  sendDebugState.sendExactFailureStage = 'send:rpc';
  const rpcResult = await supabase.rpc('send_dm_e2ee_message_atomic', {
    p_conversation_id: input.conversationId,
    p_reply_to_message_id: input.replyToMessageId ?? null,
    p_client_id: input.clientId,
    p_sender_device_id: input.senderDeviceRecordId,
    p_envelopes: input.envelopes,
  });

  if (rpcResult.error) {
    const diagnostics = getSupabaseErrorDiagnostics(rpcResult.error);
    sendDebugState.sendFailedOperation = 'send_dm_e2ee_message_atomic';
    sendDebugState.sendErrorMessage = rpcResult.error.message;
    sendDebugState.sendErrorCode =
      typeof diagnostics.error_code === 'string'
        ? diagnostics.error_code
        : null;
    sendDebugState.sendErrorDetails =
      typeof diagnostics.error_details === 'string'
        ? diagnostics.error_details
        : null;
    sendDebugState.sendErrorHint =
      typeof diagnostics.error_hint === 'string'
        ? diagnostics.error_hint
        : null;
    logDmE2eeSendDiagnostics('rpc-error', {
      message: rpcResult.error.message,
      ...sendDebugState,
    });
    if (
      isMissingRelationErrorMessage(rpcResult.error.message, 'message_e2ee_envelopes') ||
      isMissingRelationErrorMessage(rpcResult.error.message, 'user_devices') ||
      isMissingRelationErrorMessage(rpcResult.error.message, 'device_one_time_prekeys') ||
      isMissingFunctionErrorMessage(
        rpcResult.error.message,
        'send_dm_e2ee_message_atomic',
      ) ||
      isMissingColumnErrorMessage(rpcResult.error.message, 'content_mode') ||
      isMissingColumnErrorMessage(rpcResult.error.message, 'sender_device_id') ||
      isMissingColumnErrorMessage(rpcResult.error.message, 'ciphertext') ||
      isMissingColumnErrorMessage(rpcResult.error.message, 'claimed_at')
    ) {
      sendDebugState.sendExactFailureStage = 'send:rpc:schema';
      sendDebugState.sendReasonCode = 'send: rpc schema failed';
      throw createDmE2eeSendProofError(
        createSchemaRequirementError(
          'DM E2EE send schema is missing.',
        ).message,
        sendDebugState,
      );
    }

    if (rpcResult.error.message.includes('dm_e2ee_prekey_conflict')) {
      sendDebugState.sendExactFailureStage = 'send:rpc:prekey-conflict';
      sendDebugState.sendReasonCode = 'send: envelope build failed';
      throw applyDmE2eeSendDebugState(
        createDmE2eeOperationError(
          'dm_e2ee_prekey_conflict',
          'Recipient prekey was already used. Refresh and try sending again.',
        ),
        sendDebugState,
      );
    }

    if (rpcResult.error.message.includes('dm_e2ee_sender_device_stale')) {
      sendDebugState.sendExactFailureStage = 'send:rpc:sender-device-stale';
      sendDebugState.sendReasonCode = 'send: sender device lookup failed';
      throw applyDmE2eeSendDebugState(
        createDmE2eeOperationError(
          'dm_e2ee_sender_device_stale',
          'Sending device is not registered for DM E2EE.',
        ),
        sendDebugState,
      );
    }

    if (
      rpcResult.error.message.includes('dm_e2ee_conversation_unavailable') ||
      rpcResult.error.message.includes('dm_e2ee_recipient_unavailable')
    ) {
      sendDebugState.sendExactFailureStage = 'send:rpc:recipient-unavailable';
      sendDebugState.sendReasonCode = 'send: recipient bundle missing';
      throw applyDmE2eeSendDebugState(
        createDmE2eeOperationError(
          'dm_e2ee_recipient_unavailable',
          'Recipient encrypted setup is unavailable for this direct chat.',
        ),
        sendDebugState,
      );
    }

    if (rpcResult.error.message.includes('dm_e2ee_missing_envelopes')) {
      sendDebugState.sendExactFailureStage = 'send:rpc:missing-envelopes';
      sendDebugState.sendReasonCode = 'send: envelope build failed';
      throw applyDmE2eeSendDebugState(
        createDmE2eeOperationError(
          'dm_e2ee_local_state_incomplete',
          'Local encrypted payload was incomplete. Refresh encrypted setup and try again.',
        ),
        sendDebugState,
      );
    }

    if (rpcResult.error.message.includes('row-level security policy')) {
      sendDebugState.sendExactFailureStage = 'send:rpc:rls';
      sendDebugState.sendReasonCode = 'send: post-send update failed';
      throw createDmE2eeSendProofError(
        createSchemaRequirementError(
          'DM E2EE send is blocked by database policy. Apply the latest atomic send SQL patch.',
        ).message,
        sendDebugState,
      );
    }

    sendDebugState.sendExactFailureStage = 'send:rpc:error';
    sendDebugState.sendReasonCode = 'send: message row insert failed';
    throw createDmE2eeSendProofError(
      rpcResult.error.message,
      sendDebugState,
    );
  }

  sendDebugState.sendExactFailureStage = 'send:rpc:ok';
  const row = Array.isArray(rpcResult.data)
    ? (rpcResult.data[0] as
        | { message_id?: string | null; created_at?: string | null; client_id?: string | null }
        | undefined)
    : (rpcResult.data as
        | { message_id?: string | null; created_at?: string | null; client_id?: string | null }
        | null);

  const messageId = String(row?.message_id ?? '').trim();

  if (!messageId) {
    sendDebugState.sendExactFailureStage = 'send:rpc:missing-message-id';
    sendDebugState.sendFailedOperation = 'atomic send result';
    sendDebugState.sendReasonCode = 'send: message row insert failed';
    sendDebugState.sendErrorMessage =
      'Encrypted DM send did not return a persisted message id.';
    throw createDmE2eeSendProofError(
      'Encrypted DM send did not return a persisted message id.',
      sendDebugState,
    );
  }

  logDmE2eeSendDiagnostics('done', {
    hasMessageId: true,
  });

  return {
    messageId,
    timestamp: row?.created_at ?? new Date().toISOString(),
    clientId: String(row?.client_id ?? input.clientId),
  };
}

async function createMessageRecord(input: {
  conversationId: string;
  senderId: string;
  body?: string | null;
  replyToMessageId?: string | null;
  touchConversation?: boolean;
  kind?: 'text' | 'attachment' | 'voice';
  clientId?: string;
  contentMode?: 'plaintext' | 'dm_e2ee_v1';
  senderDeviceId?: string | null;
}) {
  const supabase = await createSupabaseServerClient();
  const timestamp = new Date().toISOString();
  const clientId = input.clientId?.trim() || crypto.randomUUID();
  const messageId = crypto.randomUUID();

  if (!input.senderId) {
    throw new Error(
      'Message sending debug: authenticated sender is required before insert.',
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error(
      'Message sending debug: no authenticated user found in the server action client.',
    );
  }

  if (!user.id) {
    throw new Error(
      'Message sending debug: authenticated user is present but user.id is missing.',
    );
  }

  if (input.senderId !== user.id) {
    throw new Error(
      `Message sending debug: sender_id mismatch. auth user id=${user.id}, payload sender_id=${input.senderId}.`,
    );
  }

  const payload = buildMessageInsertPayload({
    messageId,
    conversationId: input.conversationId,
    senderId: input.senderId,
    replyToMessageId: input.replyToMessageId ?? null,
    kind: input.kind ?? 'text',
    clientId,
    body: input.body ?? null,
    contentMode: input.contentMode,
    senderDeviceId: input.senderDeviceId ?? null,
  });

  const { error: insertError } = await supabase.from('messages').insert(payload);

  if (insertError) {
    if (
      (input.contentMode === 'dm_e2ee_v1' &&
        (isMissingColumnErrorMessage(insertError.message, 'content_mode') ||
          isMissingColumnErrorMessage(insertError.message, 'sender_device_id'))) ||
      (input.contentMode === 'dm_e2ee_v1' &&
        isMissingColumnErrorMessage(insertError.message, 'body'))
    ) {
      throw createSchemaRequirementError('DM E2EE send schema is missing.');
    }

    if (insertError.message.includes('row-level security policy')) {
      throw new Error(
        `Message sending debug: insert blocked by messages RLS. auth user id=${user.id}, payload sender_id=${input.senderId}, conversation_id=${input.conversationId}. Values match, so the failure is likely database-side RLS state or membership policy rather than payload construction.`,
      );
    }

    throw new Error(insertError.message);
  }

  if (input.touchConversation ?? true) {
    const { error: updateError } = await supabase
      .from('conversations')
      .update({ last_message_at: timestamp })
      .eq('id', input.conversationId);

    if (updateError) {
      throw new Error(updateError.message);
    }
  }

  return {
    messageId,
    timestamp,
    clientId,
  };
}

export async function editMessage(input: {
  messageId: string;
  conversationId: string;
  senderId: string;
  body: string;
}) {
  const supabase = await createSupabaseServerClient();
  const timestamp = new Date().toISOString();

  if (!input.senderId) {
    throw new Error('Authenticated sender is required to edit a message.');
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    throw new Error('Message edit debug: no authenticated user found.');
  }

  if (user.id !== input.senderId) {
    throw new Error(
      `Message edit debug: sender mismatch. auth user id=${user.id}, payload sender_id=${input.senderId}.`,
    );
  }

  const { error } = await supabase
    .from('messages')
    .update({
      body: input.body.trim(),
      edited_at: timestamp,
    })
    .eq('id', input.messageId)
    .eq('conversation_id', input.conversationId)
    .eq('sender_id', input.senderId)
    .is('deleted_at', null);

  if (error) {
    if (error.message.includes('row-level security policy')) {
      throw new Error(
        'Message edit debug: update blocked by messages RLS.',
      );
    }

    throw new Error(error.message);
  }
}

export async function softDeleteMessage(input: {
  messageId: string;
  conversationId: string;
  senderId: string;
}) {
  const supabase = await createSupabaseServerClient();
  const timestamp = new Date().toISOString();

  if (!input.senderId) {
    throw new Error('Authenticated sender is required to delete a message.');
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    throw new Error('Message delete debug: no authenticated user found.');
  }

  if (user.id !== input.senderId) {
    throw new Error(
      `Message delete debug: sender mismatch. auth user id=${user.id}, payload sender_id=${input.senderId}.`,
    );
  }

  const { error } = await supabase
    .from('messages')
    .update({
      deleted_at: timestamp,
      edited_at: null,
    })
    .eq('id', input.messageId)
    .eq('conversation_id', input.conversationId)
    .eq('sender_id', input.senderId)
    .is('deleted_at', null);

  if (error) {
    if (error.message.includes('row-level security policy')) {
      throw new Error(
        'Message delete debug: update blocked by messages RLS.',
      );
    }

    throw new Error(error.message);
  }
}

export async function updateConversationTitle(input: {
  conversationId: string;
  userId: string;
  title: string;
}) {
  const supabase = await createSupabaseServerClient();

  if (!input.userId) {
    throw new Error('Authenticated user is required to edit a group title.');
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    throw new Error('Conversation settings debug: no authenticated user found.');
  }

  if (user.id !== input.userId) {
    throw new Error(
      `Conversation settings debug: user mismatch. auth user id=${user.id}, payload user id=${input.userId}.`,
    );
  }

  const { error } = await supabase
    .from('conversations')
    .update({ title: input.title.trim() })
    .eq('id', input.conversationId)
    .eq('kind', 'group')
    .eq('created_by', input.userId);

  if (error) {
    if (error.message.includes('row-level security policy')) {
      throw new Error(
        'Conversation settings debug: title update blocked by conversations RLS.',
      );
    }

    throw new Error(error.message);
  }
}

export async function updateConversationIdentity(input: {
  conversationId: string;
  userId: string;
  title: string;
  avatarFile?: File | null;
  removeAvatar?: boolean;
}) {
  const supabase = await createSupabaseServerClient();

  if (!input.userId) {
    throw new Error('Authenticated user is required to edit group settings.');
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    throw new Error('Conversation settings debug: no authenticated user found.');
  }

  if (user.id !== input.userId) {
    throw new Error(
      `Conversation settings debug: user mismatch. auth user id=${user.id}, payload user id=${input.userId}.`,
    );
  }

  const nextTitle = input.title.trim();

  if (!nextTitle) {
    throw new Error('Group title cannot be empty.');
  }

  if (nextTitle.length > 80) {
    throw new Error('Group title can be up to 80 characters.');
  }

  const existingConversationResponse = await supabase
    .from('conversations')
    .select('kind, created_by, avatar_path')
    .eq('id', input.conversationId)
    .maybeSingle();

  let existingConversation = existingConversationResponse.data as
    | {
        kind?: string | null;
        created_by?: string | null;
        avatar_path?: string | null;
      }
    | null;

  if (existingConversationResponse.error) {
    if (isMissingColumnErrorMessage(existingConversationResponse.error.message, 'avatar_path')) {
      const fallbackConversationResponse = await supabase
        .from('conversations')
        .select('kind, created_by')
        .eq('id', input.conversationId)
        .maybeSingle();

      if (fallbackConversationResponse.error) {
        throw new Error(fallbackConversationResponse.error.message);
      }

      existingConversation = (fallbackConversationResponse.data as
        | {
            kind?: string | null;
            created_by?: string | null;
          }
        | null) ?? null;
    } else {
      throw new Error(existingConversationResponse.error.message);
    }
  }

  if (!existingConversation || existingConversation.kind !== 'group') {
    throw new Error('Only group chats support editable chat identity.');
  }

  if ((existingConversation.created_by ?? null) !== input.userId) {
    throw new Error('Only the group owner can edit chat identity.');
  }

  const existingAvatarPath = existingConversation.avatar_path?.trim() || null;
  const avatarFile = input.avatarFile && input.avatarFile.size > 0 ? input.avatarFile : null;
  const shouldRemoveAvatar = Boolean(input.removeAvatar) && !avatarFile;
  let nextAvatarPath: string | null | undefined;
  let uploadedAvatarObjectPath: string | null = null;

  if (avatarFile) {
    if (avatarFile.size > PROFILE_AVATAR_MAX_SIZE_BYTES) {
      throw new Error('Avatar images can be up to 5 MB.');
    }

    if (!SUPPORTED_PROFILE_AVATAR_TYPES.has(avatarFile.type)) {
      throw new Error('Avatar must be a JPG, PNG, WEBP, or GIF image.');
    }

    const serviceSupabase = createSupabaseServiceRoleClient();

    if (!serviceSupabase) {
      throw new Error('Chat avatar uploads are not available right now.');
    }

    const fileName = sanitizeProfileFileName(avatarFile.name);
    const objectPath = `conversations/${input.conversationId}/${crypto.randomUUID()}-${fileName}`;
    const { error: uploadError } = await serviceSupabase.storage
      .from(PROFILE_AVATAR_BUCKET)
      .upload(objectPath, avatarFile, {
        upsert: false,
        contentType: avatarFile.type,
      });

    if (uploadError) {
      if (isBucketNotFoundStorageErrorMessage(uploadError.message)) {
        throw new Error(getAvatarBucketRequirementErrorMessage());
      }

      throw new Error(uploadError.message);
    }

    uploadedAvatarObjectPath = objectPath;
    nextAvatarPath = objectPath;
  } else if (shouldRemoveAvatar) {
    nextAvatarPath = null;
  }

  const updatePayload = {
    title: nextTitle,
    ...(nextAvatarPath !== undefined ? { avatar_path: nextAvatarPath } : {}),
  };

  const { error } = await supabase
    .from('conversations')
    .update(updatePayload)
    .eq('id', input.conversationId)
    .eq('kind', 'group')
    .eq('created_by', input.userId);

  if (error) {
    if (uploadedAvatarObjectPath) {
      await createSupabaseServiceRoleClient()
        ?.storage.from(PROFILE_AVATAR_BUCKET)
        .remove([uploadedAvatarObjectPath]);
    }

    if (isMissingColumnErrorMessage(error.message, 'avatar_path')) {
      throw createSchemaRequirementError(
        'Editable group avatars require public.conversations.avatar_path.',
      );
    }

    if (error.message.includes('row-level security policy')) {
      throw new Error(
        'Conversation settings debug: identity update blocked by conversations RLS.',
      );
    }

    throw new Error(error.message);
  }

  if (
    existingAvatarPath &&
    isManagedConversationAvatarObjectPath(input.conversationId, existingAvatarPath) &&
    existingAvatarPath !== uploadedAvatarObjectPath &&
    (uploadedAvatarObjectPath || shouldRemoveAvatar)
  ) {
    await createSupabaseServiceRoleClient()
      ?.storage.from(PROFILE_AVATAR_BUCKET)
      .remove([existingAvatarPath]);
  }
}

export async function addParticipantsToGroupConversation(input: {
  conversationId: string;
  ownerUserId: string;
  participantUserIds: string[];
}) {
  const supabase = await createSupabaseServerClient();

  if (!input.ownerUserId) {
    throw new Error('Group management debug: authenticated owner is required.');
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    throw new Error('Group management debug: no authenticated user found.');
  }

  if (user.id !== input.ownerUserId) {
    throw new Error(
      `Group management debug: owner mismatch. auth user id=${user.id}, payload owner id=${input.ownerUserId}.`,
    );
  }

  const actingMembership = await getActiveGroupMembership(
    input.conversationId,
    input.ownerUserId,
  );

  if (!actingMembership) {
    throw new Error(
      'Only an active group owner can add participants in this first version.',
    );
  }

  if (actingMembership.role !== 'owner') {
    throw new Error('Only the group owner can add participants.');
  }

  const participantUserIds = dedupeParticipantIds(input.participantUserIds).filter(
    (participantUserId) => participantUserId !== input.ownerUserId,
  );

  if (participantUserIds.length === 0) {
    throw new Error('Choose at least one participant to add.');
  }

  const { data: existingMemberships, error: membershipLookupError } = await supabase
    .from('conversation_members')
    .select('user_id, state')
    .eq('conversation_id', input.conversationId)
    .in('user_id', participantUserIds);

  if (membershipLookupError) {
    throw new Error(membershipLookupError.message);
  }

  const existingByUserId = new Map(
    ((existingMemberships ?? []) as {
      user_id: string;
      state: string | null;
    }[]).map((row) => [row.user_id, row]),
  );
  const usersToReactivate = participantUserIds.filter((participantUserId) => {
    const existing = existingByUserId.get(participantUserId);
    return existing && existing.state !== 'active';
  });
  const usersToInsert = participantUserIds.filter(
    (participantUserId) => !existingByUserId.has(participantUserId),
  );

  if (usersToReactivate.length > 0) {
    const { error: reactivateError } = await supabase
      .from('conversation_members')
      .update({
        state: 'active',
        role: 'member',
        last_read_message_seq: null,
        last_read_at: null,
      })
      .eq('conversation_id', input.conversationId)
      .in('user_id', usersToReactivate);

    if (reactivateError) {
      throw new Error(reactivateError.message);
    }
  }

  if (usersToInsert.length > 0) {
    const { error: insertError } = await supabase
      .from('conversation_members')
      .insert(
        usersToInsert.map((participantUserId) => ({
          conversation_id: input.conversationId,
          user_id: participantUserId,
          role: 'member',
          state: 'active',
        })),
      );

    if (insertError) {
      throw new Error(insertError.message);
    }
  }
}

export async function removeParticipantFromGroupConversation(input: {
  conversationId: string;
  ownerUserId: string;
  targetUserId: string;
}) {
  const supabase = await createSupabaseServerClient();

  if (!input.ownerUserId) {
    throw new Error('Group management debug: authenticated owner is required.');
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    throw new Error('Group management debug: no authenticated user found.');
  }

  if (user.id !== input.ownerUserId) {
    throw new Error(
      `Group management debug: owner mismatch. auth user id=${user.id}, payload owner id=${input.ownerUserId}.`,
    );
  }

  const actingMembership = await getActiveGroupMembership(
    input.conversationId,
    input.ownerUserId,
  );

  if (!actingMembership || actingMembership.role !== 'owner') {
    throw new Error('Only the group owner can remove participants.');
  }

  if (!input.targetUserId) {
    throw new Error('Choose a participant to remove.');
  }

  if (input.targetUserId === input.ownerUserId) {
    throw new Error('Use leave group to remove yourself from the conversation.');
  }

  const targetMembership = await getActiveGroupMembership(
    input.conversationId,
    input.targetUserId,
  );

  if (!targetMembership) {
    throw new Error('That participant is no longer active in this group.');
  }

  if (targetMembership.role === 'owner') {
    throw new Error('The current group owner cannot be removed here.');
  }

  const { error: removeError } = await supabase
    .from('conversation_members')
    .update({ state: 'removed' })
    .eq('conversation_id', input.conversationId)
    .eq('user_id', input.targetUserId)
    .eq('state', 'active');

  if (removeError) {
    throw new Error(removeError.message);
  }
}

export async function leaveGroupConversation(input: {
  conversationId: string;
  userId: string;
}) {
  const supabase = await createSupabaseServerClient();

  if (!input.userId) {
    throw new Error('Group leave debug: authenticated user is required.');
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    throw new Error('Group leave debug: no authenticated user found.');
  }

  if (user.id !== input.userId) {
    throw new Error(
      `Group leave debug: user mismatch. auth user id=${user.id}, payload user id=${input.userId}.`,
    );
  }

  const actingMembership = await getActiveGroupMembership(
    input.conversationId,
    input.userId,
  );

  if (!actingMembership) {
    throw new Error('You are no longer an active member of this group.');
  }

  if (actingMembership.role === 'owner') {
    const { data: nextOwnerRows, error: nextOwnerError } = await supabase
      .from('conversation_members')
      .select('user_id')
      .eq('conversation_id', input.conversationId)
      .eq('state', 'active')
      .neq('user_id', input.userId)
      .order('user_id', { ascending: true })
      .limit(1);

    if (nextOwnerError) {
      throw new Error(nextOwnerError.message);
    }

    const nextOwnerUserId = nextOwnerRows?.[0]?.user_id as string | undefined;

    if (nextOwnerUserId) {
      const { error: promoteError } = await supabase
        .from('conversation_members')
        .update({ role: 'owner' })
        .eq('conversation_id', input.conversationId)
        .eq('user_id', nextOwnerUserId)
        .eq('state', 'active');

      if (promoteError) {
        throw new Error(promoteError.message);
      }
    }
  }

  const { error: leaveError } = await supabase
    .from('conversation_members')
    .update({ state: 'left' })
    .eq('conversation_id', input.conversationId)
    .eq('user_id', input.userId)
    .eq('state', 'active');

  if (leaveError) {
    throw new Error(leaveError.message);
  }
}

export async function sendMessageWithAttachment(input: {
  conversationId: string;
  senderId: string;
  body?: string | null;
  replyToMessageId?: string | null;
  file: File;
}) {
  if (!input.file || input.file.size === 0) {
    throw new Error('Choose a file before sending.');
  }

  if (input.file.size > CHAT_ATTACHMENT_MAX_SIZE_BYTES) {
    throw new Error('Attachments can be up to 10 MB in this first version.');
  }

  if (!isSupportedChatAttachmentType(input.file.type)) {
    throw new Error(CHAT_ATTACHMENT_HELP_TEXT);
  }

  const supabase = await createSupabaseServerClient();
  const attachmentMessageKind = getAttachmentMessageKind(input.file.type);
  const storageFolder = attachmentMessageKind === 'voice' ? 'voice' : 'files';
  const messageResult = await createMessageRecord({
    conversationId: input.conversationId,
    senderId: input.senderId,
    body: input.body ?? null,
    replyToMessageId: input.replyToMessageId ?? null,
    touchConversation: false,
    kind: attachmentMessageKind,
  });
  const fileName = sanitizeAttachmentFileName(input.file.name);
  const objectPath = `${input.conversationId}/${messageResult.messageId}/${storageFolder}/${Date.now()}-${fileName}`;
  const fileBuffer = Buffer.from(await input.file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from(CHAT_ATTACHMENT_BUCKET)
    .upload(objectPath, fileBuffer, {
      cacheControl: '3600',
      contentType: input.file.type,
      upsert: false,
    });

  if (uploadError) {
    await supabase.from('messages').delete().eq('id', messageResult.messageId);
    throw new Error(uploadError.message);
  }

  const { error: attachmentError } = await supabase
    .from('message_attachments')
    .insert({
      message_id: messageResult.messageId,
      bucket: CHAT_ATTACHMENT_BUCKET,
      object_path: objectPath,
      mime_type: input.file.type,
      size_bytes: input.file.size,
    });

  if (attachmentError) {
    await supabase.storage.from(CHAT_ATTACHMENT_BUCKET).remove([objectPath]);
    await supabase.from('messages').delete().eq('id', messageResult.messageId);
    throw new Error(attachmentError.message);
  }

  const { error: updateError } = await supabase
    .from('conversations')
    .update({ last_message_at: messageResult.timestamp })
    .eq('id', input.conversationId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  return messageResult;
}
