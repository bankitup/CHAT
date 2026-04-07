import Link from 'next/link';
import { requireKeepCozyContext } from '@/modules/keepcozy/server';
import { withSpaceParam } from '@/modules/spaces/url';

type NewTaskPageProps = {
  searchParams: Promise<{
    space?: string;
  }>;
};

export default async function NewTaskPage({ searchParams }: NewTaskPageProps) {
  const query = await searchParams;
  const { activeSpace, t } = await requireKeepCozyContext({
    requestedSpaceId: query.space,
    source: 'keepcozy-new-task-page',
  });

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

        <div className="keepcozy-stack-list">
          <section className="keepcozy-secondary-card">
            <div className="stack keepcozy-link-copy">
              <h3 className="card-title">{t.tasks.fieldHome}</h3>
              <p className="muted">{activeSpace.name}</p>
            </div>
          </section>

          <section className="keepcozy-secondary-card">
            <div className="stack keepcozy-link-copy">
              <h3 className="card-title">{t.tasks.fieldIssue}</h3>
              <p className="muted">{t.issues.title}</p>
            </div>
          </section>

          <section className="keepcozy-secondary-card">
            <div className="stack keepcozy-link-copy">
              <h3 className="card-title">{t.tasks.fieldTask}</h3>
              <p className="muted">{t.tasks.detailBody}</p>
            </div>
          </section>

          <section className="keepcozy-secondary-card">
            <div className="stack keepcozy-link-copy">
              <h3 className="card-title">{t.tasks.fieldFirstUpdate}</h3>
              <p className="muted">{t.tasks.updatesBody}</p>
            </div>
          </section>

          <section className="keepcozy-secondary-card">
            <div className="stack keepcozy-link-copy">
              <h3 className="card-title">{t.tasks.fieldAttachments}</h3>
              <p className="muted">{t.tasks.createNote}</p>
            </div>
          </section>
        </div>
      </section>
    </section>
  );
}
