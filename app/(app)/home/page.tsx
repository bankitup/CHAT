import { logoutAction } from '../actions';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getRequestViewer } from '@/lib/request-context/server';
import { getTranslations } from '@/modules/i18n';
import { getRequestLanguage } from '@/modules/i18n/server';
import {
  getCurrentUserProfile,
  getArchivedConversations,
  getInboxConversationsStable,
} from '@/modules/messaging/data/server';
import { IdentityAvatar } from '@/modules/messaging/ui/identity';
import {
  getKeepCozyPrimaryTestFlowHints,
  getKeepCozyHomeDashboardData,
  isKeepCozyPrimaryTestHomeName,
} from '@/modules/keepcozy/server';
import {
  isSpaceMembersSchemaCacheErrorMessage,
  resolveActiveSpaceForUser,
  resolveSuperAdminGovernanceForUser,
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

function formatMessengerStatusUpdatedAt(
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

  const locale = language === 'ru' ? 'ru-RU' : 'en-US';

  return new Intl.DateTimeFormat(
    locale,
    {
      dateStyle: 'medium',
      timeStyle: 'short',
    },
  ).format(date);
}

function resolveMessengerProfileLabel(input: {
  displayName: string | null;
  email: string | null;
  username: string | null;
}) {
  const displayName = input.displayName?.trim();

  if (displayName) {
    return displayName;
  }

  const username = input.username?.trim();

  if (username) {
    return username;
  }

  const emailLocalPart = input.email?.split('@')[0]?.trim();

  return emailLocalPart || null;
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
    const [conversations, archivedConversations, currentUserProfile] = await Promise.all([
      getInboxConversationsStable(user.id, { spaceId: activeSpace.id }),
      getArchivedConversations(user.id, { spaceId: activeSpace.id }),
      getCurrentUserProfile(user.id, user.email ?? null),
    ]);
    const unreadChatCount = conversations.filter(
      (conversation) => conversation.unreadCount > 0,
    ).length;
    const hasAnyChats =
      conversations.length > 0 || archivedConversations.length > 0;
    const canManageMessengerMembers =
      'canManageMembers' in activeSpace && activeSpace.canManageMembers;
    const canCreateSpaces = resolveSuperAdminGovernanceForUser({
      userEmail: user.email ?? null,
    }).canCreateSpaces;
    const showMessengerAdminControls =
      canManageMessengerMembers || canCreateSpaces;
    const profileLabel =
      resolveMessengerProfileLabel({
        displayName: currentUserProfile.displayName ?? null,
        email: currentUserProfile.email ?? user.email ?? null,
        username: currentUserProfile.username ?? null,
      }) ?? t.settings.profileTitle;
    const profileHandle = currentUserProfile.username?.trim()
      ? `@${currentUserProfile.username.trim()}`
      : null;
    const profileEmail = currentUserProfile.email ?? user.email ?? null;
    const statusEmoji = currentUserProfile.statusEmoji?.trim() ?? '';
    const statusText = currentUserProfile.statusText?.trim() ?? '';
    const hasStatus = Boolean(statusEmoji || statusText);
    const statusUpdatedLabel = formatMessengerStatusUpdatedAt(
      currentUserProfile.statusUpdatedAt ?? null,
      language,
    );

    return (
      <section className="stack settings-screen settings-shell activity-screen messenger-home-screen">
        <section className="messenger-home-personal-grid">
          <section className="card stack settings-surface settings-home-card settings-home-card-profile messenger-home-personal-card">
            <div className="messenger-home-profile-row">
              <IdentityAvatar
                diagnosticsSurface="home:messenger-profile"
                identity={{
                  avatarPath: currentUserProfile.avatarPath ?? null,
                  displayName: profileLabel,
                  userId: user.id,
                }}
                label={profileLabel}
                size="lg"
              />

              <div className="stack messenger-home-profile-copy">
                <span className="activity-focus-kicker">{t.settings.profileTitle}</span>
                <h1 className="messenger-home-profile-name">{profileLabel}</h1>
                <div className="messenger-home-profile-meta">
                  {profileEmail ? (
                    <span className="muted messenger-home-profile-email">
                      {profileEmail}
                    </span>
                  ) : null}
                  {profileHandle ? (
                    <span className="summary-pill summary-pill-muted">
                      {profileHandle}
                    </span>
                  ) : null}
                  <span className="summary-pill summary-pill-muted">
                    {t.settings.currentSpaceLabel}: {activeSpace.name}
                  </span>
                </div>
              </div>
            </div>

            <div className="keepcozy-card-actions messenger-home-personal-actions">
              <Link
                className="button button-secondary"
                href={withSpaceParam('/settings', activeSpace.id)}
                prefetch={false}
              >
                {t.messengerHome.openProfileAction}
              </Link>
            </div>
          </section>

          <section className="card stack settings-surface settings-home-card messenger-home-personal-card messenger-home-status-card">
            <div className="stack settings-card-copy settings-section-copy">
              <h2 className="section-title">{t.settings.statusTitle}</h2>
              <p className="muted">{t.settings.statusSubtitle}</p>
            </div>

            {hasStatus ? (
              <div className="profile-status-pill">
                {statusEmoji ? (
                  <span aria-hidden="true" className="profile-status-emoji">
                    {statusEmoji}
                  </span>
                ) : null}
                <span className="profile-status-text">
                  {statusText || t.settings.statusEmpty}
                </span>
              </div>
            ) : (
              <p className="muted messenger-home-status-empty">
                {t.settings.statusEmpty}
              </p>
            )}

            {statusUpdatedLabel ? (
              <p className="muted messenger-home-status-updated">
                {statusUpdatedLabel}
              </p>
            ) : null}
          </section>
        </section>

        <section className="card stack settings-surface activity-surface messenger-home-entry-card">
          <section className="stack settings-section">
            <div className="stack activity-section-copy">
              <h2 className="card-title">{t.messengerHome.overviewTitle}</h2>
              <p className="muted">{t.messengerHome.overviewBody}</p>
            </div>
            <div className="messenger-home-summary-pills">
              <span className="summary-pill">
                {t.messengerHome.activeChatsTitle}: {conversations.length}
              </span>
              <span className="summary-pill summary-pill-muted">
                {t.activity.unreadChats}: {unreadChatCount}
              </span>
              {archivedConversations.length > 0 ? (
                <span className="summary-pill summary-pill-muted">
                  {t.activity.archivedChats}: {archivedConversations.length}
                </span>
              ) : null}
            </div>

            <div className="messenger-home-entry-actions">
              <Link
                className="button"
                href={withSpaceParam('/inbox', activeSpace.id)}
                prefetch={false}
              >
                {t.shell.openChats}
              </Link>
              <Link
                className="button button-secondary"
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
            </div>
          </section>

          {!hasAnyChats ? (
            <section className="stack settings-section messenger-home-empty-section">
              <h2 className="card-title">{t.messengerHome.emptyTitle}</h2>
              <p className="muted">{t.messengerHome.emptyBody}</p>
            </section>
          ) : null}

          {showMessengerAdminControls ? (
            <section className="stack settings-section messenger-home-admin-section">
              <div className="stack activity-section-copy">
                <h2 className="card-title">{t.messengerHome.adminTitle}</h2>
                <p className="muted">{t.messengerHome.adminBody}</p>
              </div>

              <div className="messenger-home-admin-actions">
                {canManageMessengerMembers ? (
                  <Link
                    className="pill"
                    href={withSpaceParam('/spaces/members', activeSpace.id)}
                    prefetch={false}
                  >
                    {t.spaces.manageMembersAction}
                  </Link>
                ) : null}
                <Link
                  className="button button-secondary"
                  href={withSpaceParam('/spaces', activeSpace.id)}
                  prefetch={false}
                >
                  {t.settings.chooseAnotherSpace}
                </Link>
                <form action={logoutAction} className="messenger-home-logout-form">
                  <button className="button button-secondary" type="submit">
                    {t.settings.logoutButton}
                  </button>
                </form>
              </div>
            </section>
          ) : null}
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
