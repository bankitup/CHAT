import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { PushSubscriptionRecordInput } from '@/modules/messaging/push/contract';
import {
  disablePushSubscriptionForUser,
  isMissingPushSubscriptionsSchemaMessage,
  upsertPushSubscriptionForUser,
} from '@/modules/messaging/push/server';

const PUSH_SUBSCRIPTIONS_SQL_PATH =
  '/Users/danya/IOS - Apps/CHAT/docs/sql/2026-04-08-push-subscriptions-foundation.sql';

function isPushSubscriptionInput(
  value: unknown,
): value is PushSubscriptionRecordInput {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<PushSubscriptionRecordInput>;
  const keys = candidate.keys as Partial<PushSubscriptionRecordInput['keys']> | undefined;

  return (
    typeof candidate.endpoint === 'string' &&
    candidate.endpoint.trim().length > 0 &&
    (candidate.expirationTime === null ||
      typeof candidate.expirationTime === 'number') &&
    typeof keys?.p256dh === 'string' &&
    keys.p256dh.trim().length > 0 &&
    typeof keys?.auth === 'string' &&
    keys.auth.trim().length > 0 &&
    (candidate.userAgent === null || typeof candidate.userAgent === 'string') &&
    (candidate.platform === null || typeof candidate.platform === 'string') &&
    (candidate.language === null || typeof candidate.language === 'string')
  );
}

function isDeletePushSubscriptionInput(
  value: unknown,
): value is { endpoint: string } {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as { endpoint?: unknown };

  return typeof candidate.endpoint === 'string' && candidate.endpoint.trim().length > 0;
}

function createMissingSchemaResponse() {
  return NextResponse.json(
    {
      error: 'Push subscriptions are not ready on the server yet.',
      code: 'push_subscription_schema_missing',
      migration: PUSH_SUBSCRIPTIONS_SQL_PATH,
    },
    { status: 503 },
  );
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  let input: unknown;

  try {
    input = await request.json();
  } catch {
    return NextResponse.json(
      {
        error: 'Invalid push subscription payload.',
      },
      { status: 400 },
    );
  }

  if (!isPushSubscriptionInput(input)) {
    return NextResponse.json(
      {
        error: 'Invalid push subscription payload.',
      },
      { status: 400 },
    );
  }

  try {
    const subscription = await upsertPushSubscriptionForUser({
      userId: user.id,
      subscription: input,
    });

    return NextResponse.json({
      ok: true,
      subscription,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Unable to save this push subscription.';

    if (isMissingPushSubscriptionsSchemaMessage(message)) {
      return createMissingSchemaResponse();
    }

    return NextResponse.json(
      {
        error: 'Unable to save this push subscription right now.',
      },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  let input: unknown;

  try {
    input = await request.json();
  } catch {
    return NextResponse.json(
      {
        error: 'Invalid push subscription payload.',
      },
      { status: 400 },
    );
  }

  if (!isDeletePushSubscriptionInput(input)) {
    return NextResponse.json(
      {
        error: 'Invalid push subscription payload.',
      },
      { status: 400 },
    );
  }

  try {
    const subscription = await disablePushSubscriptionForUser({
      userId: user.id,
      endpoint: input.endpoint,
    });

    return NextResponse.json({
      ok: true,
      subscription,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Unable to remove this push subscription.';

    if (isMissingPushSubscriptionsSchemaMessage(message)) {
      return createMissingSchemaResponse();
    }

    return NextResponse.json(
      {
        error: 'Unable to remove this push subscription right now.',
      },
      { status: 400 },
    );
  }
}
