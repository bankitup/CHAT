import type { HomeSpaceUsageCardData, HomeSpaceUsageCardMetric } from './space-usage-contract';
import Link from 'next/link';

function resolveMetricClassName(metric: HomeSpaceUsageCardMetric) {
  const classNames = ['messenger-home-usage-metric'];

  if (metric.tone === 'future') {
    classNames.push('messenger-home-usage-metric-future');
  }

  if (metric.state === 'nearing') {
    classNames.push('messenger-home-usage-metric-nearing');
  }

  if (metric.state === 'over') {
    classNames.push('messenger-home-usage-metric-over');
  }

  return classNames.join(' ');
}

function resolveUsageStatePillClassName(state: HomeSpaceUsageCardMetric['state']) {
  switch (state) {
    case 'future':
      return 'messenger-home-usage-state-pill messenger-home-usage-state-pill-future';
    case 'nearing':
      return 'messenger-home-usage-state-pill messenger-home-usage-state-pill-nearing';
    case 'over':
      return 'messenger-home-usage-state-pill messenger-home-usage-state-pill-over';
    default:
      return 'messenger-home-usage-state-pill';
  }
}

export function SpaceUsageCard({
  copy,
  managePlanHref,
  metrics,
  planLabel,
  planState,
  planStateLabel = null,
  planSummary = null,
  upgradeRecommended = false,
  upgradeActionLabel,
  upgradeHref,
}: HomeSpaceUsageCardData) {
  const planBandClassName =
    planState === 'over'
      ? 'messenger-home-usage-plan-band messenger-home-usage-plan-band-over'
      : planState === 'nearing'
        ? 'messenger-home-usage-plan-band messenger-home-usage-plan-band-nearing'
        : 'messenger-home-usage-plan-band';

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
          className={planBandClassName}
        >
          <div className="stack messenger-home-usage-plan-copy">
            <div className="messenger-home-usage-plan-topline">
              <span className="messenger-home-usage-kicker">
                {copy.currentPlanLabel}
              </span>
              {planStateLabel ? (
                <span className={resolveUsageStatePillClassName(planState)}>
                  {planStateLabel}
                </span>
              ) : null}
            </div>
            <h3 className="card-title messenger-home-usage-plan-value">
              {planLabel}
            </h3>
            {planSummary ? (
              <p className="messenger-home-usage-plan-summary">{planSummary}</p>
            ) : null}
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
              {upgradeActionLabel}
            </Link>
          </div>
        </section>

        <div className="messenger-home-usage-metrics">
          {metrics.map((metric) => (
            <article
              key={metric.id}
              className={resolveMetricClassName(metric)}
            >
              <div className="messenger-home-usage-metric-topline">
                <span className="messenger-home-usage-metric-label">
                  {metric.label}
                </span>
                <span className="messenger-home-usage-metric-value-group">
                  <span className="messenger-home-usage-metric-value">
                    {metric.usedLabel} / {metric.limitLabel}
                  </span>
                  {metric.stateLabel ? (
                    <span className={resolveUsageStatePillClassName(metric.state)}>
                      {metric.stateLabel}
                    </span>
                  ) : null}
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
