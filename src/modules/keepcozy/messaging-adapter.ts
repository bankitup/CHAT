import 'server-only';

import { redirect } from 'next/navigation';
import { getRequestViewer } from '@/lib/request-context/server';
import { getTranslations, type AppLanguage } from '@/modules/i18n';
import { getRequestLanguage } from '@/modules/i18n/server';
import {
  KEEP_COZY_ROLE_LAYER_TRANSLATION_DRAFT,
  type KeepCozyRoleLayerTranslationDraft,
  type KeepCozySpaceRole,
} from '@/modules/keepcozy/contract-types';
import { getInboxPreviewText } from '@/modules/messaging/e2ee/inbox-policy';
import {
  type ConversationOperationalThreadContext,
  getConversationOperationalThreadContextForUser,
} from '@/modules/messaging/data/conversation-thread-context';
import {
  getArchivedConversations,
  getConversationDisplayName,
  getConversationParticipantIdentities,
  getDirectMessageDisplayName,
  getInboxConversationsStable,
  type InboxConversation,
} from '@/modules/messaging/data/server';
import type { InboxConversationLiveSummary } from '@/modules/messaging/realtime/inbox-summary-store';
import { resolvePublicIdentityLabel } from '@/modules/messaging/ui/identity-label';
import type { SpaceProfile } from '@/modules/spaces/model';
import {
  isSpaceMembersSchemaCacheErrorMessage,
  resolveActiveSpaceForUser,
  resolveV1TestSpaceFallback,
} from '@/modules/spaces/server';

type KeepCozyMessagingViewer = NonNullable<
  Awaited<ReturnType<typeof getRequestViewer>>
>;

type KeepCozyMessagingParticipantIdentity = Awaited<
  ReturnType<typeof getConversationParticipantIdentities>
>[number];

type KeepCozyMessagingPreviewLabels = {
  attachment: string;
  audio: string;
  deletedMessage: string;
  encryptedMessage: string;
  file: string;
  image: string;
  newEncryptedMessage: string;
  voiceMessage: string;
};

export type KeepCozyMessagingActivityLabels = KeepCozyMessagingPreviewLabels & {
  unknownUser: string;
};

export type KeepCozyMessagingActivityItem = {
  conversationId: string;
  groupAvatarPath: string | null;
  isGroupConversation: boolean;
  lastActivityAt: string | null;
  preview: string | null;
  primaryParticipant:
    | {
        userId: string;
        displayName: string | null;
        avatarPath?: string | null;
      }
    | null;
  title: string;
  unreadCount: number;
};

export type KeepCozyMessagingActivityFeed = {
  activityItems: KeepCozyMessagingActivityItem[];
  archivedConversationCount: number;
  conversationIds: string[];
  initialSummaries: InboxConversationLiveSummary[];
};

export type KeepCozyMessagingSpaceContext = {
  activeSpace: {
    id: string;
    name: string;
    profile: SpaceProfile;
  };
  language: AppLanguage;
  t: ReturnType<typeof getTranslations>;
  user: KeepCozyMessagingViewer;
};

function buildKeepCozyMessagingFallbackTitles(language: AppLanguage) {
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

function getKeepCozyMessagingOtherParticipants(input: {
  conversationId: string;
  identitiesByConversation: Map<string, KeepCozyMessagingParticipantIdentity[]>;
  userId: string;
}) {
  const participantOptions =
    input.identitiesByConversation.get(input.conversationId) ?? [];

  return participantOptions.filter((participant) => participant.userId !== input.userId);
}

export function mapKeepCozyActorToMessagingParticipant(
  keepCozySpaceRole: KeepCozySpaceRole | null | undefined,
): KeepCozyRoleLayerTranslationDraft | null {
  if (!keepCozySpaceRole) {
    return null;
  }

  return KEEP_COZY_ROLE_LAYER_TRANSLATION_DRAFT[keepCozySpaceRole] ?? null;
}

export async function getKeepCozyLinkedThreadContextForUser(input: {
  conversationId: string;
  spaceId?: string | null;
  userId: string;
}): Promise<ConversationOperationalThreadContext | null> {
  return getConversationOperationalThreadContextForUser(
    input.conversationId,
    input.userId,
    {
      spaceId: input.spaceId,
    },
  );
}

export async function requireKeepCozyMessagingSpaceContext(
  requestedSpaceId?: string,
): Promise<KeepCozyMessagingSpaceContext> {
  const [user, language] = await Promise.all([
    getRequestViewer(),
    getRequestLanguage(),
  ]);

  if (!user?.id) {
    redirect('/login');
  }

  const explicitV1TestSpace = await resolveV1TestSpaceFallback({
    requestedSpaceId,
    source: 'keepcozy-messaging-adapter-explicit-v1-test-bypass',
  });

  if (explicitV1TestSpace) {
    return {
      activeSpace: {
        id: explicitV1TestSpace.id,
        name: explicitV1TestSpace.name,
        profile: 'keepcozy_ops',
      },
      language,
      t: getTranslations(language),
      user,
    };
  }

  try {
    const activeSpaceState = await resolveActiveSpaceForUser({
      requestedSpaceId,
      source: 'keepcozy-messaging-adapter',
      userEmail: user.email ?? null,
      userId: user.id,
    });

    if (!activeSpaceState.activeSpace || activeSpaceState.requestedSpaceWasInvalid) {
      redirect('/spaces');
    }

    return {
      activeSpace: {
        id: activeSpaceState.activeSpace.id,
        name: activeSpaceState.activeSpace.name,
        profile: activeSpaceState.activeSpace.profile,
      },
      language,
      t: getTranslations(language),
      user,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (isSpaceMembersSchemaCacheErrorMessage(message)) {
      const fallbackSpace = await resolveV1TestSpaceFallback({
        requestedSpaceId,
        source: 'keepcozy-messaging-adapter',
      });

      if (!fallbackSpace) {
        redirect('/spaces');
      }

      return {
        activeSpace: {
          id: fallbackSpace.id,
          name: fallbackSpace.name,
          profile: 'keepcozy_ops',
        },
        language,
        t: getTranslations(language),
        user,
      };
    }

    throw error;
  }
}

export async function getKeepCozyMessagingActivityFeed(input: {
  labels: KeepCozyMessagingActivityLabels;
  language: AppLanguage;
  spaceId: string;
  userId: string;
}): Promise<KeepCozyMessagingActivityFeed> {
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
    new Map<string, KeepCozyMessagingParticipantIdentity[]>(),
  );

  const activityItems = conversations
    .map((conversation) => {
      const otherParticipants = getKeepCozyMessagingOtherParticipants({
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
            kind: conversation.kind ?? null,
            title: conversation.title,
            participantLabels: otherParticipantLabels,
            fallbackTitles: buildKeepCozyMessagingFallbackTitles(input.language),
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
      } satisfies KeepCozyMessagingActivityItem;
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
