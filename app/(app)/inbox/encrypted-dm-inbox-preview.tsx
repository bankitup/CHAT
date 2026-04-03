'use client';

import { useSyncExternalStore } from 'react';
import { readLocalEncryptedDmPreview } from '@/modules/messaging/e2ee/preview-cache';

type EncryptedDmInboxPreviewProps = {
  className: string;
  conversationId: string;
  fallbackPreview: string | null;
  latestMessageContentMode: string | null;
  latestMessageId: string | null;
};

export function EncryptedDmInboxPreview({
  className,
  conversationId,
  fallbackPreview,
  latestMessageContentMode,
  latestMessageId,
}: EncryptedDmInboxPreviewProps) {
  const previewText = useSyncExternalStore(
    () => () => undefined,
    () => {
      if (
        latestMessageContentMode !== 'dm_e2ee_v1' ||
        !latestMessageId ||
        !conversationId
      ) {
        return fallbackPreview;
      }

      const cachedPreview = readLocalEncryptedDmPreview(conversationId);

      if (cachedPreview && cachedPreview.messageId === latestMessageId) {
        return cachedPreview.snippet;
      }

      return fallbackPreview;
    },
    () => fallbackPreview,
  );

  if (!previewText) {
    return null;
  }

  return <p className={className}>{previewText}</p>;
}
