'use client';

export type InboxConversationLiveSummary = {
  conversationId: string;
  createdAt: string | null;
  hiddenAt: string | null;
  lastMessageAt: string | null;
  lastReadAt: string | null;
  lastReadMessageSeq: number | null;
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
const inboxSummaryListeners = new Map<string, Set<() => void>>();

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
    return;
  }

  for (const listener of listeners) {
    listener();
  }
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
  return inboxSummaryStore.get(conversationId.trim()) ?? fallback;
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

    inboxSummaryStore.set(normalizedConversationId, nextValue ?? normalizedSummary);
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

  inboxSummaryStore.set(normalizedConversationId, nextValue);
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

  inboxSummaryStore.set(normalizedConversationId, nextValue);
  emitInboxConversationSummaryChange(normalizedConversationId);
}

export function markInboxConversationRemoved(conversationId: string) {
  const normalizedConversationId = conversationId.trim();

  if (!normalizedConversationId) {
    return;
  }

  const existing = inboxSummaryStore.get(normalizedConversationId);

  if (existing) {
    inboxSummaryStore.set(normalizedConversationId, {
      ...existing,
      removed: true,
    });
  } else {
    inboxSummaryStore.set(normalizedConversationId, {
      conversationId: normalizedConversationId,
      createdAt: null,
      hiddenAt: null,
      lastMessageAt: null,
      lastReadAt: null,
      lastReadMessageSeq: null,
      latestMessageBody: null,
      latestMessageContentMode: null,
      latestMessageDeletedAt: null,
      latestMessageId: null,
      latestMessageKind: null,
      latestMessageSenderId: null,
      latestMessageSeq: null,
      removed: true,
      unreadCount: 0,
    });
  }

  emitInboxConversationSummaryChange(normalizedConversationId);
}
