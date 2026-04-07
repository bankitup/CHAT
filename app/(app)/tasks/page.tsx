import Link from 'next/link';
import {
  getKeepCozyPreview,
  getKeepCozyPreviewIssue,
  getKeepCozyPreviewRoom,
} from '@/modules/keepcozy/mvp-preview';
import { requireKeepCozyContext } from '@/modules/keepcozy/server';
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
  const preview = getKeepCozyPreview(language);
  const activeIssue = query.issue ? getKeepCozyPreviewIssue(language, query.issue) : null;
  const activeRoom =
    !activeIssue && query.room ? getKeepCozyPreviewRoom(language, query.room) : null;
  const tasks = activeIssue
    ? preview.tasks.filter((task) => task.issueId === activeIssue.id)
    : activeRoom
      ? preview.tasks.filter((task) => {
          const issue = getKeepCozyPreviewIssue(language, task.issueId);
          return issue?.roomId === activeRoom.id;
        })
      : preview.tasks;

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
            href={withSpaceParam('/tasks/new', activeSpace.id)}
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
            <span className="summary-pill summary-pill-muted">{t.tasks.previewPill}</span>
            <span className="keepcozy-context-label">
              {t.tasks.selectedHomeLabel}: {activeSpace.name}
            </span>
          </div>
          <p className="muted">{t.tasks.previewBody}</p>
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

        <div className="keepcozy-stack-list">
          {tasks.map((task) => {
            const issue = getKeepCozyPreviewIssue(language, task.issueId);
            const room = issue ? getKeepCozyPreviewRoom(language, issue.roomId) : null;

            return (
              <article key={task.id} className="keepcozy-detail-card">
                <Link
                  className="stack keepcozy-detail-copy"
                  href={withSpaceParam(`/tasks/${task.id}`, activeSpace.id)}
                  prefetch={false}
                >
                  <div className="keepcozy-detail-header">
                    <div className="stack keepcozy-detail-heading">
                      <h2 className="card-title">{task.title}</h2>
                      <p className="muted">{task.summary}</p>
                    </div>
                    <span className="summary-pill summary-pill-muted">{task.status}</span>
                  </div>
                  <p className="keepcozy-detail-body">{task.nextStep}</p>
                </Link>

                <div className="keepcozy-meta-row">
                  {issue ? <span className="keepcozy-meta-pill">{issue.title}</span> : null}
                  {room ? <span className="keepcozy-meta-pill">{room.name}</span> : null}
                </div>

                <div className="keepcozy-card-actions">
                  {issue ? (
                    <Link
                      className="pill"
                      href={withSpaceParam(`/issues/${issue.id}`, activeSpace.id)}
                      prefetch={false}
                    >
                      {t.tasks.viewIssue}
                    </Link>
                  ) : null}
                  {room ? (
                    <Link
                      className="button button-secondary"
                      href={withSpaceParam(`/rooms/${room.id}`, activeSpace.id)}
                      prefetch={false}
                    >
                      {t.tasks.viewRoom}
                    </Link>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </section>
  );
}
