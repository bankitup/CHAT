import type {
  SpaceProfile,
  SpaceProfileDefaultShellRoute,
  SpaceTheme,
} from './model';

export type AppShellSpaceSummary = {
  defaultShellRoute: SpaceProfileDefaultShellRoute;
  id: string;
  name: string;
  profile: SpaceProfile;
  theme: SpaceTheme;
};

export type AppShellMessengerActiveTab = 'activity' | 'chats' | 'home' | null;
export type AppShellProductActiveTab =
  | 'activity'
  | 'tasks'
  | 'issues'
  | 'rooms'
  | 'home'
  | null;

export type ResolvedAppShellState = {
  activeSpace: AppShellSpaceSummary | null;
  activeSpaceProfile: SpaceProfile | null;
  activeSpaceTheme: SpaceTheme;
  messengerActiveTab: AppShellMessengerActiveTab;
  productActiveTab: AppShellProductActiveTab;
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
  const activeSpaceProfile = input.activeSpace?.profile ?? null;
  const activeSpaceTheme = input.activeSpace?.theme ?? 'dark';

  let productActiveTab: AppShellProductActiveTab = null;
  let messengerActiveTab: AppShellMessengerActiveTab = null;

  if (isActivityRoute) {
    productActiveTab = 'activity';
  } else if (isTasksRoute) {
    productActiveTab = 'tasks';
  } else if (isIssuesRoute) {
    productActiveTab = 'issues';
  } else if (isRoomsRoute) {
    productActiveTab = 'rooms';
  } else if (isHomeRoute || isSettingsRoute) {
    productActiveTab = 'home';
  }

  if (isHomeRoute) {
    messengerActiveTab = 'home';
  } else if (input.pathname.startsWith('/inbox')) {
    messengerActiveTab = 'chats';
  } else if (isActivityRoute) {
    messengerActiveTab = 'activity';
  }

  return {
    activeSpace: input.activeSpace,
    activeSpaceProfile,
    activeSpaceTheme,
    messengerActiveTab,
    productActiveTab,
    showBottomNav:
      !isChatRoute &&
      !(isSpacesRoute && activeSpaceProfile !== 'messenger_full'),
  };
}
