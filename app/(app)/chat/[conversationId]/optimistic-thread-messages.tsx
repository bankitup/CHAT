'use client';

import { useEffect, useMemo, useState } from 'react';
import { emitOptimisticThreadRetry, LOCAL_OPTIMISTIC_MESSAGE_EVENT, type OptimisticThreadMessagePayload } from '@/modules/messaging/realtime/optimistic-thread';
import { MessageStatusIndicator } from './message-status-indicator';

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
  const visibleItems = useMemo(
    () =>
      items.filter(
        (item) => item.status === 'failed' || !confirmedIds.has(item.clientId),
      ),
    [confirmedIds, items],
  );

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
                {isPending ? (
                  <MessageStatusIndicator
                    label={labels.sending}
                    status="pending"
                  />
                ) : isFailed ? (
                  <span className="message-status message-status-failed">
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
                  </span>
                ) : (
                  <MessageStatusIndicator
                    label={labels.sent}
                    status="sent"
                  />
                )}
              </span>
            </div>
          </article>
        );
      })}
    </>
  );
}
