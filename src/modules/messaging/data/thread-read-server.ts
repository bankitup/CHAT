import 'server-only';

import { cookies } from 'next/headers';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service';
import type { ProfileIdentityRecord } from '@/modules/profile/types';
import type { EncryptedDmServerHistoryHint } from '@/modules/messaging/e2ee/ui-policy';
import { DM_E2EE_CURRENT_DEVICE_COOKIE } from '@/modules/messaging/e2ee/current-device-cookie';
import type { StoredDmE2eeEnvelope } from '@/modules/messaging/contract/dm-e2ee';
import type { MessagingVoicePlaybackVariantRecord } from '@/modules/messaging/media/message-assets';
import { getProfileIdentities } from './profiles-server';
import { getConversationMemberHistoryBoundary } from './conversation-read-server';

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

export type MessageReactionGroup = {
  emoji: string;
  count: number;
  selectedByCurrentUser: boolean;
};

export type MessageSenderProfile = ProfileIdentityRecord;

type MessageAttachmentRow = {
  id: string;
  message_id: string;
  bucket: string;
  object_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string | null;
};

type MessageAssetAttachmentRow = {
  asset_id: string;
  created_at: string | null;
  duration_ms: number | null;
  external_url: string | null;
  file_name: string | null;
  kind: 'image' | 'file' | 'audio' | 'voice-note';
  message_id: string;
  mime_type: string | null;
  size_bytes: number | null;
  source: 'supabase-storage' | 'external-url';
  storage_bucket: string | null;
  storage_object_path: string | null;
};

export type MessageAttachment = {
  id: string;
  messageId: string;
  bucket: string;
  objectPath: string;
  mimeType: string | null;
  sizeBytes: number | null;
  durationMs?: number | null;
  createdAt: string | null;
  fileName: string;
  signedUrl: string | null;
  isImage: boolean;
  isAudio: boolean;
  isVoiceMessage: boolean;
  voicePlaybackVariants?: MessagingVoicePlaybackVariantRecord[] | null;
};

export type ConversationHistoryPageSnapshot = {
  attachmentsByMessage: Array<{
    attachments: MessageAttachment[];
    messageId: string;
  }>;
  dmE2ee:
    | {
        activeDeviceCreatedAt: string | null;
        activeDeviceRecordId: string | null;
        envelopesByMessage: Array<{
          envelope: StoredDmE2eeEnvelope;
          messageId: string;
        }>;
        historyHintsByMessage: Array<{
          hint: EncryptedDmServerHistoryHint;
          messageId: string;
        }>;
        selectionSource: string | null;
      }
    | null;
  hasMoreOlder: boolean;
  messages: ConversationMessage[];
  oldestMessageSeq: number | null;
  reactionsByMessage: Array<{
    messageId: string;
    reactions: MessageReactionGroup[];
  }>;
  senderProfiles: MessageSenderProfile[];
};

type MessageReactionRow = {
  id: string;
  message_id: string;
  emoji: string;
  user_id: string;
  created_at: string | null;
};

type MessageE2eeEnvelopeRow = {
  message_id: string;
  recipient_device_id: string;
  envelope_type: string;
  ciphertext: string;
  used_one_time_prekey_id: number | null;
  created_at: string | null;
  messages:
    | { sender_device_id?: string | null; sender_id?: string | null }
    | Array<{ sender_device_id?: string | null; sender_id?: string | null }>
    | null;
};

type MessageAssetsWriteClient =
  Awaited<ReturnType<typeof createSupabaseServerClient>>;

const CHAT_ATTACHMENT_BUCKET = 'message-media';

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

function isMissingRelationErrorMessage(message: string, relationName: string) {
  const normalizedMessage = message.toLowerCase();
  return (
    normalizedMessage.includes('relation') &&
    normalizedMessage.includes(relationName.toLowerCase())
  );
}

function shouldLogChatHistoryDiagnostics() {
  return (
    process.env.CHAT_DEBUG_DM_E2EE_BOOTSTRAP === '1' ||
    process.env.NEXT_PUBLIC_CHAT_DEBUG_LIVE_REFRESH === '1'
  );
}

function logChatHistoryDiagnostics(
  stage: string,
  details?: Record<string, unknown>,
  level: 'info' | 'warn' | 'error' = 'info',
) {
  const shouldLog = level === 'error' || shouldLogChatHistoryDiagnostics();

  if (!shouldLog) {
    return;
  }

  if (details) {
    console[level]('[chat-history-load]', stage, details);
    return;
  }

  console[level]('[chat-history-load]', stage);
}

function shouldLogChatThreadSnapshotDiagnostics() {
  return (
    process.env.CHAT_DEBUG_DM_E2EE_BOOTSTRAP === '1' ||
    process.env.NEXT_PUBLIC_CHAT_DEBUG_LIVE_REFRESH === '1' ||
    process.env.CHAT_DEBUG_THREAD_SNAPSHOT === '1'
  );
}

function logChatThreadSnapshotCheckpoint(
  stage: string,
  details?: Record<string, unknown>,
) {
  if (!shouldLogChatThreadSnapshotDiagnostics()) {
    return;
  }

  if (details) {
    console.info('[chat-thread-snapshot]', stage, details);
    return;
  }

  console.info('[chat-thread-snapshot]', stage);
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

function isAudioAttachment(mimeType: string | null) {
  return Boolean(mimeType?.startsWith('audio/'));
}

function parseConversationHistoryDate(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function getConversationMessages(
  conversationId: string,
  options?: {
    afterSeqExclusive?: number | null;
    beforeSeqExclusive?: number | null;
    debugRequestId?: string | null;
    limitLatest?: number | null;
    messageIds?: string[] | null;
    visibleFromSeqInclusive?: number | null;
  },
) {
  const supabase = await createSupabaseServerClient();
  const normalizedLimit =
    typeof options?.limitLatest === 'number' &&
    Number.isFinite(options.limitLatest) &&
    options.limitLatest > 0
      ? Math.floor(options.limitLatest)
      : null;
  const afterSeqExclusive =
    typeof options?.afterSeqExclusive === 'number' &&
    Number.isFinite(options.afterSeqExclusive)
      ? Math.floor(options.afterSeqExclusive)
      : null;
  const beforeSeqExclusive =
    typeof options?.beforeSeqExclusive === 'number' &&
    Number.isFinite(options.beforeSeqExclusive)
      ? Math.floor(options.beforeSeqExclusive)
      : null;
  const normalizedMessageIds = Array.from(
    new Set((options?.messageIds ?? []).map((messageId) => messageId.trim()).filter(Boolean)),
  );
  const queryMode =
    normalizedMessageIds.length > 0
      ? 'by-id'
      : afterSeqExclusive !== null
        ? 'after-seq'
        : 'latest';
  const queryLimit =
    queryMode === 'latest'
      ? normalizedLimit !== null
        ? normalizedLimit + 1
        : null
      : queryMode === 'after-seq'
        ? normalizedLimit
        : null;
  const visibleFromSeqInclusive =
    typeof options?.visibleFromSeqInclusive === 'number' &&
    Number.isFinite(options.visibleFromSeqInclusive) &&
    options.visibleFromSeqInclusive > 0
      ? Math.floor(options.visibleFromSeqInclusive)
      : null;
  const buildMessagesQuery = (selectClause: string) => {
    let query = supabase
      .from('messages')
      .select(selectClause)
      .eq('conversation_id', conversationId);

    if (visibleFromSeqInclusive !== null) {
      query = query.gte('seq', visibleFromSeqInclusive);
    }

    if (normalizedMessageIds.length > 0) {
      query = query
        .in('id', normalizedMessageIds)
        .order('seq', { ascending: true });
    } else if (afterSeqExclusive !== null) {
      query = query
        .gt('seq', afterSeqExclusive)
        .order('seq', { ascending: true });
    } else {
      query = query.order('seq', { ascending: false });
    }

    if (queryMode === 'latest' && beforeSeqExclusive !== null) {
      query = query.lt('seq', beforeSeqExclusive);
    }

    return queryLimit !== null ? query.limit(queryLimit) : query;
  };
  const response = await buildMessagesQuery(
    'id, conversation_id, sender_id, sender_device_id, reply_to_message_id, seq, kind, client_id, body, content_mode, edited_at, deleted_at, created_at',
  );

  const normalizeMessages = (data: ConversationMessage[]) => {
    const hasMoreOlder =
      queryMode === 'latest' &&
      normalizedLimit !== null &&
      data.length > normalizedLimit;
    const pagedRows =
      queryMode === 'latest' && normalizedLimit !== null && hasMoreOlder
        ? data.slice(0, normalizedLimit)
        : data;
    const normalizedMessages =
      queryMode === 'latest' ? [...pagedRows].reverse() : [...pagedRows];

    if (process.env.CHAT_DEBUG_DM_E2EE_BOOTSTRAP === '1') {
      console.info('[chat-history-load]', 'messages:loaded', {
        afterSeqExclusive,
        conversationId,
        count: normalizedMessages.length,
        debugRequestId: options?.debugRequestId ?? null,
        deploymentId: process.env.VERCEL_DEPLOYMENT_ID ?? null,
        firstMessageId: normalizedMessages[0]?.id ?? null,
        gitCommitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
        hasMoreOlder,
        beforeSeqExclusive,
        lastMessageId:
          normalizedMessages[normalizedMessages.length - 1]?.id ?? null,
        limitLatest: normalizedLimit,
        messageIds:
          normalizedMessageIds.length > 0 ? normalizedMessageIds : null,
        mode: queryMode,
        queryLimit,
        visibleFromSeqInclusive,
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
        await buildMessagesQuery(
          'id, conversation_id, sender_id, reply_to_message_id, seq, kind, client_id, body, edited_at, deleted_at, created_at',
        );

      if (fallback.error) {
        throw new Error(fallback.error.message);
      }

      return normalizeMessages(
        ((fallback.data ?? []) as unknown) as ConversationMessage[],
      );
    }

    throw new Error(response.error.message);
  }

  return normalizeMessages(
    ((response.data ?? []) as unknown) as ConversationMessage[],
  );
}

export async function getConversationHistoryWindowSizeForMessageTargets(input: {
  conversationId: string;
  messageIds: string[];
  userId: string;
}) {
  const normalizedMessageIds = Array.from(
    new Set(input.messageIds.map((value) => value.trim()).filter(Boolean)),
  );

  if (normalizedMessageIds.length === 0) {
    return null;
  }

  const [supabase, historyBoundary] = await Promise.all([
    createSupabaseServerClient(),
    getConversationMemberHistoryBoundary(input.conversationId, input.userId),
  ]);
  const visibleFromSeq = historyBoundary?.visibleFromSeq ?? null;
  const targetMessages = await supabase
    .from('messages')
    .select('id, seq')
    .eq('conversation_id', input.conversationId)
    .gte('seq', visibleFromSeq ?? 0)
    .in('id', normalizedMessageIds);

  if (targetMessages.error) {
    throw new Error(targetMessages.error.message);
  }

  const minimumTargetSeq = (targetMessages.data ?? []).reduce<number | null>(
    (currentMinimum, row) => {
      const normalizedSeq =
        typeof row.seq === 'number'
          ? row.seq
          : typeof row.seq === 'string'
            ? Number(row.seq)
            : null;

      if (normalizedSeq === null || !Number.isFinite(normalizedSeq)) {
        return currentMinimum;
      }

      if (currentMinimum === null) {
        return normalizedSeq;
      }

      return Math.min(currentMinimum, normalizedSeq);
    },
    null,
  );

  if (minimumTargetSeq === null) {
    return null;
  }

  const countLookup = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('conversation_id', input.conversationId)
    .gte('seq', visibleFromSeq ?? 0)
    .gte('seq', minimumTargetSeq);

  if (countLookup.error) {
    throw new Error(countLookup.error.message);
  }

  return countLookup.count ?? null;
}

async function getCurrentUserActiveDmE2eeDeviceInfo(input: {
  preferredDeviceRecordId?: string | null;
  userId: string;
}) {
  const supabase = await createSupabaseServerClient();
  const cookieStore = await cookies();
  const hintedDeviceRecordId =
    cookieStore.get(DM_E2EE_CURRENT_DEVICE_COOKIE)?.value?.trim() || null;
  const preferredDeviceRecordId =
    input.preferredDeviceRecordId?.trim() || null;
  const resolveDevice = async (hintedId: string | null) =>
    hintedId
      ? supabase
          .from('user_devices')
          .select('id, created_at')
          .eq('user_id', input.userId)
          .eq('id', hintedId)
          .is('retired_at', null)
          .maybeSingle()
      : supabase
          .from('user_devices')
          .select('id, created_at')
          .eq('user_id', input.userId)
          .is('retired_at', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
  const candidateDeviceIds = Array.from(
    new Set(
      [preferredDeviceRecordId, hintedDeviceRecordId]
        .map((value) => value?.trim() || '')
        .filter(Boolean),
    ),
  );
  let response:
    | Awaited<ReturnType<typeof resolveDevice>>
    | null = null;
  let selectionSource: 'client-hint' | 'cookie' | 'latest-active' =
    'latest-active';

  for (const candidateDeviceId of candidateDeviceIds) {
    response = await resolveDevice(candidateDeviceId);

    if (response.error || response.data) {
      selectionSource =
        candidateDeviceId === preferredDeviceRecordId ? 'client-hint' : 'cookie';
      break;
    }
  }

  if (!response || (!response.error && !response.data)) {
    response = await resolveDevice(null);
    selectionSource = 'latest-active';
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
    selectionSource,
  } as const;
}

async function getCurrentUserDmE2eeEnvelopesForMessages(input: {
  debugRequestId?: string | null;
  userId: string;
  messageIds: string[];
  preferredDeviceRecordId?: string | null;
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

  const activeDevice = await getCurrentUserActiveDmE2eeDeviceInfo({
    preferredDeviceRecordId: input.preferredDeviceRecordId ?? null,
    userId: input.userId,
  });
  const activeDeviceRecordId = activeDevice?.id ?? null;
  logDiagnostics('envelopes:active-device-resolved', {
    currentUserId: input.userId,
    activeDeviceRecordId,
    activeDeviceCreatedAt: activeDevice?.createdAt ?? null,
    debugRequestId: input.debugRequestId ?? null,
    messageCount: uniqueMessageIds.length,
    selectionSource: activeDevice?.selectionSource ?? null,
  });

  const supabase = await createSupabaseServerClient();
  const serviceRoleSupabase = createSupabaseServiceRoleClient();
  const lookupEnvelopes = async (
    client: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  ) =>
    client
      .from('message_e2ee_envelopes')
      .select(
        'message_id, recipient_device_id, envelope_type, ciphertext, used_one_time_prekey_id, created_at, messages!inner(sender_device_id,sender_id)',
      )
      .in('message_id', uniqueMessageIds);

  const selectReadableEnvelopes = (
    rows: MessageE2eeEnvelopeRow[] | null | undefined,
  ) => {
    let malformedEnvelopeCount = 0;
    let selectedCurrentDeviceEnvelopeCount = 0;
    let selectedSenderSelfEnvelopeCount = 0;
    const messagesWithAnyEnvelopeRows = new Set<string>();
    const messagesWithOtherDeviceEnvelopes = new Set<string>();
    const messagesWithReadableEnvelope = new Set<string>();
    const otherRecipientDeviceIds = new Set<string>();
    const selectedEnvelopes = (rows ?? []).flatMap<
      [string, StoredDmE2eeEnvelope]
    >((row) => {
      const messageRecord = normalizeJoinedRecord(row.messages);
      const senderDeviceRecordId = String(
        messageRecord?.sender_device_id ?? '',
      ).trim();
      const senderId = String(messageRecord?.sender_id ?? '').trim();
      const recipientDeviceRecordId = String(row.recipient_device_id ?? '').trim();
      const ciphertext = String(row.ciphertext ?? '').trim();
      messagesWithAnyEnvelopeRows.add(row.message_id);

      const isCurrentDeviceEnvelope =
        Boolean(activeDeviceRecordId) &&
        recipientDeviceRecordId === activeDeviceRecordId;
      const isSenderSelfEnvelope =
        senderId === input.userId &&
        Boolean(senderDeviceRecordId) &&
        recipientDeviceRecordId === senderDeviceRecordId;

      if (!isCurrentDeviceEnvelope && !isSenderSelfEnvelope) {
        if (recipientDeviceRecordId) {
          otherRecipientDeviceIds.add(recipientDeviceRecordId);
        }
        messagesWithOtherDeviceEnvelopes.add(row.message_id);
        return [];
      }

      if (!senderDeviceRecordId || !ciphertext) {
        malformedEnvelopeCount += 1;
        logDiagnostics('envelopes:skip-malformed', {
          currentUserId: input.userId,
          debugRequestId: input.debugRequestId ?? null,
          hasCiphertext: Boolean(ciphertext),
          messageId: row.message_id,
          recipientDeviceRecordId,
          senderDeviceRecordId,
        });
        return [];
      }

      if (isCurrentDeviceEnvelope) {
        selectedCurrentDeviceEnvelopeCount += 1;
      } else if (isSenderSelfEnvelope) {
        selectedSenderSelfEnvelopeCount += 1;
      }
      messagesWithReadableEnvelope.add(row.message_id);

      return [[
        row.message_id,
        {
          messageId: row.message_id,
          senderDeviceRecordId,
          recipientDeviceRecordId,
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

    return {
      envelopeMap: new Map(selectedEnvelopes),
      malformedEnvelopeCount,
      messagesWithOnlyOtherDeviceEnvelopes: Array.from(
        messagesWithOtherDeviceEnvelopes,
      ).filter((messageId) => !messagesWithReadableEnvelope.has(messageId)),
      otherRecipientDeviceIds: Array.from(otherRecipientDeviceIds),
      selectedCurrentDeviceEnvelopeCount,
      selectedSenderSelfEnvelopeCount,
      totalEnvelopeRowCount: (rows ?? []).length,
      totalMessagesWithAnyEnvelopeRows: messagesWithAnyEnvelopeRows.size,
    };
  };

  let response = await lookupEnvelopes(supabase);
  let usedPrivilegedEnvelopeLookup = false;
  const authEnvelopeRowCount = Array.isArray(response.data)
    ? response.data.length
    : 0;
  let selectedEnvelopeResult = selectReadableEnvelopes(
    (response.data ?? null) as MessageE2eeEnvelopeRow[] | null,
  );
  const authSelectedEnvelopeCount = selectedEnvelopeResult.envelopeMap.size;
  const shouldRetryWithPrivilegedEnvelopeLookup =
    serviceRoleSupabase &&
    (isSupabasePermissionDeniedError(response.error) ||
      (!response.error &&
        authSelectedEnvelopeCount < uniqueMessageIds.length));

  if (shouldRetryWithPrivilegedEnvelopeLookup) {
    logDiagnostics(
      response.error
        ? 'envelopes:auth-error-fallback'
        : 'envelopes:auth-selection-fallback',
      {
        activeDeviceRecordId,
        authEnvelopeRowCount,
        authSelectedEnvelopeCount,
        currentUserId: input.userId,
        debugRequestId: input.debugRequestId ?? null,
        errorMessage: response.error?.message ?? null,
        requestedMessageCount: uniqueMessageIds.length,
      },
    );

    const privilegedResponse = await lookupEnvelopes(serviceRoleSupabase);
    const privilegedEnvelopeRowCount = Array.isArray(privilegedResponse.data)
      ? privilegedResponse.data.length
      : 0;
    const privilegedSelectedEnvelopeResult = selectReadableEnvelopes(
      (privilegedResponse.data ?? null) as MessageE2eeEnvelopeRow[] | null,
    );
    const privilegedSelectedEnvelopeCount =
      privilegedSelectedEnvelopeResult.envelopeMap.size;

    if (
      !privilegedResponse.error &&
      (response.error ||
        privilegedSelectedEnvelopeCount > authSelectedEnvelopeCount ||
        (privilegedSelectedEnvelopeCount === authSelectedEnvelopeCount &&
          privilegedEnvelopeRowCount > authEnvelopeRowCount))
    ) {
      response = privilegedResponse;
      selectedEnvelopeResult = privilegedSelectedEnvelopeResult;
      usedPrivilegedEnvelopeLookup = true;
    }
  }

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

  if (!activeDeviceRecordId) {
    logDiagnostics('envelopes:no-active-device', {
      currentUserId: input.userId,
      debugRequestId: input.debugRequestId ?? null,
    });
  }
  logDiagnostics('envelopes:loaded', {
    currentUserId: input.userId,
    activeDeviceRecordId,
    activeDeviceCreatedAt: activeDevice?.createdAt ?? null,
    authEnvelopeRowCount,
    authSelectedEnvelopeCount,
    debugRequestId: input.debugRequestId ?? null,
    messagesWithOnlyOtherDeviceEnvelopes:
      selectedEnvelopeResult.messagesWithOnlyOtherDeviceEnvelopes,
    messagesWithOnlyOtherDeviceEnvelopesCount:
      selectedEnvelopeResult.messagesWithOnlyOtherDeviceEnvelopes.length,
    malformedEnvelopeCount: selectedEnvelopeResult.malformedEnvelopeCount,
    otherRecipientDeviceCount:
      selectedEnvelopeResult.otherRecipientDeviceIds.length,
    otherRecipientDeviceIds: selectedEnvelopeResult.otherRecipientDeviceIds,
    selectedCurrentDeviceEnvelopeCount:
      selectedEnvelopeResult.selectedCurrentDeviceEnvelopeCount,
    selectedSenderSelfEnvelopeCount:
      selectedEnvelopeResult.selectedSenderSelfEnvelopeCount,
    requestedMessageCount: uniqueMessageIds.length,
    envelopeCount: selectedEnvelopeResult.envelopeMap.size,
    selectionSource: activeDevice?.selectionSource ?? null,
    totalEnvelopeRowCount: selectedEnvelopeResult.totalEnvelopeRowCount,
    totalMessagesWithAnyEnvelopeRows:
      selectedEnvelopeResult.totalMessagesWithAnyEnvelopeRows,
    usedPrivilegedEnvelopeLookup,
  });

  return {
    activeDeviceCreatedAt: activeDevice?.createdAt ?? null,
    activeDeviceRecordId,
    envelopesByMessage: selectedEnvelopeResult.envelopeMap,
    selectionSource: activeDevice?.selectionSource ?? null,
  };
}

export async function getConversationHistorySnapshot(input: {
  afterSeqExclusive?: number | null;
  beforeSeqExclusive?: number | null;
  conversationId: string;
  debugRequestId?: string | null;
  limit: number;
  messageIds?: string[] | null;
  preferredDeviceRecordId?: string | null;
  userId: string;
}): Promise<ConversationHistoryPageSnapshot> {
  const normalizedLimit =
    Number.isFinite(input.limit) && input.limit > 0
      ? Math.floor(input.limit)
      : 26;
  const historyBoundary = await getConversationMemberHistoryBoundary(
    input.conversationId,
    input.userId,
  );
  const currentUserConversationJoinedAt = historyBoundary?.joinedAt ?? null;
  const visibleFromSeq = historyBoundary?.visibleFromSeq ?? null;
  const { messages, hasMoreOlder } = await getConversationMessages(
    input.conversationId,
    {
      afterSeqExclusive: input.afterSeqExclusive ?? null,
      beforeSeqExclusive: input.beforeSeqExclusive ?? null,
      debugRequestId: input.debugRequestId ?? null,
      limitLatest: normalizedLimit,
      messageIds: input.messageIds ?? null,
      visibleFromSeqInclusive: visibleFromSeq,
    },
  );
  const messageIds = messages.map((message) => message.id);
  const attachmentMessageIds = messages
    .filter(
      (message) => message.kind === 'attachment' || message.kind === 'voice',
    )
    .map((message) => message.id);
  const encryptedMessageIds = messages
    .filter(
      (message) =>
        (message.kind === 'text' || message.kind === 'attachment') &&
        message.content_mode === 'dm_e2ee_v1',
    )
    .map((message) => message.id);
  const senderProfileIds = Array.from(
    new Set(messages.map((message) => message.sender_id ?? '').filter(Boolean)),
  );
  logChatThreadSnapshotCheckpoint('history-loaded', {
    afterSeqExclusive: input.afterSeqExclusive ?? null,
    beforeSeqExclusive: input.beforeSeqExclusive ?? null,
    conversationId: input.conversationId,
    debugRequestId: input.debugRequestId ?? null,
    encryptedMessageCount: encryptedMessageIds.length,
    hasMoreOlder,
    messageCount: messages.length,
    messageIdsCount: messageIds.length,
    oldestMessageSeq:
      messages.length > 0
        ? Number(
            typeof messages[0]?.seq === 'number'
              ? messages[0]?.seq
              : Number(messages[0]?.seq ?? 0),
          )
        : null,
    senderProfileIdCount: senderProfileIds.length,
    visibleFromSeq,
  });
  logChatThreadSnapshotCheckpoint('shared-substeps-started', {
    conversationId: input.conversationId,
    debugRequestId: input.debugRequestId ?? null,
    encryptedMessageCount: encryptedMessageIds.length,
    messageCount: messages.length,
    senderProfileIdCount: senderProfileIds.length,
  });
  logChatThreadSnapshotCheckpoint('sender-profiles-started', {
    conversationId: input.conversationId,
    debugRequestId: input.debugRequestId ?? null,
    senderProfileIdCount: senderProfileIds.length,
  });
  logChatThreadSnapshotCheckpoint('reaction-mapping-started', {
    conversationId: input.conversationId,
    debugRequestId: input.debugRequestId ?? null,
    messageIdsCount: messageIds.length,
  });
  logChatThreadSnapshotCheckpoint('attachment-voice-mapping-started', {
    conversationId: input.conversationId,
    debugRequestId: input.debugRequestId ?? null,
    messageIdsCount: attachmentMessageIds.length,
  });
  logChatThreadSnapshotCheckpoint('encrypted-envelope-load-started', {
    conversationId: input.conversationId,
    debugRequestId: input.debugRequestId ?? null,
    encryptedMessageCount: encryptedMessageIds.length,
  });
  const [
    senderProfilesResult,
    reactionsByMessageResult,
    attachmentsByMessageResult,
    e2eeEnvelopeHistoryResult,
  ] = await Promise.allSettled([
    getMessageSenderProfiles(senderProfileIds, {
      includeAvatarPath: false,
      includeStatuses: false,
    }),
    getGroupedReactionsForMessages(messageIds, input.userId),
    getMessageAttachments(input.conversationId, attachmentMessageIds),
    getCurrentUserDmE2eeEnvelopesForMessages({
      debugRequestId: input.debugRequestId ?? null,
      messageIds: encryptedMessageIds,
      preferredDeviceRecordId: input.preferredDeviceRecordId ?? null,
      userId: input.userId,
    }),
  ]);
  const unwrapSnapshotSubstep = <T,>(
    stage: string,
    result: PromiseSettledResult<T>,
  ) => {
    if (result.status === 'fulfilled') {
      return result.value;
    }

    const error =
      result.reason instanceof Error
        ? result.reason
        : new Error(String(result.reason));

    logChatHistoryDiagnostics(
      'snapshot:substep-failed',
      {
        conversationId: input.conversationId,
        debugRequestId: input.debugRequestId ?? null,
        encryptedMessageCount: encryptedMessageIds.length,
        errorMessage: error.message,
        messageCount: messages.length,
        messageIdsCount: messageIds.length,
        stage,
        userId: input.userId,
        visibleFromSeq,
      },
      'error',
    );

    throw error;
  };
  const senderProfiles = unwrapSnapshotSubstep(
    'sender-profiles',
    senderProfilesResult,
  );
  logChatThreadSnapshotCheckpoint('sender-profiles-completed', {
    conversationId: input.conversationId,
    debugRequestId: input.debugRequestId ?? null,
    profileCount: senderProfiles.length,
  });
  const reactionsByMessage = unwrapSnapshotSubstep(
    'reactions',
    reactionsByMessageResult,
  );
  logChatThreadSnapshotCheckpoint('reaction-mapping-completed', {
    conversationId: input.conversationId,
    debugRequestId: input.debugRequestId ?? null,
    messagesWithReactionsCount: Array.from(reactionsByMessage.values()).filter(
      (reactions) => reactions.length > 0,
    ).length,
    reactionGroupCount: Array.from(reactionsByMessage.values()).reduce(
      (count, reactions) => count + reactions.length,
      0,
    ),
  });
  const attachmentsByMessage = unwrapSnapshotSubstep(
    'attachments',
    attachmentsByMessageResult,
  );
  logChatThreadSnapshotCheckpoint('attachment-voice-mapping-completed', {
    conversationId: input.conversationId,
    debugRequestId: input.debugRequestId ?? null,
    messagesWithAttachmentsCount: Array.from(attachmentsByMessage.values()).filter(
      (attachments) => attachments.length > 0,
    ).length,
    totalAttachmentCount: Array.from(attachmentsByMessage.values()).reduce(
      (count, attachments) => count + attachments.length,
      0,
    ),
    voiceAttachmentCount: Array.from(attachmentsByMessage.values()).reduce(
      (count, attachments) =>
        count + attachments.filter((attachment) => attachment.isVoiceMessage).length,
      0,
    ),
    voicePlayableCount: Array.from(attachmentsByMessage.values()).reduce(
      (count, attachments) =>
        count +
        attachments.filter(
          (attachment) => attachment.isVoiceMessage && Boolean(attachment.signedUrl),
        ).length,
      0,
    ),
    voiceUnavailableCount: Array.from(attachmentsByMessage.values()).reduce(
      (count, attachments) =>
        count +
        attachments.filter(
          (attachment) => attachment.isVoiceMessage && !attachment.signedUrl,
        ).length,
      0,
    ),
  });
  if (shouldLogChatHistoryDiagnostics()) {
    for (const message of messages) {
      if (message.kind !== 'voice') {
        continue;
      }

      const attachments = attachmentsByMessage.get(message.id) ?? [];
      const voiceAttachments = attachments.filter(
        (attachment) => attachment.isVoiceMessage || attachment.isAudio,
      );

      logChatHistoryDiagnostics('voice-row-resolution', {
        attachmentCount: attachments.length,
        conversationId: input.conversationId,
        debugRequestId: input.debugRequestId ?? null,
        hasPlaybackReadyVoiceAttachment: voiceAttachments.some((attachment) =>
          Boolean(attachment.signedUrl),
        ),
        messageId: message.id,
        mode:
          (input.messageIds?.length ?? 0) > 0
            ? 'by-id'
            : input.afterSeqExclusive !== null
              ? 'after-seq'
              : input.beforeSeqExclusive !== null
                ? 'before-seq'
                : 'latest',
        signedUrlReadyCount: voiceAttachments.filter((attachment) =>
          Boolean(attachment.signedUrl),
        ).length,
        storageLocatorCount: voiceAttachments.filter(
          (attachment) =>
            Boolean(attachment.bucket) && Boolean(attachment.objectPath),
        ).length,
        voiceAttachmentCount: voiceAttachments.length,
      });
    }
  }
  const e2eeEnvelopeHistory = unwrapSnapshotSubstep(
    'dm-e2ee-envelopes',
    e2eeEnvelopeHistoryResult,
  );
  logChatThreadSnapshotCheckpoint('encrypted-unavailable-mapping-started', {
    conversationId: input.conversationId,
    debugRequestId: input.debugRequestId ?? null,
    encryptedEnvelopeCount: e2eeEnvelopeHistory.envelopesByMessage.size,
    encryptedMessageCount: encryptedMessageIds.length,
  });
  const messagesById = new Map(messages.map((message) => [message.id, message]));
  const currentUserJoinedAtDate = parseConversationHistoryDate(
    currentUserConversationJoinedAt,
  );
  const encryptedHistoryHints = encryptedMessageIds.map((messageId) => {
    const message = messagesById.get(messageId) ?? null;
    const messageCreatedAtDate = parseConversationHistoryDate(
      message?.created_at ?? null,
    );
    const wasSentBeforeViewerJoined =
      Boolean(message) &&
      message?.sender_id !== input.userId &&
      messageCreatedAtDate !== null &&
      currentUserJoinedAtDate !== null &&
      messageCreatedAtDate.getTime() < currentUserJoinedAtDate.getTime();

    return {
      hint: {
        code: e2eeEnvelopeHistory.envelopesByMessage.has(messageId)
          ? 'envelope-present'
          : wasSentBeforeViewerJoined
            ? 'policy-blocked-history'
            : 'missing-envelope',
        committedHistoryState: 'present',
        currentDeviceAvailability: e2eeEnvelopeHistory.envelopesByMessage.has(messageId)
          ? 'envelope-present'
          : wasSentBeforeViewerJoined
            ? 'policy-blocked-history'
            : 'missing-envelope',
        recoveryDisposition: e2eeEnvelopeHistory.envelopesByMessage.has(messageId)
          ? 'already-readable'
          : wasSentBeforeViewerJoined
            ? 'policy-blocked'
            : 'not-supported-v1',
        activeDeviceRecordId: e2eeEnvelopeHistory.activeDeviceRecordId,
        messageCreatedAt: message?.created_at ?? null,
        viewerJoinedAt: currentUserConversationJoinedAt,
      } satisfies EncryptedDmServerHistoryHint,
      messageId,
    };
  });
  logChatThreadSnapshotCheckpoint('encrypted-unavailable-mapping-completed', {
    conversationId: input.conversationId,
    debugRequestId: input.debugRequestId ?? null,
    encryptedEnvelopeCount: e2eeEnvelopeHistory.envelopesByMessage.size,
    encryptedHintCount: encryptedHistoryHints.length,
    encryptedMessageCount: encryptedMessageIds.length,
    missingEnvelopeCount: encryptedHistoryHints.filter(
      (entry) => entry.hint.code === 'missing-envelope',
    ).length,
    policyBlockedCount: encryptedHistoryHints.filter(
      (entry) => entry.hint.code === 'policy-blocked-history',
    ).length,
  });

  if (process.env.CHAT_DEBUG_DM_E2EE_BOOTSTRAP === '1') {
    console.info('[chat-history-load]', 'dm-e2ee-history-snapshot', {
      conversationId: input.conversationId,
      debugRequestId: input.debugRequestId ?? null,
      encryptedEnvelopeCount: e2eeEnvelopeHistory.envelopesByMessage.size,
      encryptedMessageCount: encryptedMessageIds.length,
      encryptedMessageIds,
      selectionSource: e2eeEnvelopeHistory.selectionSource,
      visibleFromSeq,
      userId: input.userId,
    });
  }

  logChatThreadSnapshotCheckpoint('snapshot-props-prepared', {
    conversationId: input.conversationId,
    debugRequestId: input.debugRequestId ?? null,
    hasMoreOlder,
    messageCount: messages.length,
    senderProfileCount: senderProfiles.length,
  });

  return {
    attachmentsByMessage: messageIds.map((messageId) => ({
      attachments: attachmentsByMessage.get(messageId) ?? [],
      messageId,
    })),
    dmE2ee: {
      activeDeviceCreatedAt: e2eeEnvelopeHistory.activeDeviceCreatedAt,
      activeDeviceRecordId: e2eeEnvelopeHistory.activeDeviceRecordId,
      envelopesByMessage: encryptedMessageIds.flatMap((messageId) => {
        const envelope = e2eeEnvelopeHistory.envelopesByMessage.get(messageId);

        return envelope ? [{ envelope, messageId }] : [];
      }),
      historyHintsByMessage: encryptedHistoryHints,
      selectionSource: e2eeEnvelopeHistory.selectionSource,
    },
    hasMoreOlder,
    messages,
    oldestMessageSeq:
      messages.length > 0
        ? Number(
            typeof messages[0]?.seq === 'number'
              ? messages[0]?.seq
              : Number(messages[0]?.seq ?? 0),
          )
        : null,
    reactionsByMessage: messageIds.map((messageId) => ({
      messageId,
      reactions: reactionsByMessage.get(messageId) ?? [],
    })),
    senderProfiles,
  };
}

export async function getMessageSenderProfiles(
  userIds: string[],
  options?: {
    includeAvatarPath?: boolean;
    includeStatuses?: boolean;
  },
) {
  return getProfileIdentities(userIds, options);
}

function buildConversationAttachmentContentUrl(input: {
  attachmentId: string;
  conversationId: string;
  messageId: string;
}) {
  return `/api/messaging/conversations/${input.conversationId}/messages/${input.messageId}/attachments/${input.attachmentId}/content`;
}

function buildChatAttachmentDeliveryUrl(input: {
  attachmentId: string;
  conversationId?: string | null;
  messageId: string;
}) {
  return buildConversationAttachmentContentUrl({
    attachmentId: input.attachmentId,
    conversationId: input.conversationId ?? '',
    messageId: input.messageId,
  });
}

export type ResolvedConversationAttachmentContentTarget = {
  attachmentId: string;
  bucket: string;
  fileName: string | null;
  messageId: string;
  mimeType: string | null;
  objectPath: string;
  source: 'legacy-attachment' | 'message-asset';
};

export async function resolveConversationAttachmentContentTarget(input: {
  attachmentId: string;
  conversationId: string;
  messageId: string;
  userId: string;
}): Promise<ResolvedConversationAttachmentContentTarget | null> {
  const supabase = await createSupabaseServerClient();
  const serviceSupabase = createSupabaseServiceRoleClient();
  const normalizedAttachmentId = input.attachmentId.trim();
  const normalizedConversationId = input.conversationId.trim();
  const normalizedMessageId = input.messageId.trim();

  if (
    !normalizedAttachmentId ||
    !normalizedConversationId ||
    !normalizedMessageId ||
    !input.userId.trim()
  ) {
    return null;
  }

  const messageLookup = await supabase
    .from('messages')
    .select('id')
    .eq('id', normalizedMessageId)
    .eq('conversation_id', normalizedConversationId)
    .maybeSingle();

  if (messageLookup.error) {
    throw new Error(messageLookup.error.message);
  }

  if (!messageLookup.data) {
    logChatHistoryDiagnostics('attachment-content:message-missing', {
      attachmentId: normalizedAttachmentId,
      conversationId: normalizedConversationId,
      messageId: normalizedMessageId,
      userId: input.userId,
    });
    return null;
  }

  const legacyAttachmentLookup = await supabase
    .from('message_attachments')
    .select('id, message_id, bucket, object_path, mime_type')
    .eq('id', normalizedAttachmentId)
    .eq('message_id', normalizedMessageId)
    .maybeSingle();

  if (legacyAttachmentLookup.error) {
    if (
      !isMissingRelationErrorMessage(
        legacyAttachmentLookup.error.message,
        'message_attachments',
      )
    ) {
      throw new Error(legacyAttachmentLookup.error.message);
    }
  } else if (legacyAttachmentLookup.data) {
    return {
      attachmentId: String(legacyAttachmentLookup.data.id),
      bucket: String(legacyAttachmentLookup.data.bucket),
      fileName: getAttachmentFileName(String(legacyAttachmentLookup.data.object_path)),
      messageId: normalizedMessageId,
      mimeType:
        typeof legacyAttachmentLookup.data.mime_type === 'string'
          ? legacyAttachmentLookup.data.mime_type
          : null,
      objectPath: String(legacyAttachmentLookup.data.object_path),
      source: 'legacy-attachment' as const,
    };
  }

  const loadAssetLinkRow = async (client: MessageAssetsWriteClient) =>
    client
      .from('message_asset_links')
      .select(
        'message_id, message_assets!inner(id, kind, source, storage_bucket, storage_object_path, external_url, mime_type, file_name)',
      )
      .eq('message_id', normalizedMessageId)
      .eq('asset_id', normalizedAttachmentId)
      .maybeSingle();

  let assetLookup = await loadAssetLinkRow(supabase);

  if (assetLookup.error) {
    const shouldRetryWithServiceRole =
      !isMissingRelationErrorMessage(assetLookup.error.message, 'message_asset_links') &&
      !isMissingRelationErrorMessage(assetLookup.error.message, 'message_assets');

    if (shouldRetryWithServiceRole && serviceSupabase) {
      assetLookup = await loadAssetLinkRow(
        serviceSupabase as MessageAssetsWriteClient,
      );
    }

    if (assetLookup.error) {
      throw new Error(assetLookup.error.message);
    }
  }

  const asset = normalizeJoinedRecord(assetLookup.data?.message_assets ?? null);

  if (!asset) {
    logChatHistoryDiagnostics('attachment-content:asset-missing', {
      attachmentId: normalizedAttachmentId,
      conversationId: normalizedConversationId,
      messageId: normalizedMessageId,
      userId: input.userId,
    });
    return null;
  }

  if (asset.source === 'external-url') {
    logChatHistoryDiagnostics(
      'attachment-content:external-url-blocked',
      {
        attachmentId: normalizedAttachmentId,
        conversationId: normalizedConversationId,
        messageId: normalizedMessageId,
        source: asset.source,
        userId: input.userId,
      },
      'warn',
    );
    return null;
  }

  if (!asset.storage_bucket || !asset.storage_object_path) {
    logChatHistoryDiagnostics('attachment-content:storage-locator-missing', {
      attachmentId: normalizedAttachmentId,
      conversationId: normalizedConversationId,
      messageId: normalizedMessageId,
      source: asset.source,
      userId: input.userId,
    });
    return null;
  }

  return {
    attachmentId: String(asset.id),
    bucket: String(asset.storage_bucket),
    fileName:
      typeof asset.file_name === 'string' && asset.file_name.trim()
        ? asset.file_name.trim()
        : getAttachmentFileName(String(asset.storage_object_path)),
    messageId: normalizedMessageId,
    mimeType:
      typeof asset.mime_type === 'string' ? asset.mime_type : null,
    objectPath: String(asset.storage_object_path),
    source: 'message-asset' as const,
  };
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

export async function getMessageAttachments(
  conversationId: string,
  messageIds: string[],
) {
  const uniqueMessageIds = Array.from(new Set(messageIds.filter(Boolean)));

  if (uniqueMessageIds.length === 0) {
    return new Map<string, MessageAttachment[]>();
  }

  const supabase = await createSupabaseServerClient();
  const serviceSupabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from('message_attachments')
    .select('id, message_id, bucket, object_path, mime_type, size_bytes, created_at')
    .in('message_id', uniqueMessageIds)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  let assetRows: MessageAssetAttachmentRow[] = [];
  const isMissingOptionalMessageAssetProjectionErrorMessage = (
    message: string,
  ) =>
    [
      'ordinal',
      'render_as_primary',
      'storage_bucket',
      'storage_object_path',
      'external_url',
      'file_name',
      'size_bytes',
      'duration_ms',
    ].some((columnName) => isMissingColumnErrorMessage(message, columnName));
  const canIgnoreMessageAssetProjectionError = (message: string) =>
    isMissingRelationErrorMessage(message, 'message_asset_links') ||
    isMissingRelationErrorMessage(message, 'message_assets') ||
    isMissingOptionalMessageAssetProjectionErrorMessage(message);
  const loadMessageAssetRows = async (client: MessageAssetsWriteClient) =>
    client
      .from('message_asset_links')
      .select(
        'message_id, created_at, message_assets!inner(id, kind, source, storage_bucket, storage_object_path, external_url, mime_type, file_name, size_bytes, duration_ms, created_at)',
      )
      .in('message_id', uniqueMessageIds)
      .order('created_at', { ascending: true });

  let assetResponse = await loadMessageAssetRows(supabase);

  if (assetResponse.error) {
    if (!canIgnoreMessageAssetProjectionError(assetResponse.error.message)) {
      if (serviceSupabase) {
        assetResponse = await loadMessageAssetRows(
          serviceSupabase as MessageAssetsWriteClient,
        );
      }
    }

    if (assetResponse.error && !canIgnoreMessageAssetProjectionError(assetResponse.error.message)) {
      throw new Error(assetResponse.error.message);
    }

    if (
      assetResponse.error &&
      isMissingOptionalMessageAssetProjectionErrorMessage(
        assetResponse.error.message,
      )
    ) {
      logChatHistoryDiagnostics(
        'attachments:asset-projection-schema-fallback',
        {
          errorMessage: assetResponse.error.message,
          messageIdsCount: uniqueMessageIds.length,
        },
        'warn',
      );
    }
  }

  if (!assetResponse.error) {
    assetRows = ((assetResponse.data ?? []) as Array<{
      created_at: string | null;
      message_assets:
        | {
            created_at?: string | null;
            duration_ms?: number | null;
            external_url?: string | null;
            file_name?: string | null;
            id: string;
            kind: 'image' | 'file' | 'audio' | 'voice-note';
            mime_type?: string | null;
            size_bytes?: number | null;
            source: 'supabase-storage' | 'external-url';
            storage_bucket?: string | null;
            storage_object_path?: string | null;
          }
        | Array<{
            created_at?: string | null;
            duration_ms?: number | null;
            external_url?: string | null;
            file_name?: string | null;
            id: string;
            kind: 'image' | 'file' | 'audio' | 'voice-note';
            mime_type?: string | null;
            size_bytes?: number | null;
            source: 'supabase-storage' | 'external-url';
            storage_bucket?: string | null;
            storage_object_path?: string | null;
          }>
        | null;
      message_id: string;
    }>)
      .map((row) => {
        const asset = normalizeJoinedRecord(row.message_assets);

        if (!asset) {
          return null;
        }

        return {
          asset_id: asset.id,
          created_at: row.created_at ?? asset.created_at ?? null,
          duration_ms: asset.duration_ms ?? null,
          external_url: asset.external_url ?? null,
          file_name: asset.file_name ?? null,
          kind: asset.kind,
          message_id: row.message_id,
          mime_type: asset.mime_type ?? null,
          size_bytes: asset.size_bytes ?? null,
          source: asset.source,
          storage_bucket: asset.storage_bucket ?? null,
          storage_object_path: asset.storage_object_path ?? null,
        } satisfies MessageAssetAttachmentRow;
      })
      .filter((row): row is MessageAssetAttachmentRow => Boolean(row));
  }

  const attachments = await Promise.all(
    [
      ...((data ?? []) as MessageAttachmentRow[]).map(async (row) => {
        const isVoiceMessage = row.object_path.includes('/voice/');
        const signedUrl = buildChatAttachmentDeliveryUrl({
          attachmentId: row.id,
          conversationId,
          messageId: row.message_id,
        });

        return {
          id: row.id,
          messageId: row.message_id,
          bucket: row.bucket,
          objectPath: row.object_path,
          mimeType: row.mime_type,
          sizeBytes: row.size_bytes,
          durationMs: null,
          createdAt: row.created_at,
          fileName: getAttachmentFileName(row.object_path),
          signedUrl,
          isImage: isImageAttachment(row.mime_type),
          isAudio: isAudioAttachment(row.mime_type),
          isVoiceMessage,
        } satisfies MessageAttachment;
      }),
      ...assetRows.map(async (row) => {
        let signedUrl: string | null = null;
        const isVoiceMessage = row.kind === 'voice-note';

        if (row.source === 'external-url') {
          logChatHistoryDiagnostics(
            'attachments:external-url-blocked',
            {
              attachmentId: row.asset_id,
              conversationId,
              messageId: row.message_id,
              source: row.source,
            },
            'warn',
          );
        } else if (
          row.source === 'supabase-storage' &&
          row.storage_bucket &&
          row.storage_object_path
        ) {
          signedUrl = buildChatAttachmentDeliveryUrl({
            attachmentId: row.asset_id,
            conversationId,
            messageId: row.message_id,
          });
        }

        return {
          id: row.asset_id,
          messageId: row.message_id,
          bucket: row.storage_bucket ?? CHAT_ATTACHMENT_BUCKET,
          objectPath: row.storage_object_path ?? '',
          mimeType: row.mime_type,
          sizeBytes: row.size_bytes,
          durationMs: row.duration_ms,
          createdAt: row.created_at,
          fileName:
            row.file_name?.trim() ||
            (row.storage_object_path
              ? getAttachmentFileName(row.storage_object_path)
              : 'attachment'),
          signedUrl,
          isImage: row.kind === 'image' || isImageAttachment(row.mime_type),
          isAudio: row.kind === 'audio' || row.kind === 'voice-note' || isAudioAttachment(row.mime_type),
          isVoiceMessage,
        } satisfies MessageAttachment;
      }),
    ],
  );

  const grouped = new Map<string, MessageAttachment[]>();

  for (const attachment of attachments) {
    const existing = grouped.get(attachment.messageId) ?? [];
    existing.push(attachment);
    grouped.set(attachment.messageId, existing);
  }

  return grouped;
}

export async function resolveConversationAttachmentSignedUrl(input: {
  attachmentId: string;
  conversationId: string;
  messageId: string;
  userId: string;
}) {
  const resolvedTarget = await resolveConversationAttachmentContentTarget(input);

  if (!resolvedTarget) {
    return null;
  }

  const signedUrl = buildConversationAttachmentContentUrl({
    attachmentId: resolvedTarget.attachmentId,
    conversationId: input.conversationId.trim(),
    messageId: resolvedTarget.messageId,
  });

  logChatHistoryDiagnostics('attachment-delivery-url:resolved', {
    attachmentId: resolvedTarget.attachmentId,
    bucket: resolvedTarget.bucket,
    conversationId: input.conversationId.trim(),
    hasDeliveryUrl: Boolean(signedUrl),
    messageId: resolvedTarget.messageId,
    objectPath: resolvedTarget.objectPath,
    source: resolvedTarget.source,
    userId: input.userId,
  });

  return {
    signedUrl,
    source: resolvedTarget.source,
  };
}
