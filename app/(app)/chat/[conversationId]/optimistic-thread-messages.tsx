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
    queued: string;
    remove: string;
    retry: string;
    sending: string;
    sent: string;
    voiceFailed: string;
    voicePendingHint: string;
    voiceProcessing: string;
    voiceUploading: string;
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

function formatVoiceDuration(durationMs: number | null) {
  if (durationMs === null || durationMs < 0) {
    return '--:--';
  }

  const totalSeconds = Math.max(Math.floor(durationMs / 1000), 0);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function OptimisticThreadMessages({
  confirmedClientIds,
  conversationId,
  labels,
}: OptimisticThreadMessagesProps) {
  const [items, setItems] = useState<OptimisticThreadMessagePayload[]>([]);
  const retryingFailedClientIdsRef = useRef(new Set<string>());
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

  const retryFailedItem = (item: OptimisticThreadMessagePayload) => {
    if (retryingFailedClientIdsRef.current.has(item.clientId)) {
      return;
    }

    retryingFailedClientIdsRef.current.add(item.clientId);
    setItems((currentItems) =>
      currentItems.filter(
        (currentItem) => currentItem.clientId !== item.clientId,
      ),
    );
    emitOptimisticThreadRetry({
      attachment: item.attachment ?? null,
      attachmentLabel: item.attachmentLabel ?? null,
      attemptKind: 'retry',
      body: item.body,
      clientId: null,
      conversationId,
      createdAt: item.createdAt,
      kind: item.kind,
      replyToMessageId: item.replyToMessageId ?? null,
      retryOfClientId: item.clientId,
      voiceDurationMs: item.voiceDurationMs ?? null,
    });
  };

  const removeFailedItem = (item: OptimisticThreadMessagePayload) => {
    setItems((currentItems) =>
      currentItems.filter(
        (currentItem) => currentItem.clientId !== item.clientId,
      ),
    );
  };

  return (
    <>
      {visibleItems.map((item) => {
        const isPending =
          item.status === 'local_pending' || item.status === 'sending';
        const isFailed = item.status === 'failed';
        const messagePreview =
          item.body.trim() || item.attachmentLabel?.trim() || labels.attachment;
        const isVoiceMessage = item.kind === 'voice';
        const pendingStatusLabel =
          item.status === 'local_pending'
            ? labels.queued
            : isVoiceMessage
              ? labels.voiceProcessing
              : labels.sending;
        const footerStatusLabel =
          item.status === 'local_pending' ? labels.queued : labels.sending;

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
                {isVoiceMessage ? (
                  <div className="message-voice-stack">
                    <div
                      className="message-voice-card message-voice-card-own"
                      data-voice-state={
                        isFailed
                          ? 'failed'
                          : item.status === 'local_pending'
                            ? 'uploading'
                            : 'processing'
                      }
                    >
                      <button
                        className="message-voice-play"
                        disabled
                        type="button"
                      >
                        <span aria-hidden="true" className="message-voice-play-icon">
                          {isFailed ? '!' : isPending ? '...' : '>'}
                        </span>
                      </button>
                      <div className="message-voice-copy">
                        <div className="message-voice-head">
                          <span className="message-voice-title">{messagePreview}</span>
                          <span className="message-voice-duration">
                            {formatVoiceDuration(item.voiceDurationMs ?? null)}
                          </span>
                        </div>
                        <div className="message-voice-progress" aria-hidden="true">
                          <span
                            className="message-voice-progress-bar"
                            style={{
                              transform: `scaleX(${isFailed ? 0.28 : isPending ? 0.52 : 1})`,
                            }}
                          />
                        </div>
                        {isFailed ? (
                          <div className="message-voice-failed-row">
                            <span className="message-voice-failed-text">
                              {item.errorMessage ?? labels.voiceFailed}
                            </span>
                            <span className="message-voice-failed-actions">
                              <button
                                className="message-voice-failed-action"
                                onClick={() => {
                                  retryFailedItem(item);
                                }}
                                type="button"
                              >
                                {labels.retry}
                              </button>
                              <button
                                className="message-voice-failed-action message-voice-failed-action-muted"
                                onClick={() => {
                                  removeFailedItem(item);
                                }}
                                type="button"
                              >
                                {labels.remove}
                              </button>
                            </span>
                          </div>
                        ) : isPending ? (
                          <div className="message-voice-meta">
                            <span className="message-voice-state">
                              {pendingStatusLabel}
                            </span>
                            <span className="message-voice-meta-separator">·</span>
                            <span>{labels.voicePendingHint}</span>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="message-body">{messagePreview}</p>
                )}
              </div>
              <div className="message-meta message-meta-own message-meta-optimistic">
                <span>{formatOptimisticTimestamp(item.createdAt, labels.justNow)}</span>
                {isPending ? (
                  <span className="message-status-pending-stack">
                    <MessageStatusIndicator
                      label={footerStatusLabel}
                      status="pending"
                    />
                    <span className="message-status message-status-pending">
                      {footerStatusLabel}
                    </span>
                  </span>
                ) : isFailed && !isVoiceMessage ? (
                  <span className="message-status-failed-stack">
                    <span className="message-status message-status-failed">
                      {item.errorMessage ?? labels.failed}
                    </span>
                    <span className="message-status-failed-actions">
                      <button
                        className="message-status-action"
                        onClick={() => {
                          retryFailedItem(item);
                        }}
                        type="button"
                      >
                        {labels.retry}
                      </button>
                      <button
                        className="message-status-action message-status-action-muted"
                        onClick={() => {
                          removeFailedItem(item);
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
