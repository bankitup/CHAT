import Link from 'next/link';
import {
  getKeepCozyRoomsPageData,
  isKeepCozyPrimaryTestHomeName,
  requireKeepCozyContext,
} from '@/modules/keepcozy/server';
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
  const { rooms } = await getKeepCozyRoomsPageData({
    language,
    spaceId: activeSpace.id,
  });
  const isPrimaryTestHome = isKeepCozyPrimaryTestHomeName(activeSpace.name);

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
            <span className="summary-pill summary-pill-muted">
              {t.homeDashboard.currentHomeLabel}
            </span>
            <span className="keepcozy-context-label">{activeSpace.name}</span>
          </div>
          <p className="muted">{t.rooms.previewBody}</p>
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
              href={withSpaceParam('/home', activeSpace.id)}
              prefetch={false}
            >
              {t.shell.openHome}
            </Link>
          </div>
        </section>

        {rooms.length > 0 ? (
          <div className="keepcozy-stack-list">
            {rooms.map((room) => (
              <article key={room.id} className="keepcozy-detail-card">
                <Link
                  className="stack keepcozy-detail-copy"
                  href={withSpaceParam(`/rooms/${room.id}`, activeSpace.id)}
                  prefetch={false}
                >
                  <div className="keepcozy-detail-header">
                    <div className="stack keepcozy-detail-heading">
                      <h2 className="card-title">{room.name}</h2>
                      <p className="muted">{room.summary || t.rooms.detailBody}</p>
                    </div>
                    <span className="summary-pill summary-pill-muted">{t.rooms.detailTitle}</span>
                  </div>

                  <p className="keepcozy-detail-body">{t.rooms.detailBody}</p>
                </Link>

                <div className="keepcozy-meta-row">
                  <span className="keepcozy-meta-pill">
                    {t.rooms.issuesLabel}: {room.issueCount}
                  </span>
                  <span className="keepcozy-meta-pill">
                    {t.rooms.tasksLabel}: {room.taskCount}
                  </span>
                </div>

                <p className="muted keepcozy-history-note">
                  {t.rooms.historyLabel}: {t.rooms.detailHistoryTitle}
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
            ))}
          </div>
        ) : (
          <section className="empty-card keepcozy-preview-card">
            <div className="keepcozy-preview-header">
              <span className="summary-pill summary-pill-muted">{t.rooms.emptyTitle}</span>
              <span className="keepcozy-context-label">{activeSpace.name}</span>
            </div>
            <p className="muted">
              {isPrimaryTestHome ? t.rooms.emptyTestBody : t.rooms.emptyBody}
            </p>
            {isPrimaryTestHome ? (
              <div className="keepcozy-meta-row">
                <span className="keepcozy-meta-pill">TEST</span>
                <span className="keepcozy-meta-pill">Kitchen</span>
                <span className="keepcozy-meta-pill">{t.homeDashboard.issuesTitle}</span>
                <span className="keepcozy-meta-pill">{t.homeDashboard.tasksTitle}</span>
              </div>
            ) : null}
            <div className="keepcozy-card-actions">
              <Link
                className="button"
                href={withSpaceParam('/home', activeSpace.id)}
                prefetch={false}
              >
                {t.shell.openHome}
              </Link>
              <Link
                className="button button-secondary"
                href={withSpaceParam('/issues', activeSpace.id)}
                prefetch={false}
              >
                {t.shell.openIssues}
              </Link>
              <Link
                className="pill"
                href={withSpaceParam('/spaces', activeSpace.id)}
                prefetch={false}
              >
                {t.homeDashboard.switchHome}
              </Link>
            </div>
          </section>
        )}
      </section>
    </section>
  );
}
