'use client';

import { useSyncExternalStore } from 'react';
import { resolveEncryptedDmInboxPreview } from '@/modules/messaging/e2ee/inbox-policy';
import { readLocalEncryptedDmPreview } from '@/modules/messaging/e2ee/preview-cache';
import { EncryptedDmPreviewLifecycle } from './encrypted-dm-preview-lifecycle';

type EncryptedDmInboxPreviewProps = {
  className: string;
  conversationId: string;
  currentUserId: string;
  fallbackPreview: string | null;
  latestMessageContentMode: string | null;
  latestMessageDeletedAt: string | null;
  latestMessageId: string | null;
};

export function EncryptedDmInboxPreview({
  className,
  conversationId,
  currentUserId,
  fallbackPreview,
  latestMessageContentMode,
  latestMessageDeletedAt,
  latestMessageId,
}: EncryptedDmInboxPreviewProps) {
  const previewText = useSyncExternalStore(
    () => () => undefined,
    () => {
      return resolveEncryptedDmInboxPreview({
        conversationId,
        fallbackPreview,
        latestMessageContentMode,
        latestMessageId,
        cachedPreview: readLocalEncryptedDmPreview(
          currentUserId,
          conversationId,
        ),
      });
    },
    () => fallbackPreview,
  );

  if (!previewText) {
    return (
      <EncryptedDmPreviewLifecycle
        conversationId={conversationId}
        currentUserId={currentUserId}
        latestMessageContentMode={latestMessageContentMode}
        latestMessageDeletedAt={latestMessageDeletedAt}
        latestMessageId={latestMessageId}
      />
    );
  }

  return (
    <>
      <EncryptedDmPreviewLifecycle
        conversationId={conversationId}
        currentUserId={currentUserId}
        latestMessageContentMode={latestMessageContentMode}
        latestMessageDeletedAt={latestMessageDeletedAt}
        latestMessageId={latestMessageId}
      />
      <p className={className}>{previewText}</p>
    </>
  );
}
