import Link from 'next/link';
import {
  getKeepCozyTasksPageData,
  isKeepCozyPrimaryTestHomeName,
  requireKeepCozyContext,
} from '@/modules/keepcozy/server';
import { withSpaceParam } from '@/modules/spaces/url';

type TasksPageProps = {
  searchParams: Promise<{
    issue?: string;
    room?: string;
    space?: string;
  }>;
};

export default async function TasksPage({ searchParams }: TasksPageProps) {
  const query = await searchParams;
  const { activeSpace, language, t } = await requireKeepCozyContext({
    requestedSpaceId: query.space,
    source: 'keepcozy-tasks-page',
  });
  const { activeIssue, activeRoom, tasks } = await getKeepCozyTasksPageData({
    issueId: query.issue,
    language,
    roomId: query.room,
    spaceId: activeSpace.id,
  });
  const createTaskHref = withSpaceParam(
    activeIssue ? `/tasks/new?issue=${encodeURIComponent(activeIssue.id)}` : '/tasks/new',
    activeSpace.id,
  );
  const isPrimaryTestHome = isKeepCozyPrimaryTestHomeName(activeSpace.name);
  const emptyBody =
    activeIssue || activeRoom
      ? t.tasks.emptyFilteredBody
      : isPrimaryTestHome
        ? t.tasks.emptyTestBody
        : t.tasks.emptyBody;

  return (
    <section className="stack settings-screen settings-shell keepcozy-page">
      <section className="stack settings-hero keepcozy-hero">
        <div className="keepcozy-route-header keepcozy-route-header-spread">
          <Link
            aria-label={t.tasks.backToHome}
            className="back-arrow-link spaces-back-link"
            href={withSpaceParam('/home', activeSpace.id)}
            prefetch={false}
          >
            <span aria-hidden="true">←</span>
          </Link>
          <Link
            className="pill pill-accent"
            href={createTaskHref}
            prefetch={false}
          >
            {t.tasks.create}
          </Link>
        </div>

        <p className="eyebrow">{t.shell.tasks}</p>
        <h1 className="settings-hero-title">{t.tasks.title}</h1>
        <p className="muted settings-hero-note">{t.tasks.subtitle}</p>
      </section>

      <section className="card stack settings-surface keepcozy-surface">
        <section className="empty-card keepcozy-preview-card">
          <div className="keepcozy-preview-header">
            <span className="summary-pill summary-pill-muted">
              {t.homeDashboard.currentHomeLabel}
            </span>
            <span className="keepcozy-context-label">{activeSpace.name}</span>
          </div>
          <p className="muted">{t.tasks.previewBody}</p>
          <div className="keepcozy-card-actions">
            {activeIssue ? (
              <Link
                className="button"
                href={withSpaceParam(`/issues/${activeIssue.id}`, activeSpace.id)}
                prefetch={false}
              >
                {t.tasks.viewIssue}
              </Link>
            ) : (
              <Link
                className="button"
                href={withSpaceParam('/issues', activeSpace.id)}
                prefetch={false}
              >
                {t.shell.openIssues}
              </Link>
            )}
            <Link
              className="button button-secondary"
              href={withSpaceParam('/activity', activeSpace.id)}
              prefetch={false}
            >
              {t.shell.openActivity}
            </Link>
            <Link
              className="pill"
              href={withSpaceParam('/home', activeSpace.id)}
              prefetch={false}
            >
              {t.shell.openHome}
            </Link>
          </div>
          {activeIssue ? (
            <div className="keepcozy-meta-row">
              <span className="keepcozy-meta-pill">
                {t.tasks.filteredByIssue}: {activeIssue.title}
              </span>
              <Link
                className="pill"
                href={withSpaceParam('/tasks', activeSpace.id)}
                prefetch={false}
              >
                {t.tasks.browseTasks}
              </Link>
            </div>
          ) : activeRoom ? (
            <div className="keepcozy-meta-row">
              <span className="keepcozy-meta-pill">
                {t.issues.filteredByRoom}: {activeRoom.name}
              </span>
              <Link
                className="pill"
                href={withSpaceParam('/tasks', activeSpace.id)}
                prefetch={false}
              >
                {t.tasks.browseTasks}
              </Link>
            </div>
          ) : null}
        </section>

        {tasks.length > 0 ? (
          <div className="keepcozy-stack-list">
            {tasks.map((task) => (
              <article key={task.id} className="keepcozy-detail-card">
                <Link
                  className="stack keepcozy-detail-copy"
                  href={withSpaceParam(`/tasks/${task.id}`, activeSpace.id)}
                  prefetch={false}
                >
                  <div className="keepcozy-detail-header">
                    <div className="stack keepcozy-detail-heading">
                      <h2 className="card-title">{task.title}</h2>
                      <p className="muted">{task.summary || t.tasks.detailBody}</p>
                    </div>
                    <span className="summary-pill summary-pill-muted">{task.status}</span>
                  </div>
                  <p className="keepcozy-detail-body">{task.nextStep || t.tasks.updatesBody}</p>
                </Link>

                <div className="keepcozy-meta-row">
                  {task.issueTitle ? (
                    <span className="keepcozy-meta-pill">{task.issueTitle}</span>
                  ) : null}
                  {task.roomName ? (
                    <span className="keepcozy-meta-pill">{task.roomName}</span>
                  ) : null}
                </div>

                <div className="keepcozy-card-actions">
                  {task.issueId ? (
                    <Link
                      className="pill"
                      href={withSpaceParam(`/issues/${task.issueId}`, activeSpace.id)}
                      prefetch={false}
                    >
                      {t.tasks.viewIssue}
                    </Link>
                  ) : null}
                  {task.roomId ? (
                    <Link
                      className="button button-secondary"
                      href={withSpaceParam(`/rooms/${task.roomId}`, activeSpace.id)}
                      prefetch={false}
                    >
                      {t.tasks.viewRoom}
                    </Link>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <section className="empty-card keepcozy-preview-card">
            <div className="keepcozy-preview-header">
              <span className="summary-pill summary-pill-muted">{t.tasks.emptyTitle}</span>
              <span className="keepcozy-context-label">{activeSpace.name}</span>
            </div>
            <p className="muted">{emptyBody}</p>
            <div className="keepcozy-meta-row">
              {activeIssue ? (
                <span className="keepcozy-meta-pill">
                  {t.tasks.filteredByIssue}: {activeIssue.title}
                </span>
              ) : null}
              {!activeIssue && activeRoom ? (
                <span className="keepcozy-meta-pill">
                  {t.issues.filteredByRoom}: {activeRoom.name}
                </span>
              ) : null}
              {isPrimaryTestHome ? (
                <>
                  <span className="keepcozy-meta-pill">TEST</span>
                  <span className="keepcozy-meta-pill">Kitchen</span>
                  <span className="keepcozy-meta-pill">Capture faucet model task</span>
                </>
              ) : null}
            </div>
            <div className="keepcozy-card-actions">
              {activeIssue ? (
                <Link className="button" href={createTaskHref} prefetch={false}>
                  {t.tasks.create}
                </Link>
              ) : (
                <Link
                  className="button"
                  href={withSpaceParam('/issues', activeSpace.id)}
                  prefetch={false}
                >
                  {t.shell.openIssues}
                </Link>
              )}
              <Link
                className="button button-secondary"
                href={withSpaceParam('/home', activeSpace.id)}
                prefetch={false}
              >
                {t.shell.openHome}
              </Link>
              {activeIssue || activeRoom ? (
                <Link
                  className="pill"
                  href={withSpaceParam('/tasks', activeSpace.id)}
                  prefetch={false}
                >
                  {t.tasks.browseTasks}
                </Link>
              ) : (
                <Link
                  className="pill"
                  href={withSpaceParam('/activity', activeSpace.id)}
                  prefetch={false}
                >
                  {t.shell.openActivity}
                </Link>
              )}
            </div>
          </section>
        )}
      </section>
    </section>
  );
}
