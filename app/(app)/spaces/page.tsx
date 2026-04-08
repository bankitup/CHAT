import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getTranslations } from '@/modules/i18n';
import { getRequestLanguage } from '@/modules/i18n/server';
import {
  getUserSpaces,
  isSpaceMembersSchemaCacheErrorMessage,
  resolveSuperAdminGovernanceForUser,
} from '@/modules/spaces/server';
import { withSpaceParam } from '@/modules/spaces/url';

type SpacesPageProps = {
  searchParams: Promise<{
    message?: string;
    space?: string;
  }>;
};

export default async function SpacesPage({ searchParams }: SpacesPageProps) {
  const diagnosticsEnabled = process.env.CHAT_DEBUG_SPACES_SSR === '1';
  const logDiagnostics = (stage: string, details?: Record<string, unknown>) => {
    if (!diagnosticsEnabled) {
      return;
    }

    if (details) {
      console.info('[spaces-page-ssr]', stage, details);
      return;
    }

    console.info('[spaces-page-ssr]', stage);
  };

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    redirect('/login');
  }

  const query = await searchParams;
  const superAdminGovernance = resolveSuperAdminGovernanceForUser({
    userEmail: user.email ?? null,
  });

  const language = await getRequestLanguage();
  const t = getTranslations(language);
  let spaces = [] as Awaited<ReturnType<typeof getUserSpaces>>;
  let spacesTemporarilyUnavailable = false;

  try {
    logDiagnostics('loader:getUserSpaces:start');
    spaces = await getUserSpaces(user.id, {
      source: 'spaces-page',
    });
    logDiagnostics('loader:getUserSpaces:ok', { count: spaces.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logDiagnostics('loader:getUserSpaces:error', { message });

    if (isSpaceMembersSchemaCacheErrorMessage(message)) {
      spacesTemporarilyUnavailable = true;
      logDiagnostics('loader:getUserSpaces:fallback-unavailable');
    } else {
      throw error;
    }
  }

  const requestedSpaceId = query.space?.trim() || null;
  const visibleMessage = query.message?.trim() || null;
  const requestedSpace = requestedSpaceId
    ? spaces.find((space) => space.id === requestedSpaceId)
    : undefined;
  const currentSpace = requestedSpace ?? spaces[0] ?? null;
  const currentSpaceId = currentSpace?.id ?? null;

  return (
    <section className="stack spaces-screen">
      <section className="stack settings-hero spaces-hero">
        {currentSpaceId ? (
          <div className="spaces-header">
            <Link
              aria-label={t.spaces.backToChats}
              className="back-arrow-link spaces-back-link"
              href={withSpaceParam(
                currentSpace?.defaultShellRoute ?? '/home',
                currentSpaceId,
              )}
            >
              <span aria-hidden="true">←</span>
            </Link>
          </div>
        ) : null}

        <p className="eyebrow">{t.shell.spaces}</p>
        <h1 className="settings-hero-title">{t.spaces.title}</h1>
        <p className="muted settings-hero-note">{t.spaces.subtitle}</p>
      </section>

      {visibleMessage ? (
        <div aria-live="polite" className="notice notice-success notice-inline">
          <span aria-hidden="true" className="notice-check">
            ✓
          </span>
          <span className="notice-copy">{visibleMessage}</span>
        </div>
      ) : null}

      {superAdminGovernance.canCreateSpaces ? (
        <section className="card stack settings-surface spaces-surface">
          <p className="eyebrow">{t.spaces.globalAdminEyebrow}</p>
          <h2 className="card-title">{t.spaces.createSpaceTitle}</h2>
          <p className="muted">{t.spaces.createSpaceBody}</p>
          <div className="cluster">
            <Link
              className="button button-compact"
              href={withSpaceParam('/spaces/new', currentSpaceId)}
            >
              {t.spaces.createSpaceAction}
            </Link>
          </div>
        </section>
      ) : null}

      <section className="card stack settings-surface spaces-surface">
        {spacesTemporarilyUnavailable ? (
          <section className="empty-card">
            <h2 className="card-title">{t.spaces.unavailableTitle}</h2>
            <p className="muted">{t.spaces.unavailableBody}</p>
          </section>
        ) : spaces.length > 0 ? (
          <div className="space-list">
            {spaces.map((space) => (
              <Link
                key={space.id}
                className={
                  currentSpaceId === space.id
                    ? 'space-card space-card-current'
                    : 'space-card'
                }
                href={withSpaceParam(space.defaultShellRoute, space.id)}
              >
                <div className="stack space-card-copy">
                  <div className="space-card-title-row">
                    <h2 className="card-title space-card-title">{space.name}</h2>
                    {currentSpaceId === space.id ? (
                      <span className="summary-pill summary-pill-muted space-card-current-pill">
                        {t.spaces.currentSpace}
                      </span>
                    ) : null}
                  </div>
                  <p className="muted space-card-note">
                    {t.spaces.currentActivityNote}
                  </p>
                </div>
                <span className="pill pill-accent space-card-action">
                  {t.spaces.openSpace}
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <section className="empty-card">
            <h2 className="card-title">{t.spaces.emptyTitle}</h2>
            <p className="muted">{t.spaces.emptyBody}</p>
          </section>
        )}
      </section>
    </section>
  );
}
