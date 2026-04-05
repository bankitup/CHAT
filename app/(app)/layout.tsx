import { redirect } from 'next/navigation';
import { getRequestViewer } from '@/lib/request-context/server';
import { getRequestLanguage } from '@/modules/i18n/server';
import { isDmE2eeEnabledForUser } from '@/modules/messaging/e2ee/rollout';
import { AppShellFrame } from './app-shell-frame';

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [user, language] = await Promise.all([
    getRequestViewer(),
    getRequestLanguage(),
  ]);

  if (!user) {
    redirect('/login');
  }

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
