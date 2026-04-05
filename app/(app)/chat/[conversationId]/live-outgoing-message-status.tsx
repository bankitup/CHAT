'use client';

import { useIsOtherParticipantPresent } from './conversation-presence-provider';
import { MessageStatusIndicator } from './message-status-indicator';

type LiveOutgoingMessageStatusProps = {
  labels: {
    delivered: string;
    seen: string;
    sent: string;
  };
  status: 'sent' | 'delivered' | 'seen';
};

export function LiveOutgoingMessageStatus({
  labels,
  status,
}: LiveOutgoingMessageStatusProps) {
  const isOtherParticipantPresent = useIsOtherParticipantPresent();

  const effectiveStatus =
    status === 'sent' && isOtherParticipantPresent ? 'delivered' : status;
  const label =
    effectiveStatus === 'seen'
      ? labels.seen
      : effectiveStatus === 'delivered'
        ? labels.delivered
        : labels.sent;

  return <MessageStatusIndicator label={label} status={effectiveStatus} />;
}
