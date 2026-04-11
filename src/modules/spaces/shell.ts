import type {
  SpaceProfile,
  SpaceProfileDefaultShellRoute,
  SpaceTheme,
} from './model';
import { withSpaceParam } from './url';

/**
 * Shared app-shell posture helpers.
 *
 * Product components still render their own navigation, but active-space
 * selection and shared route posture live here so they are easier to reason
 * about as platform concerns.
 */
export type AppShellSpaceSummary = {
  defaultShellRoute: SpaceProfileDefaultShellRoute;
  id: string;
  name: string;
  profile: SpaceProfile;
  productPosture: AppProductPosture;
  theme: SpaceTheme;
};

export type AppProductPosture = 'messenger' | 'keepcozy';
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

export type ResolvedAppShellState = {
  activeSpace: AppShellSpaceSummary | null;
  activeProductPosture: AppProductPosture | null;
  activeSpaceTheme: SpaceTheme;
  bottomNavProductPosture: AppProductPosture | null;
  navItems: AppShellNavItem[];
  routeProductSurface: AppRouteProductSurface;
  showBottomNav: boolean;
};

export function resolveSpaceProductPosture(
  profile: SpaceProfile,
): AppProductPosture {
  return profile === 'keepcozy_ops' ? 'keepcozy' : 'messenger';
}

export function isMessengerProductPosture(
  posture: AppProductPosture | null | undefined,
): posture is 'messenger' {
  return posture === 'messenger';
}

export function isKeepCozyProductPosture(
  posture: AppProductPosture | null | undefined,
): posture is 'keepcozy' {
  return posture === 'keepcozy';
}

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
  const activeProductPosture = input.activeSpace?.productPosture ?? null;
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

  if (isMessengerProductPosture(input.activeSpace.productPosture)) {
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
