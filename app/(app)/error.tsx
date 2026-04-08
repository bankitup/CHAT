'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { getTranslations, normalizeLanguage } from '@/modules/i18n';
import { withSpaceParam } from '@/modules/spaces/url';

type AppRouteErrorBoundaryProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function AppRouteErrorBoundary({
  error,
  reset,
}: AppRouteErrorBoundaryProps) {
  const searchParams = useSearchParams();
  const spaceId = searchParams.get('space');
  const language = normalizeLanguage(
    typeof document === 'undefined' ? null : document.documentElement.lang,
  );
  const t = getTranslations(language);

  useEffect(() => {
    console.error('[route-error-boundary]', 'app', {
      digest: error.digest ?? null,
      message: error.message,
    });
  }, [error]);

  return (
    <section className="page page-mobile">
      <section className="card stack route-error-card">
        <div className="stack route-error-copy">
          <p className="eyebrow">KeepCozy shell</p>
          <h1 className="section-title">{t.shell.errorTitle}</h1>
          <p className="muted">{t.shell.errorBody}</p>
          <p className="muted route-error-note">{t.shell.errorProofPathBody}</p>
        </div>

        <div className="cluster route-error-actions">
          <button className="button" onClick={reset} type="button">
            {t.shell.retry}
          </button>
          <Link
            className="button button-secondary"
            href={withSpaceParam('/home', spaceId)}
            prefetch={false}
          >
            {t.shell.home}
          </Link>
          <Link className="pill" href={withSpaceParam('/spaces', spaceId)} prefetch={false}>
            {t.spaces.title}
          </Link>
        </div>
      </section>
    </section>
  );
}
