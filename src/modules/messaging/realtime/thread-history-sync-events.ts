'use client';

export const LOCAL_THREAD_HISTORY_SYNC_REQUEST_EVENT =
  'chat:thread-history-sync-request';
export const LOCAL_THREAD_HISTORY_VISIBLE_MESSAGE_IDS_EVENT =
  'chat:thread-history-visible-message-ids';

export type ThreadHistorySyncRequestPayload = {
  conversationId: string;
  messageIds?: string[] | null;
  newerThanLatest?: boolean;
  reason?: string | null;
};

export type ThreadHistoryVisibleMessageIdsPayload = {
  conversationId: string;
  messageIds: string[];
};

const diagnosticsEnabled =
  typeof window !== 'undefined' &&
  process.env.NEXT_PUBLIC_CHAT_DEBUG_LIVE_REFRESH === '1';

function logThreadHistorySyncDiagnostics(
  stage: string,
  details?: Record<string, unknown>,
) {
  if (!diagnosticsEnabled) {
    return;
  }

  if (details) {
    console.info('[thread-history-sync]', stage, details);
    return;
  }

  console.info('[thread-history-sync]', stage);
}

function normalizeMessageIds(messageIds?: string[] | null) {
  return Array.from(
    new Set((messageIds ?? []).map((messageId) => messageId.trim()).filter(Boolean)),
  );
}

export function emitThreadHistorySyncRequest(
  payload: ThreadHistorySyncRequestPayload,
) {
  if (typeof window === 'undefined') {
    return;
  }

  const normalizedMessageIds = normalizeMessageIds(payload.messageIds);
  const hasMessageIds = normalizedMessageIds.length > 0;
  const newerThanLatest = hasMessageIds ? false : Boolean(payload.newerThanLatest);
  const chosenMode = hasMessageIds
    ? 'by-id'
    : newerThanLatest
      ? 'after-seq'
      : 'noop';

  const normalizedPayload = {
    conversationId: payload.conversationId,
    messageIds: normalizedMessageIds,
    newerThanLatest,
    reason: payload.reason?.trim() || null,
  } satisfies ThreadHistorySyncRequestPayload;

  logThreadHistorySyncDiagnostics('sync-request', {
    ...normalizedPayload,
    chosenMode,
  });
  window.dispatchEvent(
    new CustomEvent<ThreadHistorySyncRequestPayload>(
      LOCAL_THREAD_HISTORY_SYNC_REQUEST_EVENT,
      {
        detail: normalizedPayload,
      },
    ),
  );
}

export function emitThreadHistoryVisibleMessageIds(
  payload: ThreadHistoryVisibleMessageIdsPayload,
) {
  if (typeof window === 'undefined') {
    return;
  }

  const normalizedPayload = {
    conversationId: payload.conversationId,
    messageIds: normalizeMessageIds(payload.messageIds),
  } satisfies ThreadHistoryVisibleMessageIdsPayload;

  logThreadHistorySyncDiagnostics('visible-message-ids', {
    conversationId: normalizedPayload.conversationId,
    messageCount: normalizedPayload.messageIds.length,
  });
  window.dispatchEvent(
    new CustomEvent<ThreadHistoryVisibleMessageIdsPayload>(
      LOCAL_THREAD_HISTORY_VISIBLE_MESSAGE_IDS_EVENT,
      {
        detail: normalizedPayload,
      },
    ),
  );
}
