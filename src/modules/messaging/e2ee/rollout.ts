export type DmE2eeRolloutMode = 'disabled' | 'selected' | 'all';

export type DmE2eeRolloutStatus = {
  mode: DmE2eeRolloutMode;
  enabled: boolean;
  testerUserIds: string[];
};

function normalizeRolloutMode(value: string | undefined): DmE2eeRolloutMode {
  if (value === 'all' || value === 'selected') {
    return value;
  }

  return 'disabled';
}

function parseTesterUserIds(value: string | undefined) {
  return Array.from(
    new Set(
      (value ?? '')
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  );
}

export function getDmE2eeRolloutStatusForUser(
  userId: string | null | undefined,
): DmE2eeRolloutStatus {
  const mode = normalizeRolloutMode(process.env.CHAT_DM_E2EE_ROLLOUT);
  const testerUserIds = parseTesterUserIds(
    process.env.CHAT_DM_E2EE_TESTER_USER_IDS,
  );

  if (!userId) {
    return {
      mode,
      enabled: false,
      testerUserIds,
    };
  }

  return {
    mode,
    enabled:
      mode === 'all' ||
      (mode === 'selected' && testerUserIds.includes(userId)),
    testerUserIds,
  };
}

export function isDmE2eeEnabledForUser(userId: string | null | undefined) {
  return getDmE2eeRolloutStatusForUser(userId).enabled;
}
