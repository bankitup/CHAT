import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  isMissingPushSubscriptionsSchemaMessage,
  isPushTestSendEnabledForUser,
  sendPushTestNotificationToUserDevice,
} from '@/modules/messaging/push/server';

function isValidPushTestInput(
  value: unknown,
): value is { endpoint: string; spaceId?: string | null } {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as {
    endpoint?: unknown;
    spaceId?: unknown;
  };

  return (
    typeof candidate.endpoint === 'string' &&
    candidate.endpoint.trim().length > 0 &&
    (candidate.spaceId == null || typeof candidate.spaceId === 'string')
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

  if (!isPushTestSendEnabledForUser({ userEmail: user.email ?? null })) {
    return NextResponse.json(
      {
        code: 'push_test_send_disabled',
        error: 'Test notifications are only available in preview, development, or for super admins.',
      },
      { status: 403 },
    );
  }

  let input: unknown;

  try {
    input = await request.json();
  } catch {
    return NextResponse.json(
      {
        error: 'Invalid test notification payload.',
      },
      { status: 400 },
    );
  }

  if (!isValidPushTestInput(input)) {
    return NextResponse.json(
      {
        error: 'Invalid test notification payload.',
      },
      { status: 400 },
    );
  }

  try {
    const result = await sendPushTestNotificationToUserDevice({
      endpoint: input.endpoint.trim(),
      spaceId: input.spaceId?.trim() || null,
      userId: user.id,
    });

    if (!result.sent) {
      if (result.skippedReason === 'missing-vapid-config') {
        return NextResponse.json(
          {
            code: 'push_test_vapid_missing',
            error: 'Push delivery is not configured for this environment yet.',
          },
          { status: 503 },
        );
      }

      if (result.skippedReason === 'invalid-vapid-config') {
        return NextResponse.json(
          {
            code: 'push_test_vapid_invalid',
            error:
              'Push delivery credentials are invalid for this environment. Verify the configured VAPID keys.',
            detail: result.errorMessage ?? null,
          },
          { status: 503 },
        );
      }

      if (result.skippedReason === 'subscription-not-found') {
        return NextResponse.json(
          {
            code: 'push_test_subscription_missing',
            error: 'This browser is not registered for push notifications yet.',
          },
          { status: 409 },
        );
      }

      if (result.skippedReason === 'subscription-expired') {
        return NextResponse.json(
          {
            code: 'push_test_subscription_expired',
            error:
              'This browser subscription expired or was replaced. Re-enable notifications on this device.',
          },
          { status: 409 },
        );
      }

      if (result.skippedReason === 'vapid-rejected') {
        return NextResponse.json(
          {
            code: 'push_test_vapid_rejected',
            error:
              'The push service rejected this environment’s VAPID credentials. Verify that the configured public and private keys are a matching pair.',
            detail: result.errorMessage ?? null,
          },
          { status: 503 },
        );
      }

      return NextResponse.json(
        {
          code: 'push_test_send_failed',
          error: 'Push delivery failed after the device was connected.',
          detail: result.errorMessage ?? null,
          statusCode: result.errorStatusCode ?? null,
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ok: true,
      result,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Unable to send a test notification right now.';

    if (isMissingPushSubscriptionsSchemaMessage(message)) {
      return NextResponse.json(
        {
          code: 'push_subscription_schema_missing',
          error: 'Push subscriptions are not ready on the server yet.',
        },
        { status: 503 },
      );
    }

    return NextResponse.json(
      {
        error: 'Unable to send a test notification right now.',
      },
      { status: 400 },
    );
  }
}
