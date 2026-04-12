'use client';

import { createPortal } from 'react-dom';
import { useEffect } from 'react';

type ActiveImagePreview = {
  caption: string | null;
  signedUrl: string;
};

type ThreadImagePreviewOverlayProps = {
  closeLabel: string;
  fallbackTitle: string;
  onClose: () => void;
  preview: ActiveImagePreview | null;
};

function normalizePreviewText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed || null;
}

function normalizePreviewUrl(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed || null;
}

export function ThreadImagePreviewOverlay({
  closeLabel,
  fallbackTitle,
  onClose,
  preview,
}: ThreadImagePreviewOverlayProps) {
  const portalRoot = typeof document !== 'undefined' ? document.body : null;
  const previewCaption = normalizePreviewText(preview?.caption ?? null);
  const previewTitle = previewCaption ?? fallbackTitle;
  const previewSignedUrl = normalizePreviewUrl(preview?.signedUrl ?? null);

  useEffect(() => {
    if (!preview || !previewSignedUrl) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, preview, previewSignedUrl]);

  if (!preview || !previewSignedUrl || !portalRoot) {
    return null;
  }

  return createPortal(
    <div
      aria-label={previewTitle}
      aria-modal="true"
      className="chat-image-preview-overlay"
      data-state="open"
      onClick={onClose}
      role="dialog"
    >
      <div
        className="chat-image-preview-shell"
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <button
          aria-label={closeLabel}
          className="chat-image-preview-close"
          onClick={onClose}
          type="button"
        >
          <span aria-hidden="true">×</span>
        </button>

        <div className="chat-image-preview-stage">
          <figure className="chat-image-preview-frame">
            {/* Signed preview URLs and direct image semantics are intentional here. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt={previewTitle}
              className="chat-image-preview-image"
              src={previewSignedUrl}
            />
            {previewCaption ? (
              <figcaption className="chat-image-preview-caption">
                {previewCaption}
              </figcaption>
            ) : null}
          </figure>
        </div>
      </div>
    </div>,
    portalRoot,
  );
}
