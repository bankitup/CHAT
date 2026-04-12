'use client';

import dynamic from 'next/dynamic';
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
import {
  getChatClientTranslations,
  type AppLanguage,
} from '@/modules/i18n/client-chat';
import { getLocaleForLanguage } from '@/modules/i18n/client-shared';
import type { StoredDmE2eeEnvelope } from '@/modules/messaging/contract/dm-e2ee';
import type { EncryptedDmServerHistoryHint } from '@/modules/messaging/e2ee/ui-policy';
import {
  logBrokenThreadHistoryProof,
  summarizeBrokenThreadMessagePatches,
} from '@/modules/messaging/diagnostics/thread-history-proof';
import { getThreadLiveStateSnapshot } from '@/modules/messaging/realtime/thread-live-state-store';
import {
  readThreadMessagePatchSnapshot,
  useThreadMessagePatchedBody,
  useThreadMessagePatchedDeletedAt,
} from '@/modules/messaging/realtime/thread-message-patch-store';
import { withSpaceParam } from '@/modules/spaces/url';
import { DmReplyTargetSnippet, resolveReplyTargetAttachmentKind } from './dm-reply-target-snippet';
import {
  DmThreadClientSubtree,
  readLastDmThreadClientSubtree,
  type DmThreadClientDiagnostics,
} from './dm-thread-client-diagnostics';
import { EncryptedDmMessageBody } from './encrypted-dm-message-body';
import { EncryptedHistoryUnavailableState } from './encrypted-history-unavailable-state';
import { LiveOutgoingMessageStatus } from './live-outgoing-message-status';
import { MessageStatusIndicator } from './message-status-indicator';
import { ThreadEditedIndicator } from './thread-edited-indicator';
import { ThreadMessageRowContent } from './thread-message-row-content';
import { emitThreadLocalReplyTargetSelection } from './thread-local-reply-target';
import { logVoiceThreadProof } from './thread-voice-diagnostics';
import type {
  ActiveImagePreview,
  ConversationMessageRow,
  MessageAttachment,
  MessageReactionGroup,
} from './thread-history-types';

const ThreadDeleteMessageConfirm = dynamic(() =>
  import('./thread-delete-message-confirm').then(
    (mod) => mod.ThreadDeleteMessageConfirm,
  ),
);

const ThreadReactionGroups = dynamic(() =>
  import('./thread-reaction-groups').then((mod) => mod.ThreadReactionGroups),
);
const ThreadMessageQuickActionsPanel = dynamic(
  () =>
    import('./thread-message-quick-actions').then(
      (mod) => mod.ThreadMessageQuickActions,
    ),
);

type ThreadMessageRowProps = {
  activeDeleteMessageId: string | null;
  activeEditMessageId: string | null;
  activeSpaceId: string;
  attachmentsByMessage: Map<string, MessageAttachment[]>;
  compactHistoricalUnavailable: boolean;
  conversationId: string;
  conversationKind: 'dm' | 'group';
  currentUserId: string;
  encryptedEnvelopesByMessage: Map<string, StoredDmE2eeEnvelope>;
  encryptedHistoryHintsByMessage: Map<string, EncryptedDmServerHistoryHint>;
  historicalUnavailableContinuationCount: number;
  isClusteredWithNext: boolean;
  isClusteredWithPrevious: boolean;
  isPendingEncryptedCommitTransition: boolean;
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

const IMAGE_PREVIEW_CLICK_SUPPRESSION_MS = 420;
const MESSAGE_QUICK_ACTION_LONG_PRESS_MS = 280;
const ENCRYPTED_DM_PENDING_COMMIT_TRANSITION_GRACE_MS = 2400;
const EMPTY_MESSAGE_ATTACHMENTS: MessageAttachment[] = [];
const EMPTY_MESSAGE_REACTIONS: MessageReactionGroup[] = [];
const loggedThreadGuardDiagnosticKeys = new Set<string>();
const loggedBrokenThreadRowIssueKeys = new Set<string>();
const rowTimeFormatterByLanguage = new Map<AppLanguage, Intl.DateTimeFormat>();
const rowShortDateFormatterByLanguage = new Map<AppLanguage, Intl.DateTimeFormat>();
const rowShortDateWithYearFormatterByLanguage = new Map<
  AppLanguage,
  Intl.DateTimeFormat
>();

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

function getRowTimeFormatter(language: AppLanguage) {
  const existingFormatter = rowTimeFormatterByLanguage.get(language);

  if (existingFormatter) {
    return existingFormatter;
  }

  const formatter = new Intl.DateTimeFormat(getLocaleForLanguage(language), {
    hour: 'numeric',
    minute: '2-digit',
  });

  rowTimeFormatterByLanguage.set(language, formatter);
  return formatter;
}

function getRowShortDateFormatter(language: AppLanguage) {
  const existingFormatter = rowShortDateFormatterByLanguage.get(language);

  if (existingFormatter) {
    return existingFormatter;
  }

  const formatter = new Intl.DateTimeFormat(getLocaleForLanguage(language), {
    day: 'numeric',
    month: 'short',
  });

  rowShortDateFormatterByLanguage.set(language, formatter);
  return formatter;
}

function getRowShortDateWithYearFormatter(language: AppLanguage) {
  const existingFormatter = rowShortDateWithYearFormatterByLanguage.get(language);

  if (existingFormatter) {
    return existingFormatter;
  }

  const formatter = new Intl.DateTimeFormat(getLocaleForLanguage(language), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  rowShortDateWithYearFormatterByLanguage.set(language, formatter);
  return formatter;
}

function formatMessageTimestamp(
  value: string | null,
  language: AppLanguage,
  yesterdayLabel: string,
) {
  const parsedDate = parseSafeDate(value);

  if (!parsedDate) {
    return null;
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const messageDay = new Date(
    parsedDate.getFullYear(),
    parsedDate.getMonth(),
    parsedDate.getDate(),
  );
  const dayDifference =
    (today.getTime() - messageDay.getTime()) / (24 * 60 * 60 * 1000);

  if (dayDifference === 0) {
    return getRowTimeFormatter(language).format(parsedDate);
  }

  if (dayDifference === 1) {
    return yesterdayLabel;
  }

  return (parsedDate.getFullYear() === now.getFullYear()
    ? getRowShortDateFormatter(language)
    : getRowShortDateWithYearFormatter(language)
  ).format(parsedDate);
}

export function normalizeMessageBodyText(value: unknown) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed || null;
}

export function normalizeAttachmentSignedUrl(value: unknown) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed || null;
}

function shouldLogThreadGuardDiagnostics() {
  return process.env.NEXT_PUBLIC_CHAT_DEBUG_DM_THREAD_CLIENT === '1';
}

function logThreadGuardDiagnostic(
  issue: string,
  dedupeKey: string,
  details: Record<string, unknown>,
) {
  if (!shouldLogThreadGuardDiagnostics()) {
    return;
  }

  const diagnosticKey = `${issue}:${dedupeKey}`;

  if (loggedThreadGuardDiagnosticKeys.has(diagnosticKey)) {
    return;
  }

  loggedThreadGuardDiagnosticKeys.add(diagnosticKey);
  console.info('[chat-thread-guard]', issue, details);
}

function logBrokenThreadRowIssue(
  conversationId: string,
  messageId: string,
  issues: string[],
  details: Record<string, unknown>,
) {
  if (issues.length === 0) {
    return;
  }

  const issueKey = `${conversationId}:${messageId}:${issues.join('|')}`;

  if (loggedBrokenThreadRowIssueKeys.has(issueKey)) {
    return;
  }

  loggedBrokenThreadRowIssueKeys.add(issueKey);
  logBrokenThreadHistoryProof('row:issue-detected', {
    conversationId,
    details: {
      issues,
      messageId,
      ...details,
    },
    level: 'warn',
  });
}

function getRenderableAttachmentKey(
  attachment: MessageAttachment,
  index: number,
) {
  const attachmentId =
    typeof attachment.id === 'string' ? attachment.id.trim() : '';

  if (attachmentId) {
    return attachmentId;
  }

  const fallbackKey = [
    typeof attachment.messageId === 'string' ? attachment.messageId.trim() : '',
    typeof attachment.objectPath === 'string' ? attachment.objectPath.trim() : '',
    typeof attachment.fileName === 'string' ? attachment.fileName.trim() : '',
    typeof attachment.createdAt === 'string' ? attachment.createdAt.trim() : '',
    String(index),
  ]
    .filter(Boolean)
    .join(':');

  return fallbackKey || `attachment-${index}`;
}

export function filterRenderableMessageAttachments(
  messageId: string,
  attachments: MessageAttachment[],
) {
  if (!attachments.length) {
    return attachments;
  }

  let filteredAttachments: MessageAttachment[] | null = null;
  const droppedAttachmentIds: string[] = [];

  for (const [index, attachment] of attachments.entries()) {
    const attachmentMessageId =
      typeof attachment.messageId === 'string'
        ? attachment.messageId.trim()
        : '';

    if (!attachmentMessageId || attachmentMessageId === messageId) {
      if (filteredAttachments) {
        filteredAttachments.push(attachment);
      }

      continue;
    }

    if (filteredAttachments === null) {
      filteredAttachments = attachments.slice(0, index);
    }

    droppedAttachmentIds.push(getRenderableAttachmentKey(attachment, index));
  }

  if (filteredAttachments === null) {
    return attachments;
  }

  logThreadGuardDiagnostic(
    'attachment-mismatch-dropped',
    `${messageId}:${droppedAttachmentIds.join(',')}`,
    {
      droppedAttachmentIds,
      droppedCount: attachments.length - filteredAttachments.length,
      messageId,
      totalAttachmentCount: attachments.length,
    },
  );

  return filteredAttachments;
}

function hasRenderableCommittedAttachment(attachments: MessageAttachment[]) {
  if (!attachments.length) {
    return false;
  }

  const imageAttachments = attachments.filter((attachment) => attachment.isImage);

  if (imageAttachments.length > 0) {
    return imageAttachments.some((attachment) =>
      Boolean(normalizeAttachmentSignedUrl(attachment.signedUrl)),
    );
  }

  return attachments.some((attachment) =>
    Boolean(normalizeAttachmentSignedUrl(attachment.signedUrl)),
  );
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
  actionMessageId?: string | null;
  conversationId: string;
  deleteMessageId?: string | null;
  details?: string | null;
  editMessageId?: string | null;
  error?: string | null;
  hash?: string | null;
  replyToMessageId?: string | null;
  saved?: string | null;
  spaceId: string;
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

function isEncryptedDmMessage(value: {
  content_mode?: string | null;
  deleted_at?: string | null;
  kind: string | null;
}) {
  return (
    (value.kind === 'text' || value.kind === 'attachment') &&
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
    diagnosticHintCode: input.diagnosticHintCode ?? null,
    envelopePresent: input.envelopePresent,
    hasUsableClientId:
      typeof input.clientId === 'string' && input.clientId.trim().length > 0,
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

  if (input.message.kind !== 'text' && input.message.kind !== 'attachment') {
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

  if (input.message.body !== null && typeof input.message.body !== 'string') {
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

function getMessageInteractiveTargetElement(target: EventTarget | null) {
  if (target instanceof Element) {
    return target;
  }

  if (target instanceof Node) {
    return target.parentElement;
  }

  return null;
}

function isMessageQuickActionInteractiveTarget(target: EventTarget | null) {
  const targetElement = getMessageInteractiveTargetElement(target);

  if (!targetElement) {
    return false;
  }

  if (targetElement.closest('[data-message-image-preview="true"]')) {
    return false;
  }

  if (targetElement.closest('[data-message-voice-interactive="true"]')) {
    return true;
  }

  if (targetElement.closest('[data-message-quick-actions-surface="true"]')) {
    return true;
  }

  return Boolean(
    targetElement.closest(
      'a,button,input,textarea,select,summary,audio,[role="button"],[role="link"]',
    ),
  );
}

function isVoiceInteractiveMessageTarget(target: EventTarget | null) {
  const targetElement = getMessageInteractiveTargetElement(target);

  if (!targetElement) {
    return false;
  }

  return Boolean(
    targetElement.closest('[data-message-voice-interactive="true"]'),
  );
}

export function getEncryptedHistoryHintForMessage(input: {
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

export function shouldRenderPendingOwnEncryptedCommitTransition(input: {
  currentUserId: string;
  envelope: StoredDmE2eeEnvelope | null;
  historyHint: EncryptedDmServerHistoryHint;
  message: ConversationMessageRow;
  pendingMessageIds: Set<string>;
}) {
  if (!isEncryptedDmMessage(input.message)) {
    return false;
  }

  if (input.message.sender_id !== input.currentUserId) {
    return false;
  }

  const normalizedClientId = input.message.client_id?.trim() || '';

  if (!normalizedClientId) {
    return false;
  }

  if (
    input.envelope ||
    input.historyHint.code === 'envelope-present' ||
    input.historyHint.code === 'policy-blocked-history'
  ) {
    return false;
  }

  if (input.pendingMessageIds.has(input.message.id)) {
    return true;
  }

  const createdAt = parseSafeDate(input.message.created_at);

  if (!createdAt) {
    return false;
  }

  return (
    Date.now() - createdAt.getTime() <=
    ENCRYPTED_DM_PENDING_COMMIT_TRANSITION_GRACE_MS
  );
}

export function isOwnAttachmentCommitTransitionPending(input: {
  attachments: MessageAttachment[];
  currentUserId: string;
  message: ConversationMessageRow;
  normalizedBody: string | null;
}) {
  return (
    input.message.kind === 'attachment' &&
    input.message.sender_id === input.currentUserId &&
    Boolean(input.message.client_id?.trim()) &&
    !input.normalizedBody &&
    !hasRenderableCommittedAttachment(input.attachments)
  );
}

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

function areVoicePlaybackVariantsEqual(
  left: MessageAttachment['voicePlaybackVariants'],
  right: MessageAttachment['voicePlaybackVariants'],
) {
  if (left === right) {
    return true;
  }

  const normalizedLeft = left ?? [];
  const normalizedRight = right ?? [];

  if (normalizedLeft.length !== normalizedRight.length) {
    return false;
  }

  return normalizedLeft.every((variant, index) => {
    const nextVariant = normalizedRight[index];

    return (
      variant.assetId === nextVariant?.assetId &&
      variant.durationMs === nextVariant.durationMs &&
      variant.fileName === nextVariant.fileName &&
      variant.mimeType === nextVariant.mimeType &&
      variant.role === nextVariant.role &&
      variant.source === nextVariant.source &&
      variant.storageBucket === nextVariant.storageBucket &&
      variant.storageObjectPath === nextVariant.storageObjectPath &&
      variant.transportSourceUrl === nextVariant.transportSourceUrl
    );
  });
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
      attachment.mimeType === nextAttachment.mimeType &&
      attachment.signedUrl === nextAttachment.signedUrl &&
      attachment.sizeBytes === nextAttachment.sizeBytes &&
      attachment.durationMs === nextAttachment.durationMs &&
      attachment.isAudio === nextAttachment.isAudio &&
      attachment.isImage === nextAttachment.isImage &&
      attachment.isVoiceMessage === nextAttachment.isVoiceMessage &&
      attachment.bucket === nextAttachment.bucket &&
      attachment.objectPath === nextAttachment.objectPath &&
      attachment.messageId === nextAttachment.messageId &&
      attachment.createdAt === nextAttachment.createdAt &&
      areVoicePlaybackVariantsEqual(
        attachment.voicePlaybackVariants,
        nextAttachment.voicePlaybackVariants,
      )
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
    previousProps.isPendingEncryptedCommitTransition !==
      nextProps.isPendingEncryptedCommitTransition ||
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

function resolveMessageRowClassName(input: {
  isClusteredWithNext: boolean;
  isClusteredWithPrevious: boolean;
  isOwnMessage: boolean;
}) {
  return [
    input.isOwnMessage ? 'message-row message-row-own' : 'message-row',
    input.isClusteredWithPrevious
      ? 'message-row-clustered-with-previous'
      : null,
    input.isClusteredWithNext ? 'message-row-clustered-with-next' : null,
  ]
    .filter(Boolean)
    .join(' ');
}

function resolveMessageCardClassName(input: {
  isClusteredWithNext: boolean;
  isClusteredWithPrevious: boolean;
  isDeletedMessage: boolean;
  isOwnMessage: boolean;
}) {
  return [
    input.isDeletedMessage
      ? input.isOwnMessage
        ? 'message-card message-card-own message-card-deleted'
        : 'message-card message-card-deleted'
      : input.isOwnMessage
        ? 'message-card message-card-own'
        : 'message-card',
    input.isClusteredWithPrevious
      ? 'message-card-clustered-with-previous'
      : null,
    input.isClusteredWithNext ? 'message-card-clustered-with-next' : null,
  ]
    .filter(Boolean)
    .join(' ');
}

function resolveMessageBubbleClassName(input: {
  hasReplyReference: boolean;
  isClusteredWithNext: boolean;
  isClusteredWithPrevious: boolean;
  isOwnMessage: boolean;
  shouldRenderCompactHistoricalUnavailableBubble: boolean;
  shouldRenderCompactImageBubble: boolean;
}) {
  return [
    'message-bubble',
    input.isOwnMessage ? 'message-bubble-own' : null,
    input.hasReplyReference ? 'message-bubble-with-reply' : null,
    input.shouldRenderCompactImageBubble
      ? 'message-bubble-compact-media'
      : null,
    input.shouldRenderCompactHistoricalUnavailableBubble
      ? 'message-bubble-encrypted-history-continuation'
      : null,
    input.isClusteredWithPrevious
      ? 'message-bubble-clustered-with-previous'
      : null,
    input.isClusteredWithNext ? 'message-bubble-clustered-with-next' : null,
  ]
    .filter(Boolean)
    .join(' ');
}

type ThreadMessageRowFallbackProps = {
  isClusteredWithNext: boolean;
  isClusteredWithPrevious: boolean;
  isOwnMessage: boolean;
  language: AppLanguage;
  messageId: string;
};

function ThreadMessageRowFallback({
  isClusteredWithNext,
  isClusteredWithPrevious,
  isOwnMessage,
  language,
  messageId,
}: ThreadMessageRowFallbackProps) {
  const t = getChatClientTranslations(language);

  return (
    <article
      className={resolveMessageRowClassName({
        isClusteredWithNext,
        isClusteredWithPrevious,
        isOwnMessage,
      })}
      data-thread-message-row-fallback="true"
    >
      <div
        className={resolveMessageCardClassName({
          isClusteredWithNext,
          isClusteredWithPrevious,
          isDeletedMessage: false,
          isOwnMessage,
        })}
        id={`message-${messageId}`}
        tabIndex={-1}
      >
        <div
          className={
            isOwnMessage
              ? 'message-bubble-shell message-bubble-shell-own'
              : 'message-bubble-shell'
          }
        >
          <div
            className={resolveMessageBubbleClassName({
              hasReplyReference: false,
              isClusteredWithNext,
              isClusteredWithPrevious,
              isOwnMessage,
              shouldRenderCompactHistoricalUnavailableBubble: false,
              shouldRenderCompactImageBubble: false,
            })}
          >
            <p className="message-body">{t.chat.unavailableRightNow}</p>
          </div>
        </div>
      </div>
    </article>
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
  isPendingEncryptedCommitTransition,
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
  const t = getChatClientTranslations(language);
  const quickActionsContainerRef = useRef<HTMLDivElement | null>(null);
  const quickActionsSurfaceRef = useRef<HTMLDivElement | null>(null);
  const replyTargetHighlightTimeoutRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const longPressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const imagePreviewClickSuppressedUntilRef = useRef(0);
  const longPressPointerRef = useRef<{
    isVoiceTarget: boolean;
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
    !isEncryptedDmMessage(message);
  const isMessageInDeleteMode =
    activeDeleteMessageId === message.id && isOwnMessage && !isDeletedMessage;
  const rawMessageAttachments =
    attachmentsByMessage.get(message.id) ?? EMPTY_MESSAGE_ATTACHMENTS;
  const messageAttachments = filterRenderableMessageAttachments(
    message.id,
    rawMessageAttachments,
  );
  const isPendingOwnAttachmentCommitTransition =
    isOwnAttachmentCommitTransitionPending({
      attachments: messageAttachments,
      currentUserId,
      message,
      normalizedBody: normalizedMessageBody,
    });
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
  const shouldRenderEncryptedAttachmentComposite =
    isEncryptedDmMessage(message) &&
    !isDeletedMessage &&
    nonVoiceAttachments.length > 0;
  const shouldRenderCompactImageBubble =
    !isDeletedMessage &&
    !shouldRenderEncryptedAttachmentComposite &&
    !normalizedMessageBody &&
    nonVoiceAttachments.length > 0 &&
    nonVoiceAttachments.every((attachment) => attachment.isImage);
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
  const shouldRenderPendingEncryptedCommitShell =
    isPendingEncryptedCommitTransition &&
    isOwnMessage &&
    isEncryptedDmMessage(message);
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
    ? filterRenderableMessageAttachments(
        repliedMessage.id,
        attachmentsByMessage.get(repliedMessage.id) ?? EMPTY_MESSAGE_ATTACHMENTS,
      )
    : EMPTY_MESSAGE_ATTACHMENTS;
  const replyTargetAttachmentKind = resolveReplyTargetAttachmentKind(
    repliedMessageAttachments,
  );
  const encryptedRenderBranch = normalizeEncryptedDmBranchLabel(isOwnMessage);
  const canShowQuickActions =
    !isDeletedMessage &&
    !isMessageInEditMode &&
    !isMessageInDeleteMode;
  const initialMessageReactions =
    reactionsByMessage.get(message.id) ?? EMPTY_MESSAGE_REACTIONS;
  const shouldRenderReactionGroups =
    !isDeletedMessage && initialMessageReactions.length > 0;
  const currentMessageReplyTargetAttachmentKind =
    resolveReplyTargetAttachmentKind(messageAttachments);
  const messageRowIssues: string[] = [];

  if (message.id.trim().length !== message.id.length) {
    messageRowIssues.push('message.id-untrimmed');
  }

  if (
    typeof message.conversation_id === 'string' &&
    message.conversation_id.trim().length > 0 &&
    message.conversation_id.trim() !== conversationId
  ) {
    messageRowIssues.push('message.conversation-id-mismatch');
  }

  if (!Number.isFinite(messageSeq)) {
    messageRowIssues.push('message.seq-invalid');
  }

  if (patchedBody !== null && typeof patchedBody !== 'string') {
    messageRowIssues.push('patch.body-invalid');
  }

  if (patchedDeletedAt !== null && typeof patchedDeletedAt !== 'string') {
    messageRowIssues.push('patch.deleted-at-invalid');
  }

  if (rawMessageAttachments.length !== messageAttachments.length) {
    messageRowIssues.push('attachment.guard-drop');
  }

  if (message.kind === 'voice' && primaryVoiceAttachment === null) {
    messageRowIssues.push('voice.attachment-missing');
  }

  if (
    message.kind === 'voice' &&
    primaryVoiceAttachment &&
    !normalizeAttachmentSignedUrl(primaryVoiceAttachment.signedUrl)
  ) {
    messageRowIssues.push('voice.signed-url-missing');
  }

  if (
    primaryVoiceAttachment &&
    primaryVoiceAttachment.voicePlaybackVariants !== undefined &&
    primaryVoiceAttachment.voicePlaybackVariants !== null &&
    !Array.isArray(primaryVoiceAttachment.voicePlaybackVariants)
  ) {
    messageRowIssues.push('voice.variant-metadata-invalid');
  }

  logBrokenThreadRowIssue(conversationId, message.id, messageRowIssues, {
    attachmentCount: rawMessageAttachments.length,
    contentMode: message.content_mode ?? null,
    filteredAttachmentCount: messageAttachments.length,
    hasVoiceAttachment: Boolean(primaryVoiceAttachment),
    kind: message.kind,
    patchedBodyType: patchedBody === null ? 'null' : typeof patchedBody,
    patchedDeletedAtType:
      patchedDeletedAt === null ? 'null' : typeof patchedDeletedAt,
    seq: message.seq,
    voiceAttachmentMimeType: primaryVoiceAttachment?.mimeType ?? null,
    voiceAttachmentSignedUrl: Boolean(
      normalizeAttachmentSignedUrl(primaryVoiceAttachment?.signedUrl ?? null),
    ),
    voiceVariantCount: Array.isArray(primaryVoiceAttachment?.voicePlaybackVariants)
      ? primaryVoiceAttachment.voicePlaybackVariants.length
      : null,
  });

  const inlineEditLabels = useMemo(
    () => ({
      cancel: t.chat.cancel,
      save: t.chat.save,
    }),
    [t.chat.cancel, t.chat.save],
  );
  const deleteConfirmLabels = useMemo(
    () => ({
      cancel: t.chat.cancel,
      confirm: t.chat.delete,
      prompt: t.chat.deleteConfirm,
    }),
    [t.chat.cancel, t.chat.delete, t.chat.deleteConfirm],
  );
  const liveOutgoingStatusLabels = useMemo(
    () => ({
      delivered: t.chat.delivered,
      seen: t.chat.seen,
      sent: t.chat.sent,
    }),
    [t.chat.delivered, t.chat.seen, t.chat.sent],
  );
  const sentStatusFallback = useMemo(
    () => <MessageStatusIndicator label={t.chat.sent} status="sent" />,
    [t.chat.sent],
  );

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

  const openQuickActions = useCallback(() => {
    if (!canShowQuickActions) {
      return;
    }

    imagePreviewClickSuppressedUntilRef.current =
      Date.now() + IMAGE_PREVIEW_CLICK_SUPPRESSION_MS;
    clearLongPress();
    setIsQuickActionsOpen(true);
  }, [canShowQuickActions, clearLongPress]);

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

    const target = document.getElementById(`message-${message.reply_to_message_id}`);

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
      const isVoiceTarget = isVoiceInteractiveMessageTarget(event.target);
      const isInteractiveTarget =
        isMessageQuickActionInteractiveTarget(event.target);

      if (!canShowQuickActions || event.button !== 0 || isInteractiveTarget) {
        if (isVoiceTarget) {
          logVoiceThreadProof('gesture-shell-ignored-voice-target', {
            interactiveTarget: isInteractiveTarget,
            messageId: message.id,
          });
        }
        return;
      }

      clearLongPress();
      longPressPointerRef.current = {
        isVoiceTarget,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
      };
      if (isVoiceTarget) {
        logVoiceThreadProof('gesture-long-press-armed', {
          messageId: message.id,
          pointerId: event.pointerId,
        });
      }
      longPressTimeoutRef.current = setTimeout(() => {
        if (isVoiceTarget) {
          logVoiceThreadProof('gesture-long-press-recognized', {
            messageId: message.id,
            pointerId: event.pointerId,
          });
          logVoiceThreadProof('gesture-popup-open-entered', {
            messageId: message.id,
            trigger: 'long-press',
          });
        }
        longPressTimeoutRef.current = null;
        openQuickActions();
      }, MESSAGE_QUICK_ACTION_LONG_PRESS_MS);
    },
    [canShowQuickActions, clearLongPress, message.id, openQuickActions],
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
      const isVoiceTarget = isVoiceInteractiveMessageTarget(event.target);

      if (
        !canShowQuickActions ||
        isMessageQuickActionInteractiveTarget(event.target)
      ) {
        return;
      }

      event.preventDefault();
      if (isVoiceTarget) {
        logVoiceThreadProof('gesture-popup-open-entered', {
          messageId: message.id,
          trigger: 'contextmenu',
        });
      }
      openQuickActions();
    },
    [canShowQuickActions, message.id, openQuickActions],
  );

  const handleImageAttachmentPreview = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>) => {
      if (Date.now() < imagePreviewClickSuppressedUntilRef.current) {
        imagePreviewClickSuppressedUntilRef.current = 0;
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      closeQuickActions();
      const previewCaption = normalizeMessageBodyText(
        event.currentTarget.dataset.previewCaption,
      );
      const signedUrl = normalizeAttachmentSignedUrl(
        event.currentTarget.dataset.previewUrl,
      );

      if (!signedUrl) {
        return;
      }

      onOpenImagePreview({
        caption: previewCaption,
        signedUrl,
      });
    },
    [closeQuickActions, onOpenImagePreview],
  );

  const handleReplyAction = (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    closeQuickActions();
    emitThreadLocalReplyTargetSelection({
      conversationId,
      target: {
        attachmentKind: currentMessageReplyTargetAttachmentKind,
        body: patchedBody,
        deletedAt: patchedDeletedAt,
        id: message.id,
        isEncrypted: isEncryptedDmMessage(message),
        kind: message.kind,
        senderId: message.sender_id ?? null,
        senderLabel:
          senderNames.get(message.sender_id ?? '') || t.chat.unknownUser,
      },
    });
  };

  const canInlineMessageMeta =
    Boolean(normalizedMessageBody) &&
    !message.reply_to_message_id &&
    !isDeletedMessage &&
    !primaryVoiceAttachment &&
    nonVoiceAttachments.length === 0 &&
    !isEncryptedDmMessage(message);
  const messageTimestampLabel =
    formatMessageTimestamp(message.created_at, language, t.chat.yesterday) ||
    t.chat.justNow;
  const messageMetaContent = (
    <>
      <span>{messageTimestampLabel}</span>
      <ThreadEditedIndicator
        conversationId={conversationId}
        editedAt={message.edited_at}
        label={t.chat.edited}
        messageId={message.id}
      />
      {shouldRenderPendingEncryptedCommitShell ? (
        <MessageStatusIndicator label={t.chat.sending} status="pending" />
      ) : isOwnMessage && outgoingMessageStatus ? (
        otherParticipantUserId ? (
          <DmThreadClientSubtree
            conversationId={conversationId}
            {...threadClientDiagnostics}
            fallback={sentStatusFallback}
            messageId={message.id}
            surface="live-outgoing-message-status"
          >
            <LiveOutgoingMessageStatus
              conversationId={conversationId}
              labels={liveOutgoingStatusLabels}
              messageSeq={message.seq}
              otherParticipantReadSeq={otherParticipantReadSeq}
              status={outgoingMessageStatus}
            />
          </DmThreadClientSubtree>
        ) : (
          <MessageStatusIndicator
            label={outgoingMessageStatus === 'seen' ? t.chat.seen : t.chat.sent}
            status={outgoingMessageStatus}
          />
        )
      ) : null}
    </>
  );

  const temporaryEncryptedResolutionFallback = (
    <div
      data-dm-e2ee-access-state="temporary-local-read-failure"
      data-dm-e2ee-debug-bucket={
        process.env.NEXT_PUBLIC_CHAT_DEBUG_DM_E2EE_BOOTSTRAP === '1'
          ? encryptedHistoryHint.code
          : undefined
      }
    >
      <p className="message-body">{t.chat.encryptedMessage}</p>
      {process.env.NEXT_PUBLIC_CHAT_DEBUG_DM_E2EE_BOOTSTRAP === '1' ? (
        <p className="message-encryption-debug-label">
          {encryptedHistoryHint.code}
        </p>
      ) : null}
    </div>
  );

  if (isEncryptedDmMessage(message)) {
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

  if (isEncryptedDmMessage(message) && !canAttemptEncryptedRender) {
    logEncryptedDmRenderFallback({
      clientId: message.client_id,
      conversationId,
      diagnosticHintCode: encryptedHistoryHint.code,
      envelopePresent: Boolean(encryptedEnvelope),
      messageId: message.id,
    });
  }

  if (isPendingOwnAttachmentCommitTransition) {
    return null;
  }

  const encryptedMessageBodyContent = isEncryptedDmMessage(message) ? (
    canAttemptEncryptedRender ? (
      <DmThreadClientSubtree
        conversationId={conversationId}
        {...threadClientDiagnostics}
        fallback={
          isUnavailableHistoricalEncryptedHint ? (
            <EncryptedHistoryUnavailableState
              accessState={encryptedHistoryFallbackAccessState}
              compact={compactHistoricalUnavailable}
              continuationCount={historicalUnavailableContinuationCount}
              note={encryptedHistoryFallbackNote}
              title={
                compactHistoricalUnavailable
                  ? t.chat.encryptedMessage
                  : t.chat.olderEncryptedMessage
              }
            />
          ) : (
            temporaryEncryptedResolutionFallback
          )
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
          historyUnavailableNoteLabel={t.chat.encryptedHistoryUnavailableNote}
          messageCreatedAt={message.created_at}
          messageId={message.id}
          messageSenderId={message.sender_id}
          policyUnavailableNoteLabel={t.chat.encryptedHistoryPolicyBlockedNote}
          preferTemporaryResolvingState={isPendingEncryptedCommitTransition}
          retryLabel={t.chat.retryEncryptedAction}
          setupUnavailableLabel={t.chat.encryptedMessageSetupUnavailable}
          shouldCachePreview={conversationKind === 'dm' && isLatestConversationMessage}
          unavailableLabel={t.chat.encryptedMessageUnavailable}
        />
      </DmThreadClientSubtree>
    ) : isUnavailableHistoricalEncryptedHint ? (
      <EncryptedHistoryUnavailableState
        accessState={encryptedHistoryFallbackAccessState}
        compact={compactHistoricalUnavailable}
        continuationCount={historicalUnavailableContinuationCount}
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
        note={encryptedHistoryFallbackNote}
        title={
          compactHistoricalUnavailable
            ? t.chat.encryptedMessage
            : t.chat.olderEncryptedMessage
        }
      />
    ) : (
      temporaryEncryptedResolutionFallback
    )
  ) : null;
  const replyReferenceContent =
    message.reply_to_message_id && !isDeletedMessage ? (
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
            attachmentFallbackLabel={t.chat.attachment}
            audioFallbackLabel={t.chat.audio}
            body={repliedMessage?.body ?? null}
            conversationId={conversationId}
            currentUserId={currentUserId}
            debugRequestId={threadClientDiagnostics.debugRequestId}
            deletedFallbackLabel={t.chat.messageDeleted}
            emptyFallbackLabel={t.chat.emptyMessage}
            encryptedFallbackLabel={t.chat.replyToEncryptedMessage}
            encryptedReferenceNote={null}
            fileFallbackLabel={t.chat.file}
            historicalEncryptedFallbackLabel={t.chat.olderEncryptedMessage}
            loadedFallbackLabel={t.chat.earlierMessage}
            messageId={message.id}
            photoFallbackLabel={t.chat.photo}
            surface="message-reply-reference"
            targetAttachmentKind={replyTargetAttachmentKind}
            targetDeleted={Boolean(repliedMessage?.deleted_at)}
            targetIsEncrypted={Boolean(
              repliedMessage && isEncryptedDmMessage(repliedMessage),
            )}
            targetIsLoaded={Boolean(repliedMessage)}
            targetKind={repliedMessage?.kind ?? null}
            targetMessageId={message.reply_to_message_id}
            voiceFallbackLabel={t.chat.voiceMessage}
          />
        </div>
      </button>
    ) : null;
  const editCancelHref = buildChatHref({
    conversationId,
    hash: `#message-${message.id}`,
    spaceId: activeSpaceId,
  });
  const isEncryptedEditFallback =
    activeEditMessageId === message.id &&
    isOwnMessage &&
    isEncryptedDmMessage(message);
  const bubbleClassName = resolveMessageBubbleClassName({
    hasReplyReference:
      Boolean(message.reply_to_message_id) && !isDeletedMessage,
    isClusteredWithNext,
    isClusteredWithPrevious,
    isOwnMessage,
    shouldRenderCompactHistoricalUnavailableBubble,
    shouldRenderCompactImageBubble,
  });

  return (
    <article
      className={resolveMessageRowClassName({
        isClusteredWithNext,
        isClusteredWithPrevious,
        isOwnMessage,
      })}
    >
      <div
        className={resolveMessageCardClassName({
          isClusteredWithNext,
          isClusteredWithPrevious,
          isDeletedMessage,
          isOwnMessage,
        })}
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
            <div ref={quickActionsSurfaceRef}>
              <ThreadMessageQuickActionsPanel
                conversationId={conversationId}
                currentUserId={currentUserId}
                initialReactions={initialMessageReactions}
                isOwnMessage={isOwnMessage}
                messageId={message.id}
                onReactionSelected={closeQuickActions}
                onReplyAction={handleReplyAction}
                placement={quickActionsPlacement}
                replyLabel={t.chat.reply}
              />
            </div>
          ) : null}
          <ThreadMessageRowContent
            bubbleClassName={bubbleClassName}
            canInlineMessageMeta={canInlineMessageMeta}
            conversationId={conversationId}
            editCancelHref={editCancelHref}
            emptyMessageLabel={t.chat.emptyMessage}
            encryptedEditCancelHref={editCancelHref}
            encryptedEditUnavailableLabel={t.chat.encryptedEditUnavailable}
            encryptedMessageBodyContent={encryptedMessageBodyContent}
            imagePreviewCaption={normalizedMessageBody}
            inlineEditInitialBody={
              isEncryptedDmMessage(message) ? '' : normalizedMessageBody ?? ''
            }
            inlineEditLabels={inlineEditLabels}
            isDeletedMessage={isDeletedMessage}
            isEncryptedEditFallback={isEncryptedEditFallback}
            isMessageInEditMode={isMessageInEditMode}
            isOwnMessage={isOwnMessage}
            language={language}
            message={message}
            messageAttachments={messageAttachments}
            messageDeletedLabel={t.chat.messageDeleted}
            messageMetaContent={messageMetaContent}
            nonVoiceAttachments={nonVoiceAttachments}
            normalizedMessageBody={normalizedMessageBody}
            onImagePreviewClick={handleImageAttachmentPreview}
            onRequestQuickActions={openQuickActions}
            primaryVoiceAttachment={primaryVoiceAttachment}
            replyReferenceContent={replyReferenceContent}
            shouldRenderEncryptedAttachmentComposite={
              shouldRenderEncryptedAttachmentComposite
            }
          />
        </div>
        {!canInlineMessageMeta ? (
          <span
            className={isOwnMessage ? 'message-meta message-meta-own' : 'message-meta'}
          >
            {messageMetaContent}
          </span>
        ) : null}

        {shouldRenderReactionGroups ? (
          <ThreadReactionGroups
            ariaLabel={t.chat.messageReactions}
            conversationId={conversationId}
            currentUserId={currentUserId}
            initialReactions={initialMessageReactions}
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
            labels={deleteConfirmLabels}
            messageId={message.id}
          />
        ) : null}
      </div>
    </article>
  );
}

const MemoizedThreadMessageRowContent = memo(
  ThreadMessageRowComponent,
  areThreadMessageRowPropsEqual,
);

MemoizedThreadMessageRowContent.displayName = 'MemoizedThreadMessageRowContent';

export const ThreadMessageRow = memo(function ThreadMessageRow(
  props: ThreadMessageRowProps,
) {
  const isOwnMessage = props.message.sender_id === props.currentUserId;

  return (
    <DmThreadClientSubtree
      conversationId={props.conversationId}
      debugRequestId={props.threadClientDiagnostics.debugRequestId}
      deploymentId={props.threadClientDiagnostics.deploymentId}
      fallback={
        <ThreadMessageRowFallback
          isClusteredWithNext={props.isClusteredWithNext}
          isClusteredWithPrevious={props.isClusteredWithPrevious}
          isOwnMessage={isOwnMessage}
          language={props.language}
          messageId={props.message.id}
        />
      }
      gitCommitSha={props.threadClientDiagnostics.gitCommitSha}
      messageId={props.message.id}
      onError={({ componentStack, error, ...details }) => {
        const patchSnapshot = readThreadMessagePatchSnapshot(props.conversationId);

        logBrokenThreadHistoryProof('row:render-error-captured', {
          conversationId: props.conversationId,
          details: {
            ...details,
            attachmentCount:
              props.attachmentsByMessage.get(props.message.id)?.length ?? 0,
            componentStack,
            errorMessage: error.message,
            errorName: error.name,
            lastClientSubtree: readLastDmThreadClientSubtree(),
            liveStateSnapshot: getThreadLiveStateSnapshot(props.conversationId),
            messageId: props.message.id,
            messageKind: props.message.kind,
            patchSummary: summarizeBrokenThreadMessagePatches(patchSnapshot),
          },
          level: 'error',
        });
      }}
      surface="thread-message-row"
      vercelUrl={props.threadClientDiagnostics.vercelUrl}
    >
      <MemoizedThreadMessageRowContent {...props} />
    </DmThreadClientSubtree>
  );
}, areThreadMessageRowPropsEqual);

ThreadMessageRow.displayName = 'ThreadMessageRow';
