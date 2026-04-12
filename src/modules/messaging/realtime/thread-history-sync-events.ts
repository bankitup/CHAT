'use client';

export const LOCAL_THREAD_HISTORY_SYNC_REQUEST_EVENT =
  'chat:thread-history-sync-request';
export const LOCAL_THREAD_HISTORY_VISIBLE_MESSAGE_IDS_EVENT =
  'chat:thread-history-visible-message-ids';
export const LOCAL_THREAD_HISTORY_LIVE_MESSAGE_EVENT =
  'chat:thread-history-live-message';

export type ThreadHistorySyncRequestPayload = {
  authoritativeLatestWindow?: boolean;
  conversationId: string;
  messageIds?: string[] | null;
  newerThanLatest?: boolean;
  reason?: string | null;
};

export type ThreadHistoryVisibleMessageIdsPayload = {
  conversationId: string;
  messageIds: string[];
};

export type ThreadHistoryLiveMessagePayload = {
  conversationId: string;
  message: {
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
  reason?: string | null;
};

const diagnosticsEnabled =
  typeof window !== 'undefined' &&
  process.env.NEXT_PUBLIC_CHAT_DEBUG_LIVE_REFRESH === '1';

function looksLikeUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

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
    new Set(
      (messageIds ?? [])
        .map((messageId) => messageId.trim())
        .filter((messageId) => messageId && looksLikeUuid(messageId)),
    ),
  );
}

export function emitThreadHistorySyncRequest(
  payload: ThreadHistorySyncRequestPayload,
) {
  if (typeof window === 'undefined') {
    return;
  }

  const requestedMessageIds = Array.from(
    new Set((payload.messageIds ?? []).map((messageId) => messageId.trim()).filter(Boolean)),
  );
  const normalizedMessageIds = normalizeMessageIds(payload.messageIds);
  const droppedInvalidMessageIds = requestedMessageIds.filter(
    (messageId) => !looksLikeUuid(messageId),
  );
  const hasMessageIds = normalizedMessageIds.length > 0;
  const authoritativeLatestWindow = hasMessageIds
    ? false
    : Boolean(payload.authoritativeLatestWindow);
  const newerThanLatest = hasMessageIds ? false : Boolean(payload.newerThanLatest);
  const chosenMode = hasMessageIds
    ? 'by-id'
    : authoritativeLatestWindow
      ? 'authoritative-latest-window'
    : newerThanLatest
      ? 'after-seq'
      : 'noop';

  const normalizedPayload = {
    authoritativeLatestWindow,
    conversationId: payload.conversationId,
    messageIds: normalizedMessageIds,
    newerThanLatest,
    reason: payload.reason?.trim() || null,
  } satisfies ThreadHistorySyncRequestPayload;

  if (droppedInvalidMessageIds.length > 0) {
    logThreadHistorySyncDiagnostics('sync-request:invalid-message-ids-dropped', {
      conversationId: payload.conversationId,
      droppedInvalidMessageIds,
      preservedMessageIds: normalizedMessageIds,
      reason: normalizedPayload.reason,
    });
  }

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

export function emitThreadHistoryLiveMessage(
  payload: ThreadHistoryLiveMessagePayload,
) {
  if (typeof window === 'undefined') {
    return;
  }

  logThreadHistorySyncDiagnostics('live-message', {
    conversationId: payload.conversationId,
    messageId: payload.message.id,
    reason: payload.reason?.trim() || null,
    seq: payload.message.seq,
  });
  window.dispatchEvent(
    new CustomEvent<ThreadHistoryLiveMessagePayload>(
      LOCAL_THREAD_HISTORY_LIVE_MESSAGE_EVENT,
      {
        detail: {
          ...payload,
          reason: payload.reason?.trim() || null,
        },
      },
    ),
  );
}
