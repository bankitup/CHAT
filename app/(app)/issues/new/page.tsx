import Link from 'next/link';
import { requireKeepCozyContext } from '@/modules/keepcozy/server';
import { withSpaceParam } from '@/modules/spaces/url';

type NewIssuePageProps = {
  searchParams: Promise<{
    space?: string;
  }>;
};

export default async function NewIssuePage({ searchParams }: NewIssuePageProps) {
  const query = await searchParams;
  const { activeSpace, t } = await requireKeepCozyContext({
    requestedSpaceId: query.space,
    source: 'keepcozy-new-issue-page',
  });

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

        <div className="keepcozy-stack-list">
          <section className="keepcozy-secondary-card">
            <div className="stack keepcozy-link-copy">
              <h3 className="card-title">{t.issues.fieldHome}</h3>
              <p className="muted">{activeSpace.name}</p>
            </div>
          </section>

          <section className="keepcozy-secondary-card">
            <div className="stack keepcozy-link-copy">
              <h3 className="card-title">{t.issues.fieldRoom}</h3>
              <p className="muted">{t.rooms.title}</p>
            </div>
          </section>

          <section className="keepcozy-secondary-card">
            <div className="stack keepcozy-link-copy">
              <h3 className="card-title">{t.issues.fieldSummary}</h3>
              <p className="muted">{t.issues.detailBody}</p>
            </div>
          </section>

          <section className="keepcozy-secondary-card">
            <div className="stack keepcozy-link-copy">
              <h3 className="card-title">{t.issues.fieldFirstUpdate}</h3>
              <p className="muted">{t.issues.updatesBody}</p>
            </div>
          </section>

          <section className="keepcozy-secondary-card">
            <div className="stack keepcozy-link-copy">
              <h3 className="card-title">{t.issues.fieldAttachments}</h3>
              <p className="muted">{t.issues.createNote}</p>
            </div>
          </section>
        </div>
      </section>
    </section>
  );
}
