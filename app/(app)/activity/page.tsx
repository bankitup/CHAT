import Link from 'next/link';
import { getRequestViewer } from '@/lib/request-context/server';
import {
  getTranslations,
} from '@/modules/i18n';
import { getRequestLanguage } from '@/modules/i18n/server';
import { getInboxPreviewText } from '@/modules/messaging/e2ee/inbox-policy';
import {
  getArchivedConversations,
  getConversationDisplayName,
  getDirectMessageDisplayName,
  getConversationParticipantIdentities,
  getInboxConversationsStable,
  type InboxConversation,
} from '@/modules/messaging/data/server';
import { InboxRealtimeSync } from '@/modules/messaging/realtime/inbox-sync';
import { resolvePublicIdentityLabel } from '@/modules/messaging/ui/identity-label';
import {
  resolveV1TestSpaceFallback,
  resolveActiveSpaceForUser,
  isSpaceMembersSchemaCacheErrorMessage,
} from '@/modules/spaces/server';
import { withSpaceParam } from '@/modules/spaces/url';
import { notFound, redirect } from 'next/navigation';
import { NotificationReadinessPanel } from '../settings/notification-readiness';
import { ActivityConversationLiveItem } from './activity-conversation-live-item';

type ActivityPageProps = {
  searchParams: Promise<{
    space?: string;
  }>;
};

type ActivityItem = {
  conversationId: string;
  title: string;
  groupAvatarPath: string | null;
  preview: string | null;
  lastActivityAt: string | null;
  unreadCount: number;
  isGroupConversation: boolean;
  primaryParticipant:
    | {
        userId: string;
        displayName: string | null;
        avatarPath?: string | null;
      }
    | null;
}

function buildInboxHref(input: {
  spaceId: string;
  view?: 'main' | 'archived';
}) {
  const params = new URLSearchParams();

  if (input.view === 'archived') {
    params.set('view', 'archived');
  }

  params.set('space', input.spaceId);

  return `/inbox?${params.toString()}`;
}

export default async function ActivityPage({ searchParams }: ActivityPageProps) {
  const query = await searchParams;
  const [user, language] = await Promise.all([
    getRequestViewer(),
    getRequestLanguage(),
  ]);

  if (!user?.id) {
    return null;
  }

  let activeSpaceId: string | null = null;
  const explicitV1TestSpace = await resolveV1TestSpaceFallback({
    requestedSpaceId: query.space,
    source: 'activity-page-explicit-v1-test-bypass',
  });

  if (explicitV1TestSpace) {
    // Temporary v1 unblocker: bypass fragile space_members SSR path for explicit TEST-space entry.
    // Remove once membership resolution via space_members is stable again.
    activeSpaceId = explicitV1TestSpace.id;
  } else {
    let activeSpaceState: Awaited<
      ReturnType<typeof resolveActiveSpaceForUser>
    > | null = null;
    try {
      activeSpaceState = await resolveActiveSpaceForUser({
        userId: user.id,
        requestedSpaceId: query.space,
        source: 'activity-page',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (isSpaceMembersSchemaCacheErrorMessage(message)) {
        const fallbackSpace = await resolveV1TestSpaceFallback({
          requestedSpaceId: query.space,
          source: 'activity-page',
        });

        if (!fallbackSpace) {
          redirect('/spaces');
        }

        activeSpaceId = fallbackSpace.id;
      } else {
        throw error;
      }
    }

    if (!activeSpaceId) {
      if (!activeSpaceState?.activeSpace) {
        notFound();
      }

      if (activeSpaceState.requestedSpaceWasInvalid) {
        redirect('/spaces');
      }

      activeSpaceId = activeSpaceState.activeSpace.id;
    }
  }

  if (!activeSpaceId) {
    redirect('/spaces');
  }

  const t = getTranslations(language);
  const [conversations, archivedConversations]: [
    InboxConversation[],
    InboxConversation[],
  ] = await Promise.all([
    getInboxConversationsStable(user.id, { spaceId: activeSpaceId }),
    getArchivedConversations(user.id, { spaceId: activeSpaceId }),
  ]);
  const participantIdentities = await getConversationParticipantIdentities(
    conversations.map((conversation) => conversation.conversationId),
  );
  const participantIdentitiesByConversation = participantIdentities.reduce(
    (map, identity) => {
      const existing = map.get(identity.conversationId) ?? [];
      existing.push(identity);
      map.set(identity.conversationId, existing);
      return map;
    },
    new Map<string, (typeof participantIdentities)[number][]>(),
  );
  const activityItems = conversations.map((conversation) => {
    const participantOptions =
      participantIdentitiesByConversation.get(conversation.conversationId) ?? [];
    const otherParticipants = participantOptions.filter(
      (participant) => participant.userId !== user.id,
    );
    const otherParticipantLabels = otherParticipants.map((participant) =>
      resolvePublicIdentityLabel(participant, t.chat.unknownUser),
    );
    const isGroupConversation = conversation.kind === 'group';
    const title = isGroupConversation
      ? getConversationDisplayName({
          kind: conversation.kind ?? null,
          title: conversation.title,
          participantLabels: otherParticipantLabels,
          fallbackTitles: {
            dm: language === 'ru' ? 'Новый чат' : 'New chat',
            group: language === 'ru' ? 'Новая группа' : 'New group',
          },
        })
      : getDirectMessageDisplayName(otherParticipantLabels, t.chat.unknownUser);
    const lastActivityAt = conversation.lastMessageAt ?? conversation.createdAt;

    return {
      conversationId: conversation.conversationId,
      title,
      groupAvatarPath: conversation.avatarPath,
      preview: getInboxPreviewText(conversation, {
        audio: t.chat.audio,
        deletedMessage: t.chat.deletedMessage,
        voiceMessage: t.chat.voiceMessage,
        encryptedMessage: t.chat.encryptedMessage,
        newEncryptedMessage: t.chat.newEncryptedMessage,
        attachment: t.chat.attachment,
        file: t.chat.file,
        image: t.chat.image,
      }),
      lastActivityAt,
      unreadCount: conversation.unreadCount,
      isGroupConversation,
      primaryParticipant: otherParticipants[0] ?? null,
    } satisfies ActivityItem;
  }).sort((left, right) => {
    const leftValue = left.lastActivityAt ? new Date(left.lastActivityAt).getTime() : 0;
    const rightValue = right.lastActivityAt ? new Date(right.lastActivityAt).getTime() : 0;
    return rightValue - leftValue;
  });
  const liveSummariesByConversationId = new Map(
    conversations.map((conversation) => [
      conversation.conversationId,
      {
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
      },
    ]),
  );

  const unreadItems = activityItems.filter((conversation) => conversation.unreadCount > 0);
  const recentItems = activityItems
    .filter((conversation) => conversation.preview && conversation.unreadCount === 0)
    .slice(0, 8);
  const unreadChatCount = unreadItems.length;
  const unreadDmCount = unreadItems.filter(
    (conversation) => !conversation.isGroupConversation,
  ).length;

  return (
    <section className="stack settings-screen settings-shell activity-screen">
      <InboxRealtimeSync
        conversationIds={conversations.map((conversation) => conversation.conversationId)}
        initialSummaries={conversations.map((conversation) => ({
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
        }))}
        userId={user.id}
      />

      <section className="stack settings-hero activity-hero">
        <section className="activity-focus-card">
          <div className="stack activity-focus-copy">
            <span className="activity-focus-kicker">{t.activity.overviewTitle}</span>
            <h2 className="activity-focus-title">{t.activity.operationsTitle}</h2>
            <p className="muted activity-focus-body">{t.activity.overviewBody}</p>
          </div>

          <Link
            className="activity-focus-action button button-secondary"
            href={withSpaceParam('/tasks', activeSpaceId)}
            prefetch={false}
          >
            {t.activity.openTasks}
          </Link>
        </section>
      </section>

      <section className="card stack settings-surface activity-surface">
        <section className="stack settings-section">
          <div className="activity-section-header">
            <div className="stack activity-section-copy">
              <h2 className="card-title">{t.activity.operationsTitle}</h2>
              <p className="muted">{t.activity.operationsBody}</p>
            </div>
          </div>

          <div className="keepcozy-secondary-grid">
            <section className="keepcozy-secondary-card">
              <div className="stack keepcozy-link-copy">
                <h3 className="card-title">{t.activity.operationsIssues}</h3>
                <p className="muted">{t.issues.updatesBody}</p>
              </div>
            </section>

            <section className="keepcozy-secondary-card">
              <div className="stack keepcozy-link-copy">
                <h3 className="card-title">{t.activity.operationsTasks}</h3>
                <p className="muted">{t.tasks.updatesBody}</p>
              </div>
            </section>

            <section className="keepcozy-secondary-card">
              <div className="stack keepcozy-link-copy">
                <h3 className="card-title">{t.activity.operationsResolutions}</h3>
                <p className="muted">{t.activity.digestBody}</p>
              </div>
            </section>
          </div>

          <section className="empty-card activity-future-card">
            <h2 className="card-title">{t.activity.messagingTitle}</h2>
            <p className="muted activity-future-copy">{t.activity.messagingBody}</p>
          </section>
        </section>

        <section className="stack settings-section">
          <div className="activity-summary-grid">
            <div className="activity-summary-card">
              <span className="activity-summary-label">{t.activity.unreadChats}</span>
              <span className="activity-summary-value">{unreadChatCount}</span>
            </div>
            <div className="activity-summary-card">
              <span className="activity-summary-label">{t.activity.unreadDms}</span>
              <span className="activity-summary-value">{unreadDmCount}</span>
            </div>
            <div className="activity-summary-card">
              <span className="activity-summary-label">{t.activity.archivedChats}</span>
              <span className="activity-summary-value">{archivedConversations.length}</span>
            </div>
          </div>
        </section>

        <section className="stack settings-section activity-section">
          <div className="activity-section-header">
            <div className="stack activity-section-copy">
              <h2 className="card-title">{t.activity.unreadSectionTitle}</h2>
              <p className="muted">{t.activity.unreadSectionBody}</p>
            </div>
            <div className="activity-section-actions">
              <span className="activity-section-count">{unreadItems.length}</span>
              {unreadItems.length > 0 ? (
                <Link
                  className="pill activity-section-link"
                  href={buildInboxHref({ spaceId: activeSpaceId })}
                  prefetch={false}
                >
                  {t.activity.openChats}
                </Link>
              ) : null}
            </div>
          </div>

          {unreadItems.length > 0 ? (
            <div className="activity-list">
              {unreadItems.map((conversation) => (
                <ActivityConversationLiveItem
                  key={`unread-${conversation.conversationId}`}
                  activeSpaceId={activeSpaceId}
                  initialSummary={
                    liveSummariesByConversationId.get(conversation.conversationId) ?? {
                      conversationId: conversation.conversationId,
                      createdAt: null,
                      hiddenAt: null,
                      lastMessageAt: null,
                      lastReadAt: null,
                      lastReadMessageSeq: null,
                      latestMessageAttachmentKind: null,
                      latestMessageBody: null,
                      latestMessageContentMode: null,
                      latestMessageDeletedAt: null,
                      latestMessageId: null,
                      latestMessageKind: null,
                      latestMessageSenderId: null,
                      latestMessageSeq: null,
                      unreadCount: 0,
                    }
                  }
                  item={{
                    conversationId: conversation.conversationId,
                    groupAvatarPath: conversation.groupAvatarPath,
                    isGroupConversation: conversation.isGroupConversation,
                    primaryParticipant: conversation.primaryParticipant,
                    title: conversation.title,
                    variant: 'unread',
                  }}
                  language={language}
                  labels={{
                    audio: t.chat.audio,
                    attachment: t.chat.attachment,
                    deletedMessage: t.chat.deletedMessage,
                    encryptedMessage: t.chat.encryptedMessage,
                    file: t.chat.file,
                    group: t.inbox.metaGroup,
                    image: t.chat.image,
                    newEncryptedMessage: t.chat.newEncryptedMessage,
                    noActivityYet: t.inbox.noActivityYet,
                    unreadMessages: t.chat.unreadMessages,
                    voiceMessage: t.chat.voiceMessage,
                    yesterday: language === 'ru' ? 'Вчера' : 'Yesterday',
                  }}
                />
              ))}
            </div>
          ) : (
            <section className="empty-card inbox-empty-state activity-empty-state">
              <h2 className="card-title">{t.activity.quietTitle}</h2>
              <p className="muted">{t.activity.quietBody}</p>
            </section>
          )}
        </section>

        <section className="stack settings-section activity-section">
          <div className="activity-section-header">
            <div className="stack activity-section-copy">
              <h2 className="card-title">{t.activity.recentMessagingTitle}</h2>
              <p className="muted">{t.activity.recentMessagingBody}</p>
            </div>
            <div className="activity-section-actions">
              <span className="activity-section-count">{recentItems.length}</span>
              {archivedConversations.length > 0 ? (
                <Link
                  className="pill activity-section-link"
                  href={buildInboxHref({
                    spaceId: activeSpaceId,
                    view: 'archived',
                  })}
                  prefetch={false}
                >
                  {t.activity.openArchived}
                </Link>
              ) : null}
            </div>
          </div>

          {recentItems.length > 0 ? (
            <div className="activity-list">
              {recentItems.map((conversation) => (
                <ActivityConversationLiveItem
                  key={`recent-${conversation.conversationId}`}
                  activeSpaceId={activeSpaceId}
                  initialSummary={
                    liveSummariesByConversationId.get(conversation.conversationId) ?? {
                      conversationId: conversation.conversationId,
                      createdAt: null,
                      hiddenAt: null,
                      lastMessageAt: null,
                      lastReadAt: null,
                      lastReadMessageSeq: null,
                      latestMessageAttachmentKind: null,
                      latestMessageBody: null,
                      latestMessageContentMode: null,
                      latestMessageDeletedAt: null,
                      latestMessageId: null,
                      latestMessageKind: null,
                      latestMessageSenderId: null,
                      latestMessageSeq: null,
                      unreadCount: 0,
                    }
                  }
                  item={{
                    conversationId: conversation.conversationId,
                    groupAvatarPath: conversation.groupAvatarPath,
                    isGroupConversation: conversation.isGroupConversation,
                    primaryParticipant: conversation.primaryParticipant,
                    title: conversation.title,
                    variant: 'recent',
                  }}
                  language={language}
                  labels={{
                    audio: t.chat.audio,
                    attachment: t.chat.attachment,
                    deletedMessage: t.chat.deletedMessage,
                    encryptedMessage: t.chat.encryptedMessage,
                    file: t.chat.file,
                    group: t.inbox.metaGroup,
                    image: t.chat.image,
                    newEncryptedMessage: t.chat.newEncryptedMessage,
                    noActivityYet: t.inbox.noActivityYet,
                    unreadMessages: t.chat.unreadMessages,
                    voiceMessage: t.chat.voiceMessage,
                    yesterday: language === 'ru' ? 'Вчера' : 'Yesterday',
                  }}
                />
              ))}
            </div>
          ) : (
            <section className="empty-card inbox-empty-state activity-empty-state">
              <h2 className="card-title">{t.activity.recentEmptyTitle}</h2>
              <p className="muted">{t.activity.recentEmptyBody}</p>
            </section>
          )}
        </section>

        <section className="stack settings-section activity-section">
          <NotificationReadinessPanel embedded language={language} />
        </section>
      </section>
    </section>
  );
}
