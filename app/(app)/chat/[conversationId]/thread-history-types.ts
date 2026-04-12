'use client';

import type { StoredDmE2eeEnvelope } from '@/modules/messaging/contract/dm-e2ee';
import type { EncryptedDmServerHistoryHint } from '@/modules/messaging/e2ee/ui-policy';
import type { MessagingVoicePlaybackVariantRecord } from '@/modules/messaging/media/message-assets';
import type { AppLanguage } from '@/modules/i18n/client';

export type ConversationMessageRow = {
  body: string | null;
  client_id: string | null;
  content_mode?: string | null;
  conversation_id: string;
  created_at: string | null;
  deleted_at: string | null;
  edited_at: string | null;
  id: string;
  kind: string;
  reply_to_message_id: string | null;
  sender_device_id?: string | null;
  sender_id: string | null;
  seq: number | string;
};

export type MessageAttachment = {
  bucket?: string;
  createdAt?: string | null;
  durationMs?: number | null;
  fileName: string;
  id: string;
  isAudio: boolean;
  isImage: boolean;
  isVoiceMessage?: boolean;
  messageId?: string;
  mimeType?: string | null;
  objectPath?: string;
  signedUrl: string | null;
  sizeBytes: number | null;
  voicePlaybackVariants?: MessagingVoicePlaybackVariantRecord[] | null;
};

export type MessageReactionGroup = {
  count: number;
  emoji: string;
  selectedByCurrentUser: boolean;
};

export type MessageSenderProfile = {
  avatarPath?: string | null;
  displayName?: string | null;
  fullName?: string | null;
  id?: string | null;
  userId: string;
  username?: string | null;
};

export type ThreadHistoryPageSnapshot = {
  attachmentsByMessage: Array<{
    attachments: MessageAttachment[];
    messageId: string;
  }>;
  dmE2ee:
    | {
        activeDeviceCreatedAt: string | null;
        activeDeviceRecordId: string | null;
        envelopesByMessage: Array<{
          envelope: StoredDmE2eeEnvelope;
          messageId: string;
        }>;
        historyHintsByMessage: Array<{
          hint: EncryptedDmServerHistoryHint;
          messageId: string;
        }>;
        selectionSource: string | null;
      }
    | null;
  hasMoreOlder: boolean;
  messages: ConversationMessageRow[];
  oldestMessageSeq: number | null;
  reactionsByMessage: Array<{
    messageId: string;
    reactions: MessageReactionGroup[];
  }>;
  senderProfiles: MessageSenderProfile[];
};

export type ThreadHistoryState = {
  attachmentsByMessage: Map<string, MessageAttachment[]>;
  encryptedEnvelopesByMessage: Map<string, StoredDmE2eeEnvelope>;
  encryptedHistoryHintsByMessage: Map<string, EncryptedDmServerHistoryHint>;
  hasMoreOlder: boolean;
  loadedOlderPageCount: number;
  messages: ConversationMessageRow[];
  messagesById: Map<string, ConversationMessageRow>;
  oldestLoadedSeq: number | null;
  reactionsByMessage: Map<string, MessageReactionGroup[]>;
  senderProfilesById: Map<string, MessageSenderProfile>;
};

export type ThreadHistorySessionCacheEntry = {
  cachedAt: number;
  state: ThreadHistoryState;
};

export type ActiveImagePreview = {
  caption: string | null;
  signedUrl: string;
};

export type TimelineItem =
  | { key: string; label: string; type: 'separator' | 'unread' }
  | { key: string; message: ConversationMessageRow; type: 'message' };

export type TimelineLabels = {
  earlier: string;
  today: string;
  unreadMessages: string;
  yesterday: string;
};

export type TimelineRenderItem =
  | { key: string; label: string; type: 'separator' | 'unread' }
  | {
      compactHistoricalUnavailable: boolean;
      historicalUnavailableContinuationCount: number;
      isClusteredWithNext: boolean;
      isClusteredWithPrevious: boolean;
      key: string;
      message: ConversationMessageRow;
      type: 'message';
    };

export type EncryptedUnavailableRunMeta = {
  continuationCount: number;
  isContinuation: boolean;
};

export type ThreadHistoryViewportProps = {
  activeDeleteMessageId: string | null;
  activeEditMessageId: string | null;
  activeSpaceId: string;
  conversationId: string;
  conversationKind: 'dm' | 'group';
  currentReadMessageSeq: number | null;
  currentUserId: string;
  initialSnapshot: ThreadHistoryPageSnapshot;
  language: AppLanguage;
  latestVisibleMessageSeq: number | null;
  otherParticipantReadSeq: number | null;
  otherParticipantUserId: string | null;
  threadClientDiagnostics: import('./dm-thread-client-diagnostics').DmThreadClientDiagnostics;
};
