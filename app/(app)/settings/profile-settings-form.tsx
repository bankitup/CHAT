'use client';

import { useEffect, useRef, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { IdentityAvatar } from '@/modules/messaging/ui/identity';
import {
  PROFILE_AVATAR_ACCEPT,
  PROFILE_AVATAR_BUCKET,
  PROFILE_AVATAR_MAX_SIZE_BYTES,
  isSupportedProfileAvatarType,
  sanitizeProfileFileName,
} from '@/modules/messaging/profile-avatar';
import { removeAvatarAction, updateProfileAction } from './actions';

type ProfileSettingsFormProps = {
  avatarPath?: string | null;
  userId: string;
  defaultDisplayName: string;
  hasAvatar: boolean;
  labels: {
    profileTitle: string;
    profileSubtitle: string;
    profilePhoto: string;
    profilePhotoNote: string;
    profilePhotoCurrent: string;
    profilePhotoEmpty: string;
    displayName: string;
    displayNamePlaceholder: string;
    saveChanges: string;
    editProfile: string;
    cancelEdit: string;
    tapPhotoToChange: string;
    removePhoto: string;
    avatarTooLarge: string;
    avatarInvalidType: string;
    avatarUploading: string;
    avatarUploadFailed: string;
    avatarStorageUnavailable: string;
    profileUpdateFailed: string;
  };
};

function isBucketNotFoundStorageErrorMessage(message: string | null | undefined) {
  return (message ?? '').toLowerCase().includes('bucket not found');
}

function getAvatarClientValidationError(
  file: File,
  labels: ProfileSettingsFormProps['labels'],
) {
  if (file.size > PROFILE_AVATAR_MAX_SIZE_BYTES) {
    return labels.avatarTooLarge;
  }

  if (!isSupportedProfileAvatarType(file.type)) {
    return labels.avatarInvalidType;
  }

  return null;
}

export function ProfileSettingsForm({
  avatarPath,
  userId,
  defaultDisplayName,
  hasAvatar,
  labels,
}: ProfileSettingsFormProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [draftDisplayName, setDraftDisplayName] = useState(defaultDisplayName);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const avatarObjectPathRef = useRef<HTMLInputElement | null>(null);
  const bypassNextSubmitRef = useRef(false);

  useEffect(() => {
    return () => {
      if (avatarPreviewUrl) {
        URL.revokeObjectURL(avatarPreviewUrl);
      }
    };
  }, [avatarPreviewUrl]);

  function resetEditingState() {
    if (avatarPreviewUrl) {
      URL.revokeObjectURL(avatarPreviewUrl);
    }

    setDraftDisplayName(defaultDisplayName);
    setAvatarPreviewUrl(null);
    setSelectedFileName(null);
    setLocalError(null);
    setIsUploadingAvatar(false);
    setIsEditing(false);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    if (avatarObjectPathRef.current) {
      avatarObjectPathRef.current.value = '';
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (bypassNextSubmitRef.current) {
      bypassNextSubmitRef.current = false;
      return;
    }

    const file = fileInputRef.current?.files?.[0] ?? null;

    if (!file) {
      setLocalError(null);
      return;
    }

    const validationError = getAvatarClientValidationError(file, labels);

    if (validationError) {
      event.preventDefault();
      setLocalError(validationError);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    event.preventDefault();
    setLocalError(null);
    setIsUploadingAvatar(true);

    const supabase = createSupabaseBrowserClient();
    const objectPath = `${userId}/${crypto.randomUUID()}-${sanitizeProfileFileName(file.name)}`;
    const { error } = await supabase.storage
      .from(PROFILE_AVATAR_BUCKET)
      .upload(objectPath, file, {
        upsert: false,
        contentType: file.type,
      });

    if (error) {
      setLocalError(
        isBucketNotFoundStorageErrorMessage(error.message)
          ? labels.avatarStorageUnavailable
          : labels.avatarUploadFailed,
      );
      setIsUploadingAvatar(false);
      return;
    }

    if (avatarObjectPathRef.current) {
      avatarObjectPathRef.current.value = objectPath;
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    setSelectedFileName(null);
    setIsUploadingAvatar(false);
    bypassNextSubmitRef.current = true;
    event.currentTarget.requestSubmit();
  }

  function handleAvatarChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;

    if (!file) {
      setLocalError(null);
      return;
    }

    const validationError = getAvatarClientValidationError(file, labels);

    if (validationError) {
      event.target.value = '';
      setLocalError(validationError);
      return;
    }

    if (avatarPreviewUrl) {
      URL.revokeObjectURL(avatarPreviewUrl);
    }

    setAvatarPreviewUrl(URL.createObjectURL(file));
    setSelectedFileName(file.name);
    setLocalError(null);
  }

  const visibleAvatarPath = avatarPreviewUrl ?? avatarPath ?? null;
  const visibleDisplayName = draftDisplayName.trim() || defaultDisplayName.trim();

  return (
    <>
      {localError ? <p className="notice notice-error">{localError}</p> : null}

      <form
        action={updateProfileAction}
        className={
          isEditing
            ? 'stack profile-settings-form profile-settings-form-editing'
            : 'stack profile-settings-form'
        }
        onSubmit={handleSubmit}
      >
        <input name="avatarObjectPath" ref={avatarObjectPathRef} type="hidden" />
        <input
          ref={fileInputRef}
          className="sr-only"
          name="avatar"
          accept={PROFILE_AVATAR_ACCEPT}
          disabled={isUploadingAvatar || !isEditing}
          onChange={handleAvatarChange}
          type="file"
        />

        <div className="profile-inline-header">
          <div className="stack settings-card-copy settings-section-copy">
            <h2 className="section-title">{labels.profileTitle}</h2>
            <p className="muted">
              {isEditing ? labels.profilePhotoNote : labels.profileSubtitle}
            </p>
          </div>

          <div className="profile-inline-actions">
            {isEditing ? (
              <>
                <button
                  aria-label={labels.saveChanges}
                  className="profile-inline-save"
                  disabled={isUploadingAvatar}
                  type="submit"
                >
                  <span aria-hidden="true">✓</span>
                </button>
                <button
                  className="pill profile-inline-cancel"
                  disabled={isUploadingAvatar}
                  onClick={resetEditingState}
                  type="button"
                >
                  {labels.cancelEdit}
                </button>
              </>
            ) : (
              <button
                aria-label={labels.editProfile}
                className="pill profile-inline-edit"
                onClick={() => setIsEditing(true)}
                type="button"
              >
                <span aria-hidden="true">✎</span>
              </button>
            )}
          </div>
        </div>

        <div className="profile-inline-shell">
          <button
            aria-label={isEditing ? labels.tapPhotoToChange : labels.profilePhoto}
            className={
              isEditing
                ? 'profile-inline-avatar profile-inline-avatar-editable'
                : 'profile-inline-avatar'
            }
            disabled={!isEditing || isUploadingAvatar}
            onClick={() => fileInputRef.current?.click()}
            type="button"
          >
            <IdentityAvatar
              diagnosticsSurface="settings:profile-inline"
              identity={{
                userId,
                displayName: visibleDisplayName || null,
                avatarPath: visibleAvatarPath,
              }}
              label={visibleDisplayName || labels.profilePhoto}
              size="lg"
            />
            {isEditing ? (
              <span aria-hidden="true" className="profile-inline-avatar-badge">
                ✎
              </span>
            ) : null}
          </button>

          <div className="stack profile-inline-copy">
            {isEditing ? (
              <label className="field profile-inline-field">
                <span className="sr-only">{labels.displayName}</span>
                <input
                  className="input profile-inline-name-input"
                  disabled={isUploadingAvatar}
                  maxLength={40}
                  name="displayName"
                  onChange={(event) => setDraftDisplayName(event.target.value)}
                  placeholder={labels.displayNamePlaceholder}
                  value={draftDisplayName}
                />
              </label>
            ) : (
              <div className="stack profile-inline-view">
                <p className="profile-inline-name">
                  {visibleDisplayName || labels.displayNamePlaceholder}
                </p>
              </div>
            )}

            <p className="muted profile-field-note">
              {isEditing
                ? selectedFileName ?? labels.tapPhotoToChange
                : hasAvatar
                  ? labels.profilePhotoCurrent
                  : labels.profilePhotoEmpty}
            </p>

            {isEditing && hasAvatar ? (
              <button
                className="button button-secondary button-compact profile-inline-remove"
                formAction={removeAvatarAction}
                type="submit"
              >
                {labels.removePhoto}
              </button>
            ) : null}

            {isUploadingAvatar ? (
              <p className="muted profile-field-note">{labels.avatarUploading}</p>
            ) : null}
          </div>
        </div>
      </form>
    </>
  );
}
