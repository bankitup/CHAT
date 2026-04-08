import Link from 'next/link';
import { redirect } from 'next/navigation';
import { addSpaceMembersAction } from '../actions';
import { getRequestViewer } from '@/lib/request-context/server';
import { getTranslations } from '@/modules/i18n';
import { getRequestLanguage } from '@/modules/i18n/server';
import { sanitizeUserFacingErrorMessage } from '@/modules/messaging/ui/user-facing-errors';
import { requireSpaceMemberManagementForUser } from '@/modules/spaces/server';
import { withSpaceParam } from '@/modules/spaces/url';

type SpaceMembersPageProps = {
  searchParams: Promise<{
    admins?: string;
    error?: string;
    members?: string;
    message?: string;
    space?: string;
  }>;
};

export default async function SpaceMembersPage({
  searchParams,
}: SpaceMembersPageProps) {
  const query = await searchParams;
  const [user, language] = await Promise.all([
    getRequestViewer(),
    getRequestLanguage(),
  ]);

  if (!user?.id) {
    redirect('/login');
  }

  const spaceId = query.space?.trim() ?? '';

  if (!spaceId) {
    redirect('/spaces');
  }

  let exactSpaceAccess: Awaited<
    ReturnType<typeof requireSpaceMemberManagementForUser>
  >;

  try {
    exactSpaceAccess = await requireSpaceMemberManagementForUser({
      requestedSpaceId: spaceId,
      source: 'space-members-page',
      userEmail: user.email ?? null,
      userId: user.id,
    });
  } catch {
    redirect(withSpaceParam('/spaces', spaceId));
  }

  const t = getTranslations(language);
  const visibleError = query.error
    ? sanitizeUserFacingErrorMessage({
        fallback: t.spaces.manageMembersFailed,
        language,
        rawMessage: query.error,
      })
    : null;
  const visibleMessage = query.message?.trim() || null;

  return (
    <section className="stack spaces-screen">
      <section className="stack settings-hero spaces-hero">
        <div className="spaces-header">
          <Link
            aria-label={t.spaces.backToSpaces}
            className="back-arrow-link spaces-back-link"
            href={withSpaceParam('/spaces', exactSpaceAccess.activeSpace.id)}
            prefetch={false}
          >
            <span aria-hidden="true">←</span>
          </Link>
        </div>

        <p className="eyebrow">{t.spaces.spaceAdminEyebrow}</p>
        <h1 className="settings-hero-title">{t.spaces.manageMembersRouteTitle}</h1>
        <p className="muted settings-hero-note">
          {t.spaces.manageMembersRouteSubtitle}
        </p>
      </section>

      {visibleMessage ? (
        <div aria-live="polite" className="notice notice-success notice-inline">
          <span aria-hidden="true" className="notice-check">
            ✓
          </span>
          <span className="notice-copy">{visibleMessage}</span>
        </div>
      ) : null}

      {visibleError ? <p className="notice notice-error">{visibleError}</p> : null}

      <section className="card stack settings-surface spaces-surface">
        <section className="empty-card keepcozy-preview-card">
          <div className="keepcozy-preview-header">
            <span className="summary-pill summary-pill-muted">
              {exactSpaceAccess.activeSpace.name}
            </span>
          </div>
          <h2 className="card-title">{t.spaces.manageMembersTitle}</h2>
          <p className="muted">{t.spaces.manageMembersRouteBody}</p>
        </section>

        <form action={addSpaceMembersAction} className="stack settings-section keepcozy-section">
          <input name="spaceId" type="hidden" value={exactSpaceAccess.activeSpace.id} />

          <label className="field">
            <span>{t.spaces.fieldParticipantIdentifiers}</span>
            <textarea
              className="input textarea"
              defaultValue={query.members ?? ''}
              name="memberIdentifiers"
              rows={5}
            />
            <p className="muted keepcozy-field-note">
              {t.spaces.participantIdentifiersHint}
            </p>
          </label>

          <label className="field">
            <span>{t.spaces.fieldAdminIdentifiers}</span>
            <textarea
              className="input textarea"
              defaultValue={query.admins ?? ''}
              name="adminIdentifiers"
              rows={4}
            />
            <p className="muted keepcozy-field-note">
              {t.spaces.adminIdentifiersHint}
            </p>
          </label>

          <p className="muted">{t.spaces.manageMembersBody}</p>

          <button className="button keepcozy-form-submit" type="submit">
            {t.spaces.manageMembersAction}
          </button>
        </form>
      </section>
    </section>
  );
}
