'use client';

import { useIsOtherParticipantPresent } from './conversation-presence-provider';
import { MessageStatusIndicator } from './message-status-indicator';

type LiveOutgoingMessageStatusProps = {
  labels: {
    delivered: string;
    seen: string;
    sent: string;
  };
  status: 'sent' | 'delivered' | 'seen' | null | undefined | string;
};

function normalizeOutgoingStatus(
  status: LiveOutgoingMessageStatusProps['status'],
) {
  if (status === 'seen' || status === 'delivered') {
    return status;
  }

  return 'sent' as const;
}

export function LiveOutgoingMessageStatus({
  labels,
  status,
}: LiveOutgoingMessageStatusProps) {
  const isOtherParticipantPresent = useIsOtherParticipantPresent();
  const normalizedStatus = normalizeOutgoingStatus(status);

  const effectiveStatus =
    normalizedStatus === 'sent' && isOtherParticipantPresent
      ? 'delivered'
      : normalizedStatus;
  const label =
    effectiveStatus === 'seen'
      ? labels.seen
      : effectiveStatus === 'delivered'
        ? labels.delivered
        : labels.sent;

  return <MessageStatusIndicator label={label} status={effectiveStatus} />;
}
