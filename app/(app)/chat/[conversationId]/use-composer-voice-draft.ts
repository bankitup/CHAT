'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MessagingMessageContentMode } from '@/modules/messaging/media/message-metadata';
import type { MessagingVoiceMessageDraftRecord } from '@/modules/messaging/media/voice';
import type { MessagingVoiceCaptureState } from '@/modules/messaging/media/voice';
import { resolveMessagingVoiceCaptureMimeType } from '@/modules/messaging/media/voice';
import {
  deleteLocalMessagingVoiceDraft,
  getLocalMessagingVoiceDraft,
  saveLocalMessagingVoiceDraft,
} from '@/modules/messaging/media/voice-draft-store';

type VoiceDraftErrorCode =
  | 'unsupported'
  | 'permission-denied'
  | 'capture-failed'
  | null;

type MicrophonePermissionState = PermissionState | 'unknown';

type UseComposerVoiceDraftOptions = {
  contentMode: MessagingMessageContentMode;
  conversationId: string;
  replyToMessageId?: string | null;
};

type UseComposerVoiceDraftResult = {
  buildDraftFile: () => File | null;
  cancelRecording: () => void;
  captureState: MessagingVoiceCaptureState;
  clearDraft: () => void;
  draft: MessagingVoiceMessageDraftRecord | null;
  elapsedMs: number;
  errorCode: VoiceDraftErrorCode;
  isRestoredDraft: boolean;
  isSupported: boolean;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
};

const UPDATE_TIMER_INTERVAL_MS = 200;
const voiceComposerDiagnosticsEnabled =
  process.env.NEXT_PUBLIC_CHAT_DEBUG_VOICE === '1';

function logVoiceComposerDiagnostics(
  stage: string,
  details?: Record<string, unknown>,
) {
  if (!voiceComposerDiagnosticsEnabled || typeof window === 'undefined') {
    return;
  }

  if (details) {
    console.info('[voice-composer]', stage, details);
    return;
  }

  console.info('[voice-composer]', stage);
}

function createLocalDraftId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `voice-draft-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getVoiceDraftFileExtension(fileName: string | null | undefined) {
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

function resolveSupportedMimeType() {
  if (
    typeof window === 'undefined' ||
    typeof MediaRecorder === 'undefined' ||
    typeof MediaRecorder.isTypeSupported !== 'function'
  ) {
    return {
      mimePreferenceOrder: [] as const,
      platform: 'other' as const,
      selectedMimeType: null,
    };
  }

  return resolveMessagingVoiceCaptureMimeType({
    isTypeSupported: (candidate) => MediaRecorder.isTypeSupported(candidate),
    maxTouchPoints: navigator.maxTouchPoints,
    userAgent: navigator.userAgent,
    vendor: navigator.vendor,
  });
}

function buildVoiceDraftFileName(createdAtIso: string, mimeType: string | null) {
  const createdAt = new Date(createdAtIso);
  const safeStamp = Number.isNaN(createdAt.getTime())
    ? 'draft'
    : createdAt.toISOString().replace(/[:.]/g, '-');

  if (mimeType?.includes('mp4')) {
    return `voice-${safeStamp}.m4a`;
  }

  if (mimeType?.includes('ogg')) {
    return `voice-${safeStamp}.ogg`;
  }

  return `voice-${safeStamp}.webm`;
}

async function readMicrophonePermissionState(): Promise<MicrophonePermissionState> {
  if (
    typeof navigator === 'undefined' ||
    !('permissions' in navigator) ||
    !navigator.permissions ||
    typeof navigator.permissions.query !== 'function'
  ) {
    return 'unknown';
  }

  try {
    const status = await navigator.permissions.query({
      name: 'microphone' as PermissionName,
    });

    return status.state;
  } catch {
    return 'unknown';
  }
}

export function useComposerVoiceDraft({
  contentMode,
  conversationId,
  replyToMessageId = null,
}: UseComposerVoiceDraftOptions): UseComposerVoiceDraftResult {
  const [captureState, setCaptureState] =
    useState<MessagingVoiceCaptureState>('idle');
  const [draft, setDraft] = useState<MessagingVoiceMessageDraftRecord | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [errorCode, setErrorCode] = useState<VoiceDraftErrorCode>(null);
  const [isRestoredDraft, setIsRestoredDraft] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const createdAtRef = useRef<string | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const shouldDiscardOnStopRef = useRef(false);
  const startedAtRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const draftUrlRef = useRef<string | null>(null);
  const draftBlobRef = useRef<Blob | null>(null);
  const restoredDraftKeyRef = useRef<string | null>(null);
  const isStartingRecordingRef = useRef(false);
  const microphonePermissionStateRef =
    useRef<MicrophonePermissionState>('unknown');
  const isSupported = useMemo(() => {
    if (typeof window === 'undefined') {
      return false;
    }

    return Boolean(
      navigator.mediaDevices &&
        typeof navigator.mediaDevices.getUserMedia === 'function' &&
        typeof MediaRecorder !== 'undefined',
    );
  }, []);

  const stopActiveTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopActiveStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    mediaRecorderRef.current = null;
  }, []);

  const clearDraft = useCallback(() => {
    if (draftUrlRef.current) {
      URL.revokeObjectURL(draftUrlRef.current);
      draftUrlRef.current = null;
    }

    setDraft(null);
    setErrorCode(null);
    setElapsedMs(0);
    setIsRestoredDraft(false);
    draftBlobRef.current = null;
    chunksRef.current = [];
    createdAtRef.current = null;
    startedAtRef.current = null;
    void deleteLocalMessagingVoiceDraft(conversationId).catch(() => {
      return;
    });

    if (captureState !== 'recording' && captureState !== 'requesting-permission') {
      setCaptureState('idle');
    }
  }, [captureState, conversationId]);

  const finalizeDraft = useCallback(() => {
    const createdAt = createdAtRef.current ?? new Date().toISOString();
    const durationMs = startedAtRef.current
      ? Math.max(Date.now() - startedAtRef.current, 0)
      : elapsedMs;
    const captureMimeResolution = resolveSupportedMimeType();
    const mimeType =
      mediaRecorderRef.current?.mimeType ||
      chunksRef.current[0]?.type ||
      captureMimeResolution.selectedMimeType;

    if (shouldDiscardOnStopRef.current) {
      shouldDiscardOnStopRef.current = false;
      stopActiveTimer();
      stopActiveStream();
      setDraft(null);
      setElapsedMs(0);
      setErrorCode(null);
      setIsRestoredDraft(false);
      setCaptureState('idle');
      void deleteLocalMessagingVoiceDraft(conversationId).catch(() => {
        return;
      });
      return;
    }

    const blob = new Blob(chunksRef.current, {
      type: mimeType ?? 'audio/webm',
    });

    if (blob.size <= 0) {
      stopActiveTimer();
      stopActiveStream();
      setDraft(null);
      setElapsedMs(0);
      setErrorCode('capture-failed');
      setIsRestoredDraft(false);
      setCaptureState('failed');
      return;
    }

    const blobUrl = URL.createObjectURL(blob);

    if (draftUrlRef.current) {
      URL.revokeObjectURL(draftUrlRef.current);
    }

    draftUrlRef.current = blobUrl;
    draftBlobRef.current = blob;
    stopActiveTimer();
    stopActiveStream();
    setElapsedMs(durationMs);
    setErrorCode(null);
    setIsRestoredDraft(false);
    const nextDraft = {
      blobUrl,
      clientDraftId: createLocalDraftId(),
      contentMode,
      conversationId,
      createdAt,
      durationMs,
      fileName: buildVoiceDraftFileName(createdAt, mimeType),
      mimeType,
      replyToMessageId,
      sizeBytes: blob.size,
      stage: 'draft',
      waveformPeaks: null,
    } satisfies MessagingVoiceMessageDraftRecord;
    logVoiceComposerDiagnostics('draft:finalized', {
      blobMimeType: blob.type || null,
      chunkMimeType: chunksRef.current[0]?.type || null,
      conversationId,
      durationMs,
      fileExtension: getVoiceDraftFileExtension(nextDraft.fileName),
      fileName: nextDraft.fileName,
      mimeType: nextDraft.mimeType,
      sizeBytes: nextDraft.sizeBytes,
    });
    setDraft(nextDraft);
    void saveLocalMessagingVoiceDraft({
      clientDraftId: nextDraft.clientDraftId,
      contentMode: nextDraft.contentMode,
      conversationId: nextDraft.conversationId,
      createdAt: nextDraft.createdAt,
      durationMs: nextDraft.durationMs,
      fileName: nextDraft.fileName,
      mimeType: nextDraft.mimeType,
      replyToMessageId: nextDraft.replyToMessageId,
      sizeBytes: nextDraft.sizeBytes,
      stage: nextDraft.stage,
      waveformPeaks: nextDraft.waveformPeaks,
      blob,
      updatedAt: new Date().toISOString(),
      version: 1,
    }).catch(() => {
      return;
    });
    setCaptureState('stopped');
  }, [
    contentMode,
    conversationId,
    elapsedMs,
    replyToMessageId,
    stopActiveStream,
    stopActiveTimer,
  ]);

  const stopRecording = useCallback(() => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
      return;
    }

    stopActiveTimer();
    setCaptureState('stopped');
    mediaRecorderRef.current.stop();
  }, [stopActiveTimer]);

  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      shouldDiscardOnStopRef.current = true;
      stopActiveTimer();
      setCaptureState('cancelled');
      mediaRecorderRef.current.stop();
      return;
    }

    clearDraft();
    setCaptureState('idle');
  }, [clearDraft, stopActiveTimer]);

  const buildDraftFile = useCallback(() => {
    if (!draft || !draftBlobRef.current) {
      return null;
    }

    return new File([draftBlobRef.current], draft.fileName ?? 'voice.webm', {
      type: draft.mimeType ?? draftBlobRef.current.type ?? 'audio/webm',
      lastModified: Date.now(),
    });
  }, [draft]);

  const startRecording = useCallback(async () => {
    if (isStartingRecordingRef.current) {
      logVoiceComposerDiagnostics('entry:ignored-inflight', {
        captureState,
        conversationId,
      });
      return;
    }

    isStartingRecordingRef.current = true;
    logVoiceComposerDiagnostics('entry:attempt', {
      captureState,
      conversationId,
      hasGetUserMedia: Boolean(
        navigator.mediaDevices &&
          typeof navigator.mediaDevices.getUserMedia === 'function',
      ),
      hasMediaRecorder:
        typeof window !== 'undefined' &&
        typeof window.MediaRecorder !== 'undefined',
      isSupported,
      replyToMessageId,
    });

    if (!isSupported || typeof window === 'undefined') {
      logVoiceComposerDiagnostics('entry:unsupported', {
        captureState,
        conversationId,
        hasGetUserMedia: Boolean(
          navigator.mediaDevices &&
            typeof navigator.mediaDevices.getUserMedia === 'function',
        ),
        hasMediaRecorder:
          typeof window !== 'undefined' &&
          typeof window.MediaRecorder !== 'undefined',
      });
      setErrorCode('unsupported');
      setCaptureState('failed');
      isStartingRecordingRef.current = false;
      return;
    }

    try {
      const queriedPermissionState = await readMicrophonePermissionState();
      const effectivePermissionState =
        queriedPermissionState === 'unknown'
          ? microphonePermissionStateRef.current
          : queriedPermissionState;

      if (queriedPermissionState !== 'unknown') {
        microphonePermissionStateRef.current = queriedPermissionState;
      }

      logVoiceComposerDiagnostics('permission:state:resolved', {
        conversationId,
        effectivePermissionState,
        queriedPermissionState,
      });

      if (effectivePermissionState === 'denied') {
        setErrorCode('permission-denied');
        setCaptureState('failed');
        return;
      }

      clearDraft();
      setErrorCode(null);
      shouldDiscardOnStopRef.current = false;

      if (effectivePermissionState !== 'granted') {
        setCaptureState('requesting-permission');
        logVoiceComposerDiagnostics('permission:request:start', {
          conversationId,
          effectivePermissionState,
        });
      } else {
        logVoiceComposerDiagnostics('permission:reuse-granted', {
          conversationId,
        });
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      microphonePermissionStateRef.current = 'granted';
      logVoiceComposerDiagnostics('permission:request:granted', {
        conversationId,
        reusedExistingPermission: effectivePermissionState === 'granted',
      });
      const captureMimeResolution = resolveSupportedMimeType();
      const mediaRecorder = captureMimeResolution.selectedMimeType
        ? new MediaRecorder(stream, {
            mimeType: captureMimeResolution.selectedMimeType,
          })
        : new MediaRecorder(stream);

      chunksRef.current = [];
      startedAtRef.current = Date.now();
      createdAtRef.current = new Date().toISOString();
      streamRef.current = stream;
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.addEventListener('dataavailable', (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      });

      mediaRecorder.addEventListener('stop', finalizeDraft);
      mediaRecorder.start();
      setElapsedMs(0);
      setCaptureState('recording');
      logVoiceComposerDiagnostics('entry:recording', {
        conversationId,
        capturePlatform: captureMimeResolution.platform,
        mediaRecorderMimeType: mediaRecorder.mimeType || null,
        mimePreferenceOrder: captureMimeResolution.mimePreferenceOrder,
        mimeType:
          captureMimeResolution.selectedMimeType ??
          mediaRecorder.mimeType ??
          null,
      });

      timerRef.current = setInterval(() => {
        if (!startedAtRef.current) {
          return;
        }

        setElapsedMs(Math.max(Date.now() - startedAtRef.current, 0));
      }, UPDATE_TIMER_INTERVAL_MS);
    } catch (error) {
      stopActiveTimer();
      stopActiveStream();

      const refreshedPermissionState =
        error instanceof DOMException && error.name === 'NotAllowedError'
          ? await readMicrophonePermissionState()
          : 'unknown';

      if (refreshedPermissionState !== 'unknown') {
        microphonePermissionStateRef.current = refreshedPermissionState;
      } else if (error instanceof DOMException && error.name === 'NotAllowedError') {
        microphonePermissionStateRef.current = 'denied';
      }

      const nextErrorCode =
        error instanceof DOMException && error.name === 'NotAllowedError'
          ? 'permission-denied'
          : 'capture-failed';

      logVoiceComposerDiagnostics('permission:request:failed', {
        conversationId,
        errorCode: nextErrorCode,
        errorName: error instanceof DOMException ? error.name : null,
        errorMessage: error instanceof Error ? error.message : String(error),
        refreshedPermissionState,
      });
      setErrorCode(nextErrorCode);
      setCaptureState('failed');
    } finally {
      isStartingRecordingRef.current = false;
    }
  }, [
    captureState,
    clearDraft,
    conversationId,
    finalizeDraft,
    isSupported,
    replyToMessageId,
    stopActiveStream,
    stopActiveTimer,
  ]);

  useEffect(() => {
    if (draft || captureState === 'recording' || captureState === 'requesting-permission') {
      return;
    }

    const restoreKey = `${conversationId}:${contentMode}`;

    if (restoredDraftKeyRef.current === restoreKey) {
      return;
    }

    restoredDraftKeyRef.current = restoreKey;
    let isCancelled = false;

    void (async () => {
      try {
        const persistedDraft = await getLocalMessagingVoiceDraft(conversationId);

        if (
          isCancelled ||
          !persistedDraft ||
          persistedDraft.contentMode !== contentMode
        ) {
          return;
        }

        const blobUrl = URL.createObjectURL(persistedDraft.blob);

        if (draftUrlRef.current) {
          URL.revokeObjectURL(draftUrlRef.current);
        }

        draftUrlRef.current = blobUrl;
        draftBlobRef.current = persistedDraft.blob;
        createdAtRef.current = persistedDraft.createdAt;
        startedAtRef.current = null;
        chunksRef.current = [];
        setElapsedMs(persistedDraft.durationMs ?? 0);
        setErrorCode(null);
        setDraft({
          blobUrl,
          clientDraftId: persistedDraft.clientDraftId,
          contentMode: persistedDraft.contentMode,
          conversationId: persistedDraft.conversationId,
          createdAt: persistedDraft.createdAt,
          durationMs: persistedDraft.durationMs,
          fileName: persistedDraft.fileName,
          mimeType: persistedDraft.mimeType,
          replyToMessageId: persistedDraft.replyToMessageId,
          sizeBytes: persistedDraft.sizeBytes,
          stage: persistedDraft.stage,
          waveformPeaks: persistedDraft.waveformPeaks,
        });
        setIsRestoredDraft(true);
        setCaptureState('stopped');
        logVoiceComposerDiagnostics('draft:restored', {
          clientDraftId: persistedDraft.clientDraftId,
          contentMode: persistedDraft.contentMode,
          conversationId: persistedDraft.conversationId,
          replyToMessageId: persistedDraft.replyToMessageId,
          sizeBytes: persistedDraft.sizeBytes,
        });
      } catch (error) {
        logVoiceComposerDiagnostics('draft:restore-failed', {
          conversationId,
          errorMessage: error instanceof Error ? error.message : String(error),
        });
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [captureState, contentMode, conversationId, draft]);

  useEffect(() => {
    return () => {
      stopActiveTimer();

      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        shouldDiscardOnStopRef.current = true;
        mediaRecorderRef.current.stop();
      } else {
        stopActiveStream();
      }

      if (draftUrlRef.current) {
        URL.revokeObjectURL(draftUrlRef.current);
      }

      draftBlobRef.current = null;
    };
  }, [stopActiveStream, stopActiveTimer]);

  useEffect(() => {
    if (captureState !== 'stopped' || !draft) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setCaptureState('idle');
    }, 220);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [captureState, draft]);

  return {
    buildDraftFile,
    cancelRecording,
    captureState,
    clearDraft,
    draft,
    elapsedMs,
    errorCode,
    isRestoredDraft,
    isSupported,
    startRecording,
    stopRecording,
  };
}
