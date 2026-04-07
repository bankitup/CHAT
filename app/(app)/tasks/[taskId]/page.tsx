import Link from 'next/link';
import { notFound } from 'next/navigation';
import { appendTaskUpdateAction } from '../actions';
import {
  getKeepCozyTaskDetailData,
  requireKeepCozyContext,
} from '@/modules/keepcozy/server';
import { sanitizeUserFacingErrorMessage } from '@/modules/messaging/ui/user-facing-errors';
import { withSpaceParam } from '@/modules/spaces/url';

type TaskDetailPageProps = {
  params: Promise<{
    taskId: string;
  }>;
  searchParams: Promise<{
    error?: string;
    message?: string;
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
  const { issue, room, task } = await getKeepCozyTaskDetailData({
    language,
    spaceId: activeSpace.id,
    taskId,
  });

  if (!task) {
    notFound();
  }

  const visibleError = query.error
    ? sanitizeUserFacingErrorMessage({
        fallback: t.tasks.updateFailed,
        language,
        rawMessage: query.error,
      })
    : null;
  const visibleMessage = query.message?.trim() || null;

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
        <p className="muted settings-hero-note">{task.summary || t.tasks.detailBody}</p>
      </section>

      {visibleError ? <p className="notice notice-error">{visibleError}</p> : null}
      {visibleMessage ? (
        <div aria-live="polite" className="notice notice-success notice-inline">
          <span aria-hidden="true" className="notice-check">
            ✓
          </span>
          <span className="notice-copy">{visibleMessage}</span>
        </div>
      ) : null}

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
            <h2 className="card-title">{t.tasks.appendTitle}</h2>
            <p className="muted">{t.tasks.appendBody}</p>
          </div>

          <form action={appendTaskUpdateAction} className="stack">
            <input name="spaceId" type="hidden" value={activeSpace.id} />
            <input name="taskId" type="hidden" value={task.id} />

            <label className="field">
              <span>{t.tasks.fieldUpdateLabel}</span>
              <input className="input" name="label" />
            </label>

            <label className="field">
              <span>{t.tasks.fieldStatus}</span>
              <select className="input" defaultValue="" name="status">
                <option value="">{t.tasks.statusKeepCurrent}</option>
                <option value="planned">{t.tasks.statusPlanned}</option>
                <option value="active">{t.tasks.statusActive}</option>
                <option value="waiting">{t.tasks.statusWaiting}</option>
                <option value="done">{t.tasks.statusDone}</option>
                <option value="cancelled">{t.tasks.statusCancelled}</option>
              </select>
            </label>

            <label className="field">
              <span>{t.tasks.fieldUpdateBody}</span>
              <textarea className="input textarea" name="body" required />
            </label>

            <button className="button" type="submit">
              {t.tasks.submitUpdate}
            </button>
          </form>
        </section>

        <section className="stack settings-section keepcozy-section">
          <div className="stack keepcozy-section-copy">
            <h2 className="card-title">{t.tasks.updatesTitle}</h2>
            <p className="muted">{t.tasks.updatesBody}</p>
          </div>

          <div className="keepcozy-timeline">
            {task.updates.length > 0 ? (
              task.updates.map((update) => (
                <article key={update.id} className="keepcozy-timeline-item">
                  <div className="keepcozy-timeline-topline">
                    <h3 className="card-title">{update.label}</h3>
                    <span className="keepcozy-timestamp">{update.timestamp}</span>
                  </div>
                  <p className="muted">{update.note}</p>
                </article>
              ))
            ) : (
              <section className="empty-card">
                <p className="muted">{t.tasks.updatesBody}</p>
              </section>
            )}
          </div>
        </section>

        {issue ? (
          <section className="stack settings-section keepcozy-section">
            <div className="stack keepcozy-section-copy">
              <h2 className="card-title">{t.tasks.viewIssue}</h2>
              <p className="muted">{issue.summary || t.issues.detailBody}</p>
            </div>
            <Link
              className="keepcozy-secondary-card"
              href={withSpaceParam(`/issues/${issue.id}`, activeSpace.id)}
              prefetch={false}
            >
              <div className="stack keepcozy-link-copy">
                <h3 className="card-title">{issue.title}</h3>
                <p className="muted">{issue.nextStep || t.issues.tasksBody}</p>
              </div>
              <span className="summary-pill summary-pill-muted">{issue.status}</span>
            </Link>
          </section>
        ) : null}
      </section>
    </section>
  );
}
