'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type ComposerAttachmentPickerProps = {
  accept: string;
  helperText: string;
  maxSizeBytes: number;
  maxSizeLabel: string;
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
}: ComposerAttachmentPickerProps) {
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
    <div
      className={
        hasSelectedFile
          ? 'attachment-entry attachment-entry-selected'
          : errorMessage
            ? 'attachment-entry attachment-entry-error'
            : 'attachment-entry'
      }
    >
      <div
        className={
          hasSelectedFile
            ? 'attachment-entry-row attachment-entry-row-selected'
            : 'attachment-entry-row'
        }
      >
        <details className="attachment-entry-details" ref={detailsRef}>
          <summary
            className={
              hasSelectedFile
                ? 'attachment-trigger attachment-trigger-selected'
                : 'attachment-trigger'
            }
            aria-label="Attachment options"
          >
            +
          </summary>
          <div className="attachment-menu" role="menu" aria-label="Attachment options">
            <button
              className="attachment-option attachment-option-action"
              type="button"
              onClick={() => inputRef.current?.click()}
            >
              <span>Photo or file</span>
              <span className="attachment-option-note">{maxSizeLabel}</span>
            </button>
            <button className="attachment-option" disabled type="button">
              <span>Camera</span>
              <span className="attachment-option-note">Soon</span>
            </button>
          </div>
        </details>

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
                File
              </span>
            )}
            <span className="attachment-selected-copy">
              <span className="attachment-selected-name">{selectedFile.name}</span>
              <span className="attachment-selected-meta">
                {isImage ? 'Image' : 'Attachment'} · {formatFileSize(selectedFile.size)}
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
              Clear
            </button>
          </div>
        ) : null}
      </div>

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
            setErrorMessage(`Choose a file up to ${maxSizeLabel.toLowerCase()}.`);
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
    </div>
  );
}
