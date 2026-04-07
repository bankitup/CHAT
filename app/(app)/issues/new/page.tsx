import Link from 'next/link';
import { createIssueAction } from '../actions';
import {
  getKeepCozyRoomsPageData,
  requireKeepCozyContext,
} from '@/modules/keepcozy/server';
import { sanitizeUserFacingErrorMessage } from '@/modules/messaging/ui/user-facing-errors';
import { withSpaceParam } from '@/modules/spaces/url';

type NewIssuePageProps = {
  searchParams: Promise<{
    error?: string;
    message?: string;
    room?: string;
    space?: string;
  }>;
};

export default async function NewIssuePage({ searchParams }: NewIssuePageProps) {
  const query = await searchParams;
  const { activeSpace, language, t } = await requireKeepCozyContext({
    requestedSpaceId: query.space,
    source: 'keepcozy-new-issue-page',
  });
  const { rooms } = await getKeepCozyRoomsPageData({
    language,
    spaceId: activeSpace.id,
  });
  const selectedRoom = query.room
    ? rooms.find((candidate) => candidate.id === query.room) ?? null
    : null;
  const visibleError = query.error
    ? sanitizeUserFacingErrorMessage({
        fallback: t.issues.createFailed,
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
            aria-label={t.issues.browseIssues}
            className="back-arrow-link spaces-back-link"
            href={withSpaceParam('/issues', activeSpace.id)}
            prefetch={false}
          >
            <span aria-hidden="true">←</span>
          </Link>
        </div>

        <p className="eyebrow">{t.issues.createTitle}</p>
        <h1 className="settings-hero-title">{t.issues.create}</h1>
        <p className="muted settings-hero-note">{t.issues.createSubtitle}</p>
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
        <section className="empty-card keepcozy-preview-card">
          <div className="keepcozy-preview-header">
            <span className="summary-pill summary-pill-muted">{t.issues.previewPill}</span>
            <span className="keepcozy-context-label">
              {t.issues.selectedHomeLabel}: {activeSpace.name}
            </span>
          </div>
          <h2 className="card-title">{t.issues.draftTitle}</h2>
          <p className="muted">{t.issues.draftBody}</p>
        </section>

        <form action={createIssueAction} className="stack settings-section keepcozy-section">
          <input name="spaceId" type="hidden" value={activeSpace.id} />

          <label className="field">
            <span>{t.issues.fieldHome}</span>
            <input className="input" readOnly value={activeSpace.name} />
          </label>

          <label className="field">
            <span>{t.issues.fieldRoom}</span>
            <select
              className="input"
              defaultValue={selectedRoom?.id ?? ''}
              name="roomSlug"
            >
              <option value="">{t.issues.allRooms}</option>
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>{t.issues.fieldTitle}</span>
            <input
              autoComplete="off"
              className="input"
              name="title"
              placeholder={selectedRoom ? `${selectedRoom.name}: ` : ''}
              required
            />
          </label>

          <label className="field">
            <span>{t.issues.fieldSummary}</span>
            <textarea className="input textarea" name="summary" />
          </label>

          <label className="field">
            <span>{t.issues.fieldNextStep}</span>
            <input className="input" name="nextStep" />
          </label>

          <label className="field">
            <span>{t.issues.fieldFirstUpdate}</span>
            <textarea className="input textarea" name="firstUpdateBody" required />
          </label>

          <p className="muted">{t.issues.createNote}</p>

          <button className="button" type="submit">
            {t.issues.submitCreate}
          </button>
        </form>
      </section>
    </section>
  );
}
