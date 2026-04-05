export type MessagingCallSessionKind = 'voice';

export type MessagingCallSessionStatus =
  | 'preflight'
  | 'ringing'
  | 'connecting'
  | 'active'
  | 'ended'
  | 'failed'
  | 'cancelled';

export type MessagingCallParticipantState =
  | 'invited'
  | 'ringing'
  | 'connecting'
  | 'joined'
  | 'left'
  | 'declined'
  | 'failed';

export type MessagingCallEndReason =
  | 'completed'
  | 'declined'
  | 'missed'
  | 'hangup'
  | 'network-failed'
  | 'permission-denied'
  | 'signaling-timeout'
  | 'unknown';

export type MessagingCallSessionRecord = {
  conversationId: string;
  createdAt: string;
  endedAt: string | null;
  endedReason: MessagingCallEndReason | null;
  initiatorUserId: string;
  sessionId: string;
  status: MessagingCallSessionStatus;
  updatedAt: string;
};

export type MessagingCallParticipantRecord = {
  joinedAt: string | null;
  leftAt: string | null;
  muted: boolean;
  sessionId: string;
  state: MessagingCallParticipantState;
  updatedAt: string;
  userId: string;
};

export function isMessagingCallSessionTerminal(
  status: MessagingCallSessionStatus,
) {
  return status === 'ended' || status === 'failed' || status === 'cancelled';
}

export function isMessagingCallParticipantActive(
  state: MessagingCallParticipantState,
) {
  return state === 'connecting' || state === 'joined';
}
