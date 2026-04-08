import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getRequestViewer } from '@/lib/request-context/server';
import { getTranslations } from '@/modules/i18n';
import { getRequestLanguage } from '@/modules/i18n/server';
import {
  getInboxDisplayPreviewText,
} from '@/modules/messaging/e2ee/inbox-policy';
import {
  getArchivedConversations,
  getConversationDisplayName,
  getConversationParticipantIdentities,
  getDirectMessageDisplayName,
  getInboxConversationsStable,
} from '@/modules/messaging/data/server';
import { getInboxSectionPreferences } from '@/modules/messaging/inbox/preferences-server';
import { resolvePublicIdentityLabel } from '@/modules/messaging/ui/identity-label';
import {
  getKeepCozyPrimaryTestFlowHints,
  getKeepCozyHomeDashboardData,
  isKeepCozyPrimaryTestHomeName,
} from '@/modules/keepcozy/server';
import {
  isSpaceMembersSchemaCacheErrorMessage,
  resolveActiveSpaceForUser,
  resolveV1TestSpaceFallback,
} from '@/modules/spaces/server';
import { withSpaceParam } from '@/modules/spaces/url';

type HomeDashboardPageProps = {
  searchParams: Promise<{
    space?: string;
  }>;
};

function buildMessengerInboxCreateHref(input: {
  mode: 'dm' | 'group';
  spaceId: string;
}) {
  const params = new URLSearchParams();
  params.set('space', input.spaceId);
  params.set('create', 'open');
  params.set('createMode', input.mode);
  return `/inbox?${params.toString()}`;
}

function formatMessengerHomeRecency(
  value: string | null,
  language: 'en' | 'ru',
) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const now = new Date();
  const locale = language === 'ru' ? 'ru-RU' : 'en-US';
  const isSameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  return new Intl.DateTimeFormat(
    locale,
    isSameDay
      ? {
          hour: 'numeric',
          minute: '2-digit',
        }
      : {
          day: 'numeric',
          month: 'short',
        },
  ).format(date);
}

async function requireHomeSpaceContext(requestedSpaceId?: string) {
  const [user, language] = await Promise.all([
    getRequestViewer(),
    getRequestLanguage(),
  ]);

  if (!user?.id) {
    redirect('/login');
  }

  const explicitV1TestSpace = await resolveV1TestSpaceFallback({
    requestedSpaceId,
    source: 'space-home-dashboard-explicit-v1-test-bypass',
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
      source: 'space-home-dashboard',
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
        source: 'space-home-dashboard',
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

export default async function HomeDashboardPage({
  searchParams,
}: HomeDashboardPageProps) {
  const query = await searchParams;
  const { activeSpace, language, t, user } = await requireHomeSpaceContext(
    query.space,
  );

  if (activeSpace.profile === 'messenger_full') {
    const [conversations, archivedConversations, inboxPreferences] = await Promise.all([
      getInboxConversationsStable(user.id, { spaceId: activeSpace.id }),
      getArchivedConversations(user.id, { spaceId: activeSpace.id }),
      getInboxSectionPreferences(),
    ]);
    const unreadChatCount = conversations.filter(
      (conversation) => conversation.unreadCount > 0,
    ).length;
    const recentConversations = conversations.slice(0, 3);
    const recentParticipantIdentities = await getConversationParticipantIdentities(
      recentConversations.map((conversation) => conversation.conversationId),
    );
    const recentParticipantIdentitiesByConversation = recentParticipantIdentities.reduce(
      (map, identity) => {
        const existing = map.get(identity.conversationId) ?? [];
        existing.push(identity);
        map.set(identity.conversationId, existing);
        return map;
      },
      new Map<string, (typeof recentParticipantIdentities)[number][]>(),
    );
    const recentChatItems = recentConversations.map((conversation) => {
      const participantOptions =
        recentParticipantIdentitiesByConversation.get(conversation.conversationId) ??
        [];
      const otherParticipants = participantOptions.filter(
        (participant) => participant.userId !== user.id,
      );
      const otherParticipantLabels = otherParticipants.map((participant) =>
        resolvePublicIdentityLabel(participant, t.chat.unknownUser),
      );
      const isGroupConversation = conversation.kind === 'group';

      return {
        conversationId: conversation.conversationId,
        isGroupConversation,
        preview: getInboxDisplayPreviewText(
          conversation,
          {
            attachment: t.chat.attachment,
            audio: t.chat.audio,
            deletedMessage: t.chat.deletedMessage,
            encryptedMessage: t.chat.encryptedMessage,
            file: t.chat.file,
            image: t.chat.image,
            newEncryptedMessage: t.chat.newEncryptedMessage,
            newMessage: t.chat.newMessage,
            voiceMessage: t.chat.voiceMessage,
          },
          inboxPreferences.previewMode,
        ),
        recencyLabel: formatMessengerHomeRecency(
          conversation.lastMessageAt ?? conversation.createdAt,
          language,
        ),
        title: isGroupConversation
          ? getConversationDisplayName({
              kind: conversation.kind ?? null,
              title: conversation.title,
              participantLabels: otherParticipantLabels,
              fallbackTitles: {
                dm: language === 'ru' ? 'Новый чат' : 'New chat',
                group: language === 'ru' ? 'Новая группа' : 'New group',
              },
            })
          : getDirectMessageDisplayName(otherParticipantLabels, t.chat.unknownUser),
        unreadCount: conversation.unreadCount,
      };
    });
    const hasAnyChats =
      conversations.length > 0 || archivedConversations.length > 0;
    const canManageMessengerMembers =
      'canManageMembers' in activeSpace && activeSpace.canManageMembers;

    return (
      <section className="stack settings-screen settings-shell activity-screen">
        <section className="stack settings-hero activity-hero">
          <section className="activity-focus-card">
            <div className="stack activity-focus-copy">
              <span className="activity-focus-kicker">{t.messengerHome.eyebrow}</span>
              <h1 className="settings-hero-title">{activeSpace.name}</h1>
              <p className="muted activity-focus-body">
                {t.messengerHome.subtitle}
              </p>
              <div className="keepcozy-meta-row">
                <span className="keepcozy-meta-pill">
                  {t.settings.currentSpaceLabel}: {activeSpace.name}
                </span>
              </div>
            </div>

            <div className="keepcozy-card-actions keepcozy-focus-actions">
              <Link
                className="activity-focus-action button"
                href={withSpaceParam('/inbox', activeSpace.id)}
                prefetch={false}
              >
                {t.shell.openChats}
              </Link>
              <Link
                className="button button-secondary"
                href={withSpaceParam('/activity', activeSpace.id)}
                prefetch={false}
              >
                {t.shell.openMessengerActivity}
              </Link>
              <Link
                className="pill"
                href={withSpaceParam('/spaces', activeSpace.id)}
                prefetch={false}
              >
                {t.settings.chooseAnotherSpace}
              </Link>
            </div>
          </section>
        </section>

        <section className="card stack settings-surface activity-surface">
          <section className="stack settings-section">
            <div className="stack activity-section-copy">
              <h2 className="card-title">{t.messengerHome.overviewTitle}</h2>
              <p className="muted">{t.messengerHome.overviewBody}</p>
            </div>
          </section>

          <section className="stack settings-section">
            <div className="activity-summary-grid">
              <div className="activity-summary-card">
                <span className="activity-summary-label">
                  {t.messengerHome.activeChatsTitle}
                </span>
                <span className="activity-summary-value">{conversations.length}</span>
                <p className="muted">{t.messengerHome.activeChatsBody}</p>
              </div>

              <div className="activity-summary-card">
                <span className="activity-summary-label">{t.activity.unreadChats}</span>
                <span className="activity-summary-value">{unreadChatCount}</span>
                <p className="muted">{t.messengerHome.unreadChatsBody}</p>
              </div>

              <div className="activity-summary-card">
                <span className="activity-summary-label">{t.activity.archivedChats}</span>
                <span className="activity-summary-value">
                  {archivedConversations.length}
                </span>
                <p className="muted">{t.messengerHome.archivedChatsBody}</p>
              </div>
            </div>
          </section>

          {recentChatItems.length > 0 ? (
            <section className="stack settings-section activity-section">
              <div className="activity-section-header">
                <div className="stack activity-section-copy">
                  <h2 className="card-title">{t.messengerHome.recentTitle}</h2>
                  <p className="muted">{t.messengerHome.recentBody}</p>
                </div>

                <div className="activity-section-actions">
                  <span className="activity-section-count">
                    {recentChatItems.length}
                  </span>
                  <Link
                    className="pill activity-section-link"
                    href={withSpaceParam('/inbox', activeSpace.id)}
                    prefetch={false}
                  >
                    {t.shell.openChats}
                  </Link>
                </div>
              </div>

              <div className="activity-list">
                {recentChatItems.map((conversation) => (
                  <Link
                    key={conversation.conversationId}
                    className="activity-item activity-item-link"
                    href={withSpaceParam(
                      `/chat/${conversation.conversationId}`,
                      activeSpace.id,
                    )}
                    prefetch={false}
                  >
                    <div className="activity-item-copy">
                      <div className="activity-item-title-row">
                        <h3 className="activity-item-title">{conversation.title}</h3>
                        {conversation.recencyLabel ? (
                          <span className="activity-item-recency">
                            {conversation.recencyLabel}
                          </span>
                        ) : null}
                      </div>

                      <p
                        className={[
                          'activity-item-preview',
                          !conversation.preview
                            ? 'activity-item-preview-empty'
                            : null,
                        ]
                          .filter(Boolean)
                          .join(' ')}
                      >
                        {conversation.preview ?? t.messengerHome.recentEmptyBody}
                      </p>

                      <div className="activity-item-meta">
                        <div className="activity-item-meta-left">
                          {conversation.isGroupConversation ? (
                            <span className="keepcozy-meta-pill">
                              {t.messengerHome.groupBadgeLabel}
                            </span>
                          ) : null}
                          {conversation.unreadCount > 0 ? (
                            <span className="activity-unread-pill">
                              {t.messengerHome.unreadBadgeLabel} ·{' '}
                              {conversation.unreadCount}
                            </span>
                          ) : null}
                        </div>
                        <span className="pill">{t.shell.openChats}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {!hasAnyChats ? (
            <section className="empty-card keepcozy-preview-card">
              <h2 className="card-title">{t.messengerHome.emptyTitle}</h2>
              <p className="muted">{t.messengerHome.emptyBody}</p>
              <div className="keepcozy-card-actions">
                <Link
                  className="button"
                  href={buildMessengerInboxCreateHref({
                    mode: 'dm',
                    spaceId: activeSpace.id,
                  })}
                  prefetch={false}
                >
                  {t.inbox.create.createDm}
                </Link>
                <Link
                  className="button button-secondary"
                  href={buildMessengerInboxCreateHref({
                    mode: 'group',
                    spaceId: activeSpace.id,
                  })}
                  prefetch={false}
                >
                  {t.inbox.create.createGroup}
                </Link>
                <Link
                  className="pill"
                  href={
                    canManageMessengerMembers
                      ? withSpaceParam('/spaces/members', activeSpace.id)
                      : withSpaceParam('/spaces', activeSpace.id)
                  }
                  prefetch={false}
                >
                  {canManageMessengerMembers
                    ? t.spaces.manageMembersAction
                    : t.settings.chooseAnotherSpace}
                </Link>
              </div>
            </section>
          ) : null}

          <section className="stack settings-section">
            <div className="stack activity-section-copy">
              <h2 className="card-title">{t.messengerHome.profileTitle}</h2>
              <p className="muted">{t.messengerHome.profileBody}</p>
            </div>

            <div className="keepcozy-card-actions">
              <Link
                className="button button-secondary"
                href={withSpaceParam('/settings', activeSpace.id)}
                prefetch={false}
              >
                {t.messengerHome.openProfileAction}
              </Link>
              <Link
                className="pill"
                href={withSpaceParam('/spaces', activeSpace.id)}
                prefetch={false}
              >
                {t.settings.chooseAnotherSpace}
              </Link>
            </div>
          </section>
        </section>
      </section>
    );
  }

  const { counts, primaryFlow } = await getKeepCozyHomeDashboardData({
    language,
    spaceId: activeSpace.id,
  });
  const primaryFlowHints = getKeepCozyPrimaryTestFlowHints();
  const showPrimaryFlow = isKeepCozyPrimaryTestHomeName(activeSpace.name);
  const testFlowHomeHint = primaryFlow?.homeNameHint ?? 'TEST';

  return (
    <section className="stack settings-screen settings-shell keepcozy-page">
      <section className="stack settings-hero keepcozy-hero">
        <p className="eyebrow">{t.homeDashboard.eyebrow}</p>
        <div className="keepcozy-hero-header">
          <div className="stack keepcozy-hero-copy">
            <h1 className="settings-hero-title">{activeSpace.name}</h1>
            <p className="muted settings-hero-note">{t.homeDashboard.subtitle}</p>
          </div>
          <span className="summary-pill summary-pill-muted">
            {t.homeDashboard.previewPill}
          </span>
        </div>
      </section>

      <section className="card stack settings-surface keepcozy-surface">
        <section className="keepcozy-focus-card">
          <div className="stack keepcozy-focus-copy">
            <span className="activity-focus-kicker">
              {t.homeDashboard.currentHomeLabel}
            </span>
            <h2 className="activity-focus-title">{activeSpace.name}</h2>
            <p className="muted activity-focus-body">{t.homeDashboard.previewBody}</p>
          </div>

          <div className="keepcozy-card-actions keepcozy-focus-actions">
            <Link
              className="button keepcozy-focus-action"
              href={withSpaceParam('/rooms', activeSpace.id)}
              prefetch={false}
            >
              {t.homeDashboard.openRooms}
            </Link>
            <Link
              className="button button-secondary keepcozy-focus-action"
              href={withSpaceParam('/spaces', activeSpace.id)}
              prefetch={false}
            >
              {t.homeDashboard.switchHome}
            </Link>
          </div>
        </section>

        <section className="stack settings-section keepcozy-section">
          <div className="stack keepcozy-section-copy">
            <h2 className="card-title">{t.homeDashboard.loopTitle}</h2>
            <p className="muted">{t.homeDashboard.loopBody}</p>
          </div>

          <div className="keepcozy-link-grid">
            <Link
              className="keepcozy-link-card"
              href={withSpaceParam('/rooms', activeSpace.id)}
              prefetch={false}
            >
              <span className="keepcozy-link-count">{counts.rooms}</span>
              <div className="stack keepcozy-link-copy">
                <h3 className="card-title">{t.homeDashboard.roomsTitle}</h3>
                <p className="muted">{t.homeDashboard.roomsBody}</p>
              </div>
              <span className="pill keepcozy-link-action">
                {t.homeDashboard.openRooms}
              </span>
            </Link>

            <Link
              className="keepcozy-link-card"
              href={withSpaceParam('/issues', activeSpace.id)}
              prefetch={false}
            >
              <span className="keepcozy-link-count">{counts.issues}</span>
              <div className="stack keepcozy-link-copy">
                <h3 className="card-title">{t.homeDashboard.issuesTitle}</h3>
                <p className="muted">{t.homeDashboard.issuesBody}</p>
              </div>
              <span className="pill keepcozy-link-action">
                {t.homeDashboard.openIssues}
              </span>
            </Link>

            <Link
              className="keepcozy-link-card"
              href={withSpaceParam('/tasks', activeSpace.id)}
              prefetch={false}
            >
              <span className="keepcozy-link-count">{counts.tasks}</span>
              <div className="stack keepcozy-link-copy">
                <h3 className="card-title">{t.homeDashboard.tasksTitle}</h3>
                <p className="muted">{t.homeDashboard.tasksBody}</p>
              </div>
              <span className="pill keepcozy-link-action">
                {t.homeDashboard.openTasks}
              </span>
            </Link>

            <Link
              className="keepcozy-link-card"
              href={withSpaceParam('/activity', activeSpace.id)}
              prefetch={false}
            >
              <span className="keepcozy-link-count">{counts.history}</span>
              <div className="stack keepcozy-link-copy">
                <h3 className="card-title">{t.homeDashboard.historyTitle}</h3>
                <p className="muted">{t.homeDashboard.historyBody}</p>
              </div>
              <span className="pill keepcozy-link-action">
                {t.homeDashboard.openHistory}
              </span>
            </Link>
          </div>
        </section>

        <section className="stack settings-section keepcozy-section">
          <div className="stack keepcozy-section-copy">
            <h2 className="card-title">{t.homeDashboard.testFlowTitle}</h2>
            <p className="muted">{t.homeDashboard.testFlowBody}</p>
          </div>

          {showPrimaryFlow && primaryFlow ? (
            <article className="keepcozy-detail-card">
              <div className="keepcozy-detail-header">
                <div className="stack keepcozy-detail-heading">
                  <h3 className="card-title">{primaryFlow.issue.title}</h3>
                  <p className="muted">
                    {primaryFlow.issue.summary || t.issues.detailBody}
                  </p>
                </div>
                <span className="summary-pill summary-pill-muted">
                  {primaryFlow.homeNameHint}
                </span>
              </div>

              <div className="keepcozy-meta-row">
                <span className="keepcozy-meta-pill">
                  {t.homeDashboard.currentHomeLabel}: {activeSpace.name}
                </span>
                <span className="keepcozy-meta-pill">
                  {t.homeDashboard.roomsTitle}: {primaryFlow.room.name}
                </span>
                <span className="keepcozy-meta-pill">
                  {t.homeDashboard.historyTitle}: {primaryFlow.history.length}
                </span>
              </div>

              <p className="keepcozy-detail-body">{t.homeDashboard.testFlowBody}</p>

              <div className="keepcozy-card-actions">
                <Link
                  className="pill"
                  href={withSpaceParam(`/rooms/${primaryFlow.room.id}`, activeSpace.id)}
                  prefetch={false}
                >
                  {t.homeDashboard.openRooms}
                </Link>
                <Link
                  className="button button-secondary"
                  href={withSpaceParam(`/issues/${primaryFlow.issue.id}`, activeSpace.id)}
                  prefetch={false}
                >
                  {t.homeDashboard.openIssues}
                </Link>
                <Link
                  className="button button-secondary"
                  href={withSpaceParam(`/tasks/${primaryFlow.task.id}`, activeSpace.id)}
                  prefetch={false}
                >
                  {t.homeDashboard.openTasks}
                </Link>
                <Link
                  className="button button-secondary"
                  href={withSpaceParam('/activity', activeSpace.id)}
                  prefetch={false}
                >
                  {t.homeDashboard.openHistory}
                </Link>
              </div>

              <div className="keepcozy-stack-list keepcozy-flow-grid">
                <section className="keepcozy-secondary-card">
                  <div className="stack keepcozy-link-copy">
                    <h4 className="card-title">
                      {t.homeDashboard.currentHomeLabel}
                    </h4>
                    <p className="muted">{activeSpace.name}</p>
                  </div>
                </section>

                <Link
                  className="keepcozy-secondary-card"
                  href={withSpaceParam(`/rooms/${primaryFlow.room.id}`, activeSpace.id)}
                  prefetch={false}
                >
                  <div className="stack keepcozy-link-copy">
                    <h4 className="card-title">{t.homeDashboard.roomsTitle}</h4>
                    <p className="muted">{primaryFlow.room.name}</p>
                  </div>
                  <span className="summary-pill summary-pill-muted">
                    {t.homeDashboard.openRooms}
                  </span>
                </Link>

                <Link
                  className="keepcozy-secondary-card"
                  href={withSpaceParam(`/issues/${primaryFlow.issue.id}`, activeSpace.id)}
                  prefetch={false}
                >
                  <div className="stack keepcozy-link-copy">
                    <h4 className="card-title">{t.homeDashboard.issuesTitle}</h4>
                    <p className="muted">{primaryFlow.issue.title}</p>
                  </div>
                  <span className="summary-pill summary-pill-muted">
                    {t.homeDashboard.openIssues}
                  </span>
                </Link>

                <Link
                  className="keepcozy-secondary-card"
                  href={withSpaceParam(`/tasks/${primaryFlow.task.id}`, activeSpace.id)}
                  prefetch={false}
                >
                  <div className="stack keepcozy-link-copy">
                    <h4 className="card-title">{t.homeDashboard.tasksTitle}</h4>
                    <p className="muted">{primaryFlow.task.title}</p>
                  </div>
                  <span className="summary-pill summary-pill-muted">
                    {t.homeDashboard.openTasks}
                  </span>
                </Link>

                <Link
                  className="keepcozy-secondary-card"
                  href={withSpaceParam('/activity', activeSpace.id)}
                  prefetch={false}
                >
                  <div className="stack keepcozy-link-copy">
                    <h4 className="card-title">{t.homeDashboard.historyTitle}</h4>
                    <p className="muted">{t.homeDashboard.historyBody}</p>
                  </div>
                  <span className="summary-pill summary-pill-muted">
                    {t.homeDashboard.openHistory}
                  </span>
                </Link>
              </div>
            </article>
          ) : (
            <section className="empty-card keepcozy-preview-card">
              <h3 className="card-title">{testFlowHomeHint}</h3>
              <p className="muted">
                {showPrimaryFlow
                  ? t.homeDashboard.testFlowPendingBody
                  : t.homeDashboard.testFlowMismatchBody}
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
              </div>
              <div className="keepcozy-card-actions">
                <Link
                  className="button"
                  href={withSpaceParam('/spaces', activeSpace.id)}
                  prefetch={false}
                >
                  {t.homeDashboard.switchHome}
                </Link>
                <Link
                  className="button button-secondary"
                  href={withSpaceParam('/rooms', activeSpace.id)}
                  prefetch={false}
                >
                  {t.homeDashboard.openRooms}
                </Link>
                <Link
                  className="pill"
                  href={withSpaceParam('/activity', activeSpace.id)}
                  prefetch={false}
                >
                  {t.homeDashboard.openHistory}
                </Link>
              </div>
            </section>
          )}
        </section>
      </section>
    </section>
  );
}
