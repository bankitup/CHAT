import Link from 'next/link';

export type SpaceUsageMetricViewModel = {
  id: 'admins' | 'call-minutes' | 'members' | 'storage';
  label: string;
  limitLabel: string;
  progressPercent: number;
  tone: 'future' | 'live';
  usedLabel: string;
};

type SpaceUsageCardProps = {
  copy: {
    body: string;
    currentPlanLabel: string;
    futureTrackingNote: string;
    managePlanAction: string;
    previewPill: string;
    title: string;
    upgradeAction: string;
  };
  managePlanHref: string;
  metrics: SpaceUsageMetricViewModel[];
  planLabel: string;
  upgradeRecommended?: boolean;
  upgradeHref: string;
};

export function SpaceUsageCard({
  copy,
  managePlanHref,
  metrics,
  planLabel,
  upgradeRecommended = false,
  upgradeHref,
}: SpaceUsageCardProps) {
  return (
    <section
      className="card stack settings-surface settings-home-card messenger-home-usage-card"
      id="space-usage"
    >
      <div className="stack messenger-home-usage-panel">
        <div className="messenger-home-usage-header">
          <div className="stack settings-card-copy settings-section-copy messenger-home-usage-copy">
            <h2 className="section-title">{copy.title}</h2>
            <p className="muted">{copy.body}</p>
          </div>
          <span className="summary-pill summary-pill-muted">
            {copy.previewPill}
          </span>
        </div>

        <section
          className={
            upgradeRecommended
              ? 'messenger-home-usage-plan-band messenger-home-usage-plan-band-upgrade'
              : 'messenger-home-usage-plan-band'
          }
        >
          <div className="stack messenger-home-usage-plan-copy">
            <span className="messenger-home-usage-kicker">
              {copy.currentPlanLabel}
            </span>
            <h3 className="card-title messenger-home-usage-plan-value">
              {planLabel}
            </h3>
          </div>

          <div className="messenger-home-usage-actions">
            <Link
              className="button button-secondary"
              href={managePlanHref}
              prefetch={false}
            >
              {copy.managePlanAction}
            </Link>
            <Link
              className={
                upgradeRecommended
                  ? 'button messenger-home-usage-upgrade-action'
                  : 'pill'
              }
              href={upgradeHref}
              prefetch={false}
            >
              {copy.upgradeAction}
            </Link>
          </div>
        </section>

        <div className="messenger-home-usage-metrics">
          {metrics.map((metric) => (
            <article
              key={metric.id}
              className={
                metric.tone === 'future'
                  ? 'messenger-home-usage-metric messenger-home-usage-metric-future'
                  : 'messenger-home-usage-metric'
              }
            >
              <div className="messenger-home-usage-metric-topline">
                <span className="messenger-home-usage-metric-label">
                  {metric.label}
                </span>
                <span className="messenger-home-usage-metric-value">
                  {metric.usedLabel} / {metric.limitLabel}
                </span>
              </div>
              <span aria-hidden="true" className="messenger-home-usage-meter">
                <span
                  className="messenger-home-usage-meter-fill"
                  style={{ width: `${metric.progressPercent}%` }}
                />
              </span>
            </article>
          ))}
        </div>

        <p className="messenger-home-usage-note">{copy.futureTrackingNote}</p>
      </div>
    </section>
  );
}
