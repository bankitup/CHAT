import 'server-only';

import type { HomeSpaceUsageCardData } from './space-usage-contract';
import {
  getHomeSpacePlanDefinition,
  resolveCurrentHomeSpacePlanCode,
  resolveHomeSpaceOverallUsageState,
  resolveHomeSpaceUsageState,
  resolveNextHomeSpacePlanCode,
  type HomeSpacePlanCode,
  type HomeSpaceUsageState,
} from '@/modules/spaces/plan-config';
import { getRequestSupabaseServerClient } from '@/lib/request-context/server';
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service';
import { getTranslations } from '@/modules/i18n';
import type { SpaceParticipantRecord } from '@/modules/spaces/server';

export type HomeSpaceUsageMetricSnapshot = {
  limit: number;
  state: HomeSpaceUsageState;
  used: number;
};

export type HomeSpaceStorageUsageMetricSnapshot = {
  limitBytes: number;
  state: HomeSpaceUsageState;
  usedBytes: number;
};

export type HomeSpaceUsageSnapshot = {
  admins: HomeSpaceUsageMetricSnapshot;
  callMinutes: HomeSpaceUsageMetricSnapshot;
  members: HomeSpaceUsageMetricSnapshot;
  nextPlan: HomeSpacePlanCode | null;
  overallState: Exclude<HomeSpaceUsageState, 'future'>;
  plan: HomeSpacePlanCode;
  storage: HomeSpaceStorageUsageMetricSnapshot;
  upgradeRecommended: boolean;
};

type UsageTranslations = ReturnType<typeof getTranslations>;

function resolveUsageProgressPercent(input: { limit: number; used: number }) {
  if (input.limit <= 0) {
    return 0;
  }

  return Math.max(0, Math.min((input.used / input.limit) * 100, 100));
}

function formatStorageUsageBytes(input: {
  unitLabel: string;
  valueBytes: number;
}) {
  const valueInGigabytes = input.valueBytes / (1024 * 1024 * 1024);
  const roundedValue =
    valueInGigabytes >= 10
      ? Math.round(valueInGigabytes)
      : Math.round(valueInGigabytes * 10) / 10;

  return `${new Intl.NumberFormat(undefined, {
    maximumFractionDigits: roundedValue >= 10 ? 0 : 1,
    minimumFractionDigits:
      roundedValue > 0 && roundedValue < 10 ? 1 : 0,
  }).format(roundedValue)} ${input.unitLabel}`;
}

function resolveHomeSpacePlanLabel(input: {
  plan: HomeSpacePlanCode;
  t: UsageTranslations;
}) {
  switch (input.plan) {
    case 'private':
      return input.t.messengerHome.spaceUsagePrivatePlanLabel;
    case 'community':
      return input.t.messengerHome.spaceUsageCommunityPlanLabel;
    default:
      return input.plan;
  }
}

function resolveHomeSpacePlanSummary(input: {
  plan: HomeSpacePlanCode;
  t: UsageTranslations;
}) {
  switch (input.plan) {
    case 'private':
      return input.t.messengerHome.spaceUsagePrivatePlanSummary;
    case 'community':
      return input.t.messengerHome.spaceUsageCommunityPlanSummary;
    default:
      return null;
  }
}

function resolveHomeSpaceMetricStateLabel(input: {
  state: HomeSpaceUsageState;
  t: UsageTranslations;
}) {
  switch (input.state) {
    case 'future':
      return input.t.messengerHome.spaceUsageFutureLabel;
    case 'nearing':
      return input.t.messengerHome.spaceUsageNearingLimitLabel;
    case 'over':
      return input.t.messengerHome.spaceUsageOverLimitLabel;
    default:
      return null;
  }
}

function resolveHomeSpacePlanStateLabel(input: {
  state: HomeSpaceUsageSnapshot['overallState'];
  t: UsageTranslations;
}) {
  switch (input.state) {
    case 'nearing':
      return input.t.messengerHome.spaceUsageNearingLimitLabel;
    case 'over':
      return input.t.messengerHome.spaceUsageUpgradeRecommendedLabel;
    default:
      return null;
  }
}

function resolveHomeSpaceUpgradeActionLabel(input: {
  nextPlan: HomeSpaceUsageSnapshot['nextPlan'];
  t: UsageTranslations;
}) {
  if (input.nextPlan === 'community') {
    return input.t.messengerHome.spaceUsageUpgradeToCommunityAction;
  }

  return input.t.messengerHome.spaceUsageViewUsageAction;
}

function sumFinitePositiveNumbers(values: Array<number | null | undefined>) {
  return values.reduce<number>((total, value) => {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
      return total;
    }

    return total + value;
  }, 0);
}

async function getSpaceStorageUsageBytes(spaceId: string): Promise<number> {
  const requestSupabase = await getRequestSupabaseServerClient();
  const serviceSupabase = createSupabaseServiceRoleClient();
  const queryClient = serviceSupabase ?? requestSupabase;

  const { data: conversationRows, error: conversationsError } = await queryClient
    .from('conversations')
    .select('id')
    .eq('space_id', spaceId);

  if (conversationsError) {
    throw new Error(conversationsError.message);
  }

  const conversationIds = ((conversationRows ?? []) as Array<{ id: string }>)
    .map((row) => row.id)
    .filter(Boolean);

  if (conversationIds.length === 0) {
    return 0;
  }

  // Keep this explicit for now: Home only needs a simple current-space storage
  // rollup until a dedicated usage ledger exists.
  const { data: assetRows, error: assetsError } = await queryClient
    .from('message_assets')
    .select('size_bytes')
    .eq('source', 'supabase-storage')
    .in('conversation_id', conversationIds);

  if (assetsError) {
    throw new Error(assetsError.message);
  }

  return sumFinitePositiveNumbers(
    ((assetRows ?? []) as Array<{ size_bytes?: number | null }>).map(
      (row) => row.size_bytes ?? null,
    ),
  );
}

export async function getHomeSpaceUsageSnapshot(input: {
  participants: SpaceParticipantRecord[];
  spaceId: string;
}): Promise<HomeSpaceUsageSnapshot> {
  const membersUsed = input.participants.length;
  const adminsUsed = input.participants.filter(
    (participant) =>
      participant.role === 'owner' || participant.role === 'admin',
  ).length;
  const storageUsedBytes = await getSpaceStorageUsageBytes(input.spaceId);
  const plan = resolveCurrentHomeSpacePlanCode({
    adminsUsed,
    membersUsed,
    storageUsedBytes,
  });
  const planDefinition = getHomeSpacePlanDefinition(plan);
  const nextPlan = resolveNextHomeSpacePlanCode(plan);
  const members = {
    limit: planDefinition.limits.members,
    state: resolveHomeSpaceUsageState({
      limit: planDefinition.limits.members,
      used: membersUsed,
    }),
    used: membersUsed,
  } satisfies HomeSpaceUsageMetricSnapshot;
  const admins = {
    limit: planDefinition.limits.admins,
    state: resolveHomeSpaceUsageState({
      limit: planDefinition.limits.admins,
      used: adminsUsed,
    }),
    used: adminsUsed,
  } satisfies HomeSpaceUsageMetricSnapshot;
  const storage = {
    limitBytes: planDefinition.limits.storageBytes,
    state: resolveHomeSpaceUsageState({
      limit: planDefinition.limits.storageBytes,
      used: storageUsedBytes,
    }),
    usedBytes: storageUsedBytes,
  } satisfies HomeSpaceStorageUsageMetricSnapshot;
  const overallState = resolveHomeSpaceOverallUsageState([
    members.state,
    admins.state,
    storage.state,
  ]);

  return {
    admins,
    callMinutes: {
      limit: planDefinition.limits.callMinutes,
      state: 'future',
      used: 0,
    },
    members,
    nextPlan,
    overallState,
    plan,
    storage,
    upgradeRecommended: overallState !== 'normal',
  } satisfies HomeSpaceUsageSnapshot;
}

export async function getHomeSpaceUsageCardData(input: {
  managePlanHref: string;
  participants: SpaceParticipantRecord[];
  spaceId: string;
  t: UsageTranslations;
  upgradeHref: string;
}): Promise<HomeSpaceUsageCardData> {
  const snapshot = await getHomeSpaceUsageSnapshot({
    participants: input.participants,
    spaceId: input.spaceId,
  });

  return {
    adminSeatUsage: {
      limit: snapshot.admins.limit,
      used: snapshot.admins.used,
    },
    copy: {
      body: input.t.messengerHome.spaceUsageBody,
      currentPlanLabel: input.t.messengerHome.spaceUsageCurrentPlanLabel,
      futureTrackingNote: input.t.messengerHome.spaceUsageFutureTrackingNote,
      managePlanAction: input.t.messengerHome.spaceUsageManagePlanAction,
      previewPill: input.t.messengerHome.spaceUsagePreviewPill,
      title: input.t.messengerHome.spaceUsageTitle,
    },
    managePlanHref: input.managePlanHref,
    metrics: [
      {
        id: 'members',
        label: input.t.messengerHome.spaceUsageMembersLabel,
        limitLabel: String(snapshot.members.limit),
        progressPercent: resolveUsageProgressPercent({
          limit: snapshot.members.limit,
          used: snapshot.members.used,
        }),
        state: snapshot.members.state,
        stateLabel: resolveHomeSpaceMetricStateLabel({
          state: snapshot.members.state,
          t: input.t,
        }),
        tone: 'live',
        usedLabel: String(snapshot.members.used),
      },
      {
        id: 'admins',
        label: input.t.messengerHome.spaceUsageAdminsLabel,
        limitLabel: String(snapshot.admins.limit),
        progressPercent: resolveUsageProgressPercent({
          limit: snapshot.admins.limit,
          used: snapshot.admins.used,
        }),
        state: snapshot.admins.state,
        stateLabel: resolveHomeSpaceMetricStateLabel({
          state: snapshot.admins.state,
          t: input.t,
        }),
        tone: 'live',
        usedLabel: String(snapshot.admins.used),
      },
      {
        id: 'storage',
        label: input.t.messengerHome.spaceUsageStorageLabel,
        limitLabel: formatStorageUsageBytes({
          unitLabel: input.t.messengerHome.spaceUsageStorageUnit,
          valueBytes: snapshot.storage.limitBytes,
        }),
        progressPercent: resolveUsageProgressPercent({
          limit: snapshot.storage.limitBytes,
          used: snapshot.storage.usedBytes,
        }),
        state: snapshot.storage.state,
        stateLabel: resolveHomeSpaceMetricStateLabel({
          state: snapshot.storage.state,
          t: input.t,
        }),
        tone: 'live',
        usedLabel: formatStorageUsageBytes({
          unitLabel: input.t.messengerHome.spaceUsageStorageUnit,
          valueBytes: snapshot.storage.usedBytes,
        }),
      },
      {
        id: 'call-minutes',
        label: input.t.messengerHome.spaceUsageCallMinutesLabel,
        limitLabel: `${snapshot.callMinutes.limit} ${input.t.messengerHome.spaceUsageMinutesUnit}`,
        progressPercent: 0,
        state: snapshot.callMinutes.state,
        stateLabel: resolveHomeSpaceMetricStateLabel({
          state: snapshot.callMinutes.state,
          t: input.t,
        }),
        tone: 'future',
        usedLabel: `${snapshot.callMinutes.used} ${input.t.messengerHome.spaceUsageMinutesUnit}`,
      },
    ],
    planLabel: resolveHomeSpacePlanLabel({
      plan: snapshot.plan,
      t: input.t,
    }),
    planState: snapshot.overallState,
    planStateLabel: resolveHomeSpacePlanStateLabel({
      state: snapshot.overallState,
      t: input.t,
    }),
    planSummary: resolveHomeSpacePlanSummary({
      plan: snapshot.plan,
      t: input.t,
    }),
    upgradeActionLabel: resolveHomeSpaceUpgradeActionLabel({
      nextPlan: snapshot.nextPlan,
      t: input.t,
    }),
    upgradeHref: input.upgradeHref,
    upgradeRecommended: snapshot.upgradeRecommended,
  } satisfies HomeSpaceUsageCardData;
}
