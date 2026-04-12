export type {
  AppRouteProductSurface,
  AppShellNavItem,
  AppShellNavItemKey,
  AppShellSpaceSummary,
  ResolvedAppShellState,
} from '../app-shell/state';
export {
  resolveActiveAppShellSpace,
  resolveAppShellState,
} from '../app-shell/state';
export type {
  AppProductPosture,
  SpaceProfileDefaultShellRoute,
} from '../app-shell/space-posture';
export {
  getDefaultShellRouteForSpaceProfile,
  isKeepCozyProductPosture,
  isMessengerProductPosture,
  resolveSpaceProductPosture,
  resolveSpaceProfileShellHref,
} from '../app-shell/space-posture';
