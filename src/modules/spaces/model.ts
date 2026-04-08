export type SpaceRole = 'owner' | 'admin' | 'member';

export type SpaceProfile = 'messenger_full' | 'keepcozy_ops';

export const SPACE_PROFILES = [
  'messenger_full',
  'keepcozy_ops',
] as const satisfies readonly SpaceProfile[];

export type SpaceProfileSource =
  | 'space_name_test_default'
  | 'fallback_messenger_default';

export type SpaceProfileDefaultShellRoute = '/inbox' | '/home';

export type ResolvedSpaceProfile = {
  profile: SpaceProfile;
  source: SpaceProfileSource;
  defaultShellRoute: SpaceProfileDefaultShellRoute;
};

export type SpaceRecord = {
  id: string;
  name: string;
  createdBy: string;
  createdAt: string | null;
  updatedAt: string | null;
};

export type SpaceMemberRecord = {
  spaceId: string;
  userId: string;
  role: SpaceRole;
  createdAt: string | null;
};
