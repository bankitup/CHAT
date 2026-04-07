import Link from 'next/link';
import { getKeepCozyPreview } from '@/modules/keepcozy/mvp-preview';
import { requireKeepCozyContext } from '@/modules/keepcozy/server';
import { withSpaceParam } from '@/modules/spaces/url';

type RoomsPageProps = {
  searchParams: Promise<{
    space?: string;
  }>;
};

export default async function RoomsPage({ searchParams }: RoomsPageProps) {
  const query = await searchParams;
  const { activeSpace, language, t } = await requireKeepCozyContext({
    requestedSpaceId: query.space,
    source: 'keepcozy-rooms-page',
  });
  const preview = getKeepCozyPreview(language);

  return (
    <section className="stack settings-screen settings-shell keepcozy-page">
      <section className="stack settings-hero keepcozy-hero">
        <div className="keepcozy-route-header">
          <Link
            aria-label={t.rooms.backToHome}
            className="back-arrow-link spaces-back-link"
            href={withSpaceParam('/home', activeSpace.id)}
            prefetch={false}
          >
            <span aria-hidden="true">←</span>
          </Link>
        </div>

        <p className="eyebrow">{t.shell.rooms}</p>
        <h1 className="settings-hero-title">{t.rooms.title}</h1>
        <p className="muted settings-hero-note">{t.rooms.subtitle}</p>
      </section>

      <section className="card stack settings-surface keepcozy-surface">
        <section className="empty-card keepcozy-preview-card">
          <div className="keepcozy-preview-header">
            <span className="summary-pill summary-pill-muted">{t.rooms.previewPill}</span>
            <span className="keepcozy-context-label">
              {t.rooms.selectedHomeLabel}: {activeSpace.name}
            </span>
          </div>
          <p className="muted">{t.rooms.previewBody}</p>
        </section>

        <div className="keepcozy-stack-list">
          {preview.rooms.map((room) => {
            const issueCount = preview.issues.filter((issue) => issue.roomId === room.id).length;
            const taskCount = preview.tasks.filter((task) => {
              const issue = preview.issues.find((candidate) => candidate.id === task.issueId);
              return issue?.roomId === room.id;
            }).length;

            return (
              <article key={room.id} className="keepcozy-detail-card">
                <Link
                  className="stack keepcozy-detail-copy"
                  href={withSpaceParam(`/rooms/${room.id}`, activeSpace.id)}
                  prefetch={false}
                >
                  <div className="keepcozy-detail-header">
                    <div className="stack keepcozy-detail-heading">
                      <h2 className="card-title">{room.name}</h2>
                      <p className="muted">{room.summary}</p>
                    </div>
                    <span className="summary-pill summary-pill-muted">{t.rooms.detailTitle}</span>
                  </div>

                  <p className="keepcozy-detail-body">{room.focus}</p>
                </Link>

                <div className="keepcozy-meta-row">
                  <span className="keepcozy-meta-pill">
                    {t.rooms.issuesLabel}: {issueCount}
                  </span>
                  <span className="keepcozy-meta-pill">
                    {t.rooms.tasksLabel}: {taskCount}
                  </span>
                </div>

                <p className="muted keepcozy-history-note">
                  {t.rooms.historyLabel}: {room.historyNote}
                </p>

                <div className="keepcozy-card-actions">
                  <Link
                    className="pill"
                    href={withSpaceParam(`/issues?room=${room.id}`, activeSpace.id)}
                    prefetch={false}
                  >
                    {t.rooms.viewIssues}
                  </Link>
                  <Link
                    className="button button-secondary"
                    href={withSpaceParam(`/tasks?room=${room.id}`, activeSpace.id)}
                    prefetch={false}
                  >
                    {t.rooms.viewTasks}
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </section>
  );
}
