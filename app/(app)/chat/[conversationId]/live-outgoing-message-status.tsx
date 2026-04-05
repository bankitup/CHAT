'use client';

import { useIsOtherParticipantPresent } from './conversation-presence-provider';
import { MessageStatusIndicator } from './message-status-indicator';
import { useThreadOtherParticipantReadSeq } from '@/modules/messaging/realtime/thread-live-state-store';

type LiveOutgoingMessageStatusProps = {
  conversationId: string;
  labels: {
    delivered: string;
    seen: string;
    sent: string;
  };
  messageSeq: number | string | null;
  otherParticipantReadSeq: number | null;
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
  conversationId,
  labels,
  messageSeq,
  otherParticipantReadSeq,
  status,
}: LiveOutgoingMessageStatusProps) {
  const isOtherParticipantPresent = useIsOtherParticipantPresent();
  const liveOtherParticipantReadSeq = useThreadOtherParticipantReadSeq(
    conversationId,
    otherParticipantReadSeq,
  );
  const normalizedStatus = normalizeOutgoingStatus(status);
  const comparableMessageSeq =
    typeof messageSeq === 'number'
      ? messageSeq
      : typeof messageSeq === 'string'
        ? Number(messageSeq)
        : null;
  const seenByReadState =
    normalizedStatus !== 'seen' &&
    comparableMessageSeq !== null &&
    Number.isFinite(comparableMessageSeq) &&
    liveOtherParticipantReadSeq !== null &&
    comparableMessageSeq <= liveOtherParticipantReadSeq;
  const baseStatus = seenByReadState ? 'seen' : normalizedStatus;

  const effectiveStatus =
    baseStatus === 'sent' && isOtherParticipantPresent
      ? 'delivered'
      : baseStatus;
  const label =
    effectiveStatus === 'seen'
      ? labels.seen
      : effectiveStatus === 'delivered'
        ? labels.delivered
        : labels.sent;

  return <MessageStatusIndicator label={label} status={effectiveStatus} />;
}
