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

function joinClassNames(values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

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
      className="message-photo-card message-photo-card-committed message-photo-card-optimistic"
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

function formatOptimisticAttachmentSize(sizeBytes: number) {
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    return '';
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  let unitIndex = 0;
  let value = sizeBytes;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const digits = value >= 10 || unitIndex === 0 ? 0 : 1;
  return `${value.toFixed(digits)} ${units[unitIndex]}`;
}

function OptimisticFileAttachmentCard({
  fallbackLabel,
  file,
}: {
  fallbackLabel: string;
  file: File;
}) {
  const attachmentName = file.name.trim() || fallbackLabel;
  const attachmentMeta = formatOptimisticAttachmentSize(file.size);

  return (
    <div className="message-attachment-card message-attachment-card-unavailable">
      <span aria-hidden="true" className="message-attachment-file">
        {fallbackLabel}
      </span>
      <span className="message-attachment-copy">
        <span className="message-attachment-head">
          <span className="message-attachment-name">{attachmentName}</span>
          <span className="message-attachment-kind">{fallbackLabel}</span>
        </span>
        {attachmentMeta ? (
          <span className="message-attachment-meta">{attachmentMeta}</span>
        ) : null}
      </span>
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
        const normalizedBody = item.body.trim();
        const isVoiceMessage = item.kind === 'voice';
        const isImageAttachment = isOptimisticImageAttachment({
          attachment: item.attachment,
          kind: item.attachmentPreviewKind ?? null,
        });
        const isGenericAttachment =
          Boolean(item.attachment) && !isImageAttachment && !isVoiceMessage;
        const shouldRenderAttachmentCaption =
          Boolean(item.attachment) && Boolean(normalizedBody) && !isVoiceMessage;
        const pendingStatusLabel =
          isVoiceMessage
            ? isQueued
              ? labels.queued
              : labels.voiceUploading
            : isQueued
              ? labels.queued
              : labels.sending;
        const pendingStage = isQueued ? 'queued' : 'sending';
        const pendingProgressScale = isQueued ? 0.34 : 0.72;
        const voiceProgressScale = isFailed ? 0.28 : isQueued ? 0.2 : 0.58;
        const voiceIconState = isFailed ? 'error' : isPending ? 'loading' : 'play';
        const pendingBanner = isPending ? (
          <div className="message-pending-banner" data-pending-stage={pendingStage}>
            <span aria-hidden="true" className="message-pending-banner-dot" />
            <span className="message-pending-banner-label">{pendingStatusLabel}</span>
          </div>
        ) : null;
        const pendingProgress = isPending ? (
          <div
            aria-hidden="true"
            className="message-pending-progress"
            data-pending-stage={pendingStage}
          >
            <span
              className="message-pending-progress-bar"
              style={{
                transform: `scaleX(${pendingProgressScale})`,
              }}
            />
          </div>
        ) : null;

        return (
          <article
            key={item.clientId}
            className={joinClassNames([
              'message-row',
              'message-row-own',
              'message-row-optimistic',
              isPending && 'message-row-optimistic-pending',
              isVoiceMessage
                ? 'message-row-optimistic-voice'
                : isImageAttachment
                  ? 'message-row-optimistic-media'
                  : null,
            ])}
          >
            <div
              className={joinClassNames([
                'message-card',
                'message-card-own',
                'message-card-optimistic',
                isPending && 'message-card-optimistic-pending',
                isFailed && 'message-card-failed',
              ])}
            >
              <div
                className={joinClassNames([
                  'message-bubble',
                  'message-bubble-own',
                  'message-bubble-optimistic',
                  isPending && 'message-bubble-optimistic-pending',
                  isFailed && 'message-bubble-failed',
                  isImageAttachment && 'message-bubble-optimistic-media',
                ])}
              >
                {isVoiceMessage ? (
                  <div
                    className={joinClassNames([
                      'message-voice-stack',
                      isPending && 'message-voice-stack-pending',
                    ])}
                  >
                    {pendingBanner}
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
                    {pendingProgress}
                  </div>
                ) : isImageAttachment && item.attachment ? (
                  <div className="message-attachment-caption-stack">
                    {pendingBanner}
                    <OptimisticImageAttachmentCard
                      fallbackLabel={labels.photo}
                      file={item.attachment}
                    />
                    {shouldRenderAttachmentCaption ? (
                      <p className="message-body">{normalizedBody}</p>
                    ) : null}
                    {pendingProgress}
                  </div>
                ) : isGenericAttachment && item.attachment ? (
                  <div className="message-attachment-caption-stack">
                    {pendingBanner}
                    <OptimisticFileAttachmentCard
                      fallbackLabel={labels.attachment}
                      file={item.attachment}
                    />
                    {shouldRenderAttachmentCaption ? (
                      <p className="message-body">{normalizedBody}</p>
                    ) : null}
                    {pendingProgress}
                  </div>
                ) : (
                  <div className="message-optimistic-body-stack">
                    {pendingBanner}
                    <p className="message-body">{messagePreview}</p>
                    {pendingProgress}
                  </div>
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
