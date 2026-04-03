import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getTranslations } from '@/modules/i18n';
import { getCookieLanguage } from '@/modules/i18n/server';

export default async function SignupPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect('/spaces');
  }
  const language = await getCookieLanguage();
  const t = getTranslations(language);

  const params = new URLSearchParams({
    message: t.login.signupRedirectMessage,
  });

  redirect(`/login?${params.toString()}`);
}
