import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  getKeepCozyPreview,
  getKeepCozyPreviewIssue,
  getKeepCozyPreviewRoom,
} from '@/modules/keepcozy/mvp-preview';
import { requireKeepCozyContext } from '@/modules/keepcozy/server';
import { withSpaceParam } from '@/modules/spaces/url';

type IssueDetailPageProps = {
  params: Promise<{
    issueId: string;
  }>;
  searchParams: Promise<{
    space?: string;
  }>;
};

export default async function IssueDetailPage({
  params,
  searchParams,
}: IssueDetailPageProps) {
  const [{ issueId }, query] = await Promise.all([params, searchParams]);
  const { activeSpace, language, t } = await requireKeepCozyContext({
    requestedSpaceId: query.space,
    source: 'keepcozy-issue-detail-page',
  });
  const preview = getKeepCozyPreview(language);
  const issue = getKeepCozyPreviewIssue(language, issueId);

  if (!issue) {
    notFound();
  }

  const room = getKeepCozyPreviewRoom(language, issue.roomId);
  const tasks = preview.tasks.filter((task) => task.issueId === issue.id);

  return (
    <section className="stack settings-screen settings-shell keepcozy-page">
      <section className="stack settings-hero keepcozy-hero">
        <div className="keepcozy-route-header keepcozy-route-header-spread">
          <Link
            aria-label={t.issues.browseIssues}
            className="back-arrow-link spaces-back-link"
            href={withSpaceParam('/issues', activeSpace.id)}
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

        <p className="eyebrow">{t.issues.title}</p>
        <h1 className="settings-hero-title">{issue.title}</h1>
        <p className="muted settings-hero-note">{issue.summary}</p>
      </section>

      <section className="card stack settings-surface keepcozy-surface">
        <section className="keepcozy-focus-card">
          <div className="stack keepcozy-focus-copy">
            <span className="activity-focus-kicker">{issue.status}</span>
            <h2 className="activity-focus-title">{t.issues.updatesTitle}</h2>
            <p className="muted activity-focus-body">{t.issues.detailBody}</p>
          </div>

          {room ? (
            <Link
              className="button button-secondary keepcozy-focus-action"
              href={withSpaceParam(`/rooms/${room.id}`, activeSpace.id)}
              prefetch={false}
            >
              {t.issues.viewRoom}
            </Link>
          ) : null}
        </section>

        <section className="stack settings-section keepcozy-section">
          <div className="stack keepcozy-section-copy">
            <h2 className="card-title">{t.issues.updatesTitle}</h2>
            <p className="muted">{t.issues.updatesBody}</p>
          </div>

          <div className="keepcozy-timeline">
            {issue.updates.map((update) => (
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

        <section className="stack settings-section keepcozy-section">
          <div className="stack keepcozy-section-copy">
            <h2 className="card-title">{t.issues.tasksTitle}</h2>
            <p className="muted">{t.issues.tasksBody}</p>
          </div>

          <div className="keepcozy-stack-list">
            {tasks.map((task) => (
              <Link
                key={task.id}
                className="keepcozy-secondary-card"
                href={withSpaceParam(`/tasks/${task.id}`, activeSpace.id)}
                prefetch={false}
              >
                <div className="stack keepcozy-link-copy">
                  <h3 className="card-title">{task.title}</h3>
                  <p className="muted">{task.summary}</p>
                </div>
                <span className="summary-pill summary-pill-muted">{task.status}</span>
              </Link>
            ))}
          </div>
        </section>
      </section>
    </section>
  );
}
