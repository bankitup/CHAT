'use client';

import NextImage from 'next/image';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
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
import { updateProfileAction } from './actions';

const AVATAR_EDITOR_PREVIEW_SIZE = 260;
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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isEditing, setIsEditing] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isPreparingAvatar, setIsPreparingAvatar] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [draftDisplayName, setDraftDisplayName] = useState(defaultDisplayName);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [avatarEditorDraft, setAvatarEditorDraft] =
    useState<AvatarEditorDraft | null>(null);
  const [pendingAvatarDraft, setPendingAvatarDraft] =
    useState<PendingAvatarDraft | null>(null);
  const [isAvatarRemovalDraft, setIsAvatarRemovalDraft] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
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

  useEffect(() => {
    if (!avatarEditorDraft || typeof document === 'undefined') {
      return;
    }

    const { body, documentElement } = document;
    const previousBodyOverflow = body.style.overflow;
    const previousDocumentOverflow = documentElement.style.overflow;

    body.style.overflow = 'hidden';
    documentElement.style.overflow = 'hidden';

    return () => {
      body.style.overflow = previousBodyOverflow;
      documentElement.style.overflow = previousDocumentOverflow;
    };
  }, [avatarEditorDraft]);

  function resetAvatarPickerInput() {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

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

  function clearPendingAvatarState() {
    revokeObjectUrl(avatarEditorDraft?.sourceUrl ?? null);
    revokeObjectUrl(pendingAvatarDraft?.previewUrl ?? null);
    setAvatarEditorDraft(null);
    setPendingAvatarDraft(null);
    setSelectedFileName(null);
    resetAvatarPickerInput();
  }

  function resetEditingState() {
    setDraftDisplayName(defaultDisplayName);
    setLocalError(null);
    setIsUploadingAvatar(false);
    setIsPreparingAvatar(false);
    setIsSavingProfile(false);
    setIsAvatarRemovalDraft(false);
    setIsEditing(false);
    clearPendingAvatarState();
    clearStatusQueryParams();
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
      setIsAvatarRemovalDraft(false);
      revokeObjectUrl(avatarEditorDraft.sourceUrl);
      setAvatarEditorDraft(null);
      setLocalError(null);
      resetAvatarPickerInput();

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

  function cancelAvatarEditor() {
    revokeObjectUrl(avatarEditorDraft?.sourceUrl ?? null);
    setAvatarEditorDraft(null);
    setSelectedFileName(pendingAvatarDraft?.fileName ?? null);
    setLocalError(null);
    resetAvatarPickerInput();
  }

  async function handleExplicitSave() {
    if (avatarEditorDraft) {
      setLocalError(labels.avatarEditorApplyBeforeSave);
      return;
    }

    const normalizedDraftDisplayName = draftDisplayName.trim();
    const normalizedPersistedDisplayName = defaultDisplayName.trim();
    const hasDisplayNameChanged =
      normalizedDraftDisplayName !== normalizedPersistedDisplayName;
    const hasAvatarDraftChange = Boolean(pendingAvatarDraft);
    const hasAvatarRemovalChange = isAvatarRemovalDraft;

    if (!hasDisplayNameChanged && !hasAvatarDraftChange && !hasAvatarRemovalChange) {
      resetEditingState();
      return;
    }

    const avatarDraftToUpload = pendingAvatarDraft;
    let uploadedAvatarObjectPath: string | null = null;

    setLocalError(null);
    setIsSavingProfile(true);

    if (avatarDraftToUpload) {
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
        setIsSavingProfile(false);
        return;
      }

      uploadedAvatarObjectPath = objectPath;
      setIsUploadingAvatar(false);
    }

    const formData = new FormData();
    formData.set('displayName', normalizedDraftDisplayName);

    if (uploadedAvatarObjectPath) {
      formData.set('avatarObjectPath', uploadedAvatarObjectPath);
    }

    if (isAvatarRemovalDraft && !uploadedAvatarObjectPath) {
      formData.set('removeAvatar', '1');
    }

    try {
      await updateProfileAction(formData);
    } finally {
      setIsUploadingAvatar(false);
      setIsSavingProfile(false);
    }
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
      setAvatarEditorDraft(nextDraft);
      setSelectedFileName(file.name);
      setIsAvatarRemovalDraft(false);
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
    pendingAvatarDraft?.previewUrl ?? (isAvatarRemovalDraft ? null : avatarPath ?? null);
  const visibleDisplayName = draftDisplayName.trim() || defaultDisplayName.trim();
  const avatarDraftNote = avatarEditorDraft
    ? labels.avatarEditorHint
    : pendingAvatarDraft
      ? labels.avatarEditorDraftReady
      : isAvatarRemovalDraft
        ? labels.profilePhotoEmpty
      : isEditing
        ? selectedFileName ?? labels.tapPhotoToChange
        : hasAvatar
          ? labels.profilePhotoCurrent
          : labels.profilePhotoEmpty;
  const hasPersistedAvatarWithoutDraft =
    hasAvatar &&
    !isAvatarRemovalDraft &&
    !avatarEditorDraft &&
    !pendingAvatarDraft;
  const editorMetrics = avatarEditorDraft
    ? getAvatarRenderMetrics(avatarEditorDraft)
    : null;
  const isBusy = isUploadingAvatar || isPreparingAvatar || isSavingProfile;

  return (
    <>
      {localError ? <p className="notice notice-error">{localError}</p> : null}

      <form
        className={
          isEditing
            ? 'stack profile-settings-form profile-settings-form-editing'
            : 'stack profile-settings-form'
        }
        onSubmit={(event) => {
          event.preventDefault();
        }}
      >
        <input
          ref={fileInputRef}
          className="sr-only"
          accept={PROFILE_AVATAR_ACCEPT}
          disabled={isBusy || !isEditing}
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
                  disabled={isBusy || Boolean(avatarEditorDraft)}
                  onClick={() => {
                    void handleExplicitSave();
                  }}
                  type="button"
                >
                  <span aria-hidden="true">✓</span>
                </button>
                <button
                  className="pill profile-inline-cancel"
                  disabled={isBusy}
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
                onClick={() => {
                  clearStatusQueryParams();
                  setIsEditing(true);
                }}
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
            disabled={!isEditing || isBusy}
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
                  disabled={isBusy}
                  maxLength={40}
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
                disabled={isBusy}
                onClick={() => {
                  clearPendingAvatarState();
                  setIsAvatarRemovalDraft(true);
                  setLocalError(null);
                }}
                type="button"
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

      </form>

      {isEditing && avatarEditorDraft && editorMetrics ? (
        <section
          aria-label={labels.profilePhoto}
          aria-modal="true"
          className="profile-avatar-editor-modal"
          role="dialog"
        >
          <button
            aria-hidden="true"
            className="profile-avatar-editor-backdrop"
            onClick={cancelAvatarEditor}
            tabIndex={-1}
            type="button"
          />

          <div className="profile-avatar-editor-panel">
            <div className="profile-avatar-editor-toolbar">
              <button
                aria-label={labels.cancelEdit}
                className="button button-secondary conversation-settings-back-link profile-avatar-editor-back"
                disabled={isPreparingAvatar || isUploadingAvatar}
                onClick={cancelAvatarEditor}
                type="button"
              >
                <span aria-hidden="true">←</span>
              </button>

              <div className="profile-avatar-editor-toolbar-spacer" />

              {avatarEditorDraft ? (
                <button
                  aria-label={labels.avatarEditorApply}
                  className="profile-inline-save profile-avatar-editor-confirm"
                  disabled={isPreparingAvatar || isUploadingAvatar}
                  onClick={async () => {
                    await applyCurrentAvatarDraft();
                  }}
                  type="button"
                >
                  <span aria-hidden="true">✓</span>
                </button>
              ) : null}
            </div>

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
                  <div className="profile-avatar-editor-crop-overlay" />
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

              <button
                className="button button-secondary button-compact profile-avatar-editor-replace"
                disabled={isPreparingAvatar || isUploadingAvatar}
                onClick={() => fileInputRef.current?.click()}
                type="button"
              >
                {labels.tapPhotoToChange}
              </button>
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}
