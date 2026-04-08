import { redirect } from 'next/navigation';
import { getRequestViewer } from '@/lib/request-context/server';
import { getRequestLanguage } from '@/modules/i18n/server';
import { isDmE2eeEnabledForUser } from '@/modules/messaging/e2ee/rollout';
import {
  getUserSpaces,
  isSpaceMembersSchemaCacheErrorMessage,
} from '@/modules/spaces/server';
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

  let spaces: Awaited<ReturnType<typeof getUserSpaces>> = [];

  try {
    spaces = await getUserSpaces(user.id, {
      source: 'app-layout',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (!isSpaceMembersSchemaCacheErrorMessage(message)) {
      throw error;
    }
  }

  const dmE2eeEnabled = isDmE2eeEnabledForUser(user.id, user.email ?? null, {
    source: 'app-layout',
  });

  return (
    <AppShellFrame
      dmE2eeEnabled={dmE2eeEnabled}
      language={language}
      spaces={spaces.map((space) => ({
        defaultShellRoute: space.defaultShellRoute,
        id: space.id,
        name: space.name,
        profile: space.profile,
      }))}
      userId={user.id}
    >
      {children}
    </AppShellFrame>
  );
}
