import Link from 'next/link';
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
  getKeepCozyActivityData,
  isKeepCozyPrimaryTestHomeName,
  requireKeepCozyContext,
} from '@/modules/keepcozy/server';
import { withSpaceParam } from '@/modules/spaces/url';
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

export default async function ActivityPage({ searchParams }: ActivityPageProps) {
  const query = await searchParams;
  const { activeSpace, language, t, user } = await requireKeepCozyContext({
    requestedSpaceId: query.space,
    source: 'activity-page',
  });
  const { counts, primaryFlow } = await getKeepCozyActivityData({
    language,
    spaceId: activeSpace.id,
  });
  const showPrimaryFlow = isKeepCozyPrimaryTestHomeName(activeSpace.name);
  const testFlowHomeHint = primaryFlow?.homeNameHint ?? 'TEST';
  const primaryIssueUpdates = primaryFlow?.issue.updates ?? [];
  const primaryTaskUpdates = primaryFlow?.task.updates ?? [];
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
            href={withSpaceParam('/tasks', activeSpace.id)}
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
                    {t.homeDashboard.roomsTitle}: Kitchen
                  </span>
                  <span className="keepcozy-meta-pill">
                    {t.homeDashboard.issuesTitle}: Kitchen faucet keeps dripping after shutoff
                  </span>
                  <span className="keepcozy-meta-pill">
                    {t.homeDashboard.tasksTitle}: Capture faucet model and cartridge type
                  </span>
                </div>
                <div className="keepcozy-card-actions">
                  {showPrimaryFlow ? (
                    <>
                      <Link
                        className="pill"
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
                        className="button button-secondary"
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
                    variant: 'unread',
                  }}
                  language={language}
                  labels={{
                    attachment: t.chat.attachment,
                    audio: t.chat.audio,
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
                    audio: t.chat.audio,
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
