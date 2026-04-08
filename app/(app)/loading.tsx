import { getTranslations } from '@/modules/i18n';
import { getRequestLanguage } from '@/modules/i18n/server';

export default async function AppLoading() {
  const language = await getRequestLanguage();
  const t = getTranslations(language);

  return (
    <section
      className="stack route-loading-screen app-shell-loading-minimal-screen"
      aria-label={t.shell.loadingTitle}
    >
      <div className="app-shell-loading-minimal-center" aria-hidden="true">
        <div className="app-shell-loading-minimal-indicator">
          <div className="app-shell-loading-minimal-core" />
        </div>
      </div>

      <div className="sr-only">
        <p>{t.shell.contextLabel}</p>
        <p>{t.shell.loadingTitle}</p>
        <p>{t.shell.loadingBody}</p>
      </div>
    </section>
  );
}
