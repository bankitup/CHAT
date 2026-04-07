import Link from 'next/link';
import {
  getKeepCozyPrimaryTestFlowHints,
  getKeepCozyHomeDashboardData,
  isKeepCozyPrimaryTestHomeName,
  requireKeepCozyContext,
} from '@/modules/keepcozy/server';
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
              <span className="keepcozy-link-count">{counts.rooms}</span>
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
              <span className="keepcozy-link-count">{counts.issues}</span>
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
              <span className="keepcozy-link-count">{counts.tasks}</span>
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
              <span className="keepcozy-link-count">{counts.history}</span>
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
            <h2 className="card-title">{t.homeDashboard.testFlowTitle}</h2>
            <p className="muted">{t.homeDashboard.testFlowBody}</p>
          </div>

          {showPrimaryFlow && primaryFlow ? (
            <article className="keepcozy-detail-card">
              <div className="keepcozy-detail-header">
                <div className="stack keepcozy-detail-heading">
                  <h3 className="card-title">{primaryFlow.issue.title}</h3>
                  <p className="muted">{primaryFlow.issue.summary || t.issues.detailBody}</p>
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
                    <h4 className="card-title">{t.homeDashboard.currentHomeLabel}</h4>
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
                  {testFlowHomeHint}
                </span>
                <span className="keepcozy-meta-pill">{primaryFlowHints.roomNameHint}</span>
                <span className="keepcozy-meta-pill">{primaryFlowHints.issueTitleHint}</span>
                <span className="keepcozy-meta-pill">{primaryFlowHints.taskTitleHint}</span>
              </div>
              <div className="keepcozy-card-actions">
                <Link
                  className="button"
                  href={withSpaceParam('/spaces', activeSpace.id)}
                  prefetch={false}
                >
                  {t.homeDashboard.switchHome}
                </Link>
                {showPrimaryFlow ? (
                  <>
                    <Link
                      className="button button-secondary"
                      href={withSpaceParam('/rooms', activeSpace.id)}
                      prefetch={false}
                    >
                      {t.homeDashboard.openRooms}
                    </Link>
                    <Link
                      className="button button-secondary"
                      href={withSpaceParam('/activity', activeSpace.id)}
                      prefetch={false}
                    >
                      {t.homeDashboard.openHistory}
                    </Link>
                  </>
                ) : null}
              </div>
            </section>
          )}
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
