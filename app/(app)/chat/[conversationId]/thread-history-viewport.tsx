'use client';

import Link from 'next/link';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  formatPersonFallbackLabel,
  getLocaleForLanguage,
  getTranslations,
  type AppLanguage,
} from '@/modules/i18n';
import type { StoredDmE2eeEnvelope } from '@/modules/messaging/contract/dm-e2ee';
import type { EncryptedDmServerHistoryHint } from '@/modules/messaging/e2ee/ui-policy';
import type { MessagingVoicePlaybackState } from '@/modules/messaging/media';
import {
  emitThreadHistoryVisibleMessageIds,
  LOCAL_THREAD_HISTORY_SYNC_REQUEST_EVENT,
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
import { DmReplyTargetSnippet } from './dm-reply-target-snippet';
import { EncryptedDmMessageBody } from './encrypted-dm-message-body';
import { LiveOutgoingMessageStatus } from './live-outgoing-message-status';
import { MarkConversationRead } from './mark-conversation-read';
import { MessageStatusIndicator } from './message-status-indicator';
import { OptimisticThreadMessages } from './optimistic-thread-messages';
import { ProgressiveHistoryLoader } from './progressive-history-loader';
import { ThreadDeleteMessageConfirm } from './thread-delete-message-confirm';
import { ThreadEditedIndicator } from './thread-edited-indicator';
import { ThreadInlineEditForm } from './thread-inline-edit-form';
import { ThreadReactionGroups } from './thread-reaction-groups';

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
  durationMs?: number | null;
  fileName: string;
  id: string;
  isAudio: boolean;
  isImage: boolean;
  isVoiceMessage?: boolean;
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
  activeActionMessageId: string | null;
  activeDeleteMessageId: string | null;
  activeEditMessageId: string | null;
  activeSpaceId: string;
  confirmedClientIds: string[];
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

type TimelineItem =
  | { key: string; label: string; type: 'separator' | 'unread' }
  | { key: string; message: ConversationMessageRow; type: 'message' };

type HistoryFetchMode = 'latest' | 'before-seq' | 'after-seq' | 'by-id' | 'noop';
type VoiceMessageRenderState =
  | 'ready'
  | 'uploading'
  | 'processing'
  | 'failed'
  | 'unavailable';

const THREAD_HISTORY_PAGE_SIZE = 26;

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

function formatMessageTimestamp(value: string | null, language: AppLanguage) {
  const parsedDate = parseSafeDate(value);

  if (!parsedDate) {
    return '';
  }

  return new Intl.DateTimeFormat(getLocaleForLanguage(language), {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
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

  return 'unavailable' satisfies VoiceMessageRenderState;
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

function ThreadVoiceMessageBubble({
  attachment,
  isOwnMessage,
  language,
  messageId,
  stageHint = null,
}: {
  attachment: MessageAttachment | null;
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

  const voiceState = resolveVoiceMessageRenderState({
    attachment,
    playbackFailed,
    stageHint,
  });
  const totalDurationMs = resolvedDurationMs && resolvedDurationMs > 0
    ? resolvedDurationMs
    : 0;
  const progressRatio =
    totalDurationMs > 0
      ? Math.min(1, Math.max(0, progressMs / totalDurationMs))
      : 0;
  const isPlaying = playbackState === 'playing';
  const isBuffering = playbackState === 'buffering';
  const readyStateLabel =
    playbackState === 'buffering'
      ? t.chat.voiceMessageLoading
      : t.chat.voiceMessage;
  const stateLabel =
    voiceState === 'ready'
      ? readyStateLabel
      : getVoiceMessageStateLabel({ state: voiceState, t });
  const sizeLabel = formatAttachmentSize(attachment?.sizeBytes ?? null);
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

  const togglePlayback = async () => {
    const audio = audioRef.current;

    if (!audio || voiceState !== 'ready') {
      return;
    }

    if (audio.paused) {
      setPlaybackFailed(false);
      setPlaybackState('buffering');
      claimActiveThreadVoicePlayback(messageId, audio);

      if (audio.readyState === 0) {
        audio.load();
      }

      try {
        await audio.play();
      } catch {
        releaseActiveThreadVoicePlayback(messageId, audio);
        setPlaybackFailed(true);
        setPlaybackState('failed');
      }
      return;
    }

    audio.pause();
  };

  const playButtonLabel =
    voiceState !== 'ready'
      ? stateLabel
      : isBuffering
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
      data-voice-state={voiceState}
    >
      <button
        aria-label={playButtonLabel}
        className="message-voice-play"
        disabled={voiceState !== 'ready'}
        onClick={() => {
          void togglePlayback();
        }}
        type="button"
      >
        <span aria-hidden="true" className="message-voice-play-icon">
          {voiceState !== 'ready'
            ? voiceState === 'failed' || voiceState === 'unavailable'
              ? '!'
              : '...'
            : isBuffering
              ? '...'
              : isPlaying
                ? '||'
                : '>'}
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
        <div className="message-voice-meta">
          <span className="message-voice-state">{stateLabel}</span>
          {voiceState === 'ready' && sizeLabel ? (
            <span className="message-voice-meta-separator">·</span>
          ) : null}
          {voiceState === 'ready' && sizeLabel ? (
            <span>{sizeLabel}</span>
          ) : null}
        </div>
      </div>
      {voiceState === 'ready' && attachment?.signedUrl ? (
        <audio
          ref={audioRef}
          className="message-voice-audio"
          onEnded={(event) => {
            releaseActiveThreadVoicePlayback(messageId, event.currentTarget);
            event.currentTarget.currentTime = 0;
            setProgressMs(0);
            setPlaybackState('ended');
          }}
          onError={(event) => {
            releaseActiveThreadVoicePlayback(messageId, event.currentTarget);
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

            if (event.currentTarget.ended) {
              return;
            }

            setPlaybackState(event.currentTarget.currentTime > 0 ? 'paused' : 'idle');
          }}
          onPlaying={(event) => {
            claimActiveThreadVoicePlayback(messageId, event.currentTarget);
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
          src={attachment.signedUrl}
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

function getThreadHistorySyncMode(input: {
  messageIds: string[];
  newerThanLatest: boolean;
}): HistoryFetchMode {
  if (input.messageIds.length > 0) {
    return 'by-id' as const;
  }

  if (input.newerThanLatest) {
    return 'after-seq' as const;
  }

  return 'noop' as const;
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

function getSnapshotRevisionKey(snapshot: ThreadHistoryPageSnapshot) {
  return JSON.stringify({
    hasMoreOlder: snapshot.hasMoreOlder,
    messageIds: snapshot.messages.map((message) => message.id),
    oldestMessageSeq: snapshot.oldestMessageSeq,
  });
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

type ThreadMessageRowProps = {
  activeActionMessageId: string | null;
  activeDeleteMessageId: string | null;
  activeEditMessageId: string | null;
  activeSpaceId: string;
  attachmentsByMessage: Map<string, MessageAttachment[]>;
  conversationId: string;
  conversationKind: 'dm' | 'group';
  currentUserId: string;
  encryptedEnvelopesByMessage: Map<string, StoredDmE2eeEnvelope>;
  encryptedHistoryHintsByMessage: Map<string, EncryptedDmServerHistoryHint>;
  language: AppLanguage;
  latestVisibleMessageSeq: number | null;
  message: ConversationMessageRow;
  messagesById: Map<string, ConversationMessageRow>;
  otherParticipantReadSeq: number | null;
  otherParticipantUserId: string | null;
  reactionsByMessage: Map<string, MessageReactionGroup[]>;
  senderNames: Map<string, string>;
  threadClientDiagnostics: DmThreadClientDiagnostics;
};

function ThreadMessageRow({
  activeActionMessageId,
  activeDeleteMessageId,
  activeEditMessageId,
  activeSpaceId,
  attachmentsByMessage,
  conversationId,
  conversationKind,
  currentUserId,
  encryptedEnvelopesByMessage,
  encryptedHistoryHintsByMessage,
  language,
  latestVisibleMessageSeq,
  message,
  messagesById,
  otherParticipantReadSeq,
  otherParticipantUserId,
  reactionsByMessage,
  senderNames,
  threadClientDiagnostics,
}: ThreadMessageRowProps) {
  const t = getTranslations(language);
  const isOwnMessage = message.sender_id === currentUserId;
  const isMessageActionActive =
    activeActionMessageId === message.id &&
    !activeEditMessageId &&
    !activeDeleteMessageId;
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
  const messageAttachments = attachmentsByMessage.get(message.id) ?? [];
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
  const encryptedHistoryHint =
    encryptedHistoryHintsByMessage.get(message.id) ?? {
      code: encryptedEnvelope ? 'envelope-present' : 'missing-envelope',
      committedHistoryState: 'present',
      currentDeviceAvailability: encryptedEnvelope
        ? 'envelope-present'
        : 'missing-envelope',
      recoveryDisposition: encryptedEnvelope
        ? 'already-readable'
        : 'not-supported-v1',
      activeDeviceRecordId: null,
      messageCreatedAt: message.created_at ?? null,
      viewerJoinedAt: null,
    };
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
      className={isOwnMessage ? 'message-row message-row-own' : 'message-row'}
      key={message.id}
    >
      <div
        className={
          isDeletedMessage
            ? isOwnMessage
              ? 'message-card message-card-own message-card-deleted'
              : 'message-card message-card-deleted'
            : isOwnMessage
              ? 'message-card message-card-own'
              : 'message-card'
        }
        id={`message-${message.id}`}
      >
        {!isDeletedMessage ? (
          <div
            className={
              isOwnMessage
                ? 'message-header message-header-own'
                : 'message-header'
            }
          >
            <div className="message-header-side">
              <Link
                aria-label={t.chat.openMessageActions}
                className={
                  isMessageActionActive
                    ? 'message-actions-trigger message-actions-trigger-active'
                    : 'message-actions-trigger'
                }
                href={buildChatHref({
                  actionMessageId: message.id,
                  conversationId,
                  hash: `#message-${message.id}`,
                  spaceId: activeSpaceId,
                })}
                prefetch={false}
              >
                <span aria-hidden="true">⋯</span>
              </Link>
            </div>
          </div>
        ) : null}
        <div
          className={
            message.reply_to_message_id && !isDeletedMessage
              ? isOwnMessage
                ? 'message-bubble message-bubble-own message-bubble-with-reply'
                : 'message-bubble message-bubble-with-reply'
              : isOwnMessage
                ? 'message-bubble message-bubble-own'
                : 'message-bubble'
          }
        >
          {message.reply_to_message_id && !isDeletedMessage ? (
            <div
              className={
                isOwnMessage
                  ? 'message-reply-reference message-reply-reference-own'
                  : 'message-reply-reference'
              }
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
                  deletedFallbackLabel={t.chat.messageDeleted}
                  emptyFallbackLabel={t.chat.emptyMessage}
                  encryptedFallbackLabel={t.chat.replyToEncryptedMessage}
                  encryptedReferenceNote={null}
                  loadedFallbackLabel={t.chat.earlierMessage}
                  messageId={message.id}
                  surface="message-reply-reference"
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
            </div>
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
                  <div
                    className="message-encryption-state"
                    data-dm-e2ee-access-state={
                      isUnavailableHistoricalEncryptedHint
                        ? encryptedHistoryFallbackAccessState
                        : 'temporary-local-read-failure'
                    }
                    data-dm-e2ee-history-state="present"
                  >
                    <p
                      className={
                        isUnavailableHistoricalEncryptedHint
                          ? 'message-encryption-title'
                          : 'message-body'
                      }
                    >
                      {isUnavailableHistoricalEncryptedHint
                        ? t.chat.olderEncryptedMessage
                        : t.chat.encryptedMessageUnavailable}
                    </p>
                    {isUnavailableHistoricalEncryptedHint ? (
                      <p className="message-encryption-note">
                        {encryptedHistoryFallbackNote}
                      </p>
                    ) : null}
                  </div>
                }
                messageId={message.id}
                surface="encrypted-dm-message-body"
              >
                <EncryptedDmMessageBody
                  clientId={message.client_id}
                  conversationId={conversationId}
                  currentUserId={currentUserId}
                  envelope={encryptedEnvelope}
                  fallbackLabel={t.chat.encryptedMessage}
                  historyDiagnosticHint={encryptedHistoryHint}
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
              <div
                className="message-encryption-state"
                data-dm-e2ee-access-state={
                  isUnavailableHistoricalEncryptedHint
                    ? encryptedHistoryFallbackAccessState
                    : 'temporary-local-read-failure'
                }
                data-dm-e2ee-history-state="present"
                data-dm-e2ee-debug-bucket={
                  process.env.NEXT_PUBLIC_CHAT_DEBUG_DM_E2EE_BOOTSTRAP === '1'
                    ? encryptedHistoryHint.code
                    : undefined
                }
              >
                <p
                  className={
                    isUnavailableHistoricalEncryptedHint
                      ? 'message-encryption-title'
                      : 'message-body'
                  }
                >
                  {isUnavailableHistoricalEncryptedHint
                    ? t.chat.olderEncryptedMessage
                    : t.chat.encryptedMessageUnavailable}
                </p>
                {isUnavailableHistoricalEncryptedHint ? (
                  <p className="message-encryption-note">
                    {encryptedHistoryFallbackNote}
                  </p>
                ) : null}
                {process.env.NEXT_PUBLIC_CHAT_DEBUG_DM_E2EE_BOOTSTRAP === '1' ? (
                  <p className="message-encryption-debug-label">
                    {encryptedHistoryHint.code}
                  </p>
                ) : null}
              </div>
            )
          ) : message.kind === 'voice' ? (
            <div className="message-voice-stack">
              <ThreadVoiceMessageBubble
                attachment={primaryVoiceAttachment}
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
            <p className="message-body">{normalizedMessageBody}</p>
          ) : !messageAttachments.length ? (
            <p className="message-body">{t.chat.emptyMessage}</p>
          ) : null}
          {nonVoiceAttachments.length && !isDeletedMessage ? (
            <div className="message-attachments">
              {nonVoiceAttachments.map((attachment) => {
                const attachmentContent = (
                  <>
                    {attachment.isImage && attachment.signedUrl ? (
                      <span
                        aria-hidden="true"
                        className="message-attachment-preview"
                        style={{
                          backgroundImage: `url("${attachment.signedUrl}")`,
                        }}
                      />
                    ) : (
                      <span
                        aria-hidden="true"
                        className="message-attachment-file"
                      >
                        {attachment.isAudio ? t.chat.audio : t.chat.file}
                      </span>
                    )}
                    <span className="message-attachment-copy">
                      <span className="message-attachment-name">
                        {attachment.fileName}
                      </span>
                      <span className="message-attachment-meta">
                        {attachment.isVoiceMessage
                          ? t.chat.voiceMessage
                          : attachment.isAudio
                            ? t.chat.audio
                            : attachment.isImage
                              ? t.chat.image
                              : t.chat.attachment}
                        {formatAttachmentSize(attachment.sizeBytes)
                          ? ` · ${formatAttachmentSize(attachment.sizeBytes)}`
                          : ''}
                        {!attachment.signedUrl
                          ? ` · ${t.chat.unavailableRightNow}`
                          : ''}
                      </span>
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
        <span
          className={
            isOwnMessage
              ? 'message-meta message-meta-own'
              : 'message-meta'
          }
        >
          <span>
            {formatMessageTimestamp(message.created_at, language) || t.chat.justNow}
          </span>
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
        </span>

        {!isDeletedMessage ? (
          <ThreadReactionGroups
            ariaLabel={t.chat.messageReactions}
            conversationId={conversationId}
            currentUserId={currentUserId}
            initialReactions={reactionsByMessage.get(message.id) ?? []}
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

export function ThreadHistoryViewport({
  activeActionMessageId,
  activeDeleteMessageId,
  activeEditMessageId,
  activeSpaceId,
  confirmedClientIds,
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
  const [historyState, setHistoryState] = useState<ThreadHistoryState>(() =>
    createThreadHistoryState(initialSnapshot),
  );
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const historyStateRef = useRef(historyState);
  const lastConversationIdRef = useRef(conversationId);
  const lastInitialSnapshotKeyRef = useRef(getSnapshotRevisionKey(initialSnapshot));
  const pendingRestoreRef = useRef<PendingScrollRestore | null>(null);
  const pendingSyncRequestRef = useRef<ThreadHistorySyncRequestState | null>(null);
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSyncingRef = useRef(false);
  const historySyncDiagnosticsEnabled =
    typeof window !== 'undefined' &&
    process.env.NEXT_PUBLIC_CHAT_DEBUG_LIVE_REFRESH === '1';

  useEffect(() => {
    historyStateRef.current = historyState;
  }, [historyState]);

  useEffect(() => {
    const nextSnapshotKey = getSnapshotRevisionKey(initialSnapshot);

    if (lastConversationIdRef.current !== conversationId) {
      const resetState = createThreadHistoryState(initialSnapshot);
      lastConversationIdRef.current = conversationId;
      lastInitialSnapshotKeyRef.current = nextSnapshotKey;
      historyStateRef.current = resetState;
      setHistoryState(resetState);
      setIsLoadingOlder(false);
      pendingRestoreRef.current = null;
      pendingSyncRequestRef.current = null;
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
  }, [conversationId, initialSnapshot]);

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
          [
            ...confirmedClientIds,
            ...historyState.messages
              .map((message) => message.client_id?.trim() || '')
              .filter(Boolean),
          ].filter(Boolean),
        ),
      ),
    [confirmedClientIds, historyState.messages],
  );
  const historyMessageIds = useMemo(
    () => historyState.messages.map((message) => message.id),
    [historyState.messages],
  );

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

  const mergeSyncRequest = useCallback(
    (nextRequest: ThreadHistorySyncRequestPayload) => {
      const currentRequest = normalizeThreadHistorySyncRequestState(
        pendingSyncRequestRef.current ?? {},
      );
      const normalizedNextRequest = normalizeThreadHistorySyncRequestState(
        nextRequest,
      );
      const mergedRequest = normalizeThreadHistorySyncRequestState({
        messageIds: [
          ...currentRequest.messageIds,
          ...normalizedNextRequest.messageIds,
        ],
        newerThanLatest:
          currentRequest.newerThanLatest || normalizedNextRequest.newerThanLatest,
        reason:
          normalizedNextRequest.reason || currentRequest.reason || null,
      });

      if (
        historySyncDiagnosticsEnabled &&
        mergedRequest.messageIds.length > 0 &&
        (currentRequest.newerThanLatest || normalizedNextRequest.newerThanLatest)
      ) {
        console.info('[chat-history]', 'topology-sync:mode-normalized', {
          conversationId,
          mergedMessageIds: mergedRequest.messageIds,
          nextMode: getThreadHistorySyncMode(normalizedNextRequest),
          normalizedMode: getThreadHistorySyncMode(mergedRequest),
          previousMode: getThreadHistorySyncMode(currentRequest),
          reason: mergedRequest.reason,
        });
      }

      pendingSyncRequestRef.current = mergedRequest;
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

  useEffect(() => {
    let isDisposed = false;

    const flushPendingSyncRequest = async () => {
      if (isDisposed || isSyncingRef.current) {
        return;
      }

      const request = pendingSyncRequestRef.current;

      if (!request) {
        return;
      }

      pendingSyncRequestRef.current = null;
      isSyncingRef.current = true;

      try {
        const shouldDeferAfterSeqFetch =
          request.messageIds.length > 0 && request.newerThanLatest;

        if (shouldDeferAfterSeqFetch) {
          mergeSyncRequest({
            conversationId,
            newerThanLatest: true,
            reason: request.reason,
          });

          if (historySyncDiagnosticsEnabled) {
            console.info('[chat-history]', 'topology-sync:after-seq-deferred', {
              conversationId,
              deferredMode: 'after-seq',
              initialMode: 'by-id',
              messageIds: request.messageIds,
              reason: request.reason,
            });
          }
        }

        if (historySyncDiagnosticsEnabled) {
          console.info('[chat-history]', 'topology-sync:flush', {
            afterSeqRequested: request.newerThanLatest,
            chosenMode: getThreadHistorySyncMode(request),
            conversationId,
            messageIds: request.messageIds,
            reason: request.reason,
          });
        }

        if (request.messageIds.length > 0) {
          const snapshot = await performSyncFetch({
            messageIds: request.messageIds,
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
        }

        if (request.newerThanLatest && !shouldDeferAfterSeqFetch) {
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

        if (!isDisposed && pendingSyncRequestRef.current) {
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
        timelineItems.map((item) => {
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
            return (
              <ThreadMessageRow
                key={item.key}
                activeActionMessageId={activeActionMessageId}
                activeDeleteMessageId={activeDeleteMessageId}
                activeEditMessageId={activeEditMessageId}
                activeSpaceId={activeSpaceId}
                attachmentsByMessage={historyState.attachmentsByMessage}
                conversationId={conversationId}
                conversationKind={conversationKind}
                currentUserId={currentUserId}
                encryptedEnvelopesByMessage={historyState.encryptedEnvelopesByMessage}
                encryptedHistoryHintsByMessage={historyState.encryptedHistoryHintsByMessage}
                language={language}
                latestVisibleMessageSeq={latestCommittedMessageSeq}
                message={item.message}
                messagesById={historyState.messagesById}
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
              remove: t.chat.remove,
              retry: t.chat.retrySend,
              sending: t.chat.sending,
              sent: t.chat.sent,
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
            remove: t.chat.remove,
            retry: t.chat.retrySend,
            sending: t.chat.sending,
            sent: t.chat.sent,
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
