import Link from 'next/link';
import { createTaskAction } from '../actions';
import {
  getKeepCozyIssuesPageData,
  requireKeepCozyContext,
} from '@/modules/keepcozy/server';
import { sanitizeUserFacingErrorMessage } from '@/modules/messaging/ui/user-facing-errors';
import { withSpaceParam } from '@/modules/spaces/url';

type NewTaskPageProps = {
  searchParams: Promise<{
    error?: string;
    firstUpdateBody?: string;
    issue?: string;
    message?: string;
    nextStep?: string;
    space?: string;
    summary?: string;
    title?: string;
  }>;
};

export default async function NewTaskPage({ searchParams }: NewTaskPageProps) {
  const query = await searchParams;
  const { activeSpace, language, t } = await requireKeepCozyContext({
    requestedSpaceId: query.space,
    source: 'keepcozy-new-task-page',
  });
  const { issues } = await getKeepCozyIssuesPageData({
    language,
    spaceId: activeSpace.id,
  });
  const selectedIssue = query.issue
    ? issues.find((candidate) => candidate.id === query.issue) ?? null
    : null;
  const draft = {
    firstUpdateBody: query.firstUpdateBody ?? '',
    nextStep: query.nextStep ?? '',
    summary: query.summary ?? '',
    title: query.title ?? '',
  };
  const missingSelectedIssue = Boolean(query.issue?.trim()) && !selectedIssue;
  const visibleError = query.error
    ? sanitizeUserFacingErrorMessage({
        fallback: t.tasks.createFailed,
        language,
        rawMessage: query.error,
      })
    : null;
  const visibleMessage = query.message?.trim() || null;

  return (
    <section className="stack settings-screen settings-shell keepcozy-page">
      <section className="stack settings-hero keepcozy-hero">
        <div className="keepcozy-route-header">
          <Link
            aria-label={t.tasks.browseTasks}
            className="back-arrow-link spaces-back-link"
            href={withSpaceParam('/tasks', activeSpace.id)}
            prefetch={false}
          >
            <span aria-hidden="true">←</span>
          </Link>
        </div>

        <p className="eyebrow">{t.tasks.createTitle}</p>
        <h1 className="settings-hero-title">{t.tasks.create}</h1>
        <p className="muted settings-hero-note">{t.tasks.createSubtitle}</p>
      </section>

      {visibleError ? <p className="notice notice-error">{visibleError}</p> : null}
      {missingSelectedIssue ? (
        <p className="notice notice-error">{t.tasks.issueMissing}</p>
      ) : null}
      {visibleMessage ? (
        <div aria-live="polite" className="notice notice-success notice-inline">
          <span aria-hidden="true" className="notice-check">
            ✓
          </span>
          <span className="notice-copy">{visibleMessage}</span>
        </div>
      ) : null}

      <section className="card stack settings-surface keepcozy-surface">
        <section className="empty-card keepcozy-preview-card">
          <div className="keepcozy-preview-header">
            <span className="summary-pill summary-pill-muted">{t.tasks.previewPill}</span>
            <span className="keepcozy-context-label">
              {t.tasks.selectedHomeLabel}: {activeSpace.name}
            </span>
          </div>
          <h2 className="card-title">{t.tasks.draftTitle}</h2>
          <p className="muted">{t.tasks.draftBody}</p>
        </section>

        {selectedIssue ? (
          <section className="empty-card keepcozy-preview-card">
            <div className="keepcozy-meta-row">
              <span className="keepcozy-meta-pill">
                {t.tasks.fieldIssue}: {selectedIssue.title}
              </span>
              {selectedIssue.roomName ? (
                <span className="keepcozy-meta-pill">
                  {t.tasks.viewRoom}: {selectedIssue.roomName}
                </span>
              ) : null}
            </div>
            <p className="muted keepcozy-field-note">{t.tasks.issueLinkNote}</p>
          </section>
        ) : null}

        {issues.length > 0 ? (
          <form action={createTaskAction} className="stack settings-section keepcozy-section">
            <input name="spaceId" type="hidden" value={activeSpace.id} />

            <label className="field">
              <span>{t.tasks.fieldHome}</span>
              <input className="input" readOnly value={activeSpace.name} />
            </label>

            <label className="field">
              <span>{t.tasks.fieldIssue}</span>
              <select
                className="input"
                defaultValue={selectedIssue?.id ?? ''}
                name="issueSlug"
                required
              >
                <option value="">{t.tasks.allIssues}</option>
                {issues.map((issue) => (
                  <option key={issue.id} value={issue.id}>
                    {issue.title}
                  </option>
                ))}
              </select>
              <p className="muted keepcozy-field-note">{t.tasks.issueLinkNote}</p>
            </label>

            <label className="field">
              <span>{t.tasks.fieldTask}</span>
              <input
                autoComplete="off"
                className="input"
                defaultValue={draft.title}
                name="title"
                placeholder={selectedIssue ? `${selectedIssue.title}: ` : ''}
                required
              />
            </label>

            <label className="field">
              <span>{t.tasks.fieldSummary}</span>
              <textarea className="input textarea" defaultValue={draft.summary} name="summary" />
            </label>

            <label className="field">
              <span>{t.tasks.fieldNextStep}</span>
              <input className="input" defaultValue={draft.nextStep} name="nextStep" />
            </label>

            <label className="field">
              <span>{t.tasks.fieldFirstUpdate}</span>
              <textarea
                className="input textarea"
                defaultValue={draft.firstUpdateBody}
                name="firstUpdateBody"
                required
              />
              <p className="muted keepcozy-field-note">{t.tasks.firstUpdateHint}</p>
            </label>

            <p className="muted">{t.tasks.createNote}</p>

            <button className="button keepcozy-form-submit" type="submit">
              {t.tasks.submitCreate}
            </button>
          </form>
        ) : (
          <section className="empty-card">
            <h2 className="card-title">{t.tasks.fieldIssue}</h2>
            <p className="muted">{t.tasks.createIssueFirstBody}</p>
            <Link
              className="button"
              href={withSpaceParam('/issues/new', activeSpace.id)}
              prefetch={false}
            >
              {t.issues.create}
            </Link>
          </section>
        )}
      </section>
    </section>
  );
}
