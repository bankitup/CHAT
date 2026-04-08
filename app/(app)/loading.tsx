import { getTranslations } from '@/modules/i18n';
import { getRequestLanguage } from '@/modules/i18n/server';

export default async function AppLoading() {
  const language = await getRequestLanguage();
  const t = getTranslations(language);

  return (
    <section className="stack route-loading-screen keepcozy-loading-screen" aria-label={t.shell.loadingTitle}>
      <section className="card keepcozy-loading-context">
        <div className="keepcozy-loading-context-shell">
          <section className="stack app-shell-context-block">
            <span className="app-shell-context-kicker">{t.shell.activeHomeLabel}</span>
            <div className="app-shell-context-row">
              <div className="route-loading-line route-loading-line-row-title" />
              <div className="route-loading-pill" />
            </div>
            <div className="route-loading-line route-loading-line-row-body" />
          </section>

          <section className="stack app-shell-context-block">
            <span className="app-shell-context-kicker">{t.shell.currentSectionLabel}</span>
            <div className="app-shell-context-row">
              <div className="route-loading-line route-loading-line-row-title" />
              <div className="route-loading-pill" />
            </div>
            <div className="route-loading-line route-loading-line-row-body" />
          </section>
        </div>
      </section>

      <section className="card route-loading-hero keepcozy-loading-hero">
        <div className="stack route-loading-copy">
          <p className="eyebrow">{t.homeDashboard.eyebrow}</p>
          <h1 className="section-title">{t.shell.loadingTitle}</h1>
          <p className="muted">{t.shell.loadingBody}</p>
        </div>
        <div className="keepcozy-card-actions">
          <div className="route-loading-pill" />
          <div className="route-loading-pill" />
        </div>
      </section>

      <section className="stack route-loading-list">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="card route-loading-row keepcozy-loading-row">
            <div className="stack route-loading-copy">
              <div className="route-loading-line route-loading-line-row-title" />
              <div className="route-loading-line route-loading-line-row-body" />
              <div className="keepcozy-card-actions">
                <div className="route-loading-pill" />
                <div className="route-loading-pill" />
              </div>
            </div>
          </div>
        ))}
      </section>
    </section>
  );
}
