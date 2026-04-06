'use client';

export const LOCAL_OPTIMISTIC_MESSAGE_EVENT = 'chat:optimistic-message';
export const LOCAL_OPTIMISTIC_MESSAGE_RETRY_EVENT = 'chat:optimistic-message-retry';

export type OptimisticThreadMessageStatus =
  | 'local_pending'
  | 'sending'
  | 'sent'
  | 'failed';

export type OptimisticThreadMessagePayload = {
  attachment?: File | null;
  attachmentLabel?: string | null;
  body: string;
  clientId: string;
  conversationId: string;
  createdAt: string;
  errorMessage?: string | null;
  replyToMessageId?: string | null;
  status: OptimisticThreadMessageStatus;
};

export function emitOptimisticThreadMessage(
  payload: OptimisticThreadMessagePayload,
) {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<OptimisticThreadMessagePayload>(
      LOCAL_OPTIMISTIC_MESSAGE_EVENT,
      {
        detail: payload,
      },
    ),
  );
}

export type OptimisticThreadRetryPayload = {
  attachment?: File | null;
  attachmentLabel?: string | null;
  body: string;
  clientId: string;
  conversationId: string;
  createdAt: string;
  replyToMessageId?: string | null;
};

export function emitOptimisticThreadRetry(
  payload: OptimisticThreadRetryPayload,
) {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<OptimisticThreadRetryPayload>(
      LOCAL_OPTIMISTIC_MESSAGE_RETRY_EVENT,
      {
        detail: payload,
      },
    ),
  );
}
