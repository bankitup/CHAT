'use client';

import dynamic from 'next/dynamic';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  getChatClientTranslations,
  type AppLanguage,
} from '@/modules/i18n/client-chat';
import {
  formatPersonFallbackLabel,
  getLocaleForLanguage,
} from '@/modules/i18n/client-shared';
import type { StoredDmE2eeEnvelope } from '@/modules/messaging/contract/dm-e2ee';
import type { EncryptedDmServerHistoryHint } from '@/modules/messaging/e2ee/ui-policy';
import {
  logBrokenThreadHistoryProof,
  shouldLogBrokenThreadHistoryProof,
  summarizeBrokenThreadHistorySnapshot,
  summarizeBrokenThreadMessagePatches,
} from '@/modules/messaging/diagnostics/thread-history-proof';
import {
  emitThreadHistorySyncRequest,
  type ThreadHistoryLiveMessagePayload,
  type ThreadHistorySyncRequestPayload,
} from '@/modules/messaging/realtime/thread-history-sync-events';
import {
  getThreadLiveStateSnapshot,
  reconcileThreadLiveReactionSnapshot,
} from '@/modules/messaging/realtime/thread-live-state-store';
import { resolvePublicIdentityLabel } from '@/modules/profile/ui/identity-label';
import {
  readThreadMessagePatchSnapshot,
  reconcileThreadMessagePatchesWithAuthoritativeMessages,
} from '@/modules/messaging/realtime/thread-message-patch-store';
import { ThreadHistoryMessageList } from './thread-history-message-list';
import {
  filterRenderableMessageAttachments,
  getEncryptedHistoryHintForMessage,
  isOwnAttachmentCommitTransitionPending,
  normalizeAttachmentSignedUrl,
  normalizeMessageBodyText,
} from './thread-message-row';
import { resolveThreadScrollTarget } from './thread-scroll';
import type {
  ActiveImagePreview,
  ConversationMessageRow,
  EncryptedUnavailableRunMeta,
  MessageAttachment,
  ThreadHistoryPageSnapshot,
  ThreadHistorySessionCacheEntry,
  ThreadHistoryState,
  ThreadHistoryViewportProps,
  TimelineItem,
  TimelineLabels,
  TimelineRenderItem,
} from './thread-history-types';
import {
  useThreadHistoryPrependScrollRestore,
  type PendingScrollRestore,
} from './use-thread-history-prepend-scroll-restore';
import { useThreadHistoryRecovery } from './use-thread-history-recovery';
import {
  type PendingAuthoritativeLatestWindowThreadHistorySyncRequest,
  useThreadHistorySyncRuntime,
  type PendingAfterSeqThreadHistorySyncRequest,
  type PendingByIdThreadHistorySyncRequest,
} from './use-thread-history-sync-runtime';
import { ThreadViewportDeferredEffects } from './thread-viewport-deferred-effects';
import {
  hasMessagingVoiceLocallyRecoverableSource,
} from '@/modules/messaging/media/message-assets';

const ThreadImagePreviewOverlay = dynamic(() =>
  import('./thread-image-preview-overlay').then(
    (mod) => mod.ThreadImagePreviewOverlay,
  ),
);

const THREAD_HISTORY_PAGE_SIZE = 26;
const PREPEND_SCROLL_RESTORE_IDLE_MS = 72;
const PREPEND_SCROLL_RESTORE_MAX_MS = 480;
const ENCRYPTED_DM_MISSING_ENVELOPE_RECOVERY_REASON =
  'local-encrypted-send:retry-missing-envelope';
const ENCRYPTED_DM_HISTORY_CONTINUITY_RECOVERY_REASON =
  'dm-e2ee-history:retry-after-bootstrap';
const ENCRYPTED_DM_CURRENT_DEVICE_RESYNC_REASON =
  'dm-e2ee-history:current-device-resync';
const ENCRYPTED_DM_MISSING_ENVELOPE_RETRY_DELAYS_MS = [220, 900] as const;
const ATTACHMENT_MESSAGE_REOPEN_RECOVERY_REASON =
  'attachment-reopen:retry-attachment-resolution';
const ATTACHMENT_MESSAGE_RECOVERY_REASON =
  'attachment:retry-attachment-resolution';
const ATTACHMENT_MESSAGE_RETRY_DELAYS_MS = [180, 700] as const;
const VOICE_MESSAGE_ATTACHMENT_RECOVERY_REASON =
  'local-voice-send:retry-attachment-resolution';
const VOICE_MESSAGE_REOPEN_RECOVERY_REASON =
  'voice-reopen:retry-attachment-resolution';
const VOICE_MESSAGE_ATTACHMENT_RETRY_DELAYS_MS = [180, 700] as const;
const ATTACHMENT_MESSAGE_RECOVERY_MAX_AGE_MS = 10 * 60 * 1000;
const VOICE_MESSAGE_RECOVERY_MAX_AGE_MS = 10 * 60 * 1000;
const MESSAGE_CLUSTER_MAX_GAP_MS = 5 * 60 * 1000;
const THREAD_HISTORY_SESSION_CACHE_MAX_ENTRIES = 6;
const THREAD_MOUNT_RECOVERY_REASON = 'thread-mount-recovery';
const EMPTY_MESSAGE_ATTACHMENTS: MessageAttachment[] = [];
const threadHistorySessionCache = new Map<string, ThreadHistorySessionCacheEntry>();
const threadShortDateFormatterByLanguage = new Map<AppLanguage, Intl.DateTimeFormat>();
const threadShortDateWithYearFormatterByLanguage = new Map<
  AppLanguage,
  Intl.DateTimeFormat
>();
const loggedThreadGuardDiagnosticKeys = new Set<string>();

function parseSafeDate(value: unknown) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const parsedDate = new Date(trimmed);

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return parsedDate;
}

function getCalendarDayKey(value: string | null) {
  const date = parseSafeDate(value);

  if (!date) {
    return 'unknown';
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function formatDaySeparatorLabel(
  value: string | null,
  language: AppLanguage,
  labels: Pick<TimelineLabels, 'earlier' | 'today' | 'yesterday'>,
) {
  const targetDate = parseSafeDate(value);

  if (!targetDate) {
    return labels.earlier;
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const compareDate = new Date(
    targetDate.getFullYear(),
    targetDate.getMonth(),
    targetDate.getDate(),
  );

  if (compareDate.getTime() === today.getTime()) {
    return labels.today;
  }

  if (compareDate.getTime() === yesterday.getTime()) {
    return labels.yesterday;
  }

  return (
    targetDate.getFullYear() === now.getFullYear()
      ? getThreadShortDateFormatter(language)
      : getThreadShortDateWithYearFormatter(language)
  ).format(targetDate);
}

function getThreadShortDateFormatter(language: AppLanguage) {
  const cachedFormatter = threadShortDateFormatterByLanguage.get(language);

  if (cachedFormatter) {
    return cachedFormatter;
  }

  const formatter = new Intl.DateTimeFormat(getLocaleForLanguage(language), {
    month: 'short',
    day: 'numeric',
  });
  threadShortDateFormatterByLanguage.set(language, formatter);
  return formatter;
}

function getThreadShortDateWithYearFormatter(language: AppLanguage) {
  const cachedFormatter = threadShortDateWithYearFormatterByLanguage.get(language);

  if (cachedFormatter) {
    return cachedFormatter;
  }

  const formatter = new Intl.DateTimeFormat(getLocaleForLanguage(language), {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  threadShortDateWithYearFormatterByLanguage.set(language, formatter);
  return formatter;
}

function shouldLogThreadGuardDiagnostics() {
  return (
    typeof window !== 'undefined' &&
    process.env.NEXT_PUBLIC_CHAT_DEBUG_DM_THREAD_CLIENT === '1'
  );
}

function logThreadGuardDiagnostic(
  stage: string,
  dedupeKey: string,
  details: Record<string, unknown>,
) {
  if (!shouldLogThreadGuardDiagnostics()) {
    return;
  }

  const key = `${stage}:${dedupeKey}`;

  if (loggedThreadGuardDiagnosticKeys.has(key)) {
    return;
  }

  loggedThreadGuardDiagnosticKeys.add(key);
  console.info('[chat-thread-guards]', stage, details);
}

function shouldRetryLocalVoiceAttachmentResolution(reason: string | null) {
  return (
    reason === 'local-voice-send' ||
    reason === VOICE_MESSAGE_REOPEN_RECOVERY_REASON ||
    reason === VOICE_MESSAGE_ATTACHMENT_RECOVERY_REASON
  );
}

function shouldRetryThreadAttachmentResolution(reason: string | null) {
  return (
    reason === ATTACHMENT_MESSAGE_REOPEN_RECOVERY_REASON ||
    reason === ATTACHMENT_MESSAGE_RECOVERY_REASON
  );
}

function hasRenderableCommittedAttachment(attachments: MessageAttachment[]) {
  if (!attachments.length) {
    return false;
  }

  const imageAttachments = attachments.filter((attachment) => attachment.isImage);

  if (imageAttachments.length === 0) {
    return true;
  }

  return imageAttachments.some((attachment) =>
    Boolean(normalizeAttachmentSignedUrl(attachment.signedUrl)),
  );
}

function hasPlaybackReadyVoiceAttachment(
  messageId: string,
  attachments: MessageAttachment[],
) {
  return attachments.some(
    (attachment) =>
      hasMessagingVoiceLocallyRecoverableSource({
        attachment,
        expectedMessageId: messageId,
      }),
  );
}

function resolveVoiceMessageIdsNeedingAttachmentRecovery(input: {
  requestedMessageIds: string[];
  snapshot: ThreadHistoryPageSnapshot;
}) {
  const requestedMessageIdSet = new Set(input.requestedMessageIds);
  const attachmentsByMessageId = new Map(
    input.snapshot.attachmentsByMessage.map((entry) => [
      entry.messageId,
      entry.attachments,
    ] as const),
  );
  const voiceMessageIds = input.snapshot.messages
    .filter(
      (message) =>
        requestedMessageIdSet.has(message.id) &&
        message.kind === 'voice',
    )
    .map((message) => message.id);
  const voiceMessageIdSet = new Set(voiceMessageIds);
  const missingRequestedMessageIds = input.requestedMessageIds.filter(
    (messageId) => {
      if (!voiceMessageIdSet.has(messageId)) {
        return false;
      }

      return !hasPlaybackReadyVoiceAttachment(
        messageId,
        filterRenderableMessageAttachments(
          messageId,
          attachmentsByMessageId.get(messageId) ?? [],
        ),
      );
    },
  );
  const presentRequestedMessageIds = voiceMessageIds.filter(
    (messageId) => !missingRequestedMessageIds.includes(messageId),
  );

  return {
    missingRequestedMessageIds,
    presentRequestedMessageIds,
  };
}

function resolveRecentVoiceMessageIdsNeedingRecovery(input: {
  attachmentsByMessage: Map<string, MessageAttachment[]>;
  maxAgeMs: number;
  messages: ConversationMessageRow[];
}) {
  const now = Date.now();

  return input.messages
    .filter((message) => message.kind === 'voice')
    .filter((message) => {
      const createdAt = message.created_at ? new Date(message.created_at) : null;

      if (!createdAt || Number.isNaN(createdAt.getTime())) {
        return false;
      }

      return now - createdAt.getTime() <= input.maxAgeMs;
    })
    .filter(
      (message) =>
        !hasPlaybackReadyVoiceAttachment(
          message.id,
          filterRenderableMessageAttachments(
            message.id,
            input.attachmentsByMessage.get(message.id) ?? [],
          ),
        ),
    )
    .map((message) => message.id);
}

function resolveAttachmentMessageIdsNeedingRecovery(input: {
  requestedMessageIds: string[];
  snapshot: ThreadHistoryPageSnapshot;
}) {
  const requestedMessageIdSet = new Set(input.requestedMessageIds);
  const attachmentsByMessageId = new Map(
    input.snapshot.attachmentsByMessage.map((entry) => [
      entry.messageId,
      entry.attachments,
    ] as const),
  );
  const attachmentMessageIds = input.snapshot.messages
    .filter(
      (message) =>
        requestedMessageIdSet.has(message.id) &&
        message.kind === 'attachment',
    )
    .map((message) => message.id);
  const attachmentMessageIdSet = new Set(attachmentMessageIds);
  const missingRequestedMessageIds = input.requestedMessageIds.filter(
    (messageId) => {
      if (!attachmentMessageIdSet.has(messageId)) {
        return false;
      }

      return !hasRenderableCommittedAttachment(
        filterRenderableMessageAttachments(
          messageId,
          attachmentsByMessageId.get(messageId) ?? [],
        ),
      );
    },
  );
  const presentRequestedMessageIds = attachmentMessageIds.filter(
    (messageId) => !missingRequestedMessageIds.includes(messageId),
  );

  return {
    missingRequestedMessageIds,
    presentRequestedMessageIds,
  };
}

function resolveRecentAttachmentMessageIdsNeedingRecovery(input: {
  attachmentsByMessage: Map<string, MessageAttachment[]>;
  maxAgeMs: number;
  messages: ConversationMessageRow[];
}) {
  const now = Date.now();

  return input.messages
    .filter((message) => message.kind === 'attachment')
    .filter((message) => {
      const createdAt = message.created_at ? new Date(message.created_at) : null;

      if (!createdAt || Number.isNaN(createdAt.getTime())) {
        return false;
      }

      return now - createdAt.getTime() <= input.maxAgeMs;
    })
    .filter(
      (message) =>
        !hasRenderableCommittedAttachment(
          filterRenderableMessageAttachments(
            message.id,
            input.attachmentsByMessage.get(message.id) ?? [],
          ),
        ),
    )
    .map((message) => message.id);
}

function getMessageSeq(value: number | string) {
  return typeof value === 'number' ? value : Number(value);
}

function normalizeComparableMessageSeq(value: unknown) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (typeof value === 'bigint') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function isEncryptedDmMessage(value: {
  kind: string | null;
  content_mode?: string | null;
  deleted_at?: string | null;
}) {
  return (
    (value.kind === 'text' || value.kind === 'attachment') &&
    value.content_mode === 'dm_e2ee_v1' &&
    !value.deleted_at
  );
}

function looksLikeUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function buildHistoryPageUrl(input: {
  activeDeviceId?: string | null;
  conversationId: string;
  afterSeq?: number | null;
  beforeSeq?: number | null;
  debugRequestId?: string | null;
  limit: number;
  messageIds?: string[] | null;
}) {
  const params = new URLSearchParams();
  params.set('limit', String(input.limit));
  const normalizedMessageIds = Array.from(
    new Set(
      (input.messageIds ?? [])
        .map((value) => value.trim())
        .filter((value) => value && looksLikeUuid(value)),
    ),
  );
  const hasMessageIds = normalizedMessageIds.length > 0;
  const hasAfterSeq =
    typeof input.afterSeq === 'number' && Number.isFinite(input.afterSeq);
  const hasBeforeSeq =
    typeof input.beforeSeq === 'number' && Number.isFinite(input.beforeSeq);

  if (!hasMessageIds && !hasAfterSeq && hasBeforeSeq) {
    params.set('beforeSeq', String(input.beforeSeq));
  }

  if (!hasMessageIds && hasAfterSeq) {
    params.set('afterSeq', String(input.afterSeq));
  }

  for (const messageId of normalizedMessageIds) {
    params.append('messageId', messageId);
  }

  if (input.debugRequestId) {
    params.set('debugRequestId', input.debugRequestId);
  }

  if (input.activeDeviceId && looksLikeUuid(input.activeDeviceId)) {
    params.set('activeDeviceId', input.activeDeviceId);
  }

  return `/api/messaging/conversations/${input.conversationId}/history?${params.toString()}`;
}

function resolveHistoryFetchMode(input: {
  afterSeq?: number | null;
  beforeSeq?: number | null;
  messageIds?: string[] | null;
}) {
  const normalizedMessageIds = Array.from(
    new Set(
      (input.messageIds ?? [])
        .map((value) => value.trim())
        .filter((value) => value && looksLikeUuid(value)),
    ),
  );
  const hasAfterSeq =
    typeof input.afterSeq === 'number' && Number.isFinite(input.afterSeq);
  const hasBeforeSeq =
    typeof input.beforeSeq === 'number' && Number.isFinite(input.beforeSeq);

  if (normalizedMessageIds.length > 0) {
    return 'by-id' as const;
  }

  if (hasAfterSeq) {
    return 'after-seq' as const;
  }

  if (hasBeforeSeq) {
    return 'before-seq' as const;
  }

  return 'noop' as const;
}

function normalizeThreadHistorySyncRequestState(input: {
  authoritativeLatestWindow?: boolean | null;
  messageIds?: string[] | null;
  newerThanLatest?: boolean | null;
  reason?: string | null;
}) {
  const messageIds = Array.from(
    new Set(
      (input.messageIds ?? [])
        .map((messageId) => messageId.trim())
        .filter((messageId) => messageId && looksLikeUuid(messageId)),
    ),
  );
  const hasMessageIds = messageIds.length > 0;

  return {
    authoritativeLatestWindow: hasMessageIds
      ? false
      : Boolean(input.authoritativeLatestWindow),
    messageIds,
    newerThanLatest: hasMessageIds ? false : Boolean(input.newerThanLatest),
    reason: input.reason?.trim() || null,
  };
}

function shouldRetryLocalEncryptedDmMissingEnvelope(reason: string | null) {
  return (
    reason === 'local-encrypted-send' ||
    reason === ENCRYPTED_DM_MISSING_ENVELOPE_RECOVERY_REASON
  );
}

function resolveMissingOwnEncryptedMessageIdsForRetry(input: {
  currentUserId: string;
  requestedMessageIds: string[];
  snapshot: ThreadHistoryPageSnapshot;
}) {
  const requestedMessageIdSet = new Set(input.requestedMessageIds);
  const presentRequestedMessageIdSet = new Set(
    input.snapshot.messages
      .filter((message) => requestedMessageIdSet.has(message.id))
      .map((message) => message.id),
  );
  const encryptedEnvelopeMessageIdSet = new Set(
    (input.snapshot.dmE2ee?.envelopesByMessage ?? []).map(
      (entry) => entry.messageId,
    ),
  );
  const historyHintByMessageId = new Map(
    (input.snapshot.dmE2ee?.historyHintsByMessage ?? []).map((entry) => [
      entry.messageId,
      entry.hint,
    ] as const),
  );
  const missingRequestedMessageIds = input.snapshot.messages.flatMap(
    (message) => {
      if (!requestedMessageIdSet.has(message.id)) {
        return [];
      }

      if (message.sender_id !== input.currentUserId) {
        return [];
      }

      if (!isEncryptedDmMessage(message)) {
        return [];
      }

      const historyHint = historyHintByMessageId.get(message.id);
      const hasReadableEnvelope =
        encryptedEnvelopeMessageIdSet.has(message.id) ||
        historyHint?.code === 'envelope-present';

      return hasReadableEnvelope ? [] : [message.id];
    },
  );
  const missingRequestedMessageIdSet = new Set(missingRequestedMessageIds);

  for (const requestedMessageId of input.requestedMessageIds) {
    if (
      !presentRequestedMessageIdSet.has(requestedMessageId) &&
      !missingRequestedMessageIdSet.has(requestedMessageId)
    ) {
      missingRequestedMessageIdSet.add(requestedMessageId);
    }
  }

  return {
    missingRequestedMessageIds: Array.from(missingRequestedMessageIdSet),
    presentRequestedMessageIds: Array.from(presentRequestedMessageIdSet),
  };
}

function buildTimelineItems(input: {
  labels: TimelineLabels;
  language: AppLanguage;
  lastReadMessageSeq: number | null;
  messages: ConversationMessageRow[];
}) {
  return input.messages.flatMap<TimelineItem>((message, index) => {
    const previousMessage = input.messages[index - 1];
    const currentDayKey = getCalendarDayKey(message.created_at);
    const previousDayKey = previousMessage
      ? getCalendarDayKey(previousMessage.created_at)
      : null;
    const items: TimelineItem[] = [];

    if (currentDayKey !== previousDayKey) {
      items.push({
        type: 'separator',
        key: `day-${currentDayKey}-${message.id}`,
        label: formatDaySeparatorLabel(message.created_at, input.language, input.labels),
      });
    }

    const messageSeq = getMessageSeq(message.seq);
    const previousSeq = previousMessage
      ? getMessageSeq(previousMessage.seq)
      : null;
    const hasUnreadBoundary =
      input.lastReadMessageSeq !== null &&
      Number.isFinite(messageSeq) &&
      messageSeq > input.lastReadMessageSeq &&
      (previousSeq === null || previousSeq <= input.lastReadMessageSeq);

    if (hasUnreadBoundary) {
      items.push({
        type: 'unread',
        key: `unread-${message.id}`,
        label: input.labels.unreadMessages,
      });
    }

    items.push({
      type: 'message',
      key: message.id,
      message,
    });

    return items;
  });
}

function canClusterAdjacentMessages(
  left: ConversationMessageRow | null | undefined,
  right: ConversationMessageRow | null | undefined,
) {
  if (!left || !right) {
    return false;
  }

  if (!left.sender_id || left.sender_id !== right.sender_id) {
    return false;
  }

  if (left.deleted_at || right.deleted_at) {
    return false;
  }

  const leftCreatedAt = parseSafeDate(left.created_at);
  const rightCreatedAt = parseSafeDate(right.created_at);

  if (!leftCreatedAt || !rightCreatedAt) {
    return false;
  }

  return (
    Math.abs(rightCreatedAt.getTime() - leftCreatedAt.getTime()) <=
    MESSAGE_CLUSTER_MAX_GAP_MS
  );
}

function getSnapshotRevisionKey(snapshot: ThreadHistoryPageSnapshot) {
  return JSON.stringify({
    attachmentsByMessage: snapshot.attachmentsByMessage.map((entry) => ({
      attachmentKeys: entry.attachments.map((attachment) => ({
        createdAt: attachment.createdAt ?? null,
        fileName: attachment.fileName,
        hasSignedUrl: Boolean(
          normalizeAttachmentSignedUrl(attachment.signedUrl),
        ),
        id: attachment.id,
        isAudio: attachment.isAudio,
        isImage: attachment.isImage,
        isVoiceMessage: attachment.isVoiceMessage ?? false,
        messageId: attachment.messageId ?? null,
        mimeType: attachment.mimeType ?? null,
        objectPath: attachment.objectPath ?? null,
      })),
      messageId: entry.messageId,
    })),
    hasMoreOlder: snapshot.hasMoreOlder,
    messageIds: snapshot.messages.map((message) => message.id),
    oldestMessageSeq: snapshot.oldestMessageSeq,
  });
}

function buildThreadHistorySessionCacheKey(input: {
  conversationId: string;
  currentUserId: string;
}) {
  return `${input.currentUserId.trim()}:${input.conversationId.trim()}`;
}

function resolveOldestLoadedSeq(
  messages: ConversationMessageRow[],
  fallback: number | null,
) {
  return normalizeComparableMessageSeq(messages[0]?.seq ?? fallback);
}

function resolveLatestLoadedSeq(
  messages: ConversationMessageRow[],
  fallback: number | null = null,
) {
  return normalizeComparableMessageSeq(
    messages[messages.length - 1]?.seq ?? fallback,
  );
}

function getThreadMessageClientIdentity(
  message: Pick<ConversationMessageRow, 'client_id' | 'sender_id'>,
) {
  const clientId = message.client_id?.trim() || '';
  const senderId = message.sender_id?.trim() || '';

  if (!clientId || !senderId) {
    return null;
  }

  return `${senderId}:${clientId}`;
}

function compareThreadMessages(
  left: ConversationMessageRow,
  right: ConversationMessageRow,
) {
  const leftSeq = normalizeComparableMessageSeq(left.seq);
  const rightSeq = normalizeComparableMessageSeq(right.seq);

  if (leftSeq !== null && rightSeq !== null && leftSeq !== rightSeq) {
    return leftSeq - rightSeq;
  }

  const leftCreatedAt = parseSafeDate(left.created_at);
  const rightCreatedAt = parseSafeDate(right.created_at);

  if (leftCreatedAt && rightCreatedAt) {
    const createdAtDelta = leftCreatedAt.getTime() - rightCreatedAt.getTime();

    if (createdAtDelta !== 0) {
      return createdAtDelta;
    }
  } else if (leftCreatedAt && !rightCreatedAt) {
    return -1;
  } else if (!leftCreatedAt && rightCreatedAt) {
    return 1;
  }

  return left.id.localeCompare(right.id);
}

function sortThreadMessages(messages: ConversationMessageRow[]) {
  return [...messages].sort(compareThreadMessages);
}

function findMatchingThreadMessageIndex(input: {
  message: ConversationMessageRow;
  messages: ConversationMessageRow[];
}) {
  const directMatchIndex = input.messages.findIndex(
    (candidate) => candidate.id === input.message.id,
  );

  if (directMatchIndex >= 0) {
    return directMatchIndex;
  }

  const clientIdentity = getThreadMessageClientIdentity(input.message);

  if (!clientIdentity) {
    return -1;
  }

  return input.messages.findIndex(
    (candidate) =>
      getThreadMessageClientIdentity(candidate) === clientIdentity,
  );
}

function dedupeThreadMessages(messages: ConversationMessageRow[]) {
  const dedupedMessages: ConversationMessageRow[] = [];

  for (const message of messages) {
    const existingIndex = findMatchingThreadMessageIndex({
      message,
      messages: dedupedMessages,
    });

    if (existingIndex >= 0) {
      dedupedMessages[existingIndex] = message;
      continue;
    }

    dedupedMessages.push(message);
  }

  return dedupedMessages;
}

function createThreadHistoryState(
  snapshot: ThreadHistoryPageSnapshot,
): ThreadHistoryState {
  const dedupedMessages = sortThreadMessages(
    dedupeThreadMessages(snapshot.messages),
  );

  return {
    attachmentsByMessage: new Map(
      snapshot.attachmentsByMessage.map((entry) => [
        entry.messageId,
        entry.attachments,
      ] as const),
    ),
    encryptedEnvelopesByMessage: new Map(
      (snapshot.dmE2ee?.envelopesByMessage ?? []).map((entry) => [
        entry.messageId,
        entry.envelope,
      ] as const),
    ),
    encryptedHistoryHintsByMessage: new Map(
      (snapshot.dmE2ee?.historyHintsByMessage ?? []).map((entry) => [
        entry.messageId,
        entry.hint,
      ] as const),
    ),
    hasMoreOlder: snapshot.hasMoreOlder,
    loadedOlderPageCount: 0,
    messages: dedupedMessages,
    messagesById: new Map(
      dedupedMessages.map((message) => [message.id, message] as const),
    ),
    oldestLoadedSeq: resolveOldestLoadedSeq(
      dedupedMessages,
      snapshot.oldestMessageSeq,
    ),
    reactionsByMessage: new Map(
      snapshot.reactionsByMessage.map((entry) => [
        entry.messageId,
        entry.reactions,
      ] as const),
    ),
    senderProfilesById: new Map(
      snapshot.senderProfiles.map((profile) => [profile.userId, profile] as const),
    ),
  };
}

function writeThreadHistorySessionCache(input: {
  cacheKey: string;
  state: ThreadHistoryState;
}) {
  if (!input.cacheKey) {
    return;
  }

  threadHistorySessionCache.delete(input.cacheKey);
  threadHistorySessionCache.set(input.cacheKey, {
    cachedAt: Date.now(),
    state: input.state,
  });

  while (threadHistorySessionCache.size > THREAD_HISTORY_SESSION_CACHE_MAX_ENTRIES) {
    const oldestEntry = threadHistorySessionCache.keys().next();

    if (oldestEntry.done) {
      break;
    }

    threadHistorySessionCache.delete(oldestEntry.value);
  }
}

function resolveInitialThreadHistoryState(input: {
  cacheKey: string;
  snapshot: ThreadHistoryPageSnapshot;
}) {
  const nextSnapshotKey = getSnapshotRevisionKey(input.snapshot);
  const cachedEntry = threadHistorySessionCache.get(input.cacheKey) ?? null;

  if (!cachedEntry) {
    return {
      snapshotKey: nextSnapshotKey,
      state: createThreadHistoryState(input.snapshot),
      usedSessionCache: false,
    };
  }

  return {
    snapshotKey: nextSnapshotKey,
    state: mergeThreadHistoryState({
      mode: 'refresh-base',
      snapshot: input.snapshot,
      state: cachedEntry.state,
    }).nextState,
    usedSessionCache: true,
  };
}

function mergeThreadHistoryState(input: {
  mode: 'prepend-older' | 'refresh-base' | 'sync-topology';
  snapshot: ThreadHistoryPageSnapshot;
  state: ThreadHistoryState;
}) {
  const nextMessagesById = new Map(input.state.messagesById);
  const nextMessages = [...input.state.messages];
  const nextSenderProfilesById = new Map(input.state.senderProfilesById);
  const nextReactionsByMessage = new Map(input.state.reactionsByMessage);
  const nextAttachmentsByMessage = new Map(input.state.attachmentsByMessage);
  const nextEncryptedEnvelopesByMessage = new Map(
    input.state.encryptedEnvelopesByMessage,
  );
  const nextEncryptedHistoryHintsByMessage = new Map(
    input.state.encryptedHistoryHintsByMessage,
  );
  const prependedMessages: ConversationMessageRow[] = [];
  const appendedMessages: ConversationMessageRow[] = [];
  let insertedMessageCount = 0;
  const currentLatestSeq = resolveLatestLoadedSeq(input.state.messages, null);

  for (const message of input.snapshot.messages) {
    const existingIndex = findMatchingThreadMessageIndex({
      message,
      messages: nextMessages,
    });

    if (existingIndex < 0) {
      const nextMessageSeq = normalizeComparableMessageSeq(message.seq);
      const shouldInsertUnseenMessage =
        input.mode !== 'sync-topology' ||
        currentLatestSeq === null ||
        (nextMessageSeq !== null && nextMessageSeq > currentLatestSeq);

      if (!shouldInsertUnseenMessage) {
        nextMessagesById.delete(message.id);
        continue;
      }

      insertedMessageCount += 1;

      if (input.mode === 'prepend-older') {
        prependedMessages.push(message);
      } else {
        appendedMessages.push(message);
      }

      continue;
    }

    const existingMessage = nextMessages[existingIndex];

    if (existingMessage && existingMessage.id !== message.id) {
      nextMessagesById.delete(existingMessage.id);
    }

    nextMessagesById.set(message.id, message);
    nextMessages[existingIndex] = message;
  }

  const mergedMessages =
    input.mode === 'prepend-older'
      ? [...prependedMessages, ...nextMessages]
      : appendedMessages.length > 0
        ? [...nextMessages, ...appendedMessages]
        : nextMessages;
  const orderedMessages = sortThreadMessages(
    dedupeThreadMessages(mergedMessages),
  );
  const orderedMessagesById = new Map(
    orderedMessages.map((message) => [message.id, message] as const),
  );

  for (const profile of input.snapshot.senderProfiles) {
    nextSenderProfilesById.set(profile.userId, profile);
  }

  for (const entry of input.snapshot.reactionsByMessage) {
    if (
      input.mode === 'sync-topology' &&
      !nextMessagesById.has(entry.messageId) &&
      !input.state.messagesById.has(entry.messageId)
    ) {
      continue;
    }

    nextReactionsByMessage.set(entry.messageId, entry.reactions);
  }

  for (const entry of input.snapshot.attachmentsByMessage) {
    if (
      input.mode === 'sync-topology' &&
      !nextMessagesById.has(entry.messageId) &&
      !input.state.messagesById.has(entry.messageId)
    ) {
      continue;
    }

    nextAttachmentsByMessage.set(entry.messageId, entry.attachments);
  }

  for (const entry of input.snapshot.dmE2ee?.envelopesByMessage ?? []) {
    if (
      input.mode === 'sync-topology' &&
      !nextMessagesById.has(entry.messageId) &&
      !input.state.messagesById.has(entry.messageId)
    ) {
      continue;
    }

    nextEncryptedEnvelopesByMessage.set(entry.messageId, entry.envelope);
  }

  for (const entry of input.snapshot.dmE2ee?.historyHintsByMessage ?? []) {
    if (
      input.mode === 'sync-topology' &&
      !nextMessagesById.has(entry.messageId) &&
      !input.state.messagesById.has(entry.messageId)
    ) {
      continue;
    }

    nextEncryptedHistoryHintsByMessage.set(entry.messageId, entry.hint);
  }

  return {
    insertedMessageCount,
    nextState: {
      attachmentsByMessage: nextAttachmentsByMessage,
      encryptedEnvelopesByMessage: nextEncryptedEnvelopesByMessage,
      encryptedHistoryHintsByMessage: nextEncryptedHistoryHintsByMessage,
      hasMoreOlder:
        input.mode === 'prepend-older'
          ? input.snapshot.hasMoreOlder
          : input.state.loadedOlderPageCount > 0
            ? input.state.hasMoreOlder
            : input.snapshot.hasMoreOlder,
      loadedOlderPageCount:
        input.mode === 'prepend-older'
          ? input.state.loadedOlderPageCount + 1
          : input.state.loadedOlderPageCount,
      messages: orderedMessages,
      messagesById: orderedMessagesById,
      oldestLoadedSeq: resolveOldestLoadedSeq(
        orderedMessages,
        input.snapshot.oldestMessageSeq ?? input.state.oldestLoadedSeq,
      ),
      reactionsByMessage: nextReactionsByMessage,
      senderProfilesById: nextSenderProfilesById,
    } satisfies ThreadHistoryState,
  };
}

function upsertLiveThreadMessage(input: {
  message: ConversationMessageRow;
  state: ThreadHistoryState;
}) {
  const existingIndex = findMatchingThreadMessageIndex({
    message: input.message,
    messages: input.state.messages,
  });
  const nextMessagesById = new Map(input.state.messagesById);

  if (existingIndex >= 0) {
    const existingMessage = input.state.messages[existingIndex];

    if (existingMessage && existingMessage.id !== input.message.id) {
      nextMessagesById.delete(existingMessage.id);
    }

    nextMessagesById.set(input.message.id, input.message);
    const nextMessages = [...input.state.messages];
    nextMessages[existingIndex] = input.message;
    const orderedMessages = sortThreadMessages(nextMessages);
    const orderedMessagesById = new Map(
      orderedMessages.map((message) => [message.id, message] as const),
    );

    return {
      ...input.state,
      messages: orderedMessages,
      messagesById: orderedMessagesById,
      oldestLoadedSeq: resolveOldestLoadedSeq(
        orderedMessages,
        input.state.oldestLoadedSeq,
      ),
    } satisfies ThreadHistoryState;
  }

  nextMessagesById.set(input.message.id, input.message);
  const nextMessages = [...input.state.messages];
  const nextMessageSeq = normalizeComparableMessageSeq(input.message.seq);
  let insertionIndex = nextMessages.length;

  if (nextMessageSeq !== null) {
    const firstLaterMessageIndex = nextMessages.findIndex((message) => {
      const comparableSeq = normalizeComparableMessageSeq(message.seq);
      return comparableSeq !== null && comparableSeq > nextMessageSeq;
    });

    insertionIndex =
      firstLaterMessageIndex >= 0 ? firstLaterMessageIndex : nextMessages.length;
  }

  nextMessages.splice(insertionIndex, 0, input.message);
  const orderedMessages = sortThreadMessages(nextMessages);
  const orderedMessagesById = new Map(
    orderedMessages.map((message) => [message.id, message] as const),
  );

  return {
    ...input.state,
    messages: orderedMessages,
    messagesById: orderedMessagesById,
    oldestLoadedSeq: resolveOldestLoadedSeq(
      orderedMessages,
      input.state.oldestLoadedSeq,
    ),
  } satisfies ThreadHistoryState;
}

function getUnavailableEncryptedHistoryRunKey(input: {
  encryptedEnvelopesByMessage: Map<string, StoredDmE2eeEnvelope>;
  encryptedHistoryHintsByMessage: Map<string, EncryptedDmServerHistoryHint>;
  message: ConversationMessageRow | null;
}) {
  if (!input.message || !isEncryptedDmMessage(input.message)) {
    return null;
  }

  const envelope =
    input.encryptedEnvelopesByMessage.get(input.message.id) ?? null;
  const historyHint = getEncryptedHistoryHintForMessage({
    envelope,
    hint: input.encryptedHistoryHintsByMessage.get(input.message.id) ?? null,
    message: input.message,
  });

  if (historyHint.code === 'envelope-present') {
    return null;
  }

  return historyHint.code === 'policy-blocked-history'
    ? 'policy-blocked-history'
    : 'history-unavailable';
}

function buildUnavailableEncryptedHistoryRunMeta(input: {
  encryptedEnvelopesByMessage: Map<string, StoredDmE2eeEnvelope>;
  encryptedHistoryHintsByMessage: Map<string, EncryptedDmServerHistoryHint>;
  timelineItems: TimelineItem[];
}) {
  const runMetaByMessageId = new Map<string, EncryptedUnavailableRunMeta>();

  let index = 0;

  while (index < input.timelineItems.length) {
    const item = input.timelineItems[index];

    if (item?.type !== 'message') {
      index += 1;
      continue;
    }

    const runKey = getUnavailableEncryptedHistoryRunKey({
      encryptedEnvelopesByMessage: input.encryptedEnvelopesByMessage,
      encryptedHistoryHintsByMessage: input.encryptedHistoryHintsByMessage,
      message: item.message,
    });

    if (!runKey) {
      index += 1;
      continue;
    }

    let endIndex = index;

    while (endIndex + 1 < input.timelineItems.length) {
      const nextItem = input.timelineItems[endIndex + 1];

      if (nextItem?.type !== 'message') {
        break;
      }

      const nextRunKey = getUnavailableEncryptedHistoryRunKey({
        encryptedEnvelopesByMessage: input.encryptedEnvelopesByMessage,
        encryptedHistoryHintsByMessage: input.encryptedHistoryHintsByMessage,
        message: nextItem.message,
      });

      if (nextRunKey !== runKey) {
        break;
      }

      endIndex += 1;
    }

    runMetaByMessageId.set(item.message.id, {
      continuationCount: endIndex - index,
      isContinuation: false,
    });

    for (let runIndex = index + 1; runIndex <= endIndex; runIndex += 1) {
      const runItem = input.timelineItems[runIndex];

      if (runItem?.type !== 'message') {
        continue;
      }

      runMetaByMessageId.set(runItem.message.id, {
        continuationCount: 0,
        isContinuation: true,
      });
    }

    index = endIndex + 1;
  }

  return runMetaByMessageId;
}

function buildTimelineRenderItems(input: {
  timelineItems: TimelineItem[];
  unavailableEncryptedHistoryRunMeta: Map<string, EncryptedUnavailableRunMeta>;
}) {
  return input.timelineItems.map<TimelineRenderItem>((item, index) => {
    if (item.type !== 'message') {
      return item;
    }

    const previousTimelineItem = input.timelineItems[index - 1];
    const nextTimelineItem = input.timelineItems[index + 1];
    const previousMessage =
      previousTimelineItem?.type === 'message'
        ? previousTimelineItem.message
        : null;
    const nextMessage =
      nextTimelineItem?.type === 'message'
        ? nextTimelineItem.message
        : null;
    const unavailableRunMeta =
      input.unavailableEncryptedHistoryRunMeta.get(item.message.id) ?? null;

    return {
      compactHistoricalUnavailable: unavailableRunMeta?.isContinuation ?? false,
      historicalUnavailableContinuationCount:
        unavailableRunMeta?.continuationCount ?? 0,
      isClusteredWithNext: canClusterAdjacentMessages(item.message, nextMessage),
      isClusteredWithPrevious: canClusterAdjacentMessages(
        previousMessage,
        item.message,
      ),
      key: item.key,
      message: item.message,
      type: 'message',
    };
  });
}

export function ThreadHistoryViewport({
  activeDeleteMessageId,
  activeEditMessageId,
  activeSpaceId,
  conversationId,
  conversationKind,
  currentReadMessageSeq,
  currentUserId,
  initialSnapshot,
  language,
  latestVisibleMessageSeq,
  otherParticipantReadSeq,
  otherParticipantUserId,
  threadClientDiagnostics,
}: ThreadHistoryViewportProps) {
  const t = getChatClientTranslations(language);
  const clientRuntimeDiagnosticsEnabled =
    typeof window !== 'undefined' &&
    (process.env.NEXT_PUBLIC_CHAT_DEBUG_DM_THREAD_CLIENT === '1' ||
      process.env.NEXT_PUBLIC_CHAT_DEBUG_DM_E2EE_BOOTSTRAP === '1');
  const sessionCacheKey = buildThreadHistorySessionCacheKey({
    conversationId,
    currentUserId,
  });
  const initialResolvedStateRef = useRef<ReturnType<
    typeof resolveInitialThreadHistoryState
  > | null>(null);

  if (initialResolvedStateRef.current === null) {
    initialResolvedStateRef.current = resolveInitialThreadHistoryState({
      cacheKey: sessionCacheKey,
      snapshot: initialSnapshot,
    });
  }

  const renderCountRef = useRef(0);
  const lastBrokenHistoryProofSummaryRef = useRef<string | null>(null);
  const [historyState, setHistoryState] = useState<ThreadHistoryState>(() =>
    initialResolvedStateRef.current?.state ?? createThreadHistoryState(initialSnapshot),
  );
  const [activeImagePreview, setActiveImagePreview] =
    useState<ActiveImagePreview | null>(null);
  const historyFetchActiveDeviceIdRef = useRef<string | null>(
    initialSnapshot.dmE2ee?.activeDeviceRecordId ?? null,
  );
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const historyStateRef = useRef(historyState);
  const activeSessionCacheKeyRef = useRef(sessionCacheKey);
  const lastConversationIdRef = useRef(conversationId);
  const lastInitialSnapshotKeyRef = useRef(
    initialResolvedStateRef.current?.snapshotKey ?? getSnapshotRevisionKey(initialSnapshot),
  );
  const pendingRestoreRef = useRef<PendingScrollRestore | null>(null);
  const pendingByIdSyncRequestRef =
    useRef<PendingByIdThreadHistorySyncRequest | null>(null);
  const pendingAfterSeqSyncRequestRef =
    useRef<PendingAfterSeqThreadHistorySyncRequest | null>(null);
  const pendingAuthoritativeLatestWindowSyncRequestRef =
    useRef<PendingAuthoritativeLatestWindowThreadHistorySyncRequest | null>(
      null,
    );
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const encryptedDmRecoveryAttemptsRef = useRef(new Map<string, number>());
  const encryptedDmRecoveryTimeoutsRef = useRef(
    new Map<string, ReturnType<typeof setTimeout>>(),
  );
  const encryptedHistoryBootstrapRecoveryAttemptedMessageIdsRef = useRef(
    new Set<string>(),
  );
  const encryptedHistoryBootstrapRecoveryInFlightMessageIdsRef = useRef(
    new Set<string>(),
  );
  const [
    pendingEncryptedCommitTransitionMessageIds,
    setPendingEncryptedCommitTransitionMessageIds,
  ] = useState(() => new Set<string>());
  const voiceAttachmentRecoveryAttemptsRef = useRef(new Map<string, number>());
  const voiceAttachmentRecoveryTimeoutsRef = useRef(
    new Map<string, ReturnType<typeof setTimeout>>(),
  );
  const voiceReopenRecoveryRequestedRef = useRef(new Set<string>());
  const attachmentRecoveryAttemptsRef = useRef(new Map<string, number>());
  const attachmentRecoveryTimeoutsRef = useRef(
    new Map<string, ReturnType<typeof setTimeout>>(),
  );
  const attachmentReopenRecoveryRequestedRef = useRef(new Set<string>());
  const isSyncingRef = useRef(false);
  const historySyncDiagnosticsEnabled =
    typeof window !== 'undefined' &&
    process.env.NEXT_PUBLIC_CHAT_DEBUG_LIVE_REFRESH === '1';
  renderCountRef.current += 1;

  const updatePendingEncryptedCommitTransitionMessageIds = useCallback(
    (input: { add?: string[]; remove?: string[] }) => {
      const messageIdsToAdd = Array.from(
        new Set(
          (input.add ?? [])
            .map((messageId) => messageId.trim())
            .filter((messageId) => messageId && looksLikeUuid(messageId)),
        ),
      );
      const messageIdsToRemove = Array.from(
        new Set(
          (input.remove ?? [])
            .map((messageId) => messageId.trim())
            .filter((messageId) => messageId && looksLikeUuid(messageId)),
        ),
      );

      if (messageIdsToAdd.length === 0 && messageIdsToRemove.length === 0) {
        return;
      }

      setPendingEncryptedCommitTransitionMessageIds((currentMessageIds) => {
        let nextMessageIds: Set<string> | null = null;

        for (const messageId of messageIdsToAdd) {
          if (currentMessageIds.has(messageId)) {
            continue;
          }

          if (!nextMessageIds) {
            nextMessageIds = new Set(currentMessageIds);
          }

          nextMessageIds.add(messageId);
        }

        const activeMessageIds = nextMessageIds ?? currentMessageIds;

        for (const messageId of messageIdsToRemove) {
          if (!activeMessageIds.has(messageId)) {
            continue;
          }

          if (!nextMessageIds) {
            nextMessageIds = new Set(currentMessageIds);
          }

          nextMessageIds.delete(messageId);
        }

        return nextMessageIds ?? currentMessageIds;
      });
    },
    [],
  );

  useEffect(() => {
    setPendingEncryptedCommitTransitionMessageIds(new Set());
  }, [conversationId]);

  useEffect(() => {
    if (!clientRuntimeDiagnosticsEnabled) {
      return;
    }

    console.info('[chat-thread-runtime]', 'viewport:mount', {
      conversationId,
      initialMessageCount: initialSnapshot.messages.length,
      renderCount: renderCountRef.current,
      restoredFromSessionCache:
        initialResolvedStateRef.current?.usedSessionCache ?? false,
    });

    return () => {
      console.info('[chat-thread-runtime]', 'viewport:dispose', {
        conversationId,
        renderCount: renderCountRef.current,
      });
    };
  }, [
    clientRuntimeDiagnosticsEnabled,
    conversationId,
    initialSnapshot.messages.length,
  ]);

  useEffect(() => {
    if (!shouldLogBrokenThreadHistoryProof(conversationId)) {
      return;
    }

    logBrokenThreadHistoryProof('client:initial-snapshot', {
      conversationId,
      details: {
        debugRequestId: threadClientDiagnostics.debugRequestId ?? null,
        restoredFromSessionCache:
          initialResolvedStateRef.current?.usedSessionCache ?? false,
        summary: summarizeBrokenThreadHistorySnapshot({
          attachmentsByMessage: initialSnapshot.attachmentsByMessage,
          conversationId,
          messages: initialSnapshot.messages,
        }),
      },
    });
  }, [
    conversationId,
    initialSnapshot.attachmentsByMessage,
    initialSnapshot.messages,
    threadClientDiagnostics.debugRequestId,
  ]);

  useEffect(() => {
    historyStateRef.current = historyState;
    writeThreadHistorySessionCache({
      cacheKey: activeSessionCacheKeyRef.current,
      state: historyState,
    });
  }, [historyState]);

  useEffect(() => {
    voiceReopenRecoveryRequestedRef.current.clear();
    attachmentReopenRecoveryRequestedRef.current.clear();
    encryptedHistoryBootstrapRecoveryAttemptedMessageIdsRef.current.clear();
    encryptedHistoryBootstrapRecoveryInFlightMessageIdsRef.current.clear();
    setActiveImagePreview(null);
  }, [conversationId]);

  useEffect(() => {
    const nextSnapshotKey = getSnapshotRevisionKey(initialSnapshot);

    if (lastConversationIdRef.current !== conversationId) {
      const resolvedState = resolveInitialThreadHistoryState({
        cacheKey: sessionCacheKey,
        snapshot: initialSnapshot,
      });
      const resetState = resolvedState.state;
      lastConversationIdRef.current = conversationId;
      lastInitialSnapshotKeyRef.current = resolvedState.snapshotKey;
      activeSessionCacheKeyRef.current = sessionCacheKey;
      historyStateRef.current = resetState;
      setHistoryState(resetState);
      historyFetchActiveDeviceIdRef.current =
        initialSnapshot.dmE2ee?.activeDeviceRecordId ?? null;
      setIsLoadingOlder(false);
      pendingRestoreRef.current = null;
      pendingByIdSyncRequestRef.current = null;
      pendingAfterSeqSyncRequestRef.current = null;
      pendingAuthoritativeLatestWindowSyncRequestRef.current = null;
      return;
    }

    if (lastInitialSnapshotKeyRef.current === nextSnapshotKey) {
      return;
    }

    lastInitialSnapshotKeyRef.current = nextSnapshotKey;
    setHistoryState((currentState) => {
      const nextState = mergeThreadHistoryState({
        mode: 'refresh-base',
        snapshot: initialSnapshot,
        state: currentState,
      }).nextState;
      historyStateRef.current = nextState;
      return nextState;
    });
    historyFetchActiveDeviceIdRef.current =
      initialSnapshot.dmE2ee?.activeDeviceRecordId ?? null;
  }, [conversationId, initialSnapshot, sessionCacheKey]);

  const senderNames = useMemo(
    () =>
      new Map(
        Array.from(historyState.senderProfilesById.values()).map((profile, index) => [
          profile.userId,
          resolvePublicIdentityLabel(
            profile,
            formatPersonFallbackLabel(language, index + 1),
          ),
        ] as const),
      ),
    [historyState.senderProfilesById, language],
  );
  const timelineLabels = useMemo(
    () => ({
      earlier: t.chat.earlier,
      today: t.chat.today,
      unreadMessages: t.chat.unreadMessages,
      yesterday: t.chat.yesterday,
    }),
    [t.chat.earlier, t.chat.today, t.chat.unreadMessages, t.chat.yesterday],
  );
  const timelineItems = useMemo(
    () =>
      buildTimelineItems({
        labels: timelineLabels,
        language,
        lastReadMessageSeq: currentReadMessageSeq,
        messages: historyState.messages,
      }),
    [currentReadMessageSeq, historyState.messages, language, timelineLabels],
  );
  const unavailableEncryptedHistoryRunMeta = useMemo(
    () =>
      buildUnavailableEncryptedHistoryRunMeta({
        encryptedEnvelopesByMessage: historyState.encryptedEnvelopesByMessage,
        encryptedHistoryHintsByMessage: historyState.encryptedHistoryHintsByMessage,
        timelineItems,
      }),
    [
      historyState.encryptedEnvelopesByMessage,
      historyState.encryptedHistoryHintsByMessage,
      timelineItems,
    ],
  );
  const timelineRenderItems = useMemo(
    () =>
      buildTimelineRenderItems({
        timelineItems,
        unavailableEncryptedHistoryRunMeta,
      }),
    [timelineItems, unavailableEncryptedHistoryRunMeta],
  );
  const oldestLoadedSeq = historyState.oldestLoadedSeq;
  const hasMoreOlder = historyState.hasMoreOlder;
  const latestCommittedMessageSeq = useMemo(
    () => resolveLatestLoadedSeq(historyState.messages, latestVisibleMessageSeq),
    [historyState.messages, latestVisibleMessageSeq],
  );
  const resolvedConfirmedClientIds = useMemo(
    () =>
      Array.from(
        new Set(
          historyState.messages
            .filter((message) => {
              const normalizedBody = normalizeMessageBodyText(message.body);
              const messageAttachments =
                filterRenderableMessageAttachments(
                  message.id,
                  historyState.attachmentsByMessage.get(message.id) ??
                    EMPTY_MESSAGE_ATTACHMENTS,
                );

              return !isOwnAttachmentCommitTransitionPending({
                attachments: messageAttachments,
                currentUserId,
                message,
                normalizedBody,
              });
            })
            .map((message) => message.client_id?.trim() || '')
            .filter(Boolean),
        ),
      ),
    [currentUserId, historyState.attachmentsByMessage, historyState.messages],
  );
  const historyMessageIds = useMemo(
    () => historyState.messages.map((message) => message.id),
    [historyState.messages],
  );
  useEffect(() => {
    if (!shouldLogBrokenThreadHistoryProof(conversationId)) {
      return;
    }

    const historySummary = summarizeBrokenThreadHistorySnapshot({
      attachmentsByMessage: Array.from(historyState.attachmentsByMessage.entries()).map(
        ([messageId, attachments]) => ({
          attachments,
          messageId,
        }),
      ),
      conversationId,
      messages: historyState.messages,
    });
    const patchSummary = summarizeBrokenThreadMessagePatches(
      readThreadMessagePatchSnapshot(conversationId),
    );
    const renderSummary = {
      activeImagePreviewOpen: Boolean(activeImagePreview),
      debugRequestId: threadClientDiagnostics.debugRequestId ?? null,
      liveStateSnapshot: getThreadLiveStateSnapshot(conversationId),
      patchSummary,
      renderCount: renderCountRef.current,
      renderedItemCount: timelineRenderItems.length,
      renderedMessageCount: timelineRenderItems.filter(
        (item) => item.type === 'message',
      ).length,
      summary: historySummary,
    };
    const nextSummaryKey = JSON.stringify(renderSummary);

    if (lastBrokenHistoryProofSummaryRef.current === nextSummaryKey) {
      return;
    }

    lastBrokenHistoryProofSummaryRef.current = nextSummaryKey;
    logBrokenThreadHistoryProof('client:history-state', {
      conversationId,
      details: renderSummary,
    });

    if (
      historySummary.messageCount > 0 &&
      timelineRenderItems.every((item) => item.type !== 'message')
    ) {
      logBrokenThreadHistoryProof('client:message-list-dropped-before-render', {
        conversationId,
        details: renderSummary,
        level: 'warn',
      });
    }
  }, [
    activeImagePreview,
    conversationId,
    historyState.attachmentsByMessage,
    historyState.messages,
    threadClientDiagnostics.debugRequestId,
    timelineRenderItems,
  ]);
  const recoverableEncryptedHistoryMessageIds = useMemo(
    () =>
      historyState.messages.flatMap((message) => {
        if (!isEncryptedDmMessage(message)) {
          return [];
        }

        const historyHint =
          historyState.encryptedHistoryHintsByMessage.get(message.id) ?? null;
        const hasReadableEnvelope =
          historyState.encryptedEnvelopesByMessage.has(message.id) ||
          historyHint?.code === 'envelope-present';

        if (hasReadableEnvelope || historyHint?.code === 'policy-blocked-history') {
          return [];
        }

        return [message.id];
      }),
    [
      historyState.encryptedEnvelopesByMessage,
      historyState.encryptedHistoryHintsByMessage,
      historyState.messages,
    ],
  );
  const recentVoiceMessageIdsNeedingRecovery = useMemo(
    () =>
      resolveRecentVoiceMessageIdsNeedingRecovery({
        attachmentsByMessage: historyState.attachmentsByMessage,
        maxAgeMs: VOICE_MESSAGE_RECOVERY_MAX_AGE_MS,
        messages: historyState.messages,
      }),
    [historyState.attachmentsByMessage, historyState.messages],
  );
  const recentAttachmentMessageIdsNeedingRecovery = useMemo(
    () =>
      resolveRecentAttachmentMessageIdsNeedingRecovery({
        attachmentsByMessage: historyState.attachmentsByMessage,
        maxAgeMs: ATTACHMENT_MESSAGE_RECOVERY_MAX_AGE_MS,
        messages: historyState.messages,
      }),
    [historyState.attachmentsByMessage, historyState.messages],
  );

  useThreadHistoryRecovery({
    attachmentReopenRecoveryReason: ATTACHMENT_MESSAGE_REOPEN_RECOVERY_REASON,
    attachmentReopenRecoveryRequestedRef,
    conversationId,
    conversationKind,
    currentDeviceResyncReason: ENCRYPTED_DM_CURRENT_DEVICE_RESYNC_REASON,
    currentUserId,
    encryptedHistoryBootstrapRecoveryAttemptedMessageIdsRef,
    encryptedHistoryBootstrapRecoveryInFlightMessageIdsRef,
    historyContinuityRecoveryReason:
      ENCRYPTED_DM_HISTORY_CONTINUITY_RECOVERY_REASON,
    historyFetchActiveDeviceIdRef,
    historySyncDiagnosticsEnabled,
    recentAttachmentMessageIdsNeedingRecovery,
    recentVoiceMessageIdsNeedingRecovery,
    recoverableEncryptedHistoryMessageIds,
    voiceReopenRecoveryReason: VOICE_MESSAGE_REOPEN_RECOVERY_REASON,
    voiceReopenRecoveryRequestedRef,
  });

  const loadOlderMessages = useCallback(async () => {
    if (isLoadingOlder || !hasMoreOlder || oldestLoadedSeq === null) {
      return;
    }

    const target = resolveThreadScrollTarget('message-thread-scroll');

    if (target) {
      pendingRestoreRef.current = {
        previousScrollHeight: target.scrollHeight,
        previousScrollTop: target.scrollTop,
      };
    }

    setIsLoadingOlder(true);

    try {
      const response = await fetch(
        buildHistoryPageUrl({
          activeDeviceId: historyFetchActiveDeviceIdRef.current,
          beforeSeq: oldestLoadedSeq,
          conversationId,
          debugRequestId:
            process.env.NEXT_PUBLIC_CHAT_DEBUG_DM_E2EE_BOOTSTRAP === '1'
              ? crypto.randomUUID()
              : null,
          limit: THREAD_HISTORY_PAGE_SIZE,
        }),
        {
          cache: 'no-store',
          credentials: 'same-origin',
        },
      );

      if (!response.ok) {
        throw new Error(`History fetch failed with status ${response.status}`);
      }

      const nextSnapshot =
        (await response.json()) as ThreadHistoryPageSnapshot;

      setHistoryState((currentState) => {
        const { insertedMessageCount, nextState } = mergeThreadHistoryState({
          mode: 'prepend-older',
          snapshot: nextSnapshot,
          state: currentState,
        });
        historyStateRef.current = nextState;

        if (
          insertedMessageCount > 0 ||
          nextSnapshot.hasMoreOlder === false ||
          !currentState.hasMoreOlder
        ) {
          return nextState;
        }

        console.warn('[chat-history]', 'older-page-cursor-stalled', {
          beforeSeq: oldestLoadedSeq,
          conversationId,
          fetchedMessageCount: nextSnapshot.messages.length,
          oldestMessageSeq: nextSnapshot.oldestMessageSeq,
        });

        const stalledState = {
          ...currentState,
          hasMoreOlder: false,
        };
        historyStateRef.current = stalledState;
        return stalledState;
      });
    } catch (error) {
      console.error('[chat-history]', 'older-page-fetch-failed', {
        conversationId,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });
      pendingRestoreRef.current = null;
    } finally {
      setIsLoadingOlder(false);
    }
  }, [conversationId, hasMoreOlder, isLoadingOlder, oldestLoadedSeq]);

  const mergeSyncRequest = useCallback(
    (nextRequest: ThreadHistorySyncRequestPayload) => {
      const normalizedNextRequest = normalizeThreadHistorySyncRequestState(
        nextRequest,
      );
      const currentByIdRequest = pendingByIdSyncRequestRef.current;
      const currentAfterSeqRequest = pendingAfterSeqSyncRequestRef.current;
      const currentAuthoritativeLatestWindowRequest =
        pendingAuthoritativeLatestWindowSyncRequestRef.current;

      if (normalizedNextRequest.messageIds.length > 0) {
        const mergedMessageIds = Array.from(
          new Set([
            ...(currentByIdRequest?.messageIds ?? []),
            ...normalizedNextRequest.messageIds,
          ]),
        );
        const mergedReason =
          normalizedNextRequest.reason || currentByIdRequest?.reason || null;

        pendingByIdSyncRequestRef.current = {
          messageIds: mergedMessageIds,
          reason: mergedReason,
        };

        if (historySyncDiagnosticsEnabled && currentAfterSeqRequest) {
          console.info('[chat-history]', 'topology-sync:mode-separated', {
            conversationId,
            currentQueuedAfterSeqReason: currentAfterSeqRequest.reason,
            nextMode: 'by-id',
            queuedModes: ['by-id', 'after-seq'],
            requestedMessageIds: mergedMessageIds,
            reason: mergedReason,
          });
        }

        return;
      }

      if (normalizedNextRequest.newerThanLatest) {
        pendingAfterSeqSyncRequestRef.current = {
          reason:
            normalizedNextRequest.reason || currentAfterSeqRequest?.reason || null,
        };

        if (historySyncDiagnosticsEnabled && currentByIdRequest) {
          console.info('[chat-history]', 'topology-sync:mode-separated', {
            conversationId,
            currentQueuedByIdMessageIds: currentByIdRequest.messageIds,
            nextMode: 'after-seq',
            queuedModes: ['by-id', 'after-seq'],
            reason:
              normalizedNextRequest.reason || currentAfterSeqRequest?.reason || null,
          });
        }
      }

      if (!normalizedNextRequest.authoritativeLatestWindow) {
        return;
      }

      pendingAuthoritativeLatestWindowSyncRequestRef.current = {
        reason:
          normalizedNextRequest.reason ||
          currentAuthoritativeLatestWindowRequest?.reason ||
          currentAfterSeqRequest?.reason ||
          null,
      };

      if (historySyncDiagnosticsEnabled && (currentByIdRequest || currentAfterSeqRequest)) {
        console.info('[chat-history]', 'topology-sync:mode-separated', {
          conversationId,
          currentQueuedByIdMessageIds: currentByIdRequest?.messageIds ?? null,
          currentQueuedAfterSeqReason: currentAfterSeqRequest?.reason ?? null,
          nextMode: 'authoritative-latest-window',
          queuedModes: ['by-id', 'after-seq', 'authoritative-latest-window'],
          reason:
            normalizedNextRequest.reason ||
            currentAuthoritativeLatestWindowRequest?.reason ||
            currentAfterSeqRequest?.reason ||
            null,
        });
      }
    },
    [conversationId, historySyncDiagnosticsEnabled],
  );

  const performSyncFetch = useCallback(
    async (input: {
      allowLatest?: boolean;
      afterSeq?: number | null;
      messageIds?: string[] | null;
      reason: string | null;
    }) => {
      const normalizedMessageIds = Array.from(
        new Set((input.messageIds ?? []).map((messageId) => messageId.trim()).filter(Boolean)),
      );
      const requestedMode = resolveHistoryFetchMode({
        afterSeq: input.afterSeq ?? null,
        messageIds: normalizedMessageIds,
      });
      const mode =
        requestedMode === 'noop' && input.allowLatest ? 'latest' : requestedMode;

      if (mode === 'noop') {
        if (historySyncDiagnosticsEnabled) {
          console.info('[chat-history]', 'topology-sync:fetch:noop-suppressed', {
            conversationId,
            reason: input.reason ?? null,
          });
        }

        return null;
      }

      if (historySyncDiagnosticsEnabled) {
        console.info('[chat-history]', 'topology-sync:fetch:start', {
          afterSeq: input.afterSeq ?? null,
          chosenMode: mode,
          conversationId,
          messageIds: normalizedMessageIds.length > 0 ? normalizedMessageIds : null,
          reason: input.reason ?? null,
        });
      }

      const response = await fetch(
        buildHistoryPageUrl({
          activeDeviceId: historyFetchActiveDeviceIdRef.current,
          afterSeq: mode === 'after-seq' ? input.afterSeq ?? null : null,
          conversationId,
          debugRequestId:
            process.env.NEXT_PUBLIC_CHAT_DEBUG_DM_E2EE_BOOTSTRAP === '1'
              ? crypto.randomUUID()
              : null,
          limit: THREAD_HISTORY_PAGE_SIZE,
          messageIds: mode === 'by-id' ? input.messageIds ?? null : null,
        }),
        {
          cache: 'no-store',
          credentials: 'same-origin',
        },
      );

      if (!response.ok) {
        throw new Error(
          `Thread sync fetch failed with status ${response.status} (${input.reason ?? 'unknown'})`,
        );
      }

      const snapshot = (await response.json()) as ThreadHistoryPageSnapshot;

      if (historySyncDiagnosticsEnabled) {
        console.info('[chat-history]', 'topology-sync:fetch:done', {
          afterSeq: input.afterSeq ?? null,
          chosenMode: mode,
          conversationId,
          fetchedCount: snapshot.messages.length,
          messageIds: normalizedMessageIds.length > 0 ? normalizedMessageIds : null,
          oldestMessageSeq: snapshot.oldestMessageSeq,
          reason: input.reason ?? null,
        });
      }

      return snapshot;
    },
    [conversationId, historySyncDiagnosticsEnabled],
  );

  const scheduleMissingEncryptedDmEnvelopeRecovery = useCallback(
    (input: {
      reason: string | null;
      requestedMessageIds: string[];
      snapshot: ThreadHistoryPageSnapshot;
    }) => {
      if (
        !shouldRetryLocalEncryptedDmMissingEnvelope(input.reason) ||
        input.requestedMessageIds.length === 0
      ) {
        return;
      }

      const {
        missingRequestedMessageIds,
        presentRequestedMessageIds,
      } = resolveMissingOwnEncryptedMessageIdsForRetry({
        currentUserId,
        requestedMessageIds: input.requestedMessageIds,
        snapshot: input.snapshot,
      });
      const missingMessageIdSet = new Set(missingRequestedMessageIds);

      updatePendingEncryptedCommitTransitionMessageIds({
        add: missingRequestedMessageIds,
        remove: presentRequestedMessageIds.filter(
          (messageId) => !missingMessageIdSet.has(messageId),
        ),
      });

      for (const messageId of presentRequestedMessageIds) {
        if (missingMessageIdSet.has(messageId)) {
          continue;
        }

        const timeoutId = encryptedDmRecoveryTimeoutsRef.current.get(messageId);

        if (timeoutId) {
          clearTimeout(timeoutId);
          encryptedDmRecoveryTimeoutsRef.current.delete(messageId);
        }

        encryptedDmRecoveryAttemptsRef.current.delete(messageId);
      }

      for (const messageId of missingRequestedMessageIds) {
        if (encryptedDmRecoveryTimeoutsRef.current.has(messageId)) {
          continue;
        }

        const attemptIndex =
          encryptedDmRecoveryAttemptsRef.current.get(messageId) ?? 0;
        const retryDelayMs =
          ENCRYPTED_DM_MISSING_ENVELOPE_RETRY_DELAYS_MS[attemptIndex];

        if (retryDelayMs === undefined) {
          updatePendingEncryptedCommitTransitionMessageIds({
            remove: [messageId],
          });

          if (historySyncDiagnosticsEnabled) {
            console.info(
              '[chat-history]',
              'topology-sync:encrypted-missing-envelope-retry-exhausted',
              {
                attemptCount: attemptIndex,
                conversationId,
                messageId,
                reason: input.reason,
              },
            );
          }
          continue;
        }

        encryptedDmRecoveryAttemptsRef.current.set(messageId, attemptIndex + 1);

        if (historySyncDiagnosticsEnabled) {
          console.info(
            '[chat-history]',
            'topology-sync:encrypted-missing-envelope-retry-scheduled',
            {
              attemptNumber: attemptIndex + 1,
              conversationId,
              messageId,
              reason: input.reason,
              retryDelayMs,
            },
          );
        }

        const timeoutId = setTimeout(() => {
          encryptedDmRecoveryTimeoutsRef.current.delete(messageId);

          if (historySyncDiagnosticsEnabled) {
            console.info(
              '[chat-history]',
              'topology-sync:encrypted-missing-envelope-retry-dispatched',
              {
                conversationId,
                messageId,
                reason: ENCRYPTED_DM_MISSING_ENVELOPE_RECOVERY_REASON,
              },
            );
          }

          emitThreadHistorySyncRequest({
            conversationId,
            messageIds: [messageId],
            reason: ENCRYPTED_DM_MISSING_ENVELOPE_RECOVERY_REASON,
          });
        }, retryDelayMs);

        encryptedDmRecoveryTimeoutsRef.current.set(messageId, timeoutId);
      }
    },
    [
      conversationId,
      currentUserId,
      historySyncDiagnosticsEnabled,
      updatePendingEncryptedCommitTransitionMessageIds,
    ],
  );

  const scheduleVoiceAttachmentRecovery = useCallback(
    (input: {
      reason: string | null;
      requestedMessageIds: string[];
      snapshot: ThreadHistoryPageSnapshot;
    }) => {
      if (
        !shouldRetryLocalVoiceAttachmentResolution(input.reason) ||
        input.requestedMessageIds.length === 0
      ) {
        return;
      }

      const {
        missingRequestedMessageIds,
        presentRequestedMessageIds,
      } = resolveVoiceMessageIdsNeedingAttachmentRecovery({
        requestedMessageIds: input.requestedMessageIds,
        snapshot: input.snapshot,
      });
      const missingMessageIdSet = new Set(missingRequestedMessageIds);

      for (const messageId of presentRequestedMessageIds) {
        if (missingMessageIdSet.has(messageId)) {
          continue;
        }

        const timeoutId = voiceAttachmentRecoveryTimeoutsRef.current.get(messageId);

        if (timeoutId) {
          clearTimeout(timeoutId);
          voiceAttachmentRecoveryTimeoutsRef.current.delete(messageId);
        }

        voiceAttachmentRecoveryAttemptsRef.current.delete(messageId);
      }

      for (const messageId of missingRequestedMessageIds) {
        if (voiceAttachmentRecoveryTimeoutsRef.current.has(messageId)) {
          continue;
        }

        const attemptIndex =
          voiceAttachmentRecoveryAttemptsRef.current.get(messageId) ?? 0;
        const retryDelayMs =
          VOICE_MESSAGE_ATTACHMENT_RETRY_DELAYS_MS[attemptIndex];

        if (retryDelayMs === undefined) {
          if (historySyncDiagnosticsEnabled) {
            console.info(
              '[chat-history]',
              'topology-sync:voice-attachment-retry-exhausted',
              {
                attemptCount: attemptIndex,
                conversationId,
                messageId,
                reason: input.reason,
              },
            );
          }
          continue;
        }

        voiceAttachmentRecoveryAttemptsRef.current.set(messageId, attemptIndex + 1);

        if (historySyncDiagnosticsEnabled) {
          console.info(
            '[chat-history]',
            'topology-sync:voice-attachment-retry-scheduled',
            {
              attemptNumber: attemptIndex + 1,
              conversationId,
              messageId,
              reason: input.reason,
              retryDelayMs,
            },
          );
        }

        const timeoutId = setTimeout(() => {
          voiceAttachmentRecoveryTimeoutsRef.current.delete(messageId);

          if (historySyncDiagnosticsEnabled) {
            console.info(
              '[chat-history]',
              'topology-sync:voice-attachment-retry-dispatched',
              {
                conversationId,
                messageId,
                reason: VOICE_MESSAGE_ATTACHMENT_RECOVERY_REASON,
              },
            );
          }

          emitThreadHistorySyncRequest({
            conversationId,
            messageIds: [messageId],
            reason: VOICE_MESSAGE_ATTACHMENT_RECOVERY_REASON,
          });
        }, retryDelayMs);

        voiceAttachmentRecoveryTimeoutsRef.current.set(messageId, timeoutId);
      }
    },
    [conversationId, historySyncDiagnosticsEnabled],
  );

  const scheduleAttachmentRecovery = useCallback(
    (input: {
      reason: string | null;
      requestedMessageIds: string[];
      snapshot: ThreadHistoryPageSnapshot;
    }) => {
      if (
        !shouldRetryThreadAttachmentResolution(input.reason) ||
        input.requestedMessageIds.length === 0
      ) {
        return;
      }

      const {
        missingRequestedMessageIds,
        presentRequestedMessageIds,
      } = resolveAttachmentMessageIdsNeedingRecovery({
        requestedMessageIds: input.requestedMessageIds,
        snapshot: input.snapshot,
      });
      const missingMessageIdSet = new Set(missingRequestedMessageIds);

      for (const messageId of presentRequestedMessageIds) {
        if (missingMessageIdSet.has(messageId)) {
          continue;
        }

        const timeoutId = attachmentRecoveryTimeoutsRef.current.get(messageId);

        if (timeoutId) {
          clearTimeout(timeoutId);
          attachmentRecoveryTimeoutsRef.current.delete(messageId);
        }

        attachmentRecoveryAttemptsRef.current.delete(messageId);
      }

      for (const messageId of missingRequestedMessageIds) {
        if (attachmentRecoveryTimeoutsRef.current.has(messageId)) {
          continue;
        }

        const attemptIndex =
          attachmentRecoveryAttemptsRef.current.get(messageId) ?? 0;
        const retryDelayMs = ATTACHMENT_MESSAGE_RETRY_DELAYS_MS[attemptIndex];

        if (retryDelayMs === undefined) {
          if (historySyncDiagnosticsEnabled) {
            console.info(
              '[chat-history]',
              'topology-sync:attachment-retry-exhausted',
              {
                attemptCount: attemptIndex,
                conversationId,
                messageId,
                reason: input.reason,
              },
            );
          }
          continue;
        }

        attachmentRecoveryAttemptsRef.current.set(messageId, attemptIndex + 1);

        if (historySyncDiagnosticsEnabled) {
          console.info(
            '[chat-history]',
            'topology-sync:attachment-retry-scheduled',
            {
              attemptNumber: attemptIndex + 1,
              conversationId,
              messageId,
              reason: input.reason,
              retryDelayMs,
            },
          );
        }

        const timeoutId = setTimeout(() => {
          attachmentRecoveryTimeoutsRef.current.delete(messageId);

          if (historySyncDiagnosticsEnabled) {
            console.info(
              '[chat-history]',
              'topology-sync:attachment-retry-dispatched',
              {
                conversationId,
                messageId,
                reason: ATTACHMENT_MESSAGE_RECOVERY_REASON,
              },
            );
          }

          emitThreadHistorySyncRequest({
            conversationId,
            messageIds: [messageId],
            reason: ATTACHMENT_MESSAGE_RECOVERY_REASON,
          });
        }, retryDelayMs);

        attachmentRecoveryTimeoutsRef.current.set(messageId, timeoutId);
      }
    },
    [conversationId, historySyncDiagnosticsEnabled],
  );

  const handleLiveMessage = useCallback(
    (detail: ThreadHistoryLiveMessagePayload) => {
      setHistoryState((currentState) => {
        const nextState = upsertLiveThreadMessage({
          message: detail.message,
          state: currentState,
        });
        historyStateRef.current = nextState;
        return nextState;
      });
    },
    [],
  );

  const applySyncSnapshot = useCallback(
    (input: {
      mode: 'authoritative-latest-window' | 'sync-topology';
      snapshot: ThreadHistoryPageSnapshot;
    }) => {
      setHistoryState((currentState) => {
        const nextState = mergeThreadHistoryState({
          mode:
            input.mode === 'authoritative-latest-window'
              ? 'refresh-base'
              : 'sync-topology',
          snapshot: input.snapshot,
          state: currentState,
        }).nextState;
        historyStateRef.current = nextState;
        return nextState;
      });

      historyFetchActiveDeviceIdRef.current =
        input.snapshot.dmE2ee?.activeDeviceRecordId ??
        historyFetchActiveDeviceIdRef.current;

      reconcileThreadLiveReactionSnapshot({
        conversationId,
        reactionsByMessage: input.snapshot.reactionsByMessage,
        snapshotMessageIds: input.snapshot.messages.map((message) => message.id),
      });

      if (input.mode === 'authoritative-latest-window') {
        reconcileThreadMessagePatchesWithAuthoritativeMessages({
          conversationId,
          messages: input.snapshot.messages,
        });
      }
    },
    [conversationId],
  );

  const getLatestLoadedSeqFromCurrentState = useCallback(
    () => resolveLatestLoadedSeq(historyStateRef.current.messages, null),
    [],
  );

  useThreadHistorySyncRuntime({
    attachmentRecoveryAttemptsRef,
    attachmentRecoveryTimeoutsRef,
    conversationId,
    encryptedDmRecoveryAttemptsRef,
    encryptedDmRecoveryTimeoutsRef,
    getLatestLoadedSeq: getLatestLoadedSeqFromCurrentState,
    historyMessageIds,
    historyStateRef,
    historySyncDiagnosticsEnabled,
    isSyncingRef,
    mergeSyncRequest,
    normalizeSyncRequest: normalizeThreadHistorySyncRequestState,
    onApplySyncSnapshot: applySyncSnapshot,
    onLiveMessage: handleLiveMessage,
    pageSize: THREAD_HISTORY_PAGE_SIZE,
    pendingAuthoritativeLatestWindowSyncRequestRef,
    pendingAfterSeqSyncRequestRef,
    pendingByIdSyncRequestRef,
    performSyncFetch,
    scheduleAttachmentRecovery,
    scheduleMissingEncryptedDmEnvelopeRecovery,
    scheduleVoiceAttachmentRecovery,
    shouldTrackPendingEncryptedCommitTransition:
      shouldRetryLocalEncryptedDmMissingEnvelope,
    syncTimeoutRef,
    threadMountRecoveryReason: THREAD_MOUNT_RECOVERY_REASON,
    updatePendingEncryptedCommitTransitionMessageIds,
    voiceAttachmentRecoveryAttemptsRef,
    voiceAttachmentRecoveryTimeoutsRef,
  });

  useThreadHistoryPrependScrollRestore({
    idleMs: PREPEND_SCROLL_RESTORE_IDLE_MS,
    maxMs: PREPEND_SCROLL_RESTORE_MAX_MS,
    messages: historyState.messages,
    pendingRestoreRef,
    targetId: 'message-thread-scroll',
  });

  const openImagePreview = useCallback((preview: ActiveImagePreview) => {
    const signedUrl = normalizeAttachmentSignedUrl(preview.signedUrl);
    const previewCaption = normalizeMessageBodyText(preview.caption);
    const previewLabel = previewCaption ?? t.chat.photo;

    if (!signedUrl) {
      logThreadGuardDiagnostic(
        'image-preview-suppressed-missing-url',
        `${conversationId}:${previewLabel}`,
        {
          conversationId,
          previewCaption,
        },
      );
      return;
    }

    setActiveImagePreview({
      caption: previewCaption,
      signedUrl,
    });
  }, [conversationId, t.chat.photo]);

  const closeImagePreview = useCallback(() => {
    setActiveImagePreview(null);
  }, []);
  const requestOlderMessages = useCallback(() => {
    void loadOlderMessages();
  }, [loadOlderMessages]);
  const optimisticMessageLabels = useMemo(
    () => ({
      attachment: t.chat.attachment,
      delete: t.chat.delete,
      failed: t.chat.sendFailed,
      photo: t.chat.photo,
      justNow: t.chat.justNow,
      queued: t.chat.messageQueued,
      remove: t.chat.remove,
      retry: t.chat.retrySend,
      sending: t.chat.sending,
      sent: t.chat.sent,
      voiceFailed: t.chat.voiceMessageFailed,
      voicePendingHint: t.chat.voiceMessagePendingHint,
      voiceProcessing: t.chat.voiceMessageProcessing,
      voiceUploading: t.chat.voiceMessageUploading,
    }),
    [
      t.chat.attachment,
      t.chat.delete,
      t.chat.sendFailed,
      t.chat.photo,
      t.chat.justNow,
      t.chat.messageQueued,
      t.chat.remove,
      t.chat.retrySend,
      t.chat.sending,
      t.chat.sent,
      t.chat.voiceMessageFailed,
      t.chat.voiceMessagePendingHint,
      t.chat.voiceMessageProcessing,
      t.chat.voiceMessageUploading,
    ],
  );

  return (
    <>
      <ThreadViewportDeferredEffects
        confirmedClientIds={resolvedConfirmedClientIds}
        conversationId={conversationId}
        conversationKind={conversationKind}
        currentReadMessageSeq={currentReadMessageSeq}
        hasMoreOlder={hasMoreOlder}
        isLoadingOlder={isLoadingOlder}
        labels={optimisticMessageLabels}
        latestVisibleMessageSeq={latestCommittedMessageSeq}
        loadingOlderLabel={t.chat.loadingOlderMessages}
        noOlderLabel={t.chat.olderMessagesAutoLoad}
        onRequestOlder={requestOlderMessages}
        threadClientDiagnostics={threadClientDiagnostics}
      />
      <ThreadHistoryMessageList
        activeDeleteMessageId={activeDeleteMessageId}
        activeEditMessageId={activeEditMessageId}
        activeSpaceId={activeSpaceId}
        conversationId={conversationId}
        conversationKind={conversationKind}
        currentUserId={currentUserId}
        emptyLabel={t.chat.noMessagesYet}
        historyState={historyState}
        language={language}
        latestVisibleMessageSeq={latestCommittedMessageSeq}
        onOpenImagePreview={openImagePreview}
        otherParticipantReadSeq={otherParticipantReadSeq}
        otherParticipantUserId={otherParticipantUserId}
        pendingEncryptedCommitTransitionMessageIds={
          pendingEncryptedCommitTransitionMessageIds
        }
        senderNames={senderNames}
        threadClientDiagnostics={threadClientDiagnostics}
        timelineRenderItems={timelineRenderItems}
      />
      <ThreadImagePreviewOverlay
        closeLabel={t.chat.closePhotoPreview}
        fallbackTitle={t.chat.photo}
        onClose={closeImagePreview}
        preview={activeImagePreview}
      />
    </>
  );
}
