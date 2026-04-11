'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import type { ReactNode } from 'react';
import { getTranslations, type AppLanguage } from '@/modules/i18n';
import { DmE2eeAuthenticatedBoundary } from '@/modules/messaging/e2ee/local-state-boundary';
import { WarmNavRouteObserver } from '@/modules/messaging/performance/warm-nav-client';
import { ChatUnreadBadgeSync } from '@/modules/messaging/push/chat-unread-badge-sync';
import { PushSubscriptionPresenceSync } from '@/modules/messaging/push/presence-sync';
import {
  resolveActiveAppShellSpace,
  resolveAppShellState,
  type AppShellSpaceSummary,
} from '@/modules/spaces/shell';
import { withSpaceParam } from '@/modules/spaces/url';

type AppShellFrameProps = {
  children: ReactNode;
  dmE2eeEnabled: boolean;
  language: AppLanguage;
  spaces: AppShellSpaceSummary[];
  userId: string;
};

export function AppShellFrame({
  children,
  dmE2eeEnabled,
  language,
  spaces,
  userId,
}: AppShellFrameProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = getTranslations(language);
  const isChatRoute = pathname.startsWith('/chat/');
  const isChatSettingsRoute =
    pathname.startsWith('/chat/') && pathname.endsWith('/settings');
  const activeSpaceId = searchParams.get('space');
  const activeSpace = resolveActiveAppShellSpace({
    activeSpaceId,
    spaces,
  });
  const shellState = resolveAppShellState({
    activeSpace,
    pathname,
  });
  const navSpaceHref = (pathname: string) =>
    activeSpace?.id ? withSpaceParam(pathname, activeSpace.id) : pathname;
  const badgeSyncKey = `${pathname}?${searchParams.toString()}`;

  return (
    <main
      className={[
        'page',
        'page-mobile',
        'app-shell',
        shellState.showBottomNav ? 'app-shell-with-nav' : null,
        isChatRoute ? 'app-shell-chat-route' : null,
        isChatSettingsRoute ? 'app-shell-chat-settings-route' : null,
      ]
        .filter(Boolean)
        .join(' ')}
      data-space-theme={shellState.activeSpaceTheme}
    >
      <DmE2eeAuthenticatedBoundary enabled={dmE2eeEnabled} userId={userId} />
      <ChatUnreadBadgeSync syncKey={badgeSyncKey} />
      <PushSubscriptionPresenceSync />
      <WarmNavRouteObserver />
      <div className="stack app-shell-content">{children}</div>

      {shellState.showBottomNav ? (
        <nav
          className={
            shellState.activeSpaceProfile === 'messenger_full'
              ? 'app-bottom-nav app-bottom-nav-messenger'
              : 'app-bottom-nav'
          }
          aria-label={t.shell.label}
        >
          <div
            className={
              shellState.activeSpaceProfile === 'messenger_full'
                ? 'app-bottom-nav-shell app-bottom-nav-shell-messenger'
                : 'app-bottom-nav-shell'
            }
          >
            {shellState.activeSpaceProfile === 'messenger_full' ? (
              <>
                <Link
                  aria-label={t.shell.openHome}
                  className={
                    shellState.messengerActiveTab === 'home'
                      ? 'app-bottom-nav-link app-bottom-nav-link-messenger app-bottom-nav-link-active'
                      : 'app-bottom-nav-link app-bottom-nav-link-messenger'
                  }
                  href={navSpaceHref('/home')}
                  prefetch
                >
                  <span className="app-bottom-nav-label">{t.shell.home}</span>
                </Link>

                <Link
                  aria-label={t.shell.openChats}
                  className={
                    shellState.messengerActiveTab === 'chats'
                      ? 'app-bottom-nav-link app-bottom-nav-link-messenger app-bottom-nav-link-active'
                      : 'app-bottom-nav-link app-bottom-nav-link-messenger'
                  }
                  href={navSpaceHref('/inbox')}
                  prefetch
                >
                  <span className="app-bottom-nav-label">{t.shell.chats}</span>
                </Link>

                <Link
                  aria-label={t.shell.openMessengerActivity}
                  className={
                    shellState.messengerActiveTab === 'activity'
                      ? 'app-bottom-nav-link app-bottom-nav-link-messenger app-bottom-nav-link-active'
                      : 'app-bottom-nav-link app-bottom-nav-link-messenger'
                  }
                  href={navSpaceHref('/activity')}
                  prefetch
                >
                  <span className="app-bottom-nav-label">
                    {t.shell.messengerActivity}
                  </span>
                </Link>
              </>
            ) : (
              <>
                <Link
                  aria-label={t.shell.openHome}
                  className={
                    shellState.productActiveTab === 'home'
                      ? 'app-bottom-nav-link app-bottom-nav-link-active'
                      : 'app-bottom-nav-link'
                  }
                  href={navSpaceHref('/home')}
                  prefetch={false}
                >
                  <span className="app-bottom-nav-label">{t.shell.home}</span>
                </Link>

                <Link
                  aria-label={t.shell.openRooms}
                  className={
                    shellState.productActiveTab === 'rooms'
                      ? 'app-bottom-nav-link app-bottom-nav-link-active'
                      : 'app-bottom-nav-link'
                  }
                  href={navSpaceHref('/rooms')}
                  prefetch={false}
                >
                  <span className="app-bottom-nav-label">{t.shell.rooms}</span>
                </Link>

                <Link
                  aria-label={t.shell.openIssues}
                  className={
                    shellState.productActiveTab === 'issues'
                      ? 'app-bottom-nav-link app-bottom-nav-link-active'
                      : 'app-bottom-nav-link'
                  }
                  href={navSpaceHref('/issues')}
                  prefetch={false}
                >
                  <span className="app-bottom-nav-label">{t.shell.issues}</span>
                </Link>

                <Link
                  aria-label={t.shell.openTasks}
                  className={
                    shellState.productActiveTab === 'tasks'
                      ? 'app-bottom-nav-link app-bottom-nav-link-active'
                      : 'app-bottom-nav-link'
                  }
                  href={navSpaceHref('/tasks')}
                  prefetch={false}
                >
                  <span className="app-bottom-nav-label">{t.shell.tasks}</span>
                </Link>

                <Link
                  aria-label={t.shell.openActivity}
                  className={
                    shellState.productActiveTab === 'activity'
                      ? 'app-bottom-nav-link app-bottom-nav-link-active'
                      : 'app-bottom-nav-link'
                  }
                  href={navSpaceHref('/activity')}
                  prefetch={false}
                >
                  <span className="app-bottom-nav-label">{t.shell.activity}</span>
                </Link>
              </>
            )}
          </div>
        </nav>
      ) : null}
    </main>
  );
}
