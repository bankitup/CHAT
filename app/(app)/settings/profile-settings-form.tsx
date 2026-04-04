'use client';

import { useRef, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import {
  PROFILE_AVATAR_ACCEPT,
  PROFILE_AVATAR_BUCKET,
  PROFILE_AVATAR_MAX_SIZE_BYTES,
  isSupportedProfileAvatarType,
  sanitizeProfileFileName,
} from '@/modules/messaging/profile-avatar';
import { updateProfileAction } from './actions';

type ProfileSettingsFormProps = {
  userId: string;
  defaultDisplayName: string;
  hasAvatar: boolean;
  labels: {
    profilePhoto: string;
    profilePhotoNote: string;
    profilePhotoCurrent: string;
    profilePhotoEmpty: string;
    displayName: string;
    displayNamePlaceholder: string;
    saveChanges: string;
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
  userId,
  defaultDisplayName,
  hasAvatar,
  labels,
}: ProfileSettingsFormProps) {
  const [localError, setLocalError] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const avatarObjectPathRef = useRef<HTMLInputElement | null>(null);
  const bypassNextSubmitRef = useRef(false);

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

    setLocalError(null);
  }

  return (
    <>
      {localError ? <p className="notice notice-error">{localError}</p> : null}

      <form
        action={updateProfileAction}
        className="stack profile-settings-form"
        onSubmit={handleSubmit}
      >
        <input name="avatarObjectPath" ref={avatarObjectPathRef} type="hidden" />

        <label className="field profile-avatar-field">
          <span>{labels.profilePhoto}</span>
          <input
            ref={fileInputRef}
            className="input profile-file-input"
            name="avatar"
            accept={PROFILE_AVATAR_ACCEPT}
            disabled={isUploadingAvatar}
            onChange={handleAvatarChange}
            type="file"
          />
          <span className="muted profile-field-note">
            {labels.profilePhotoNote}
          </span>
          <span className="muted profile-field-note">
            {hasAvatar
              ? labels.profilePhotoCurrent
              : labels.profilePhotoEmpty}
          </span>
        </label>

        <label className="field">
          <span>{labels.displayName}</span>
          <input
            className="input"
            defaultValue={defaultDisplayName}
            disabled={isUploadingAvatar}
            name="displayName"
            placeholder={labels.displayNamePlaceholder}
            maxLength={40}
          />
        </label>

        <button className="button" disabled={isUploadingAvatar} type="submit">
          {isUploadingAvatar ? labels.avatarUploading : labels.saveChanges}
        </button>
      </form>
    </>
  );
}
