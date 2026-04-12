'use client';

import type { InboxAttachmentPreviewKind } from '@/modules/messaging/inbox/preview-kind';
import { requestChatUnreadBadgeRefresh } from '@/modules/messaging/push/chat-unread-badge-events';

export type InboxConversationLiveSummary = {
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
  removed?: boolean;
  unreadCount: number;
};

const inboxSummaryStore = new Map<string, InboxConversationLiveSummary>();
const inboxSummaryFallbackStore = new Map<string, InboxConversationLiveSummary>();
const inboxSummaryListeners = new Map<string, Set<() => void>>();
const inboxSummaryRevisionListeners = new Set<() => void>();
let inboxSummaryRevision = 0;

function normalizeInboxSummaryRealtimeString(
  row: Record<string, unknown> | null,
  key: string,
) {
  if (!row || !Object.prototype.hasOwnProperty.call(row, key)) {
    return undefined;
  }

  const value = row[key];

  if (typeof value === 'string') {
    return value;
  }

  if (value === null) {
    return null;
  }

  return undefined;
}

function normalizeInboxSummaryRealtimeNumber(
  row: Record<string, unknown> | null,
  key: string,
) {
  if (!row || !Object.prototype.hasOwnProperty.call(row, key)) {
    return undefined;
  }

  const value = row[key];

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  if (value === null) {
    return null;
  }

  return undefined;
}

function emitInboxSummaryRevisionChange() {
  inboxSummaryRevision += 1;

  for (const listener of inboxSummaryRevisionListeners) {
    listener();
  }
}

function areInboxConversationSummariesEqual(
  left: InboxConversationLiveSummary | null,
  right: InboxConversationLiveSummary | null,
) {
  if (left === right) {
    return true;
  }

  if (!left || !right) {
    return false;
  }

  return (
    left.conversationId === right.conversationId &&
    left.createdAt === right.createdAt &&
    left.hiddenAt === right.hiddenAt &&
    left.lastMessageAt === right.lastMessageAt &&
    left.lastReadAt === right.lastReadAt &&
    left.lastReadMessageSeq === right.lastReadMessageSeq &&
    left.latestMessageAttachmentKind === right.latestMessageAttachmentKind &&
    left.latestMessageBody === right.latestMessageBody &&
    left.latestMessageContentMode === right.latestMessageContentMode &&
    left.latestMessageDeletedAt === right.latestMessageDeletedAt &&
    left.latestMessageId === right.latestMessageId &&
    left.latestMessageKind === right.latestMessageKind &&
    left.latestMessageSenderId === right.latestMessageSenderId &&
    left.latestMessageSeq === right.latestMessageSeq &&
    left.removed === right.removed &&
    left.unreadCount === right.unreadCount
  );
}

function emitInboxConversationSummaryChange(conversationId: string) {
  const listeners = inboxSummaryListeners.get(conversationId);

  if (!listeners) {
    emitInboxSummaryRevisionChange();
  } else {
    for (const listener of listeners) {
      listener();
    }

    emitInboxSummaryRevisionChange();
  }
}

export function readInboxConversationLiveSummary(
  conversationId: string,
): InboxConversationLiveSummary | null {
  const normalizedConversationId = conversationId.trim();

  if (!normalizedConversationId) {
    return null;
  }

  return (
    inboxSummaryStore.get(normalizedConversationId) ??
    inboxSummaryFallbackStore.get(normalizedConversationId) ??
    null
  );
}

export function doesInboxConversationSummaryReflectMessageId(
  conversationId: string,
  messageId: string | null | undefined,
) {
  const normalizedMessageId = messageId?.trim() ?? '';

  if (!normalizedMessageId) {
    return false;
  }

  const summary = readInboxConversationLiveSummary(conversationId);

  return Boolean(summary && !summary.removed && summary.latestMessageId === normalizedMessageId);
}

export function doesInboxConversationSummaryReflectLatestMessageRecord(input: {
  conversationId: string;
  row: Record<string, unknown> | null;
}) {
  const summary = readInboxConversationLiveSummary(input.conversationId);

  if (!summary || summary.removed) {
    return false;
  }

  const messageId = normalizeInboxSummaryRealtimeString(input.row, 'id');

  if (!messageId || summary.latestMessageId !== messageId.trim()) {
    return false;
  }

  const body = normalizeInboxSummaryRealtimeString(input.row, 'body');
  const contentMode = normalizeInboxSummaryRealtimeString(
    input.row,
    'content_mode',
  );
  const deletedAt = normalizeInboxSummaryRealtimeString(input.row, 'deleted_at');
  const kind = normalizeInboxSummaryRealtimeString(input.row, 'kind');
  const senderId = normalizeInboxSummaryRealtimeString(input.row, 'sender_id');
  const seq = normalizeInboxSummaryRealtimeNumber(input.row, 'seq');

  return (
    (body === undefined || summary.latestMessageBody === body) &&
    (contentMode === undefined ||
      summary.latestMessageContentMode === contentMode) &&
    (deletedAt === undefined || summary.latestMessageDeletedAt === deletedAt) &&
    (kind === undefined || summary.latestMessageKind === kind) &&
    (senderId === undefined || summary.latestMessageSenderId === senderId) &&
    (seq === undefined || summary.latestMessageSeq === seq)
  );
}

export function doesInboxConversationSummaryReflectMembershipRecord(input: {
  conversationId: string;
  row: Record<string, unknown> | null;
}) {
  const summary = readInboxConversationLiveSummary(input.conversationId);

  if (!summary || summary.removed) {
    return false;
  }

  const hiddenAt = normalizeInboxSummaryRealtimeString(input.row, 'hidden_at');
  const lastReadAt = normalizeInboxSummaryRealtimeString(input.row, 'last_read_at');
  const lastReadMessageSeq = normalizeInboxSummaryRealtimeNumber(
    input.row,
    'last_read_message_seq',
  );
  const hasComparableField =
    hiddenAt !== undefined ||
    lastReadAt !== undefined ||
    lastReadMessageSeq !== undefined;

  if (!hasComparableField) {
    return false;
  }

  return (
    (hiddenAt === undefined || summary.hiddenAt === hiddenAt) &&
    (lastReadAt === undefined || summary.lastReadAt === lastReadAt) &&
    (lastReadMessageSeq === undefined ||
      summary.lastReadMessageSeq === lastReadMessageSeq)
  );
}

export function doesInboxConversationSummaryReflectConversationRecord(input: {
  conversationId: string;
  row: Record<string, unknown> | null;
}) {
  const summary = readInboxConversationLiveSummary(input.conversationId);

  if (!summary || summary.removed) {
    return false;
  }

  const lastMessageAt = normalizeInboxSummaryRealtimeString(
    input.row,
    'last_message_at',
  );
  const lastMessageBody = normalizeInboxSummaryRealtimeString(
    input.row,
    'last_message_body',
  );
  const lastMessageContentMode = normalizeInboxSummaryRealtimeString(
    input.row,
    'last_message_content_mode',
  );
  const lastMessageDeletedAt = normalizeInboxSummaryRealtimeString(
    input.row,
    'last_message_deleted_at',
  );
  const lastMessageId = normalizeInboxSummaryRealtimeString(
    input.row,
    'last_message_id',
  );
  const lastMessageKind = normalizeInboxSummaryRealtimeString(
    input.row,
    'last_message_kind',
  );
  const lastMessageSenderId = normalizeInboxSummaryRealtimeString(
    input.row,
    'last_message_sender_id',
  );
  const lastMessageSeq = normalizeInboxSummaryRealtimeNumber(
    input.row,
    'last_message_seq',
  );
  const hasComparableField =
    lastMessageAt !== undefined ||
    lastMessageBody !== undefined ||
    lastMessageContentMode !== undefined ||
    lastMessageDeletedAt !== undefined ||
    lastMessageId !== undefined ||
    lastMessageKind !== undefined ||
    lastMessageSenderId !== undefined ||
    lastMessageSeq !== undefined;

  if (!hasComparableField) {
    return false;
  }

  return (
    (lastMessageAt === undefined || summary.lastMessageAt === lastMessageAt) &&
    (lastMessageBody === undefined ||
      summary.latestMessageBody === lastMessageBody) &&
    (lastMessageContentMode === undefined ||
      summary.latestMessageContentMode === lastMessageContentMode) &&
    (lastMessageDeletedAt === undefined ||
      summary.latestMessageDeletedAt === lastMessageDeletedAt) &&
    (lastMessageId === undefined || summary.latestMessageId === lastMessageId) &&
    (lastMessageKind === undefined ||
      summary.latestMessageKind === lastMessageKind) &&
    (lastMessageSenderId === undefined ||
      summary.latestMessageSenderId === lastMessageSenderId) &&
    (lastMessageSeq === undefined || summary.latestMessageSeq === lastMessageSeq)
  );
}

function resolveEffectiveUnreadCount(summary: InboxConversationLiveSummary | null) {
  if (!summary || summary.removed) {
    return 0;
  }

  return Math.max(0, summary.unreadCount);
}

function emitInboxUnreadBadgeRefreshIfNeeded(
  previous: InboxConversationLiveSummary | null,
  next: InboxConversationLiveSummary | null,
) {
  if (resolveEffectiveUnreadCount(previous) === resolveEffectiveUnreadCount(next)) {
    return;
  }

  requestChatUnreadBadgeRefresh();
}

export function subscribeToInboxSummaryRevision(listener: () => void) {
  inboxSummaryRevisionListeners.add(listener);

  return () => {
    inboxSummaryRevisionListeners.delete(listener);
  };
}

export function getInboxSummaryRevisionSnapshot() {
  return inboxSummaryRevision;
}

export function subscribeToInboxConversationSummary(
  conversationId: string,
  listener: () => void,
) {
  const normalizedConversationId = conversationId.trim();

  if (!normalizedConversationId) {
    return () => undefined;
  }

  const listeners =
    inboxSummaryListeners.get(normalizedConversationId) ?? new Set<() => void>();
  listeners.add(listener);
  inboxSummaryListeners.set(normalizedConversationId, listeners);

  return () => {
    const currentListeners = inboxSummaryListeners.get(normalizedConversationId);

    if (!currentListeners) {
      return;
    }

    currentListeners.delete(listener);

    if (currentListeners.size === 0) {
      inboxSummaryListeners.delete(normalizedConversationId);
    }
  };
}

export function getInboxConversationSummarySnapshot(
  conversationId: string,
  fallback: InboxConversationLiveSummary,
) {
  const normalizedConversationId = conversationId.trim();

  if (!normalizedConversationId) {
    return fallback;
  }

  const liveSummary = inboxSummaryStore.get(normalizedConversationId);

  if (liveSummary) {
    return liveSummary;
  }

  const normalizedFallback = {
    ...fallback,
    conversationId: normalizedConversationId,
  };
  const existingFallback =
    inboxSummaryFallbackStore.get(normalizedConversationId) ?? null;

  if (areInboxConversationSummariesEqual(existingFallback, normalizedFallback)) {
    return existingFallback ?? normalizedFallback;
  }

  inboxSummaryFallbackStore.set(normalizedConversationId, normalizedFallback);
  return normalizedFallback;
}

export function hydrateInboxConversationSummaries(
  summaries: InboxConversationLiveSummary[],
) {
  for (const summary of summaries) {
    const normalizedConversationId = summary.conversationId.trim();

    if (!normalizedConversationId) {
      continue;
    }

    const existing = inboxSummaryStore.get(normalizedConversationId) ?? null;
    const normalizedSummary = {
      ...summary,
      conversationId: normalizedConversationId,
    };
    const nextValue = areInboxConversationSummariesEqual(
      existing,
      normalizedSummary,
    )
      ? existing
      : normalizedSummary;

    if (existing === nextValue) {
      continue;
    }

    inboxSummaryFallbackStore.delete(normalizedConversationId);
    inboxSummaryStore.set(normalizedConversationId, nextValue ?? normalizedSummary);
    emitInboxUnreadBadgeRefreshIfNeeded(existing, nextValue ?? normalizedSummary);
    emitInboxConversationSummaryChange(normalizedConversationId);
  }
}

export function patchInboxConversationSummary(
  summary: InboxConversationLiveSummary,
) {
  const normalizedConversationId = summary.conversationId.trim();

  if (!normalizedConversationId) {
    return;
  }

  const nextValue = {
    ...summary,
    conversationId: normalizedConversationId,
  };
  const existing = inboxSummaryStore.get(normalizedConversationId) ?? null;

  if (areInboxConversationSummariesEqual(existing, nextValue)) {
    return;
  }

  inboxSummaryFallbackStore.delete(normalizedConversationId);
  inboxSummaryStore.set(normalizedConversationId, nextValue);
  emitInboxUnreadBadgeRefreshIfNeeded(existing, nextValue);
  emitInboxConversationSummaryChange(normalizedConversationId);
}

export function updateInboxConversationSummary(
  conversationId: string,
  updater: (
    current: InboxConversationLiveSummary | null,
  ) => InboxConversationLiveSummary,
) {
  const normalizedConversationId = conversationId.trim();

  if (!normalizedConversationId) {
    return;
  }

  const current = inboxSummaryStore.get(normalizedConversationId) ?? null;
  const nextValue = {
    ...updater(current),
    conversationId: normalizedConversationId,
  };

  if (areInboxConversationSummariesEqual(current, nextValue)) {
    return;
  }

  inboxSummaryFallbackStore.delete(normalizedConversationId);
  inboxSummaryStore.set(normalizedConversationId, nextValue);
  emitInboxUnreadBadgeRefreshIfNeeded(current, nextValue);
  emitInboxConversationSummaryChange(normalizedConversationId);
}

export function markInboxConversationRemoved(conversationId: string) {
  const normalizedConversationId = conversationId.trim();

  if (!normalizedConversationId) {
    return;
  }

  const existing = inboxSummaryStore.get(normalizedConversationId);

  if (existing) {
    inboxSummaryFallbackStore.delete(normalizedConversationId);
    const nextValue = {
      ...existing,
      removed: true,
    };
    inboxSummaryStore.set(normalizedConversationId, nextValue);
    emitInboxUnreadBadgeRefreshIfNeeded(existing, nextValue);
  } else {
    inboxSummaryFallbackStore.delete(normalizedConversationId);
    const nextValue = {
      conversationId: normalizedConversationId,
      createdAt: null,
      hiddenAt: null,
      lastMessageAt: null,
      lastReadAt: null,
      lastReadMessageSeq: null,
      latestMessageAttachmentKind: null,
      latestMessageBody: null,
      latestMessageContentMode: null,
      latestMessageDeletedAt: null,
      latestMessageId: null,
      latestMessageKind: null,
      latestMessageSenderId: null,
      latestMessageSeq: null,
      removed: true,
      unreadCount: 0,
    };
    inboxSummaryStore.set(normalizedConversationId, nextValue);
    emitInboxUnreadBadgeRefreshIfNeeded(null, nextValue);
  }

  emitInboxConversationSummaryChange(normalizedConversationId);
}
