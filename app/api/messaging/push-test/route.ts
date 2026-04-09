import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  isMissingPushSubscriptionsSchemaMessage,
  isPushTestSendEnabledForUser,
  sendPushTestNotificationToUserDevice,
} from '@/modules/messaging/push/server';

function getHostFromHeaderUrl(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).host || null;
  } catch {
    return null;
  }
}

function getPushTestRequestContext(request: Request) {
  const requestUrl = new URL(request.url);

  return {
    deploymentHost: process.env.VERCEL_URL?.trim() || null,
    originHost: getHostFromHeaderUrl(request.headers.get('origin')),
    refererHost: getHostFromHeaderUrl(request.headers.get('referer')),
    requestHost: requestUrl.host || null,
  };
}

function getPushTestLikelyCause(input: {
  failureReason?: string | null;
  originHost: string | null;
  refererHost: string | null;
  requestHost: string | null;
}) {
  if (input.failureReason === 'delivery-config-missing') {
    return 'delivery_config_missing';
  }

  if (input.failureReason === 'delivery-config-invalid') {
    return 'delivery_config_invalid';
  }

  if (input.failureReason === 'vapid-rejected') {
    if (
      (input.originHost && input.requestHost && input.originHost !== input.requestHost) ||
      (input.refererHost && input.requestHost && input.refererHost !== input.requestHost)
    ) {
      return 'origin_mismatch_suspected';
    }

    return 'stale_subscription_or_vapid_pair_mismatch';
  }

  if (input.failureReason === 'push-service-error') {
    return 'push_service_rejection';
  }

  if (input.failureReason === 'network-error') {
    return 'network_or_provider_connectivity_issue';
  }

  if (input.failureReason === 'rate-limited') {
    return 'push_service_rate_limited';
  }

  return null;
}

function logPushTestRouteFailure(details: Record<string, unknown>) {
  console.error('[chat-push-test-route]', details);
}

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
  const requestContext = getPushTestRequestContext(request);
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
        logPushTestRouteFailure({
          code: 'push_test_vapid_missing',
          ...requestContext,
          userId: user.id,
        });

        return NextResponse.json(
          {
            code: 'push_test_vapid_missing',
            error: 'Push delivery is not configured for this environment yet.',
            failureReason: result.failureReason ?? 'delivery-config-missing',
            likelyCause: getPushTestLikelyCause({
              failureReason: result.failureReason,
              ...requestContext,
            }),
            ...requestContext,
          },
          { status: 503 },
        );
      }

      if (result.skippedReason === 'invalid-vapid-config') {
        logPushTestRouteFailure({
          code: 'push_test_vapid_invalid',
          detail: result.errorMessage ?? null,
          ...requestContext,
          userId: user.id,
        });

        return NextResponse.json(
          {
            code: 'push_test_vapid_invalid',
            error:
              'Push delivery credentials are invalid for this environment. Verify the configured VAPID keys.',
            detail: result.errorMessage ?? null,
            failureReason: result.failureReason ?? 'delivery-config-invalid',
            likelyCause: getPushTestLikelyCause({
              failureReason: result.failureReason,
              ...requestContext,
            }),
            nodeCode: result.nodeCode ?? null,
            providerBody: result.providerBody ?? null,
            ...requestContext,
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
        logPushTestRouteFailure({
          code: 'push_test_vapid_rejected',
          detail: result.errorMessage ?? null,
          failureReason: result.failureReason ?? 'vapid-rejected',
          ...requestContext,
          subscriptionCreatedAt: result.subscriptionCreatedAt ?? null,
          subscriptionUpdatedAt: result.subscriptionUpdatedAt ?? null,
          userId: user.id,
        });

        return NextResponse.json(
          {
            code: 'push_test_vapid_rejected',
            error:
              'The push service rejected this environment’s VAPID credentials. Verify that the configured public and private keys are a matching pair.',
            detail: result.errorMessage ?? null,
            endpointHost: result.endpointHost ?? null,
            failureReason: result.failureReason ?? 'vapid-rejected',
            likelyCause: getPushTestLikelyCause({
              failureReason: result.failureReason,
              ...requestContext,
            }),
            nodeCode: result.nodeCode ?? null,
            providerBody: result.providerBody ?? null,
            providerStatusCode: result.errorStatusCode ?? null,
            subscriptionCreatedAt: result.subscriptionCreatedAt ?? null,
            subscriptionUpdatedAt: result.subscriptionUpdatedAt ?? null,
            ...requestContext,
          },
          { status: 503 },
        );
      }

      if (
        result.failureReason === 'push-service-error' ||
        result.failureReason === 'network-error' ||
        result.failureReason === 'rate-limited'
      ) {
        logPushTestRouteFailure({
          code: 'push_test_delivery_unavailable',
          detail: result.errorMessage ?? null,
          failureReason: result.failureReason,
          ...requestContext,
          subscriptionCreatedAt: result.subscriptionCreatedAt ?? null,
          subscriptionUpdatedAt: result.subscriptionUpdatedAt ?? null,
          userId: user.id,
        });

        return NextResponse.json(
          {
            code: 'push_test_delivery_unavailable',
            error: 'The push service could not accept this delivery attempt right now.',
            detail: result.errorMessage ?? null,
            endpointHost: result.endpointHost ?? null,
            failureReason: result.failureReason,
            likelyCause: getPushTestLikelyCause({
              failureReason: result.failureReason,
              ...requestContext,
            }),
            nodeCode: result.nodeCode ?? null,
            providerBody: result.providerBody ?? null,
            providerStatusCode: result.errorStatusCode ?? null,
            subscriptionCreatedAt: result.subscriptionCreatedAt ?? null,
            subscriptionUpdatedAt: result.subscriptionUpdatedAt ?? null,
            ...requestContext,
          },
          { status: 503 },
        );
      }

      return NextResponse.json(
        {
          code: 'push_test_send_failed',
          error: 'Push delivery failed after the device was connected.',
          detail: result.errorMessage ?? null,
          endpointHost: result.endpointHost ?? null,
          failureReason: result.failureReason ?? null,
          likelyCause: getPushTestLikelyCause({
            failureReason: result.failureReason,
            ...requestContext,
          }),
          nodeCode: result.nodeCode ?? null,
          providerBody: result.providerBody ?? null,
          requestHost: requestContext.requestHost,
          originHost: requestContext.originHost,
          refererHost: requestContext.refererHost,
          statusCode: result.errorStatusCode ?? null,
          subscriptionCreatedAt: result.subscriptionCreatedAt ?? null,
          subscriptionUpdatedAt: result.subscriptionUpdatedAt ?? null,
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
      logPushTestRouteFailure({
        code: 'push_subscription_schema_missing',
        ...requestContext,
        userId: user.id,
      });

      return NextResponse.json(
        {
          code: 'push_subscription_schema_missing',
          error: 'Push subscriptions are not ready on the server yet.',
          failureReason: 'push_subscription_schema_missing',
          ...requestContext,
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
