import Link from 'next/link';
import { notFound } from 'next/navigation';
import { appendIssueUpdateAction } from '../actions';
import {
  getKeepCozyIssueDetailData,
  requireKeepCozyContext,
} from '@/modules/keepcozy/server';
import { sanitizeUserFacingErrorMessage } from '@/modules/messaging/ui/user-facing-errors';
import { withSpaceParam } from '@/modules/spaces/url';

type IssueDetailPageProps = {
  params: Promise<{
    issueId: string;
  }>;
  searchParams: Promise<{
    error?: string;
    message?: string;
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
  const { issue, room, tasks } = await getKeepCozyIssueDetailData({
    issueId,
    language,
    spaceId: activeSpace.id,
  });

  if (!issue) {
    notFound();
  }

  const visibleError = query.error
    ? sanitizeUserFacingErrorMessage({
        fallback: t.issues.updateFailed,
        language,
        rawMessage: query.error,
      })
    : null;
  const visibleMessage = query.message?.trim() || null;
  const createTaskHref = withSpaceParam(
    `/tasks/new?issue=${encodeURIComponent(issue.id)}`,
    activeSpace.id,
  );

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
            href={createTaskHref}
            prefetch={false}
          >
            {t.tasks.create}
          </Link>
        </div>

        <p className="eyebrow">{t.issues.title}</p>
        <h1 className="settings-hero-title">{issue.title}</h1>
        <p className="muted settings-hero-note">{issue.summary || t.issues.detailBody}</p>
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
            <h2 className="card-title">{t.issues.appendTitle}</h2>
            <p className="muted">{t.issues.appendBody}</p>
          </div>

          <form action={appendIssueUpdateAction} className="stack">
            <input name="spaceId" type="hidden" value={activeSpace.id} />
            <input name="issueId" type="hidden" value={issue.id} />

            <label className="field">
              <span>{t.issues.fieldUpdateLabel}</span>
              <input className="input" name="label" />
            </label>

            <label className="field">
              <span>{t.issues.fieldStatus}</span>
              <select className="input" defaultValue="" name="status">
                <option value="">{t.issues.statusKeepCurrent}</option>
                <option value="open">{t.issues.statusOpen}</option>
                <option value="planned">{t.issues.statusPlanned}</option>
                <option value="in_review">{t.issues.statusInReview}</option>
                <option value="resolved">{t.issues.statusResolved}</option>
              </select>
            </label>

            <label className="field">
              <span>{t.issues.fieldUpdateBody}</span>
              <textarea className="input textarea" name="body" required />
            </label>

            <button className="button" type="submit">
              {t.issues.submitUpdate}
            </button>
          </form>
        </section>

        <section className="stack settings-section keepcozy-section">
          <div className="stack keepcozy-section-copy">
            <h2 className="card-title">{t.issues.updatesTitle}</h2>
            <p className="muted">{t.issues.updatesBody}</p>
          </div>

          <div className="keepcozy-timeline">
            {issue.updates.length > 0 ? (
              issue.updates.map((update) => (
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
                <p className="muted">{t.issues.updatesBody}</p>
              </section>
            )}
          </div>
        </section>

        <section className="stack settings-section keepcozy-section">
          <div className="stack keepcozy-section-copy">
            <h2 className="card-title">{t.issues.tasksTitle}</h2>
            <p className="muted">{t.issues.tasksBody}</p>
          </div>

          <div className="keepcozy-stack-list">
            {tasks.length > 0 ? (
              tasks.map((task) => (
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
                <p className="muted">{t.issues.tasksBody}</p>
              </section>
            )}
          </div>
        </section>
      </section>
    </section>
  );
}
