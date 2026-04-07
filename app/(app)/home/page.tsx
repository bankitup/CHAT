import Link from 'next/link';
import { getKeepCozyPreview } from '@/modules/keepcozy/mvp-preview';
import { requireKeepCozyContext } from '@/modules/keepcozy/server';
import { withSpaceParam } from '@/modules/spaces/url';

type HomeDashboardPageProps = {
  searchParams: Promise<{
    space?: string;
  }>;
};

export default async function HomeDashboardPage({
  searchParams,
}: HomeDashboardPageProps) {
  const query = await searchParams;
  const { activeSpace, language, t } = await requireKeepCozyContext({
    requestedSpaceId: query.space,
    source: 'keepcozy-home-dashboard',
  });
  const preview = getKeepCozyPreview(language);

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
            <span className="activity-focus-kicker">{t.homeDashboard.currentHomeLabel}</span>
            <h2 className="activity-focus-title">{activeSpace.name}</h2>
            <p className="muted activity-focus-body">{t.homeDashboard.previewBody}</p>
          </div>

          <Link
            className="button button-secondary keepcozy-focus-action"
            href={withSpaceParam('/spaces', activeSpace.id)}
            prefetch={false}
          >
            {t.homeDashboard.switchHome}
          </Link>
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
              <span className="keepcozy-link-count">{preview.rooms.length}</span>
              <div className="stack keepcozy-link-copy">
                <h3 className="card-title">{t.homeDashboard.roomsTitle}</h3>
                <p className="muted">{t.homeDashboard.roomsBody}</p>
              </div>
              <span className="pill keepcozy-link-action">{t.homeDashboard.openRooms}</span>
            </Link>

            <Link
              className="keepcozy-link-card"
              href={withSpaceParam('/issues', activeSpace.id)}
              prefetch={false}
            >
              <span className="keepcozy-link-count">{preview.issues.length}</span>
              <div className="stack keepcozy-link-copy">
                <h3 className="card-title">{t.homeDashboard.issuesTitle}</h3>
                <p className="muted">{t.homeDashboard.issuesBody}</p>
              </div>
              <span className="pill keepcozy-link-action">{t.homeDashboard.openIssues}</span>
            </Link>

            <Link
              className="keepcozy-link-card"
              href={withSpaceParam('/tasks', activeSpace.id)}
              prefetch={false}
            >
              <span className="keepcozy-link-count">{preview.tasks.length}</span>
              <div className="stack keepcozy-link-copy">
                <h3 className="card-title">{t.homeDashboard.tasksTitle}</h3>
                <p className="muted">{t.homeDashboard.tasksBody}</p>
              </div>
              <span className="pill keepcozy-link-action">{t.homeDashboard.openTasks}</span>
            </Link>

            <Link
              className="keepcozy-link-card"
              href={withSpaceParam('/activity', activeSpace.id)}
              prefetch={false}
            >
              <span className="keepcozy-link-count">{preview.issues.length + preview.tasks.length}</span>
              <div className="stack keepcozy-link-copy">
                <h3 className="card-title">{t.homeDashboard.historyTitle}</h3>
                <p className="muted">{t.homeDashboard.historyBody}</p>
              </div>
              <span className="pill keepcozy-link-action">{t.homeDashboard.openHistory}</span>
            </Link>
          </div>
        </section>

        <section className="stack settings-section keepcozy-section">
          <div className="stack keepcozy-section-copy">
            <h2 className="card-title">{t.homeDashboard.supportTitle}</h2>
            <p className="muted">{t.homeDashboard.supportBody}</p>
          </div>

          <div className="keepcozy-secondary-grid">
            <Link
              className="keepcozy-secondary-card"
              href={withSpaceParam('/inbox', activeSpace.id)}
              prefetch={false}
            >
              <div className="stack keepcozy-link-copy">
                <h3 className="card-title">{t.homeDashboard.secondaryChatsTitle}</h3>
                <p className="muted">{t.homeDashboard.secondaryChatsBody}</p>
              </div>
              <span className="summary-pill summary-pill-muted">
                {t.homeDashboard.openChats}
              </span>
            </Link>

            <Link className="keepcozy-secondary-card" href="/settings" prefetch={false}>
              <div className="stack keepcozy-link-copy">
                <h3 className="card-title">{t.homeDashboard.secondarySettingsTitle}</h3>
                <p className="muted">{t.homeDashboard.secondarySettingsBody}</p>
              </div>
              <span className="summary-pill summary-pill-muted">
                {t.homeDashboard.openSettings}
              </span>
            </Link>
          </div>
        </section>
      </section>
    </section>
  );
}
