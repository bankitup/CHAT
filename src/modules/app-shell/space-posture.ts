import type { SpaceProfile } from '@/modules/spaces/model';
import { withSpaceParam } from '@/modules/spaces/url';

export type AppProductPosture = 'messenger' | 'keepcozy';
export type SpaceProfileDefaultShellRoute = '/inbox' | '/home';

export function getDefaultShellRouteForSpaceProfile(
  profile: SpaceProfile,
): SpaceProfileDefaultShellRoute {
  return profile === 'keepcozy_ops' ? '/home' : '/inbox';
}

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

export function resolveSpaceProfileShellHref(input: {
  profile: SpaceProfile;
  spaceId: string;
}) {
  return withSpaceParam(
    getDefaultShellRouteForSpaceProfile(input.profile),
    input.spaceId,
  );
}
