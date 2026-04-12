import { redirect } from 'next/navigation';
import { getRequestViewer } from '@/lib/request-context/server';
import { getRequestLanguage } from '@/modules/i18n/server';
import {
  getUserSpaces,
  isSpaceMembersSchemaCacheErrorMessage,
} from '@/modules/spaces/server';
import {
  resolveSpaceProductPosture,
  type AppShellSpaceSummary,
} from '@/modules/spaces/shell';
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

  const appShellSpaces: AppShellSpaceSummary[] = spaces.map((space) => ({
    defaultShellRoute: space.defaultShellRoute,
    id: space.id,
    name: space.name,
    profile: space.profile,
    productPosture: resolveSpaceProductPosture(space.profile),
    theme: space.theme,
  }));

  return (
    <div className="app-route-shell-root">
      <AppShellFrame language={language} spaces={appShellSpaces}>
        {children}
      </AppShellFrame>
    </div>
  );
}
