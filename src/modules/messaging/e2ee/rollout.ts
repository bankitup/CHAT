export type DmE2eeRolloutMode = 'disabled' | 'selected' | 'all';

export type DmE2eeRolloutStatus = {
  mode: DmE2eeRolloutMode;
  enabled: boolean;
  testerUserIds: string[];
  testerEmails: string[];
};

type DmE2eeRolloutDiagnosticsInput = {
  enabled: boolean;
  enabledReason:
    | 'mode_all'
    | 'selected_match'
    | 'selected_no_match'
    | 'mode_disabled'
    | 'missing_user';
  hasUserEmail: boolean;
  hasUserId: boolean;
  matchedTesterEmail: boolean;
  matchedTesterUserId: boolean;
  mode: DmE2eeRolloutMode;
  rawMode: string | null;
  recognizedMode: boolean;
  source: string;
  testerEmailCount: number;
  testerUserIdCount: number;
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

function parseTesterEmails(value: string | undefined) {
  return Array.from(
    new Set(
      (value ?? '')
        .split(',')
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
}

function logDmE2eeRolloutDiagnostics(input: DmE2eeRolloutDiagnosticsInput) {
  if (process.env.CHAT_DEBUG_DM_E2EE_ROLLOUT !== '1') {
    return;
  }

  if (typeof window !== 'undefined') {
    return;
  }

  console.info('[dm-e2ee-rollout]', input.source, {
    rawMode: input.rawMode,
    recognizedMode: input.recognizedMode,
    mode: input.mode,
    hasUserId: input.hasUserId,
    hasUserEmail: input.hasUserEmail,
    matchedTesterUserId: input.matchedTesterUserId,
    matchedTesterEmail: input.matchedTesterEmail,
    testerUserIdCount: input.testerUserIdCount,
    testerEmailCount: input.testerEmailCount,
    enabled: input.enabled,
    enabledReason: input.enabledReason,
  });
}

export function getDmE2eeRolloutStatusForUser(
  userId: string | null | undefined,
  userEmail?: string | null,
  options?: {
    source?: string;
  },
): DmE2eeRolloutStatus {
  const rawMode = process.env.CHAT_DM_E2EE_ROLLOUT?.trim() ?? null;
  const mode = normalizeRolloutMode(rawMode ?? undefined);
  const recognizedMode = rawMode === 'all' || rawMode === 'selected';
  const testerUserIds = parseTesterUserIds(
    process.env.CHAT_DM_E2EE_TESTER_USER_IDS,
  );
  const testerEmails = parseTesterEmails(
    process.env.CHAT_DM_E2EE_TESTER_EMAILS,
  );
  const source = options?.source ?? 'unknown';

  if (!userId) {
    logDmE2eeRolloutDiagnostics({
      source,
      rawMode,
      recognizedMode,
      mode,
      hasUserId: false,
      hasUserEmail: Boolean(userEmail?.trim()),
      matchedTesterUserId: false,
      matchedTesterEmail: false,
      testerUserIdCount: testerUserIds.length,
      testerEmailCount: testerEmails.length,
      enabled: false,
      enabledReason: 'missing_user',
    });
    return {
      mode,
      enabled: false,
      testerUserIds,
      testerEmails,
    };
  }

  const normalizedEmail = userEmail?.trim().toLowerCase() ?? '';
  const matchedTesterUserId = testerUserIds.includes(userId);
  const matchedTesterEmail =
    normalizedEmail.length > 0 && testerEmails.includes(normalizedEmail);
  const enabled =
    mode === 'all' ||
    (mode === 'selected' && (matchedTesterUserId || matchedTesterEmail));
  const enabledReason: DmE2eeRolloutDiagnosticsInput['enabledReason'] =
    mode === 'all'
      ? 'mode_all'
      : mode === 'selected'
        ? matchedTesterUserId || matchedTesterEmail
          ? 'selected_match'
          : 'selected_no_match'
        : 'mode_disabled';

  logDmE2eeRolloutDiagnostics({
    source,
    rawMode,
    recognizedMode,
    mode,
    hasUserId: true,
    hasUserEmail: normalizedEmail.length > 0,
    matchedTesterUserId,
    matchedTesterEmail,
    testerUserIdCount: testerUserIds.length,
    testerEmailCount: testerEmails.length,
    enabled,
    enabledReason,
  });

  return {
    mode,
    enabled,
    testerUserIds,
    testerEmails,
  };
}

export function isDmE2eeEnabledForUser(
  userId: string | null | undefined,
  userEmail?: string | null,
  options?: {
    source?: string;
  },
) {
  return getDmE2eeRolloutStatusForUser(userId, userEmail, options).enabled;
}
