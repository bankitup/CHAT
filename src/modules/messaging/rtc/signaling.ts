import type {
  MessagingCallParticipantRecord,
  MessagingCallSessionKind,
  MessagingCallSessionRecord,
  MessagingCallSessionStatus,
} from './types';

export type MessagingCallSignalEventKind =
  | 'invite'
  | 'ring'
  | 'accept'
  | 'decline'
  | 'offer'
  | 'answer'
  | 'ice-candidate'
  | 'mute-updated'
  | 'hangup'
  | 'connection-state';

export type MessagingCallSignalEventRecord = {
  createdAt: string;
  eventId: string;
  kind: MessagingCallSignalEventKind;
  payload: Record<string, unknown> | null;
  sessionId: string;
  userId: string;
};

export type MessagingCallInviteIntent = {
  conversationId: string;
  currentUserId: string;
  kind: MessagingCallSessionKind;
};

export type MessagingCallSessionSnapshot = {
  participants: MessagingCallParticipantRecord[];
  recentSignals: MessagingCallSignalEventRecord[];
  session: MessagingCallSessionRecord;
};

export type MessagingCallSignalingStore = {
  appendSignal(
    event: MessagingCallSignalEventRecord,
  ): Promise<MessagingCallSignalEventRecord>;
  getActiveSession(
    conversationId: string,
  ): Promise<MessagingCallSessionSnapshot | null>;
  startSession(
    intent: MessagingCallInviteIntent,
  ): Promise<MessagingCallSessionSnapshot>;
  subscribe(
    conversationId: string,
    listener: (snapshot: MessagingCallSessionSnapshot | null) => void,
  ): () => void;
  updateSessionStatus(input: {
    endedReason?: string | null;
    sessionId: string;
    status: MessagingCallSessionStatus;
  }): Promise<void>;
};
