'use client';

import { useEffect, useMemo, useState } from 'react';
import { emitOptimisticThreadRetry, LOCAL_OPTIMISTIC_MESSAGE_EVENT, type OptimisticThreadMessagePayload } from '@/modules/messaging/realtime/optimistic-thread';

type OptimisticThreadMessagesProps = {
  confirmedClientIds: string[];
  conversationId: string;
  labels: {
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
  const confirmedIds = useMemo(
    () => new Set(confirmedClientIds.filter(Boolean)),
    [confirmedClientIds],
  );

  useEffect(() => {
    setItems((currentItems) =>
      currentItems.filter((item) => item.status === 'failed' || !confirmedIds.has(item.clientId)),
    );
  }, [confirmedIds]);

  useEffect(() => {
    const handleOptimisticMessage = (event: Event) => {
      const detail = (event as CustomEvent<OptimisticThreadMessagePayload>).detail;

      if (!detail || detail.conversationId !== conversationId) {
        return;
      }

      setItems((currentItems) => {
        const nextItems = currentItems.filter(
          (item) => item.status === 'failed' || item.clientId !== detail.clientId,
        );
        const existingFailedItem = currentItems.find(
          (item) => item.clientId === detail.clientId && item.status === 'failed',
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
            errorMessage:
              detail.status === 'failed'
                ? detail.errorMessage ?? labels.failed
                : existingFailedItem?.errorMessage ?? null,
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

  if (items.length === 0) {
    return null;
  }

  return (
    <>
      {items.map((item) => {
        const isPending = item.status === 'pending';
        const isFailed = item.status === 'failed';

        return (
          <article
            key={item.clientId}
            className="message-row message-row-own message-row-optimistic"
          >
            <div className="message-card message-card-own message-card-optimistic">
              <div className="message-bubble message-bubble-own message-bubble-optimistic">
                <p className="message-body">{item.body}</p>
              </div>
              <span className="message-meta message-meta-own message-meta-optimistic">
                <span>{formatOptimisticTimestamp(item.createdAt, labels.justNow)}</span>
                <span
                  className={
                    isFailed
                      ? 'message-status message-status-failed'
                      : isPending
                        ? 'message-status message-status-pending'
                        : 'message-status'
                  }
                >
                  {isPending ? (
                    <>
                      <span
                        aria-hidden="true"
                        className="message-status-spinner"
                      />
                      <span>{labels.sending}</span>
                    </>
                  ) : isFailed ? (
                    <>
                      <span>{item.errorMessage ?? labels.failed}</span>
                      <button
                        className="message-status-retry"
                        onClick={() => {
                          setItems((currentItems) =>
                            currentItems.filter(
                              (currentItem) => currentItem.clientId !== item.clientId,
                            ),
                          );
                          emitOptimisticThreadRetry({
                            body: item.body,
                            clientId: item.clientId,
                            conversationId,
                            replyToMessageId: item.replyToMessageId ?? null,
                          });
                        }}
                        type="button"
                      >
                        {labels.retry}
                      </button>
                    </>
                  ) : (
                    labels.sent
                  )}
                </span>
              </span>
            </div>
          </article>
        );
      })}
    </>
  );
}
