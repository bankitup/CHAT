'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import type { ReactNode } from 'react';
import { getTranslations, type AppLanguage } from '@/modules/i18n';
import { DmE2eeAuthenticatedBoundary } from '@/modules/messaging/e2ee/local-state-boundary';
import { ChatUnreadBadgeSync } from '@/modules/messaging/push/chat-unread-badge-sync';
import type {
  SpaceProfile,
  SpaceProfileDefaultShellRoute,
} from '@/modules/spaces/model';
import { withSpaceParam } from '@/modules/spaces/url';

type AppShellSpaceSummary = {
  defaultShellRoute: SpaceProfileDefaultShellRoute;
  id: string;
  name: string;
  profile: SpaceProfile;
};

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
  const isSpacesRoute = pathname.startsWith('/spaces');
  const isActivityRoute = pathname.startsWith('/activity');
  const isSettingsRoute = pathname.startsWith('/settings');
  const isHomeRoute = pathname.startsWith('/home');
  const isRoomsRoute = pathname.startsWith('/rooms');
  const isIssuesRoute = pathname.startsWith('/issues');
  const isTasksRoute = pathname.startsWith('/tasks');
  const activeSpaceId = searchParams.get('space');
  const activeSpace =
    (activeSpaceId ? spaces.find((space) => space.id === activeSpaceId) : null) ??
    spaces[0] ??
    null;
  const activeSpaceProfile = activeSpace?.profile ?? null;
  const navSpaceHref = (pathname: string) =>
    activeSpace?.id ? withSpaceParam(pathname, activeSpace.id) : pathname;
  const badgeSyncKey = `${pathname}?${searchParams.toString()}`;
  const showBottomNav =
    !isChatRoute && !(isSpacesRoute && activeSpaceProfile !== 'messenger_full');
  let activeTab: 'activity' | 'tasks' | 'issues' | 'rooms' | 'home' | null = null;
  let messengerActiveTab: 'activity' | 'chats' | 'home' | null = null;

  if (isActivityRoute) {
    activeTab = 'activity';
  } else if (isTasksRoute) {
    activeTab = 'tasks';
  } else if (isIssuesRoute) {
    activeTab = 'issues';
  } else if (isRoomsRoute) {
    activeTab = 'rooms';
  } else if (isHomeRoute || isSettingsRoute) {
    activeTab = 'home';
  }

  if (isHomeRoute) {
    messengerActiveTab = 'home';
  } else if (pathname.startsWith('/inbox')) {
    messengerActiveTab = 'chats';
  } else if (isActivityRoute) {
    messengerActiveTab = 'activity';
  }

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
      <ChatUnreadBadgeSync syncKey={badgeSyncKey} />
      <div className="stack app-shell-content">{children}</div>

      {showBottomNav ? (
        <nav className="app-bottom-nav" aria-label={t.shell.label}>
          <div className="app-bottom-nav-shell">
            {activeSpaceProfile === 'messenger_full' ? (
              <>
                <Link
                  aria-label={t.shell.openHome}
                  className={
                    messengerActiveTab === 'home'
                      ? 'app-bottom-nav-link app-bottom-nav-link-active'
                      : 'app-bottom-nav-link'
                  }
                  href={navSpaceHref('/home')}
                  prefetch={false}
                >
                  <span className="app-bottom-nav-label">{t.shell.home}</span>
                </Link>

                <Link
                  aria-label={t.shell.openChats}
                  className={
                    messengerActiveTab === 'chats'
                      ? 'app-bottom-nav-link app-bottom-nav-link-active'
                      : 'app-bottom-nav-link'
                  }
                  href={navSpaceHref('/inbox')}
                  prefetch={false}
                >
                  <span className="app-bottom-nav-label">{t.shell.chats}</span>
                </Link>

                <Link
                  aria-label={t.shell.openMessengerActivity}
                  className={
                    messengerActiveTab === 'activity'
                      ? 'app-bottom-nav-link app-bottom-nav-link-active'
                      : 'app-bottom-nav-link'
                  }
                  href={navSpaceHref('/activity')}
                  prefetch={false}
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
                    activeTab === 'home'
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
                    activeTab === 'rooms'
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
                    activeTab === 'issues'
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
                    activeTab === 'tasks'
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
                    activeTab === 'activity'
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
