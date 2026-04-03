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

function formatFileSize(value: number) {
  if (value < 1024 * 1024) {
    return `${Math.max(1, Math.round(value / 1024))} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
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
              {isImage ? t.chat.image : t.chat.attachment} · {formatFileSize(selectedFile.size)}
            </span>
          </span>
          <button
            className="attachment-selected-clear"
            type="button"
            onClick={() => {
              if (inputRef.current) {
                inputRef.current.value = '';
              }

              setSelectedFile(null);
              setErrorMessage(null);
            }}
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
            onClick={() => inputRef.current?.click()}
          >
            <span>{t.chat.photoOrFile}</span>
            <span className="attachment-option-note">{maxSizeLabel}</span>
          </button>
          <button className="attachment-option" disabled type="button">
            <span>{t.chat.camera}</span>
            <span className="attachment-option-note">{t.chat.soon}</span>
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
          const nextFile = event.target.files?.[0];

          if (!nextFile) {
            setSelectedFile(null);
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

          if (!acceptedTypes.has(nextFile.type)) {
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
          detailsRef.current?.removeAttribute('open');
        }}
      />

      {errorMessage ? (
        <p className="attachment-helper attachment-helper-error">{errorMessage}</p>
      ) : null}
    </>
  );
}
