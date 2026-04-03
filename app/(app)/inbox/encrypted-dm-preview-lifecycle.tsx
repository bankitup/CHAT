'use client';

import { useEffect } from 'react';
import { invalidateEncryptedDmPreviewForConversation } from '@/modules/messaging/e2ee/lifecycle';

export function EncryptedDmPreviewLifecycle({
  conversationId,
  currentUserId,
  latestMessageContentMode,
  latestMessageDeletedAt,
  latestMessageId,
}: {
  conversationId: string;
  currentUserId: string;
  latestMessageContentMode: string | null;
  latestMessageDeletedAt: string | null;
  latestMessageId: string | null;
}) {
  useEffect(() => {
    if (
      !latestMessageId ||
      latestMessageDeletedAt ||
      latestMessageContentMode !== 'dm_e2ee_v1'
    ) {
      invalidateEncryptedDmPreviewForConversation(
        currentUserId,
        conversationId,
      );
    }
  }, [
    conversationId,
    currentUserId,
    latestMessageContentMode,
    latestMessageDeletedAt,
    latestMessageId,
  ]);

  return null;
}
