'use client';

import NextImage from 'next/image';
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

const AVATAR_EDITOR_PREVIEW_SIZE = 236;
const AVATAR_EDITOR_OUTPUT_SIZE = 512;
const AVATAR_EDITOR_MIN_ZOOM = 1;
const AVATAR_EDITOR_MAX_ZOOM = 3;
const AVATAR_EDITOR_ZOOM_STEP = 0.01;

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
    tapPhotoToChange: string;
    avatarEditorHint: string;
    avatarEditorZoom: string;
    avatarEditorApply: string;
    avatarEditorPreparing: string;
    avatarEditorLoadFailed: string;
    avatarEditorApplyBeforeSave: string;
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
  file: File;
  previewUrl: string;
};

function revokeObjectUrl(value: string | null) {
  if (value) {
    URL.revokeObjectURL(value);
  }
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
  const latestEditorSourceUrlRef = useRef<string | null>(null);
  const dragStateRef = useRef<{
    originX: number;
    originY: number;
    pointerId: number;
    startX: number;
    startY: number;
  } | null>(null);
  const [draftTitle, setDraftTitle] = useState(defaultTitle);
  const [draftJoinPolicy, setDraftJoinPolicy] =
    useState<GroupConversationJoinPolicy>(defaultJoinPolicy);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [avatarEditorDraft, setAvatarEditorDraft] =
    useState<AvatarEditorDraft | null>(null);
  const [pendingAvatarDraft, setPendingAvatarDraft] =
    useState<PendingAvatarDraft | null>(null);
  const [isAvatarRemovalDraft, setIsAvatarRemovalDraft] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isPreparingAvatar, setIsPreparingAvatar] = useState(false);
  const lastAppliedDefaultsRef = useRef<string>(
    `${defaultTitle}\u0000${defaultJoinPolicy}\u0000${defaultAvatarPath ?? ''}`,
  );

  const resetAvatarPickerInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  useEffect(() => {
    latestPreviewUrlRef.current = pendingAvatarDraft?.previewUrl ?? null;
  }, [pendingAvatarDraft?.previewUrl]);

  useEffect(() => {
    latestEditorSourceUrlRef.current = avatarEditorDraft?.sourceUrl ?? null;
  }, [avatarEditorDraft?.sourceUrl]);

  useEffect(() => {
    return () => {
      revokeObjectUrl(latestPreviewUrlRef.current);
      revokeObjectUrl(latestEditorSourceUrlRef.current);
    };
  }, []);

  useEffect(() => {
    const nextDefaultsSignature = `${defaultTitle}\u0000${defaultJoinPolicy}\u0000${
      defaultAvatarPath ?? ''
    }`;

    if (lastAppliedDefaultsRef.current === nextDefaultsSignature) {
      return;
    }

    lastAppliedDefaultsRef.current = nextDefaultsSignature;
    revokeObjectUrl(avatarEditorDraft?.sourceUrl ?? null);
    revokeObjectUrl(pendingAvatarDraft?.previewUrl ?? null);
    setDraftTitle(defaultTitle);
    setDraftJoinPolicy(defaultJoinPolicy);
    setAvatarEditorDraft(null);
    setPendingAvatarDraft(null);
    setSelectedFileName(null);
    setIsAvatarRemovalDraft(false);
    setLocalError(null);
    setIsSaving(false);
    setIsPreparingAvatar(false);
    resetAvatarPickerInput();
  }, [
    avatarEditorDraft?.sourceUrl,
    defaultAvatarPath,
    defaultJoinPolicy,
    defaultTitle,
    pendingAvatarDraft?.previewUrl,
  ]);

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
    revokeObjectUrl(avatarEditorDraft?.sourceUrl ?? null);
    revokeObjectUrl(pendingAvatarDraft?.previewUrl ?? null);
    setAvatarEditorDraft(null);
    setPendingAvatarDraft(null);
    setSelectedFileName(null);
    setIsAvatarRemovalDraft(false);
    setLocalError(null);
    setIsPreparingAvatar(false);
    resetAvatarPickerInput();

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

  async function applyCurrentAvatarDraft() {
    if (!avatarEditorDraft) {
      return pendingAvatarDraft;
    }

    setIsPreparingAvatar(true);

    try {
      const blob = await renderAvatarCropBlob(avatarEditorDraft);
      const fileBaseName = avatarEditorDraft.fileName.replace(/\.[a-z0-9]+$/i, '') || 'avatar';
      const croppedFile = new File(
        [blob],
        `${fileBaseName}.png`,
        { type: 'image/png' },
      );
      const previewUrl = URL.createObjectURL(blob);
      const nextPendingDraft = {
        file: croppedFile,
        previewUrl,
      } satisfies PendingAvatarDraft;

      revokeObjectUrl(pendingAvatarDraft?.previewUrl ?? null);
      setPendingAvatarDraft(nextPendingDraft);
      setSelectedFileName(croppedFile.name);
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
    setSelectedFileName(pendingAvatarDraft?.file.name ?? null);
    setLocalError(null);

    resetAvatarPickerInput();
  }

  function handleAvatarEditorPointerDown(
    event: React.PointerEvent<HTMLDivElement>,
  ) {
    if (!avatarEditorDraft || isPreparingAvatar || isSaving) {
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

  async function handleSave() {
    if (isSaving) {
      return;
    }

    const normalizedDraftTitle = draftTitle.trim();
    const normalizedDefaultTitle = defaultTitle.trim();
    const hasTitleChange = normalizedDraftTitle !== normalizedDefaultTitle;
    const hasJoinPolicyChange = draftJoinPolicy !== defaultJoinPolicy;
    const hasAvatarChange = Boolean(pendingAvatarDraft) || isAvatarRemovalDraft;

    if (!hasTitleChange && !hasJoinPolicyChange && !hasAvatarChange) {
      return;
    }

    if (avatarEditorDraft) {
      setLocalError(labels.avatarEditorApplyBeforeSave);
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

    if (pendingAvatarDraft) {
      formData.set('avatar', pendingAvatarDraft.file);
    }

    if (isAvatarRemovalDraft && !pendingAvatarDraft) {
      formData.set('removeAvatar', '1');
    }

    try {
      await updateConversationIdentityAction(formData);
    } finally {
      setIsSaving(false);
    }
  }

  const visibleAvatarPath =
    pendingAvatarDraft?.previewUrl ?? (isAvatarRemovalDraft ? null : defaultAvatarPath ?? null);
  const draftNote = avatarEditorDraft
    ? labels.avatarEditorHint
    : pendingAvatarDraft
      ? labels.avatarDraftReady
    : isAvatarRemovalDraft
      ? labels.avatarRemovedDraft
      : selectedFileName
        ? selectedFileName
        : labels.subtitle;
  const editorMetrics = avatarEditorDraft
    ? getAvatarRenderMetrics(avatarEditorDraft)
    : null;
  const isBusy = isSaving || isPreparingAvatar;
  const normalizedDraftTitle = draftTitle.trim();
  const hasUnsavedChanges =
    normalizedDraftTitle !== defaultTitle.trim() ||
    draftJoinPolicy !== defaultJoinPolicy ||
    Boolean(pendingAvatarDraft) ||
    isAvatarRemovalDraft;
  const helperNote = isSaving
    ? labels.avatarUploading
    : isPreparingAvatar
      ? labels.avatarEditorPreparing
      : draftNote;

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

          <div className="conversation-group-identity-actions conversation-group-identity-photo-actions">
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

            {(defaultAvatarPath || pendingAvatarDraft) && !isAvatarRemovalDraft ? (
              <button
                className="button button-secondary button-compact"
                disabled={isBusy}
                onClick={() => {
                  clearStatusQueryParams();
                  if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                  }
                  revokeObjectUrl(avatarEditorDraft?.sourceUrl ?? null);
                  revokeObjectUrl(pendingAvatarDraft?.previewUrl ?? null);
                  setAvatarEditorDraft(null);
                  setPendingAvatarDraft(null);
                  setSelectedFileName(null);
                  setIsAvatarRemovalDraft(true);
                  setLocalError(null);
                }}
                type="button"
              >
                {labels.removePhoto}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="conversation-group-identity-savebar">
        <div className="conversation-group-identity-savebar-shell">
          <p className="muted conversation-settings-note conversation-group-identity-savebar-note">
            {helperNote}
          </p>

          <div className="conversation-group-identity-savebar-actions">
            <button
              className="pill conversation-group-identity-cancel"
              disabled={isBusy || !hasUnsavedChanges}
              onClick={resetDraftState}
              type="button"
            >
              {labels.cancelEdit}
            </button>

            <button
              className="button button-compact conversation-group-identity-save"
              disabled={isBusy || !hasUnsavedChanges || Boolean(avatarEditorDraft)}
              onClick={() => {
                void handleSave();
              }}
              type="button"
            >
              {isSaving ? labels.avatarUploading : labels.saveChanges}
            </button>
          </div>
        </div>
      </div>

      {avatarEditorDraft && editorMetrics ? (
        <section
          aria-label={labels.changePhoto}
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
                disabled={isPreparingAvatar || isSaving}
                onClick={cancelAvatarEditor}
                type="button"
              >
                <span aria-hidden="true">←</span>
              </button>

              <div className="profile-avatar-editor-toolbar-spacer" />

              <button
                aria-label={labels.avatarEditorApply}
                className="profile-inline-save profile-avatar-editor-confirm"
                disabled={isPreparingAvatar || isSaving}
                onClick={async () => {
                  await applyCurrentAvatarDraft();
                }}
                type="button"
              >
                <span aria-hidden="true">✓</span>
              </button>
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
                  disabled={isPreparingAvatar || isSaving}
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
                disabled={isPreparingAvatar || isSaving}
                onClick={() => fileInputRef.current?.click()}
                type="button"
              >
                {labels.tapPhotoToChange}
              </button>
            </div>
          </div>
        </section>
      ) : null}
    </section>
  );
}
