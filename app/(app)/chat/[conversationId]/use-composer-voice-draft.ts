'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MessagingMessageContentMode } from '@/modules/messaging/media/message-metadata';
import type { MessagingVoiceMessageDraftRecord } from '@/modules/messaging/media/voice';
import type { MessagingVoiceCaptureState } from '@/modules/messaging/media/voice';

type VoiceDraftErrorCode =
  | 'unsupported'
  | 'permission-denied'
  | 'capture-failed'
  | null;

type UseComposerVoiceDraftOptions = {
  contentMode: MessagingMessageContentMode;
  conversationId: string;
  replyToMessageId?: string | null;
};

type UseComposerVoiceDraftResult = {
  cancelRecording: () => void;
  captureState: MessagingVoiceCaptureState;
  clearDraft: () => void;
  draft: MessagingVoiceMessageDraftRecord | null;
  elapsedMs: number;
  errorCode: VoiceDraftErrorCode;
  isSupported: boolean;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
};

const UPDATE_TIMER_INTERVAL_MS = 200;
const SUPPORTED_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus',
] as const;

function createLocalDraftId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `voice-draft-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function resolveSupportedMimeType() {
  if (
    typeof window === 'undefined' ||
    typeof MediaRecorder === 'undefined' ||
    typeof MediaRecorder.isTypeSupported !== 'function'
  ) {
    return null;
  }

  return (
    SUPPORTED_MIME_TYPES.find((candidate) => MediaRecorder.isTypeSupported(candidate)) ??
    null
  );
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
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const createdAtRef = useRef<string | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const shouldDiscardOnStopRef = useRef(false);
  const startedAtRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const draftUrlRef = useRef<string | null>(null);
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

    if (captureState !== 'recording' && captureState !== 'requesting-permission') {
      setCaptureState('idle');
    }
  }, [captureState]);

  const finalizeDraft = useCallback(() => {
    const createdAt = createdAtRef.current ?? new Date().toISOString();
    const durationMs = startedAtRef.current
      ? Math.max(Date.now() - startedAtRef.current, 0)
      : elapsedMs;
    const mimeType =
      mediaRecorderRef.current?.mimeType ||
      chunksRef.current[0]?.type ||
      resolveSupportedMimeType();

    if (shouldDiscardOnStopRef.current) {
      shouldDiscardOnStopRef.current = false;
      stopActiveTimer();
      stopActiveStream();
      setDraft(null);
      setElapsedMs(0);
      setErrorCode(null);
      setCaptureState('idle');
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
      setCaptureState('failed');
      return;
    }

    const blobUrl = URL.createObjectURL(blob);

    if (draftUrlRef.current) {
      URL.revokeObjectURL(draftUrlRef.current);
    }

    draftUrlRef.current = blobUrl;
    stopActiveTimer();
    stopActiveStream();
    setElapsedMs(durationMs);
    setErrorCode(null);
    setDraft({
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

  const startRecording = useCallback(async () => {
    if (!isSupported || typeof window === 'undefined') {
      setErrorCode('unsupported');
      setCaptureState('failed');
      return;
    }

    clearDraft();
    setErrorCode(null);
    setCaptureState('requesting-permission');
    shouldDiscardOnStopRef.current = false;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      const mimeType = resolveSupportedMimeType();
      const mediaRecorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
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

      timerRef.current = setInterval(() => {
        if (!startedAtRef.current) {
          return;
        }

        setElapsedMs(Math.max(Date.now() - startedAtRef.current, 0));
      }, UPDATE_TIMER_INTERVAL_MS);
    } catch (error) {
      stopActiveTimer();
      stopActiveStream();

      const nextErrorCode =
        error instanceof DOMException && error.name === 'NotAllowedError'
          ? 'permission-denied'
          : 'capture-failed';

      setErrorCode(nextErrorCode);
      setCaptureState('failed');
    }
  }, [clearDraft, finalizeDraft, isSupported, stopActiveStream, stopActiveTimer]);

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
    cancelRecording,
    captureState,
    clearDraft,
    draft,
    elapsedMs,
    errorCode,
    isSupported,
    startRecording,
    stopRecording,
  };
}
