import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getTranslations } from '@/modules/i18n';
import { getRequestLanguage } from '@/modules/i18n/server';
import { getUserSpaces } from '@/modules/spaces/server';
import { withSpaceParam } from '@/modules/spaces/url';

export default async function SpacesPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    return null;
  }

  const language = await getRequestLanguage();
  const t = getTranslations(language);
  const spaces = await getUserSpaces(user.id);

  return (
    <section className="stack spaces-screen">
      <section className="stack settings-hero spaces-hero">
        <p className="eyebrow">{t.shell.chats}</p>
        <h1 className="settings-hero-title">{t.spaces.title}</h1>
        <p className="muted settings-hero-note">{t.spaces.subtitle}</p>
      </section>

      <section className="card stack settings-surface spaces-surface">
        {spaces.length > 0 ? (
          <div className="space-list">
            {spaces.map((space) => (
              <Link
                key={space.id}
                className="space-card"
                href={withSpaceParam('/inbox', space.id)}
              >
                <div className="stack space-card-copy">
                  <h2 className="card-title space-card-title">{space.name}</h2>
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
