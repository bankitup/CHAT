import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  getKeepCozyPreviewIssue,
  getKeepCozyPreviewRoom,
  getKeepCozyPreviewTask,
} from '@/modules/keepcozy/mvp-preview';
import { requireKeepCozyContext } from '@/modules/keepcozy/server';
import { withSpaceParam } from '@/modules/spaces/url';

type TaskDetailPageProps = {
  params: Promise<{
    taskId: string;
  }>;
  searchParams: Promise<{
    space?: string;
  }>;
};

export default async function TaskDetailPage({
  params,
  searchParams,
}: TaskDetailPageProps) {
  const [{ taskId }, query] = await Promise.all([params, searchParams]);
  const { activeSpace, language, t } = await requireKeepCozyContext({
    requestedSpaceId: query.space,
    source: 'keepcozy-task-detail-page',
  });
  const task = getKeepCozyPreviewTask(language, taskId);

  if (!task) {
    notFound();
  }

  const issue = getKeepCozyPreviewIssue(language, task.issueId);
  const room = issue ? getKeepCozyPreviewRoom(language, issue.roomId) : null;

  return (
    <section className="stack settings-screen settings-shell keepcozy-page">
      <section className="stack settings-hero keepcozy-hero">
        <div className="keepcozy-route-header keepcozy-route-header-spread">
          <Link
            aria-label={t.tasks.browseTasks}
            className="back-arrow-link spaces-back-link"
            href={withSpaceParam('/tasks', activeSpace.id)}
            prefetch={false}
          >
            <span aria-hidden="true">←</span>
          </Link>
          {issue ? (
            <Link
              className="pill"
              href={withSpaceParam(`/issues/${issue.id}`, activeSpace.id)}
              prefetch={false}
            >
              {t.tasks.viewIssue}
            </Link>
          ) : null}
        </div>

        <p className="eyebrow">{t.tasks.title}</p>
        <h1 className="settings-hero-title">{task.title}</h1>
        <p className="muted settings-hero-note">{task.summary}</p>
      </section>

      <section className="card stack settings-surface keepcozy-surface">
        <section className="keepcozy-focus-card">
          <div className="stack keepcozy-focus-copy">
            <span className="activity-focus-kicker">{task.status}</span>
            <h2 className="activity-focus-title">{t.tasks.updatesTitle}</h2>
            <p className="muted activity-focus-body">{t.tasks.detailBody}</p>
          </div>

          {room ? (
            <Link
              className="button button-secondary keepcozy-focus-action"
              href={withSpaceParam(`/rooms/${room.id}`, activeSpace.id)}
              prefetch={false}
            >
              {t.tasks.viewRoom}
            </Link>
          ) : null}
        </section>

        <section className="stack settings-section keepcozy-section">
          <div className="stack keepcozy-section-copy">
            <h2 className="card-title">{t.tasks.updatesTitle}</h2>
            <p className="muted">{t.tasks.updatesBody}</p>
          </div>

          <div className="keepcozy-timeline">
            {task.updates.map((update) => (
              <article key={update.id} className="keepcozy-timeline-item">
                <div className="keepcozy-timeline-topline">
                  <h3 className="card-title">{update.label}</h3>
                  <span className="keepcozy-timestamp">{update.timestamp}</span>
                </div>
                <p className="muted">{update.note}</p>
              </article>
            ))}
          </div>
        </section>

        {issue ? (
          <section className="stack settings-section keepcozy-section">
            <div className="stack keepcozy-section-copy">
              <h2 className="card-title">{t.tasks.viewIssue}</h2>
              <p className="muted">{issue.summary}</p>
            </div>
            <Link
              className="keepcozy-secondary-card"
              href={withSpaceParam(`/issues/${issue.id}`, activeSpace.id)}
              prefetch={false}
            >
              <div className="stack keepcozy-link-copy">
                <h3 className="card-title">{issue.title}</h3>
                <p className="muted">{issue.nextStep}</p>
              </div>
              <span className="summary-pill summary-pill-muted">{issue.status}</span>
            </Link>
          </section>
        ) : null}
      </section>
    </section>
  );
}
