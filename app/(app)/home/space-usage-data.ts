import 'server-only';

import {
  getHomeSpacePlanDefinition,
  resolveCurrentHomeSpacePlanCode,
  resolveHomeSpaceOverallUsageState,
  resolveHomeSpaceUsageState,
  resolveNextHomeSpacePlanCode,
  type HomeSpacePlanCode,
  type HomeSpaceUsageState,
} from './space-plan-config';
import { getRequestSupabaseServerClient } from '@/lib/request-context/server';
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service';
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
