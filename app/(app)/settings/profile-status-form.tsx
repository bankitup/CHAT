'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { updateProfileStatusAction } from './actions';
import type { AppLanguage } from '@/modules/i18n';

type ProfileStatusFormProps = {
  defaultStatusEmoji: string;
  defaultStatusText: string;
  labels: {
    statusTitle: string;
    statusSubtitle: string;
    statusEmpty: string;
    statusEmoji: string;
    statusText: string;
    statusEmojiPlaceholder: string;
    statusTextPlaceholder: string;
    statusSave: string;
    statusEdit: string;
    statusClear: string;
    cancelEdit: string;
    statusTextHint: string;
    statusEmojiTooLong: string;
    statusTextTooLong: string;
  };
  language: AppLanguage;
  statusUpdatedAt?: string | null;
};

function formatStatusUpdatedAt(value: string | null | undefined, language: AppLanguage) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat(language === 'ru' ? 'ru-RU' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed);
}

export function ProfileStatusForm({
  defaultStatusEmoji,
  defaultStatusText,
  labels,
  language,
  statusUpdatedAt,
}: ProfileStatusFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [draftStatusEmoji, setDraftStatusEmoji] = useState(defaultStatusEmoji);
  const [draftStatusText, setDraftStatusText] = useState(defaultStatusText);
  const hasStatus = Boolean(defaultStatusEmoji.trim() || defaultStatusText.trim());
  const visibleStatusEmoji = draftStatusEmoji.trim() || defaultStatusEmoji.trim();
  const visibleStatusText = draftStatusText.trim() || defaultStatusText.trim();
  const statusUpdatedLabel = formatStatusUpdatedAt(statusUpdatedAt, language);
  const hasDraftStatus = Boolean(draftStatusEmoji.trim() || draftStatusText.trim());

  function clearStatusQueryParams() {
    if (!searchParams.has('message') && !searchParams.has('error')) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete('message');
    nextParams.delete('error');
    const nextHref = nextParams.size > 0 ? `${pathname}?${nextParams.toString()}` : pathname;
    router.replace(nextHref, { scroll: false });
  }

  function resetEditingState() {
    setDraftStatusEmoji(defaultStatusEmoji);
    setDraftStatusText(defaultStatusText);
    setLocalError(null);
    setIsSaving(false);
    setIsEditing(false);
    clearStatusQueryParams();
  }

  async function saveStatus(input?: { clear?: boolean }) {
    if (isSaving) {
      return;
    }

    const nextStatusEmoji = input?.clear ? '' : draftStatusEmoji.trim();
    const nextStatusText = input?.clear ? '' : draftStatusText.trim();

    if (nextStatusEmoji.length > 16) {
      setLocalError(labels.statusEmojiTooLong);
      return;
    }

    if (nextStatusText.length > 80) {
      setLocalError(labels.statusTextTooLong);
      return;
    }

    setLocalError(null);
    setIsSaving(true);

    const formData = new FormData();
    formData.set('statusEmoji', nextStatusEmoji);
    formData.set('statusText', nextStatusText);

    try {
      await updateProfileStatusAction(formData);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="settings-section profile-status-section">
      <div className="profile-status-top-row">
        <div className="stack settings-card-copy settings-section-copy">
          <h2 className="section-title">{labels.statusTitle}</h2>
          <p className="muted">{labels.statusSubtitle}</p>
        </div>

        <div className="profile-inline-actions profile-inline-actions-top-row">
          {isEditing ? (
            <>
              <button
                aria-label={labels.statusSave}
                className="profile-inline-save"
                disabled={isSaving}
                onClick={() => {
                  void saveStatus();
                }}
                type="button"
              >
                <span aria-hidden="true">✓</span>
              </button>
              <button
                className="pill profile-inline-cancel"
                disabled={isSaving}
                onClick={resetEditingState}
                type="button"
              >
                {labels.cancelEdit}
              </button>
            </>
          ) : (
            <button
              aria-label={labels.statusEdit}
              className="pill profile-inline-edit"
              onClick={() => {
                clearStatusQueryParams();
                setLocalError(null);
                setIsEditing(true);
              }}
              type="button"
            >
              <span aria-hidden="true">✎</span>
            </button>
          )}
        </div>
      </div>

      {localError ? <p className="notice notice-error">{localError}</p> : null}

      {isEditing ? (
        <div className="stack profile-status-form">
          <label className="field">
            <span className="profile-status-field-label">{labels.statusEmoji}</span>
            <input
              className="input profile-status-emoji-input"
              disabled={isSaving}
              maxLength={16}
              onChange={(event) => setDraftStatusEmoji(event.target.value)}
              placeholder={labels.statusEmojiPlaceholder}
              value={draftStatusEmoji}
            />
          </label>

          <label className="field">
            <span className="profile-status-field-label">{labels.statusText}</span>
            <input
              className="input"
              disabled={isSaving}
              maxLength={80}
              onChange={(event) => setDraftStatusText(event.target.value)}
              placeholder={labels.statusTextPlaceholder}
              value={draftStatusText}
            />
          </label>

          <p className="muted profile-field-note">{labels.statusTextHint}</p>

          {hasDraftStatus || hasStatus ? (
            <div className="profile-status-actions">
              <button
                className="button button-secondary button-compact"
                disabled={isSaving}
                onClick={() => {
                  void saveStatus({ clear: true });
                }}
                type="button"
              >
                {labels.statusClear}
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="profile-status-preview">
          {hasStatus ? (
            <div className="profile-status-pill">
              {visibleStatusEmoji ? (
                <span aria-hidden="true" className="profile-status-emoji">
                  {visibleStatusEmoji}
                </span>
              ) : null}
              {visibleStatusText ? (
                <span className="profile-status-text">{visibleStatusText}</span>
              ) : null}
            </div>
          ) : (
            <p className="muted profile-field-note">{labels.statusEmpty}</p>
          )}

          {statusUpdatedLabel ? (
            <p className="muted profile-field-note">{statusUpdatedLabel}</p>
          ) : null}
        </div>
      )}
    </section>
  );
}
