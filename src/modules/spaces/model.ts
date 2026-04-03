export type SpaceRole = 'owner' | 'admin' | 'member';

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
