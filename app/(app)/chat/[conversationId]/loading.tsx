import { getTranslations } from '@/modules/i18n';
import { getRequestLanguage } from '@/modules/i18n/server';

export default async function ChatConversationLoading() {
  const language = await getRequestLanguage();
  const t = getTranslations(language);

  return (
    <section
      className="chat-screen chat-entry-loading-screen"
      aria-busy="true"
      aria-label={t.shell.loadingTitle}
    >
      <section className="stack chat-header-stack chat-entry-loading-header-stack">
        <section
          className="card chat-header-card chat-header-shell chat-entry-loading-header-shell"
          aria-hidden="true"
        >
          <div className="conversation-back chat-entry-loading-header-button" />
          <div className="chat-entry-loading-header-main">
            <div className="chat-entry-loading-header-pill" />
          </div>
          <div className="chat-entry-loading-header-avatar" />
        </section>
      </section>

      <section className="chat-main chat-entry-loading-main">
        <div className="chat-entry-loading-center">
          <div className="app-shell-loading-minimal-indicator" aria-hidden="true">
            <div className="app-shell-loading-minimal-core" />
          </div>
        </div>
      </section>

      <section className="stack composer-card chat-entry-loading-composer-card">
        <div
          className="composer-input-shell chat-entry-loading-composer-shell"
          aria-hidden="true"
        >
          <div className="chat-entry-loading-composer-pill" />
        </div>
      </section>

      <div className="sr-only">
        <p>{t.shell.contextLabel}</p>
        <p>{t.shell.loadingTitle}</p>
        <p>{t.shell.loadingBody}</p>
      </div>
    </section>
  );
}
