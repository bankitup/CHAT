import { redirect } from 'next/navigation';
import { getRequestViewer } from '@/lib/request-context/server';
import { getRequestLanguage } from '@/modules/i18n/server';
import { isDmE2eeEnabledForUser } from '@/modules/messaging/e2ee/rollout';
import { getUserSpaces } from '@/modules/spaces/server';
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
  let spaces: Array<{
    id: string;
    name: string;
  }> = [];

  try {
    const userSpaces = await getUserSpaces(user.id, {
      source: 'app-layout-shell',
    });
    spaces = userSpaces.map((space) => ({
      id: space.id,
      name: space.name,
    }));
  } catch {
    spaces = [];
  }

  return (
    <AppShellFrame
      dmE2eeEnabled={dmE2eeEnabled}
      language={language}
      spaces={spaces}
      userId={user.id}
    >
      {children}
    </AppShellFrame>
  );
}
