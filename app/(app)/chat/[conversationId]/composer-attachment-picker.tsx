'use client';

import { getTranslations, type AppLanguage } from '@/modules/i18n';
import { useEffect, useMemo, useRef, useState } from 'react';

type ComposerAttachmentPickerProps = {
  accept: string;
  helperText: string;
  maxSizeBytes: number;
  maxSizeLabel: string;
  language: AppLanguage;
};

type AttachmentPickerMode = 'camera' | 'file' | 'gallery';

function formatFileSize(value: number) {
  if (value < 1024 * 1024) {
    return `${Math.max(1, Math.round(value / 1024))} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileExtension(fileName: string) {
  const normalizedFileName = fileName.trim();

  if (!normalizedFileName) {
    return null;
  }

  const extensionIndex = normalizedFileName.lastIndexOf('.');

  if (extensionIndex < 0 || extensionIndex === normalizedFileName.length - 1) {
    return null;
  }

  return normalizedFileName.slice(extensionIndex).toLowerCase();
}

function matchesAcceptedFileType(input: {
  acceptedTypes: Set<string>;
  fileName: string;
  fileType: string;
  mode: AttachmentPickerMode;
}) {
  const normalizedFileType = input.fileType.trim().toLowerCase();
  const normalizedFileExtension = getFileExtension(input.fileName);

  if (!normalizedFileType) {
    return Boolean(
      normalizedFileExtension && input.acceptedTypes.has(normalizedFileExtension),
    );
  }

  if (input.mode === 'camera' || input.mode === 'gallery') {
    return (
      normalizedFileType.startsWith('image/') ||
      normalizedFileExtension === '.jpg' ||
      normalizedFileExtension === '.jpeg' ||
      normalizedFileExtension === '.png' ||
      normalizedFileExtension === '.webp' ||
      normalizedFileExtension === '.gif' ||
      normalizedFileExtension === '.heic' ||
      normalizedFileExtension === '.heif'
    );
  }

  return Array.from(input.acceptedTypes).some((acceptedType) => {
    const normalizedAcceptedType = acceptedType.trim().toLowerCase();

    if (!normalizedAcceptedType) {
      return false;
    }

    if (normalizedAcceptedType.startsWith('.')) {
      return normalizedFileExtension === normalizedAcceptedType;
    }

    if (normalizedAcceptedType.endsWith('/*')) {
      return normalizedFileType.startsWith(normalizedAcceptedType.slice(0, -1));
    }

    return normalizedAcceptedType === normalizedFileType;
  });
}

export function ComposerAttachmentPicker({
  accept,
  helperText,
  maxSizeBytes,
  maxSizeLabel,
  language,
}: ComposerAttachmentPickerProps) {
  const t = getTranslations(language);
  const detailsRef = useRef<HTMLDetailsElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const pickerModeRef = useRef<AttachmentPickerMode>('file');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const hasSelectedFile = Boolean(selectedFile);
  const acceptedTypes = useMemo(
    () =>
      new Set(
        accept
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
      ),
    [accept],
  );
  const isImage = selectedFile?.type.startsWith('image/') ?? false;
  const previewUrl = useMemo(() => {
    if (!selectedFile || !isImage) {
      return null;
    }

    return URL.createObjectURL(selectedFile);
  }, [isImage, selectedFile]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const clearSelection = () => {
    if (inputRef.current) {
      inputRef.current.value = '';
      inputRef.current.accept = accept;
      inputRef.current.removeAttribute('capture');
    }

    pickerModeRef.current = 'file';
    setSelectedFile(null);
    setErrorMessage(null);
  };

  const openPicker = (mode: AttachmentPickerMode) => {
    const input = inputRef.current;

    if (!input) {
      return;
    }

    pickerModeRef.current = mode;
    input.value = '';
    input.accept = mode === 'file' ? accept : 'image/*';

    if (mode === 'camera') {
      input.setAttribute('capture', 'environment');
    } else {
      input.removeAttribute('capture');
    }

    setErrorMessage(null);
    detailsRef.current?.removeAttribute('open');
    input.click();
  };

  return (
    <>
      {selectedFile ? (
        <div className="attachment-selected-card" aria-live="polite">
          {previewUrl ? (
            <span
              aria-hidden="true"
              className="attachment-selected-preview"
              style={{ backgroundImage: `url("${previewUrl}")` }}
            />
          ) : (
            <span aria-hidden="true" className="attachment-selected-file">
              {t.chat.file}
            </span>
          )}
          <span className="attachment-selected-copy">
            <span className="attachment-selected-name">{selectedFile.name}</span>
            <span className="attachment-selected-meta">
              {isImage ? t.chat.image : t.chat.file} · {formatFileSize(selectedFile.size)}
            </span>
          </span>
          <button
            className="attachment-selected-clear"
            type="button"
            onClick={clearSelection}
          >
            {t.chat.clearAttachment}
          </button>
        </div>
      ) : null}

      <details className="attachment-entry-details" ref={detailsRef}>
        <summary
          className={
            hasSelectedFile
              ? 'attachment-trigger attachment-trigger-selected'
              : 'attachment-trigger'
          }
          aria-label={t.chat.attachmentOptions}
        >
          +
        </summary>
        <div className="attachment-menu" role="menu" aria-label={t.chat.attachmentOptions}>
          <button
            className="attachment-option attachment-option-action"
            type="button"
            onClick={() => openPicker('gallery')}
          >
            <span>{t.chat.photoLibrary}</span>
            <span className="attachment-option-note">{maxSizeLabel}</span>
          </button>
          <button
            className="attachment-option attachment-option-action"
            type="button"
            onClick={() => openPicker('camera')}
          >
            <span>{t.chat.camera}</span>
            <span className="attachment-option-note">{maxSizeLabel}</span>
          </button>
          <button
            className="attachment-option attachment-option-action"
            type="button"
            onClick={() => openPicker('file')}
          >
            <span>{t.chat.file}</span>
            <span className="attachment-option-note">{maxSizeLabel}</span>
          </button>
        </div>
      </details>

      <input
        ref={inputRef}
        accept={accept}
        className="attachment-native-input"
        name="attachment"
        type="file"
        onChange={(event) => {
          const pickerMode = pickerModeRef.current;
          const nextFile = event.target.files?.[0];

          if (!nextFile) {
            return;
          }

          if (nextFile.size > maxSizeBytes) {
            if (inputRef.current) {
              inputRef.current.value = '';
            }

            setSelectedFile(null);
            setErrorMessage(t.chat.attachmentSizeError(maxSizeLabel));
            detailsRef.current?.removeAttribute('open');
            return;
          }

          if (
            !matchesAcceptedFileType({
              acceptedTypes,
              fileName: nextFile.name,
              fileType: nextFile.type,
              mode: pickerMode,
            })
          ) {
            if (inputRef.current) {
              inputRef.current.value = '';
            }

            setSelectedFile(null);
            setErrorMessage(helperText);
            detailsRef.current?.removeAttribute('open');
            return;
          }

          setSelectedFile(nextFile);
          setErrorMessage(null);
          if (inputRef.current) {
            inputRef.current.removeAttribute('capture');
            inputRef.current.accept = accept;
          }
          pickerModeRef.current = 'file';
          detailsRef.current?.removeAttribute('open');
        }}
      />

      {errorMessage ? (
        <p className="attachment-helper attachment-helper-error">{errorMessage}</p>
      ) : null}
    </>
  );
}
