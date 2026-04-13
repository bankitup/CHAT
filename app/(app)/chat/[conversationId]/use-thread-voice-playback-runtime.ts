'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type AudioHTMLAttributes,
  type RefCallback,
  type SyntheticEvent,
} from 'react';
import type { MessagingVoicePlaybackState } from '@/modules/messaging/media';
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
import {
  claimActiveThreadVoicePlayback,
  hasActiveThreadVoicePlaybackIntent,
  isActiveThreadVoicePlaybackOwner,
  markActiveThreadVoicePlaybackPlaying,
  releaseActiveThreadVoicePlayback,
  requestActiveThreadVoicePlaybackIntent,
  resolveActiveThreadVoicePlaybackOwnership,
  runActiveThreadVoicePlaybackTransition,
  setActiveThreadVoicePlaybackIntent,
  shouldIgnoreActiveThreadVoicePlaybackPause,
  type ThreadVoicePlaybackOwnership,
} from './thread-voice-playback-controller';
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

const VOICE_READY_TO_REPLAY_STATE = 2;

const UNKNOWN_THREAD_VOICE_DEVICE_PLAYBACK_SUPPORT: ThreadVoiceDevicePlaybackSupport =
  {
    canPlayType: null,
    mediaCapabilitiesPowerEfficient: null,
    mediaCapabilitiesSmooth: null,
    mediaCapabilitiesSupported: null,
    mimeType: null,
    status: 'unknown',
  };

export type ThreadVoiceAttachment = {
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

export type VoiceMessageRenderState =
  | 'pending'
  | 'uploading'
  | 'processing'
  | 'ready'
  | 'failed';

export type VoiceMessageInteractionAvailability =
  | 'disabled'
  | 'playable'
  | 'retryable';

export type VoiceMessageRuntimeModel = {
  interactionAvailability: VoiceMessageInteractionAvailability;
  reason: string;
  state: VoiceMessageRenderState;
};

type ThreadVoiceAudioElementProps = Pick<
  AudioHTMLAttributes<HTMLAudioElement>,
  | 'onCanPlay'
  | 'onEnded'
  | 'onError'
  | 'onLoadedMetadata'
  | 'onLoadStart'
  | 'onPause'
  | 'onPlaying'
  | 'onTimeUpdate'
  | 'onWaiting'
  | 'playsInline'
  | 'preload'
  | 'src'
  | 'tabIndex'
> & {
  ref: RefCallback<HTMLAudioElement>;
};

type UseThreadVoicePlaybackRuntimeInput = {
  attachment: ThreadVoiceAttachment | null;
  conversationId: string;
  messageId: string;
  stageHint?: 'uploading' | 'processing' | 'failed' | null;
};

type UseThreadVoicePlaybackRuntimeResult = {
  audioElementProps: ThreadVoiceAudioElementProps;
  hasPendingPlaybackIntent: boolean;
  playbackState: MessagingVoicePlaybackState;
  progressMs: number;
  resolvedDurationMs: number | null;
  shouldRenderAudioElement: boolean;
  togglePlayback: () => void;
  voiceRuntimeModel: VoiceMessageRuntimeModel;
};

function normalizeAttachmentSignedUrl(value: unknown) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed || null;
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
  } else if (input.stageHint === 'uploading') {
    state = 'uploading';
    reason = 'stage-uploading';
  } else if (input.stageHint === 'processing') {
    state = 'processing';
    reason = 'stage-processing';
  } else if (input.isPreparingPlaybackSource) {
    state = 'processing';
    reason = 'preparing-playback-source';
  } else if (input.hasPlaybackSource) {
    state = 'ready';
    reason = 'playback-source-ready';
  } else if (input.canPreparePlaybackSource || input.hasRecoverableAttachmentLocator) {
    state = 'pending';
    reason = input.didFailPlaybackSourcePrepare
      ? 'playback-source-retryable'
      : 'playback-source-pending';
  } else if (input.hasAttachment) {
    state = 'pending';
    reason = 'attachment-not-yet-playable';
  } else {
    state = 'pending';
    reason = 'attachment-missing';
  }

  let interactionAvailability: VoiceMessageInteractionAvailability;

  switch (state) {
    case 'ready':
      interactionAvailability = 'playable';
      break;
    case 'failed':
      interactionAvailability =
        input.didFailPlaybackSourcePrepare || input.playbackFailed
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

function resolveResolvedPlaybackSourcePatch(input: {
  activePlaybackSource: MessagingVoicePlaybackSourceOption | null;
  ignoredTransportSourceState: {
    sourceId: string;
    transportSourceUrl: string | null;
  } | null;
  resolvedPlaybackSourceState: {
    sourceId: string;
    transportSourceUrl: string | null;
  } | null;
  source: MessagingVoicePlaybackSourceOption;
}) {
  let transportSourceUrl = normalizeAttachmentSignedUrl(input.source.transportSourceUrl);

  if (
    input.ignoredTransportSourceState?.sourceId === input.source.sourceId &&
    transportSourceUrl === input.ignoredTransportSourceState.transportSourceUrl
  ) {
    transportSourceUrl = null;
  }

  if (
    input.resolvedPlaybackSourceState?.sourceId === input.source.sourceId &&
    input.resolvedPlaybackSourceState.transportSourceUrl
  ) {
    transportSourceUrl = input.resolvedPlaybackSourceState.transportSourceUrl;
  }

  if (
    input.activePlaybackSource?.sourceId === input.source.sourceId &&
    input.activePlaybackSource.transportSourceUrl &&
    transportSourceUrl !== input.activePlaybackSource.transportSourceUrl
  ) {
    transportSourceUrl = input.activePlaybackSource.transportSourceUrl;
  }

  return transportSourceUrl === input.source.transportSourceUrl
    ? input.source
    : {
        ...input.source,
        transportSourceUrl,
      };
}

export function useThreadVoicePlaybackRuntime({
  attachment,
  conversationId,
  messageId,
  stageHint = null,
}: UseThreadVoicePlaybackRuntimeInput): UseThreadVoicePlaybackRuntimeResult {
  const attachmentTransportSourceUrl = normalizeAttachmentSignedUrl(
    attachment?.signedUrl,
  );
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [devicePlaybackSupport, setDevicePlaybackSupport] =
    useState<ThreadVoiceDevicePlaybackSupport>(
      UNKNOWN_THREAD_VOICE_DEVICE_PLAYBACK_SUPPORT,
    );
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
  const claimedPlaybackOwnerVersionRef = useRef<number | null>(null);
  const lastVoiceProofSnapshotRef = useRef<string | null>(null);
  const activeVoicePlaybackSourceRef =
    useRef<MessagingVoicePlaybackSourceOption | null>(null);
  const effectiveVoicePlaybackSourceUrlRef = useRef<string | null>(null);
  const effectiveVoiceTransportSourceUrlRef = useRef<string | null>(null);
  const canPreparePlaybackSourceRef = useRef(false);
  const runtimeVoicePlaybackSourcesRef =
    useRef<readonly MessagingVoicePlaybackSourceOption[]>([]);
  const voiceStateRef = useRef<VoiceMessageRenderState>('pending');
  const voiceRenderReasonRef = useRef('attachment-missing');
  const voicePlaybackCacheKeyRef = useRef<string | null>(null);
  const playbackSourceKindRef = useRef<'blob' | 'missing' | 'transport'>(
    'missing',
  );

  const resetPlaybackProgress = useCallback(
    (audio?: HTMLAudioElement | null) => {
      if (audio) {
        try {
          if (Number.isFinite(audio.currentTime) && audio.currentTime > 0) {
            audio.currentTime = 0;
          }
        } catch {
          // Ignore browsers that disallow seeking during source settlement.
        }
      }

      setProgressMs(0);
    },
    [],
  );

  const handleAudioRef = useCallback((audio: HTMLAudioElement | null) => {
    audioRef.current = audio;
    configureInlineAudioElement(audio);
  }, []);

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

  const activeResolvedPlaybackSource =
    resolveThreadVoicePlaybackSourceById(
      voicePlaybackSourceOptions,
      resolvedPlaybackSourceState?.sourceId ?? preferredDevicePlaybackSourceId,
    ) ?? null;

  const runtimeVoicePlaybackSources = useMemo(
    () =>
      voicePlaybackSourceOptions.map((playbackSource) =>
        resolveResolvedPlaybackSourcePatch({
          activePlaybackSource: activeResolvedPlaybackSource,
          ignoredTransportSourceState: ignoredPlaybackTransportState,
          resolvedPlaybackSourceState,
          source: playbackSource,
        }),
      ),
    [
      activeResolvedPlaybackSource,
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
  const voiceRuntimeModel = useMemo(
    () =>
      resolveVoiceMessageRuntimeModel({
        canPreparePlaybackSource,
        devicePlaybackSupportStatus: devicePlaybackSupport.status,
        didFailPlaybackSourcePrepare,
        hasAttachment: Boolean(attachment),
        hasPlaybackSource,
        hasRecoverableAttachmentLocator: hasRecoverableAttachmentStorageLocator,
        isPreparingPlaybackSource,
        playbackFailed,
        stageHint,
      }),
    [
      attachment,
      canPreparePlaybackSource,
      devicePlaybackSupport.status,
      didFailPlaybackSourcePrepare,
      hasPlaybackSource,
      hasRecoverableAttachmentStorageLocator,
      isPreparingPlaybackSource,
      playbackFailed,
      stageHint,
    ],
  );
  const voiceState = voiceRuntimeModel.state;
  const voiceRenderReason = voiceRuntimeModel.reason;
  const voiceInteractionAvailability =
    voiceRuntimeModel.interactionAvailability;

  activeVoicePlaybackSourceRef.current = activeVoicePlaybackSource;
  canPreparePlaybackSourceRef.current = canPreparePlaybackSource;
  effectiveVoicePlaybackSourceUrlRef.current = effectiveVoicePlaybackSourceUrl;
  effectiveVoiceTransportSourceUrlRef.current = effectiveVoiceTransportSourceUrl;
  playbackSourceKindRef.current = playbackSourceKind;
  runtimeVoicePlaybackSourcesRef.current = runtimeVoicePlaybackSources;
  voicePlaybackCacheKeyRef.current = voicePlaybackCacheKey;
  voiceRenderReasonRef.current = voiceRenderReason;
  voiceStateRef.current = voiceState;

  const releaseClaimedPlaybackOwner = useCallback(
    (audio: HTMLAudioElement | null) => {
      if (!audio) {
        claimedPlaybackOwnerVersionRef.current = null;
        return;
      }

      releaseActiveThreadVoicePlayback(
        messageId,
        audio,
        claimedPlaybackOwnerVersionRef.current,
      );
      claimedPlaybackOwnerVersionRef.current = null;
    },
    [messageId],
  );

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
      voiceState: voiceStateRef.current,
    });
    requestActiveThreadVoicePlaybackIntent(messageId);
    setHasPendingPlaybackIntent(true);
    return nextIntentVersion;
  }, [invalidatePlaybackStartRequests, messageId, playbackState]);

  const rememberVoicePlaybackCacheEntry = useCallback(
    (patch: Partial<ThreadVoicePlaybackCacheEntry>) => {
      writeThreadVoicePlaybackCacheEntry(voicePlaybackCacheKeyRef.current, patch);
    },
    [],
  );

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
      activeVoicePlaybackSource?.sourceId ?? '',
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
      playbackSourceSourceId: activeVoicePlaybackSource?.sourceId ?? null,
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
    effectiveVoicePlaybackSourceUrl,
    effectiveVoiceTransportSourceUrl,
    messageId,
    playbackSourceKind,
    shouldHydratePreparedVoicePlayback,
    storedVoiceMimeType,
    voicePlaybackCacheKey,
    voiceFileExtension,
    voiceRenderReason,
    voiceState,
  ]);

  useEffect(() => {
    return () => {
      const audio = audioRef.current;

      invalidatePlaybackStartRequests();

      if (hasActiveThreadVoicePlaybackIntent(messageId)) {
        setActiveThreadVoicePlaybackIntent(null);
      }

      if (!audio) {
        claimedPlaybackOwnerVersionRef.current = null;
        return;
      }

      audio.pause();
      releaseClaimedPlaybackOwner(audio);
      audio.src = '';
    };
  }, [invalidatePlaybackStartRequests, messageId, releaseClaimedPlaybackOwner]);

  useEffect(() => {
    setResolvedDurationMs(attachment?.durationMs ?? cachedDurationMs ?? null);
    setResolvedPlaybackSourceState(null);
    setDidFailPlaybackSourcePrepare(false);
    setIgnoredPlaybackTransportState(null);
    setPreferredDevicePlaybackSourceId(null);
    clearPendingPlaybackIntent();
    setPlaybackFailed(false);
    resetPlaybackProgress(audioRef.current);
  }, [
    attachment?.durationMs,
    attachment?.id,
    cachedDurationMs,
    clearPendingPlaybackIntent,
    resetPlaybackProgress,
    voicePlaybackSourceSignature,
  ]);

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
          ? progressMs > 0
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
    progressMs,
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

      return progressMs > 0 ? 'paused' : 'idle';
    });
  }, [
    effectiveVoicePlaybackSourceUrl,
    hasPendingPlaybackIntent,
    progressMs,
    voiceState,
  ]);

  const preparePlaybackSource = useCallback(async () => {
    const activePlaybackSource = activeVoicePlaybackSourceRef.current;
    const currentPlaybackSourceUrl = effectiveVoicePlaybackSourceUrlRef.current;
    const currentTransportSourceUrl = effectiveVoiceTransportSourceUrlRef.current;
    const canPrepareCurrentSource = canPreparePlaybackSourceRef.current;

    if (
      !currentTransportSourceUrl &&
      (!canPrepareCurrentSource || !activePlaybackSource)
    ) {
      return currentPlaybackSourceUrl ?? currentTransportSourceUrl;
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
          hasExistingPlaybackSource: Boolean(currentPlaybackSourceUrl),
          hasTransportSource: Boolean(currentTransportSourceUrl),
          mediaCapabilitiesSupported:
            devicePlaybackSupport.mediaCapabilitiesSupported,
          messageId,
          playbackSourceOrigin: activePlaybackSource?.origin ?? null,
          playbackSourceKind: playbackSourceKindRef.current,
          playbackSourceRole: activePlaybackSource?.role ?? null,
          playbackSourceSourceId: activePlaybackSource?.sourceId ?? null,
          storedMimeType: storedVoiceMimeType,
          supportStatus: devicePlaybackSupport.status,
          voiceState: voiceStateRef.current,
        });
        const resolution = await prepareThreadVoicePlaybackSource({
          cacheKey: voicePlaybackCacheKeyRef.current,
          conversationId,
          locator: {
            attachmentId: activePlaybackSource?.assetId ?? null,
            conversationId,
            messageId,
          },
          messageId,
          onDiagnostic: logVoiceThreadDiagnostic,
          playbackSources: runtimeVoicePlaybackSourcesRef.current,
          preferredSourceId: activePlaybackSource?.sourceId ?? null,
          transportSourceUrl: currentTransportSourceUrl,
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
            activePlaybackSource?.origin ??
            null,
          playbackSourceKind: resolveThreadVoicePlaybackSourceKind({
            playbackSourceUrl: resolution.playbackSourceUrl,
            transportSourceUrl: nextTransportSourceUrl,
          }),
          playbackSourceRole:
            resolution.selectedPlaybackSource?.role ??
            activePlaybackSource?.role ??
            null,
          playbackSourceSourceId:
            resolution.selectedPlaybackSource?.sourceId ??
            activePlaybackSource?.sourceId ??
            null,
          status: resolution.status,
          storedMimeType: storedVoiceMimeType,
          supportStatus: devicePlaybackSupport.status,
          voiceState: voiceStateRef.current,
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
    conversationId,
    devicePlaybackSupport.canPlayType,
    devicePlaybackSupport.mediaCapabilitiesSupported,
    devicePlaybackSupport.status,
    messageId,
    storedVoiceMimeType,
    voiceFileExtension,
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
        playbackSourceOverride?.trim() ||
        effectiveVoicePlaybackSourceUrlRef.current;

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

      if (playbackState === 'ended' || audio.ended) {
        resetPlaybackProgress(audio);
      }

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
        canPlayType: canPlayTypeResult,
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
        voiceState: voiceStateRef.current,
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
          voiceState: voiceStateRef.current,
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
        markActiveThreadVoicePlaybackPlaying(messageId, audio, ownerVersion);
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
          voiceState: voiceStateRef.current,
        });
        logVoiceThreadDiagnostic('audio-play-trigger-failed', {
          errorMessage: error instanceof Error ? error.message : String(error),
          messageId,
          ownerVersion,
        });
        releaseClaimedPlaybackOwner(audio);
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
      messageId,
      playbackState,
      releaseClaimedPlaybackOwner,
      resetPlaybackProgress,
      storedVoiceMimeType,
      voiceFileExtension,
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
    messageId,
    voiceRenderReason,
    voiceState,
  ]);

  useEffect(() => {
    const audio = audioRef.current;

    if (!effectiveVoicePlaybackSourceUrl) {
      if (hasActiveThreadVoicePlaybackIntent(messageId)) {
        setActiveThreadVoicePlaybackIntent(null);
      }

      clearPendingPlaybackIntent();

      if (audio) {
        audio.pause();
        releaseClaimedPlaybackOwner(audio);
        audio.src = '';
      } else {
        claimedPlaybackOwnerVersionRef.current = null;
      }

      resetPlaybackProgress(audio);
      setPlaybackState((current) => (current === 'failed' ? current : 'idle'));
      return;
    }

    setPlaybackState((current) =>
      current === 'failed' || current === 'buffering' ? current : 'idle',
    );
  }, [
    clearPendingPlaybackIntent,
    effectiveVoicePlaybackSourceUrl,
    messageId,
    releaseClaimedPlaybackOwner,
    resetPlaybackProgress,
  ]);

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
    const ownership = {
      ...(audio
        ? {
            audio,
          }
        : {
            audio: null,
          }),
      messageId,
    };
    const resolvedOwnership: ThreadVoicePlaybackOwnership =
      resolveActiveThreadVoicePlaybackOwnership(ownership);

    logVoiceThreadDiagnostic('voice-toggle-requested', {
      canPreparePlaybackSource,
      hasAudioElement: Boolean(audio),
      hasPendingPlaybackIntent,
      hasPlaybackSource,
      hasTransportSource: Boolean(effectiveVoiceTransportSourceUrl),
      messageId,
      ownershipStatus: resolvedOwnership.status,
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
        ownershipStatus: resolvedOwnership.status,
      });
      setPlaybackFailed(false);
      armPendingPlaybackIntent();
      if (canPreparePlaybackSource && !isPreparingPlaybackSource) {
        void preparePlaybackSource();
      }
      return;
    }

    if (voiceInteractionAvailability !== 'playable') {
      return;
    }

    if (!audio) {
      logVoiceThreadDiagnostic('voice-toggle-missing-audio-element', {
        canPreparePlaybackSource,
        messageId,
        ownershipStatus: resolvedOwnership.status,
      });
      if (canPreparePlaybackSource) {
        armPendingPlaybackIntent();
        if (!isPreparingPlaybackSource) {
          void preparePlaybackSource();
        }
      }
      return;
    }

    if (resolvedOwnership.status === 'starting-owner') {
      logVoiceThreadDiagnostic('voice-toggle-ignored-starting-owner', {
        messageId,
        ownerVersion: resolvedOwnership.ownerVersion,
      });
      return;
    }

    if (resolvedOwnership.status === 'active-owner' && !audio.paused) {
      logVoiceThreadDiagnostic('voice-toggle-pausing-active-audio', {
        messageId,
        ownerVersion: resolvedOwnership.ownerVersion,
        playbackState,
      });
      clearPendingPlaybackIntent({ clearGlobalIntent: true });
      audio.pause();
      return;
    }

    if (resolvedOwnership.status === 'other-owner') {
      logVoiceThreadDiagnostic('voice-toggle-switching-active-owner', {
        activeOwnerMessageId: resolvedOwnership.ownerMessageId,
        messageId,
        ownerPhase: resolvedOwnership.ownerPhase,
        ownerVersion: resolvedOwnership.ownerVersion,
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
        messageId,
      });
      clearPendingPlaybackIntent();
      audio.pause();
      return;
    }

    if (hasPendingPlaybackIntent || resolvedOwnership.status === 'intended-owner') {
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
  }, [
    armPendingPlaybackIntent,
    canPreparePlaybackSource,
    clearPendingPlaybackIntent,
    effectiveVoicePlaybackSourceUrl,
    effectiveVoiceTransportSourceUrl,
    hasPendingPlaybackIntent,
    hasPlaybackSource,
    isPreparingPlaybackSource,
    messageId,
    playbackState,
    preparePlaybackSource,
    voiceInteractionAvailability,
    voiceState,
  ]);

  const togglePlayback = useCallback(() => {
    void runActiveThreadVoicePlaybackTransition(async () => {
      await togglePlaybackUnsafe();
    });
  }, [togglePlaybackUnsafe]);

  const handleAudioCanPlay = useCallback(
    (event: SyntheticEvent<HTMLAudioElement>) => {
      const audio = event.currentTarget;

      logVoiceThreadDiagnostic('audio-can-play', {
        messageId,
        readyState: audio.readyState,
        src: audio.currentSrc || audio.src || null,
      });
      logVoiceThreadProof('audio-element-ready', {
        canPlayType: resolveAudioCanPlayTypeResult(audio, storedVoiceMimeType),
        currentSrc: audio.currentSrc || audio.src || null,
        fileExtension: voiceFileExtension,
        messageId,
        networkState: audio.networkState,
        playbackSourceKind: playbackSourceKindRef.current,
        readyState: audio.readyState,
        supportStatus: devicePlaybackSupport.status,
        storedMimeType: storedVoiceMimeType,
      });
      const stablePlaybackSource =
        effectiveVoicePlaybackSourceUrlRef.current ??
        effectiveVoiceTransportSourceUrlRef.current;
      const nextDurationMs =
        Number.isFinite(audio.duration) && audio.duration > 0
          ? audio.duration * 1000
          : resolvedDurationMs;

      rememberVoicePlaybackCacheEntry({
        durationMs: nextDurationMs,
        playbackUrl: stablePlaybackSource,
        sessionReady: Boolean(stablePlaybackSource),
        sourceUrl:
          effectiveVoiceTransportSourceUrlRef.current ?? stablePlaybackSource,
        warmed: Boolean(stablePlaybackSource?.startsWith('blob:')),
      });
      if (
        !hasPendingPlaybackIntent &&
        playbackState === 'buffering' &&
        audio.paused
      ) {
        setPlaybackState(progressMs > 0 ? 'paused' : 'idle');
      }
    },
    [
      devicePlaybackSupport.status,
      hasPendingPlaybackIntent,
      messageId,
      playbackState,
      progressMs,
      rememberVoicePlaybackCacheEntry,
      resolvedDurationMs,
      storedVoiceMimeType,
      voiceFileExtension,
    ],
  );

  const handleAudioEnded = useCallback(
    (event: SyntheticEvent<HTMLAudioElement>) => {
      const audio = event.currentTarget;

      releaseClaimedPlaybackOwner(audio);
      resetPlaybackProgress(audio);
      clearPendingPlaybackIntent();
      setPlaybackState('ended');
    },
    [clearPendingPlaybackIntent, releaseClaimedPlaybackOwner, resetPlaybackProgress],
  );

  const handleAudioError = useCallback(
    (event: SyntheticEvent<HTMLAudioElement>) => {
      const audio = event.currentTarget;
      const mediaError = audio.error;

      logVoiceThreadDiagnostic('audio-element-error', {
        errorCode: mediaError?.code ?? null,
        fileExtension: voiceFileExtension,
        messageId,
        networkState: audio.networkState,
        readyState: audio.readyState,
        src: audio.currentSrc || audio.src || null,
        supportStatus: devicePlaybackSupport.status,
        storedMimeType: storedVoiceMimeType,
      });
      logVoiceThreadProof('voice-audio-element-error', {
        canPlayType: resolveAudioCanPlayTypeResult(audio, storedVoiceMimeType),
        currentSrc: audio.currentSrc || audio.src || null,
        errorCode: mediaError?.code ?? null,
        fileExtension: voiceFileExtension,
        messageId,
        networkState: audio.networkState,
        playbackSourceKind: playbackSourceKindRef.current,
        readyState: audio.readyState,
        supportStatus: devicePlaybackSupport.status,
        storedMimeType: storedVoiceMimeType,
      });
      releaseClaimedPlaybackOwner(audio);
      audio.pause();
      resetPlaybackProgress(audio);

      const currentTransportSourceUrl = effectiveVoiceTransportSourceUrlRef.current;
      const activePlaybackSource = activeVoicePlaybackSourceRef.current;

      if (
        currentTransportSourceUrl &&
        canPreparePlaybackSourceRef.current
      ) {
        setIgnoredPlaybackTransportState(
          activePlaybackSource
            ? {
                sourceId: activePlaybackSource.sourceId,
                transportSourceUrl: currentTransportSourceUrl,
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
    },
    [
      clearPendingPlaybackIntent,
      devicePlaybackSupport.status,
      messageId,
      releaseClaimedPlaybackOwner,
      resetPlaybackProgress,
      storedVoiceMimeType,
      voiceFileExtension,
    ],
  );

  const handleAudioLoadedMetadata = useCallback(
    (event: SyntheticEvent<HTMLAudioElement>) => {
      const audio = event.currentTarget;
      const nextDurationMs =
        Number.isFinite(audio.duration) && audio.duration > 0
          ? audio.duration * 1000
          : null;

      if (nextDurationMs !== null) {
        setResolvedDurationMs(nextDurationMs);
        rememberVoicePlaybackCacheEntry({
          durationMs: nextDurationMs,
        });
      }
    },
    [rememberVoicePlaybackCacheEntry],
  );

  const handleAudioLoadStart = useCallback(
    (event: SyntheticEvent<HTMLAudioElement>) => {
      const audio = event.currentTarget;

      if (
        !hasPendingPlaybackIntent &&
        playbackState !== 'playing' &&
        playbackState !== 'buffering'
      ) {
        return;
      }

      setPlaybackState((current) =>
        current === 'playing' || audio.readyState >= VOICE_READY_TO_REPLAY_STATE
          ? current
          : 'buffering',
      );
    },
    [hasPendingPlaybackIntent, playbackState],
  );

  const handleAudioPause = useCallback(
    (event: SyntheticEvent<HTMLAudioElement>) => {
      const audio = event.currentTarget;

      if (
        shouldIgnoreActiveThreadVoicePlaybackPause({
          audio,
          messageId,
          ownerVersion: claimedPlaybackOwnerVersionRef.current,
        })
      ) {
        logVoiceThreadDiagnostic('audio-pause-ignored-during-start', {
          currentSrc: audio.currentSrc || audio.src || null,
          messageId,
          ownerVersion: claimedPlaybackOwnerVersionRef.current,
          readyState: audio.readyState,
        });
        return;
      }

      releaseClaimedPlaybackOwner(audio);
      clearPendingPlaybackIntent();

      if (audio.ended) {
        return;
      }

      setPlaybackState(progressMs > 0 ? 'paused' : 'idle');
    },
    [
      clearPendingPlaybackIntent,
      messageId,
      progressMs,
      releaseClaimedPlaybackOwner,
    ],
  );

  const handleAudioPlaying = useCallback(
    (event: SyntheticEvent<HTMLAudioElement>) => {
      const audio = event.currentTarget;

      if (
        !isActiveThreadVoicePlaybackOwner({
          audio,
          messageId,
          ownerVersion: claimedPlaybackOwnerVersionRef.current,
        })
      ) {
        audio.pause();
        return;
      }

      markActiveThreadVoicePlaybackPlaying(
        messageId,
        audio,
        claimedPlaybackOwnerVersionRef.current,
      );
      logVoiceThreadDiagnostic('audio-playing', {
        messageId,
        src: audio.currentSrc || audio.src || null,
      });
      clearPendingPlaybackIntent();
      setPlaybackFailed(false);
      setPlaybackState('playing');
      const stablePlaybackSource =
        effectiveVoicePlaybackSourceUrlRef.current ??
        effectiveVoiceTransportSourceUrlRef.current;

      rememberVoicePlaybackCacheEntry({
        durationMs:
          Number.isFinite(audio.duration) && audio.duration > 0
            ? audio.duration * 1000
            : resolvedDurationMs,
        playbackUrl: stablePlaybackSource,
        sessionReady: Boolean(stablePlaybackSource),
        sourceUrl:
          effectiveVoiceTransportSourceUrlRef.current ?? stablePlaybackSource,
        warmed: Boolean(stablePlaybackSource?.startsWith('blob:')),
      });

      const currentTransportSourceUrl = effectiveVoiceTransportSourceUrlRef.current;
      const activePlaybackSource = activeVoicePlaybackSourceRef.current;

      if (
        currentTransportSourceUrl &&
        !currentTransportSourceUrl.startsWith('blob:')
      ) {
        void prepareThreadVoicePlaybackSource({
          cacheKey: voicePlaybackCacheKeyRef.current,
          conversationId,
          locator: {
            attachmentId: activePlaybackSource?.assetId ?? null,
            conversationId,
            messageId,
          },
          messageId,
          onDiagnostic: logVoiceThreadDiagnostic,
          playbackSources: runtimeVoicePlaybackSourcesRef.current,
          preferredSourceId: activePlaybackSource?.sourceId ?? null,
          transportSourceUrl: currentTransportSourceUrl,
        });
      }
    },
    [
      clearPendingPlaybackIntent,
      conversationId,
      messageId,
      rememberVoicePlaybackCacheEntry,
      resolvedDurationMs,
    ],
  );

  const handleAudioTimeUpdate = useCallback(
    (event: SyntheticEvent<HTMLAudioElement>) => {
      setProgressMs(Math.max(0, event.currentTarget.currentTime * 1000));
    },
    [],
  );

  const handleAudioWaiting = useCallback(
    (event: SyntheticEvent<HTMLAudioElement>) => {
      const audio = event.currentTarget;

      if (
        !hasPendingPlaybackIntent &&
        playbackState !== 'playing' &&
        playbackState !== 'buffering' &&
        audio.paused
      ) {
        return;
      }

      setPlaybackState('buffering');
    },
    [hasPendingPlaybackIntent, playbackState],
  );

  const audioElementProps = useMemo<ThreadVoiceAudioElementProps>(
    () => ({
      onCanPlay: handleAudioCanPlay,
      onEnded: handleAudioEnded,
      onError: handleAudioError,
      onLoadedMetadata: handleAudioLoadedMetadata,
      onLoadStart: handleAudioLoadStart,
      onPause: handleAudioPause,
      onPlaying: handleAudioPlaying,
      onTimeUpdate: handleAudioTimeUpdate,
      onWaiting: handleAudioWaiting,
      playsInline: true,
      preload: shouldHydratePreparedVoicePlayback ? 'auto' : 'none',
      ref: handleAudioRef,
      src: effectiveVoicePlaybackSourceUrl ?? undefined,
      tabIndex: -1,
    }),
    [
      effectiveVoicePlaybackSourceUrl,
      handleAudioCanPlay,
      handleAudioEnded,
      handleAudioError,
      handleAudioLoadedMetadata,
      handleAudioLoadStart,
      handleAudioPause,
      handleAudioPlaying,
      handleAudioRef,
      handleAudioTimeUpdate,
      handleAudioWaiting,
      shouldHydratePreparedVoicePlayback,
    ],
  );

  return {
    audioElementProps,
    hasPendingPlaybackIntent,
    playbackState,
    progressMs,
    resolvedDurationMs,
    shouldRenderAudioElement: Boolean(attachment),
    togglePlayback,
    voiceRuntimeModel,
  };
}
