import { getTranslations } from '@/modules/i18n';
import { getRequestLanguage } from '@/modules/i18n/server';

function InboxLoadingRow() {
  return (
    <article className="conversation-card conversation-card-minimal conversation-card-dm">
      <div className="route-loading-row route-loading-inbox-row">
        <div className="route-loading-avatar" />
        <div className="stack route-loading-copy">
          <div className="route-loading-inbox-title-row">
            <div className="route-loading-line route-loading-line-row-title" />
            <div className="route-loading-pill route-loading-inbox-time" />
          </div>
          <div className="route-loading-line route-loading-line-row-body" />
        </div>
      </div>
    </article>
  );
}

export default async function InboxLoading() {
  const language = await getRequestLanguage();
  const t = getTranslations(language);

  return (
    <section
      className="stack inbox-screen inbox-screen-minimal route-loading-inbox"
      aria-label={t.shell.loadingTitle}
    >
      <section className="card inbox-home-shell inbox-home-shell-dm stack route-loading-inbox-shell">
        <div className="route-loading-inbox-topbar">
          <div className="route-loading-line route-loading-line-input route-loading-inbox-search" />
          <div className="route-loading-action-row" aria-hidden="true">
            <div className="route-loading-button" />
            <div className="route-loading-button" />
          </div>
        </div>

        <div className="route-loading-inbox-filters" aria-hidden="true">
          <span className="route-loading-pill route-loading-inbox-pill-md" />
          <span className="route-loading-pill route-loading-inbox-pill-sm" />
          <span className="route-loading-pill route-loading-inbox-pill-lg" />
        </div>

        <section className="stack conversation-list conversation-list-minimal conversation-list-dm route-loading-inbox-list">
          <InboxLoadingRow />
          <InboxLoadingRow />
          <InboxLoadingRow />
          <InboxLoadingRow />
        </section>
      </section>

      <div className="sr-only">
        <p>{t.shell.contextLabel}</p>
        <p>{t.shell.loadingTitle}</p>
      </div>
    </section>
  );
}
