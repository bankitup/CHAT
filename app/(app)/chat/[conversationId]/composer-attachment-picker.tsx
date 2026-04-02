'use client';

import { useRef, useState } from 'react';

type ComposerAttachmentPickerProps = {
  accept: string;
  maxSizeLabel: string;
};

export function ComposerAttachmentPicker({
  accept,
  maxSizeLabel,
}: ComposerAttachmentPickerProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const hasSelectedFile = Boolean(selectedFileName);

  return (
    <div
      className={
        hasSelectedFile
          ? 'attachment-entry attachment-entry-selected'
          : 'attachment-entry'
      }
    >
      <details className="attachment-entry-details">
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

      <input
        ref={inputRef}
        accept={accept}
        className="attachment-native-input"
        name="attachment"
        type="file"
        onChange={(event) => {
          const nextFile = event.target.files?.[0];
          setSelectedFileName(nextFile?.name ?? null);
        }}
      />

      {selectedFileName ? (
        <div className="attachment-selected-chip" aria-live="polite">
          <span aria-hidden="true" className="attachment-selected-indicator">
            •
          </span>
          <span className="attachment-selected-name">{selectedFileName}</span>
          <button
            className="attachment-selected-clear"
            type="button"
            onClick={() => {
              if (inputRef.current) {
                inputRef.current.value = '';
              }

              setSelectedFileName(null);
            }}
          >
            Clear
          </button>
        </div>
      ) : null}
    </div>
  );
}
