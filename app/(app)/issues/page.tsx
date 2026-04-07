import Link from 'next/link';
import {
  getKeepCozyIssuesPageData,
  isKeepCozyPrimaryTestHomeName,
  requireKeepCozyContext,
} from '@/modules/keepcozy/server';
import { withSpaceParam } from '@/modules/spaces/url';

type IssuesPageProps = {
  searchParams: Promise<{
    room?: string;
    space?: string;
  }>;
};

export default async function IssuesPage({ searchParams }: IssuesPageProps) {
  const query = await searchParams;
  const { activeSpace, language, t } = await requireKeepCozyContext({
    requestedSpaceId: query.space,
    source: 'keepcozy-issues-page',
  });
  const { activeRoom, issues } = await getKeepCozyIssuesPageData({
    language,
    roomId: query.room,
    spaceId: activeSpace.id,
  });
  const createIssueHref = withSpaceParam(
    activeRoom ? `/issues/new?room=${encodeURIComponent(activeRoom.id)}` : '/issues/new',
    activeSpace.id,
  );
  const isPrimaryTestHome = isKeepCozyPrimaryTestHomeName(activeSpace.name);
  const emptyBody = activeRoom
    ? t.issues.emptyFilteredBody
    : isPrimaryTestHome
      ? t.issues.emptyTestBody
      : t.issues.emptyBody;

  return (
    <section className="stack settings-screen settings-shell keepcozy-page">
      <section className="stack settings-hero keepcozy-hero">
        <div className="keepcozy-route-header keepcozy-route-header-spread">
          <Link
            aria-label={t.issues.backToHome}
            className="back-arrow-link spaces-back-link"
            href={withSpaceParam('/home', activeSpace.id)}
            prefetch={false}
          >
            <span aria-hidden="true">←</span>
          </Link>
          <Link
            className="pill pill-accent"
            href={createIssueHref}
            prefetch={false}
          >
            {t.issues.create}
          </Link>
        </div>

        <p className="eyebrow">{t.shell.issues}</p>
        <h1 className="settings-hero-title">{t.issues.title}</h1>
        <p className="muted settings-hero-note">{t.issues.subtitle}</p>
      </section>

      <section className="card stack settings-surface keepcozy-surface">
        <section className="empty-card keepcozy-preview-card">
          <div className="keepcozy-preview-header">
            <span className="summary-pill summary-pill-muted">
              {t.homeDashboard.currentHomeLabel}
            </span>
            <span className="keepcozy-context-label">{activeSpace.name}</span>
          </div>
          <p className="muted">{t.issues.previewBody}</p>
          <div className="keepcozy-card-actions">
            <Link
              className="pill"
              href={withSpaceParam('/home', activeSpace.id)}
              prefetch={false}
            >
              {t.shell.openHome}
            </Link>
            <Link
              className="button button-secondary"
              href={withSpaceParam('/tasks', activeSpace.id)}
              prefetch={false}
            >
              {t.shell.openTasks}
            </Link>
          </div>
          {activeRoom ? (
            <div className="keepcozy-meta-row">
              <span className="keepcozy-meta-pill">
                {t.issues.filteredByRoom}: {activeRoom.name}
              </span>
              <Link
                className="pill"
                href={withSpaceParam('/issues', activeSpace.id)}
                prefetch={false}
              >
                {t.issues.browseIssues}
              </Link>
            </div>
          ) : null}
        </section>

        {issues.length > 0 ? (
          <div className="keepcozy-stack-list">
            {issues.map((issue) => (
              <article key={issue.id} className="keepcozy-detail-card">
                <Link
                  className="stack keepcozy-detail-copy"
                  href={withSpaceParam(`/issues/${issue.id}`, activeSpace.id)}
                  prefetch={false}
                >
                  <div className="keepcozy-detail-header">
                    <div className="stack keepcozy-detail-heading">
                      <h2 className="card-title">{issue.title}</h2>
                      <p className="muted">{issue.summary || t.issues.detailBody}</p>
                    </div>
                    <span className="summary-pill summary-pill-muted">{issue.status}</span>
                  </div>
                  <p className="keepcozy-detail-body">{issue.nextStep || t.issues.tasksBody}</p>
                </Link>

                <div className="keepcozy-meta-row">
                  {issue.roomName ? (
                    <span className="keepcozy-meta-pill">{issue.roomName}</span>
                  ) : null}
                  <span className="keepcozy-meta-pill">
                    {t.tasks.title}: {issue.taskCount}
                  </span>
                </div>

                <div className="keepcozy-card-actions">
                  {issue.roomId ? (
                    <Link
                      className="pill"
                      href={withSpaceParam(`/rooms/${issue.roomId}`, activeSpace.id)}
                      prefetch={false}
                    >
                      {t.issues.viewRoom}
                    </Link>
                  ) : null}
                  <Link
                    className="button button-secondary"
                    href={withSpaceParam(`/tasks?issue=${issue.id}`, activeSpace.id)}
                    prefetch={false}
                  >
                    {t.issues.viewTasks}
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <section className="empty-card keepcozy-preview-card">
            <div className="keepcozy-preview-header">
              <span className="summary-pill summary-pill-muted">{t.issues.emptyTitle}</span>
              <span className="keepcozy-context-label">{activeSpace.name}</span>
            </div>
            <p className="muted">{emptyBody}</p>
            <div className="keepcozy-meta-row">
              {activeRoom ? (
                <span className="keepcozy-meta-pill">
                  {t.issues.filteredByRoom}: {activeRoom.name}
                </span>
              ) : null}
              {isPrimaryTestHome ? (
                <>
                  <span className="keepcozy-meta-pill">TEST</span>
                  <span className="keepcozy-meta-pill">Kitchen</span>
                  <span className="keepcozy-meta-pill">Kitchen faucet issue</span>
                </>
              ) : null}
            </div>
            <div className="keepcozy-card-actions">
              <Link className="button" href={createIssueHref} prefetch={false}>
                {t.issues.create}
              </Link>
              <Link
                className="button button-secondary"
                href={withSpaceParam('/home', activeSpace.id)}
                prefetch={false}
              >
                {t.shell.openHome}
              </Link>
              {activeRoom ? (
                <Link
                  className="pill"
                  href={withSpaceParam('/issues', activeSpace.id)}
                  prefetch={false}
                >
                  {t.issues.browseIssues}
                </Link>
              ) : (
                <Link
                  className="pill"
                  href={withSpaceParam('/rooms', activeSpace.id)}
                  prefetch={false}
                >
                  {t.shell.openRooms}
                </Link>
              )}
            </div>
          </section>
        )}
      </section>
    </section>
  );
}
