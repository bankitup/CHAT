import 'server-only';

import type { AppLanguage } from '@/modules/i18n';
import {
  getArchivedConversations,
  getConversationDisplayName,
  getConversationParticipantIdentities,
  getDirectMessageDisplayName,
  getInboxConversationsStable,
  type InboxConversation,
} from '@/modules/messaging/data/server';
import { getInboxPreviewText } from '@/modules/messaging/e2ee/inbox-policy';
import type { InboxConversationLiveSummary } from '@/modules/messaging/realtime/inbox-summary-store';
import { resolvePublicIdentityLabel } from '@/modules/profile/ui/identity-label';

type MessagingOperationalParticipantIdentity = Awaited<
  ReturnType<typeof getConversationParticipantIdentities>
>[number];

type MessagingOperationalPreviewLabels = {
  attachment: string;
  audio: string;
  deletedMessage: string;
  encryptedMessage: string;
  file: string;
  image: string;
  newEncryptedMessage: string;
  voiceMessage: string;
};

export type MessagingOperationalActivityLabels =
  MessagingOperationalPreviewLabels & {
    unknownUser: string;
  };

export type MessagingOperationalActivityItem = {
  conversationId: string;
  groupAvatarPath: string | null;
  isGroupConversation: boolean;
  lastActivityAt: string | null;
  preview: string | null;
  primaryParticipant:
    | {
        avatarPath?: string | null;
        displayName: string | null;
        userId: string;
      }
    | null;
  title: string;
  unreadCount: number;
};

export type MessagingOperationalActivityFeed = {
  activityItems: MessagingOperationalActivityItem[];
  archivedConversationCount: number;
  conversationIds: string[];
  initialSummaries: InboxConversationLiveSummary[];
};

function buildOperationalFallbackTitles(language: AppLanguage) {
  return language === 'ru'
    ? {
        dm: 'Новый чат',
        group: 'Новая группа',
      }
    : {
        dm: 'New chat',
        group: 'New group',
      };
}

function mapInboxConversationToLiveSummary(
  conversation: InboxConversation,
): InboxConversationLiveSummary {
  return {
    conversationId: conversation.conversationId,
    createdAt: conversation.createdAt,
    hiddenAt: conversation.hiddenAt,
    lastMessageAt: conversation.lastMessageAt,
    lastReadAt: conversation.lastReadAt,
    lastReadMessageSeq: conversation.lastReadMessageSeq,
    latestMessageAttachmentKind: conversation.latestMessageAttachmentKind,
    latestMessageBody: conversation.latestMessageBody,
    latestMessageContentMode: conversation.latestMessageContentMode,
    latestMessageDeletedAt: conversation.latestMessageDeletedAt,
    latestMessageId: conversation.latestMessageId,
    latestMessageKind: conversation.latestMessageKind,
    latestMessageSenderId: conversation.latestMessageSenderId,
    latestMessageSeq: conversation.latestMessageSeq,
    unreadCount: conversation.unreadCount,
  };
}

function getOperationalOtherParticipants(input: {
  conversationId: string;
  identitiesByConversation: Map<string, MessagingOperationalParticipantIdentity[]>;
  userId: string;
}) {
  const participantOptions =
    input.identitiesByConversation.get(input.conversationId) ?? [];

  return participantOptions.filter((participant) => participant.userId !== input.userId);
}

/**
 * Product-neutral operational activity feed seam for non-Messenger consumers.
 *
 * This owns title/preview/participant shaping so integrations do not need to
 * depend directly on broad inbox queries plus UI label helpers.
 */
export async function getMessagingOperationalActivityFeedForUser(input: {
  labels: MessagingOperationalActivityLabels;
  language: AppLanguage;
  spaceId: string;
  userId: string;
}): Promise<MessagingOperationalActivityFeed> {
  const [conversations, archivedConversations] = await Promise.all([
    getInboxConversationsStable(input.userId, { spaceId: input.spaceId }),
    getArchivedConversations(input.userId, { spaceId: input.spaceId }),
  ]);
  const conversationIds = conversations.map(
    (conversation) => conversation.conversationId,
  );
  const participantIdentities =
    conversationIds.length > 0
      ? await getConversationParticipantIdentities(conversationIds)
      : [];
  const identitiesByConversation = participantIdentities.reduce(
    (map, identity) => {
      const existing = map.get(identity.conversationId) ?? [];
      existing.push(identity);
      map.set(identity.conversationId, existing);
      return map;
    },
    new Map<string, MessagingOperationalParticipantIdentity[]>(),
  );

  const activityItems = conversations
    .map((conversation) => {
      const otherParticipants = getOperationalOtherParticipants({
        conversationId: conversation.conversationId,
        identitiesByConversation,
        userId: input.userId,
      });
      const otherParticipantLabels = otherParticipants.map((participant) =>
        resolvePublicIdentityLabel(participant, input.labels.unknownUser),
      );
      const isGroupConversation = conversation.kind === 'group';
      const title = isGroupConversation
        ? getConversationDisplayName({
            fallbackTitles: buildOperationalFallbackTitles(input.language),
            kind: conversation.kind ?? null,
            participantLabels: otherParticipantLabels,
            title: conversation.title,
          })
        : getDirectMessageDisplayName(
            otherParticipantLabels,
            input.labels.unknownUser,
          );

      return {
        conversationId: conversation.conversationId,
        groupAvatarPath: conversation.avatarPath,
        isGroupConversation,
        lastActivityAt: conversation.lastMessageAt ?? conversation.createdAt,
        preview: getInboxPreviewText(conversation, {
          attachment: input.labels.attachment,
          audio: input.labels.audio,
          deletedMessage: input.labels.deletedMessage,
          encryptedMessage: input.labels.encryptedMessage,
          file: input.labels.file,
          image: input.labels.image,
          newEncryptedMessage: input.labels.newEncryptedMessage,
          voiceMessage: input.labels.voiceMessage,
        }),
        primaryParticipant: otherParticipants[0] ?? null,
        title,
        unreadCount: conversation.unreadCount,
      } satisfies MessagingOperationalActivityItem;
    })
    .sort((left, right) => {
      const leftValue = left.lastActivityAt ? new Date(left.lastActivityAt).getTime() : 0;
      const rightValue = right.lastActivityAt ? new Date(right.lastActivityAt).getTime() : 0;
      return rightValue - leftValue;
    });

  return {
    activityItems,
    archivedConversationCount: archivedConversations.length,
    conversationIds,
    initialSummaries: conversations.map(mapInboxConversationToLiveSummary),
  };
}
