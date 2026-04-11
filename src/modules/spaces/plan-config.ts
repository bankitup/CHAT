export type HomeSpacePlanCode = 'community' | 'private';

export type HomeSpaceUsageState = 'future' | 'nearing' | 'normal' | 'over';

export type HomeSpacePlanDefinition = {
  capabilities: {
    basicGroups: boolean;
    dm: boolean;
    fixedHistory: boolean;
    metadataExports: boolean;
    moderation: boolean;
    moderationLogs: boolean;
  };
  code: HomeSpacePlanCode;
  includedSpaces: number;
  limits: {
    admins: number;
    callMinutes: number;
    members: number;
    storageBytes: number;
  };
};

const TEMP_HOME_SPACE_PLAN_DEFINITIONS: Record<
  HomeSpacePlanCode,
  HomeSpacePlanDefinition
> = {
  private: {
    capabilities: {
      basicGroups: true,
      dm: true,
      fixedHistory: true,
      metadataExports: false,
      moderation: false,
      moderationLogs: false,
    },
    code: 'private',
    includedSpaces: 1,
    limits: {
      admins: 2,
      callMinutes: 300,
      members: 20,
      storageBytes: 10 * 1024 * 1024 * 1024,
    },
  },
  community: {
    capabilities: {
      basicGroups: true,
      dm: true,
      fixedHistory: true,
      metadataExports: true,
      moderation: true,
      moderationLogs: true,
    },
    code: 'community',
    includedSpaces: 1,
    limits: {
      admins: 6,
      callMinutes: 3000,
      members: 100,
      storageBytes: 100 * 1024 * 1024 * 1024,
    },
  },
};

const HOME_SPACE_USAGE_NEARING_THRESHOLD = 0.8;

export function getHomeSpacePlanDefinition(code: HomeSpacePlanCode) {
  return TEMP_HOME_SPACE_PLAN_DEFINITIONS[code];
}

export function resolveCurrentHomeSpacePlanCode(input: {
  adminsUsed: number;
  membersUsed: number;
  storageUsedBytes: number;
}): HomeSpacePlanCode {
  const privatePlan = getHomeSpacePlanDefinition('private');

  if (
    input.membersUsed > privatePlan.limits.members ||
    input.adminsUsed > privatePlan.limits.admins ||
    input.storageUsedBytes > privatePlan.limits.storageBytes
  ) {
    return 'community';
  }

  return 'private';
}

export function resolveHomeSpaceOverallUsageState(
  states: Array<Exclude<HomeSpaceUsageState, 'future'>>,
): Exclude<HomeSpaceUsageState, 'future'> {
  if (states.includes('over')) {
    return 'over';
  }

  if (states.includes('nearing')) {
    return 'nearing';
  }

  return 'normal';
}

export function resolveHomeSpaceUsageState(input: {
  limit: number;
  used: number;
}): Exclude<HomeSpaceUsageState, 'future'> {
  if (input.limit <= 0) {
    return 'normal';
  }

  if (input.used >= input.limit) {
    return 'over';
  }

  if (input.used / input.limit >= HOME_SPACE_USAGE_NEARING_THRESHOLD) {
    return 'nearing';
  }

  return 'normal';
}

export function resolveNextHomeSpacePlanCode(
  code: HomeSpacePlanCode,
): HomeSpacePlanCode | null {
  switch (code) {
    case 'private':
      return 'community';
    case 'community':
      return null;
    default:
      return null;
  }
}
