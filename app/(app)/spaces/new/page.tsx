import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createSpaceAction } from '../actions';
import { getRequestViewer } from '@/lib/request-context/server';
import { getTranslations } from '@/modules/i18n';
import { getRequestLanguage } from '@/modules/i18n/server';
import { sanitizeUserFacingErrorMessage } from '@/modules/messaging/ui/user-facing-errors';
import { SPACE_PROFILES, normalizeSpaceProfile } from '@/modules/spaces/model';
import { resolveSuperAdminGovernanceForUser } from '@/modules/spaces/server';
import { withSpaceParam } from '@/modules/spaces/url';

type CreateSpacePageProps = {
  searchParams: Promise<{
    admins?: string;
    error?: string;
    members?: string;
    name?: string;
    profile?: string;
    space?: string;
  }>;
};

export default async function CreateSpacePage({
  searchParams,
}: CreateSpacePageProps) {
  const query = await searchParams;
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
    redirect(withSpaceParam('/spaces', query.space));
  }

  const t = getTranslations(language);
  const visibleError = query.error
    ? sanitizeUserFacingErrorMessage({
        fallback: t.spaces.createSpaceFailed,
        language,
        rawMessage: query.error,
      })
    : null;
  const selectedProfile =
    normalizeSpaceProfile(query.profile) ?? 'messenger_full';

  return (
    <section className="stack spaces-screen">
      <section className="stack settings-hero spaces-hero">
        <div className="spaces-header">
          <Link
            aria-label={t.spaces.backToSpaces}
            className="back-arrow-link spaces-back-link"
            href={withSpaceParam('/spaces', query.space)}
            prefetch={false}
          >
            <span aria-hidden="true">←</span>
          </Link>
        </div>

        <p className="eyebrow">{t.spaces.globalAdminEyebrow}</p>
        <h1 className="settings-hero-title">{t.spaces.createSpaceRouteTitle}</h1>
        <p className="muted settings-hero-note">{t.spaces.createSpaceRouteSubtitle}</p>
      </section>

      {visibleError ? <p className="notice notice-error">{visibleError}</p> : null}

      <section className="card stack settings-surface spaces-surface">
        <section className="empty-card keepcozy-preview-card">
          <div className="keepcozy-preview-header">
            <span className="summary-pill summary-pill-muted">
              {t.spaces.globalAdminEyebrow}
            </span>
          </div>
          <h2 className="card-title">{t.spaces.createSpaceTitle}</h2>
          <p className="muted">{t.spaces.createSpaceRouteBody}</p>
        </section>

        <form action={createSpaceAction} className="stack settings-section keepcozy-section">
          <input name="returnSpaceId" type="hidden" value={query.space ?? ''} />

          <label className="field">
            <span>{t.spaces.fieldSpaceName}</span>
            <input
              autoComplete="off"
              className="input"
              defaultValue={query.name ?? ''}
              name="spaceName"
              required
            />
          </label>

          <label className="field">
            <span>{t.spaces.fieldSpaceProfile}</span>
            <select className="input" defaultValue={selectedProfile} name="profile">
              {SPACE_PROFILES.map((profile) => (
                <option key={profile} value={profile}>
                  {profile === 'keepcozy_ops'
                    ? t.spaces.profileKeepCozyOps
                    : t.spaces.profileMessengerFull}
                </option>
              ))}
            </select>
            <p className="muted keepcozy-field-note">{t.spaces.profileHint}</p>
          </label>

          <label className="field">
            <span>{t.spaces.fieldParticipantIdentifiers}</span>
            <textarea
              className="input textarea"
              defaultValue={query.members ?? ''}
              name="memberIdentifiers"
              rows={5}
            />
            <p className="muted keepcozy-field-note">{t.spaces.participantIdentifiersHint}</p>
          </label>

          <label className="field">
            <span>{t.spaces.fieldAdminIdentifiers}</span>
            <textarea
              className="input textarea"
              defaultValue={query.admins ?? ''}
              name="adminIdentifiers"
              required
              rows={4}
            />
            <p className="muted keepcozy-field-note">{t.spaces.adminIdentifiersHint}</p>
          </label>

          <p className="muted">{t.spaces.includeYourselfHint}</p>

          <button className="button keepcozy-form-submit" type="submit">
            {t.spaces.submitCreateSpace}
          </button>
        </form>
      </section>
    </section>
  );
}
