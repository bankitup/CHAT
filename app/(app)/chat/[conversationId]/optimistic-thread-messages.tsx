'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { emitOptimisticThreadRetry, LOCAL_OPTIMISTIC_MESSAGE_EVENT, type OptimisticThreadMessagePayload } from '@/modules/messaging/realtime/optimistic-thread';
import { MessageStatusIndicator } from './message-status-indicator';

type OptimisticThreadMessagesProps = {
  confirmedClientIds: string[];
  conversationId: string;
  labels: {
    attachment: string;
    delete: string;
    failed: string;
    justNow: string;
    retry: string;
    sending: string;
    sent: string;
  };
};

function formatOptimisticTimestamp(createdAt: string, fallbackLabel: string) {
  const timestamp = new Date(createdAt);

  if (Number.isNaN(timestamp.getTime())) {
    return fallbackLabel;
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(timestamp);
}

export function OptimisticThreadMessages({
  confirmedClientIds,
  conversationId,
  labels,
}: OptimisticThreadMessagesProps) {
  const [items, setItems] = useState<OptimisticThreadMessagePayload[]>([]);
  const diagnosticsEnabled =
    typeof window !== 'undefined' &&
    process.env.NEXT_PUBLIC_CHAT_DEBUG_LIVE_REFRESH === '1';
  const lastResolvedClientIdsRef = useRef('');
  const confirmedIds = useMemo(
    () => new Set(confirmedClientIds.filter(Boolean)),
    [confirmedClientIds],
  );
  const visibleItems = useMemo(
    () =>
      items.filter(
        (item) => item.status === 'failed' || !confirmedIds.has(item.clientId),
      ),
    [confirmedIds, items],
  );

  useEffect(() => {
    const resolvedClientIds = items
      .filter((item) => item.status !== 'failed' && confirmedIds.has(item.clientId))
      .map((item) => item.clientId);
    const resolvedClientIdsKey = resolvedClientIds.join(',');

    if (
      diagnosticsEnabled &&
      resolvedClientIds.length > 0 &&
      lastResolvedClientIdsRef.current !== resolvedClientIdsKey
    ) {
      console.info('[optimistic-thread]', 'reconcile:confirmed-client-id', {
        confirmedClientIds: resolvedClientIds,
        conversationId,
        replacementReason: 'confirmed-client-id',
      });
    }

    lastResolvedClientIdsRef.current = resolvedClientIdsKey;
  }, [confirmedIds, conversationId, diagnosticsEnabled, items]);

  useEffect(() => {
    const handleOptimisticMessage = (event: Event) => {
      const detail = (event as CustomEvent<OptimisticThreadMessagePayload>).detail;

      if (!detail || detail.conversationId !== conversationId) {
        return;
      }

      setItems((currentItems) => {
        const nextItems = currentItems.filter(
          (item) => item.clientId !== detail.clientId,
        );

        if (detail.status === 'failed') {
          return [...nextItems, detail];
        }

        if (confirmedIds.has(detail.clientId)) {
          return nextItems;
        }

        return [
          ...nextItems,
          {
            ...detail,
            errorMessage: null,
          },
        ];
      });

      window.requestAnimationFrame(() => {
        const thread = document.getElementById('message-thread-scroll');

        if (!thread) {
          return;
        }

        thread.scrollTo({
          top: thread.scrollHeight,
        });
      });
    };

    window.addEventListener(
      LOCAL_OPTIMISTIC_MESSAGE_EVENT,
      handleOptimisticMessage as EventListener,
    );

    return () => {
      window.removeEventListener(
        LOCAL_OPTIMISTIC_MESSAGE_EVENT,
        handleOptimisticMessage as EventListener,
      );
    };
  }, [confirmedIds, conversationId, labels.failed]);

  if (visibleItems.length === 0) {
    return null;
  }

  return (
    <>
      {visibleItems.map((item) => {
        const isPending =
          item.status === 'local_pending' || item.status === 'sending';
        const isFailed = item.status === 'failed';
        const messagePreview =
          item.body.trim() || item.attachmentLabel?.trim() || labels.attachment;

        return (
          <article
            key={item.clientId}
            className="message-row message-row-own message-row-optimistic"
          >
            <div
              className={
                isFailed
                  ? 'message-card message-card-own message-card-optimistic message-card-failed'
                  : 'message-card message-card-own message-card-optimistic'
              }
            >
              <div
                className={
                  isFailed
                    ? 'message-bubble message-bubble-own message-bubble-optimistic message-bubble-failed'
                    : 'message-bubble message-bubble-own message-bubble-optimistic'
                }
              >
                <p className="message-body">{messagePreview}</p>
              </div>
              <div className="message-meta message-meta-own message-meta-optimistic">
                <span>{formatOptimisticTimestamp(item.createdAt, labels.justNow)}</span>
                {isPending ? (
                  <MessageStatusIndicator
                    label={labels.sending}
                    status="pending"
                  />
                ) : isFailed ? (
                  <span className="message-status-failed-stack">
                    <span className="message-status message-status-failed">
                      {item.errorMessage ?? labels.failed}
                    </span>
                    <span className="message-status-failed-actions">
                      <button
                        className="message-status-action"
                        onClick={() => {
                          setItems((currentItems) =>
                            currentItems.filter(
                              (currentItem) => currentItem.clientId !== item.clientId,
                            ),
                          );
                          emitOptimisticThreadRetry({
                            attachment: item.attachment ?? null,
                            attachmentLabel: item.attachmentLabel ?? null,
                            body: item.body,
                            clientId: item.clientId,
                            conversationId,
                            createdAt: item.createdAt,
                            replyToMessageId: item.replyToMessageId ?? null,
                          });
                        }}
                        type="button"
                      >
                        {labels.retry}
                      </button>
                      <button
                        className="message-status-action message-status-action-muted"
                        onClick={() => {
                          setItems((currentItems) =>
                            currentItems.filter(
                              (currentItem) => currentItem.clientId !== item.clientId,
                            ),
                          );
                        }}
                        type="button"
                      >
                        {labels.delete}
                      </button>
                    </span>
                  </span>
                ) : (
                  <MessageStatusIndicator
                    label={labels.sent}
                    status="sent"
                  />
                )}
              </div>
            </div>
          </article>
        );
      })}
    </>
  );
}
