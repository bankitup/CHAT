import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getRequestViewer } from '@/lib/request-context/server';
import { getTranslations } from '@/modules/i18n';
import { getRequestLanguage } from '@/modules/i18n/server';
import { resolveSuperAdminGovernanceForUser } from '@/modules/spaces/server';

export default async function CreateSpacePage() {
  const [user, language] = await Promise.all([
    getRequestViewer(),
    getRequestLanguage(),
  ]);

  if (!user?.id) {
    redirect('/login');
  }

  const superAdminGovernance = resolveSuperAdminGovernanceForUser({
    userEmail: user.email ?? null,
  });

  if (!superAdminGovernance.canCreateSpaces) {
    redirect('/spaces');
  }

  const t = getTranslations(language);

  return (
    <section className="stack spaces-screen">
      <section className="stack settings-hero spaces-hero">
        <div className="spaces-header">
          <Link
            aria-label={t.spaces.backToSpaces}
            className="back-arrow-link spaces-back-link"
            href="/spaces"
          >
            <span aria-hidden="true">←</span>
          </Link>
        </div>

        <p className="eyebrow">{t.spaces.globalAdminEyebrow}</p>
        <h1 className="settings-hero-title">{t.spaces.createSpaceRouteTitle}</h1>
        <p className="muted settings-hero-note">{t.spaces.createSpaceRouteSubtitle}</p>
      </section>

      <section className="card stack settings-surface spaces-surface">
        <h2 className="card-title">{t.spaces.createSpaceTitle}</h2>
        <p className="muted">{t.spaces.createSpaceRouteBody}</p>
        <div className="cluster">
          <Link className="button button-secondary button-compact" href="/spaces">
            {t.spaces.backToSpaces}
          </Link>
        </div>
      </section>
    </section>
  );
}
