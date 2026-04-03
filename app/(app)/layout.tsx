import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getRequestLanguage } from '@/modules/i18n/server';
import { isDmE2eeEnabledForUser } from '@/modules/messaging/e2ee/rollout';
import { AppShellFrame } from './app-shell-frame';

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const language = await getRequestLanguage();
  const dmE2eeEnabled = isDmE2eeEnabledForUser(user.id, user.email ?? null, {
    source: 'app-layout',
  });

  return (
    <AppShellFrame
      dmE2eeEnabled={dmE2eeEnabled}
      language={language}
      userId={user.id}
    >
      {children}
    </AppShellFrame>
  );
}
