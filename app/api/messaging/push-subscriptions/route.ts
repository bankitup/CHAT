import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getInboxSectionPreferences } from '@/modules/messaging/inbox/preferences-server';
import { normalizeInboxPreviewDisplayMode } from '@/modules/messaging/inbox/preferences';
import type {
  PushSubscriptionPresenceInput,
  PushSubscriptionRecordInput,
} from '@/modules/messaging/push/contract';
import {
  disablePushSubscriptionForUser,
  getPushSubscriptionStateForUser,
  isMissingPushSubscriptionsSchemaMessage,
  updatePushSubscriptionPresenceForUser,
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

function isPushSubscriptionPresenceInput(
  value: unknown,
): value is PushSubscriptionPresenceInput {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<PushSubscriptionPresenceInput>;

  return (
    typeof candidate.endpoint === 'string' &&
    candidate.endpoint.trim().length > 0 &&
    typeof candidate.activeInApp === 'boolean' &&
    (candidate.previewMode === undefined ||
      candidate.previewMode === null ||
      typeof candidate.previewMode === 'string') &&
    (candidate.activeConversationId === null ||
      typeof candidate.activeConversationId === 'string')
  );
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

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const endpoint = searchParams.get('endpoint')?.trim() || null;

  try {
    const state = await getPushSubscriptionStateForUser({
      userId: user.id,
      endpoint,
    });

    return NextResponse.json(state, {
      headers: {
        'cache-control': 'no-store',
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Unable to load push subscription state.';

    if (isMissingPushSubscriptionsSchemaMessage(message)) {
      return createMissingSchemaResponse();
    }

    return NextResponse.json(
      {
        error: 'Unable to load push subscription state right now.',
      },
      {
        headers: {
          'cache-control': 'no-store',
        },
        status: 400,
      },
    );
  }
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
    const inboxPreferences = await getInboxSectionPreferences();
    const subscription = await upsertPushSubscriptionForUser({
      previewMode: inboxPreferences.previewMode,
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

export async function PATCH(request: Request) {
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

  if (!isPushSubscriptionPresenceInput(input)) {
    return NextResponse.json(
      {
        error: 'Invalid push subscription payload.',
      },
      { status: 400 },
    );
  }

  try {
    const synced = await updatePushSubscriptionPresenceForUser({
      userId: user.id,
      presence: {
        activeConversationId: input.activeInApp
          ? input.activeConversationId?.trim() || null
          : null,
        activeInApp: input.activeInApp,
        endpoint: input.endpoint.trim(),
        previewMode:
          input.previewMode == null
            ? null
            : normalizeInboxPreviewDisplayMode(input.previewMode),
      },
    });

    return NextResponse.json({
      ok: true,
      synced,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Unable to sync push subscription presence.';

    if (
      message.toLowerCase().includes('presence_updated_at') ||
      message.toLowerCase().includes('active_conversation_id')
    ) {
      return NextResponse.json({
        ok: true,
        reason: 'presence-schema-missing',
        synced: false,
      });
    }

    if (isMissingPushSubscriptionsSchemaMessage(message)) {
      return NextResponse.json({
        ok: true,
        reason: 'subscription-schema-missing',
        synced: false,
      });
    }

    return NextResponse.json(
      {
        error: 'Unable to sync push subscription presence right now.',
      },
      { status: 400 },
    );
  }
}
