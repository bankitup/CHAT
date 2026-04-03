import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCookieLanguage } from '@/modules/i18n/server';
import { PublicHomeScreen } from './public-home-screen';

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const language = await getCookieLanguage();

  return <PublicHomeScreen initialLanguage={language} isAuthenticated={Boolean(user)} />;
}
