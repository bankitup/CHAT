'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  emitOptimisticThreadRetry,
  LOCAL_OPTIMISTIC_MESSAGE_EVENT,
  type OptimisticAttachmentPreviewKind,
  type OptimisticThreadMessagePayload,
} from '@/modules/messaging/realtime/optimistic-thread';
import { MessageStatusIndicator } from './message-status-indicator';
import {
  isThreadNearBottom,
  resolveThreadScrollTarget,
  scrollThreadToBottom,
} from './thread-scroll';

const MESSAGE_THREAD_SCROLL_TARGET_ID = 'message-thread-scroll';

type OptimisticThreadMessagesProps = {
  confirmedClientIds: string[];
  conversationId: string;
  labels: {
    attachment: string;
    delete: string;
    failed: string;
    photo: string;
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

function isOptimisticImageAttachment(input: {
  attachment: File | null | undefined;
  kind: OptimisticAttachmentPreviewKind | null | undefined;
}) {
  return Boolean(input.attachment && input.kind === 'image');
}

function OptimisticImageAttachmentCard({
  file,
  fallbackLabel,
}: {
  fallbackLabel: string;
  file: File;
}) {
  const previewUrl = useMemo(() => URL.createObjectURL(file), [file]);

  useEffect(() => {
    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const previewLabel = file.name.trim() || fallbackLabel;

  return (
    <div
      aria-label={previewLabel}
      className="message-photo-card message-photo-card-optimistic"
      role="img"
    >
      <span
        aria-hidden="true"
        className="message-photo-card-visual"
        style={{
          backgroundImage: `url("${previewUrl}")`,
        }}
      />
    </div>
  );
}

function compareOptimisticThreadMessages(
  left: OptimisticThreadMessagePayload,
  right: OptimisticThreadMessagePayload,
) {
  const leftCreatedAt = new Date(left.createdAt);
  const rightCreatedAt = new Date(right.createdAt);
  const leftTimestamp = Number.isNaN(leftCreatedAt.getTime())
    ? null
    : leftCreatedAt.getTime();
  const rightTimestamp = Number.isNaN(rightCreatedAt.getTime())
    ? null
    : rightCreatedAt.getTime();

  if (leftTimestamp !== null && rightTimestamp !== null && leftTimestamp !== rightTimestamp) {
    return leftTimestamp - rightTimestamp;
  }

  if (leftTimestamp !== null && rightTimestamp === null) {
    return -1;
  }

  if (leftTimestamp === null && rightTimestamp !== null) {
    return 1;
  }

  return left.clientId.localeCompare(right.clientId);
}

function sortOptimisticThreadMessages(items: OptimisticThreadMessagePayload[]) {
  return [...items].sort(compareOptimisticThreadMessages);
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
      sortOptimisticThreadMessages(
        items.filter(
          (item) => item.status === 'failed' || !confirmedIds.has(item.clientId),
        ),
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

      const thread = resolveThreadScrollTarget(MESSAGE_THREAD_SCROLL_TARGET_ID);
      const shouldAutoScroll =
        detail.status === 'local_pending' &&
        (thread ? isThreadNearBottom(thread) : false);

      setItems((currentItems) => {
        const nextItems = currentItems.filter(
          (item) => item.clientId !== detail.clientId,
        );

        if (detail.status === 'failed') {
          return sortOptimisticThreadMessages([...nextItems, detail]);
        }

        if (confirmedIds.has(detail.clientId)) {
          return sortOptimisticThreadMessages(nextItems);
        }

        return sortOptimisticThreadMessages([
          ...nextItems,
          {
            ...detail,
            errorMessage: null,
          },
        ]);
      });

      window.requestAnimationFrame(() => {
        const nextThread = resolveThreadScrollTarget(
          MESSAGE_THREAD_SCROLL_TARGET_ID,
        );

        if (!shouldAutoScroll || !nextThread) {
          return;
        }

        scrollThreadToBottom(nextThread, 'smooth');
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
      attachmentPreviewKind: item.attachmentPreviewKind ?? null,
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
        const isQueued = item.status === 'local_pending';
        const isSending = item.status === 'sending';
        const isPending = isQueued || isSending;
        const isFailed = item.status === 'failed';
        const messagePreview =
          item.body.trim() || item.attachmentLabel?.trim() || labels.attachment;
        const isImageAttachment = isOptimisticImageAttachment({
          attachment: item.attachment,
          kind: item.attachmentPreviewKind ?? null,
        });
        const isVoiceMessage = item.kind === 'voice';
        const pendingStatusLabel =
          isVoiceMessage
            ? isQueued
              ? labels.queued
              : labels.voiceUploading
            : isQueued
              ? labels.queued
              : labels.sending;
        const voiceProgressScale = isFailed ? 0.28 : isQueued ? 0.2 : 0.58;
        const voiceIconState = isFailed ? 'error' : isPending ? 'loading' : 'play';

        return (
          <article
            key={item.clientId}
            className={
              isVoiceMessage
                ? 'message-row message-row-own message-row-optimistic message-row-optimistic-voice'
                : isImageAttachment
                  ? 'message-row message-row-own message-row-optimistic message-row-optimistic-media'
                : 'message-row message-row-own message-row-optimistic'
            }
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
                    : isImageAttachment
                      ? 'message-bubble message-bubble-own message-bubble-optimistic message-bubble-optimistic-media'
                    : 'message-bubble message-bubble-own message-bubble-optimistic'
                }
              >
                {isVoiceMessage ? (
                  <div className="message-voice-stack">
                    <div
                      className={
                        isPending
                          ? 'message-voice-card message-voice-card-own message-voice-card-optimistic-pending'
                          : 'message-voice-card message-voice-card-own'
                      }
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
                        <span
                          aria-hidden="true"
                          className={`message-voice-play-icon message-voice-play-icon-${voiceIconState}`}
                        >
                          {voiceIconState === 'error' ? '!' : null}
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
                              transform: `scaleX(${voiceProgressScale})`,
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
                          null
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : isImageAttachment && item.attachment ? (
                  <OptimisticImageAttachmentCard
                    fallbackLabel={labels.photo}
                    file={item.attachment}
                  />
                ) : (
                  <p className="message-body">{messagePreview}</p>
                )}
              </div>
              <div
                className={
                  isVoiceMessage && isPending
                    ? 'message-meta message-meta-own message-meta-optimistic message-meta-optimistic-voice-pending'
                    : 'message-meta message-meta-own message-meta-optimistic'
                }
              >
                <span>{formatOptimisticTimestamp(item.createdAt, labels.justNow)}</span>
                {isPending ? (
                  <span className="message-status-pending-stack">
                    <MessageStatusIndicator
                      label={pendingStatusLabel}
                      status="pending"
                    />
                    <span className="message-status message-status-pending">
                      {pendingStatusLabel}
                    </span>
                  </span>
                ) : isFailed && isVoiceMessage ? null : isFailed &&
                  !isVoiceMessage ? (
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
