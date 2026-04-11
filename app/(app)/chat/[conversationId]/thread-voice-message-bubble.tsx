'use client';

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { getTranslations, type AppLanguage } from '@/modules/i18n';
import type { MessagingVoicePlaybackState } from '@/modules/messaging/media';
import {
  configureInlineAudioElement,
  hasRecoverableThreadVoicePlaybackLocator,
  prepareThreadVoicePlaybackSource,
  resolveThreadVoicePreferredPlaybackSource,
  resolveThreadVoicePlaybackSourceSnapshot,
  writeThreadVoicePlaybackCacheEntry,
  type ThreadVoiceDevicePlaybackSupport,
  type ThreadVoicePlaybackCacheEntry,
} from './voice-playback-source';
import {
  resolveMessagingAttachmentMimeType,
  resolveMessagingVoicePlaybackSourceOptions,
  type MessagingVoicePlaybackSourceOption,
  type MessagingVoicePlaybackVariantRecord,
} from '@/modules/messaging/media/message-assets';
import {
  logVoiceThreadDiagnostic,
  logVoiceThreadProof,
} from './thread-voice-diagnostics';

const MESSAGE_QUICK_ACTION_LONG_PRESS_MS = 280;
const VOICE_READY_TO_REPLAY_STATE = 2;

type ThreadVoiceAttachment = {
  bucket?: string;
  durationMs?: number | null;
  fileName?: string | null;
  id: string;
  isAudio: boolean;
  isImage: boolean;
  isVoiceMessage?: boolean;
  messageId?: string;
  mimeType?: string | null;
  objectPath?: string;
  signedUrl: string | null;
  voicePlaybackVariants?: MessagingVoicePlaybackVariantRecord[] | null;
};

type VoiceMessageRenderState =
  | 'pending'
  | 'uploading'
  | 'processing'
  | 'ready'
  | 'failed';

type VoiceMessageInteractionAvailability =
  | 'disabled'
  | 'playable'
  | 'retryable';

type VoiceMessagePlayIconState = 'error' | 'loading' | 'pause' | 'play';

type VoiceMessageRuntimeModel = {
  interactionAvailability: VoiceMessageInteractionAvailability;
  reason: string;
  state: VoiceMessageRenderState;
};

const UNKNOWN_THREAD_VOICE_DEVICE_PLAYBACK_SUPPORT: ThreadVoiceDevicePlaybackSupport =
  {
    canPlayType: null,
    mediaCapabilitiesPowerEfficient: null,
    mediaCapabilitiesSmooth: null,
    mediaCapabilitiesSupported: null,
    mimeType: null,
    status: 'unknown',
  };

type VoiceMessageRendererModel = {
  canRetry: boolean;
  dataPlaybackState: MessagingVoicePlaybackState | VoiceMessageRenderState;
  interactionAvailability: VoiceMessageInteractionAvailability;
  isBuffering: boolean;
  isPlayable: boolean;
  playButtonLabel: string;
  playIconState: VoiceMessagePlayIconState;
  reason: string;
  showMeta: boolean;
  state: VoiceMessageRenderState;
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

const activeThreadVoicePlayback: {
  audio: HTMLAudioElement | null;
  intendedMessageId: string | null;
  messageId: string | null;
  ownerVersion: number;
  transitionPromise: Promise<unknown> | null;
} = {
  audio: null,
  intendedMessageId: null,
  messageId: null,
  ownerVersion: 0,
  transitionPromise: null,
};

function getActiveThreadVoicePlaybackSnapshot() {
  return {
    audio: activeThreadVoicePlayback.audio,
    intendedMessageId: activeThreadVoicePlayback.intendedMessageId,
    messageId: activeThreadVoicePlayback.messageId,
    ownerVersion: activeThreadVoicePlayback.ownerVersion,
    transitionPromise: activeThreadVoicePlayback.transitionPromise,
  };
}

function runActiveThreadVoicePlaybackTransition<T>(
  transition: () => Promise<T> | T,
) {
  const previousTransition = activeThreadVoicePlayback.transitionPromise;
  const nextTransition = Promise.resolve(previousTransition)
    .catch(() => undefined)
    .then(() => transition())
    .finally(() => {
      if (activeThreadVoicePlayback.transitionPromise === nextTransition) {
        activeThreadVoicePlayback.transitionPromise = null;
      }
    });

  activeThreadVoicePlayback.transitionPromise = nextTransition;
  return nextTransition;
}

type ThreadVoicePlaybackOwnership =
  | {
      ownerVersion: number;
      status: 'active-owner';
    }
  | {
      ownerMessageId: string;
      ownerVersion: number;
      status: 'other-owner';
    }
  | {
      status: 'intended-owner';
    }
  | {
      status: 'idle';
    };

function resolveActiveThreadVoicePlaybackOwnership(input: {
  audio: HTMLAudioElement | null;
  messageId: string;
}): ThreadVoicePlaybackOwnership {
  if (
    input.audio &&
    activeThreadVoicePlayback.audio === input.audio &&
    activeThreadVoicePlayback.messageId === input.messageId
  ) {
    return {
      ownerVersion: activeThreadVoicePlayback.ownerVersion,
      status: 'active-owner',
    };
  }

  if (
    activeThreadVoicePlayback.audio &&
    activeThreadVoicePlayback.messageId &&
    activeThreadVoicePlayback.messageId !== input.messageId
  ) {
    return {
      ownerMessageId: activeThreadVoicePlayback.messageId,
      ownerVersion: activeThreadVoicePlayback.ownerVersion,
      status: 'other-owner',
    };
  }

  if (activeThreadVoicePlayback.intendedMessageId === input.messageId) {
    return {
      status: 'intended-owner',
    };
  }

  return {
    status: 'idle',
  };
}

function claimActiveThreadVoicePlayback(
  messageId: string,
  audio: HTMLAudioElement,
) {
  const previousAudio = activeThreadVoicePlayback.audio;

  if (previousAudio && previousAudio !== audio) {
    previousAudio.pause();
  }

  const nextOwnerVersion = activeThreadVoicePlayback.ownerVersion + 1;

  activeThreadVoicePlayback.audio = audio;
  activeThreadVoicePlayback.intendedMessageId = messageId;
  activeThreadVoicePlayback.messageId = messageId;
  activeThreadVoicePlayback.ownerVersion = nextOwnerVersion;

  return nextOwnerVersion;
}

function setActiveThreadVoicePlaybackIntent(messageId: string | null) {
  activeThreadVoicePlayback.intendedMessageId = messageId;
}

function requestActiveThreadVoicePlaybackIntent(messageId: string) {
  activeThreadVoicePlayback.intendedMessageId = messageId;

  if (
    activeThreadVoicePlayback.audio &&
    activeThreadVoicePlayback.messageId &&
    activeThreadVoicePlayback.messageId !== messageId
  ) {
    activeThreadVoicePlayback.audio.pause();
  }
}

function hasActiveThreadVoicePlaybackIntent(messageId: string) {
  return activeThreadVoicePlayback.intendedMessageId === messageId;
}

function isActiveThreadVoicePlaybackOwner(input: {
  audio: HTMLAudioElement;
  messageId: string;
  ownerVersion: number | null;
}) {
  return Boolean(
    activeThreadVoicePlayback.audio === input.audio &&
      activeThreadVoicePlayback.messageId === input.messageId &&
      input.ownerVersion !== null &&
      activeThreadVoicePlayback.ownerVersion === input.ownerVersion,
  );
}

function releaseActiveThreadVoicePlayback(
  messageId: string,
  audio: HTMLAudioElement,
  ownerVersion: number | null,
) {
  if (
    activeThreadVoicePlayback.audio === audio &&
    activeThreadVoicePlayback.messageId === messageId &&
    ownerVersion !== null &&
    activeThreadVoicePlayback.ownerVersion === ownerVersion
  ) {
    activeThreadVoicePlayback.audio = null;
    activeThreadVoicePlayback.messageId = null;
    if (activeThreadVoicePlayback.intendedMessageId === messageId) {
      activeThreadVoicePlayback.intendedMessageId = null;
    }
  }
}

function normalizeAttachmentSignedUrl(value: unknown) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed || null;
}

function formatVoiceDuration(valueMs: number | null | undefined) {
  if (!valueMs || Number.isNaN(valueMs) || valueMs < 0) {
    return '--:--';
  }

  const totalSeconds = Math.max(0, Math.round(valueMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function getThreadVoiceFileExtension(fileName: string | null | undefined) {
  const normalizedFileName = fileName?.trim() || '';

  if (!normalizedFileName) {
    return null;
  }

  const extensionIndex = normalizedFileName.lastIndexOf('.');

  if (
    extensionIndex < 0 ||
    extensionIndex === normalizedFileName.length - 1
  ) {
    return null;
  }

  return normalizedFileName.slice(extensionIndex).toLowerCase();
}

function resolveThreadVoicePlaybackSourceKind(input: {
  playbackSourceUrl: string | null;
  transportSourceUrl: string | null;
}) {
  if (input.playbackSourceUrl?.startsWith('blob:')) {
    return 'blob' as const;
  }

  if (input.playbackSourceUrl || input.transportSourceUrl) {
    return 'transport' as const;
  }

  return 'missing' as const;
}

function resolveAudioCanPlayTypeResult(
  audio: HTMLAudioElement | null,
  mimeType: string | null,
) {
  if (!audio || !mimeType || typeof audio.canPlayType !== 'function') {
    return null;
  }

  const result = audio.canPlayType(mimeType);
  return result || 'no';
}

function resolveThreadVoicePlaybackSourceById(
  playbackSources: readonly MessagingVoicePlaybackSourceOption[],
  sourceId: string | null | undefined,
) {
  if (!sourceId) {
    return null;
  }

  return (
    playbackSources.find((playbackSource) => playbackSource.sourceId === sourceId) ??
    null
  );
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

function resolveVoiceMessageRuntimeModel(input: {
  canPreparePlaybackSource: boolean;
  devicePlaybackSupportStatus: ThreadVoiceDevicePlaybackSupport['status'];
  didFailPlaybackSourcePrepare?: boolean;
  hasAttachment: boolean;
  hasPlaybackSource: boolean;
  hasRecoverableAttachmentLocator: boolean;
  isPreparingPlaybackSource?: boolean;
  playbackFailed: boolean;
  stageHint?: 'uploading' | 'processing' | 'failed' | null;
}): VoiceMessageRuntimeModel {
  let state: VoiceMessageRenderState;
  let reason: string;

  if (input.stageHint === 'failed' || input.playbackFailed) {
    state = 'failed';
    reason = input.stageHint === 'failed' ? 'stage-failed' : 'playback-failed';
  } else if (
    input.devicePlaybackSupportStatus === 'unsupported' &&
    input.hasAttachment
  ) {
    state = 'failed';
    reason = 'device-playback-unsupported';
  } else if (input.hasPlaybackSource) {
    state = 'ready';
    reason = 'playback-source-ready';
  } else if (input.stageHint === 'uploading') {
    state = 'uploading';
    reason = 'stage-uploading';
  } else if (input.stageHint === 'processing') {
    state = 'processing';
    reason = 'stage-processing';
  } else if (input.isPreparingPlaybackSource) {
    state = 'processing';
    reason = 'playback-source-preparing';
  } else if (input.didFailPlaybackSourcePrepare) {
    state = 'failed';
    reason = 'playback-source-prepare-failed';
  } else if (input.hasRecoverableAttachmentLocator) {
    state = 'pending';
    reason = input.canPreparePlaybackSource
      ? 'storage-locator-awaiting-playback-source'
      : 'storage-locator-pending';
  } else if (input.hasAttachment) {
    state = 'failed';
    reason = 'attachment-present-without-playback-path';
  } else {
    state = 'failed';
    reason = 'attachment-missing-failed';
  }

  let interactionAvailability: VoiceMessageInteractionAvailability;

  switch (state) {
    case 'ready':
      interactionAvailability = 'playable';
      break;
    case 'failed':
      interactionAvailability =
        reason === 'device-playback-unsupported'
          ? 'disabled'
          : input.hasPlaybackSource || input.canPreparePlaybackSource
          ? 'retryable'
          : 'disabled';
      break;
    default:
      interactionAvailability = 'disabled';
      break;
  }

  return {
    interactionAvailability,
    reason,
    state,
  };
}

function getVoiceMessageBaseStateLabel(input: {
  reason: string;
  state: VoiceMessageRenderState;
  t: ReturnType<typeof getTranslations>;
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
  t: ReturnType<typeof getTranslations>;
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
  const t = getTranslations(language);
  const attachmentTransportSourceUrl = normalizeAttachmentSignedUrl(
    attachment?.signedUrl,
  );
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [devicePlaybackSupport, setDevicePlaybackSupport] =
    useState<ThreadVoiceDevicePlaybackSupport>(
      UNKNOWN_THREAD_VOICE_DEVICE_PLAYBACK_SUPPORT,
    );
  const handleAudioRef = useCallback((audio: HTMLAudioElement | null) => {
    audioRef.current = audio;
    configureInlineAudioElement(audio);
  }, []);
  const [playbackState, setPlaybackState] =
    useState<MessagingVoicePlaybackState>('idle');
  const [progressMs, setProgressMs] = useState(0);
  const [resolvedDurationMs, setResolvedDurationMs] = useState<number | null>(
    attachment?.durationMs ?? null,
  );
  const [playbackFailed, setPlaybackFailed] = useState(false);
  const [
    resolvedPlaybackSourceState,
    setResolvedPlaybackSourceState,
  ] = useState<{
    sourceId: string;
    transportSourceUrl: string | null;
  } | null>(null);
  const [
    ignoredPlaybackTransportState,
    setIgnoredPlaybackTransportState,
  ] = useState<{
    sourceId: string;
    transportSourceUrl: string | null;
  } | null>(null);
  const [preferredDevicePlaybackSourceId, setPreferredDevicePlaybackSourceId] =
    useState<string | null>(null);
  const [didFailPlaybackSourcePrepare, setDidFailPlaybackSourcePrepare] =
    useState(false);
  const [isPreparingPlaybackSource, setIsPreparingPlaybackSource] =
    useState(false);
  const [hasPendingPlaybackIntent, setHasPendingPlaybackIntent] = useState(false);
  const preparePlaybackSourcePromiseRef =
    useRef<Promise<string | null> | null>(null);
  const playbackIntentVersionRef = useRef(0);
  const queuedPlaybackIntentVersionRef = useRef<number | null>(null);
  const lastVoicePointerActivationAtRef = useRef(0);
  const lastVoiceLongPressAtRef = useRef(0);
  const claimedPlaybackOwnerVersionRef = useRef<number | null>(null);
  const lastVoiceProofSnapshotRef = useRef<string | null>(null);
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
  const voicePlaybackSourceOptions = useMemo(
    () =>
      resolveMessagingVoicePlaybackSourceOptions({
        original: attachment
          ? {
              assetId: attachment.id,
              durationMs: attachment.durationMs ?? null,
              fileName: attachment.fileName ?? null,
              mimeType: attachment.mimeType ?? null,
              source: 'supabase-storage',
              storageBucket: attachment.bucket ?? null,
              storageObjectPath: attachment.objectPath ?? null,
              transportSourceUrl: attachmentTransportSourceUrl,
            }
          : null,
        variants:
          attachment?.voicePlaybackVariants?.map((variant) => ({
            ...variant,
            transportSourceUrl: normalizeAttachmentSignedUrl(
              variant.transportSourceUrl,
            ),
          })) ?? null,
      }),
    [attachment, attachmentTransportSourceUrl],
  );
  const runtimeVoicePlaybackSources = useMemo(
    () =>
      voicePlaybackSourceOptions.map((playbackSource) => {
        let transportSourceUrl = normalizeAttachmentSignedUrl(
          playbackSource.transportSourceUrl,
        );

        if (
          ignoredPlaybackTransportState?.sourceId === playbackSource.sourceId &&
          transportSourceUrl === ignoredPlaybackTransportState.transportSourceUrl
        ) {
          transportSourceUrl = null;
        }

        if (
          resolvedPlaybackSourceState?.sourceId === playbackSource.sourceId &&
          resolvedPlaybackSourceState.transportSourceUrl
        ) {
          transportSourceUrl = resolvedPlaybackSourceState.transportSourceUrl;
        }

        return transportSourceUrl === playbackSource.transportSourceUrl
          ? playbackSource
          : {
              ...playbackSource,
              transportSourceUrl,
            };
      }),
    [
      ignoredPlaybackTransportState,
      resolvedPlaybackSourceState,
      voicePlaybackSourceOptions,
    ],
  );
  const voicePlaybackSourceSignature = runtimeVoicePlaybackSources
    .map((playbackSource) => playbackSource.sourceId)
    .join('|');
  const fallbackVoicePlaybackSource =
    runtimeVoicePlaybackSources.find(
      (playbackSource) => playbackSource.origin === 'original',
    ) ??
    runtimeVoicePlaybackSources[0] ??
    null;
  const activeVoicePlaybackSource =
    resolveThreadVoicePlaybackSourceById(
      runtimeVoicePlaybackSources,
      resolvedPlaybackSourceState?.sourceId ?? preferredDevicePlaybackSourceId,
    ) ?? fallbackVoicePlaybackSource;
  const voiceFileName = activeVoicePlaybackSource?.fileName?.trim() || null;
  const voiceFileExtension = getThreadVoiceFileExtension(voiceFileName);
  const storedVoiceMimeType = resolveMessagingAttachmentMimeType({
    fileName: voiceFileName,
    mimeType: activeVoicePlaybackSource?.mimeType ?? null,
  });
  const hasRecoverableAttachmentStorageLocator =
    hasRecoverableThreadVoicePlaybackLocator({
      attachment: activeVoicePlaybackSource
        ? {
            bucket: activeVoicePlaybackSource.storageBucket,
            durationMs: activeVoicePlaybackSource.durationMs ?? null,
            id: activeVoicePlaybackSource.assetId,
            messageId,
            objectPath: activeVoicePlaybackSource.storageObjectPath,
          }
        : null,
      expectedMessageId: messageId,
    });
  const voicePlaybackSourceSnapshot = resolveThreadVoicePlaybackSourceSnapshot({
    attachment: activeVoicePlaybackSource
      ? {
          bucket: activeVoicePlaybackSource.storageBucket,
          durationMs: activeVoicePlaybackSource.durationMs ?? null,
          id: activeVoicePlaybackSource.assetId,
          messageId,
          objectPath: activeVoicePlaybackSource.storageObjectPath,
        }
      : null,
    ignoredTransportSourceUrl:
      ignoredPlaybackTransportState?.sourceId === activeVoicePlaybackSource?.sourceId
        ? ignoredPlaybackTransportState.transportSourceUrl
        : null,
    messageId,
    playbackSources: runtimeVoicePlaybackSources,
    preferredSourceId: activeVoicePlaybackSource?.sourceId ?? null,
    transportSourceUrl: activeVoicePlaybackSource?.transportSourceUrl ?? null,
  });
  const {
    cacheKey: voicePlaybackCacheKey,
    cachedDurationMs,
    localPlaybackUrl: effectiveVoicePlaybackSourceUrl,
    selectedSourceId: effectiveVoicePlaybackSourceId,
    shouldHydratePreparedPlayback: shouldHydratePreparedVoicePlayback,
    transportSourceUrl: effectiveVoiceTransportSourceUrl,
  } = voicePlaybackSourceSnapshot;
  const canPreparePlaybackSource =
    Boolean(conversationId && hasRecoverableAttachmentStorageLocator) &&
    !effectiveVoiceTransportSourceUrl;
  const hasPlaybackSource = Boolean(effectiveVoicePlaybackSourceUrl);
  const playbackSourceKind = resolveThreadVoicePlaybackSourceKind({
    playbackSourceUrl: effectiveVoicePlaybackSourceUrl,
    transportSourceUrl: effectiveVoiceTransportSourceUrl,
  });
  const voiceRuntimeModel = resolveVoiceMessageRuntimeModel({
    canPreparePlaybackSource,
    devicePlaybackSupportStatus: devicePlaybackSupport.status,
    didFailPlaybackSourcePrepare,
    hasAttachment: Boolean(attachment),
    hasPlaybackSource,
    hasRecoverableAttachmentLocator: hasRecoverableAttachmentStorageLocator,
    isPreparingPlaybackSource,
    playbackFailed,
    stageHint,
  });
  const voiceRendererModel = resolveVoiceMessageRendererModel({
    playbackState,
    runtimeModel: voiceRuntimeModel,
    t,
  });
  const voiceState = voiceRendererModel.state;
  const voiceRenderReason = voiceRendererModel.reason;
  const voiceInteractionAvailability =
    voiceRendererModel.interactionAvailability;
  const totalDurationMs =
    resolvedDurationMs && resolvedDurationMs > 0 ? resolvedDurationMs : 0;
  const progressRatio =
    totalDurationMs > 0
      ? Math.min(1, Math.max(0, progressMs / totalDurationMs))
      : 0;
  const isBuffering = voiceRendererModel.isBuffering;
  const stateLabel = voiceRendererModel.stateLabel;
  const stateNote = voiceRendererModel.stateNote;
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

  useEffect(() => {
    let isCancelled = false;

    void (async () => {
      const selection = await resolveThreadVoicePreferredPlaybackSource({
        audio: audioRef.current,
        playbackSources: runtimeVoicePlaybackSources,
        preferredSourceId: resolvedPlaybackSourceState?.sourceId ?? null,
      });

      if (isCancelled) {
        return;
      }

      setPreferredDevicePlaybackSourceId(selection.playbackSource?.sourceId ?? null);
      setDevicePlaybackSupport(selection.playbackSupport);
      logVoiceThreadDiagnostic('voice-device-playability-resolved', {
        canPlayType: selection.playbackSupport.canPlayType,
        fileExtension: voiceFileExtension,
        mediaCapabilitiesPowerEfficient:
          selection.playbackSupport.mediaCapabilitiesPowerEfficient,
        mediaCapabilitiesSmooth:
          selection.playbackSupport.mediaCapabilitiesSmooth,
        mediaCapabilitiesSupported:
          selection.playbackSupport.mediaCapabilitiesSupported,
        messageId,
        playbackSourceOrigin: selection.playbackSource?.origin ?? null,
        playbackSourceRole: selection.playbackSource?.role ?? null,
        playbackSourceSourceId: selection.playbackSource?.sourceId ?? null,
        storedMimeType: selection.playbackSupport.mimeType,
        supportStatus: selection.playbackSupport.status,
      });
      logVoiceThreadProof('voice-device-playability-resolved', {
        canPlayType: selection.playbackSupport.canPlayType,
        fileExtension: voiceFileExtension,
        mediaCapabilitiesPowerEfficient:
          selection.playbackSupport.mediaCapabilitiesPowerEfficient,
        mediaCapabilitiesSmooth:
          selection.playbackSupport.mediaCapabilitiesSmooth,
        mediaCapabilitiesSupported:
          selection.playbackSupport.mediaCapabilitiesSupported,
        messageId,
        playbackSourceOrigin: selection.playbackSource?.origin ?? null,
        playbackSourceRole: selection.playbackSource?.role ?? null,
        playbackSourceSourceId: selection.playbackSource?.sourceId ?? null,
        storedMimeType: selection.playbackSupport.mimeType,
        supportStatus: selection.playbackSupport.status,
      });
    })();

    return () => {
      isCancelled = true;
    };
  }, [
    messageId,
    resolvedPlaybackSourceState?.sourceId,
    runtimeVoicePlaybackSources,
    voiceFileExtension,
  ]);

  useEffect(() => {
    const proofSnapshotKey = [
      messageId,
      voicePlaybackCacheKey ?? '',
      effectiveVoicePlaybackSourceId ?? activeVoicePlaybackSource?.sourceId ?? '',
      effectiveVoicePlaybackSourceUrl ? 'playback' : 'no-playback',
      effectiveVoiceTransportSourceUrl ? 'transport' : 'no-transport',
      shouldHydratePreparedVoicePlayback ? 'hydrate' : 'cold',
      devicePlaybackSupport.status,
      voiceState,
      voiceRenderReason,
    ].join('|');

    if (lastVoiceProofSnapshotRef.current === proofSnapshotKey) {
      return;
    }

    lastVoiceProofSnapshotRef.current = proofSnapshotKey;
    logVoiceThreadProof('source-snapshot-resolved', {
      cacheKey: voicePlaybackCacheKey,
      fileExtension: voiceFileExtension,
      hasPlaybackSource: Boolean(effectiveVoicePlaybackSourceUrl),
      hasTransportSource: Boolean(effectiveVoiceTransportSourceUrl),
      messageId,
      playbackSourceOrigin: activeVoicePlaybackSource?.origin ?? null,
      playbackSourceKind,
      playbackSourceRole: activeVoicePlaybackSource?.role ?? null,
      playbackSourceSourceId:
        effectiveVoicePlaybackSourceId ?? activeVoicePlaybackSource?.sourceId ?? null,
      renderReason: voiceRenderReason,
      shouldHydratePreparedPlayback: shouldHydratePreparedVoicePlayback,
      storedMimeType: storedVoiceMimeType,
      supportCanPlayType: devicePlaybackSupport.canPlayType,
      supportStatus: devicePlaybackSupport.status,
      voiceState,
    });
  }, [
    devicePlaybackSupport.canPlayType,
    devicePlaybackSupport.status,
    activeVoicePlaybackSource?.origin,
    activeVoicePlaybackSource?.role,
    activeVoicePlaybackSource?.sourceId,
    effectiveVoicePlaybackSourceId,
    effectiveVoicePlaybackSourceUrl,
    effectiveVoiceTransportSourceUrl,
    messageId,
    playbackSourceKind,
    shouldHydratePreparedVoicePlayback,
    voicePlaybackCacheKey,
    voiceRenderReason,
    voiceFileExtension,
    voiceState,
    storedVoiceMimeType,
  ]);

  const clearVoiceLongPress = useCallback(() => {
    if (voiceLongPressTimeoutRef.current) {
      clearTimeout(voiceLongPressTimeoutRef.current);
      voiceLongPressTimeoutRef.current = null;
    }
  }, []);

  const invalidatePlaybackStartRequests = useCallback(() => {
    playbackIntentVersionRef.current += 1;
    queuedPlaybackIntentVersionRef.current = null;
    return playbackIntentVersionRef.current;
  }, []);

  const clearPendingPlaybackIntent = useCallback(
    (options?: { clearGlobalIntent?: boolean }) => {
      invalidatePlaybackStartRequests();
      setHasPendingPlaybackIntent(false);

      if (options?.clearGlobalIntent && hasActiveThreadVoicePlaybackIntent(messageId)) {
        setActiveThreadVoicePlaybackIntent(null);
      }
    },
    [invalidatePlaybackStartRequests, messageId],
  );

  const armPendingPlaybackIntent = useCallback(() => {
    const nextIntentVersion = invalidatePlaybackStartRequests();
    logVoiceThreadProof('voice-owner-requested', {
      intentVersion: nextIntentVersion,
      messageId,
      playbackState,
      voiceState,
    });
    requestActiveThreadVoicePlaybackIntent(messageId);
    setHasPendingPlaybackIntent(true);
    return nextIntentVersion;
  }, [invalidatePlaybackStartRequests, messageId, playbackState, voiceState]);

  useEffect(() => {
    const audio = audioRef.current;

    return () => {
      clearVoiceLongPress();
      invalidatePlaybackStartRequests();

      if (hasActiveThreadVoicePlaybackIntent(messageId)) {
        setActiveThreadVoicePlaybackIntent(null);
      }

      if (!audio) {
        return;
      }

      audio.pause();
      releaseActiveThreadVoicePlayback(
        messageId,
        audio,
        claimedPlaybackOwnerVersionRef.current,
      );
      claimedPlaybackOwnerVersionRef.current = null;
      audio.src = '';
    };
  }, [clearVoiceLongPress, invalidatePlaybackStartRequests, messageId]);

  useEffect(() => {
    setResolvedDurationMs(attachment?.durationMs ?? cachedDurationMs ?? null);
    setResolvedPlaybackSourceState(null);
    setDidFailPlaybackSourcePrepare(false);
    setIgnoredPlaybackTransportState(null);
    setPreferredDevicePlaybackSourceId(null);
    clearPendingPlaybackIntent();
    setPlaybackFailed(false);
  }, [
    attachment?.durationMs,
    attachment?.id,
    cachedDurationMs,
    clearPendingPlaybackIntent,
    voicePlaybackSourceSignature,
  ]);

  const rememberVoicePlaybackCacheEntry = useCallback(
    (patch: Partial<ThreadVoicePlaybackCacheEntry>) => {
      writeThreadVoicePlaybackCacheEntry(voicePlaybackCacheKey, patch);
    },
    [voicePlaybackCacheKey],
  );

  useEffect(() => {
    const audio = audioRef.current;

    if (
      !audio ||
      !effectiveVoicePlaybackSourceUrl ||
      !shouldHydratePreparedVoicePlayback
    ) {
      return;
    }

    if (audio.getAttribute('src') !== effectiveVoicePlaybackSourceUrl) {
      audio.setAttribute('src', effectiveVoicePlaybackSourceUrl);
    }

    if (audio.readyState >= VOICE_READY_TO_REPLAY_STATE) {
      rememberVoicePlaybackCacheEntry({
        durationMs: resolvedDurationMs,
        playbackUrl: effectiveVoicePlaybackSourceUrl,
        sessionReady: true,
        sourceUrl:
          effectiveVoiceTransportSourceUrl ?? effectiveVoicePlaybackSourceUrl,
        warmed: Boolean(effectiveVoicePlaybackSourceUrl.startsWith('blob:')),
      });
      setPlaybackState((current) =>
        current === 'buffering'
          ? audio.currentTime > 0
            ? 'paused'
            : 'idle'
          : current,
      );
      return;
    }

    audio.load();
  }, [
    effectiveVoicePlaybackSourceUrl,
    effectiveVoiceTransportSourceUrl,
    rememberVoicePlaybackCacheEntry,
    resolvedDurationMs,
    shouldHydratePreparedVoicePlayback,
  ]);

  useEffect(() => {
    const audio = audioRef.current;

    if (
      voiceState !== 'ready' ||
      hasPendingPlaybackIntent ||
      !audio ||
      audio.readyState < VOICE_READY_TO_REPLAY_STATE ||
      !audio.paused
    ) {
      return;
    }

    setPlaybackState((current) => {
      if (current === 'playing') {
        return current;
      }

      return audio.currentTime > 0 ? 'paused' : 'idle';
    });
  }, [effectiveVoicePlaybackSourceUrl, hasPendingPlaybackIntent, voiceState]);

  const preparePlaybackSource = useCallback(async () => {
    if (
      !effectiveVoiceTransportSourceUrl &&
      (!canPreparePlaybackSource || !activeVoicePlaybackSource)
    ) {
      return effectiveVoicePlaybackSourceUrl ?? effectiveVoiceTransportSourceUrl;
    }

    if (preparePlaybackSourcePromiseRef.current) {
      return preparePlaybackSourcePromiseRef.current;
    }

    const promise = (async () => {
      setIsPreparingPlaybackSource(true);
      setDidFailPlaybackSourcePrepare(false);

      try {
        logVoiceThreadProof('voice-source-resolver-entered', {
          canPlayType: devicePlaybackSupport.canPlayType,
          fileExtension: voiceFileExtension,
          hasExistingPlaybackSource: Boolean(effectiveVoicePlaybackSourceUrl),
          hasTransportSource: Boolean(effectiveVoiceTransportSourceUrl),
          mediaCapabilitiesSupported:
            devicePlaybackSupport.mediaCapabilitiesSupported,
          messageId,
          playbackSourceOrigin: activeVoicePlaybackSource?.origin ?? null,
          playbackSourceKind,
          playbackSourceRole: activeVoicePlaybackSource?.role ?? null,
          playbackSourceSourceId: activeVoicePlaybackSource?.sourceId ?? null,
          storedMimeType: storedVoiceMimeType,
          supportStatus: devicePlaybackSupport.status,
          voiceState,
        });
        const resolution = await prepareThreadVoicePlaybackSource({
          cacheKey: voicePlaybackCacheKey,
          conversationId,
          locator: {
            attachmentId: activeVoicePlaybackSource?.assetId ?? null,
            conversationId,
            messageId,
          },
          messageId,
          onDiagnostic: logVoiceThreadDiagnostic,
          playbackSources: runtimeVoicePlaybackSources,
          preferredSourceId: activeVoicePlaybackSource?.sourceId ?? null,
          transportSourceUrl: effectiveVoiceTransportSourceUrl,
        });

        if (resolution.status === 'failed') {
          setDidFailPlaybackSourcePrepare(true);
        }

        const nextTransportSourceUrl = resolution.transportSourceUrl;

        if (nextTransportSourceUrl) {
          setIgnoredPlaybackTransportState(null);
          setDidFailPlaybackSourcePrepare(false);
          setPlaybackFailed(false);
          if (resolution.selectedPlaybackSource) {
            setResolvedPlaybackSourceState({
              sourceId: resolution.selectedPlaybackSource.sourceId,
              transportSourceUrl: nextTransportSourceUrl,
            });
          }
        }

        logVoiceThreadProof('voice-source-prepared', {
          canPlayType: devicePlaybackSupport.canPlayType,
          fileExtension: voiceFileExtension,
          hasPlaybackSource: Boolean(resolution.playbackSourceUrl),
          hasTransportSource: Boolean(nextTransportSourceUrl),
          mediaCapabilitiesSupported:
            devicePlaybackSupport.mediaCapabilitiesSupported,
          messageId,
          playbackSourceOrigin:
            resolution.selectedPlaybackSource?.origin ??
            activeVoicePlaybackSource?.origin ??
            null,
          playbackSourceKind: resolveThreadVoicePlaybackSourceKind({
            playbackSourceUrl: resolution.playbackSourceUrl,
            transportSourceUrl: nextTransportSourceUrl,
          }),
          playbackSourceRole:
            resolution.selectedPlaybackSource?.role ??
            activeVoicePlaybackSource?.role ??
            null,
          playbackSourceSourceId:
            resolution.selectedPlaybackSource?.sourceId ??
            activeVoicePlaybackSource?.sourceId ??
            null,
          status: resolution.status,
          storedMimeType: storedVoiceMimeType,
          supportStatus: devicePlaybackSupport.status,
          voiceState,
        });
        return resolution.playbackSourceUrl;
      } finally {
        setIsPreparingPlaybackSource(false);
        preparePlaybackSourcePromiseRef.current = null;
      }
    })();

    preparePlaybackSourcePromiseRef.current = promise;
    return promise;
  }, [
    activeVoicePlaybackSource,
    canPreparePlaybackSource,
    conversationId,
    devicePlaybackSupport.canPlayType,
    devicePlaybackSupport.mediaCapabilitiesSupported,
    devicePlaybackSupport.status,
    effectiveVoicePlaybackSourceUrl,
    effectiveVoiceTransportSourceUrl,
    runtimeVoicePlaybackSources,
    messageId,
    playbackSourceKind,
    voiceState,
    voicePlaybackCacheKey,
    voiceFileExtension,
    storedVoiceMimeType,
  ]);

  useEffect(() => {
    if (
      !canPreparePlaybackSource ||
      (voiceState !== 'pending' && voiceState !== 'processing')
    ) {
      return;
    }

    void preparePlaybackSource();
  }, [canPreparePlaybackSource, preparePlaybackSource, voiceState]);

  const startPlaybackUnsafe = useCallback(
    async (playbackSourceOverride?: string | null) => {
      const audio = audioRef.current;
      const nextPlaybackSource =
        playbackSourceOverride?.trim() || effectiveVoicePlaybackSourceUrl;

      logVoiceThreadDiagnostic('playback-start-requested', {
        hasAudioElement: Boolean(audio),
        hasOverrideSource: Boolean(playbackSourceOverride?.trim()),
        hasPlaybackSource: Boolean(nextPlaybackSource),
        messageId,
      });

      if (!audio || !nextPlaybackSource) {
        logVoiceThreadDiagnostic('playback-start-blocked', {
          hasAudioElement: Boolean(audio),
          hasPlaybackSource: Boolean(nextPlaybackSource),
          messageId,
        });
        return false;
      }

      const ownerVersion = claimActiveThreadVoicePlayback(messageId, audio);
      claimedPlaybackOwnerVersionRef.current = ownerVersion;

      if (audio.getAttribute('src') !== nextPlaybackSource) {
        audio.setAttribute('src', nextPlaybackSource);
        audio.load();
      } else if (audio.readyState === 0) {
        audio.load();
      }

      setPlaybackFailed(false);
      if (audio.readyState < VOICE_READY_TO_REPLAY_STATE) {
        setPlaybackState('buffering');
      }

      const canPlayTypeResult = resolveAudioCanPlayTypeResult(
        audio,
        storedVoiceMimeType,
      );

      logVoiceThreadDiagnostic('audio-source-configured', {
        canPlayType: canPlayTypeResult,
        currentSrc: audio.currentSrc || audio.src || null,
        fileExtension: voiceFileExtension,
        messageId,
        mediaCapabilitiesSupported:
          devicePlaybackSupport.mediaCapabilitiesSupported,
        networkState: audio.networkState,
        ownerVersion,
        playbackSource: nextPlaybackSource,
        readyState: audio.readyState,
        supportStatus: devicePlaybackSupport.status,
        storedMimeType: storedVoiceMimeType,
      });
      logVoiceThreadProof('audio-play-requested', {
        audioCurrentSrc: audio.currentSrc || audio.src || null,
        canPlayType: canPlayTypeResult,
        currentSrc: audio.currentSrc || audio.src || null,
        errorCode: audio.error?.code ?? null,
        fileExtension: voiceFileExtension,
        hasPlaybackSource: Boolean(nextPlaybackSource),
        messageId,
        networkState: audio.networkState,
        ownerVersion,
        playbackReadyState: audio.readyState,
        playbackSourceKind: nextPlaybackSource.startsWith('blob:')
          ? 'blob'
          : 'transport',
        supportStatus: devicePlaybackSupport.status,
        storedMimeType: storedVoiceMimeType,
      });
      logVoiceThreadProof('voice-audio-play-requested', {
        audioCurrentSrc: audio.currentSrc || audio.src || null,
        canPlayType: canPlayTypeResult,
        currentSrc: audio.currentSrc || audio.src || null,
        errorCode: audio.error?.code ?? null,
        fileExtension: voiceFileExtension,
        hasPlaybackSource: Boolean(nextPlaybackSource),
        messageId,
        networkState: audio.networkState,
        ownerVersion,
        playbackSourceKind: nextPlaybackSource.startsWith('blob:')
          ? 'blob'
          : 'transport',
        supportStatus: devicePlaybackSupport.status,
        storedMimeType: storedVoiceMimeType,
        voiceState,
      });

      try {
        await audio.play();
        logVoiceThreadProof('audio-play-fulfilled', {
          currentSrc: audio.currentSrc || audio.src || null,
          errorCode: audio.error?.code ?? null,
          fileExtension: voiceFileExtension,
          messageId,
          networkState: audio.networkState,
          ownerVersion,
          playbackReadyState: audio.readyState,
          playbackSourceKind: nextPlaybackSource.startsWith('blob:')
            ? 'blob'
            : 'transport',
          supportStatus: devicePlaybackSupport.status,
          storedMimeType: storedVoiceMimeType,
        });
        logVoiceThreadProof('voice-audio-play-fulfilled', {
          currentSrc: audio.currentSrc || audio.src || null,
          errorCode: audio.error?.code ?? null,
          fileExtension: voiceFileExtension,
          messageId,
          networkState: audio.networkState,
          ownerVersion,
          playbackSourceKind: nextPlaybackSource.startsWith('blob:')
            ? 'blob'
            : 'transport',
          supportStatus: devicePlaybackSupport.status,
          storedMimeType: storedVoiceMimeType,
          voiceState,
        });
        if (
          !isActiveThreadVoicePlaybackOwner({
            audio,
            messageId,
            ownerVersion,
          })
        ) {
          logVoiceThreadDiagnostic('playback-start-stale-owner', {
            messageId,
            ownerVersion,
          });
          audio.pause();
          return false;
        }
        logVoiceThreadDiagnostic('audio-play-triggered', {
          messageId,
          ownerVersion,
        });
        clearPendingPlaybackIntent();
        return true;
      } catch (error) {
        logVoiceThreadProof('audio-play-rejected', {
          currentSrc: audio.currentSrc || audio.src || null,
          errorMessage: error instanceof Error ? error.message : String(error),
          errorCode: audio.error?.code ?? null,
          fileExtension: voiceFileExtension,
          messageId,
          networkState: audio.networkState,
          ownerVersion,
          playbackReadyState: audio.readyState,
          playbackSourceKind: nextPlaybackSource.startsWith('blob:')
            ? 'blob'
            : 'transport',
          supportStatus: devicePlaybackSupport.status,
          storedMimeType: storedVoiceMimeType,
        });
        logVoiceThreadProof('voice-audio-play-rejected', {
          canPlayType: canPlayTypeResult,
          currentSrc: audio.currentSrc || audio.src || null,
          errorMessage: error instanceof Error ? error.message : String(error),
          errorCode: audio.error?.code ?? null,
          fileExtension: voiceFileExtension,
          messageId,
          networkState: audio.networkState,
          ownerVersion,
          playbackSourceKind: nextPlaybackSource.startsWith('blob:')
            ? 'blob'
            : 'transport',
          supportStatus: devicePlaybackSupport.status,
          storedMimeType: storedVoiceMimeType,
          voiceState,
        });
        logVoiceThreadDiagnostic('audio-play-trigger-failed', {
          errorMessage: error instanceof Error ? error.message : String(error),
          messageId,
          ownerVersion,
        });
        releaseActiveThreadVoicePlayback(messageId, audio, ownerVersion);
        if (claimedPlaybackOwnerVersionRef.current === ownerVersion) {
          claimedPlaybackOwnerVersionRef.current = null;
        }
        clearPendingPlaybackIntent();
        setPlaybackFailed(true);
        setPlaybackState('failed');
        return false;
      }
    },
    [
      clearPendingPlaybackIntent,
      devicePlaybackSupport.mediaCapabilitiesSupported,
      devicePlaybackSupport.status,
      effectiveVoicePlaybackSourceUrl,
      messageId,
      storedVoiceMimeType,
      voiceFileExtension,
      voiceState,
    ],
  );

  const startPlayback = useCallback(
    (
      playbackSourceOverride?: string | null,
      expectedIntentVersion?: number | null,
    ) => {
      return runActiveThreadVoicePlaybackTransition(async () => {
        if (
          expectedIntentVersion != null &&
          playbackIntentVersionRef.current !== expectedIntentVersion
        ) {
          logVoiceThreadDiagnostic('playback-start-stopped-stale-intent', {
            expectedIntentVersion,
            messageId,
            playbackIntentVersion: playbackIntentVersionRef.current,
          });
          return false;
        }

        if (!hasActiveThreadVoicePlaybackIntent(messageId)) {
          logVoiceThreadDiagnostic('playback-start-stopped-not-intended', {
            messageId,
          });
          clearPendingPlaybackIntent();
          return false;
        }

        return startPlaybackUnsafe(playbackSourceOverride);
      });
    },
    [clearPendingPlaybackIntent, messageId, startPlaybackUnsafe],
  );

  useEffect(() => {
    logVoiceThreadDiagnostic('render-state', {
      attachmentId: activeVoicePlaybackSource?.assetId ?? attachment?.id ?? null,
      attachmentMessageId: messageId,
      canPreparePlaybackSource,
      conversationId,
      hasPlaybackSource,
      hasTransportSource: Boolean(effectiveVoiceTransportSourceUrl),
      isOwnMessage,
      messageId,
      playbackSourceOrigin: activeVoicePlaybackSource?.origin ?? null,
      playbackSourceRole: activeVoicePlaybackSource?.role ?? null,
      playbackSourceSourceId: activeVoicePlaybackSource?.sourceId ?? null,
      renderReason: voiceRenderReason,
      renderState: voiceState,
      storageLocatorPresent: Boolean(
        activeVoicePlaybackSource?.storageBucket &&
          activeVoicePlaybackSource.storageObjectPath,
      ),
    });
  }, [
    attachment?.id,
    activeVoicePlaybackSource?.assetId,
    activeVoicePlaybackSource?.origin,
    activeVoicePlaybackSource?.role,
    activeVoicePlaybackSource?.sourceId,
    activeVoicePlaybackSource?.storageBucket,
    activeVoicePlaybackSource?.storageObjectPath,
    canPreparePlaybackSource,
    conversationId,
    effectiveVoiceTransportSourceUrl,
    hasPlaybackSource,
    isOwnMessage,
    messageId,
    voiceRenderReason,
    voiceState,
  ]);

  useEffect(() => {
    if (!effectiveVoicePlaybackSourceUrl) {
      const audio = audioRef.current;

      if (hasActiveThreadVoicePlaybackIntent(messageId)) {
        setActiveThreadVoicePlaybackIntent(null);
      }

      clearPendingPlaybackIntent();

      if (audio) {
        audio.pause();
        releaseActiveThreadVoicePlayback(
          messageId,
          audio,
          claimedPlaybackOwnerVersionRef.current,
        );
        claimedPlaybackOwnerVersionRef.current = null;
        audio.src = '';
      } else {
        claimedPlaybackOwnerVersionRef.current = null;
      }

      setProgressMs(0);
      setPlaybackState((current) => (current === 'failed' ? current : 'idle'));
      return;
    }

    setPlaybackState((current) =>
      current === 'failed' || current === 'buffering' ? current : 'idle',
    );
  }, [clearPendingPlaybackIntent, effectiveVoicePlaybackSourceUrl, messageId]);

  useEffect(() => {
    if (!hasPendingPlaybackIntent) {
      return;
    }

    if (!hasActiveThreadVoicePlaybackIntent(messageId)) {
      logVoiceThreadDiagnostic('playback-intent-cleared-not-active-owner', {
        messageId,
      });
      clearPendingPlaybackIntent();
      return;
    }

    if (playbackState === 'buffering' || playbackState === 'playing') {
      return;
    }

    if (!effectiveVoicePlaybackSourceUrl) {
      if (canPreparePlaybackSource && !isPreparingPlaybackSource) {
        logVoiceThreadDiagnostic('playback-intent-awaiting-playback-source', {
          canPreparePlaybackSource,
          isPreparingPlaybackSource,
          messageId,
        });
        void preparePlaybackSource();
        return;
      }

      if (!canPreparePlaybackSource && voiceState !== 'processing') {
        logVoiceThreadDiagnostic('playback-intent-stopped-without-source', {
          canPreparePlaybackSource,
          messageId,
          voiceState,
        });
        clearPendingPlaybackIntent();
      }

      return;
    }

    const currentIntentVersion = playbackIntentVersionRef.current;

    if (queuedPlaybackIntentVersionRef.current === currentIntentVersion) {
      logVoiceThreadDiagnostic('playback-intent-start-already-queued', {
        intentVersion: currentIntentVersion,
        messageId,
      });
      return;
    }

    queuedPlaybackIntentVersionRef.current = currentIntentVersion;
    logVoiceThreadDiagnostic('playback-intent-starting-audio', {
      hasPlaybackSource: Boolean(effectiveVoicePlaybackSourceUrl),
      intentVersion: currentIntentVersion,
      messageId,
    });
    void startPlayback(effectiveVoicePlaybackSourceUrl, currentIntentVersion);
  }, [
    canPreparePlaybackSource,
    clearPendingPlaybackIntent,
    effectiveVoicePlaybackSourceUrl,
    hasPendingPlaybackIntent,
    isPreparingPlaybackSource,
    messageId,
    playbackState,
    preparePlaybackSource,
    startPlayback,
    voiceState,
  ]);

  const togglePlaybackUnsafe = useCallback(async () => {
    const audio = audioRef.current;
    const activePlaybackSnapshot = getActiveThreadVoicePlaybackSnapshot();
    const ownership = resolveActiveThreadVoicePlaybackOwnership({
      audio,
      messageId,
    });

    logVoiceThreadDiagnostic('voice-toggle-requested', {
      activeOwnerMessageId: activePlaybackSnapshot.messageId,
      canPreparePlaybackSource,
      hasAudioElement: Boolean(audio),
      hasPendingPlaybackIntent,
      hasPlaybackSource,
      hasTransportSource: Boolean(effectiveVoiceTransportSourceUrl),
      messageId,
      ownershipStatus: ownership.status,
      playbackState,
      voiceInteractionAvailability,
      voiceState,
    });

    if (voiceInteractionAvailability === 'disabled') {
      logVoiceThreadDiagnostic('voice-toggle-blocked-disabled', {
        messageId,
        voiceInteractionAvailability,
        voiceState,
      });
      return;
    }

    if (voiceInteractionAvailability === 'retryable') {
      logVoiceThreadDiagnostic('voice-toggle-entered-retry', {
        canPreparePlaybackSource,
        messageId,
        ownershipStatus: ownership.status,
      });
      setPlaybackFailed(false);
      armPendingPlaybackIntent();
      if (canPreparePlaybackSource && !isPreparingPlaybackSource) {
        void preparePlaybackSource();
      }
      return;
    }

    if (!isVoicePlayable) {
      return;
    }

    if (!audio) {
      logVoiceThreadDiagnostic('voice-toggle-missing-audio-element', {
        activeOwnerMessageId: activePlaybackSnapshot.messageId,
        canPreparePlaybackSource,
        messageId,
        ownershipStatus: ownership.status,
      });
      if (canPreparePlaybackSource) {
        armPendingPlaybackIntent();
        if (!isPreparingPlaybackSource) {
          void preparePlaybackSource();
        }
      }
      return;
    }

    if (ownership.status === 'active-owner' && !audio.paused) {
      logVoiceThreadDiagnostic('voice-toggle-pausing-active-audio', {
        messageId,
        ownerVersion: ownership.ownerVersion,
        playbackState,
      });
      clearPendingPlaybackIntent({ clearGlobalIntent: true });
      audio.pause();
      return;
    }

    if (ownership.status === 'other-owner') {
      logVoiceThreadDiagnostic('voice-toggle-switching-active-owner', {
        activeOwnerMessageId: ownership.ownerMessageId,
        messageId,
        ownerVersion: ownership.ownerVersion,
      });
      armPendingPlaybackIntent();
      if (
        !effectiveVoicePlaybackSourceUrl &&
        canPreparePlaybackSource &&
        !isPreparingPlaybackSource
      ) {
        void preparePlaybackSource();
      }
      return;
    }

    if (!audio.paused) {
      logVoiceThreadDiagnostic('voice-toggle-pausing-stale-local-audio', {
        activeOwnerMessageId: activePlaybackSnapshot.messageId,
        messageId,
      });
      clearPendingPlaybackIntent();
      audio.pause();
      return;
    }

    if (audio.paused) {
      if (hasPendingPlaybackIntent || ownership.status === 'intended-owner') {
        logVoiceThreadDiagnostic('voice-toggle-ignored-duplicate-intent', {
          messageId,
        });
        return;
      }
      logVoiceThreadDiagnostic('voice-toggle-arming-play', {
        messageId,
        playbackState,
      });
      armPendingPlaybackIntent();
    }
  }, [
    armPendingPlaybackIntent,
    canPreparePlaybackSource,
    clearPendingPlaybackIntent,
    effectiveVoicePlaybackSourceUrl,
    effectiveVoiceTransportSourceUrl,
    hasPlaybackSource,
    hasPendingPlaybackIntent,
    isPreparingPlaybackSource,
    isVoicePlayable,
    messageId,
    playbackState,
    preparePlaybackSource,
    voiceInteractionAvailability,
    voiceState,
  ]);

  const togglePlayback = useCallback(() => {
    return runActiveThreadVoicePlaybackTransition(async () => {
      await togglePlaybackUnsafe();
    });
  }, [togglePlaybackUnsafe]);

  const playButtonLabel = voiceRendererModel.playButtonLabel;

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
      logVoiceThreadDiagnostic('voice-tap-received', {
        input: 'pointer',
        messageId,
        pointerType: event.pointerType,
      });
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
      void togglePlayback();
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

      logVoiceThreadDiagnostic('voice-tap-received', {
        input: 'click',
        messageId,
      });
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
      void togglePlayback();
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

      if (activeGesture.didTriggerLongPress) {
        event.stopPropagation();
        return;
      }

      if (activeGesture.didMove) {
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
        aria-label={playButtonLabel}
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
              isBuffering
                ? 'message-voice-progress-bar message-voice-progress-bar-loading'
                : 'message-voice-progress-bar'
            }
            style={
              isBuffering ? undefined : { transform: `scaleX(${progressRatio})` }
            }
          />
        </div>
        {voiceRendererModel.showMeta ? (
          <div className="message-voice-meta">
            <span className="message-voice-state">{stateLabel}</span>
            {stateNote ? (
              <span className="message-voice-note">{stateNote}</span>
            ) : null}
          </div>
        ) : null}
      </div>
      {effectiveVoicePlaybackSourceUrl || hasRecoverableAttachmentStorageLocator ? (
        <audio
          aria-hidden="true"
          className="message-voice-audio"
          onCanPlay={(event) => {
            logVoiceThreadDiagnostic('audio-can-play', {
              messageId,
              readyState: event.currentTarget.readyState,
              src: event.currentTarget.currentSrc || event.currentTarget.src || null,
            });
            logVoiceThreadProof('audio-element-ready', {
              canPlayType: resolveAudioCanPlayTypeResult(
                event.currentTarget,
                storedVoiceMimeType,
              ),
              currentSrc:
                event.currentTarget.currentSrc || event.currentTarget.src || null,
              fileExtension: voiceFileExtension,
              messageId,
              networkState: event.currentTarget.networkState,
              playbackSourceKind,
              readyState: event.currentTarget.readyState,
              supportStatus: devicePlaybackSupport.status,
              storedMimeType: storedVoiceMimeType,
            });
            const stablePlaybackSource =
              effectiveVoicePlaybackSourceUrl ?? effectiveVoiceTransportSourceUrl;
            const nextDurationMs =
              Number.isFinite(event.currentTarget.duration) &&
              event.currentTarget.duration > 0
                ? event.currentTarget.duration * 1000
                : resolvedDurationMs;

            rememberVoicePlaybackCacheEntry({
              durationMs: nextDurationMs,
              playbackUrl: stablePlaybackSource,
              sessionReady: Boolean(stablePlaybackSource),
              sourceUrl:
                effectiveVoiceTransportSourceUrl ?? stablePlaybackSource,
              warmed: Boolean(stablePlaybackSource?.startsWith('blob:')),
            });
            if (
              !hasPendingPlaybackIntent &&
              playbackState === 'buffering' &&
              event.currentTarget.paused
            ) {
              setPlaybackState(
                event.currentTarget.currentTime > 0 ? 'paused' : 'idle',
              );
            }
          }}
          onEnded={(event) => {
            releaseActiveThreadVoicePlayback(
              messageId,
              event.currentTarget,
              claimedPlaybackOwnerVersionRef.current,
            );
            claimedPlaybackOwnerVersionRef.current = null;
            event.currentTarget.currentTime = 0;
            setProgressMs(0);
            clearPendingPlaybackIntent();
            setPlaybackState('ended');
          }}
          onError={(event) => {
            const mediaError = event.currentTarget.error;
            logVoiceThreadDiagnostic('audio-element-error', {
              errorCode: mediaError?.code ?? null,
              fileExtension: voiceFileExtension,
              messageId,
              networkState: event.currentTarget.networkState,
              readyState: event.currentTarget.readyState,
              src: event.currentTarget.currentSrc || event.currentTarget.src || null,
              supportStatus: devicePlaybackSupport.status,
              storedMimeType: storedVoiceMimeType,
            });
            logVoiceThreadProof('voice-audio-element-error', {
              canPlayType: resolveAudioCanPlayTypeResult(
                event.currentTarget,
                storedVoiceMimeType,
              ),
              currentSrc:
                event.currentTarget.currentSrc || event.currentTarget.src || null,
              errorCode: mediaError?.code ?? null,
              fileExtension: voiceFileExtension,
              messageId,
              networkState: event.currentTarget.networkState,
              playbackSourceKind,
              readyState: event.currentTarget.readyState,
              supportStatus: devicePlaybackSupport.status,
              storedMimeType: storedVoiceMimeType,
            });
            releaseActiveThreadVoicePlayback(
              messageId,
              event.currentTarget,
              claimedPlaybackOwnerVersionRef.current,
            );
            claimedPlaybackOwnerVersionRef.current = null;
            event.currentTarget.pause();
            event.currentTarget.currentTime = 0;
            setProgressMs(0);

            if (
              effectiveVoiceTransportSourceUrl &&
              hasRecoverableAttachmentStorageLocator
            ) {
              setIgnoredPlaybackTransportState(
                activeVoicePlaybackSource
                  ? {
                      sourceId: activeVoicePlaybackSource.sourceId,
                      transportSourceUrl: effectiveVoiceTransportSourceUrl,
                    }
                  : null,
              );
              setDidFailPlaybackSourcePrepare(false);
              setResolvedPlaybackSourceState(null);
              setPlaybackFailed(false);
              setPlaybackState('idle');
              return;
            }

            clearPendingPlaybackIntent();
            setPlaybackFailed(true);
            setPlaybackState('failed');
          }}
          onLoadedMetadata={(event) => {
            const nextDurationMs =
              Number.isFinite(event.currentTarget.duration) &&
              event.currentTarget.duration > 0
                ? event.currentTarget.duration * 1000
                : null;

            if (nextDurationMs !== null) {
              setResolvedDurationMs(nextDurationMs);
              rememberVoicePlaybackCacheEntry({
                durationMs: nextDurationMs,
              });
            }
          }}
          onLoadStart={(event) => {
            if (
              !hasPendingPlaybackIntent &&
              playbackState !== 'playing' &&
              playbackState !== 'buffering'
            ) {
              return;
            }

            setPlaybackState((current) =>
              current === 'playing' ||
              event.currentTarget.readyState >= VOICE_READY_TO_REPLAY_STATE
                ? current
                : 'buffering',
            );
          }}
          onPause={(event) => {
            releaseActiveThreadVoicePlayback(
              messageId,
              event.currentTarget,
              claimedPlaybackOwnerVersionRef.current,
            );
            claimedPlaybackOwnerVersionRef.current = null;
            clearPendingPlaybackIntent();

            if (event.currentTarget.ended) {
              return;
            }

            setPlaybackState(event.currentTarget.currentTime > 0 ? 'paused' : 'idle');
          }}
          onPlaying={(event) => {
            if (
              !isActiveThreadVoicePlaybackOwner({
                audio: event.currentTarget,
                messageId,
                ownerVersion: claimedPlaybackOwnerVersionRef.current,
              })
            ) {
              event.currentTarget.pause();
              return;
            }
            logVoiceThreadDiagnostic('audio-playing', {
              messageId,
              src: event.currentTarget.currentSrc || event.currentTarget.src || null,
            });
            clearPendingPlaybackIntent();
            setPlaybackFailed(false);
            setPlaybackState('playing');
            const stablePlaybackSource =
              effectiveVoicePlaybackSourceUrl ?? effectiveVoiceTransportSourceUrl;
            rememberVoicePlaybackCacheEntry({
              durationMs:
                Number.isFinite(event.currentTarget.duration) &&
                event.currentTarget.duration > 0
                  ? event.currentTarget.duration * 1000
                  : resolvedDurationMs,
              playbackUrl: stablePlaybackSource,
              sessionReady: Boolean(stablePlaybackSource),
              sourceUrl:
                effectiveVoiceTransportSourceUrl ?? stablePlaybackSource,
              warmed: Boolean(stablePlaybackSource?.startsWith('blob:')),
            });
            if (
              effectiveVoiceTransportSourceUrl &&
              !effectiveVoiceTransportSourceUrl.startsWith('blob:')
            ) {
              void prepareThreadVoicePlaybackSource({
                cacheKey: voicePlaybackCacheKey,
                conversationId,
                locator: {
                  attachmentId: activeVoicePlaybackSource?.assetId ?? null,
                  conversationId,
                  messageId,
                },
                messageId,
                onDiagnostic: logVoiceThreadDiagnostic,
                playbackSources: runtimeVoicePlaybackSources,
                preferredSourceId: activeVoicePlaybackSource?.sourceId ?? null,
                transportSourceUrl: effectiveVoiceTransportSourceUrl,
              });
            }
          }}
          onTimeUpdate={(event) => {
            setProgressMs(event.currentTarget.currentTime * 1000);
          }}
          onWaiting={(event) => {
            if (
              !hasPendingPlaybackIntent &&
              playbackState !== 'playing' &&
              playbackState !== 'buffering' &&
              event.currentTarget.paused
            ) {
              return;
            }

            setPlaybackState('buffering');
          }}
          playsInline
          preload={shouldHydratePreparedVoicePlayback ? 'auto' : 'none'}
          ref={handleAudioRef}
          src={effectiveVoicePlaybackSourceUrl ?? undefined}
          tabIndex={-1}
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
