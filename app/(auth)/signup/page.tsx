import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getTranslations } from '@/modules/i18n';
import { getCookieLanguage } from '@/modules/i18n/server';
import { resolveHomeHrefForUser } from '@/modules/spaces/server';

export default async function SignupPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect(
      await resolveHomeHrefForUser({
        userId: user.id,
        source: 'signup-page',
      }),
    );
  }
  const language = await getCookieLanguage();
  const t = getTranslations(language);

  const params = new URLSearchParams({
    message: t.login.signupRedirectMessage,
  });

  redirect(`/login?${params.toString()}`);
}
