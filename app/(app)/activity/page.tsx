import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getRequestViewer } from '@/lib/request-context/server';
import { getTranslations } from '@/modules/i18n';
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
  getKeepCozyPrimaryTestFlowHints,
  getKeepCozyActivityData,
  isKeepCozyPrimaryTestHomeName,
} from '@/modules/keepcozy/server';
import {
  isSpaceMembersSchemaCacheErrorMessage,
  resolveActiveSpaceForUser,
  resolveV1TestSpaceFallback,
} from '@/modules/spaces/server';
import { withSpaceParam } from '@/modules/spaces/url';
import { NotificationReadinessPanel } from '../settings/notification-readiness';
import { ActivityConversationLiveItem } from './activity-conversation-live-item';

type ActivityPageProps = {
  searchParams: Promise<{
    filter?: string;
    space?: string;
  }>;
};

type MessengerActivityFilterValue =
  | 'attention'
  | 'recent'
  | 'direct'
  | 'groups';

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
};

type MessengerNotificationItem = ActivityItem & {
  variant: 'attention' | 'recent';
};

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

function buildActivityHref(input: {
  filter?: MessengerActivityFilterValue | null;
  spaceId: string;
}) {
  const params = new URLSearchParams();
  params.set('space', input.spaceId);

  if (input.filter) {
    params.set('filter', input.filter);
  }

  return `/activity?${params.toString()}`;
}

function normalizeMessengerActivityFilter(
  value: string | undefined,
  fallback: MessengerActivityFilterValue,
) {
  switch (value?.trim()) {
    case 'attention':
    case 'recent':
    case 'direct':
    case 'groups':
      return value.trim();
    default:
      return fallback;
  }
}

async function requireActivitySpaceContext(requestedSpaceId?: string) {
  const [user, language] = await Promise.all([
    getRequestViewer(),
    getRequestLanguage(),
  ]);

  if (!user?.id) {
    redirect('/login');
  }

  const explicitV1TestSpace = await resolveV1TestSpaceFallback({
    requestedSpaceId,
    source: 'activity-page-explicit-v1-test-bypass',
  });

  if (explicitV1TestSpace) {
    return {
      activeSpace: {
        id: explicitV1TestSpace.id,
        name: explicitV1TestSpace.name,
        profile: 'keepcozy_ops' as const,
      },
      language,
      t: getTranslations(language),
      user,
    };
  }

  try {
    const activeSpaceState = await resolveActiveSpaceForUser({
      requestedSpaceId,
      source: 'activity-page',
      userEmail: user.email ?? null,
      userId: user.id,
    });

    if (!activeSpaceState.activeSpace || activeSpaceState.requestedSpaceWasInvalid) {
      redirect('/spaces');
    }

    return {
      activeSpace: activeSpaceState.activeSpace,
      language,
      t: getTranslations(language),
      user,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (isSpaceMembersSchemaCacheErrorMessage(message)) {
      const fallbackSpace = await resolveV1TestSpaceFallback({
        requestedSpaceId,
        source: 'activity-page',
      });

      if (!fallbackSpace) {
        redirect('/spaces');
      }

      return {
        activeSpace: {
          id: fallbackSpace.id,
          name: fallbackSpace.name,
          profile: 'keepcozy_ops' as const,
        },
        language,
        t: getTranslations(language),
        user,
      };
    }

    throw error;
  }
}

export default async function ActivityPage({ searchParams }: ActivityPageProps) {
  const query = await searchParams;
  const { activeSpace, language, t, user } = await requireActivitySpaceContext(
    query.space,
  );
  const [conversations, archivedConversations]: [
    InboxConversation[],
    InboxConversation[],
  ] = await Promise.all([
    getInboxConversationsStable(user.id, { spaceId: activeSpace.id }),
    getArchivedConversations(user.id, { spaceId: activeSpace.id }),
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
  const activityItems = conversations
    .map((conversation) => {
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
        groupAvatarPath: conversation.avatarPath,
        isGroupConversation,
        lastActivityAt,
        preview: getInboxPreviewText(conversation, {
          attachment: t.chat.attachment,
          audio: t.chat.audio,
          deletedMessage: t.chat.deletedMessage,
          encryptedMessage: t.chat.encryptedMessage,
          file: t.chat.file,
          image: t.chat.image,
          newEncryptedMessage: t.chat.newEncryptedMessage,
          voiceMessage: t.chat.voiceMessage,
        }),
        primaryParticipant: otherParticipants[0] ?? null,
        title,
        unreadCount: conversation.unreadCount,
      } satisfies ActivityItem;
    })
    .sort((left, right) => {
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
  const messengerNotificationItems: MessengerNotificationItem[] = [
    ...unreadItems.map((conversation) => ({
      ...conversation,
      variant: 'attention' as const,
    })),
    ...recentItems.map((conversation) => ({
      ...conversation,
      variant: 'recent' as const,
    })),
  ];
  const unreadChatCount = unreadItems.length;
  const unreadDmCount = unreadItems.filter(
    (conversation) => !conversation.isGroupConversation,
  ).length;
  const defaultMessengerActivityFilter: MessengerActivityFilterValue =
    unreadItems.length > 0 ? 'attention' : recentItems.length > 0 ? 'recent' : 'attention';
  const activeMessengerActivityFilter = normalizeMessengerActivityFilter(
    query.filter,
    defaultMessengerActivityFilter,
  );
  const matchesMessengerActivityFilter = (item: MessengerNotificationItem) => {
    switch (activeMessengerActivityFilter) {
      case 'attention':
        return item.variant === 'attention';
      case 'recent':
        return item.variant === 'recent';
      case 'direct':
        return !item.isGroupConversation;
      case 'groups':
        return item.isGroupConversation;
      default:
        return true;
    }
  };
  const filteredMessengerAttentionItems = messengerNotificationItems.filter(
    (item) => item.variant === 'attention' && matchesMessengerActivityFilter(item),
  );
  const filteredMessengerRecentItems = messengerNotificationItems.filter(
    (item) => item.variant === 'recent' && matchesMessengerActivityFilter(item),
  );
  const messengerDirectCount = messengerNotificationItems.filter(
    (item) => !item.isGroupConversation,
  ).length;
  const messengerGroupCount = messengerNotificationItems.filter(
    (item) => item.isGroupConversation,
  ).length;
  const messengerHasVisibleNotifications =
    filteredMessengerAttentionItems.length > 0 || filteredMessengerRecentItems.length > 0;
  const visibleNotificationCount =
    filteredMessengerAttentionItems.length + filteredMessengerRecentItems.length;
  const { counts, primaryFlow } =
    activeSpace.profile === 'keepcozy_ops'
      ? await getKeepCozyActivityData({
          language,
          spaceId: activeSpace.id,
        })
      : {
          counts: {
            history: 0,
            issueUpdates: 0,
            issues: 0,
            resolutionNotes: 0,
            rooms: 0,
            taskUpdates: 0,
            tasks: 0,
          },
          primaryFlow: null,
        };
  const primaryFlowHints = getKeepCozyPrimaryTestFlowHints();
  const showPrimaryFlow = isKeepCozyPrimaryTestHomeName(activeSpace.name);
  const testFlowHomeHint = primaryFlow?.homeNameHint ?? 'TEST';
  const primaryIssueUpdates = primaryFlow?.issue.updates ?? [];
  const primaryTaskUpdates = primaryFlow?.task.updates ?? [];
  const hasOperationalHistory =
    counts.issueUpdates > 0 || counts.taskUpdates > 0 || counts.resolutionNotes > 0;

  if (activeSpace.profile === 'messenger_full') {
    return (
      <section className="stack settings-screen settings-shell activity-screen messenger-activity-screen">
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

        <section className="stack settings-hero activity-hero messenger-activity-head">
          <div className="messenger-activity-head-row">
            <div className="stack activity-focus-copy messenger-activity-copy">
              <span className="activity-focus-kicker">{t.shell.messengerActivity}</span>
              <h1 className="activity-focus-title">
                {t.messengerActivity.overviewTitle}
              </h1>
              <p className="muted activity-focus-body">
                {t.messengerActivity.subtitle}
              </p>
            </div>

            <div className="messenger-activity-head-actions">
              <Link
                className="pill messenger-activity-head-pill"
                href={withSpaceParam('/settings', activeSpace.id)}
                prefetch={false}
              >
                {t.messengerActivity.settingsAction}
              </Link>
              {archivedConversations.length > 0 ? (
                <Link
                  className="pill messenger-activity-head-pill"
                  href={buildInboxHref({
                    spaceId: activeSpace.id,
                    view: 'archived',
                  })}
                  prefetch={false}
                >
                  {t.activity.openArchived}
                </Link>
              ) : null}
            </div>
          </div>

          <div className="keepcozy-meta-row messenger-activity-meta">
            <span className="keepcozy-meta-pill">
              {t.settings.currentSpaceLabel}: {activeSpace.name}
            </span>
            <span className="keepcozy-meta-pill">
              {t.messengerActivity.unreadSectionTitle}: {unreadChatCount}
            </span>
            {unreadDmCount > 0 ? (
              <span className="keepcozy-meta-pill">
                {t.messengerActivity.filterDirect}: {unreadDmCount}
              </span>
            ) : null}
            {visibleNotificationCount > 0 ? (
              <span className="keepcozy-meta-pill">
                {t.messengerActivity.filterRecent}: {visibleNotificationCount}
              </span>
            ) : null}
          </div>
        </section>

        <section className="card stack settings-surface activity-surface messenger-activity-surface">
          <div className="stack messenger-activity-surface-copy">
            <h2 className="card-title">{t.messengerActivity.surfaceTitle}</h2>
            <p className="muted">{t.messengerActivity.surfaceBody}</p>
          </div>

          <nav className="messenger-activity-filter-row" aria-label={t.messengerActivity.filtersLabel}>
            <Link
              className={
                activeMessengerActivityFilter === 'attention'
                  ? 'messenger-activity-filter-pill messenger-activity-filter-pill-active'
                  : 'messenger-activity-filter-pill'
              }
              href={buildActivityHref({
                filter: 'attention',
                spaceId: activeSpace.id,
              })}
              prefetch={false}
            >
              <span>{t.messengerActivity.filterAttention}</span>
              <span className="messenger-activity-filter-count">{unreadItems.length}</span>
            </Link>
            <Link
              className={
                activeMessengerActivityFilter === 'recent'
                  ? 'messenger-activity-filter-pill messenger-activity-filter-pill-active'
                  : 'messenger-activity-filter-pill'
              }
              href={buildActivityHref({
                filter: 'recent',
                spaceId: activeSpace.id,
              })}
              prefetch={false}
            >
              <span>{t.messengerActivity.filterRecent}</span>
              <span className="messenger-activity-filter-count">{recentItems.length}</span>
            </Link>
            <Link
              className={
                activeMessengerActivityFilter === 'direct'
                  ? 'messenger-activity-filter-pill messenger-activity-filter-pill-active'
                  : 'messenger-activity-filter-pill'
              }
              href={buildActivityHref({
                filter: 'direct',
                spaceId: activeSpace.id,
              })}
              prefetch={false}
            >
              <span>{t.messengerActivity.filterDirect}</span>
              <span className="messenger-activity-filter-count">{messengerDirectCount}</span>
            </Link>
            <Link
              className={
                activeMessengerActivityFilter === 'groups'
                  ? 'messenger-activity-filter-pill messenger-activity-filter-pill-active'
                  : 'messenger-activity-filter-pill'
              }
              href={buildActivityHref({
                filter: 'groups',
                spaceId: activeSpace.id,
              })}
              prefetch={false}
            >
              <span>{t.messengerActivity.filterGroups}</span>
              <span className="messenger-activity-filter-count">{messengerGroupCount}</span>
            </Link>
          </nav>

          {messengerHasVisibleNotifications ? (
            <div className="messenger-activity-scroll">
              {filteredMessengerAttentionItems.length > 0 ? (
                <section className="stack settings-section activity-section messenger-activity-section">
                  <div className="activity-section-header messenger-activity-section-header">
                    <div className="stack activity-section-copy">
                      <h2 className="card-title">
                        {t.messengerActivity.unreadSectionTitle}
                      </h2>
                      <p className="muted">{t.messengerActivity.unreadSectionBody}</p>
                    </div>
                    <div className="activity-section-actions">
                      <span className="activity-section-count">
                        {filteredMessengerAttentionItems.length}
                      </span>
                    </div>
                  </div>

                  <div className="activity-list messenger-activity-list">
                    {filteredMessengerAttentionItems.map((conversation) => (
                      <ActivityConversationLiveItem
                        key={`messenger-unread-${conversation.conversationId}`}
                        activeSpaceId={activeSpace.id}
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
                        item={conversation}
                        language={language}
                        labels={{
                          attachment: t.chat.attachment,
                          attentionBadge: t.messengerActivity.attentionBadge,
                          audio: t.chat.audio,
                          deletedMessage: t.chat.deletedMessage,
                          encryptedMessage: t.chat.encryptedMessage,
                          file: t.chat.file,
                          group: t.inbox.metaGroup,
                          image: t.chat.image,
                          newEncryptedMessage: t.chat.newEncryptedMessage,
                          noActivityYet: t.inbox.noActivityYet,
                          recentBadge: t.messengerActivity.recentBadge,
                          unreadMessages: t.chat.unreadMessages,
                          voiceMessage: t.chat.voiceMessage,
                          yesterday: language === 'ru' ? 'Вчера' : 'Yesterday',
                        }}
                      />
                    ))}
                  </div>
                </section>
              ) : null}

              {filteredMessengerRecentItems.length > 0 ? (
                <section className="stack settings-section activity-section messenger-activity-section">
                  <div className="activity-section-header messenger-activity-section-header">
                    <div className="stack activity-section-copy">
                      <h2 className="card-title">
                        {t.messengerActivity.recentSectionTitle}
                      </h2>
                      <p className="muted">{t.messengerActivity.recentSectionBody}</p>
                    </div>
                    <div className="activity-section-actions">
                      <span className="activity-section-count">
                        {filteredMessengerRecentItems.length}
                      </span>
                    </div>
                  </div>

                  <div className="activity-list messenger-activity-list">
                    {filteredMessengerRecentItems.map((conversation) => (
                      <ActivityConversationLiveItem
                        key={`messenger-recent-${conversation.conversationId}`}
                        activeSpaceId={activeSpace.id}
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
                        item={conversation}
                        language={language}
                        labels={{
                          attachment: t.chat.attachment,
                          attentionBadge: t.messengerActivity.attentionBadge,
                          audio: t.chat.audio,
                          deletedMessage: t.chat.deletedMessage,
                          encryptedMessage: t.chat.encryptedMessage,
                          file: t.chat.file,
                          group: t.inbox.metaGroup,
                          image: t.chat.image,
                          newEncryptedMessage: t.chat.newEncryptedMessage,
                          noActivityYet: t.inbox.noActivityYet,
                          recentBadge: t.messengerActivity.recentBadge,
                          unreadMessages: t.chat.unreadMessages,
                          voiceMessage: t.chat.voiceMessage,
                          yesterday: language === 'ru' ? 'Вчера' : 'Yesterday',
                        }}
                      />
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
          ) : (
            <section className="empty-card inbox-empty-state activity-empty-state messenger-activity-empty-state">
              <h2 className="card-title">
                {activeMessengerActivityFilter === 'recent'
                  ? t.messengerActivity.recentEmptyTitle
                  : t.messengerActivity.quietTitle}
              </h2>
              <p className="muted">
                {activeMessengerActivityFilter === 'recent'
                  ? t.messengerActivity.recentEmptyBody
                  : t.messengerActivity.quietBody}
              </p>
            </section>
          )}
        </section>
      </section>
    );
  }

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
            <div className="keepcozy-meta-row">
              <span className="keepcozy-meta-pill">
                {t.homeDashboard.currentHomeLabel}: {activeSpace.name}
              </span>
            </div>
          </div>

          <div className="keepcozy-card-actions keepcozy-focus-actions">
            <Link
              className="activity-focus-action button"
              href={withSpaceParam('/tasks', activeSpace.id)}
              prefetch={false}
            >
              {t.activity.openTasks}
            </Link>
            <Link
              className="pill"
              href={withSpaceParam('/home', activeSpace.id)}
              prefetch={false}
            >
              {t.activity.openHome}
            </Link>
          </div>
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
                <span className="activity-summary-value">{counts.issueUpdates}</span>
                <p className="muted">{t.issues.updatesBody}</p>
              </div>
            </section>

            <section className="keepcozy-secondary-card">
              <div className="stack keepcozy-link-copy">
                <h3 className="card-title">{t.activity.operationsTasks}</h3>
                <span className="activity-summary-value">{counts.taskUpdates}</span>
                <p className="muted">{t.tasks.updatesBody}</p>
              </div>
            </section>

            <section className="keepcozy-secondary-card">
              <div className="stack keepcozy-link-copy">
                <h3 className="card-title">{t.activity.operationsResolutions}</h3>
                <span className="activity-summary-value">{counts.resolutionNotes}</span>
                <p className="muted">{t.activity.digestBody}</p>
              </div>
            </section>
          </div>

          {!showPrimaryFlow && !hasOperationalHistory ? (
            <section className="empty-card keepcozy-preview-card">
              <div className="keepcozy-preview-header">
                <span className="summary-pill summary-pill-muted">
                  {t.activity.operationsEmptyTitle}
                </span>
                <span className="keepcozy-context-label">{activeSpace.name}</span>
              </div>
              <p className="muted">{t.activity.operationsEmptyBody}</p>
              <div className="keepcozy-card-actions">
                <Link
                  className="button"
                  href={withSpaceParam('/issues', activeSpace.id)}
                  prefetch={false}
                >
                  {t.shell.openIssues}
                </Link>
                <Link
                  className="button button-secondary"
                  href={withSpaceParam('/tasks', activeSpace.id)}
                  prefetch={false}
                >
                  {t.shell.openTasks}
                </Link>
                <Link
                  className="pill"
                  href={withSpaceParam('/home', activeSpace.id)}
                  prefetch={false}
                >
                  {t.activity.openHome}
                </Link>
              </div>
            </section>
          ) : null}

          <section className="stack activity-section keepcozy-section">
            <div className="stack activity-section-copy">
              <h2 className="card-title">{t.activity.testFlowTitle}</h2>
              <p className="muted">{t.activity.testFlowBody}</p>
            </div>

            {showPrimaryFlow && primaryFlow ? (
              <article className="keepcozy-detail-card">
                <div className="keepcozy-detail-header">
                  <div className="stack keepcozy-detail-heading">
                    <h3 className="card-title">{primaryFlow.issue.title}</h3>
                    <p className="muted">{primaryFlow.task.title}</p>
                  </div>
                  <span className="summary-pill summary-pill-muted">
                    {primaryFlow.homeNameHint}
                  </span>
                </div>

                <div className="keepcozy-meta-row">
                  <Link
                    className="keepcozy-meta-pill"
                    href={withSpaceParam(`/rooms/${primaryFlow.room.id}`, activeSpace.id)}
                    prefetch={false}
                  >
                    {primaryFlow.room.name}
                  </Link>
                  <Link
                    className="keepcozy-meta-pill"
                    href={withSpaceParam(`/issues/${primaryFlow.issue.id}`, activeSpace.id)}
                    prefetch={false}
                  >
                    {t.shell.issues}
                  </Link>
                  <Link
                    className="keepcozy-meta-pill"
                    href={withSpaceParam(`/tasks/${primaryFlow.task.id}`, activeSpace.id)}
                    prefetch={false}
                  >
                    {t.shell.tasks}
                  </Link>
                </div>

                <div className="keepcozy-stack-list">
                  <Link
                    className="keepcozy-secondary-card"
                    href={withSpaceParam(`/rooms/${primaryFlow.room.id}`, activeSpace.id)}
                    prefetch={false}
                  >
                    <div className="stack keepcozy-link-copy">
                      <h3 className="card-title">{t.homeDashboard.roomsTitle}</h3>
                      <p className="muted">
                        {primaryFlow.room.summary || t.homeDashboard.roomsBody}
                      </p>
                    </div>
                    <span className="summary-pill summary-pill-muted">
                      {primaryFlow.room.name}
                    </span>
                  </Link>

                  <Link
                    className="keepcozy-secondary-card"
                    href={withSpaceParam(`/issues/${primaryFlow.issue.id}`, activeSpace.id)}
                    prefetch={false}
                  >
                    <div className="stack keepcozy-link-copy">
                      <h3 className="card-title">{t.homeDashboard.issuesTitle}</h3>
                      <p className="muted">
                        {primaryFlow.issue.nextStep || primaryFlow.issue.summary || t.homeDashboard.issuesBody}
                      </p>
                    </div>
                    <span className="summary-pill summary-pill-muted">
                      {primaryFlow.issue.status}
                    </span>
                  </Link>

                  <Link
                    className="keepcozy-secondary-card"
                    href={withSpaceParam(`/tasks/${primaryFlow.task.id}`, activeSpace.id)}
                    prefetch={false}
                  >
                    <div className="stack keepcozy-link-copy">
                      <h3 className="card-title">{t.homeDashboard.tasksTitle}</h3>
                      <p className="muted">
                        {primaryFlow.task.nextStep || primaryFlow.task.summary || t.homeDashboard.tasksBody}
                      </p>
                    </div>
                    <span className="summary-pill summary-pill-muted">
                      {primaryFlow.task.status}
                    </span>
                  </Link>
                </div>

                <section className="stack keepcozy-section">
                  <div className="activity-section-header">
                    <div className="stack activity-section-copy">
                      <h3 className="card-title">{t.activity.operationsIssues}</h3>
                      <p className="muted">{t.issues.updatesBody}</p>
                    </div>
                    <div className="activity-section-actions">
                      <span className="activity-section-count">{primaryIssueUpdates.length}</span>
                      <Link
                        className="pill activity-section-link"
                        href={withSpaceParam(`/issues/${primaryFlow.issue.id}`, activeSpace.id)}
                        prefetch={false}
                      >
                        {t.tasks.viewIssue}
                      </Link>
                    </div>
                  </div>

                  <div className="keepcozy-meta-row">
                    <Link
                      className="keepcozy-meta-pill"
                      href={withSpaceParam(`/rooms/${primaryFlow.room.id}`, activeSpace.id)}
                      prefetch={false}
                    >
                      {primaryFlow.room.name}
                    </Link>
                    <Link
                      className="keepcozy-meta-pill"
                      href={withSpaceParam(`/issues/${primaryFlow.issue.id}`, activeSpace.id)}
                      prefetch={false}
                    >
                      {primaryFlow.issue.title}
                    </Link>
                  </div>

                  <div className="keepcozy-timeline">
                    {primaryIssueUpdates.length > 0 ? (
                      primaryIssueUpdates.map((update) => (
                        <article key={update.id} className="keepcozy-timeline-item">
                          <div className="keepcozy-timeline-topline">
                            <h3 className="card-title">{update.label}</h3>
                            <span className="keepcozy-timestamp">{update.timestamp}</span>
                          </div>
                          <p className="muted">{update.note}</p>
                        </article>
                      ))
                    ) : (
                      <section className="empty-card">
                        <p className="muted">{t.issues.updatesBody}</p>
                      </section>
                    )}
                  </div>
                </section>

                <section className="stack keepcozy-section">
                  <div className="activity-section-header">
                    <div className="stack activity-section-copy">
                      <h3 className="card-title">{t.activity.operationsTasks}</h3>
                      <p className="muted">{t.tasks.updatesBody}</p>
                    </div>
                    <div className="activity-section-actions">
                      <span className="activity-section-count">{primaryTaskUpdates.length}</span>
                      <Link
                        className="pill activity-section-link"
                        href={withSpaceParam(`/tasks/${primaryFlow.task.id}`, activeSpace.id)}
                        prefetch={false}
                      >
                        {t.activity.openTask}
                      </Link>
                    </div>
                  </div>

                  <div className="keepcozy-meta-row">
                    <Link
                      className="keepcozy-meta-pill"
                      href={withSpaceParam(`/issues/${primaryFlow.issue.id}`, activeSpace.id)}
                      prefetch={false}
                    >
                      {primaryFlow.issue.title}
                    </Link>
                    <Link
                      className="keepcozy-meta-pill"
                      href={withSpaceParam(`/rooms/${primaryFlow.room.id}`, activeSpace.id)}
                      prefetch={false}
                    >
                      {primaryFlow.room.name}
                    </Link>
                  </div>

                  <div className="keepcozy-timeline">
                    {primaryTaskUpdates.length > 0 ? (
                      primaryTaskUpdates.map((update) => (
                        <article key={update.id} className="keepcozy-timeline-item">
                          <div className="keepcozy-timeline-topline">
                            <h3 className="card-title">{update.label}</h3>
                            <span className="keepcozy-timestamp">{update.timestamp}</span>
                          </div>
                          <p className="muted">{update.note}</p>
                        </article>
                      ))
                    ) : (
                      <section className="empty-card">
                        <p className="muted">{t.tasks.updatesBody}</p>
                      </section>
                    )}
                  </div>
                </section>
              </article>
            ) : (
              <section className="empty-card keepcozy-preview-card">
                <h3 className="card-title">{testFlowHomeHint}</h3>
                <p className="muted">
                  {showPrimaryFlow
                    ? t.activity.testFlowPendingBody
                    : t.activity.testFlowMismatchBody}
                </p>
                <div className="keepcozy-meta-row">
                  <span className="keepcozy-meta-pill">
                    {t.homeDashboard.currentHomeLabel}: {activeSpace.name}
                  </span>
                  <span className="keepcozy-meta-pill">
                    {t.homeDashboard.roomsTitle}: {primaryFlowHints.roomNameHint}
                  </span>
                  <span className="keepcozy-meta-pill">
                    {t.homeDashboard.issuesTitle}: {primaryFlowHints.issueTitleHint}
                  </span>
                  <span className="keepcozy-meta-pill">
                    {t.homeDashboard.tasksTitle}: {primaryFlowHints.taskTitleHint}
                  </span>
                </div>
                <div className="keepcozy-card-actions">
                  {showPrimaryFlow ? (
                    <>
                      <Link
                        className="button"
                        href={withSpaceParam('/home', activeSpace.id)}
                        prefetch={false}
                      >
                        {t.activity.openHome}
                      </Link>
                      <Link
                        className="button button-secondary"
                        href={withSpaceParam('/rooms', activeSpace.id)}
                        prefetch={false}
                      >
                        {t.homeDashboard.openRooms}
                      </Link>
                      <Link
                        className="button button-secondary"
                        href={withSpaceParam('/issues', activeSpace.id)}
                        prefetch={false}
                      >
                        {t.homeDashboard.openIssues}
                      </Link>
                      <Link
                        className="pill"
                        href={withSpaceParam('/tasks', activeSpace.id)}
                        prefetch={false}
                      >
                        {t.homeDashboard.openTasks}
                      </Link>
                    </>
                  ) : (
                    <>
                      <Link
                        className="button"
                        href={withSpaceParam('/spaces', activeSpace.id)}
                        prefetch={false}
                      >
                        {t.homeDashboard.switchHome}
                      </Link>
                      <Link
                        className="button button-secondary"
                        href={withSpaceParam('/home', activeSpace.id)}
                        prefetch={false}
                      >
                        {t.activity.openHome}
                      </Link>
                    </>
                  )}
                </div>
              </section>
            )}
          </section>

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
                  href={buildInboxHref({ spaceId: activeSpace.id })}
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
                  activeSpaceId={activeSpace.id}
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
                    variant: 'attention',
                  }}
                  language={language}
                  labels={{
                    attachment: t.chat.attachment,
                    attentionBadge: t.messengerActivity.attentionBadge,
                    audio: t.chat.audio,
                    deletedMessage: t.chat.deletedMessage,
                    encryptedMessage: t.chat.encryptedMessage,
                    file: t.chat.file,
                    group: t.inbox.metaGroup,
                    image: t.chat.image,
                    newEncryptedMessage: t.chat.newEncryptedMessage,
                    noActivityYet: t.inbox.noActivityYet,
                    recentBadge: t.messengerActivity.recentBadge,
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
                    spaceId: activeSpace.id,
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
                  activeSpaceId={activeSpace.id}
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
                    attachment: t.chat.attachment,
                    attentionBadge: t.messengerActivity.attentionBadge,
                    audio: t.chat.audio,
                    deletedMessage: t.chat.deletedMessage,
                    encryptedMessage: t.chat.encryptedMessage,
                    file: t.chat.file,
                    group: t.inbox.metaGroup,
                    image: t.chat.image,
                    newEncryptedMessage: t.chat.newEncryptedMessage,
                    noActivityYet: t.inbox.noActivityYet,
                    recentBadge: t.messengerActivity.recentBadge,
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
