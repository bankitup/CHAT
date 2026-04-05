'use client';

import { useThreadMessagePatchedEditedAt } from '@/modules/messaging/realtime/thread-message-patch-store';

type ThreadEditedIndicatorProps = {
  conversationId: string;
  editedAt: string | null;
  label: string;
  messageId: string;
};

export function ThreadEditedIndicator({
  conversationId,
  editedAt,
  label,
  messageId,
}: ThreadEditedIndicatorProps) {
  const effectiveEditedAt = useThreadMessagePatchedEditedAt(
    conversationId,
    messageId,
    editedAt,
  );

  if (!effectiveEditedAt) {
    return null;
  }

  return (
    <span className="message-edited" aria-label={label}>
      {label}
    </span>
  );
}
