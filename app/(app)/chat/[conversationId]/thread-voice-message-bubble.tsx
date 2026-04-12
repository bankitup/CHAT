'use client';

import {
  memo,
  useCallback,
  useRef,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  getChatClientTranslations,
  type AppLanguage,
} from '@/modules/i18n/client-chat';
import type { MessagingVoicePlaybackState } from '@/modules/messaging/media';
import { logVoiceThreadProof } from './thread-voice-diagnostics';
import {
  useThreadVoicePlaybackRuntime,
  type ThreadVoiceAttachment,
  type VoiceMessageRuntimeModel,
} from './use-thread-voice-playback-runtime';

const MESSAGE_QUICK_ACTION_LONG_PRESS_MS = 280;

type VoiceMessagePlayIconState = 'error' | 'loading' | 'pause' | 'play';

type VoiceMessageRendererModel = {
  canRetry: boolean;
  dataPlaybackState: MessagingVoicePlaybackState | VoiceMessageRuntimeModel['state'];
  interactionAvailability: VoiceMessageRuntimeModel['interactionAvailability'];
  isBuffering: boolean;
  isPlayable: boolean;
  playButtonLabel: string;
  playIconState: VoiceMessagePlayIconState;
  reason: string;
  showMeta: boolean;
  state: VoiceMessageRuntimeModel['state'];
  stateLabel: string;
  stateNote: string | null;
};

type ThreadVoiceMessageBubbleProps = {
  attachment: ThreadVoiceAttachment | null;
  conversationId: string;
  isOwnMessage: boolean;
  language: AppLanguage;
  messageId: string;
  onRequestQuickActions?: (trigger: 'contextmenu' | 'long-press') => void;
  stageHint?: 'uploading' | 'processing' | 'failed' | null;
};

function formatVoiceDuration(valueMs: number | null | undefined) {
  if (!valueMs || Number.isNaN(valueMs) || valueMs < 0) {
    return '--:--';
  }

  const totalSeconds = Math.max(0, Math.round(valueMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function getVoiceMessageBaseStateLabel(input: {
  reason: string;
  state: VoiceMessageRuntimeModel['state'];
  t: ReturnType<typeof getChatClientTranslations>;
}) {
  if (
    input.state === 'failed' &&
    input.reason === 'device-playback-unsupported'
  ) {
    return input.t.chat.voiceMessageUnsupported;
  }

  switch (input.state) {
    case 'pending':
      return input.t.chat.voiceMessagePending;
    case 'uploading':
      return input.t.chat.voiceMessageUploading;
    case 'processing':
      return input.t.chat.voiceMessageProcessing;
    case 'failed':
      return input.t.chat.voiceMessageFailed;
    default:
      return input.t.chat.voiceMessage;
  }
}

function resolveVoiceMessageRendererModel(input: {
  playbackState: MessagingVoicePlaybackState;
  runtimeModel: VoiceMessageRuntimeModel;
  t: ReturnType<typeof getChatClientTranslations>;
}): VoiceMessageRendererModel {
  const { interactionAvailability, reason, state } = input.runtimeModel;
  const isReady = state === 'ready';
  const isBuffering = isReady && input.playbackState === 'buffering';
  const isPlayable = interactionAvailability === 'playable';
  const canRetry = interactionAvailability === 'retryable';
  const showMeta = !isReady;
  const stateLabel = isBuffering
    ? input.t.chat.voiceMessageLoading
    : getVoiceMessageBaseStateLabel({ reason, state, t: input.t });
  const stateNote =
    state === 'pending'
      ? input.t.chat.voiceMessagePendingHint
      : state === 'failed'
        ? reason === 'device-playback-unsupported'
          ? input.t.chat.voiceMessageUnavailable
          : canRetry
            ? input.t.chat.voiceMessageRetryHint
            : input.t.chat.voiceMessageUnavailable
        : null;

  let playIconState: VoiceMessagePlayIconState;

  if (state === 'failed') {
    playIconState = 'error';
  } else if (!isReady) {
    playIconState = 'loading';
  } else if (input.playbackState === 'buffering') {
    playIconState = 'loading';
  } else if (input.playbackState === 'playing') {
    playIconState = 'pause';
  } else {
    playIconState = 'play';
  }

  const playButtonLabel = !isPlayable
    ? stateLabel
    : isBuffering
      ? input.t.chat.voiceMessageLoading
      : input.playbackState === 'playing'
        ? input.t.chat.voiceMessagePause
        : input.t.chat.voiceMessagePlay;

  return {
    canRetry,
    dataPlaybackState: isReady ? input.playbackState : state,
    interactionAvailability,
    isBuffering,
    isPlayable,
    playButtonLabel,
    playIconState,
    reason,
    showMeta,
    state,
    stateLabel,
    stateNote,
  };
}

function getMessageInteractiveTargetElement(target: EventTarget | null) {
  if (target instanceof Element) {
    return target;
  }

  if (target instanceof Node) {
    return target.parentElement;
  }

  return null;
}

function areVoicePlaybackVariantsEqual(
  left: ThreadVoiceAttachment['voicePlaybackVariants'],
  right: ThreadVoiceAttachment['voicePlaybackVariants'],
) {
  if (left === right) {
    return true;
  }

  const normalizedLeft = left ?? [];
  const normalizedRight = right ?? [];

  if (normalizedLeft.length !== normalizedRight.length) {
    return false;
  }

  return normalizedLeft.every((variant, index) => {
    const nextVariant = normalizedRight[index];

    return (
      variant.assetId === nextVariant?.assetId &&
      variant.durationMs === nextVariant.durationMs &&
      variant.fileName === nextVariant.fileName &&
      variant.mimeType === nextVariant.mimeType &&
      variant.role === nextVariant.role &&
      variant.source === nextVariant.source &&
      variant.storageBucket === nextVariant.storageBucket &&
      variant.storageObjectPath === nextVariant.storageObjectPath &&
      variant.transportSourceUrl === nextVariant.transportSourceUrl
    );
  });
}

function areMessageAttachmentValuesEqual(
  left: ThreadVoiceAttachment | null,
  right: ThreadVoiceAttachment | null,
) {
  if (left === right) {
    return true;
  }

  if (!left || !right) {
    return false;
  }

  return (
    left.id === right.id &&
    left.fileName === right.fileName &&
    left.signedUrl === right.signedUrl &&
    left.durationMs === right.durationMs &&
    left.isAudio === right.isAudio &&
    left.isImage === right.isImage &&
    left.isVoiceMessage === right.isVoiceMessage &&
    left.bucket === right.bucket &&
    left.mimeType === right.mimeType &&
    left.objectPath === right.objectPath &&
    left.messageId === right.messageId &&
    areVoicePlaybackVariantsEqual(
      left.voicePlaybackVariants,
      right.voicePlaybackVariants,
    )
  );
}

function ThreadVoiceMessageBubble({
  attachment,
  conversationId,
  isOwnMessage,
  language,
  messageId,
  onRequestQuickActions,
  stageHint = null,
}: ThreadVoiceMessageBubbleProps) {
  const t = getChatClientTranslations(language);
  const {
    audioElementProps,
    hasPendingPlaybackIntent,
    playbackState,
    progressMs,
    resolvedDurationMs,
    shouldRenderAudioElement,
    togglePlayback,
    voiceRuntimeModel,
  } = useThreadVoicePlaybackRuntime({
    attachment,
    conversationId,
    messageId,
    stageHint,
  });
  const voiceRendererModel = resolveVoiceMessageRendererModel({
    playbackState,
    runtimeModel: voiceRuntimeModel,
    t,
  });
  const voiceState = voiceRendererModel.state;
  const voiceInteractionAvailability =
    voiceRendererModel.interactionAvailability;
  const totalDurationMs =
    resolvedDurationMs && resolvedDurationMs > 0 ? resolvedDurationMs : 0;
  const progressRatio =
    totalDurationMs > 0
      ? Math.min(1, Math.max(0, progressMs / totalDurationMs))
      : 0;
  const durationLabel =
    voiceState === 'ready'
      ? playbackState === 'playing' ||
        playbackState === 'paused' ||
        playbackState === 'buffering'
        ? `${formatVoiceDuration(progressMs)} / ${formatVoiceDuration(
            resolvedDurationMs,
          )}`
        : formatVoiceDuration(resolvedDurationMs)
      : '--:--';
  const playIconState = voiceRendererModel.playIconState;
  const isVoicePlayable = voiceRendererModel.isPlayable;
  const canRetryVoicePlayback = voiceRendererModel.canRetry;
  const voiceLongPressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const voiceTapGestureRef = useRef<{
    didMove: boolean;
    didTriggerLongPress: boolean;
    pointerId: number;
    startX: number;
    startY: number;
  } | null>(null);
  const lastVoicePointerActivationAtRef = useRef(0);
  const lastVoiceLongPressAtRef = useRef(0);

  const clearVoiceLongPress = useCallback(() => {
    if (voiceLongPressTimeoutRef.current) {
      clearTimeout(voiceLongPressTimeoutRef.current);
      voiceLongPressTimeoutRef.current = null;
    }
  }, []);

  const handleVoiceSurfacePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (event.button === 0) {
        const pointerId = event.pointerId;
        const pointerType = event.pointerType;

        voiceTapGestureRef.current = {
          didMove: false,
          didTriggerLongPress: false,
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
        };
        clearVoiceLongPress();
        logVoiceThreadProof('gesture-long-press-armed', {
          input: 'pointer',
          messageId,
          pointerType,
        });
        voiceLongPressTimeoutRef.current = setTimeout(() => {
          voiceLongPressTimeoutRef.current = null;
          const activeGesture = voiceTapGestureRef.current;

          if (
            !activeGesture ||
            activeGesture.pointerId !== pointerId ||
            activeGesture.didMove ||
            activeGesture.didTriggerLongPress
          ) {
            return;
          }

          activeGesture.didTriggerLongPress = true;
          lastVoiceLongPressAtRef.current = Date.now();
          logVoiceThreadProof('gesture-long-press-recognized', {
            input: 'pointer',
            messageId,
            pointerType,
          });
          logVoiceThreadProof('voice-long-press-entered', {
            messageId,
            pointerType,
            voiceState,
          });
          logVoiceThreadProof('gesture-popup-open-entered', {
            messageId,
            trigger: 'voice-long-press',
          });
          onRequestQuickActions?.('long-press');
        }, MESSAGE_QUICK_ACTION_LONG_PRESS_MS);

        if (event.pointerType !== 'mouse') {
          event.preventDefault();
        }
      }
      event.stopPropagation();
    },
    [clearVoiceLongPress, messageId, onRequestQuickActions, voiceState],
  );

  const handleVoiceSurfacePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const activeGesture = voiceTapGestureRef.current;

      if (!activeGesture || activeGesture.pointerId !== event.pointerId) {
        return;
      }

      if (
        Math.abs(event.clientX - activeGesture.startX) > 10 ||
        Math.abs(event.clientY - activeGesture.startY) > 10
      ) {
        activeGesture.didMove = true;
        clearVoiceLongPress();
      }

      event.stopPropagation();
    },
    [clearVoiceLongPress],
  );

  const handleVoiceSurfacePointerUp = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      clearVoiceLongPress();
      if (voiceTapGestureRef.current?.pointerId === event.pointerId) {
        voiceTapGestureRef.current = null;
      }
      event.stopPropagation();
    },
    [clearVoiceLongPress],
  );

  const handleVoiceSurfaceContextMenu = useCallback(
    (event: ReactMouseEvent<HTMLElement>) => {
      event.preventDefault();
      event.stopPropagation();
      clearVoiceLongPress();
      lastVoiceLongPressAtRef.current = Date.now();
      logVoiceThreadProof('voice-long-press-entered', {
        messageId,
        trigger: 'contextmenu',
        voiceState,
      });
      logVoiceThreadProof('gesture-popup-open-entered', {
        messageId,
        trigger: 'voice-contextmenu',
      });
      onRequestQuickActions?.('contextmenu');
    },
    [clearVoiceLongPress, messageId, onRequestQuickActions, voiceState],
  );

  const activateVoiceFromPointer = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (event.pointerType === 'mouse' || event.button !== 0) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      logVoiceThreadProof('voice-tap-received', {
        input: 'pointer',
        messageId,
        voiceState,
      });
      logVoiceThreadProof('tap-received', {
        input: 'pointer',
        messageId,
        pointerType: event.pointerType,
      });
      logVoiceThreadProof('gesture-local-playback-entered', {
        input: 'pointer',
        messageId,
        pointerType: event.pointerType,
      });
      lastVoicePointerActivationAtRef.current = Date.now();
      togglePlayback();
    },
    [messageId, togglePlayback, voiceState],
  );

  const handleVoiceSurfaceClick = useCallback(
    (event: ReactMouseEvent<HTMLElement>) => {
      event.preventDefault();
      event.stopPropagation();

      if (Date.now() - lastVoiceLongPressAtRef.current < 420) {
        return;
      }

      if (Date.now() - lastVoicePointerActivationAtRef.current < 420) {
        return;
      }

      logVoiceThreadProof('voice-tap-received', {
        input: 'click',
        messageId,
        voiceState,
      });
      logVoiceThreadProof('tap-received', {
        input: 'click',
        messageId,
      });
      logVoiceThreadProof('gesture-local-playback-entered', {
        input: 'click',
        messageId,
      });
      togglePlayback();
    },
    [messageId, togglePlayback, voiceState],
  );

  const handleVoiceCardClick = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (
        getMessageInteractiveTargetElement(event.target)?.closest(
          '.message-voice-play',
        )
      ) {
        return;
      }

      handleVoiceSurfaceClick(event);
    },
    [handleVoiceSurfaceClick],
  );

  const handleVoiceCardPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const activeGesture = voiceTapGestureRef.current;

      if (!activeGesture || activeGesture.pointerId !== event.pointerId) {
        event.stopPropagation();
        return;
      }

      clearVoiceLongPress();
      voiceTapGestureRef.current = null;

      if (activeGesture.didTriggerLongPress || activeGesture.didMove) {
        event.stopPropagation();
        return;
      }

      logVoiceThreadProof('gesture-short-tap-recognized', {
        input: 'pointer',
        messageId,
        pointerType: event.pointerType,
      });
      logVoiceThreadProof('voice-short-tap-confirmed', {
        input: 'pointer',
        messageId,
        voiceState,
      });
      activateVoiceFromPointer(event);
    },
    [activateVoiceFromPointer, clearVoiceLongPress, messageId, voiceState],
  );

  return (
    <div
      className={
        isOwnMessage
          ? 'message-voice-card message-voice-card-own'
          : 'message-voice-card'
      }
      data-message-voice-interactive="true"
      data-playback-state={voiceRendererModel.dataPlaybackState}
      data-play-intent={hasPendingPlaybackIntent ? 'pending' : 'idle'}
      data-voice-interaction={voiceInteractionAvailability}
      data-voice-state={voiceState}
      onClick={handleVoiceCardClick}
      onContextMenu={handleVoiceSurfaceContextMenu}
      onPointerCancelCapture={handleVoiceSurfacePointerUp}
      onPointerDownCapture={handleVoiceSurfacePointerDown}
      onPointerMove={handleVoiceSurfacePointerMove}
      onPointerUp={handleVoiceCardPointerUp}
    >
      <button
        aria-label={voiceRendererModel.playButtonLabel}
        className="message-voice-play"
        disabled={!isVoicePlayable && !canRetryVoicePlayback}
        onClick={handleVoiceSurfaceClick}
        onContextMenu={handleVoiceSurfaceContextMenu}
        type="button"
      >
        <span
          aria-hidden="true"
          className={`message-voice-play-icon message-voice-play-icon-${playIconState}`}
        >
          {playIconState === 'error' ? '!' : null}
        </span>
      </button>
      <div className="message-voice-copy">
        <div className="message-voice-head">
          <span className="message-voice-title">{t.chat.voiceMessage}</span>
          <span className="message-voice-duration">{durationLabel}</span>
        </div>
        <div className="message-voice-progress" aria-hidden="true">
          <span
            className={
              voiceRendererModel.isBuffering
                ? 'message-voice-progress-bar message-voice-progress-bar-loading'
                : 'message-voice-progress-bar'
            }
            style={
              voiceRendererModel.isBuffering
                ? undefined
                : { transform: `scaleX(${progressRatio})` }
            }
          />
        </div>
        {voiceRendererModel.showMeta ? (
          <div className="message-voice-meta">
            <span className="message-voice-state">
              {voiceRendererModel.stateLabel}
            </span>
            {voiceRendererModel.stateNote ? (
              <span className="message-voice-note">
                {voiceRendererModel.stateNote}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
      {shouldRenderAudioElement ? (
        <audio
          {...audioElementProps}
          aria-hidden="true"
          className="message-voice-audio"
        />
      ) : null}
    </div>
  );
}

export const MemoizedThreadVoiceMessageBubble = memo(
  ThreadVoiceMessageBubble,
  (previous, next) =>
    previous.conversationId === next.conversationId &&
    previous.isOwnMessage === next.isOwnMessage &&
    previous.language === next.language &&
    previous.messageId === next.messageId &&
    previous.onRequestQuickActions === next.onRequestQuickActions &&
    previous.stageHint === next.stageHint &&
    areMessageAttachmentValuesEqual(previous.attachment, next.attachment),
);

MemoizedThreadVoiceMessageBubble.displayName = 'MemoizedThreadVoiceMessageBubble';
