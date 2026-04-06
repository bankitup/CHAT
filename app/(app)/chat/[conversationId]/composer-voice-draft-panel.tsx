'use client';

import type { AppLanguage } from '@/modules/i18n';
import { getTranslations } from '@/modules/i18n';
import type { MessagingVoiceCaptureState } from '@/modules/messaging/media/voice';
import type { MessagingVoiceMessageDraftRecord } from '@/modules/messaging/media/voice';

type ComposerVoiceDraftPanelProps = {
  captureState: MessagingVoiceCaptureState;
  draft: MessagingVoiceMessageDraftRecord | null;
  elapsedMs: number;
  errorCode: 'unsupported' | 'permission-denied' | 'capture-failed' | null;
  language: AppLanguage;
  onCancel: () => void;
  onRetry: () => Promise<void>;
  onSend: () => void;
  onStop: () => void;
};

function formatElapsedDuration(durationMs: number | null, language: AppLanguage) {
  if (durationMs === null || durationMs < 0) {
    return '00:00';
  }

  const totalSeconds = Math.max(Math.floor(durationMs / 1000), 0);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return new Intl.NumberFormat(language === 'ru' ? 'ru-RU' : 'en-US', {
    minimumIntegerDigits: 2,
    useGrouping: false,
  }).format(minutes).concat(':').concat(
    new Intl.NumberFormat(language === 'ru' ? 'ru-RU' : 'en-US', {
      minimumIntegerDigits: 2,
      useGrouping: false,
    }).format(seconds),
  );
}

export function ComposerVoiceDraftPanel({
  captureState,
  draft,
  elapsedMs,
  errorCode,
  language,
  onCancel,
  onRetry,
  onSend,
  onStop,
}: ComposerVoiceDraftPanelProps) {
  const t = getTranslations(language);
  const shouldRender =
    captureState === 'requesting-permission' ||
    captureState === 'recording' ||
    captureState === 'stopped' ||
    captureState === 'failed' ||
    captureState === 'cancelled' ||
    Boolean(draft);

  if (!shouldRender) {
    return null;
  }

  const isRecording =
    captureState === 'recording' ||
    captureState === 'requesting-permission' ||
    captureState === 'cancelled';
  const durationLabel = formatElapsedDuration(
    draft?.durationMs ?? elapsedMs,
    language,
  );
  const statusLabel =
    captureState === 'requesting-permission'
      ? t.chat.voiceRecorderPreparing
      : captureState === 'recording'
        ? t.chat.voiceRecorderRecording
        : captureState === 'failed'
          ? errorCode === 'permission-denied'
            ? t.chat.voiceRecorderPermissionDenied
            : errorCode === 'unsupported'
              ? t.chat.voiceRecorderUnavailable
              : t.chat.voiceRecorderFailed
          : t.chat.voiceRecorderDraftReady;

  return (
    <div
      className="composer-voice-panel"
      data-voice-composer-state={
        captureState === 'failed'
          ? 'failed'
          : isRecording
            ? 'recording'
            : 'draft'
      }
    >
      <div className="composer-voice-panel-main">
        <span
          aria-hidden="true"
          className={
            isRecording
              ? 'composer-voice-panel-indicator composer-voice-panel-indicator-live'
              : 'composer-voice-panel-indicator'
          }
        />
        <div className="composer-voice-panel-copy">
          <span className="composer-voice-panel-title">{statusLabel}</span>
          <span className="composer-voice-panel-meta">{durationLabel}</span>
        </div>
      </div>

      <div className="composer-voice-panel-actions">
        {captureState === 'failed' ? (
          <>
            <button
              className="composer-voice-panel-action composer-voice-panel-action-muted"
              type="button"
              onClick={onCancel}
            >
              {t.chat.cancel}
            </button>
            <button
              className="composer-voice-panel-action composer-voice-panel-action-primary"
              type="button"
              onClick={() => {
                void onRetry();
              }}
            >
              {t.chat.voiceRecorderRetry}
            </button>
          </>
        ) : isRecording ? (
          <>
            <button
              className="composer-voice-panel-action composer-voice-panel-action-muted"
              type="button"
              onClick={onCancel}
            >
              {t.chat.cancel}
            </button>
            <button
              className="composer-voice-panel-action composer-voice-panel-action-primary"
              type="button"
              onClick={onStop}
            >
              {t.chat.voiceRecorderStop}
            </button>
          </>
        ) : (
          <>
            <button
              className="composer-voice-panel-action composer-voice-panel-action-muted"
              type="button"
              onClick={onCancel}
            >
              {t.chat.cancel}
            </button>
            <button
              className="composer-voice-panel-action composer-voice-panel-action-primary"
              type="button"
              onClick={onSend}
            >
              {t.chat.sendMessage}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
