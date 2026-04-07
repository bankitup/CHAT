import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCookieLanguage } from '@/modules/i18n/server';
import { PublicHomeScreen } from './public-home-screen';
import { resolveHomeHrefForUser } from '@/modules/spaces/server';

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const language = await getCookieLanguage();
  const authenticatedHomeHref = user?.id
    ? await resolveHomeHrefForUser({
        userId: user.id,
        source: 'public-home',
      })
    : null;

  return (
    <PublicHomeScreen
      authenticatedHomeHref={authenticatedHomeHref}
      initialLanguage={language}
      isAuthenticated={Boolean(user)}
    />
  );
}
