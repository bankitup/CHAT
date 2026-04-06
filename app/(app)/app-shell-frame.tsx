'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import type { ReactNode } from 'react';
import { getTranslations, type AppLanguage } from '@/modules/i18n';
import { DmE2eeAuthenticatedBoundary } from '@/modules/messaging/e2ee/local-state-boundary';
import { withSpaceParam } from '@/modules/spaces/url';

type AppShellFrameProps = {
  children: ReactNode;
  dmE2eeEnabled: boolean;
  language: AppLanguage;
  userId: string;
};

export function AppShellFrame({
  children,
  dmE2eeEnabled,
  language,
  userId,
}: AppShellFrameProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = getTranslations(language);
  const isChatRoute = pathname.startsWith('/chat/');
  const isChatSettingsRoute =
    pathname.startsWith('/chat/') && pathname.endsWith('/settings');
  const isSpacesRoute = pathname.startsWith('/spaces');
  const isActivityRoute = pathname.startsWith('/activity');
  const isSettingsRoute = pathname.startsWith('/settings');
  const activeSpaceId = searchParams.get('space');
  const navSpaceHref = (pathname: string) =>
    activeSpaceId ? withSpaceParam(pathname, activeSpaceId) : pathname;
  const showBottomNav = !isChatRoute && !isSpacesRoute;
  const activeTab = isActivityRoute
    ? 'activity'
    : isSettingsRoute
      ? 'home'
      : pathname.startsWith('/inbox')
        ? 'chats'
        : null;

  return (
    <main
      className={[
        'page',
        'page-mobile',
        'app-shell',
        showBottomNav ? 'app-shell-with-nav' : null,
        isChatRoute ? 'app-shell-chat-route' : null,
        isChatSettingsRoute ? 'app-shell-chat-settings-route' : null,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <DmE2eeAuthenticatedBoundary enabled={dmE2eeEnabled} userId={userId} />
      <div className="stack app-shell-content">{children}</div>

      {showBottomNav ? (
        <nav className="app-bottom-nav" aria-label={t.shell.label}>
          <div className="app-bottom-nav-shell">
            <Link
              aria-label={t.shell.openHome}
              className={
                activeTab === 'home'
                  ? 'app-bottom-nav-link app-bottom-nav-link-active'
                  : 'app-bottom-nav-link'
              }
              href={navSpaceHref('/settings')}
              prefetch={false}
            >
              <span className="app-bottom-nav-label">{t.shell.home}</span>
            </Link>

            <Link
              aria-label={t.shell.openChats}
              className={
                activeTab === 'chats'
                  ? 'app-bottom-nav-link app-bottom-nav-link-active'
                  : 'app-bottom-nav-link'
              }
              href={navSpaceHref('/inbox')}
              prefetch={false}
            >
              <span className="app-bottom-nav-label">{t.shell.chats}</span>
            </Link>

            <Link
              aria-label={t.shell.openActivity}
              className={
                activeTab === 'activity'
                  ? 'app-bottom-nav-link app-bottom-nav-link-active'
                  : 'app-bottom-nav-link'
              }
              href={navSpaceHref('/activity')}
              prefetch={false}
            >
              <span className="app-bottom-nav-label">{t.shell.activity}</span>
            </Link>
          </div>
        </nav>
      ) : null}
    </main>
  );
}
