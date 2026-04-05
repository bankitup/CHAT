'use client';

import { useEffect } from 'react';

type ProgressiveHistoryLoaderProps = {
  conversationId: string;
  hasMoreOlder: boolean;
  idleLabel: string;
  isLoadingOlder: boolean;
  loadingLabel: string;
  onRequestOlder: () => void;
  targetId: string;
};

const LOAD_OLDER_THRESHOLD_PX = 180;

export function ProgressiveHistoryLoader({
  conversationId,
  hasMoreOlder,
  idleLabel,
  isLoadingOlder,
  loadingLabel,
  onRequestOlder,
  targetId,
}: ProgressiveHistoryLoaderProps) {
  useEffect(() => {
    const target =
      typeof document === 'undefined'
        ? null
        : document.getElementById(targetId);

    if (!target) {
      return;
    }

    const maybeLoadOlder = () => {
      if (
        !hasMoreOlder ||
        isLoadingOlder ||
        target.scrollTop > LOAD_OLDER_THRESHOLD_PX
      ) {
        return;
      }

      onRequestOlder();
    };

    target.addEventListener('scroll', maybeLoadOlder, { passive: true });

    return () => {
      target.removeEventListener('scroll', maybeLoadOlder);
    };
  }, [
    hasMoreOlder,
    isLoadingOlder,
    onRequestOlder,
    targetId,
  ]);

  if (!hasMoreOlder && !isLoadingOlder) {
    return null;
  }

  return (
    <div
      aria-live="polite"
      className="message-history-loader"
      data-conversation-id={conversationId}
    >
      {isLoadingOlder ? (
        <span className="message-history-loader-label">
          {loadingLabel}
        </span>
      ) : (
        <span className="sr-only">{idleLabel}</span>
      )}
    </div>
  );
}
