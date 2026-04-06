'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { GroupConversationJoinPolicy } from '@/modules/messaging/group-policy';
import { GroupIdentityAvatar } from '@/modules/messaging/ui/identity';
import {
  PROFILE_AVATAR_ACCEPT,
  PROFILE_AVATAR_MAX_SIZE_BYTES,
  isSupportedProfileAvatarType,
} from '@/modules/messaging/profile-avatar';
import { updateConversationIdentityAction } from './actions';

type GroupChatSettingsFormProps = {
  conversationId: string;
  defaultAvatarPath?: string | null;
  defaultJoinPolicy: GroupConversationJoinPolicy;
  defaultTitle: string;
  labels: {
    title: string;
    subtitle: string;
    name: string;
    namePlaceholder: string;
    nameRequired: string;
    changePhoto: string;
    removePhoto: string;
    saveChanges: string;
    cancelEdit: string;
    avatarDraftReady: string;
    avatarRemovedDraft: string;
    avatarUploading: string;
    avatarTooLarge: string;
    avatarInvalidType: string;
    avatarUploadFailed: string;
    avatarStorageUnavailable: string;
    privacyTitle: string;
    privacyNote: string;
    privacyOpen: string;
    privacyOpenNote: string;
    privacyClosed: string;
    privacyClosedNote: string;
  };
  spaceId?: string | null;
  returnTo?: 'settings-screen' | null;
};

function revokeObjectUrl(value: string | null) {
  if (value) {
    URL.revokeObjectURL(value);
  }
}

export function GroupChatSettingsForm({
  conversationId,
  defaultAvatarPath,
  defaultJoinPolicy,
  defaultTitle,
  labels,
  spaceId,
  returnTo,
}: GroupChatSettingsFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const latestPreviewUrlRef = useRef<string | null>(null);
  const [draftTitle, setDraftTitle] = useState(defaultTitle);
  const [draftJoinPolicy, setDraftJoinPolicy] =
    useState<GroupConversationJoinPolicy>(defaultJoinPolicy);
  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null);
  const [pendingAvatarPreviewUrl, setPendingAvatarPreviewUrl] = useState<string | null>(null);
  const [isAvatarRemovalDraft, setIsAvatarRemovalDraft] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    latestPreviewUrlRef.current = pendingAvatarPreviewUrl;
  }, [pendingAvatarPreviewUrl]);

  useEffect(() => {
    return () => {
      revokeObjectUrl(latestPreviewUrlRef.current);
    };
  }, []);

  function clearStatusQueryParams() {
    if (!searchParams.has('saved') && !searchParams.has('error')) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete('saved');
    nextParams.delete('error');
    const nextHref = nextParams.size > 0 ? `${pathname}?${nextParams.toString()}` : pathname;
    router.replace(nextHref, { scroll: false });
  }

  function resetDraftState() {
    setDraftTitle(defaultTitle);
    setDraftJoinPolicy(defaultJoinPolicy);
    setPendingAvatarFile(null);
    revokeObjectUrl(pendingAvatarPreviewUrl);
    setPendingAvatarPreviewUrl(null);
    setIsAvatarRemovalDraft(false);
    setLocalError(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    clearStatusQueryParams();
  }

  async function handleAvatarChange(event: React.ChangeEvent<HTMLInputElement>) {
    if (isSaving) {
      return;
    }

    const file = event.target.files?.[0] ?? null;

    if (!file) {
      return;
    }

    clearStatusQueryParams();

    if (file.size > PROFILE_AVATAR_MAX_SIZE_BYTES) {
      event.target.value = '';
      setLocalError(labels.avatarTooLarge);
      return;
    }

    if (!isSupportedProfileAvatarType(file.type)) {
      event.target.value = '';
      setLocalError(labels.avatarInvalidType);
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    revokeObjectUrl(pendingAvatarPreviewUrl);
    setPendingAvatarFile(file);
    setPendingAvatarPreviewUrl(previewUrl);
    setIsAvatarRemovalDraft(false);
    setLocalError(null);
  }

  async function handleSave() {
    if (isSaving) {
      return;
    }

    const normalizedDraftTitle = draftTitle.trim();
    const normalizedDefaultTitle = defaultTitle.trim();
    const hasTitleChange = normalizedDraftTitle !== normalizedDefaultTitle;
    const hasJoinPolicyChange = draftJoinPolicy !== defaultJoinPolicy;
    const hasAvatarChange = Boolean(pendingAvatarFile) || isAvatarRemovalDraft;

    if (!hasTitleChange && !hasJoinPolicyChange && !hasAvatarChange) {
      return;
    }

    if (!normalizedDraftTitle) {
      setLocalError(labels.nameRequired);
      return;
    }

    setIsSaving(true);
    setLocalError(null);

    const formData = new FormData();
    formData.set('conversationId', conversationId);
    formData.set('joinPolicy', draftJoinPolicy);
    formData.set('title', normalizedDraftTitle);

    if (spaceId?.trim()) {
      formData.set('spaceId', spaceId.trim());
    }

    if (returnTo === 'settings-screen') {
      formData.set('returnTo', 'settings-screen');
    }

    if (pendingAvatarFile) {
      formData.set('avatar', pendingAvatarFile);
    }

    if (isAvatarRemovalDraft && !pendingAvatarFile) {
      formData.set('removeAvatar', '1');
    }

    try {
      await updateConversationIdentityAction(formData);
    } finally {
      setIsSaving(false);
    }
  }

  const visibleAvatarPath =
    pendingAvatarPreviewUrl ?? (isAvatarRemovalDraft ? null : defaultAvatarPath ?? null);
  const draftNote = pendingAvatarFile
    ? labels.avatarDraftReady
    : isAvatarRemovalDraft
      ? labels.avatarRemovedDraft
      : labels.subtitle;
  const isBusy = isSaving;

  return (
    <section className="stack conversation-settings-subsection conversation-group-identity-form">
      <div className="stack conversation-settings-panel-copy">
        <h4 className="conversation-settings-subtitle">{labels.title}</h4>
        <p className="muted conversation-settings-note">{labels.subtitle}</p>
      </div>

      {localError ? <p className="notice notice-error">{localError}</p> : null}

      <div className="conversation-group-identity-shell">
        <button
          className="conversation-group-avatar-button"
          disabled={isBusy}
          onClick={() => {
            clearStatusQueryParams();
            fileInputRef.current?.click();
          }}
          type="button"
        >
          <GroupIdentityAvatar
            avatarPath={visibleAvatarPath}
            label={draftTitle.trim() || labels.namePlaceholder}
            size="lg"
          />
          <span aria-hidden="true" className="conversation-group-avatar-badge">
            ✎
          </span>
        </button>

        <div className="stack conversation-group-identity-fields">
          <label className="field">
            <span className="sr-only">{labels.name}</span>
            <input
              className="input"
              disabled={isBusy}
              maxLength={80}
              onChange={(event) => {
                clearStatusQueryParams();
                setDraftTitle(event.target.value);
              }}
              placeholder={labels.namePlaceholder}
              value={draftTitle}
            />
          </label>

          <p className="muted conversation-settings-note">{draftNote}</p>

          <section className="stack conversation-settings-subsection conversation-group-privacy-subsection">
            <div className="stack conversation-settings-panel-copy">
              <h4 className="conversation-settings-subtitle">{labels.privacyTitle}</h4>
              <p className="muted conversation-settings-note">{labels.privacyNote}</p>
            </div>

            <div className="checkbox-list inbox-settings-option-list conversation-group-privacy-list">
              <label className="checkbox-row inbox-settings-option-row">
                <input
                  checked={draftJoinPolicy === 'closed'}
                  className="inbox-settings-option-input"
                  disabled={isBusy}
                  name="group-join-policy"
                  onChange={() => {
                    clearStatusQueryParams();
                    setDraftJoinPolicy('closed');
                  }}
                  type="radio"
                />
                <span aria-hidden="true" className="inbox-settings-option-mark" />
                <span className="stack checkbox-copy inbox-settings-option-copy">
                  <span className="inbox-settings-option-title">{labels.privacyClosed}</span>
                  <span className="inbox-settings-option-note">
                    {labels.privacyClosedNote}
                  </span>
                </span>
              </label>

              <label className="checkbox-row inbox-settings-option-row">
                <input
                  checked={draftJoinPolicy === 'open'}
                  className="inbox-settings-option-input"
                  disabled={isBusy}
                  name="group-join-policy"
                  onChange={() => {
                    clearStatusQueryParams();
                    setDraftJoinPolicy('open');
                  }}
                  type="radio"
                />
                <span aria-hidden="true" className="inbox-settings-option-mark" />
                <span className="stack checkbox-copy inbox-settings-option-copy">
                  <span className="inbox-settings-option-title">{labels.privacyOpen}</span>
                  <span className="inbox-settings-option-note">
                    {labels.privacyOpenNote}
                  </span>
                </span>
              </label>
            </div>
          </section>

          <div className="conversation-group-identity-actions">
            <input
              ref={fileInputRef}
              accept={PROFILE_AVATAR_ACCEPT}
              className="sr-only"
              disabled={isBusy}
              onChange={handleAvatarChange}
              type="file"
            />

            <button
              className="button button-secondary button-compact"
              disabled={isBusy}
              onClick={() => {
                clearStatusQueryParams();
                fileInputRef.current?.click();
              }}
              type="button"
            >
              {labels.changePhoto}
            </button>

            {(defaultAvatarPath || pendingAvatarFile) && !isAvatarRemovalDraft ? (
              <button
                className="button button-secondary button-compact"
                disabled={isBusy}
                onClick={() => {
                  clearStatusQueryParams();
                  if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                  }
                  revokeObjectUrl(pendingAvatarPreviewUrl);
                  setPendingAvatarFile(null);
                  setPendingAvatarPreviewUrl(null);
                  setIsAvatarRemovalDraft(true);
                  setLocalError(null);
                }}
                type="button"
              >
                {labels.removePhoto}
              </button>
            ) : null}

            <button
              className="button button-compact"
              disabled={isBusy}
              onClick={() => {
                void handleSave();
              }}
              type="button"
            >
              {isSaving ? labels.avatarUploading : labels.saveChanges}
            </button>

            <button
              className="pill conversation-group-identity-cancel"
              disabled={isBusy}
              onClick={resetDraftState}
              type="button"
            >
              {labels.cancelEdit}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
