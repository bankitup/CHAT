'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
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

type AppShellFrameProps = {
  children: ReactNode;
  dmE2eeEnabled: boolean;
  language: AppLanguage;
  spaces: AppShellSpaceSummary[];
  userId: string;
};

function DeferredMessengerShellEffects({
  includePresenceSync,
  syncKey,
}: {
  includePresenceSync: boolean;
  syncKey: string;
}) {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let animationFrameId: number | null = null;
    let idleCallbackId: number | null = null;
    let timeoutId: number | null = null;
    const idleWindow = window as Window & {
      cancelIdleCallback?: (handle: number) => void;
      requestIdleCallback?: (
        callback: IdleRequestCallback,
        options?: IdleRequestOptions,
      ) => number;
    };

    const markReady = () => {
      if (!cancelled) {
        setIsReady(true);
      }
    };

    animationFrameId = window.requestAnimationFrame(() => {
      if (typeof idleWindow.requestIdleCallback === 'function') {
        idleCallbackId = idleWindow.requestIdleCallback(markReady, {
          timeout: 1200,
        });
        return;
      }

      timeoutId = window.setTimeout(markReady, 120);
    });

    return () => {
      cancelled = true;

      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
      }

      if (
        idleCallbackId !== null &&
        typeof idleWindow.cancelIdleCallback === 'function'
      ) {
        idleWindow.cancelIdleCallback(idleCallbackId);
      }

      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, []);

  if (!isReady) {
    return null;
  }

  return (
    <>
      <ChatUnreadBadgeSync syncKey={syncKey} />
      {includePresenceSync ? <PushSubscriptionPresenceSync /> : null}
      <WarmNavRouteObserver />
    </>
  );
}

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
  const isInboxRoute = pathname.startsWith('/inbox');
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
  const badgeSyncKey = `${pathname}?${searchParams.toString()}`;
  const isMessengerShell = shellState.bottomNavProductPosture === 'messenger';
  const isMessengerSurface = shellState.routeProductSurface === 'messenger';
  const shouldMountDmBoundary =
    dmE2eeEnabled && (isChatRoute || isInboxRoute);
  const shouldMountImmediatePresenceSync = isMessengerSurface && isChatRoute;
  const shouldMountDeferredMessengerEffects = isMessengerSurface;
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
      {shouldMountDmBoundary ? (
        <DmE2eeAuthenticatedBoundary enabled={dmE2eeEnabled} userId={userId} />
      ) : null}
      {shouldMountImmediatePresenceSync ? <PushSubscriptionPresenceSync /> : null}
      {shouldMountDeferredMessengerEffects ? (
        <DeferredMessengerShellEffects
          includePresenceSync={!shouldMountImmediatePresenceSync}
          syncKey={badgeSyncKey}
        />
      ) : null}
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
