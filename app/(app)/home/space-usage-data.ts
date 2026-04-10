import 'server-only';

import { getRequestSupabaseServerClient } from '@/lib/request-context/server';
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service';
import type { SpaceParticipantRecord } from '@/modules/spaces/server';

export type HomeSpaceUsagePlanCode = 'starter';

export type HomeSpaceUsageSnapshot = {
  plan: HomeSpaceUsagePlanCode;
  membersUsed: number;
  membersLimit: number;
  adminsUsed: number;
  adminsLimit: number;
  storageUsedBytes: number;
  storageLimitBytes: number;
  callMinutesUsed: number;
  callMinutesLimit: number;
  upgradeRecommended: boolean;
};

const HOME_SPACE_USAGE_PLAN_LIMITS: Record<
  HomeSpaceUsagePlanCode,
  {
    admins: number;
    callMinutes: number;
    members: number;
    storageBytes: number;
  }
> = {
  starter: {
    admins: 3,
    callMinutes: 600,
    members: 24,
    storageBytes: 25 * 1024 * 1024 * 1024,
  },
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
  const plan = 'starter' satisfies HomeSpaceUsagePlanCode;
  const limits = HOME_SPACE_USAGE_PLAN_LIMITS[plan];
  const membersUsed = input.participants.length;
  const adminsUsed = input.participants.filter(
    (participant) =>
      participant.role === 'owner' || participant.role === 'admin',
  ).length;
  const storageUsedBytes = await getSpaceStorageUsageBytes(input.spaceId);
  const upgradeRecommended =
    membersUsed / limits.members >= 0.8 ||
    adminsUsed / limits.admins >= 0.8 ||
    storageUsedBytes / limits.storageBytes >= 0.8;

  return {
    adminsLimit: limits.admins,
    adminsUsed,
    callMinutesLimit: limits.callMinutes,
    callMinutesUsed: 0,
    membersLimit: limits.members,
    membersUsed,
    plan,
    storageLimitBytes: limits.storageBytes,
    storageUsedBytes,
    upgradeRecommended,
  } satisfies HomeSpaceUsageSnapshot;
}
