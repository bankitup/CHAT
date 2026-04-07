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
  spaces: Array<{
    id: string;
    name: string;
  }>;
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
  const requestedSpaceId = searchParams.get('space');
  const activeSpace =
    spaces.find((space) => space.id === requestedSpaceId) ?? spaces[0] ?? null;
  const activeSpaceId = activeSpace?.id ?? requestedSpaceId;
  const navSpaceHref = (pathname: string) =>
    activeSpaceId ? withSpaceParam(pathname, activeSpaceId) : pathname;
  const showBottomNav = !isChatRoute && !isSpacesRoute;
  const showShellContext =
    !isChatRoute &&
    !isSpacesRoute &&
    (isHomeRoute || isRoomsRoute || isIssuesRoute || isTasksRoute || isActivityRoute);
  let activeTab: 'activity' | 'tasks' | 'issues' | 'rooms' | 'home' | null = null;

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

  const currentSection =
    activeTab === 'home'
      ? {
          body: t.shell.homeSectionBody,
          nextHref: '/rooms',
          nextLabel: t.shell.openRooms,
          title: t.shell.home,
        }
      : activeTab === 'rooms'
        ? {
            body: t.shell.roomsSectionBody,
            nextHref: '/issues',
            nextLabel: t.shell.openIssues,
            title: t.shell.rooms,
          }
        : activeTab === 'issues'
          ? {
              body: t.shell.issuesSectionBody,
              nextHref: '/tasks',
              nextLabel: t.shell.openTasks,
              title: t.shell.issues,
            }
          : activeTab === 'tasks'
            ? {
                body: t.shell.tasksSectionBody,
                nextHref: '/activity',
                nextLabel: t.shell.openActivity,
                title: t.shell.tasks,
              }
            : activeTab === 'activity'
              ? {
                  body: t.shell.activitySectionBody,
                  nextHref: '/home',
                  nextLabel: t.shell.openHome,
                  title: t.shell.activity,
                }
              : null;
  const chooseHomeHref = activeSpaceId ? withSpaceParam('/spaces', activeSpaceId) : '/spaces';

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
      {showShellContext && currentSection ? (
        <section className="app-shell-context" aria-label={t.shell.contextLabel}>
          <div className="app-shell-context-shell">
            <section className="stack app-shell-context-block">
              <span className="app-shell-context-kicker">{t.shell.activeHomeLabel}</span>
              <div className="app-shell-context-row">
                <p className="app-shell-context-title">
                  {activeSpace?.name || t.settings.noSpaceSelected}
                </p>
                <Link
                  className="pill app-shell-context-link"
                  href={chooseHomeHref}
                  prefetch={false}
                >
                  {t.settings.chooseAnotherSpace}
                </Link>
              </div>
              <p className="muted app-shell-context-body">{t.shell.homeScopeBody}</p>
            </section>

            <section className="stack app-shell-context-block">
              <span className="app-shell-context-kicker">{t.shell.currentSectionLabel}</span>
              <div className="app-shell-context-row">
                <p className="app-shell-context-title">{currentSection.title}</p>
                <Link
                  className="button button-secondary app-shell-context-button"
                  href={navSpaceHref(currentSection.nextHref)}
                  prefetch={false}
                >
                  {currentSection.nextLabel}
                </Link>
              </div>
              <p className="muted app-shell-context-body">{currentSection.body}</p>
            </section>
          </div>
        </section>
      ) : null}
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
          </div>
        </nav>
      ) : null}
    </main>
  );
}
