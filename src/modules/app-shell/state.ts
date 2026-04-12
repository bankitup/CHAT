import type { SpaceProfile, SpaceTheme } from '@/modules/spaces/model';
import { withSpaceParam } from '@/modules/spaces/url';
import {
  isMessengerProductPosture,
  resolveSpaceProductPosture,
  type AppProductPosture,
} from './space-posture';

export type AppRouteProductSurface = 'keepcozy' | 'messenger' | 'platform';
export type AppShellNavItemKey =
  | 'activity'
  | 'chats'
  | 'home'
  | 'issues'
  | 'rooms'
  | 'tasks';

export type AppShellNavItem = {
  href: string;
  isActive: boolean;
  key: AppShellNavItemKey;
  prefetch: boolean;
};

export type AppShellSpaceSummary = {
  id: string;
  name: string;
  profile: SpaceProfile;
  theme: SpaceTheme;
};

export type ResolvedAppShellState = {
  activeSpace: AppShellSpaceSummary | null;
  activeProductPosture: AppProductPosture | null;
  activeSpaceTheme: SpaceTheme;
  bottomNavProductPosture: AppProductPosture | null;
  navItems: AppShellNavItem[];
  routeProductSurface: AppRouteProductSurface;
  showBottomNav: boolean;
};

export function resolveActiveAppShellSpace(input: {
  activeSpaceId: string | null;
  spaces: AppShellSpaceSummary[];
}) {
  return (
    (input.activeSpaceId
      ? input.spaces.find((space) => space.id === input.activeSpaceId)
      : null) ??
    input.spaces[0] ??
    null
  );
}

export function resolveAppShellState(input: {
  activeSpace: AppShellSpaceSummary | null;
  pathname: string;
}): ResolvedAppShellState {
  const isChatRoute = input.pathname.startsWith('/chat/');
  const isSpacesRoute = input.pathname.startsWith('/spaces');
  const isActivityRoute = input.pathname.startsWith('/activity');
  const isSettingsRoute = input.pathname.startsWith('/settings');
  const isHomeRoute = input.pathname.startsWith('/home');
  const isRoomsRoute = input.pathname.startsWith('/rooms');
  const isIssuesRoute = input.pathname.startsWith('/issues');
  const isTasksRoute = input.pathname.startsWith('/tasks');
  const activeProductPosture = input.activeSpace
    ? resolveSpaceProductPosture(input.activeSpace.profile)
    : null;
  const activeSpaceTheme = input.activeSpace?.theme ?? 'dark';
  let routeProductSurface: AppRouteProductSurface = 'platform';

  if (isChatRoute || input.pathname.startsWith('/inbox')) {
    routeProductSurface = 'messenger';
  } else if (isRoomsRoute || isIssuesRoute || isTasksRoute) {
    routeProductSurface = 'keepcozy';
  } else if (isHomeRoute || isActivityRoute || isSettingsRoute) {
    routeProductSurface = activeProductPosture ?? 'platform';
  }

  const showBottomNav =
    !isChatRoute &&
    !(isSpacesRoute && !isMessengerProductPosture(activeProductPosture));
  const bottomNavProductPosture = showBottomNav ? activeProductPosture : null;
  const navItems = buildAppShellNavItems({
    activeSpace: input.activeSpace,
    pathname: input.pathname,
  });

  return {
    activeSpace: input.activeSpace,
    activeProductPosture,
    activeSpaceTheme,
    bottomNavProductPosture,
    navItems,
    routeProductSurface,
    showBottomNav,
  };
}

function buildAppShellNavItems(input: {
  activeSpace: AppShellSpaceSummary | null;
  pathname: string;
}): AppShellNavItem[] {
  if (!input.activeSpace) {
    return [];
  }

  const buildHref = (pathname: string) =>
    withSpaceParam(pathname, input.activeSpace?.id);
  const isActivityRoute = input.pathname.startsWith('/activity');
  const isSettingsRoute = input.pathname.startsWith('/settings');
  const isHomeRoute = input.pathname.startsWith('/home');
  const isRoomsRoute = input.pathname.startsWith('/rooms');
  const isIssuesRoute = input.pathname.startsWith('/issues');
  const isTasksRoute = input.pathname.startsWith('/tasks');
  const isInboxRoute = input.pathname.startsWith('/inbox');
  const activeProductPosture = resolveSpaceProductPosture(
    input.activeSpace.profile,
  );

  if (isMessengerProductPosture(activeProductPosture)) {
    return [
      {
        href: buildHref('/home'),
        isActive: isHomeRoute,
        key: 'home',
        prefetch: true,
      },
      {
        href: buildHref('/inbox'),
        isActive: isInboxRoute,
        key: 'chats',
        prefetch: true,
      },
      {
        href: buildHref('/activity'),
        isActive: isActivityRoute,
        key: 'activity',
        prefetch: true,
      },
    ];
  }

  return [
    {
      href: buildHref('/home'),
      isActive: isHomeRoute || isSettingsRoute,
      key: 'home',
      prefetch: false,
    },
    {
      href: buildHref('/rooms'),
      isActive: isRoomsRoute,
      key: 'rooms',
      prefetch: false,
    },
    {
      href: buildHref('/issues'),
      isActive: isIssuesRoute,
      key: 'issues',
      prefetch: false,
    },
    {
      href: buildHref('/tasks'),
      isActive: isTasksRoute,
      key: 'tasks',
      prefetch: false,
    },
    {
      href: buildHref('/activity'),
      isActive: isActivityRoute,
      key: 'activity',
      prefetch: false,
    },
  ];
}
