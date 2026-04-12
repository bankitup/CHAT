'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { type ReactNode } from 'react';
import {
  getShellClientTranslations,
  type AppLanguage,
} from '@/modules/i18n/client';
import {
  resolveActiveAppShellSpace,
  resolveAppShellState,
  type AppShellSpaceSummary,
} from '@/modules/spaces/shell';

type AppShellFrameProps = {
  children: ReactNode;
  language: AppLanguage;
  spaces: AppShellSpaceSummary[];
};

export function AppShellFrame({
  children,
  language,
  spaces,
}: AppShellFrameProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = getShellClientTranslations(language);
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
  const isMessengerShell = shellState.bottomNavProductPosture === 'messenger';
  const getNavItemLabel = (key: (typeof shellState.navItems)[number]['key']) => {
    switch (key) {
      case 'activity':
        return isMessengerShell ? t.shell.messengerActivity : t.shell.activity;
      case 'chats':
        return t.shell.chats;
      case 'home':
        return t.shell.home;
      case 'issues':
        return t.shell.issues;
      case 'rooms':
        return t.shell.rooms;
      case 'tasks':
        return t.shell.tasks;
    }
  };
  const getNavItemAriaLabel = (
    key: (typeof shellState.navItems)[number]['key'],
  ) => {
    switch (key) {
      case 'activity':
        return isMessengerShell
          ? t.shell.openMessengerActivity
          : t.shell.openActivity;
      case 'chats':
        return t.shell.openChats;
      case 'home':
        return t.shell.openHome;
      case 'issues':
        return t.shell.openIssues;
      case 'rooms':
        return t.shell.openRooms;
      case 'tasks':
        return t.shell.openTasks;
    }
  };
  const getNavItemClassName = (isActive: boolean) => {
    if (isMessengerShell) {
      return isActive
        ? 'app-bottom-nav-link app-bottom-nav-link-messenger app-bottom-nav-link-active'
        : 'app-bottom-nav-link app-bottom-nav-link-messenger';
    }

    return isActive
      ? 'app-bottom-nav-link app-bottom-nav-link-active'
      : 'app-bottom-nav-link';
  };

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
      data-route-product-surface={shellState.routeProductSurface}
      data-shell-product-posture={shellState.activeProductPosture ?? 'platform'}
      data-space-theme={shellState.activeSpaceTheme}
    >
      <div className="stack app-shell-content">{children}</div>

      {shellState.showBottomNav ? (
        <nav
          className={
            isMessengerShell
              ? 'app-bottom-nav app-bottom-nav-messenger'
              : 'app-bottom-nav'
          }
          aria-label={t.shell.label}
        >
          <div
            className={
              isMessengerShell
                ? 'app-bottom-nav-shell app-bottom-nav-shell-messenger'
                : 'app-bottom-nav-shell'
            }
          >
            {shellState.navItems.map((item) => (
              <Link
                key={`${shellState.bottomNavProductPosture ?? 'platform'}-${item.key}`}
                aria-label={getNavItemAriaLabel(item.key)}
                className={getNavItemClassName(item.isActive)}
                href={item.href}
                prefetch={item.prefetch}
              >
                <span className="app-bottom-nav-label">
                  {getNavItemLabel(item.key)}
                </span>
              </Link>
            ))}
          </div>
        </nav>
      ) : null}
    </main>
  );
}
