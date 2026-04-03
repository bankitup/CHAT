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
  const isActivityRoute = pathname.startsWith('/activity');
  const isDmInboxRoute =
    pathname.startsWith('/inbox') && searchParams.get('filter') === 'dm';
  const activeSpaceId = searchParams.get('space');
  const showBottomNav = !isChatRoute;
  const activeTab = isActivityRoute
    ? 'activity'
    : isDmInboxRoute
      ? 'dms'
      : pathname.startsWith('/inbox')
        ? 'chats'
        : null;

  return (
    <main
      className={
        showBottomNav
          ? 'page page-mobile app-shell app-shell-with-nav'
          : 'page page-mobile app-shell'
      }
    >
      <DmE2eeAuthenticatedBoundary enabled={dmE2eeEnabled} userId={userId} />
      <div className="stack app-shell-content">{children}</div>

      {showBottomNav ? (
        <nav className="app-bottom-nav" aria-label={t.shell.label}>
          <div className="app-bottom-nav-shell">
            <Link
              aria-label={t.shell.openChats}
              className={
                activeTab === 'chats'
                  ? 'app-bottom-nav-link app-bottom-nav-link-active'
                  : 'app-bottom-nav-link'
              }
              href={withSpaceParam('/inbox', activeSpaceId)}
            >
              <span className="app-bottom-nav-dot" aria-hidden="true" />
              <span className="app-bottom-nav-label">{t.shell.chats}</span>
            </Link>

            <Link
              aria-label={t.shell.openDms}
              className={
                activeTab === 'dms'
                  ? 'app-bottom-nav-link app-bottom-nav-link-active'
                  : 'app-bottom-nav-link'
              }
              href={withSpaceParam('/inbox?filter=dm', activeSpaceId)}
            >
              <span className="app-bottom-nav-dot" aria-hidden="true" />
              <span className="app-bottom-nav-label">{t.shell.dms}</span>
            </Link>

            <Link
              aria-label={t.shell.openActivity}
              className={
                activeTab === 'activity'
                  ? 'app-bottom-nav-link app-bottom-nav-link-active'
                  : 'app-bottom-nav-link'
              }
              href={withSpaceParam('/activity', activeSpaceId)}
            >
              <span className="app-bottom-nav-dot" aria-hidden="true" />
              <span className="app-bottom-nav-label">{t.shell.activity}</span>
            </Link>
          </div>
        </nav>
      ) : null}
    </main>
  );
}
