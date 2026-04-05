'use client';

import NextImage from 'next/image';
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

const AVATAR_EDITOR_PREVIEW_SIZE = 220;
const AVATAR_EDITOR_OUTPUT_SIZE = 512;
const AVATAR_EDITOR_MIN_ZOOM = 1;
const AVATAR_EDITOR_MAX_ZOOM = 3;
const AVATAR_EDITOR_ZOOM_STEP = 0.01;

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
    avatarEditorHint: string;
    avatarEditorZoom: string;
    avatarEditorApply: string;
    avatarEditorDraftReady: string;
    avatarEditorPreparing: string;
    avatarEditorLoadFailed: string;
    avatarEditorApplyBeforeSave: string;
  };
};

type AvatarEditorDraft = {
  fileName: string;
  mimeType: string;
  naturalHeight: number;
  naturalWidth: number;
  offsetX: number;
  offsetY: number;
  sourceUrl: string;
  zoom: number;
};

type PendingAvatarDraft = {
  blob: Blob;
  fileName: string;
  previewUrl: string;
};

function isBucketNotFoundStorageErrorMessage(message: string | null | undefined) {
  return (message ?? '').toLowerCase().includes('bucket not found');
}

function revokeObjectUrl(value: string | null) {
  if (value) {
    URL.revokeObjectURL(value);
  }
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

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function getAvatarRenderMetrics(draft: AvatarEditorDraft, zoom = draft.zoom) {
  const baseScale = Math.max(
    AVATAR_EDITOR_PREVIEW_SIZE / draft.naturalWidth,
    AVATAR_EDITOR_PREVIEW_SIZE / draft.naturalHeight,
  );
  const scale = baseScale * zoom;
  const width = draft.naturalWidth * scale;
  const height = draft.naturalHeight * scale;
  const maxOffsetX = Math.max(0, (width - AVATAR_EDITOR_PREVIEW_SIZE) / 2);
  const maxOffsetY = Math.max(0, (height - AVATAR_EDITOR_PREVIEW_SIZE) / 2);

  return {
    width,
    height,
    maxOffsetX,
    maxOffsetY,
  };
}

function clampAvatarOffsets(draft: AvatarEditorDraft, nextZoom = draft.zoom) {
  const metrics = getAvatarRenderMetrics(draft, nextZoom);

  return {
    offsetX: clamp(draft.offsetX, -metrics.maxOffsetX, metrics.maxOffsetX),
    offsetY: clamp(draft.offsetY, -metrics.maxOffsetY, metrics.maxOffsetY),
  };
}

async function loadAvatarEditorDraft(file: File) {
  const sourceUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const nextImage = new Image();
      nextImage.onload = () => resolve(nextImage);
      nextImage.onerror = () => reject(new Error('avatar_image_load_failed'));
      nextImage.src = sourceUrl;
    });

    return {
      fileName: file.name,
      mimeType: file.type,
      naturalHeight: image.naturalHeight,
      naturalWidth: image.naturalWidth,
      offsetX: 0,
      offsetY: 0,
      sourceUrl,
      zoom: 1,
    } satisfies AvatarEditorDraft;
  } catch (error) {
    revokeObjectUrl(sourceUrl);
    throw error;
  }
}

async function renderAvatarCropBlob(draft: AvatarEditorDraft) {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const nextImage = new Image();
    nextImage.onload = () => resolve(nextImage);
    nextImage.onerror = () => reject(new Error('avatar_crop_render_failed'));
    nextImage.src = draft.sourceUrl;
  });

  const canvas = document.createElement('canvas');
  canvas.width = AVATAR_EDITOR_OUTPUT_SIZE;
  canvas.height = AVATAR_EDITOR_OUTPUT_SIZE;
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('avatar_crop_context_unavailable');
  }

  const previewToOutputRatio =
    AVATAR_EDITOR_OUTPUT_SIZE / AVATAR_EDITOR_PREVIEW_SIZE;
  const metrics = getAvatarRenderMetrics(draft);
  const outputWidth = metrics.width * previewToOutputRatio;
  const outputHeight = metrics.height * previewToOutputRatio;
  const centerX =
    AVATAR_EDITOR_OUTPUT_SIZE / 2 + draft.offsetX * previewToOutputRatio;
  const centerY =
    AVATAR_EDITOR_OUTPUT_SIZE / 2 + draft.offsetY * previewToOutputRatio;

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.save();
  context.beginPath();
  context.arc(
    AVATAR_EDITOR_OUTPUT_SIZE / 2,
    AVATAR_EDITOR_OUTPUT_SIZE / 2,
    AVATAR_EDITOR_OUTPUT_SIZE / 2,
    0,
    Math.PI * 2,
  );
  context.closePath();
  context.clip();
  context.drawImage(
    image,
    centerX - outputWidth / 2,
    centerY - outputHeight / 2,
    outputWidth,
    outputHeight,
  );
  context.restore();

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/png', 0.92);
  });

  if (!blob) {
    throw new Error('avatar_crop_blob_failed');
  }

  return blob;
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
  const [isPreparingAvatar, setIsPreparingAvatar] = useState(false);
  const [draftDisplayName, setDraftDisplayName] = useState(defaultDisplayName);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [avatarEditorDraft, setAvatarEditorDraft] =
    useState<AvatarEditorDraft | null>(null);
  const [pendingAvatarDraft, setPendingAvatarDraft] =
    useState<PendingAvatarDraft | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const avatarObjectPathRef = useRef<HTMLInputElement | null>(null);
  const bypassNextSubmitRef = useRef(false);
  const latestEditorSourceUrlRef = useRef<string | null>(null);
  const latestPendingPreviewUrlRef = useRef<string | null>(null);
  const dragStateRef = useRef<{
    originX: number;
    originY: number;
    pointerId: number;
    startX: number;
    startY: number;
  } | null>(null);

  useEffect(() => {
    latestEditorSourceUrlRef.current = avatarEditorDraft?.sourceUrl ?? null;
  }, [avatarEditorDraft?.sourceUrl]);

  useEffect(() => {
    latestPendingPreviewUrlRef.current = pendingAvatarDraft?.previewUrl ?? null;
  }, [pendingAvatarDraft?.previewUrl]);

  useEffect(() => {
    return () => {
      revokeObjectUrl(latestEditorSourceUrlRef.current);
      revokeObjectUrl(latestPendingPreviewUrlRef.current);
    };
  }, []);

  function clearAvatarObjectPath() {
    if (avatarObjectPathRef.current) {
      avatarObjectPathRef.current.value = '';
    }
  }

  function clearPendingAvatarState() {
    revokeObjectUrl(avatarEditorDraft?.sourceUrl ?? null);
    revokeObjectUrl(pendingAvatarDraft?.previewUrl ?? null);
    setAvatarEditorDraft(null);
    setPendingAvatarDraft(null);
    setSelectedFileName(null);
    clearAvatarObjectPath();

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  function resetEditingState() {
    setDraftDisplayName(defaultDisplayName);
    setLocalError(null);
    setIsUploadingAvatar(false);
    setIsPreparingAvatar(false);
    setIsEditing(false);
    clearPendingAvatarState();
  }

  async function applyCurrentAvatarDraft() {
    if (!avatarEditorDraft) {
      return pendingAvatarDraft;
    }

    setIsPreparingAvatar(true);

    try {
      const blob = await renderAvatarCropBlob(avatarEditorDraft);
      const previewUrl = URL.createObjectURL(blob);
      const nextPendingDraft = {
        blob,
        fileName: avatarEditorDraft.fileName,
        previewUrl,
      } satisfies PendingAvatarDraft;

      revokeObjectUrl(pendingAvatarDraft?.previewUrl ?? null);
      setPendingAvatarDraft(nextPendingDraft);
      setSelectedFileName(avatarEditorDraft.fileName);
      revokeObjectUrl(avatarEditorDraft.sourceUrl);
      setAvatarEditorDraft(null);
      setLocalError(null);

      return nextPendingDraft;
    } catch (error) {
      setLocalError(
        error instanceof Error && error.message === 'avatar_image_load_failed'
          ? labels.avatarEditorLoadFailed
          : labels.avatarUploadFailed,
      );
      return null;
    } finally {
      setIsPreparingAvatar(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (bypassNextSubmitRef.current) {
      bypassNextSubmitRef.current = false;
      return;
    }

    const nativeEvent = event.nativeEvent;
    const submitter =
      nativeEvent instanceof SubmitEvent &&
      nativeEvent.submitter instanceof HTMLButtonElement
        ? nativeEvent.submitter
        : null;

    if (submitter?.dataset.profileAction === 'remove-avatar') {
      clearPendingAvatarState();
      setLocalError(null);
      return;
    }

    if (avatarEditorDraft) {
      event.preventDefault();
      setLocalError(labels.avatarEditorApplyBeforeSave);
      return;
    }

    const avatarDraftToUpload = pendingAvatarDraft;

    if (!avatarDraftToUpload) {
      setLocalError(null);
      return;
    }

    event.preventDefault();
    setLocalError(null);
    setIsUploadingAvatar(true);

    const supabase = createSupabaseBrowserClient();
    const objectPath = `${userId}/${crypto.randomUUID()}-${sanitizeProfileFileName(
      avatarDraftToUpload.fileName.replace(/\.[a-z0-9]+$/i, '') || 'avatar',
    )}.png`;
    const { error } = await supabase.storage
      .from(PROFILE_AVATAR_BUCKET)
      .upload(objectPath, avatarDraftToUpload.blob, {
        upsert: false,
        contentType: 'image/png',
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

    bypassNextSubmitRef.current = true;
    setIsUploadingAvatar(false);
    event.currentTarget.requestSubmit();
  }

  async function handleAvatarChange(event: React.ChangeEvent<HTMLInputElement>) {
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

    try {
      const nextDraft = await loadAvatarEditorDraft(file);
      revokeObjectUrl(avatarEditorDraft?.sourceUrl ?? null);
      revokeObjectUrl(pendingAvatarDraft?.previewUrl ?? null);
      setAvatarEditorDraft(nextDraft);
      setPendingAvatarDraft(null);
      setSelectedFileName(file.name);
      clearAvatarObjectPath();
      setLocalError(null);
    } catch {
      event.target.value = '';
      setLocalError(labels.avatarEditorLoadFailed);
    }
  }

  function handleAvatarEditorPointerDown(
    event: React.PointerEvent<HTMLDivElement>,
  ) {
    if (!avatarEditorDraft || isPreparingAvatar || isUploadingAvatar) {
      return;
    }

    dragStateRef.current = {
      originX: avatarEditorDraft.offsetX,
      originY: avatarEditorDraft.offsetY,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleAvatarEditorPointerMove(
    event: React.PointerEvent<HTMLDivElement>,
  ) {
    if (!avatarEditorDraft || !dragStateRef.current) {
      return;
    }

    if (dragStateRef.current.pointerId !== event.pointerId) {
      return;
    }

    const nextDraft = {
      ...avatarEditorDraft,
      offsetX:
        dragStateRef.current.originX +
        (event.clientX - dragStateRef.current.startX),
      offsetY:
        dragStateRef.current.originY +
        (event.clientY - dragStateRef.current.startY),
    };
    const clampedOffsets = clampAvatarOffsets(nextDraft);

    setAvatarEditorDraft({
      ...nextDraft,
      ...clampedOffsets,
    });
  }

  function handleAvatarEditorPointerEnd(
    event: React.PointerEvent<HTMLDivElement>,
  ) {
    if (dragStateRef.current?.pointerId !== event.pointerId) {
      return;
    }

    dragStateRef.current = null;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  const visibleAvatarPath =
    pendingAvatarDraft?.previewUrl ?? avatarPath ?? null;
  const visibleDisplayName = draftDisplayName.trim() || defaultDisplayName.trim();
  const avatarDraftNote = avatarEditorDraft
    ? labels.avatarEditorHint
    : pendingAvatarDraft
      ? labels.avatarEditorDraftReady
      : isEditing
        ? selectedFileName ?? labels.tapPhotoToChange
        : hasAvatar
          ? labels.profilePhotoCurrent
          : labels.profilePhotoEmpty;
  const hasPersistedAvatarWithoutDraft =
    hasAvatar && !avatarEditorDraft && !pendingAvatarDraft;
  const editorMetrics = avatarEditorDraft
    ? getAvatarRenderMetrics(avatarEditorDraft)
    : null;

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
          accept={PROFILE_AVATAR_ACCEPT}
          disabled={isUploadingAvatar || isPreparingAvatar || !isEditing}
          onChange={handleAvatarChange}
          type="file"
        />

        <div className="profile-inline-header profile-inline-header-actions-only">
          <div className="profile-inline-actions">
            {isEditing ? (
              <>
                <button
                  aria-label={labels.saveChanges}
                  className="profile-inline-save"
                  disabled={
                    isUploadingAvatar ||
                    isPreparingAvatar ||
                    Boolean(avatarEditorDraft)
                  }
                  type="submit"
                >
                  <span aria-hidden="true">✓</span>
                </button>
                <button
                  className="pill profile-inline-cancel"
                  disabled={isUploadingAvatar || isPreparingAvatar}
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
            disabled={!isEditing || isUploadingAvatar || isPreparingAvatar}
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
                  disabled={isUploadingAvatar || isPreparingAvatar}
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

            <p className="muted profile-field-note">{avatarDraftNote}</p>

            {isEditing && hasPersistedAvatarWithoutDraft ? (
              <button
                className="button button-secondary button-compact profile-inline-remove"
                data-profile-action="remove-avatar"
                disabled={isUploadingAvatar || isPreparingAvatar}
                formAction={removeAvatarAction}
                type="submit"
              >
                {labels.removePhoto}
              </button>
            ) : null}

            {isUploadingAvatar || isPreparingAvatar ? (
              <p className="muted profile-field-note">
                {isPreparingAvatar ? labels.avatarEditorPreparing : labels.avatarUploading}
              </p>
            ) : null}
          </div>
        </div>

        {isEditing && avatarEditorDraft && editorMetrics ? (
          <div className="stack profile-avatar-editor">
            <div
              className="profile-avatar-editor-stage"
              onPointerCancel={handleAvatarEditorPointerEnd}
              onPointerDown={handleAvatarEditorPointerDown}
              onPointerMove={handleAvatarEditorPointerMove}
              onPointerUp={handleAvatarEditorPointerEnd}
            >
              <div className="profile-avatar-editor-crop">
                <NextImage
                  alt=""
                  className="profile-avatar-editor-image"
                  draggable={false}
                  src={avatarEditorDraft.sourceUrl}
                  unoptimized
                  height={Math.round(editorMetrics.height)}
                  style={{
                    height: `${editorMetrics.height}px`,
                    transform: `translate(calc(-50% + ${avatarEditorDraft.offsetX}px), calc(-50% + ${avatarEditorDraft.offsetY}px))`,
                    width: `${editorMetrics.width}px`,
                  }}
                  width={Math.round(editorMetrics.width)}
                />
                <div className="profile-avatar-editor-overlay" />
              </div>
            </div>

            <label className="stack profile-avatar-editor-control">
              <span className="profile-avatar-editor-control-label">
                {labels.avatarEditorZoom}
              </span>
              <input
                className="profile-avatar-editor-slider"
                disabled={isPreparingAvatar || isUploadingAvatar}
                max={AVATAR_EDITOR_MAX_ZOOM}
                min={AVATAR_EDITOR_MIN_ZOOM}
                onChange={(event) => {
                  const nextZoom = Number(event.target.value);

                  setAvatarEditorDraft((currentDraft) => {
                    if (!currentDraft) {
                      return currentDraft;
                    }

                    const nextDraft = {
                      ...currentDraft,
                      zoom: nextZoom,
                    };
                    const clampedOffsets = clampAvatarOffsets(nextDraft, nextZoom);

                    return {
                      ...nextDraft,
                      ...clampedOffsets,
                    };
                  });
                }}
                step={AVATAR_EDITOR_ZOOM_STEP}
                type="range"
                value={avatarEditorDraft.zoom}
              />
            </label>

            <div className="profile-avatar-editor-actions">
              <button
                className="button button-secondary button-compact"
                disabled={isPreparingAvatar || isUploadingAvatar}
                onClick={() => fileInputRef.current?.click()}
                type="button"
              >
                {labels.tapPhotoToChange}
              </button>
              <button
                className="button button-compact profile-avatar-editor-apply"
                disabled={isPreparingAvatar || isUploadingAvatar}
                onClick={async () => {
                  await applyCurrentAvatarDraft();
                }}
                type="button"
              >
                {labels.avatarEditorApply}
              </button>
            </div>
          </div>
        ) : null}
      </form>
    </>
  );
}
