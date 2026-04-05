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
import { resolvePublicIdentityLabel } from '@/modules/messaging/ui/identity-label';
import { withSpaceParam } from '@/modules/spaces/url';
import { useThreadMessagePatchedBody } from '@/modules/messaging/realtime/thread-message-patch-store';
import { deleteMessageAction } from './actions';
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

type TimelineItem =
  | { key: string; label: string; type: 'separator' | 'unread' }
  | { key: string; message: ConversationMessageRow; type: 'message' };

const THREAD_HISTORY_PAGE_SIZE = 26;

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

function buildHistoryPageUrl(input: {
  beforeSeq: number;
  conversationId: string;
  debugRequestId?: string | null;
  limit: number;
}) {
  const params = new URLSearchParams();
  params.set('beforeSeq', String(input.beforeSeq));
  params.set('limit', String(input.limit));

  if (input.debugRequestId) {
    params.set('debugRequestId', input.debugRequestId);
  }

  return `/api/messaging/conversations/${input.conversationId}/history?${params.toString()}`;
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

function mergeHistorySnapshots(
  olderSnapshots: ThreadHistoryPageSnapshot[],
  baseSnapshot: ThreadHistoryPageSnapshot,
) {
  const snapshots = [...olderSnapshots, baseSnapshot];
  const orderedMessageIds: string[] = [];
  const seenMessageIds = new Set<string>();
  const messagesById = new Map<string, ConversationMessageRow>();
  const senderProfilesById = new Map<string, MessageSenderProfile>();
  const reactionsByMessage = new Map<string, MessageReactionGroup[]>();
  const attachmentsByMessage = new Map<string, MessageAttachment[]>();
  const encryptedEnvelopesByMessage = new Map<string, StoredDmE2eeEnvelope>();
  const encryptedHistoryHintsByMessage = new Map<
    string,
    EncryptedDmServerHistoryHint
  >();

  for (const snapshot of snapshots) {
    for (const message of snapshot.messages) {
      messagesById.set(message.id, message);

      if (!seenMessageIds.has(message.id)) {
        seenMessageIds.add(message.id);
        orderedMessageIds.push(message.id);
      }
    }

    for (const senderProfile of snapshot.senderProfiles) {
      senderProfilesById.set(senderProfile.userId, senderProfile);
    }

    for (const entry of snapshot.reactionsByMessage) {
      reactionsByMessage.set(entry.messageId, entry.reactions);
    }

    for (const entry of snapshot.attachmentsByMessage) {
      attachmentsByMessage.set(entry.messageId, entry.attachments);
    }

    for (const entry of snapshot.dmE2ee?.envelopesByMessage ?? []) {
      encryptedEnvelopesByMessage.set(entry.messageId, entry.envelope);
    }

    for (const entry of snapshot.dmE2ee?.historyHintsByMessage ?? []) {
      encryptedHistoryHintsByMessage.set(entry.messageId, entry.hint);
    }
  }

  return {
    attachmentsByMessage,
    encryptedEnvelopesByMessage,
    encryptedHistoryHintsByMessage,
    messages: orderedMessageIds
      .map((messageId) => messagesById.get(messageId) ?? null)
      .filter((message): message is ConversationMessageRow => Boolean(message)),
    reactionsByMessage,
    senderProfiles: Array.from(senderProfilesById.values()),
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
  const isDeletedMessage = Boolean(message.deleted_at);
  const isMessageActionActive =
    activeActionMessageId === message.id &&
    !activeEditMessageId &&
    !activeDeleteMessageId;
  const patchedBody = useThreadMessagePatchedBody(
    conversationId,
    message.id,
    message.body,
  );
  const normalizedMessageBody = normalizeMessageBodyText(patchedBody);
  const isMessageInEditMode =
    activeEditMessageId === message.id &&
    isOwnMessage &&
    !isDeletedMessage &&
    !isEncryptedDmTextMessage(message);
  const isMessageInDeleteMode =
    activeDeleteMessageId === message.id && isOwnMessage && !isDeletedMessage;
  const messageAttachments = attachmentsByMessage.get(message.id) ?? [];
  const encryptedEnvelope =
    encryptedEnvelopesByMessage.get(message.id) ?? null;
  const encryptedHistoryHint =
    encryptedHistoryHintsByMessage.get(message.id) ?? {
      code: encryptedEnvelope ? 'envelope-present' : 'missing-envelope',
      activeDeviceRecordId: null,
      messageCreatedAt: message.created_at ?? null,
      viewerJoinedAt: null,
    };
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
              >
                <span aria-hidden="true">⋯</span>
              </Link>
            </div>
          </div>
        ) : null}
        <div
          className={
            isOwnMessage
              ? 'message-bubble message-bubble-own'
              : 'message-bubble'
          }
        >
          {message.reply_to_message_id && !isDeletedMessage ? (
            <div className="message-reply-reference">
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
                  <div className="message-encryption-state">
                    <p className="message-body">
                      {t.chat.encryptedMessageUnavailable}
                    </p>
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
                  historyUnavailableNoteLabel={
                    t.chat.encryptedHistoryUnavailableNote
                  }
                  messageCreatedAt={message.created_at}
                  messageId={message.id}
                  messageSenderId={message.sender_id}
                  policyUnavailableNoteLabel={
                    t.chat.encryptedHistoryPolicyBlockedNote
                  }
                  refreshSetupLabel={t.chat.refreshEncryptedSetup}
                  reloadConversationLabel={t.chat.reloadConversation}
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
                data-dm-e2ee-debug-bucket={
                  process.env.NEXT_PUBLIC_CHAT_DEBUG_DM_E2EE_BOOTSTRAP === '1'
                    ? encryptedHistoryHint.code
                    : undefined
                }
              >
                <p className="message-body">{t.chat.encryptedMessageUnavailable}</p>
                {process.env.NEXT_PUBLIC_CHAT_DEBUG_DM_E2EE_BOOTSTRAP === '1' ? (
                  <p className="message-encryption-debug-label">
                    {encryptedHistoryHint.code}
                  </p>
                ) : null}
              </div>
            )
          ) : normalizedMessageBody ? (
            <p className="message-body">{normalizedMessageBody}</p>
          ) : !messageAttachments.length ? (
            <p className="message-body">{t.chat.emptyMessage}</p>
          ) : null}
          {messageAttachments.length && !isDeletedMessage ? (
            <div className="message-attachments">
              {messageAttachments.map((attachment) => {
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
          <form action={deleteMessageAction} className="message-delete-confirm">
            <input name="conversationId" type="hidden" value={conversationId} />
            <input name="messageId" type="hidden" value={message.id} />
            <input name="confirmDelete" type="hidden" value="true" />
            <span className="message-delete-copy">{t.chat.deleteConfirm}</span>
            <div className="message-delete-actions">
              <button className="button button-compact" type="submit">
                {t.chat.delete}
              </button>
              <Link
                className="pill message-edit-cancel"
                href={buildChatHref({
                  conversationId,
                  hash: `#message-${message.id}`,
                  spaceId: activeSpaceId,
                })}
              >
                {t.chat.cancel}
              </Link>
            </div>
          </form>
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
  const [baseSnapshot, setBaseSnapshot] =
    useState<ThreadHistoryPageSnapshot>(initialSnapshot);
  const [olderSnapshots, setOlderSnapshots] = useState<ThreadHistoryPageSnapshot[]>(
    [],
  );
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const lastConversationIdRef = useRef(conversationId);
  const pendingRestoreRef = useRef<PendingScrollRestore | null>(null);

  useEffect(() => {
    if (lastConversationIdRef.current !== conversationId) {
      lastConversationIdRef.current = conversationId;
      setOlderSnapshots([]);
      setBaseSnapshot(initialSnapshot);
      setIsLoadingOlder(false);
      pendingRestoreRef.current = null;
      return;
    }

    setBaseSnapshot(initialSnapshot);
  }, [conversationId, initialSnapshot]);

  const mergedHistory = useMemo(
    () => mergeHistorySnapshots(olderSnapshots, baseSnapshot),
    [baseSnapshot, olderSnapshots],
  );
  const senderNames = useMemo(
    () =>
      new Map(
        mergedHistory.senderProfiles.map((profile, index) => [
          profile.userId,
          resolvePublicIdentityLabel(
            profile,
            formatPersonFallbackLabel(language, index + 1),
          ),
        ] as const),
      ),
    [language, mergedHistory.senderProfiles],
  );
  const messagesById = useMemo(
    () =>
      new Map(
        mergedHistory.messages.map((message) => [message.id, message] as const),
      ),
    [mergedHistory.messages],
  );
  const timelineItems = useMemo(
    () =>
      buildTimelineItems({
        language,
        lastReadMessageSeq: currentReadMessageSeq,
        messages: mergedHistory.messages,
        t,
      }),
    [currentReadMessageSeq, language, mergedHistory.messages, t],
  );
  const oldestLoadedSeq = normalizeComparableMessageSeq(
    mergedHistory.messages[0]?.seq ?? baseSnapshot.oldestMessageSeq,
  );
  const hasMoreOlder =
    olderSnapshots[0]?.hasMoreOlder ?? baseSnapshot.hasMoreOlder;

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

      setOlderSnapshots((currentSnapshots) => [
        nextSnapshot,
        ...currentSnapshots,
      ]);
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
  }, [olderSnapshots]);

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
            latestVisibleMessageSeq={latestVisibleMessageSeq}
            targetId="message-thread-scroll"
          />
        </DmThreadClientSubtree>
      ) : (
        <AutoScrollToLatest
          bottomSentinelId="message-thread-bottom-sentinel"
          conversationId={conversationId}
          latestVisibleMessageSeq={latestVisibleMessageSeq}
          targetId="message-thread-scroll"
        />
      )}
      {mergedHistory.messages.length === 0 ? (
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
                attachmentsByMessage={mergedHistory.attachmentsByMessage}
                conversationId={conversationId}
                conversationKind={conversationKind}
                currentUserId={currentUserId}
                encryptedEnvelopesByMessage={mergedHistory.encryptedEnvelopesByMessage}
                encryptedHistoryHintsByMessage={mergedHistory.encryptedHistoryHintsByMessage}
                language={language}
                latestVisibleMessageSeq={latestVisibleMessageSeq}
                message={item.message}
                messagesById={messagesById}
                otherParticipantReadSeq={otherParticipantReadSeq}
                otherParticipantUserId={otherParticipantUserId}
                reactionsByMessage={mergedHistory.reactionsByMessage}
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
            confirmedClientIds={confirmedClientIds}
            conversationId={conversationId}
            labels={{
              failed: t.chat.sendFailed,
              justNow: t.chat.justNow,
              retry: t.chat.retrySend,
              sending: t.chat.sending,
              sent: t.chat.sent,
            }}
          />
        </DmThreadClientSubtree>
      ) : (
        <OptimisticThreadMessages
          confirmedClientIds={confirmedClientIds}
          conversationId={conversationId}
          labels={{
            failed: t.chat.sendFailed,
            justNow: t.chat.justNow,
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
            key={`mark-read-${conversationId}-${currentReadMessageSeq ?? 'none'}-${latestVisibleMessageSeq ?? 'none'}`}
            latestVisibleMessageSeq={
              latestVisibleMessageSeq !== null &&
              Number.isFinite(latestVisibleMessageSeq)
                ? latestVisibleMessageSeq
                : null
            }
          />
        </DmThreadClientSubtree>
      ) : (
        <MarkConversationRead
          bottomSentinelId="message-thread-bottom-sentinel"
          conversationId={conversationId}
          currentReadMessageSeq={currentReadMessageSeq}
          key={`mark-read-${conversationId}-${currentReadMessageSeq ?? 'none'}-${latestVisibleMessageSeq ?? 'none'}`}
          latestVisibleMessageSeq={
            latestVisibleMessageSeq !== null &&
            Number.isFinite(latestVisibleMessageSeq)
              ? latestVisibleMessageSeq
              : null
          }
        />
      )}
    </>
  );
}
