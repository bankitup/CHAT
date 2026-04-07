import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  getKeepCozyPreview,
  getKeepCozyPreviewRoom,
} from '@/modules/keepcozy/mvp-preview';
import { requireKeepCozyContext } from '@/modules/keepcozy/server';
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
  const preview = getKeepCozyPreview(language);
  const room = getKeepCozyPreviewRoom(language, roomId);

  if (!room) {
    notFound();
  }

  const roomIssues = preview.issues.filter((issue) => issue.roomId === room.id);
  const roomTasks = preview.tasks.filter((task) =>
    roomIssues.some((issue) => issue.id === task.issueId),
  );

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
        <p className="muted settings-hero-note">{room.summary}</p>
      </section>

      <section className="card stack settings-surface keepcozy-surface">
        <section className="keepcozy-focus-card">
          <div className="stack keepcozy-focus-copy">
            <span className="activity-focus-kicker">{t.rooms.detailTitle}</span>
            <h2 className="activity-focus-title">{room.name}</h2>
            <p className="muted activity-focus-body">{t.rooms.detailBody}</p>
          </div>

          <Link
            className="button button-secondary keepcozy-focus-action"
            href={withSpaceParam(`/issues?room=${room.id}`, activeSpace.id)}
            prefetch={false}
          >
            {t.rooms.viewIssues}
          </Link>
        </section>

        <section className="stack settings-section keepcozy-section">
          <div className="stack keepcozy-section-copy">
            <h2 className="card-title">{t.rooms.issuesLabel}</h2>
            <p className="muted">{room.focus}</p>
          </div>
          <div className="keepcozy-stack-list">
            {roomIssues.map((issue) => (
              <Link
                key={issue.id}
                className="keepcozy-secondary-card"
                href={withSpaceParam(`/issues/${issue.id}`, activeSpace.id)}
                prefetch={false}
              >
                <div className="stack keepcozy-link-copy">
                  <h3 className="card-title">{issue.title}</h3>
                  <p className="muted">{issue.summary}</p>
                </div>
                <span className="summary-pill summary-pill-muted">{issue.status}</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="stack settings-section keepcozy-section">
          <div className="stack keepcozy-section-copy">
            <h2 className="card-title">{t.rooms.tasksLabel}</h2>
            <p className="muted">{t.rooms.detailHistoryTitle}</p>
          </div>
          <div className="keepcozy-stack-list">
            {roomTasks.map((task) => (
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

        <section className="stack settings-section keepcozy-section">
          <h2 className="card-title">{t.rooms.detailHistoryTitle}</h2>
          <section className="empty-card">
            <p className="muted">{room.historyNote}</p>
          </section>
        </section>
      </section>
    </section>
  );
}
