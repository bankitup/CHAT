import Link from 'next/link';

type PrivateSpaceCtaCardProps = {
  actionHref: string;
  copy: {
    action: string;
    badge: string;
    body: string;
    note: string;
    title: string;
  };
};

export function PrivateSpaceCtaCard({
  actionHref,
  copy,
}: PrivateSpaceCtaCardProps) {
  return (
    <section className="card stack settings-surface settings-home-card home-private-space-cta">
      <div className="stack home-private-space-cta-panel">
        <div className="home-private-space-cta-header">
          <div className="stack settings-card-copy settings-section-copy">
            <h2 className="section-title">{copy.title}</h2>
            <p className="muted">{copy.body}</p>
          </div>
          <span className="summary-pill summary-pill-muted">
            {copy.badge}
          </span>
        </div>

        <div className="home-private-space-cta-band">
          <p className="home-private-space-cta-note">{copy.note}</p>

          <div className="home-private-space-cta-actions">
            <Link className="button" href={actionHref} prefetch={false}>
              {copy.action}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
