'use client';

import Link from 'next/link';
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { createPortal } from 'react-dom';
import {
  formatPersonFallbackLabel,
  getLocaleForLanguage,
  getTranslations,
  type AppLanguage,
} from '@/modules/i18n';
import type { StoredDmE2eeEnvelope } from '@/modules/messaging/contract/dm-e2ee';
import { persistCurrentDmE2eeDeviceCookie } from '@/modules/messaging/e2ee/current-device-cookie';
import { ensureDmE2eeDeviceRegistered } from '@/modules/messaging/e2ee/device-registration';
import { getLocalDmE2eeDeviceRecord } from '@/modules/messaging/e2ee/device-store';
import type { EncryptedDmServerHistoryHint } from '@/modules/messaging/e2ee/ui-policy';
import type { MessagingVoicePlaybackState } from '@/modules/messaging/media';
import {
  emitThreadHistorySyncRequest,
  emitThreadHistoryVisibleMessageIds,
  LOCAL_THREAD_HISTORY_LIVE_MESSAGE_EVENT,
  LOCAL_THREAD_HISTORY_SYNC_REQUEST_EVENT,
  type ThreadHistoryLiveMessagePayload,
  type ThreadHistorySyncRequestPayload,
} from '@/modules/messaging/realtime/thread-history-sync-events';
import { resolvePublicIdentityLabel } from '@/modules/messaging/ui/identity-label';
import { withSpaceParam } from '@/modules/spaces/url';
import {
  useThreadMessagePatchedBody,
  useThreadMessagePatchedDeletedAt,
} from '@/modules/messaging/realtime/thread-message-patch-store';
import { AutoScrollToLatest } from './auto-scroll-to-latest';
import {
  DmThreadClientSubtree,
  type DmThreadClientDiagnostics,
} from './dm-thread-client-diagnostics';
import {
  DmReplyTargetSnippet,
  resolveReplyTargetAttachmentKind,
} from './dm-reply-target-snippet';
import { EncryptedDmMessageBody } from './encrypted-dm-message-body';
import { EncryptedHistoryUnavailableState } from './encrypted-history-unavailable-state';
import { LiveOutgoingMessageStatus } from './live-outgoing-message-status';
import { MarkConversationRead } from './mark-conversation-read';
import { MessageStatusIndicator } from './message-status-indicator';
import { OptimisticThreadMessages } from './optimistic-thread-messages';
import { ProgressiveHistoryLoader } from './progressive-history-loader';
import { ThreadDeleteMessageConfirm } from './thread-delete-message-confirm';
import { ThreadEditedIndicator } from './thread-edited-indicator';
import { ThreadInlineEditForm } from './thread-inline-edit-form';
import { ThreadReactionGroups } from './thread-reaction-groups';
import { ThreadReactionPicker } from './thread-reaction-picker';

type ConversationMessageRow = {
  body: string | null;
  client_id: string | null;
  content_mode?: string | null;
  conversation_id: string;
  created_at: string | null;
  deleted_at: string | null;
  edited_at: string | null;
  id: string;
  kind: string;
  reply_to_message_id: string | null;
  sender_device_id?: string | null;
  sender_id: string | null;
  seq: number | string;
};

type MessageAttachment = {
  bucket?: string;
  createdAt?: string | null;
  durationMs?: number | null;
  fileName: string;
  id: string;
  isAudio: boolean;
  isImage: boolean;
  isVoiceMessage?: boolean;
  messageId?: string;
  objectPath?: string;
  signedUrl: string | null;
  sizeBytes: number | null;
};

type MessageReactionGroup = {
  count: number;
  emoji: string;
  selectedByCurrentUser: boolean;
};

type MessageSenderProfile = {
  avatarPath?: string | null;
  displayName?: string | null;
  fullName?: string | null;
  id?: string | null;
  userId: string;
  username?: string | null;
};

type ThreadHistoryPageSnapshot = {
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
  messages: ConversationMessageRow[];
  oldestMessageSeq: number | null;
  reactionsByMessage: Array<{
    messageId: string;
    reactions: MessageReactionGroup[];
  }>;
  senderProfiles: MessageSenderProfile[];
};

type ThreadHistoryViewportProps = {
  activeDeleteMessageId: string | null;
  activeEditMessageId: string | null;
  activeSpaceId: string;
  conversationId: string;
  conversationKind: 'dm' | 'group';
  currentReadMessageSeq: number | null;
  currentUserId: string;
  initialSnapshot: ThreadHistoryPageSnapshot;
  language: AppLanguage;
  latestVisibleMessageSeq: number | null;
  otherParticipantReadSeq: number | null;
  otherParticipantUserId: string | null;
  threadClientDiagnostics: DmThreadClientDiagnostics;
};

type PendingScrollRestore = {
  previousScrollHeight: number;
  previousScrollTop: number;
};

type ThreadHistorySyncRequestState = {
  messageIds: string[];
  newerThanLatest: boolean;
  reason: string | null;
};

type PendingByIdThreadHistorySyncRequest = {
  messageIds: string[];
  reason: string | null;
};

type PendingAfterSeqThreadHistorySyncRequest = {
  reason: string | null;
};

type ThreadHistoryState = {
  attachmentsByMessage: Map<string, MessageAttachment[]>;
  encryptedEnvelopesByMessage: Map<string, StoredDmE2eeEnvelope>;
  encryptedHistoryHintsByMessage: Map<string, EncryptedDmServerHistoryHint>;
  hasMoreOlder: boolean;
  loadedOlderPageCount: number;
  messages: ConversationMessageRow[];
  messagesById: Map<string, ConversationMessageRow>;
  oldestLoadedSeq: number | null;
  reactionsByMessage: Map<string, MessageReactionGroup[]>;
  senderProfilesById: Map<string, MessageSenderProfile>;
};

type ThreadHistorySessionCacheEntry = {
  cachedAt: number;
  state: ThreadHistoryState;
};

type ActiveImagePreview = {
  fileName: string;
  signedUrl: string;
};

type TimelineItem =
  | { key: string; label: string; type: 'separator' | 'unread' }
  | { key: string; message: ConversationMessageRow; type: 'message' };

type EncryptedUnavailableRunMeta = {
  continuationCount: number;
  isContinuation: boolean;
};

type VoiceMessageRenderState =
  | 'ready'
  | 'uploading'
  | 'processing'
  | 'failed'
  | 'unavailable';

const THREAD_HISTORY_PAGE_SIZE = 26;
const ENCRYPTED_DM_MISSING_ENVELOPE_RECOVERY_REASON =
  'local-encrypted-send:retry-missing-envelope';
const ENCRYPTED_DM_HISTORY_CONTINUITY_RECOVERY_REASON =
  'dm-e2ee-history:retry-after-bootstrap';
const ENCRYPTED_DM_CURRENT_DEVICE_RESYNC_REASON =
  'dm-e2ee-history:current-device-resync';
const ENCRYPTED_DM_MISSING_ENVELOPE_RETRY_DELAYS_MS = [220, 900] as const;
const VOICE_MESSAGE_ATTACHMENT_RECOVERY_REASON =
  'local-voice-send:retry-attachment-resolution';
const VOICE_MESSAGE_REOPEN_RECOVERY_REASON =
  'voice-reopen:retry-attachment-resolution';
const VOICE_MESSAGE_ATTACHMENT_RETRY_DELAYS_MS = [180, 700] as const;
const VOICE_MESSAGE_RECOVERY_MAX_AGE_MS = 10 * 60 * 1000;
const MESSAGE_QUICK_REACTIONS = ['❤️', '👍', '😂', '😮', '🎉'] as const;
const MESSAGE_CLUSTER_MAX_GAP_MS = 5 * 60 * 1000;
const THREAD_HISTORY_SESSION_CACHE_MAX_ENTRIES = 6;
const EMPTY_MESSAGE_ATTACHMENTS: MessageAttachment[] = [];
const EMPTY_MESSAGE_REACTIONS: MessageReactionGroup[] = [];
const threadHistorySessionCache = new Map<string, ThreadHistorySessionCacheEntry>();

const activeThreadVoicePlayback: {
  audio: HTMLAudioElement | null;
  messageId: string | null;
} = {
  audio: null,
  messageId: null,
};

function claimActiveThreadVoicePlayback(
  messageId: string,
  audio: HTMLAudioElement,
) {
  const previousAudio = activeThreadVoicePlayback.audio;

  if (previousAudio && previousAudio !== audio) {
    previousAudio.pause();
  }

  activeThreadVoicePlayback.audio = audio;
  activeThreadVoicePlayback.messageId = messageId;
}

function releaseActiveThreadVoicePlayback(
  messageId: string,
  audio: HTMLAudioElement | null,
) {
  if (!audio) {
    return;
  }

  if (
    activeThreadVoicePlayback.audio === audio &&
    activeThreadVoicePlayback.messageId === messageId
  ) {
    activeThreadVoicePlayback.audio = null;
    activeThreadVoicePlayback.messageId = null;
  }
}

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

function formatMessageTimestamp(
  value: string | null,
  language: AppLanguage,
  t: ReturnType<typeof getTranslations>,
) {
  const parsedDate = parseSafeDate(value);

  if (!parsedDate) {
    return '';
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const compareDate = new Date(
    parsedDate.getFullYear(),
    parsedDate.getMonth(),
    parsedDate.getDate(),
  );

  if (compareDate.getTime() === today.getTime()) {
    return new Intl.DateTimeFormat(getLocaleForLanguage(language), {
      hour: 'numeric',
      minute: '2-digit',
    }).format(parsedDate);
  }

  if (compareDate.getTime() === yesterday.getTime()) {
    return t.chat.yesterday;
  }

  return new Intl.DateTimeFormat(getLocaleForLanguage(language), {
    month: 'short',
    day: 'numeric',
    year:
      parsedDate.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  }).format(parsedDate);
}

function formatDaySeparatorLabel(
  value: string | null,
  language: AppLanguage,
  t: ReturnType<typeof getTranslations>,
) {
  const targetDate = parseSafeDate(value);

  if (!targetDate) {
    return t.chat.earlier;
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
    return t.chat.today;
  }

  if (compareDate.getTime() === yesterday.getTime()) {
    return t.chat.yesterday;
  }

  return new Intl.DateTimeFormat(getLocaleForLanguage(language), {
    month: 'short',
    day: 'numeric',
    year:
      targetDate.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  }).format(targetDate);
}

function normalizeMessageBodyText(value: unknown) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed || null;
}

function formatAttachmentSize(value: number | null) {
  if (!value || Number.isNaN(value)) {
    return null;
  }

  if (value < 1024 * 1024) {
    return `${Math.max(1, Math.round(value / 1024))} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function formatVoiceDuration(valueMs: number | null | undefined) {
  if (!valueMs || Number.isNaN(valueMs) || valueMs < 0) {
    return '--:--';
  }

  const totalSeconds = Math.max(0, Math.round(valueMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function resolveVoiceMessageRenderState(input: {
  attachment: MessageAttachment | null;
  playbackFailed: boolean;
  stageHint?: 'uploading' | 'processing' | 'failed' | null;
}) {
  if (input.stageHint === 'uploading') {
    return 'uploading' satisfies VoiceMessageRenderState;
  }

  if (input.stageHint === 'processing') {
    return 'processing' satisfies VoiceMessageRenderState;
  }

  if (input.stageHint === 'failed' || input.playbackFailed) {
    return 'failed' satisfies VoiceMessageRenderState;
  }

  if (input.attachment?.signedUrl) {
    return 'ready' satisfies VoiceMessageRenderState;
  }

  if (
    input.attachment?.id &&
    input.attachment?.messageId &&
    input.attachment?.bucket &&
    input.attachment?.objectPath
  ) {
    return 'processing' satisfies VoiceMessageRenderState;
  }

  return 'unavailable' satisfies VoiceMessageRenderState;
}

function resolveVoiceMessageRenderReason(input: {
  attachment: MessageAttachment | null;
  playbackFailed: boolean;
  stageHint?: 'uploading' | 'processing' | 'failed' | null;
}) {
  if (input.stageHint === 'uploading') {
    return 'stage-uploading';
  }

  if (input.stageHint === 'processing') {
    return 'stage-processing';
  }

  if (input.stageHint === 'failed') {
    return 'stage-failed';
  }

  if (input.playbackFailed) {
    return 'playback-failed';
  }

  if (input.attachment?.signedUrl) {
    return 'signed-url-ready';
  }

  if (
    input.attachment?.id &&
    input.attachment?.messageId &&
    input.attachment?.bucket &&
    input.attachment?.objectPath
  ) {
    return 'storage-locator-present-awaiting-url';
  }

  if (input.attachment) {
    return 'attachment-present-without-resolver';
  }

  return 'attachment-missing';
}

function shouldRetryLocalVoiceAttachmentResolution(reason: string | null) {
  return (
    reason === 'local-voice-send' ||
    reason === VOICE_MESSAGE_REOPEN_RECOVERY_REASON ||
    reason === VOICE_MESSAGE_ATTACHMENT_RECOVERY_REASON
  );
}

function hasPlaybackReadyVoiceAttachment(attachments: MessageAttachment[]) {
  return attachments.some(
    (attachment) =>
      Boolean(attachment.signedUrl) &&
      (Boolean(attachment.isVoiceMessage) || attachment.isAudio),
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
        attachmentsByMessageId.get(messageId) ?? [],
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
          input.attachmentsByMessage.get(message.id) ?? [],
        ),
    )
    .map((message) => message.id);
}

function getVoiceMessageStateLabel(input: {
  state: VoiceMessageRenderState;
  t: ReturnType<typeof getTranslations>;
}) {
  switch (input.state) {
    case 'uploading':
      return input.t.chat.voiceMessageUploading;
    case 'processing':
      return input.t.chat.voiceMessageProcessing;
    case 'failed':
      return input.t.chat.voiceMessageFailed;
    case 'unavailable':
      return input.t.chat.voiceMessageUnavailable;
    default:
      return input.t.chat.voiceMessage;
  }
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

function buildChatHref(input: {
  conversationId: string;
  spaceId: string;
  actionMessageId?: string | null;
  deleteMessageId?: string | null;
  editMessageId?: string | null;
  error?: string | null;
  saved?: string | null;
  replyToMessageId?: string | null;
  details?: string | null;
  hash?: string | null;
}) {
  const params = new URLSearchParams();

  if (input.actionMessageId?.trim()) {
    params.set('actionMessageId', input.actionMessageId.trim());
  }

  if (input.deleteMessageId?.trim()) {
    params.set('deleteMessageId', input.deleteMessageId.trim());
  }

  if (input.editMessageId?.trim()) {
    params.set('editMessageId', input.editMessageId.trim());
  }

  if (input.error?.trim()) {
    params.set('error', input.error.trim());
  }

  if (input.saved?.trim()) {
    params.set('saved', input.saved.trim());
  }

  if (input.replyToMessageId?.trim()) {
    params.set('replyToMessageId', input.replyToMessageId.trim());
  }

  if (input.details?.trim()) {
    params.set('details', input.details.trim());
  }

  const search = params.toString();
  const baseHref = search
    ? `/chat/${input.conversationId}?${search}`
    : `/chat/${input.conversationId}`;
  const href = withSpaceParam(baseHref, input.spaceId);

  return input.hash ? `${href}${input.hash}` : href;
}

function isEncryptedDmTextMessage(value: {
  kind: string | null;
  content_mode?: string | null;
  deleted_at?: string | null;
}) {
  return (
    value.kind === 'text' &&
    value.content_mode === 'dm_e2ee_v1' &&
    !value.deleted_at
  );
}

function canRenderEncryptedDmBody(input: {
  clientId: unknown;
}) {
  return typeof input.clientId === 'string' && input.clientId.trim().length > 0;
}

function logEncryptedDmRenderFallback(input: {
  clientId: unknown;
  conversationId: string;
  diagnosticHintCode?: string | null;
  envelopePresent: boolean;
  messageId: string;
}) {
  if (process.env.NEXT_PUBLIC_CHAT_DEBUG_DM_E2EE_BOOTSTRAP !== '1') {
    return;
  }

  console.info('[dm-e2ee-history]', 'thread:render-fallback', {
    clientIdType: typeof input.clientId,
    conversationId: input.conversationId,
    envelopePresent: input.envelopePresent,
    hasUsableClientId:
      typeof input.clientId === 'string' && input.clientId.trim().length > 0,
    diagnosticHintCode: input.diagnosticHintCode ?? null,
    messageId: input.messageId,
  });
}

function shouldLogEncryptedDmServerRenderDiagnostics() {
  return (
    typeof window === 'undefined' &&
    process.env.CHAT_DEBUG_DM_E2EE_BOOTSTRAP === '1'
  );
}

function logEncryptedDmServerRenderDiagnostics(
  stage: string,
  details: Record<string, unknown>,
) {
  if (!shouldLogEncryptedDmServerRenderDiagnostics()) {
    return;
  }

  console.info('[chat-thread-render]', stage, details);
}

function normalizeEncryptedDmBranchLabel(isOwnMessage: boolean) {
  return isOwnMessage ? 'sender-own' : 'recipient-own';
}

function getEncryptedDmServerRenderInputIssues(input: {
  envelope: StoredDmE2eeEnvelope | null;
  historyHint: EncryptedDmServerHistoryHint;
  message: ConversationMessageRow;
}) {
  const issues: string[] = [];

  if (typeof input.message.id !== 'string' || !input.message.id.trim()) {
    issues.push('message.id');
  }

  if (input.message.kind !== 'text') {
    issues.push('message.kind');
  }

  if (input.message.content_mode !== 'dm_e2ee_v1') {
    issues.push('message.content_mode');
  }

  if (
    input.message.client_id !== null &&
    typeof input.message.client_id !== 'string'
  ) {
    issues.push('message.client_id');
  }

  if (
    input.message.sender_id !== null &&
    typeof input.message.sender_id !== 'string'
  ) {
    issues.push('message.sender_id');
  }

  if (
    input.message.body !== null &&
    typeof input.message.body !== 'string'
  ) {
    issues.push('message.body');
  }

  if (
    typeof input.historyHint.code !== 'string' ||
    typeof input.historyHint.committedHistoryState !== 'string' ||
    typeof input.historyHint.currentDeviceAvailability !== 'string' ||
    typeof input.historyHint.recoveryDisposition !== 'string'
  ) {
    issues.push('historyHint.shape');
  }

  if (
    input.historyHint.activeDeviceRecordId !== null &&
    typeof input.historyHint.activeDeviceRecordId !== 'string'
  ) {
    issues.push('historyHint.activeDeviceRecordId');
  }

  if (
    input.historyHint.messageCreatedAt !== null &&
    typeof input.historyHint.messageCreatedAt !== 'string'
  ) {
    issues.push('historyHint.messageCreatedAt');
  }

  if (
    input.historyHint.viewerJoinedAt !== null &&
    typeof input.historyHint.viewerJoinedAt !== 'string'
  ) {
    issues.push('historyHint.viewerJoinedAt');
  }

  if (input.envelope) {
    if (
      typeof input.envelope.messageId !== 'string' ||
      input.envelope.messageId !== input.message.id
    ) {
      issues.push('envelope.messageId');
    }

    if (
      typeof input.envelope.senderDeviceRecordId !== 'string' ||
      !input.envelope.senderDeviceRecordId.trim()
    ) {
      issues.push('envelope.senderDeviceRecordId');
    }

    if (
      typeof input.envelope.recipientDeviceRecordId !== 'string' ||
      !input.envelope.recipientDeviceRecordId.trim()
    ) {
      issues.push('envelope.recipientDeviceRecordId');
    }

    if (
      typeof input.envelope.ciphertext !== 'string' ||
      !input.envelope.ciphertext.trim()
    ) {
      issues.push('envelope.ciphertext');
    }
  }

  return issues;
}

function getOutgoingMessageStatus(input: {
  isDeletedMessage: boolean;
  isOwnMessage: boolean;
  messageSeq: unknown;
  otherParticipantReadSeq: unknown;
}) {
  if (!input.isOwnMessage || input.isDeletedMessage) {
    return null;
  }

  const normalizedMessageSeq = normalizeComparableMessageSeq(input.messageSeq);
  const normalizedReadSeq = normalizeComparableMessageSeq(
    input.otherParticipantReadSeq,
  );

  if (normalizedMessageSeq === null) {
    return 'sent' as const;
  }

  if (normalizedReadSeq !== null && normalizedReadSeq >= normalizedMessageSeq) {
    return 'seen' as const;
  }

  return 'sent' as const;
}

function isMessageQuickActionInteractiveTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.closest('[data-message-quick-actions-surface="true"]')) {
    return true;
  }

  if (target.closest('.reaction-groups')) {
    return true;
  }

  return Boolean(
    target.closest(
      'a, button, input, textarea, select, summary, details, audio, video',
    ),
  );
}

function ThreadVoiceMessageBubble({
  attachment,
  conversationId,
  isOwnMessage,
  language,
  messageId,
  stageHint = null,
}: {
  attachment: MessageAttachment | null;
  conversationId: string;
  isOwnMessage: boolean;
  language: AppLanguage;
  messageId: string;
  stageHint?: 'uploading' | 'processing' | 'failed' | null;
}) {
  const t = getTranslations(language);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playbackState, setPlaybackState] =
    useState<MessagingVoicePlaybackState>('idle');
  const [progressMs, setProgressMs] = useState(0);
  const [resolvedDurationMs, setResolvedDurationMs] = useState<number | null>(
    attachment?.durationMs ?? null,
  );
  const [playbackFailed, setPlaybackFailed] = useState(false);
  const [resolvedSignedUrl, setResolvedSignedUrl] = useState<string | null>(
    attachment?.signedUrl ?? null,
  );
  const [didFailSignedUrlResolve, setDidFailSignedUrlResolve] = useState(false);
  const [ignoredAttachmentSignedUrl, setIgnoredAttachmentSignedUrl] = useState<
    string | null
  >(null);
  const [isResolvingSignedUrl, setIsResolvingSignedUrl] = useState(false);
  const [hasPendingPlaybackIntent, setHasPendingPlaybackIntent] = useState(false);
  const resolveSignedUrlPromiseRef = useRef<Promise<string | null> | null>(null);
  const attachmentSignedUrl = attachment?.signedUrl?.trim() || null;
  const hasRecoverableAttachmentLocator = Boolean(
    attachment?.id &&
      attachment?.messageId &&
      attachment?.bucket &&
      attachment?.objectPath,
  );

  const effectiveSignedUrl =
    resolvedSignedUrl?.trim() ||
    (attachmentSignedUrl && attachmentSignedUrl !== ignoredAttachmentSignedUrl
      ? attachmentSignedUrl
      : null);
  const canResolveSignedUrl =
    Boolean(conversationId && hasRecoverableAttachmentLocator) && !effectiveSignedUrl;
  const effectiveStageHint =
    stageHint ??
    (isResolvingSignedUrl && !effectiveSignedUrl ? 'processing' : null);
  const voiceStateInput = {
    attachment:
      attachment === null
        ? null
        : {
            ...attachment,
            signedUrl: effectiveSignedUrl,
          },
    playbackFailed,
    stageHint: effectiveStageHint,
  } as const;

  const voiceState = resolveVoiceMessageRenderState(voiceStateInput);
  const voiceRenderReason = resolveVoiceMessageRenderReason(voiceStateInput);
  const totalDurationMs = resolvedDurationMs && resolvedDurationMs > 0
    ? resolvedDurationMs
    : 0;
  const progressRatio =
    totalDurationMs > 0
      ? Math.min(1, Math.max(0, progressMs / totalDurationMs))
      : 0;
  const isPlaying = playbackState === 'playing';
  const isBuffering = playbackState === 'buffering';
  const isPreparingPlayback = hasPendingPlaybackIntent && !isPlaying;
  const readyStateLabel =
    playbackState === 'buffering' || isPreparingPlayback
      ? t.chat.voiceMessageLoading
      : t.chat.voiceMessage;
  const isRecoveringVoiceMessage =
    voiceState !== 'ready' &&
    canResolveSignedUrl &&
    (isResolvingSignedUrl ||
      (ignoredAttachmentSignedUrl !== null && !didFailSignedUrlResolve));
  const stateLabel =
    voiceState === 'ready'
      ? readyStateLabel
      : isRecoveringVoiceMessage
        ? t.chat.voiceMessageRecovering
        : getVoiceMessageStateLabel({ state: voiceState, t });
  const stateNote =
    voiceState === 'ready'
      ? null
      : isRecoveringVoiceMessage
        ? t.chat.voiceMessagePendingHint
        : canResolveSignedUrl && didFailSignedUrlResolve && !isResolvingSignedUrl
          ? t.chat.voiceMessageRetryHint
          : null;
  const durationLabel =
    voiceState === 'ready'
      ? playbackState === 'playing' ||
        playbackState === 'paused' ||
        playbackState === 'buffering'
        ? `${formatVoiceDuration(progressMs)} / ${formatVoiceDuration(
            resolvedDurationMs,
          )}`
        : formatVoiceDuration(resolvedDurationMs)
      : '--:--';
  const playIconState =
    voiceState !== 'ready'
      ? voiceState === 'failed' || voiceState === 'unavailable'
        ? 'error'
        : 'loading'
      : isPreparingPlayback || isBuffering
        ? 'loading'
        : isPlaying
          ? 'pause'
          : 'play';

  useEffect(() => {
    const audio = audioRef.current;

    return () => {
      if (!audio) {
        return;
      }

      audio.pause();
      releaseActiveThreadVoicePlayback(messageId, audio);
      audio.src = '';
    };
  }, [messageId]);

  useEffect(() => {
    setResolvedDurationMs(attachment?.durationMs ?? null);
    setResolvedSignedUrl(attachment?.signedUrl ?? null);
    setDidFailSignedUrlResolve(false);
    setIgnoredAttachmentSignedUrl(null);
    setHasPendingPlaybackIntent(false);
    setPlaybackFailed(false);
  }, [attachment?.durationMs, attachment?.id, attachment?.signedUrl]);

  const resolveSignedUrl = useCallback(async () => {
    const attachmentId = attachment?.id ?? null;
    const attachmentMessageId = attachment?.messageId ?? null;

    if (!canResolveSignedUrl || !attachmentId || !attachmentMessageId) {
      return effectiveSignedUrl;
    }

    if (resolveSignedUrlPromiseRef.current) {
      return resolveSignedUrlPromiseRef.current;
    }

    const promise = (async () => {
      setIsResolvingSignedUrl(true);
      setDidFailSignedUrlResolve(false);

      try {
        const response = await fetch(
          buildAttachmentSignedUrlResolveUrl({
            attachmentId,
            conversationId,
            messageId: attachmentMessageId,
          }),
          {
            cache: 'no-store',
            credentials: 'same-origin',
          },
        );

        if (!response.ok) {
          throw new Error(
            `Voice attachment URL resolve failed with status ${response.status}`,
          );
        }

        const payload = (await response.json()) as { signedUrl?: string | null };
        const nextSignedUrl =
          typeof payload.signedUrl === 'string' && payload.signedUrl.trim()
            ? payload.signedUrl
            : null;

        if (nextSignedUrl) {
          setIgnoredAttachmentSignedUrl(null);
          setDidFailSignedUrlResolve(false);
          setPlaybackFailed(false);
          setResolvedSignedUrl(nextSignedUrl);
        }

        if (
          process.env.NEXT_PUBLIC_CHAT_DEBUG_VOICE === '1' &&
          typeof window !== 'undefined'
        ) {
          console.info('[voice-thread]', 'attachment-url-resolved', {
            attachmentId,
            conversationId,
            messageId: attachmentMessageId,
            resolved: Boolean(nextSignedUrl),
          });
        }

        return nextSignedUrl;
      } catch (error) {
        setDidFailSignedUrlResolve(true);
        if (
          process.env.NEXT_PUBLIC_CHAT_DEBUG_VOICE === '1' &&
          typeof window !== 'undefined'
        ) {
          console.info('[voice-thread]', 'attachment-url-resolve-failed', {
            attachmentId,
            conversationId,
            errorMessage: error instanceof Error ? error.message : String(error),
            messageId: attachmentMessageId,
          });
        }

        return null;
      } finally {
        setIsResolvingSignedUrl(false);
        resolveSignedUrlPromiseRef.current = null;
      }
    })();

    resolveSignedUrlPromiseRef.current = promise;
    return promise;
  }, [
    attachment?.id,
    attachment?.messageId,
    canResolveSignedUrl,
    conversationId,
    effectiveSignedUrl,
  ]);

  useEffect(() => {
    if (
      !canResolveSignedUrl ||
      (voiceState !== 'unavailable' && voiceState !== 'processing')
    ) {
      return;
    }

    void resolveSignedUrl();
  }, [canResolveSignedUrl, resolveSignedUrl, voiceState]);

  const startPlayback = useCallback(
    async (signedUrlOverride?: string | null) => {
      const audio = audioRef.current;
      const nextSignedUrl = signedUrlOverride?.trim() || effectiveSignedUrl;

      if (!audio || !nextSignedUrl) {
        return false;
      }

      if (audio.getAttribute('src') !== nextSignedUrl) {
        audio.setAttribute('src', nextSignedUrl);
        audio.load();
      } else if (audio.readyState === 0) {
        audio.load();
      }

      setPlaybackFailed(false);
      setPlaybackState('buffering');
      claimActiveThreadVoicePlayback(messageId, audio);

      try {
        await audio.play();
        return true;
      } catch {
        releaseActiveThreadVoicePlayback(messageId, audio);
        setHasPendingPlaybackIntent(false);
        setPlaybackFailed(true);
        setPlaybackState('failed');
        return false;
      }
    },
    [effectiveSignedUrl, messageId],
  );

  useEffect(() => {
    if (
      process.env.NEXT_PUBLIC_CHAT_DEBUG_VOICE !== '1' ||
      typeof window === 'undefined'
    ) {
      return;
    }

    console.info('[voice-thread]', 'render-state', {
      attachmentId: attachment?.id ?? null,
      attachmentMessageId: attachment?.messageId ?? null,
      canResolveSignedUrl,
      conversationId,
      hasSignedUrl: Boolean(effectiveSignedUrl),
      isOwnMessage,
      messageId,
      renderReason: voiceRenderReason,
      renderState: voiceState,
      storageLocatorPresent: Boolean(
        attachment?.bucket && attachment?.objectPath,
      ),
    });
  }, [
    attachment?.bucket,
    attachment?.id,
    attachment?.messageId,
    attachment?.objectPath,
    canResolveSignedUrl,
    conversationId,
    effectiveSignedUrl,
    isOwnMessage,
    messageId,
    voiceRenderReason,
    voiceState,
  ]);

  useEffect(() => {
    if (!effectiveSignedUrl) {
      const audio = audioRef.current;

      if (audio) {
        audio.pause();
        releaseActiveThreadVoicePlayback(messageId, audio);
        audio.src = '';
      }

      setProgressMs(0);
      setPlaybackState((current) => (current === 'failed' ? current : 'idle'));
      return;
    }

    setPlaybackState((current) =>
      current === 'failed' || current === 'buffering' ? current : 'idle',
    );
  }, [effectiveSignedUrl, messageId]);

  useEffect(() => {
    if (!hasPendingPlaybackIntent) {
      return;
    }

    if (playbackState === 'buffering' || playbackState === 'playing') {
      return;
    }

    if (!effectiveSignedUrl) {
      if (canResolveSignedUrl && !isResolvingSignedUrl) {
        void resolveSignedUrl();
        return;
      }

      if (!canResolveSignedUrl && voiceState !== 'processing') {
        setHasPendingPlaybackIntent(false);
      }

      return;
    }

    void startPlayback(effectiveSignedUrl);
  }, [
    canResolveSignedUrl,
    effectiveSignedUrl,
    hasPendingPlaybackIntent,
    isResolvingSignedUrl,
    playbackState,
    resolveSignedUrl,
    startPlayback,
    voiceState,
  ]);

  const togglePlayback = async () => {
    if (voiceState !== 'ready') {
      if (canResolveSignedUrl) {
        setHasPendingPlaybackIntent(true);
        if (!isResolvingSignedUrl) {
          void resolveSignedUrl();
        }
      }
      return;
    }

    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    if (audio.paused) {
      setHasPendingPlaybackIntent(true);
      await startPlayback();
      return;
    }

    setHasPendingPlaybackIntent(false);
    audio.pause();
  };

  const playButtonLabel =
    voiceState !== 'ready'
      ? stateLabel
      : isPreparingPlayback || isBuffering
        ? t.chat.voiceMessageLoading
        : isPlaying
        ? t.chat.voiceMessagePause
        : t.chat.voiceMessagePlay;

  return (
    <div
      className={
        isOwnMessage
          ? 'message-voice-card message-voice-card-own'
          : 'message-voice-card'
      }
      data-playback-state={voiceState === 'ready' ? playbackState : voiceState}
      data-play-intent={hasPendingPlaybackIntent ? 'pending' : 'idle'}
      data-voice-state={voiceState}
    >
      <button
        aria-label={playButtonLabel}
        className="message-voice-play"
        disabled={voiceState !== 'ready' && !canResolveSignedUrl}
        onClick={() => {
          void togglePlayback();
        }}
        type="button"
      >
        <span
          aria-hidden="true"
          className={`message-voice-play-icon message-voice-play-icon-${playIconState}`}
        >
          {playIconState === 'error' ? '!' : null}
        </span>
      </button>
      <div className="message-voice-copy">
        <div className="message-voice-head">
          <span className="message-voice-title">{t.chat.voiceMessage}</span>
          <span className="message-voice-duration">{durationLabel}</span>
        </div>
        <div className="message-voice-progress" aria-hidden="true">
          <span
            className={
              isBuffering
                ? 'message-voice-progress-bar message-voice-progress-bar-loading'
                : 'message-voice-progress-bar'
            }
            style={
              isBuffering ? undefined : { transform: `scaleX(${progressRatio})` }
            }
          />
        </div>
        {voiceState !== 'ready' ? (
          <div className="message-voice-meta">
            <span className="message-voice-state">{stateLabel}</span>
            {stateNote ? (
              <span className="message-voice-note">{stateNote}</span>
            ) : null}
          </div>
        ) : null}
      </div>
      {effectiveSignedUrl || hasRecoverableAttachmentLocator ? (
        <audio
          ref={audioRef}
          className="message-voice-audio"
          onEnded={(event) => {
            releaseActiveThreadVoicePlayback(messageId, event.currentTarget);
            event.currentTarget.currentTime = 0;
            setProgressMs(0);
            setHasPendingPlaybackIntent(false);
            setPlaybackState('ended');
          }}
          onError={(event) => {
            releaseActiveThreadVoicePlayback(messageId, event.currentTarget);
            event.currentTarget.pause();
            event.currentTarget.currentTime = 0;
            setProgressMs(0);

            if (effectiveSignedUrl && hasRecoverableAttachmentLocator) {
              setIgnoredAttachmentSignedUrl(effectiveSignedUrl);
              setDidFailSignedUrlResolve(false);
              setResolvedSignedUrl(null);
              setPlaybackFailed(false);
              setPlaybackState('idle');
              return;
            }

            setHasPendingPlaybackIntent(false);
            setPlaybackFailed(true);
            setPlaybackState('failed');
          }}
          onLoadedMetadata={(event) => {
            const nextDurationMs =
              Number.isFinite(event.currentTarget.duration) &&
              event.currentTarget.duration > 0
                ? event.currentTarget.duration * 1000
                : null;

            if (nextDurationMs !== null) {
              setResolvedDurationMs(nextDurationMs);
            }
          }}
          onLoadStart={() => {
            setPlaybackState((current) =>
              current === 'playing' ? current : 'buffering',
            );
          }}
          onPause={(event) => {
            releaseActiveThreadVoicePlayback(messageId, event.currentTarget);
            setHasPendingPlaybackIntent(false);

            if (event.currentTarget.ended) {
              return;
            }

            setPlaybackState(event.currentTarget.currentTime > 0 ? 'paused' : 'idle');
          }}
          onPlaying={(event) => {
            claimActiveThreadVoicePlayback(messageId, event.currentTarget);
            setHasPendingPlaybackIntent(false);
            setPlaybackFailed(false);
            setPlaybackState('playing');
          }}
          onTimeUpdate={(event) => {
            setProgressMs(event.currentTarget.currentTime * 1000);
          }}
          onWaiting={() => {
            setPlaybackState('buffering');
          }}
          preload="none"
          src={effectiveSignedUrl ?? undefined}
        />
      ) : null}
    </div>
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

function buildAttachmentSignedUrlResolveUrl(input: {
  attachmentId: string;
  conversationId: string;
  messageId: string;
}) {
  return `/api/messaging/conversations/${input.conversationId}/messages/${input.messageId}/attachments/${input.attachmentId}/signed-url`;
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
    messageIds,
    newerThanLatest: hasMessageIds ? false : Boolean(input.newerThanLatest),
    reason: input.reason?.trim() || null,
  } satisfies ThreadHistorySyncRequestState;
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

      if (message.kind !== 'text' || message.content_mode !== 'dm_e2ee_v1') {
        return [];
      }

      const historyHint = historyHintByMessageId.get(message.id);
      const hasReadableEnvelope =
        encryptedEnvelopeMessageIdSet.has(message.id) ||
        historyHint?.code === 'envelope-present';

      return hasReadableEnvelope ? [] : [message.id];
    },
  );

  return {
    missingRequestedMessageIds,
    presentRequestedMessageIds: Array.from(presentRequestedMessageIdSet),
  };
}

function buildTimelineItems(input: {
  language: AppLanguage;
  lastReadMessageSeq: number | null;
  messages: ConversationMessageRow[];
  t: ReturnType<typeof getTranslations>;
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
        label: formatDaySeparatorLabel(message.created_at, input.language, input.t),
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
        label: input.t.chat.unreadMessages,
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

function createThreadHistoryState(
  snapshot: ThreadHistoryPageSnapshot,
): ThreadHistoryState {
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
    messages: [...snapshot.messages],
    messagesById: new Map(
      snapshot.messages.map((message) => [message.id, message] as const),
    ),
    oldestLoadedSeq: resolveOldestLoadedSeq(
      snapshot.messages,
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
  const nextMessageIndexes = new Map(
    nextMessages.map((message, index) => [message.id, index] as const),
  );
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
    const existingIndex = nextMessageIndexes.get(message.id);
    nextMessagesById.set(message.id, message);

    if (existingIndex === undefined) {
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

    nextMessages[existingIndex] = message;
  }

  const mergedMessages =
    input.mode === 'prepend-older'
      ? [...prependedMessages, ...nextMessages]
      : appendedMessages.length > 0
        ? [...nextMessages, ...appendedMessages]
        : nextMessages;

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
      messages: mergedMessages,
      messagesById: nextMessagesById,
      oldestLoadedSeq: resolveOldestLoadedSeq(
        mergedMessages,
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
  const existingIndex = input.state.messages.findIndex(
    (message) => message.id === input.message.id,
  );
  const nextMessagesById = new Map(input.state.messagesById);
  nextMessagesById.set(input.message.id, input.message);

  if (existingIndex >= 0) {
    const nextMessages = [...input.state.messages];
    nextMessages[existingIndex] = input.message;

    return {
      ...input.state,
      messages: nextMessages,
      messagesById: nextMessagesById,
      oldestLoadedSeq: resolveOldestLoadedSeq(
        nextMessages,
        input.state.oldestLoadedSeq,
      ),
    } satisfies ThreadHistoryState;
  }

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

  return {
    ...input.state,
    messages: nextMessages,
    messagesById: nextMessagesById,
    oldestLoadedSeq: resolveOldestLoadedSeq(
      nextMessages,
      input.state.oldestLoadedSeq,
    ),
  } satisfies ThreadHistoryState;
}

function getEncryptedHistoryHintForMessage(input: {
  envelope: StoredDmE2eeEnvelope | null;
  hint: EncryptedDmServerHistoryHint | null;
  message: ConversationMessageRow;
}): EncryptedDmServerHistoryHint {
  if (input.envelope) {
    const baseHint: EncryptedDmServerHistoryHint =
      input.hint ?? {
        code: 'envelope-present',
        committedHistoryState: 'present',
        currentDeviceAvailability: 'envelope-present',
        recoveryDisposition: 'already-readable',
        activeDeviceRecordId: null,
        messageCreatedAt: input.message.created_at ?? null,
        viewerJoinedAt: null,
      };

    return {
      ...baseHint,
      code: 'envelope-present',
      currentDeviceAvailability: 'envelope-present',
      recoveryDisposition: 'already-readable',
    };
  }

  return (
    input.hint ?? {
      code: 'missing-envelope',
      committedHistoryState: 'present',
      currentDeviceAvailability: 'missing-envelope',
      recoveryDisposition: 'not-supported-v1',
      activeDeviceRecordId: null,
      messageCreatedAt: input.message.created_at ?? null,
      viewerJoinedAt: null,
    }
  );
}

function getUnavailableEncryptedHistoryRunKey(input: {
  encryptedEnvelopesByMessage: Map<string, StoredDmE2eeEnvelope>;
  encryptedHistoryHintsByMessage: Map<string, EncryptedDmServerHistoryHint>;
  message: ConversationMessageRow | null;
}) {
  if (!input.message || !isEncryptedDmTextMessage(input.message)) {
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

type ThreadMessageRowProps = {
  activeDeleteMessageId: string | null;
  activeEditMessageId: string | null;
  activeSpaceId: string;
  attachmentsByMessage: Map<string, MessageAttachment[]>;
  conversationId: string;
  conversationKind: 'dm' | 'group';
  currentUserId: string;
  compactHistoricalUnavailable: boolean;
  encryptedEnvelopesByMessage: Map<string, StoredDmE2eeEnvelope>;
  encryptedHistoryHintsByMessage: Map<string, EncryptedDmServerHistoryHint>;
  historicalUnavailableContinuationCount: number;
  isClusteredWithNext: boolean;
  isClusteredWithPrevious: boolean;
  language: AppLanguage;
  latestVisibleMessageSeq: number | null;
  message: ConversationMessageRow;
  messagesById: Map<string, ConversationMessageRow>;
  onOpenImagePreview: (preview: ActiveImagePreview) => void;
  otherParticipantReadSeq: number | null;
  otherParticipantUserId: string | null;
  reactionsByMessage: Map<string, MessageReactionGroup[]>;
  senderNames: Map<string, string>;
  threadClientDiagnostics: DmThreadClientDiagnostics;
};

function areConversationMessagesEqual(
  left: ConversationMessageRow | null,
  right: ConversationMessageRow | null,
) {
  if (left === right) {
    return true;
  }

  if (!left || !right) {
    return left === right;
  }

  return (
    left.id === right.id &&
    left.body === right.body &&
    left.client_id === right.client_id &&
    left.content_mode === right.content_mode &&
    left.conversation_id === right.conversation_id &&
    left.created_at === right.created_at &&
    left.deleted_at === right.deleted_at &&
    left.edited_at === right.edited_at &&
    left.kind === right.kind &&
    left.reply_to_message_id === right.reply_to_message_id &&
    left.sender_device_id === right.sender_device_id &&
    left.sender_id === right.sender_id &&
    left.seq === right.seq
  );
}

function areMessageAttachmentsEqual(
  left: MessageAttachment[],
  right: MessageAttachment[],
) {
  if (left === right) {
    return true;
  }

  if (left.length !== right.length) {
    return false;
  }

  return left.every((attachment, index) => {
    const nextAttachment = right[index];

    return (
      attachment.id === nextAttachment?.id &&
      attachment.fileName === nextAttachment.fileName &&
      attachment.signedUrl === nextAttachment.signedUrl &&
      attachment.sizeBytes === nextAttachment.sizeBytes &&
      attachment.durationMs === nextAttachment.durationMs &&
      attachment.isAudio === nextAttachment.isAudio &&
      attachment.isImage === nextAttachment.isImage &&
      attachment.isVoiceMessage === nextAttachment.isVoiceMessage &&
      attachment.bucket === nextAttachment.bucket &&
      attachment.objectPath === nextAttachment.objectPath &&
      attachment.messageId === nextAttachment.messageId &&
      attachment.createdAt === nextAttachment.createdAt
    );
  });
}

function areMessageReactionGroupsEqual(
  left: MessageReactionGroup[],
  right: MessageReactionGroup[],
) {
  if (left === right) {
    return true;
  }

  if (left.length !== right.length) {
    return false;
  }

  return left.every((reaction, index) => {
    const nextReaction = right[index];

    return (
      reaction.emoji === nextReaction?.emoji &&
      reaction.count === nextReaction.count &&
      reaction.selectedByCurrentUser === nextReaction.selectedByCurrentUser
    );
  });
}

function areStoredDmE2eeEnvelopesEqual(
  left: StoredDmE2eeEnvelope | null,
  right: StoredDmE2eeEnvelope | null,
) {
  if (left === right) {
    return true;
  }

  if (!left || !right) {
    return left === right;
  }

  return (
    left.messageId === right.messageId &&
    left.senderDeviceRecordId === right.senderDeviceRecordId &&
    left.recipientDeviceRecordId === right.recipientDeviceRecordId &&
    left.envelopeType === right.envelopeType &&
    left.ciphertext === right.ciphertext &&
    left.usedOneTimePrekeyId === right.usedOneTimePrekeyId &&
    left.createdAt === right.createdAt
  );
}

function areEncryptedHistoryHintsEqual(
  left: EncryptedDmServerHistoryHint | null,
  right: EncryptedDmServerHistoryHint | null,
) {
  if (left === right) {
    return true;
  }

  if (!left || !right) {
    return left === right;
  }

  return (
    left.code === right.code &&
    left.committedHistoryState === right.committedHistoryState &&
    left.currentDeviceAvailability === right.currentDeviceAvailability &&
    left.recoveryDisposition === right.recoveryDisposition &&
    left.activeDeviceRecordId === right.activeDeviceRecordId &&
    left.messageCreatedAt === right.messageCreatedAt &&
    left.viewerJoinedAt === right.viewerJoinedAt
  );
}

function areThreadClientDiagnosticsEqual(
  left: DmThreadClientDiagnostics,
  right: DmThreadClientDiagnostics,
) {
  return (
    left.debugRequestId === right.debugRequestId &&
    left.deploymentId === right.deploymentId &&
    left.gitCommitSha === right.gitCommitSha &&
    left.vercelUrl === right.vercelUrl
  );
}

function getReplyTargetMessage(
  message: ConversationMessageRow,
  messagesById: Map<string, ConversationMessageRow>,
) {
  return message.reply_to_message_id
    ? messagesById.get(message.reply_to_message_id) ?? null
    : null;
}

function getReplyTargetSenderLabel(
  repliedMessage: ConversationMessageRow | null,
  senderNames: Map<string, string>,
) {
  if (!repliedMessage?.sender_id) {
    return null;
  }

  return senderNames.get(repliedMessage.sender_id) ?? null;
}

function areThreadMessageRowPropsEqual(
  previousProps: ThreadMessageRowProps,
  nextProps: ThreadMessageRowProps,
) {
  if (
    previousProps.activeDeleteMessageId !== nextProps.activeDeleteMessageId ||
    previousProps.activeEditMessageId !== nextProps.activeEditMessageId ||
    previousProps.activeSpaceId !== nextProps.activeSpaceId ||
    previousProps.compactHistoricalUnavailable !==
      nextProps.compactHistoricalUnavailable ||
    previousProps.conversationId !== nextProps.conversationId ||
    previousProps.conversationKind !== nextProps.conversationKind ||
    previousProps.currentUserId !== nextProps.currentUserId ||
    previousProps.historicalUnavailableContinuationCount !==
      nextProps.historicalUnavailableContinuationCount ||
    previousProps.isClusteredWithNext !== nextProps.isClusteredWithNext ||
    previousProps.isClusteredWithPrevious !==
      nextProps.isClusteredWithPrevious ||
    previousProps.language !== nextProps.language ||
    previousProps.latestVisibleMessageSeq !== nextProps.latestVisibleMessageSeq ||
    previousProps.onOpenImagePreview !== nextProps.onOpenImagePreview ||
    previousProps.otherParticipantReadSeq !== nextProps.otherParticipantReadSeq ||
    previousProps.otherParticipantUserId !== nextProps.otherParticipantUserId ||
    !areThreadClientDiagnosticsEqual(
      previousProps.threadClientDiagnostics,
      nextProps.threadClientDiagnostics,
    )
  ) {
    return false;
  }

  if (!areConversationMessagesEqual(previousProps.message, nextProps.message)) {
    return false;
  }

  const previousAttachments =
    previousProps.attachmentsByMessage.get(previousProps.message.id) ??
    EMPTY_MESSAGE_ATTACHMENTS;
  const nextAttachments =
    nextProps.attachmentsByMessage.get(nextProps.message.id) ??
    EMPTY_MESSAGE_ATTACHMENTS;

  if (!areMessageAttachmentsEqual(previousAttachments, nextAttachments)) {
    return false;
  }

  const previousReactions =
    previousProps.reactionsByMessage.get(previousProps.message.id) ??
    EMPTY_MESSAGE_REACTIONS;
  const nextReactions =
    nextProps.reactionsByMessage.get(nextProps.message.id) ??
    EMPTY_MESSAGE_REACTIONS;

  if (!areMessageReactionGroupsEqual(previousReactions, nextReactions)) {
    return false;
  }

  const previousEnvelope =
    previousProps.encryptedEnvelopesByMessage.get(previousProps.message.id) ?? null;
  const nextEnvelope =
    nextProps.encryptedEnvelopesByMessage.get(nextProps.message.id) ?? null;

  if (!areStoredDmE2eeEnvelopesEqual(previousEnvelope, nextEnvelope)) {
    return false;
  }

  const previousHistoryHint =
    previousProps.encryptedHistoryHintsByMessage.get(previousProps.message.id) ??
    null;
  const nextHistoryHint =
    nextProps.encryptedHistoryHintsByMessage.get(nextProps.message.id) ?? null;

  if (!areEncryptedHistoryHintsEqual(previousHistoryHint, nextHistoryHint)) {
    return false;
  }

  const previousReplyTarget = getReplyTargetMessage(
    previousProps.message,
    previousProps.messagesById,
  );
  const nextReplyTarget = getReplyTargetMessage(
    nextProps.message,
    nextProps.messagesById,
  );

  if (!areConversationMessagesEqual(previousReplyTarget, nextReplyTarget)) {
    return false;
  }

  const previousReplyAttachments = previousReplyTarget
    ? previousProps.attachmentsByMessage.get(previousReplyTarget.id) ??
      EMPTY_MESSAGE_ATTACHMENTS
    : EMPTY_MESSAGE_ATTACHMENTS;
  const nextReplyAttachments = nextReplyTarget
    ? nextProps.attachmentsByMessage.get(nextReplyTarget.id) ??
      EMPTY_MESSAGE_ATTACHMENTS
    : EMPTY_MESSAGE_ATTACHMENTS;

  if (!areMessageAttachmentsEqual(previousReplyAttachments, nextReplyAttachments)) {
    return false;
  }

  return (
    getReplyTargetSenderLabel(previousReplyTarget, previousProps.senderNames) ===
    getReplyTargetSenderLabel(nextReplyTarget, nextProps.senderNames)
  );
}

function ThreadMessageRowComponent({
  activeDeleteMessageId,
  activeEditMessageId,
  activeSpaceId,
  attachmentsByMessage,
  compactHistoricalUnavailable,
  conversationId,
  conversationKind,
  currentUserId,
  encryptedEnvelopesByMessage,
  encryptedHistoryHintsByMessage,
  historicalUnavailableContinuationCount,
  isClusteredWithNext,
  isClusteredWithPrevious,
  language,
  latestVisibleMessageSeq,
  message,
  messagesById,
  onOpenImagePreview,
  otherParticipantReadSeq,
  otherParticipantUserId,
  reactionsByMessage,
  senderNames,
  threadClientDiagnostics,
}: ThreadMessageRowProps) {
  const t = getTranslations(language);
  const quickActionsContainerRef = useRef<HTMLDivElement | null>(null);
  const quickActionsSurfaceRef = useRef<HTMLDivElement | null>(null);
  const replyTargetHighlightTimeoutRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const longPressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressPointerRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
  } | null>(null);
  const [isQuickActionsOpen, setIsQuickActionsOpen] = useState(false);
  const [quickActionsPlacement, setQuickActionsPlacement] = useState<
    'above' | 'below'
  >('above');
  const isOwnMessage = message.sender_id === currentUserId;
  const patchedBody = useThreadMessagePatchedBody(
    conversationId,
    message.id,
    message.body,
  );
  const patchedDeletedAt = useThreadMessagePatchedDeletedAt(
    conversationId,
    message.id,
    message.deleted_at,
  );
  const isDeletedMessage = Boolean(patchedDeletedAt);
  const normalizedMessageBody = normalizeMessageBodyText(patchedBody);
  const isMessageInEditMode =
    activeEditMessageId === message.id &&
    isOwnMessage &&
    !isDeletedMessage &&
    !isEncryptedDmTextMessage(message);
  const isMessageInDeleteMode =
    activeDeleteMessageId === message.id && isOwnMessage && !isDeletedMessage;
  const messageAttachments =
    attachmentsByMessage.get(message.id) ?? EMPTY_MESSAGE_ATTACHMENTS;
  const primaryVoiceAttachment =
    message.kind === 'voice'
      ? messageAttachments.find((attachment) => attachment.isVoiceMessage) ??
        messageAttachments.find((attachment) => attachment.isAudio) ??
        null
      : null;
  const nonVoiceAttachments =
    primaryVoiceAttachment === null
      ? messageAttachments
      : messageAttachments.filter(
          (attachment) => attachment.id !== primaryVoiceAttachment.id,
        );
  const encryptedEnvelope =
    encryptedEnvelopesByMessage.get(message.id) ?? null;
  const encryptedHistoryHint = getEncryptedHistoryHintForMessage({
    envelope: encryptedEnvelope,
    hint: encryptedHistoryHintsByMessage.get(message.id) ?? null,
    message,
  });
  const isUnavailableHistoricalEncryptedHint =
    encryptedHistoryHint.code !== 'envelope-present';
  const encryptedHistoryFallbackAccessState =
    encryptedHistoryHint.code === 'policy-blocked-history'
      ? 'policy-blocked'
      : 'history-unavailable-on-this-device';
  const encryptedHistoryFallbackNote =
    encryptedHistoryHint.code === 'policy-blocked-history'
      ? t.chat.encryptedHistoryPolicyBlockedNote
      : t.chat.encryptedHistoryUnavailableNote;
  const shouldRenderCompactHistoricalUnavailableBubble =
    compactHistoricalUnavailable && isUnavailableHistoricalEncryptedHint;
  const canAttemptEncryptedRender = canRenderEncryptedDmBody({
    clientId: message.client_id,
  });
  const messageSeq = getMessageSeq(message.seq);
  const outgoingMessageStatus = getOutgoingMessageStatus({
    isDeletedMessage,
    isOwnMessage,
    messageSeq: message.seq,
    otherParticipantReadSeq:
      conversationKind === 'dm' ? otherParticipantReadSeq : null,
  });
  const isLatestConversationMessage =
    latestVisibleMessageSeq !== null &&
    Number.isFinite(messageSeq) &&
    messageSeq === latestVisibleMessageSeq;
  const repliedMessage = message.reply_to_message_id
    ? messagesById.get(message.reply_to_message_id) ?? null
    : null;
  const repliedMessageAttachments = repliedMessage
    ? attachmentsByMessage.get(repliedMessage.id) ?? EMPTY_MESSAGE_ATTACHMENTS
    : EMPTY_MESSAGE_ATTACHMENTS;
  const replyTargetAttachmentKind = resolveReplyTargetAttachmentKind(
    repliedMessageAttachments,
  );
  const encryptedRenderBranch = normalizeEncryptedDmBranchLabel(isOwnMessage);
  const canShowQuickActions =
    !isDeletedMessage &&
    !isMessageInEditMode &&
    !isMessageInDeleteMode;
  const replyActionHref = buildChatHref({
    conversationId,
    hash: '#message-composer',
    replyToMessageId: message.id,
    spaceId: activeSpaceId,
  });

  const clearLongPress = useCallback(() => {
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }

    longPressPointerRef.current = null;
  }, []);

  const closeQuickActions = useCallback(() => {
    setIsQuickActionsOpen(false);
  }, []);

  useEffect(() => {
    if (canShowQuickActions) {
      return;
    }

    clearLongPress();
    const timeoutId = window.setTimeout(() => {
      setIsQuickActionsOpen(false);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [canShowQuickActions, clearLongPress]);

  useEffect(() => {
    if (!isQuickActionsOpen) {
      return;
    }

    const handlePointerDownOutside = (event: PointerEvent) => {
      const nextTarget = event.target;

      if (
        quickActionsContainerRef.current &&
        nextTarget instanceof Node &&
        quickActionsContainerRef.current.contains(nextTarget)
      ) {
        return;
      }

      setIsQuickActionsOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsQuickActionsOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDownOutside, true);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDownOutside, true);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isQuickActionsOpen]);

  useLayoutEffect(() => {
    if (!isQuickActionsOpen) {
      return;
    }

    const updatePlacement = () => {
      const containerRect =
        quickActionsContainerRef.current?.getBoundingClientRect() ?? null;
      const surfaceRect =
        quickActionsSurfaceRef.current?.getBoundingClientRect() ?? null;

      if (!containerRect || !surfaceRect) {
        return;
      }

      const viewportHeight = window.innerHeight;
      const safeGap = 14;
      const availableAbove = containerRect.top - safeGap;
      const availableBelow = viewportHeight - containerRect.bottom - safeGap;
      const preferredHeight = surfaceRect.height;

      const nextPlacement =
        availableAbove >= preferredHeight
          ? 'above'
          : availableBelow >= preferredHeight
            ? 'below'
            : availableAbove >= availableBelow
              ? 'above'
              : 'below';

      setQuickActionsPlacement((currentPlacement) =>
        currentPlacement === nextPlacement ? currentPlacement : nextPlacement,
      );
    };

    updatePlacement();

    window.addEventListener('resize', updatePlacement);

    return () => {
      window.removeEventListener('resize', updatePlacement);
    };
  }, [isQuickActionsOpen]);

  useEffect(() => {
    return () => {
      clearLongPress();
      if (replyTargetHighlightTimeoutRef.current) {
        clearTimeout(replyTargetHighlightTimeoutRef.current);
      }
    };
  }, [clearLongPress]);

  const handleReplyReferenceClick = useCallback(() => {
    if (!message.reply_to_message_id) {
      return;
    }

    const target = document.getElementById(
      `message-${message.reply_to_message_id}`,
    );

    if (!(target instanceof HTMLElement)) {
      return;
    }

    target.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
    target.focus({
      preventScroll: true,
    });

    const existingHighlight = document.querySelector(
      '.message-card-reply-target-highlight',
    );

    if (existingHighlight instanceof HTMLElement && existingHighlight !== target) {
      existingHighlight.classList.remove('message-card-reply-target-highlight');
    }

    target.classList.add('message-card-reply-target-highlight');

    if (replyTargetHighlightTimeoutRef.current) {
      clearTimeout(replyTargetHighlightTimeoutRef.current);
    }

    replyTargetHighlightTimeoutRef.current = setTimeout(() => {
      target.classList.remove('message-card-reply-target-highlight');
      replyTargetHighlightTimeoutRef.current = null;
    }, 1300);
  }, [message.reply_to_message_id]);

  const handleBubblePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (
        !canShowQuickActions ||
        event.button !== 0 ||
        isMessageQuickActionInteractiveTarget(event.target)
      ) {
        return;
      }

      clearLongPress();
      longPressPointerRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
      };
      longPressTimeoutRef.current = setTimeout(() => {
        setIsQuickActionsOpen(true);
        longPressTimeoutRef.current = null;
      }, 280);
    },
    [canShowQuickActions, clearLongPress],
  );

  const handleBubblePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const activePointer = longPressPointerRef.current;

      if (!activePointer || activePointer.pointerId !== event.pointerId) {
        return;
      }

      if (
        Math.abs(event.clientX - activePointer.startX) > 10 ||
        Math.abs(event.clientY - activePointer.startY) > 10
      ) {
        clearLongPress();
      }
    },
    [clearLongPress],
  );

  const handleBubblePointerEnd = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const activePointer = longPressPointerRef.current;

      if (!activePointer || activePointer.pointerId !== event.pointerId) {
        return;
      }

      clearLongPress();
    },
    [clearLongPress],
  );

  const handleBubbleContextMenu = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (
        !canShowQuickActions ||
        isMessageQuickActionInteractiveTarget(event.target)
      ) {
        return;
      }

      event.preventDefault();
      clearLongPress();
      setIsQuickActionsOpen(true);
    },
    [canShowQuickActions, clearLongPress],
  );

  const canInlineMessageMeta =
    Boolean(normalizedMessageBody) &&
    !message.reply_to_message_id &&
    !isDeletedMessage &&
    !primaryVoiceAttachment &&
    nonVoiceAttachments.length === 0 &&
    !isEncryptedDmTextMessage(message);
  const messageTimestampLabel =
    formatMessageTimestamp(message.created_at, language, t) || t.chat.justNow;
  const messageMetaContent = (
    <>
      <span>{messageTimestampLabel}</span>
      <ThreadEditedIndicator
        conversationId={conversationId}
        editedAt={message.edited_at}
        label={t.chat.edited}
        messageId={message.id}
      />
      {isOwnMessage && outgoingMessageStatus ? (
        otherParticipantUserId ? (
          <DmThreadClientSubtree
            conversationId={conversationId}
            {...threadClientDiagnostics}
            fallback={
              <MessageStatusIndicator
                label={t.chat.sent}
                status="sent"
              />
            }
            messageId={message.id}
            surface="live-outgoing-message-status"
          >
            <LiveOutgoingMessageStatus
              conversationId={conversationId}
              labels={{
                delivered: t.chat.delivered,
                seen: t.chat.seen,
                sent: t.chat.sent,
              }}
              messageSeq={message.seq}
              otherParticipantReadSeq={otherParticipantReadSeq}
              status={outgoingMessageStatus}
            />
          </DmThreadClientSubtree>
        ) : (
          <MessageStatusIndicator
            label={
              outgoingMessageStatus === 'seen'
                ? t.chat.seen
                : t.chat.sent
            }
            status={outgoingMessageStatus}
          />
        )
      ) : null}
    </>
  );

  if (isEncryptedDmTextMessage(message)) {
    const encryptedInputIssues = getEncryptedDmServerRenderInputIssues({
      envelope: encryptedEnvelope,
      historyHint: encryptedHistoryHint,
      message,
    });

    logEncryptedDmServerRenderDiagnostics('encrypted-dm:server-input', {
      bodyType: message.body === null ? 'null' : typeof message.body,
      canAttemptEncryptedRender,
      clientIdPresent:
        typeof message.client_id === 'string' && message.client_id.trim().length > 0,
      contentMode: message.content_mode ?? null,
      conversationId,
      currentDeviceAvailability: encryptedHistoryHint.currentDeviceAvailability,
      envelopeCiphertextPresent: Boolean(encryptedEnvelope?.ciphertext?.trim()),
      envelopeLookupResult: encryptedEnvelope ? 'present' : 'missing',
      envelopeRecipientDeviceRecordId:
        encryptedEnvelope?.recipientDeviceRecordId ?? null,
      envelopeSenderDeviceRecordId:
        encryptedEnvelope?.senderDeviceRecordId ?? null,
      hasReplyTargetLoaded: Boolean(repliedMessage),
      historyHintCode: encryptedHistoryHint.code,
      isUnavailableHistoricalEncryptedHint,
      messageId: message.id,
      messageKind: message.kind,
      messageSenderId: message.sender_id ?? null,
      reactionGroupCount: reactionsByMessage.get(message.id)?.length ?? 0,
      renderBranch: encryptedRenderBranch,
      renderInputIssues: encryptedInputIssues,
      senderDeviceIdPresent:
        typeof message.sender_device_id === 'string' &&
        message.sender_device_id.trim().length > 0,
    });

    if (encryptedInputIssues.length > 0) {
      throw new Error(
        `[encrypted-dm-server-render] malformed input for message ${message.id}: ${encryptedInputIssues.join(', ')}`,
      );
    }
  }

  if (isEncryptedDmTextMessage(message) && !canAttemptEncryptedRender) {
    logEncryptedDmRenderFallback({
      clientId: message.client_id,
      conversationId,
      diagnosticHintCode: encryptedHistoryHint.code,
      envelopePresent: Boolean(encryptedEnvelope),
      messageId: message.id,
    });
  }

  return (
    <article
      className={[
        isOwnMessage ? 'message-row message-row-own' : 'message-row',
        isClusteredWithPrevious
          ? 'message-row-clustered-with-previous'
          : null,
        isClusteredWithNext ? 'message-row-clustered-with-next' : null,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div
        className={[
          isDeletedMessage
            ? isOwnMessage
              ? 'message-card message-card-own message-card-deleted'
              : 'message-card message-card-deleted'
            : isOwnMessage
              ? 'message-card message-card-own'
              : 'message-card',
          isClusteredWithPrevious
            ? 'message-card-clustered-with-previous'
            : null,
          isClusteredWithNext ? 'message-card-clustered-with-next' : null,
        ]
          .filter(Boolean)
          .join(' ')}
        id={`message-${message.id}`}
        tabIndex={-1}
      >
        <div
          ref={quickActionsContainerRef}
          className={
            isOwnMessage
              ? 'message-bubble-shell message-bubble-shell-own'
              : 'message-bubble-shell'
          }
          onContextMenu={handleBubbleContextMenu}
          onPointerCancel={handleBubblePointerEnd}
          onPointerDown={handleBubblePointerDown}
          onPointerLeave={handleBubblePointerEnd}
          onPointerMove={handleBubblePointerMove}
          onPointerUp={handleBubblePointerEnd}
        >
          {isQuickActionsOpen ? (
            <div
              ref={quickActionsSurfaceRef}
              className={
                isOwnMessage
                  ? 'message-quick-actions message-quick-actions-own'
                  : 'message-quick-actions'
              }
              data-placement={quickActionsPlacement}
              data-message-quick-actions-surface="true"
            >
              <div className="message-quick-actions-primary">
                <ThreadReactionPicker
                  className="message-quick-actions-reactions"
                  conversationId={conversationId}
                  currentUserId={currentUserId}
                  emojis={MESSAGE_QUICK_REACTIONS}
                  initialReactions={
                    reactionsByMessage.get(message.id) ?? EMPTY_MESSAGE_REACTIONS
                  }
                  isOwnMessage={isOwnMessage}
                  messageId={message.id}
                  onReactionSelected={closeQuickActions}
                  showCounts={false}
                />
              </div>
              <div className="message-quick-actions-secondary">
                <Link
                  aria-label={t.chat.reply}
                  className="message-quick-actions-action"
                  href={replyActionHref}
                  onClick={closeQuickActions}
                  prefetch={false}
                  title={t.chat.reply}
                >
                  <span
                    aria-hidden="true"
                    className="message-quick-actions-action-icon"
                  >
                    ↩
                  </span>
                  <span className="message-quick-actions-action-label">
                    {t.chat.reply}
                  </span>
                </Link>
              </div>
            </div>
          ) : null}
          <div
            className={
              message.reply_to_message_id && !isDeletedMessage
                ? isOwnMessage
                  ? [
                      'message-bubble',
                      'message-bubble-own',
                      'message-bubble-with-reply',
                      shouldRenderCompactHistoricalUnavailableBubble
                        ? 'message-bubble-encrypted-history-continuation'
                        : null,
                      isClusteredWithPrevious
                        ? 'message-bubble-clustered-with-previous'
                        : null,
                      isClusteredWithNext
                        ? 'message-bubble-clustered-with-next'
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' ')
                  : [
                      'message-bubble',
                      'message-bubble-with-reply',
                      shouldRenderCompactHistoricalUnavailableBubble
                        ? 'message-bubble-encrypted-history-continuation'
                        : null,
                      isClusteredWithPrevious
                        ? 'message-bubble-clustered-with-previous'
                        : null,
                      isClusteredWithNext
                        ? 'message-bubble-clustered-with-next'
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' ')
                : isOwnMessage
                  ? [
                      'message-bubble',
                      'message-bubble-own',
                      shouldRenderCompactHistoricalUnavailableBubble
                        ? 'message-bubble-encrypted-history-continuation'
                        : null,
                      isClusteredWithPrevious
                        ? 'message-bubble-clustered-with-previous'
                        : null,
                      isClusteredWithNext
                        ? 'message-bubble-clustered-with-next'
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' ')
                  : [
                      'message-bubble',
                      shouldRenderCompactHistoricalUnavailableBubble
                        ? 'message-bubble-encrypted-history-continuation'
                        : null,
                      isClusteredWithPrevious
                        ? 'message-bubble-clustered-with-previous'
                        : null,
                      isClusteredWithNext
                        ? 'message-bubble-clustered-with-next'
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' ')
            }
          >
          {message.reply_to_message_id && !isDeletedMessage ? (
            <button
              className={
                isOwnMessage
                  ? 'message-reply-reference message-reply-reference-own message-reply-reference-button'
                  : 'message-reply-reference message-reply-reference-button'
              }
              disabled={!repliedMessage}
              onClick={handleReplyReferenceClick}
              type="button"
            >
              <span aria-hidden="true" className="message-reply-accent" />
              <div className="message-reply-copy">
                <span className="message-reply-sender">
                  {!repliedMessage
                    ? t.chat.earlierMessage
                    : repliedMessage.deleted_at
                      ? t.chat.deletedMessage
                      : senderNames.get(repliedMessage.sender_id ?? '') ||
                        t.chat.unknownUser}
                </span>
                <DmReplyTargetSnippet
                  body={repliedMessage?.body ?? null}
                  conversationId={conversationId}
                  currentUserId={currentUserId}
                  debugRequestId={threadClientDiagnostics.debugRequestId}
                  attachmentFallbackLabel={t.chat.attachment}
                  audioFallbackLabel={t.chat.audio}
                  deletedFallbackLabel={t.chat.messageDeleted}
                  emptyFallbackLabel={t.chat.emptyMessage}
                  encryptedFallbackLabel={t.chat.replyToEncryptedMessage}
                  fileFallbackLabel={t.chat.file}
                  historicalEncryptedFallbackLabel={t.chat.olderEncryptedMessage}
                  encryptedReferenceNote={null}
                  loadedFallbackLabel={t.chat.earlierMessage}
                  messageId={message.id}
                  photoFallbackLabel={t.chat.photo}
                  surface="message-reply-reference"
                  targetAttachmentKind={replyTargetAttachmentKind}
                  targetDeleted={Boolean(repliedMessage?.deleted_at)}
                  targetIsEncrypted={Boolean(
                    repliedMessage && isEncryptedDmTextMessage(repliedMessage),
                  )}
                  targetIsLoaded={Boolean(repliedMessage)}
                  targetKind={repliedMessage?.kind ?? null}
                  targetMessageId={message.reply_to_message_id}
                  voiceFallbackLabel={t.chat.voiceMessage}
                />
              </div>
            </button>
          ) : null}
          {isDeletedMessage ? (
            <p className="message-deleted-text">{t.chat.messageDeleted}</p>
          ) : isMessageInEditMode ? (
            <ThreadInlineEditForm
              cancelHref={buildChatHref({
                conversationId,
                hash: `#message-${message.id}`,
                spaceId: activeSpaceId,
              })}
              conversationId={conversationId}
              emptyMessageLabel={t.chat.emptyMessage}
              hasAttachments={messageAttachments.length > 0}
              initialBody={
                isEncryptedDmTextMessage(message)
                  ? ''
                  : normalizedMessageBody ?? ''
              }
              labels={{
                cancel: t.chat.cancel,
                save: t.chat.save,
              }}
              messageId={message.id}
            />
          ) : activeEditMessageId === message.id &&
            isOwnMessage &&
            isEncryptedDmTextMessage(message) ? (
            <div className="message-edit-unavailable">
              <p className="message-edit-unavailable-copy">
                {t.chat.encryptedEditUnavailable}
              </p>
              <div className="message-edit-actions">
                <Link
                  className="pill message-edit-cancel"
                  href={buildChatHref({
                    conversationId,
                    hash: `#message-${message.id}`,
                    spaceId: activeSpaceId,
                  })}
                  prefetch={false}
                >
                  {t.chat.cancel}
                </Link>
              </div>
            </div>
          ) : isEncryptedDmTextMessage(message) ? (
            canAttemptEncryptedRender ? (
              <DmThreadClientSubtree
                conversationId={conversationId}
                {...threadClientDiagnostics}
                fallback={
                  <EncryptedHistoryUnavailableState
                    accessState={
                      isUnavailableHistoricalEncryptedHint
                        ? encryptedHistoryFallbackAccessState
                        : 'temporary-local-read-failure'
                    }
                    compact={
                      compactHistoricalUnavailable &&
                      isUnavailableHistoricalEncryptedHint
                    }
                    continuationCount={
                      isUnavailableHistoricalEncryptedHint
                        ? historicalUnavailableContinuationCount
                        : 0
                    }
                    note={
                      isUnavailableHistoricalEncryptedHint
                        ? encryptedHistoryFallbackNote
                        : null
                    }
                    title={
                      isUnavailableHistoricalEncryptedHint
                        ? compactHistoricalUnavailable
                          ? t.chat.encryptedMessage
                          : t.chat.olderEncryptedMessage
                        : t.chat.encryptedMessageUnavailable
                    }
                  />
                }
                messageId={message.id}
                surface="encrypted-dm-message-body"
              >
                <EncryptedDmMessageBody
                  clientId={message.client_id}
                  compactHistoricalUnavailable={compactHistoricalUnavailable}
                  conversationId={conversationId}
                  currentUserId={currentUserId}
                  envelope={encryptedEnvelope}
                  fallbackLabel={t.chat.encryptedMessage}
                  historyDiagnosticHint={encryptedHistoryHint}
                  historicalUnavailableContinuationCount={
                    historicalUnavailableContinuationCount
                  }
                  olderHistoryLabel={t.chat.olderEncryptedMessage}
                  historyUnavailableNoteLabel={
                    t.chat.encryptedHistoryUnavailableNote
                  }
                  messageCreatedAt={message.created_at}
                  messageId={message.id}
                  messageSenderId={message.sender_id}
                  policyUnavailableNoteLabel={
                    t.chat.encryptedHistoryPolicyBlockedNote
                  }
                  retryLabel={t.chat.retryEncryptedAction}
                  setupUnavailableLabel={t.chat.encryptedMessageSetupUnavailable}
                  shouldCachePreview={
                    conversationKind === 'dm' && isLatestConversationMessage
                  }
                  unavailableLabel={t.chat.encryptedMessageUnavailable}
                />
              </DmThreadClientSubtree>
            ) : (
              <EncryptedHistoryUnavailableState
                accessState={
                  isUnavailableHistoricalEncryptedHint
                    ? encryptedHistoryFallbackAccessState
                    : 'temporary-local-read-failure'
                }
                compact={
                  compactHistoricalUnavailable &&
                  isUnavailableHistoricalEncryptedHint
                }
                continuationCount={
                  isUnavailableHistoricalEncryptedHint
                    ? historicalUnavailableContinuationCount
                    : 0
                }
                debugBucket={
                  process.env.NEXT_PUBLIC_CHAT_DEBUG_DM_E2EE_BOOTSTRAP === '1'
                    ? encryptedHistoryHint.code
                    : null
                }
                debugLabel={
                  process.env.NEXT_PUBLIC_CHAT_DEBUG_DM_E2EE_BOOTSTRAP === '1'
                    ? encryptedHistoryHint.code
                    : null
                }
                note={
                  isUnavailableHistoricalEncryptedHint
                    ? encryptedHistoryFallbackNote
                    : null
                }
                title={
                  isUnavailableHistoricalEncryptedHint
                    ? compactHistoricalUnavailable
                      ? t.chat.encryptedMessage
                      : t.chat.olderEncryptedMessage
                    : t.chat.encryptedMessageUnavailable
                }
              />
            )
          ) : message.kind === 'voice' ? (
            <div className="message-voice-stack">
              <ThreadVoiceMessageBubble
                attachment={primaryVoiceAttachment}
                conversationId={conversationId}
                isOwnMessage={isOwnMessage}
                key={`${primaryVoiceAttachment?.id ?? message.id}:${primaryVoiceAttachment?.signedUrl ?? 'none'}`}
                language={language}
                messageId={message.id}
              />
              {normalizedMessageBody ? (
                <p className="message-body">{normalizedMessageBody}</p>
              ) : null}
            </div>
          ) : normalizedMessageBody ? (
            canInlineMessageMeta ? (
              <div
                className={
                  isOwnMessage
                    ? 'message-inline-content message-inline-content-own'
                    : 'message-inline-content'
                }
              >
                <p className="message-body message-body-inline">
                  {normalizedMessageBody}
                </p>
                <span
                  className={
                    isOwnMessage
                      ? 'message-meta message-meta-own message-meta-inline'
                      : 'message-meta message-meta-inline'
                  }
                >
                  {messageMetaContent}
                </span>
              </div>
            ) : (
              <p className="message-body">{normalizedMessageBody}</p>
            )
          ) : !messageAttachments.length ? (
            <p className="message-body">{t.chat.emptyMessage}</p>
          ) : null}
          {nonVoiceAttachments.length && !isDeletedMessage ? (
            <div className="message-attachments">
              {nonVoiceAttachments.map((attachment) => {
                if (attachment.isImage) {
                  const photoMeta = [
                    formatAttachmentSize(attachment.sizeBytes),
                    !attachment.signedUrl ? t.chat.unavailableRightNow : null,
                  ]
                    .filter((value): value is string => Boolean(value))
                    .join(' · ');

                  if (!attachment.signedUrl) {
                    return (
                      <div
                        key={attachment.id}
                        className="message-photo-card message-photo-card-unavailable"
                      >
                        <span
                          aria-hidden="true"
                          className="message-photo-card-visual message-photo-card-visual-unavailable"
                        />
                        <span className="message-photo-card-footer">
                          <span className="message-photo-card-badge">
                            {t.chat.photo}
                          </span>
                          {photoMeta ? (
                            <span className="message-photo-card-meta">
                              {photoMeta}
                            </span>
                          ) : null}
                        </span>
                      </div>
                    );
                  }

                  return (
                    <a
                      key={attachment.id}
                      aria-label={
                        attachment.fileName.trim()
                          ? `${t.chat.photo}: ${attachment.fileName}`
                          : t.chat.photo
                      }
                      className="message-photo-card"
                      href={attachment.signedUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      <span
                        aria-hidden="true"
                        className="message-photo-card-visual"
                        style={{
                          backgroundImage: `url("${attachment.signedUrl}")`,
                        }}
                      />
                      <span className="message-photo-card-footer">
                        <span className="message-photo-card-badge">
                          {t.chat.photo}
                        </span>
                        {photoMeta ? (
                          <span className="message-photo-card-meta">
                            {photoMeta}
                          </span>
                        ) : null}
                      </span>
                    </a>
                  );
                }

                const attachmentLabel = attachment.isVoiceMessage
                  ? t.chat.voiceMessage
                  : attachment.isAudio
                    ? t.chat.audio
                    : t.chat.file;
                const attachmentMeta = [
                  formatAttachmentSize(attachment.sizeBytes),
                  !attachment.signedUrl ? t.chat.unavailableRightNow : null,
                ]
                  .filter((value): value is string => Boolean(value))
                  .join(' · ');
                const attachmentContent = (
                  <>
                    <span
                      aria-hidden="true"
                      className="message-attachment-file"
                    >
                      {attachment.isAudio ? t.chat.audio : t.chat.file}
                    </span>
                    <span className="message-attachment-copy">
                      <span className="message-attachment-head">
                        <span className="message-attachment-name">
                          {attachment.fileName}
                        </span>
                        <span className="message-attachment-kind">
                          {attachmentLabel}
                        </span>
                      </span>
                      {attachmentMeta ? (
                        <span className="message-attachment-meta">
                          {attachmentMeta}
                        </span>
                      ) : null}
                    </span>
                  </>
                );

                if (!attachment.signedUrl) {
                  return (
                    <div
                      key={attachment.id}
                      className="message-attachment-card message-attachment-card-unavailable"
                    >
                      {attachmentContent}
                    </div>
                  );
                }

                if (attachment.isAudio) {
                  return (
                    <div
                      key={attachment.id}
                      className="message-attachment-card message-attachment-card-audio"
                    >
                      {attachmentContent}
                      <audio
                        className="message-attachment-audio"
                        controls
                        preload="metadata"
                        src={attachment.signedUrl}
                      />
                    </div>
                  );
                }

                if (attachment.isImage) {
                  const previewTitle =
                    attachment.fileName.trim() || t.chat.photo;

                  return (
                    <button
                      key={attachment.id}
                      aria-haspopup="dialog"
                      aria-label={t.chat.openPhotoPreviewAria(previewTitle)}
                      className="message-attachment-card message-attachment-card-button"
                      onClick={() => {
                        onOpenImagePreview({
                          fileName: previewTitle,
                          signedUrl: attachment.signedUrl!,
                        });
                      }}
                      type="button"
                    >
                      {attachmentContent}
                    </button>
                  );
                }

                return (
                  <a
                    key={attachment.id}
                    className="message-attachment-card"
                    href={attachment.signedUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {attachmentContent}
                  </a>
                );
              })}
            </div>
          ) : null}
        </div>
        </div>
        {!canInlineMessageMeta ? (
          <span
            className={
              isOwnMessage
                ? 'message-meta message-meta-own'
                : 'message-meta'
            }
          >
            {messageMetaContent}
          </span>
        ) : null}

        {!isDeletedMessage ? (
          <ThreadReactionGroups
            ariaLabel={t.chat.messageReactions}
            conversationId={conversationId}
            currentUserId={currentUserId}
            initialReactions={
              reactionsByMessage.get(message.id) ?? EMPTY_MESSAGE_REACTIONS
            }
            isOwnMessage={isOwnMessage}
            messageId={message.id}
          />
        ) : null}
        {isMessageInDeleteMode ? (
          <ThreadDeleteMessageConfirm
            cancelHref={buildChatHref({
              conversationId,
              hash: `#message-${message.id}`,
              spaceId: activeSpaceId,
            })}
            conversationId={conversationId}
            labels={{
              cancel: t.chat.cancel,
              confirm: t.chat.delete,
              prompt: t.chat.deleteConfirm,
            }}
            messageId={message.id}
          />
        ) : null}
      </div>
    </article>
  );
}

const ThreadMessageRow = memo(
  ThreadMessageRowComponent,
  areThreadMessageRowPropsEqual,
);

ThreadMessageRow.displayName = 'ThreadMessageRow';

type ThreadImagePreviewOverlayProps = {
  closeLabel: string;
  fallbackTitle: string;
  onClose: () => void;
  preview: ActiveImagePreview | null;
};

function ThreadImagePreviewOverlay({
  closeLabel,
  fallbackTitle,
  onClose,
  preview,
}: ThreadImagePreviewOverlayProps) {
  const portalRoot = typeof document !== 'undefined' ? document.body : null;

  useEffect(() => {
    if (!preview) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, preview]);

  if (!preview || !portalRoot) {
    return null;
  }

  const previewTitle = preview.fileName.trim() || fallbackTitle;

  return createPortal(
    <div
      aria-label={previewTitle}
      aria-modal="true"
      className="chat-image-preview-overlay"
      data-state="open"
      onClick={onClose}
      role="dialog"
    >
      <div
        className="chat-image-preview-shell"
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <button
          aria-label={closeLabel}
          className="chat-image-preview-close"
          onClick={onClose}
          type="button"
        >
          <span aria-hidden="true">×</span>
        </button>

        <div className="chat-image-preview-stage">
          <figure className="chat-image-preview-frame">
            {/* Keep a plain img here so the authenticated attachment route stays cookie-backed. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt={previewTitle}
              className="chat-image-preview-image"
              src={preview.signedUrl}
            />
            <figcaption className="chat-image-preview-caption">
              {previewTitle}
            </figcaption>
          </figure>
        </div>
      </div>
    </div>,
    portalRoot,
  );
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
  const t = getTranslations(language);
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
  const voiceAttachmentRecoveryAttemptsRef = useRef(new Map<string, number>());
  const voiceAttachmentRecoveryTimeoutsRef = useRef(
    new Map<string, ReturnType<typeof setTimeout>>(),
  );
  const voiceReopenRecoveryRequestedRef = useRef(new Set<string>());
  const isSyncingRef = useRef(false);
  const historySyncDiagnosticsEnabled =
    typeof window !== 'undefined' &&
    process.env.NEXT_PUBLIC_CHAT_DEBUG_LIVE_REFRESH === '1';
  renderCountRef.current += 1;

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
    historyStateRef.current = historyState;
    writeThreadHistorySessionCache({
      cacheKey: activeSessionCacheKeyRef.current,
      state: historyState,
    });
  }, [historyState]);

  useEffect(() => {
    voiceReopenRecoveryRequestedRef.current.clear();
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
  const timelineItems = useMemo(
    () =>
      buildTimelineItems({
        language,
        lastReadMessageSeq: currentReadMessageSeq,
        messages: historyState.messages,
        t,
      }),
    [currentReadMessageSeq, historyState.messages, language, t],
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
            .map((message) => message.client_id?.trim() || '')
            .filter(Boolean),
        ),
      ),
    [historyState.messages],
  );
  const historyMessageIds = useMemo(
    () => historyState.messages.map((message) => message.id),
    [historyState.messages],
  );
  const recoverableEncryptedHistoryMessageIds = useMemo(
    () =>
      historyState.messages.flatMap((message) => {
        if (message.kind !== 'text' || message.content_mode !== 'dm_e2ee_v1') {
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

  useEffect(() => {
    const requestedRecoveries = voiceReopenRecoveryRequestedRef.current;
    const activeRecoveryIds = new Set(recentVoiceMessageIdsNeedingRecovery);

    for (const messageId of Array.from(requestedRecoveries)) {
      if (!activeRecoveryIds.has(messageId)) {
        requestedRecoveries.delete(messageId);
      }
    }

    for (const messageId of recentVoiceMessageIdsNeedingRecovery) {
      if (requestedRecoveries.has(messageId)) {
        continue;
      }

      requestedRecoveries.add(messageId);

      if (historySyncDiagnosticsEnabled) {
        console.info('[chat-history]', 'voice-reopen-recovery:requested', {
          conversationId,
          messageId,
          reason: VOICE_MESSAGE_REOPEN_RECOVERY_REASON,
        });
      }

      emitThreadHistorySyncRequest({
        conversationId,
        messageIds: [messageId],
        reason: VOICE_MESSAGE_REOPEN_RECOVERY_REASON,
      });
    }
  }, [
    conversationId,
    historySyncDiagnosticsEnabled,
    recentVoiceMessageIdsNeedingRecovery,
  ]);

  useEffect(() => {
    if (
      conversationKind !== 'dm' ||
      recoverableEncryptedHistoryMessageIds.length === 0
    ) {
      return;
    }

    const attemptedMessageIds =
      encryptedHistoryBootstrapRecoveryAttemptedMessageIdsRef.current;
    const inFlightMessageIds =
      encryptedHistoryBootstrapRecoveryInFlightMessageIdsRef.current;
    const nextMessageIds = recoverableEncryptedHistoryMessageIds.filter(
      (messageId) =>
        !attemptedMessageIds.has(messageId) && !inFlightMessageIds.has(messageId),
    );

    if (nextMessageIds.length === 0) {
      return;
    }

    nextMessageIds.forEach((messageId) => {
      inFlightMessageIds.add(messageId);
    });

    let cancelled = false;

    void (async () => {
      try {
        const localRecord = await getLocalDmE2eeDeviceRecord(currentUserId);
        const localServerDeviceRecordId =
          localRecord?.serverDeviceRecordId?.trim() || null;
        const selectedActiveDeviceRecordId =
          historyFetchActiveDeviceIdRef.current?.trim() || null;

        if (
          localServerDeviceRecordId &&
          localServerDeviceRecordId !== selectedActiveDeviceRecordId
        ) {
          historyFetchActiveDeviceIdRef.current = localServerDeviceRecordId;
          persistCurrentDmE2eeDeviceCookie(localServerDeviceRecordId);
          nextMessageIds.forEach((messageId) => {
            inFlightMessageIds.delete(messageId);
          });

          if (process.env.NEXT_PUBLIC_CHAT_DEBUG_DM_E2EE_BOOTSTRAP === '1') {
            console.info(
              '[chat-history]',
              'dm-e2ee-history-current-device-resync:dispatch',
              {
                conversationId,
                localServerDeviceRecordId,
                messageIds: nextMessageIds,
                selectedActiveDeviceRecordId,
              },
            );
          }

          emitThreadHistorySyncRequest({
            conversationId,
            messageIds: nextMessageIds,
            reason: ENCRYPTED_DM_CURRENT_DEVICE_RESYNC_REASON,
          });
          return;
        }
      } catch (error) {
        if (process.env.NEXT_PUBLIC_CHAT_DEBUG_DM_E2EE_BOOTSTRAP === '1') {
          console.info(
            '[chat-history]',
            'dm-e2ee-history-current-device-resync:local-record-lookup-failed',
            {
              conversationId,
              errorMessage: error instanceof Error ? error.message : String(error),
              messageIds: nextMessageIds,
            },
          );
        }
      }

      const bootstrap = await ensureDmE2eeDeviceRegistered(currentUserId, {
        forcePublish: false,
        triggerReason: 'bootstrap-component',
      });

      if (cancelled || bootstrap.status !== 'registered') {
        nextMessageIds.forEach((messageId) => {
          inFlightMessageIds.delete(messageId);
        });
        return;
      }

      const resolvedActiveDeviceId =
        bootstrap.result?.deviceRecordId?.trim() || null;

      if (resolvedActiveDeviceId) {
        historyFetchActiveDeviceIdRef.current = resolvedActiveDeviceId;
      }

      nextMessageIds.forEach((messageId) => {
        inFlightMessageIds.delete(messageId);
        attemptedMessageIds.add(messageId);
      });

      if (process.env.NEXT_PUBLIC_CHAT_DEBUG_DM_E2EE_BOOTSTRAP === '1') {
        console.info(
          '[chat-history]',
          'dm-e2ee-history-continuity-recovery:dispatch',
          {
            conversationId,
            messageIds: nextMessageIds,
            resultKind: bootstrap.result?.resultKind ?? null,
            serverDeviceRecordId: bootstrap.result?.deviceRecordId ?? null,
          },
        );
      }

      emitThreadHistorySyncRequest({
        conversationId,
        messageIds: nextMessageIds,
        reason: ENCRYPTED_DM_HISTORY_CONTINUITY_RECOVERY_REASON,
      });
    })().catch((error) => {
      nextMessageIds.forEach((messageId) => {
        inFlightMessageIds.delete(messageId);
      });

      if (cancelled) {
        return;
      }

      console.error('[chat-history]', 'dm-e2ee-history-continuity-recovery-failed', {
        conversationId,
        errorMessage: error instanceof Error ? error.message : String(error),
        messageIds: nextMessageIds,
      });
    });

    return () => {
      cancelled = true;
    };
  }, [
    conversationId,
    conversationKind,
    currentUserId,
    recoverableEncryptedHistoryMessageIds,
  ]);

  const loadOlderMessages = useCallback(async () => {
    if (isLoadingOlder || !hasMoreOlder || oldestLoadedSeq === null) {
      return;
    }

    const target =
      typeof document === 'undefined'
        ? null
        : document.getElementById('message-thread-scroll');

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

  useEffect(() => {
    emitThreadHistoryVisibleMessageIds({
      conversationId,
      messageIds: historyMessageIds,
    });
  }, [conversationId, historyMessageIds]);

  useEffect(() => {
    const handleLiveMessage = (event: Event) => {
      const detail = (event as CustomEvent<ThreadHistoryLiveMessagePayload>).detail;

      if (!detail || detail.conversationId !== conversationId) {
        return;
      }

      setHistoryState((currentState) => {
        const nextState = upsertLiveThreadMessage({
          message: detail.message,
          state: currentState,
        });
        historyStateRef.current = nextState;
        return nextState;
      });
    };

    window.addEventListener(
      LOCAL_THREAD_HISTORY_LIVE_MESSAGE_EVENT,
      handleLiveMessage as EventListener,
    );

    return () => {
      window.removeEventListener(
        LOCAL_THREAD_HISTORY_LIVE_MESSAGE_EVENT,
        handleLiveMessage as EventListener,
      );
    };
  }, [conversationId]);

  const mergeSyncRequest = useCallback(
    (nextRequest: ThreadHistorySyncRequestPayload) => {
      const normalizedNextRequest = normalizeThreadHistorySyncRequestState(
        nextRequest,
      );
      const currentByIdRequest = pendingByIdSyncRequestRef.current;
      const currentAfterSeqRequest = pendingAfterSeqSyncRequestRef.current;

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

      if (!normalizedNextRequest.newerThanLatest) {
        return;
      }

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
    },
    [conversationId, historySyncDiagnosticsEnabled],
  );

  const performSyncFetch = useCallback(
    async (input: {
      afterSeq?: number | null;
      messageIds?: string[] | null;
      reason: string | null;
    }) => {
      const normalizedMessageIds = Array.from(
        new Set((input.messageIds ?? []).map((messageId) => messageId.trim()).filter(Boolean)),
      );
      const mode = resolveHistoryFetchMode({
        afterSeq: input.afterSeq ?? null,
        messageIds: normalizedMessageIds,
      });

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
          afterSeq: input.afterSeq ?? null,
          conversationId,
          debugRequestId:
            process.env.NEXT_PUBLIC_CHAT_DEBUG_DM_E2EE_BOOTSTRAP === '1'
              ? crypto.randomUUID()
              : null,
          limit: THREAD_HISTORY_PAGE_SIZE,
          messageIds: input.messageIds ?? null,
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
    [conversationId, currentUserId, historySyncDiagnosticsEnabled],
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

  useEffect(() => {
    let isDisposed = false;
    const encryptedDmRecoveryAttempts = encryptedDmRecoveryAttemptsRef.current;
    const encryptedDmRecoveryTimeouts = encryptedDmRecoveryTimeoutsRef.current;
    const voiceAttachmentRecoveryAttempts =
      voiceAttachmentRecoveryAttemptsRef.current;
    const voiceAttachmentRecoveryTimeouts =
      voiceAttachmentRecoveryTimeoutsRef.current;

    const flushPendingSyncRequest = async () => {
      if (isDisposed || isSyncingRef.current) {
        return;
      }

      const pendingByIdRequest = pendingByIdSyncRequestRef.current;
      const pendingAfterSeqRequest = pendingAfterSeqSyncRequestRef.current;

      if (!pendingByIdRequest && !pendingAfterSeqRequest) {
        return;
      }

      const request = pendingByIdRequest
        ? {
            messageIds: pendingByIdRequest.messageIds,
            mode: 'by-id' as const,
            newerThanLatest: false,
            reason: pendingByIdRequest.reason,
          }
        : {
            messageIds: [] as string[],
            mode: 'after-seq' as const,
            newerThanLatest: true,
            reason: pendingAfterSeqRequest?.reason ?? null,
          };

      if (request.mode === 'by-id') {
        pendingByIdSyncRequestRef.current = null;
      } else {
        pendingAfterSeqSyncRequestRef.current = null;
      }

      isSyncingRef.current = true;

      try {
        if (historySyncDiagnosticsEnabled) {
          console.info('[chat-history]', 'topology-sync:flush', {
            afterSeqRequested: request.mode === 'after-seq',
            chosenMode: request.mode,
            conversationId,
            messageIds: request.messageIds,
            reason: request.reason,
          });
        }

        if (request.mode === 'by-id') {
          const snapshot = await performSyncFetch({
            messageIds: request.messageIds,
            reason: request.reason,
          });

          if (isDisposed || !snapshot) {
            return;
          }

          scheduleMissingEncryptedDmEnvelopeRecovery({
            reason: request.reason,
            requestedMessageIds: request.messageIds,
            snapshot,
          });
          scheduleVoiceAttachmentRecovery({
            reason: request.reason,
            requestedMessageIds: request.messageIds,
            snapshot,
          });

          setHistoryState((currentState) => {
            const nextState = mergeThreadHistoryState({
              mode: 'sync-topology',
              snapshot,
              state: currentState,
            }).nextState;
            historyStateRef.current = nextState;
            return nextState;
          });
        }

        if (request.mode === 'after-seq') {
          while (true) {
            const latestLoadedSeq = resolveLatestLoadedSeq(
              historyStateRef.current.messages,
              null,
            );

            if (latestLoadedSeq === null) {
              break;
            }

            const snapshot = await performSyncFetch({
              afterSeq: latestLoadedSeq,
              reason: request.reason,
            });

            if (isDisposed || !snapshot) {
              return;
            }

            setHistoryState((currentState) => {
              const nextState = mergeThreadHistoryState({
                mode: 'sync-topology',
                snapshot,
                state: currentState,
              }).nextState;
              historyStateRef.current = nextState;
              return nextState;
            });

            if (snapshot.messages.length < THREAD_HISTORY_PAGE_SIZE) {
              break;
            }
          }
        }
      } catch (error) {
        console.error('[chat-history]', 'topology-sync-failed', {
          conversationId,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          preservedMessageCount: historyStateRef.current.messages.length,
          messageIds: request.messageIds,
          newerThanLatest: request.newerThanLatest,
          reason: request.reason,
        });

        if (!isDisposed && historySyncDiagnosticsEnabled) {
          console.info('[chat-history]', 'topology-sync:degraded-preserving-thread', {
            conversationId,
            preservedMessageCount: historyStateRef.current.messages.length,
            reason: request.reason,
          });
        }
      } finally {
        isSyncingRef.current = false;

        if (
          !isDisposed &&
          (pendingByIdSyncRequestRef.current || pendingAfterSeqSyncRequestRef.current)
        ) {
          syncTimeoutRef.current = setTimeout(() => {
            syncTimeoutRef.current = null;
            void flushPendingSyncRequest();
          }, 0);
        }
      }
    };

    const schedulePendingSyncRequest = () => {
      if (syncTimeoutRef.current) {
        return;
      }

      syncTimeoutRef.current = setTimeout(() => {
        syncTimeoutRef.current = null;
        void flushPendingSyncRequest();
      }, 70);
    };

    const handleSyncRequest = (event: Event) => {
      const detail = (event as CustomEvent<ThreadHistorySyncRequestPayload>).detail;

      if (!detail || detail.conversationId !== conversationId) {
        return;
      }

      mergeSyncRequest(detail);
      schedulePendingSyncRequest();
    };

    window.addEventListener(
      LOCAL_THREAD_HISTORY_SYNC_REQUEST_EVENT,
      handleSyncRequest as EventListener,
    );

    return () => {
      isDisposed = true;

      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
        syncTimeoutRef.current = null;
      }

      for (const timeoutId of encryptedDmRecoveryTimeouts.values()) {
        clearTimeout(timeoutId);
      }
      for (const timeoutId of voiceAttachmentRecoveryTimeouts.values()) {
        clearTimeout(timeoutId);
      }
      pendingByIdSyncRequestRef.current = null;
      pendingAfterSeqSyncRequestRef.current = null;
      encryptedDmRecoveryAttempts.clear();
      encryptedDmRecoveryTimeouts.clear();
      voiceAttachmentRecoveryAttempts.clear();
      voiceAttachmentRecoveryTimeouts.clear();

      window.removeEventListener(
        LOCAL_THREAD_HISTORY_SYNC_REQUEST_EVENT,
        handleSyncRequest as EventListener,
      );
    };
  }, [
    conversationId,
    historySyncDiagnosticsEnabled,
    mergeSyncRequest,
    performSyncFetch,
    scheduleMissingEncryptedDmEnvelopeRecovery,
    scheduleVoiceAttachmentRecovery,
  ]);

  useLayoutEffect(() => {
    const pendingRestore = pendingRestoreRef.current;

    if (!pendingRestore) {
      return;
    }

    const target =
      typeof document === 'undefined'
        ? null
        : document.getElementById('message-thread-scroll');

    if (!target) {
      pendingRestoreRef.current = null;
      return;
    }

    const frameId = requestAnimationFrame(() => {
      const scrollHeightDelta =
        target.scrollHeight - pendingRestore.previousScrollHeight;
      target.scrollTop = pendingRestore.previousScrollTop + scrollHeightDelta;
      pendingRestoreRef.current = null;
    });

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [historyState.messages]);

  const openImagePreview = useCallback((preview: ActiveImagePreview) => {
    setActiveImagePreview(preview);
  }, []);

  const closeImagePreview = useCallback(() => {
    setActiveImagePreview(null);
  }, []);

  return (
    <>
      {conversationKind === 'dm' ? (
        <DmThreadClientSubtree
          conversationId={conversationId}
          {...threadClientDiagnostics}
          surface="progressive-history-loader"
        >
          <ProgressiveHistoryLoader
            conversationId={conversationId}
            hasMoreOlder={hasMoreOlder}
            idleLabel={t.chat.olderMessagesAutoLoad}
            isLoadingOlder={isLoadingOlder}
            loadingLabel={t.chat.loadingOlderMessages}
            onRequestOlder={() => {
              void loadOlderMessages();
            }}
            targetId="message-thread-scroll"
          />
        </DmThreadClientSubtree>
      ) : (
        <ProgressiveHistoryLoader
          conversationId={conversationId}
          hasMoreOlder={hasMoreOlder}
          idleLabel={t.chat.olderMessagesAutoLoad}
          isLoadingOlder={isLoadingOlder}
          loadingLabel={t.chat.loadingOlderMessages}
          onRequestOlder={() => {
            void loadOlderMessages();
          }}
          targetId="message-thread-scroll"
        />
      )}
      {conversationKind === 'dm' ? (
        <DmThreadClientSubtree
          conversationId={conversationId}
          {...threadClientDiagnostics}
          surface="auto-scroll-to-latest"
        >
          <AutoScrollToLatest
            bottomSentinelId="message-thread-bottom-sentinel"
            conversationId={conversationId}
            latestVisibleMessageSeq={latestCommittedMessageSeq}
            targetId="message-thread-scroll"
          />
        </DmThreadClientSubtree>
      ) : (
        <AutoScrollToLatest
          bottomSentinelId="message-thread-bottom-sentinel"
          conversationId={conversationId}
          latestVisibleMessageSeq={latestCommittedMessageSeq}
          targetId="message-thread-scroll"
        />
      )}
      {historyState.messages.length === 0 ? (
        <div className="chat-empty-state" aria-label={t.chat.noMessagesYet}>
          <span className="chat-empty-state-label">{t.chat.noMessagesYet}</span>
        </div>
      ) : (
        timelineItems.map((item, index) => {
          if (item.type === 'separator') {
            return (
              <div
                key={item.key}
                className="message-day-separator"
                aria-label={item.label}
              >
                <span className="message-day-label">{item.label}</span>
              </div>
            );
          }

          if (item.type === 'unread') {
            return (
              <div
                key={item.key}
                className="message-unread-separator"
                aria-label={item.label}
              >
                <span className="message-unread-label">{item.label}</span>
              </div>
            );
          }

          if (item.type === 'message') {
            const previousTimelineItem = timelineItems[index - 1];
            const nextTimelineItem = timelineItems[index + 1];
            const previousMessage =
              previousTimelineItem?.type === 'message'
                ? previousTimelineItem.message
                : null;
            const nextMessage =
              nextTimelineItem?.type === 'message'
                ? nextTimelineItem.message
                : null;

            return (
              <ThreadMessageRow
                key={item.message.id}
                activeDeleteMessageId={activeDeleteMessageId}
                activeEditMessageId={activeEditMessageId}
                activeSpaceId={activeSpaceId}
                attachmentsByMessage={historyState.attachmentsByMessage}
                compactHistoricalUnavailable={
                  unavailableEncryptedHistoryRunMeta.get(item.message.id)
                    ?.isContinuation ?? false
                }
                conversationId={conversationId}
                conversationKind={conversationKind}
                currentUserId={currentUserId}
                encryptedEnvelopesByMessage={historyState.encryptedEnvelopesByMessage}
                encryptedHistoryHintsByMessage={historyState.encryptedHistoryHintsByMessage}
                historicalUnavailableContinuationCount={
                  unavailableEncryptedHistoryRunMeta.get(item.message.id)
                    ?.continuationCount ?? 0
                }
                isClusteredWithNext={canClusterAdjacentMessages(
                  item.message,
                  nextMessage,
                )}
                isClusteredWithPrevious={canClusterAdjacentMessages(
                  previousMessage,
                  item.message,
                )}
                language={language}
                latestVisibleMessageSeq={latestCommittedMessageSeq}
                message={item.message}
                messagesById={historyState.messagesById}
                onOpenImagePreview={openImagePreview}
                otherParticipantReadSeq={otherParticipantReadSeq}
                otherParticipantUserId={otherParticipantUserId}
                reactionsByMessage={historyState.reactionsByMessage}
                senderNames={senderNames}
                threadClientDiagnostics={threadClientDiagnostics}
              />
            );
          }

          return null;
        })
      )}
      <ThreadImagePreviewOverlay
        closeLabel={t.chat.closePhotoPreview}
        fallbackTitle={t.chat.photo}
        onClose={closeImagePreview}
        preview={activeImagePreview}
      />
      {conversationKind === 'dm' ? (
        <DmThreadClientSubtree
          conversationId={conversationId}
          {...threadClientDiagnostics}
          surface="optimistic-thread-messages"
        >
          <OptimisticThreadMessages
            confirmedClientIds={resolvedConfirmedClientIds}
            conversationId={conversationId}
            labels={{
              attachment: t.chat.attachment,
              delete: t.chat.delete,
              failed: t.chat.sendFailed,
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
            }}
          />
        </DmThreadClientSubtree>
      ) : (
        <OptimisticThreadMessages
          confirmedClientIds={resolvedConfirmedClientIds}
          conversationId={conversationId}
          labels={{
            attachment: t.chat.attachment,
            delete: t.chat.delete,
            failed: t.chat.sendFailed,
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
          }}
        />
      )}
      {conversationKind === 'dm' ? (
        <DmThreadClientSubtree
          conversationId={conversationId}
          {...threadClientDiagnostics}
          surface="mark-conversation-read"
        >
          <MarkConversationRead
            bottomSentinelId="message-thread-bottom-sentinel"
            conversationId={conversationId}
            currentReadMessageSeq={currentReadMessageSeq}
            key={`mark-read-${conversationId}-${currentReadMessageSeq ?? 'none'}-${latestCommittedMessageSeq ?? 'none'}`}
            latestVisibleMessageSeq={
              latestCommittedMessageSeq !== null &&
              Number.isFinite(latestCommittedMessageSeq)
                ? latestCommittedMessageSeq
                : null
            }
          />
        </DmThreadClientSubtree>
      ) : (
        <MarkConversationRead
          bottomSentinelId="message-thread-bottom-sentinel"
          conversationId={conversationId}
          currentReadMessageSeq={currentReadMessageSeq}
          key={`mark-read-${conversationId}-${currentReadMessageSeq ?? 'none'}-${latestCommittedMessageSeq ?? 'none'}`}
          latestVisibleMessageSeq={
            latestCommittedMessageSeq !== null &&
            Number.isFinite(latestCommittedMessageSeq)
              ? latestCommittedMessageSeq
              : null
          }
        />
      )}
    </>
  );
}
