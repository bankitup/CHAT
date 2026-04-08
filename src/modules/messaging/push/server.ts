import 'server-only';

import { getRequestSupabaseServerClient } from '@/lib/request-context/server';
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service';
import type {
  PushSubscriptionRecordInput,
  StoredPushSubscription,
} from './contract';

type PushSubscriptionRow = {
  id: string;
  endpoint: string;
  created_at: string;
  updated_at: string;
  disabled_at: string | null;
};

function mapStoredPushSubscription(
  row: PushSubscriptionRow,
): StoredPushSubscription {
  return {
    id: row.id,
    endpoint: row.endpoint,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    disabledAt: row.disabled_at,
  };
}

async function getPushSubscriptionWriteClient() {
  return createSupabaseServiceRoleClient() ?? (await getRequestSupabaseServerClient());
}

export function isMissingPushSubscriptionsSchemaMessage(message: string) {
  const normalizedMessage = message.toLowerCase();

  return (
    normalizedMessage.includes('push_subscriptions') ||
    normalizedMessage.includes('browser_language') ||
    normalizedMessage.includes('expiration_time') ||
    normalizedMessage.includes('disabled_at') ||
    normalizedMessage.includes('p256dh')
  );
}

export async function upsertPushSubscriptionForUser(input: {
  userId: string;
  subscription: PushSubscriptionRecordInput;
}) {
  const client = await getPushSubscriptionWriteClient();
  const now = new Date().toISOString();
  const { data, error } = await client
    .from('push_subscriptions')
    .upsert(
      {
        user_id: input.userId,
        endpoint: input.subscription.endpoint,
        expiration_time: input.subscription.expirationTime,
        p256dh: input.subscription.keys.p256dh,
        auth: input.subscription.keys.auth,
        user_agent: input.subscription.userAgent,
        platform: input.subscription.platform,
        browser_language: input.subscription.language,
        updated_at: now,
        disabled_at: null,
      },
      {
        onConflict: 'endpoint',
      },
    )
    .select('id, endpoint, created_at, updated_at, disabled_at')
    .single<PushSubscriptionRow>();

  if (error) {
    throw error;
  }

  return mapStoredPushSubscription(data);
}

export async function disablePushSubscriptionForUser(input: {
  userId: string;
  endpoint: string;
}) {
  const client = await getPushSubscriptionWriteClient();
  const now = new Date().toISOString();
  const { data, error } = await client
    .from('push_subscriptions')
    .update({
      updated_at: now,
      disabled_at: now,
    })
    .eq('user_id', input.userId)
    .eq('endpoint', input.endpoint)
    .is('disabled_at', null)
    .select('id, endpoint, created_at, updated_at, disabled_at')
    .maybeSingle<PushSubscriptionRow>();

  if (error) {
    throw error;
  }

  return data ? mapStoredPushSubscription(data) : null;
}
