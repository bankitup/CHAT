import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  getKeepCozyRoomDetailData,
  isKeepCozyPrimaryTestHomeName,
  isKeepCozyPrimaryTestIssueId,
  isKeepCozyPrimaryTestRoomId,
  isKeepCozyPrimaryTestTaskId,
  requireKeepCozyContext,
} from '@/modules/keepcozy/server';
import { withSpaceParam } from '@/modules/spaces/url';

type RoomDetailPageProps = {
  params: Promise<{
    roomId: string;
  }>;
  searchParams: Promise<{
    space?: string;
  }>;
};

export default async function RoomDetailPage({
  params,
  searchParams,
}: RoomDetailPageProps) {
  const [{ roomId }, query] = await Promise.all([params, searchParams]);
  const { activeSpace, language, t } = await requireKeepCozyContext({
    requestedSpaceId: query.space,
    source: 'keepcozy-room-detail-page',
  });
  const { room, roomIssues, roomTasks } = await getKeepCozyRoomDetailData({
    language,
    roomId,
    spaceId: activeSpace.id,
  });

  if (!room) {
    notFound();
  }

  const showPrimaryFlow =
    isKeepCozyPrimaryTestHomeName(activeSpace.name) && isKeepCozyPrimaryTestRoomId(room.id);
  const primaryIssue =
    roomIssues.find((candidate) => isKeepCozyPrimaryTestIssueId(candidate.id)) ?? null;
  const primaryTask =
    roomTasks.find((candidate) => isKeepCozyPrimaryTestTaskId(candidate.id)) ?? null;

  return (
    <section className="stack settings-screen settings-shell keepcozy-page">
      <section className="stack settings-hero keepcozy-hero">
        <div className="keepcozy-route-header">
          <Link
            aria-label={t.rooms.backToHome}
            className="back-arrow-link spaces-back-link"
            href={withSpaceParam('/rooms', activeSpace.id)}
            prefetch={false}
          >
            <span aria-hidden="true">←</span>
          </Link>
        </div>

        <p className="eyebrow">{t.rooms.title}</p>
        <h1 className="settings-hero-title">{room.name}</h1>
        <p className="muted settings-hero-note">{room.summary || t.rooms.detailBody}</p>
      </section>

      <section className="card stack settings-surface keepcozy-surface">
        <section className="keepcozy-focus-card">
          <div className="stack keepcozy-focus-copy">
            <span className="activity-focus-kicker">{t.rooms.detailTitle}</span>
            <h2 className="activity-focus-title">{room.name}</h2>
            <p className="muted activity-focus-body">{t.rooms.detailBody}</p>
            <div className="keepcozy-meta-row">
              <span className="keepcozy-meta-pill">
                {t.rooms.issuesLabel}: {roomIssues.length}
              </span>
              <span className="keepcozy-meta-pill">
                {t.rooms.tasksLabel}: {roomTasks.length}
              </span>
              {showPrimaryFlow ? (
                <span className="keepcozy-meta-pill">{t.homeDashboard.testFlowTitle}</span>
              ) : null}
            </div>
          </div>

          <div className="keepcozy-card-actions keepcozy-focus-actions">
            <Link
              className="button button-secondary keepcozy-focus-action"
              href={withSpaceParam(`/issues?room=${room.id}`, activeSpace.id)}
              prefetch={false}
            >
              {t.rooms.viewIssues}
            </Link>
            <Link
              className="button button-secondary keepcozy-focus-action"
              href={withSpaceParam('/activity', activeSpace.id)}
              prefetch={false}
            >
              {t.homeDashboard.openHistory}
            </Link>
          </div>
        </section>

        {showPrimaryFlow && primaryIssue && primaryTask ? (
          <section className="empty-card keepcozy-preview-card">
            <div className="keepcozy-preview-header">
              <span className="summary-pill summary-pill-muted">{t.homeDashboard.testFlowTitle}</span>
              <span className="keepcozy-context-label">{activeSpace.name}</span>
            </div>
            <h2 className="card-title">{room.name}</h2>
            <p className="muted">{t.homeDashboard.testFlowBody}</p>
            <div className="keepcozy-meta-row">
              <span className="keepcozy-meta-pill">{room.name}</span>
              <span className="keepcozy-meta-pill">{primaryIssue.title}</span>
              <span className="keepcozy-meta-pill">{primaryTask.title}</span>
            </div>
            <div className="keepcozy-card-actions">
              <Link
                className="pill"
                href={withSpaceParam(`/issues/${primaryIssue.id}`, activeSpace.id)}
                prefetch={false}
              >
                {t.homeDashboard.openIssues}
              </Link>
              <Link
                className="button button-secondary"
                href={withSpaceParam(`/tasks/${primaryTask.id}`, activeSpace.id)}
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
          </section>
        ) : null}

        <section className="stack settings-section keepcozy-section">
          <div className="stack keepcozy-section-copy">
            <h2 className="card-title">{t.rooms.issuesLabel}</h2>
            <p className="muted">{t.rooms.detailBody}</p>
          </div>
          <div className="keepcozy-stack-list">
            {roomIssues.length > 0 ? (
              roomIssues.map((issue) => (
                <Link
                  key={issue.id}
                  className="keepcozy-secondary-card"
                  href={withSpaceParam(`/issues/${issue.id}`, activeSpace.id)}
                  prefetch={false}
                >
                  <div className="stack keepcozy-link-copy">
                    <h3 className="card-title">{issue.title}</h3>
                    <p className="muted">{issue.summary || t.issues.detailBody}</p>
                  </div>
                  <span className="summary-pill summary-pill-muted">{issue.status}</span>
                </Link>
              ))
            ) : (
              <section className="empty-card">
                <p className="muted">{t.rooms.detailBody}</p>
              </section>
            )}
          </div>
        </section>

        <section className="stack settings-section keepcozy-section">
          <div className="stack keepcozy-section-copy">
            <h2 className="card-title">{t.rooms.tasksLabel}</h2>
            <p className="muted">{t.rooms.detailHistoryTitle}</p>
          </div>
          <div className="keepcozy-stack-list">
            {roomTasks.length > 0 ? (
              roomTasks.map((task) => (
                <Link
                  key={task.id}
                  className="keepcozy-secondary-card"
                  href={withSpaceParam(`/tasks/${task.id}`, activeSpace.id)}
                  prefetch={false}
                >
                  <div className="stack keepcozy-link-copy">
                    <h3 className="card-title">{task.title}</h3>
                    <p className="muted">{task.summary || t.tasks.detailBody}</p>
                  </div>
                  <span className="summary-pill summary-pill-muted">{task.status}</span>
                </Link>
              ))
            ) : (
              <section className="empty-card">
                <p className="muted">{t.tasks.detailBody}</p>
              </section>
            )}
          </div>
        </section>

        <section className="stack settings-section keepcozy-section">
          <h2 className="card-title">{t.rooms.detailHistoryTitle}</h2>
          <section className="empty-card keepcozy-preview-card">
            <p className="muted">
              {showPrimaryFlow && primaryIssue && primaryTask
                ? t.activity.testFlowBody
                : t.homeDashboard.historyBody}
            </p>
            {showPrimaryFlow && primaryIssue && primaryTask ? (
              <div className="keepcozy-meta-row">
                <span className="keepcozy-meta-pill">{room.name}</span>
                <span className="keepcozy-meta-pill">{primaryIssue.title}</span>
                <span className="keepcozy-meta-pill">{primaryTask.title}</span>
              </div>
            ) : null}
            <div className="keepcozy-card-actions">
              <Link
                className="button button-secondary"
                href={withSpaceParam('/activity', activeSpace.id)}
                prefetch={false}
              >
                {t.homeDashboard.openHistory}
              </Link>
            </div>
          </section>
        </section>
      </section>
    </section>
  );
}
