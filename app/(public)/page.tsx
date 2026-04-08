import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCookieLanguage } from '@/modules/i18n/server';
import { resolveDefaultSpaceShellHrefForUser } from '@/modules/spaces/server';
import { PublicHomeScreen } from './public-home-screen';

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const language = await getCookieLanguage();
  const authenticatedEntryHref = user?.id
    ? await resolveDefaultSpaceShellHrefForUser({
        userId: user.id,
        userEmail: user.email ?? null,
        source: 'public-home',
      })
    : null;

  return (
    <PublicHomeScreen
      authenticatedEntryHref={authenticatedEntryHref}
      initialLanguage={language}
      isAuthenticated={Boolean(user)}
    />
  );
}
