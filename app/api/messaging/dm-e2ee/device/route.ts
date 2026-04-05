import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type {
  DmE2eeBootstrap400ReasonCode,
  DmE2eeBootstrapDebugState,
  DmE2eeBootstrapFailedValidationBranch,
  PublishDmE2eeDeviceRequest,
} from '@/modules/messaging/contract/dm-e2ee';
import { isDmE2eeEnabledForUser } from '@/modules/messaging/e2ee/rollout';
import { publishCurrentUserDmE2eeDevice } from '@/modules/messaging/data/server';

function isMissingDmE2eeSchemaMessage(message: string) {
  const normalizedMessage = message.toLowerCase();

  return (
    normalizedMessage.includes('user_devices') ||
    normalizedMessage.includes('device_one_time_prekeys') ||
    normalizedMessage.includes('identity_key_public') ||
    normalizedMessage.includes('signed_prekey_public') ||
    normalizedMessage.includes('signed_prekey_signature') ||
    normalizedMessage.includes('retired_at')
  );
}

function logDmE2eeDeviceRouteDiagnostics(
  stage: string,
  details?: Record<string, unknown>,
) {
  if (process.env.CHAT_DEBUG_DM_E2EE_BOOTSTRAP !== '1') {
    return;
  }

  if (details) {
    console.info('[api-dm-e2ee-device]', stage, details);
    return;
  }

  console.info('[api-dm-e2ee-device]', stage);
}

function getMissingBootstrapFields(input: PublishDmE2eeDeviceRequest) {
  const missing: string[] = [];

  if (!Number.isInteger(input.deviceId)) {
    missing.push('deviceId');
  }

  if (!Number.isInteger(input.registrationId)) {
    missing.push('registrationId');
  }

  if (!input.identityKeyPublic?.trim()) {
    missing.push('identityKeyPublic');
  }

  if (!Number.isInteger(input.signedPrekeyId)) {
    missing.push('signedPrekeyId');
  }

  if (!input.signedPrekeyPublic?.trim()) {
    missing.push('signedPrekeyPublic');
  }

  if (!input.signedPrekeySignature?.trim()) {
    missing.push('signedPrekeySignature');
  }

  if (!Array.isArray(input.oneTimePrekeys)) {
    missing.push('oneTimePrekeys');
  } else {
    const invalidPrekeyIndex = input.oneTimePrekeys.findIndex(
      (prekey) =>
        !Number.isInteger(prekey?.prekeyId) ||
        !prekey.publicKey?.trim(),
    );

    if (invalidPrekeyIndex >= 0) {
      const invalidPrekey = input.oneTimePrekeys[invalidPrekeyIndex];

      if (!Number.isInteger(invalidPrekey?.prekeyId)) {
        missing.push(`oneTimePrekeys[${invalidPrekeyIndex}].prekeyId`);
      }

      if (!invalidPrekey?.publicKey?.trim()) {
        missing.push(`oneTimePrekeys[${invalidPrekeyIndex}].publicKey`);
      }
    }
  }

  return missing;
}

function classifyDmE2eeDevice400Reason(
  message: string,
): DmE2eeBootstrap400ReasonCode {
  if (
    message.includes('foreign key constraint') &&
    message.includes('user_devices_user_id_fkey')
  ) {
    return 'missing profile row';
  }

  if (message.includes('DM E2EE profile seed failed:')) {
    return 'profile seed failed';
  }

  return 'publish failed';
}

function extractDmE2eeFailurePoint(message: string) {
  const match = message.match(/^\[([^\]]+)\]\s+/);
  return match?.[1]?.trim() || null;
}

function stripDmE2eeFailurePoint(message: string) {
  return message.replace(/^\[[^\]]+\]\s+/, '');
}

function create400Diagnostics(input: {
  exact400ReasonCode: DmE2eeBootstrap400ReasonCode;
  failedValidationBranch: DmE2eeBootstrapFailedValidationBranch;
}) {
  return {
    exact400ReasonCode: input.exact400ReasonCode,
    failedValidationBranch: input.failedValidationBranch,
  };
}

function extractBootstrapDebugState(error: unknown): DmE2eeBootstrapDebugState {
  if (!(error instanceof Error)) {
    return {};
  }

  const details = error as Error & DmE2eeBootstrapDebugState;

  return {
    authRetireAttempted: details.authRetireAttempted ?? null,
    authRetireFailed: details.authRetireFailed ?? null,
    serviceRetireAvailable: details.serviceRetireAvailable ?? null,
    serviceRetireSkipReason: details.serviceRetireSkipReason ?? null,
    serviceRetireAttempted: details.serviceRetireAttempted ?? null,
    serviceRetireSucceeded: details.serviceRetireSucceeded ?? null,
    serviceRetireFailed: details.serviceRetireFailed ?? null,
    serviceRetireErrorMessage: details.serviceRetireErrorMessage ?? null,
    serviceRetireErrorCode: details.serviceRetireErrorCode ?? null,
    serviceRetireErrorStatus: details.serviceRetireErrorStatus ?? null,
    currentDeviceRowId: details.currentDeviceRowId ?? null,
    retireTargetIds: details.retireTargetIds ?? null,
  };
}

function getBootstrapAttemptBranch(
  request: Request,
  fallback: DmE2eeBootstrapFailedValidationBranch,
): DmE2eeBootstrapFailedValidationBranch {
  const attempt = request.headers
    .get('X-Chat-Dm-E2ee-Bootstrap-Attempt')
    ?.trim()
    .toLowerCase();

  if (attempt === 'repair-republish') {
    return 'failed republish';
  }

  return fallback;
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  if (
    !isDmE2eeEnabledForUser(user.id, user.email ?? null, {
      source: 'api-dm-e2ee-device',
    })
  ) {
    return NextResponse.json(
      {
        error: 'Encrypted direct messages are not enabled for this account yet.',
        code: 'dm_e2ee_rollout_disabled',
      },
      { status: 403 },
    );
  }

  const input = (await request.json()) as PublishDmE2eeDeviceRequest;
  const missingFields = getMissingBootstrapFields(input);

  if (missingFields.length > 0) {
    const diagnostics = create400Diagnostics({
      exact400ReasonCode: 'bad payload',
      failedValidationBranch: getBootstrapAttemptBranch(request, 'bad payload'),
    });
    logDmE2eeDeviceRouteDiagnostics('response:400:payload-invalid', {
      code: 'dm_e2ee_local_state_incomplete',
      ...diagnostics,
      missingFields,
    });
    return NextResponse.json(
      {
        error: 'Encrypted setup payload is incomplete for this device.',
        code: 'dm_e2ee_local_state_incomplete',
        ...diagnostics,
      },
      { status: 400 },
    );
  }

  try {
    logDmE2eeDeviceRouteDiagnostics('publish:start', {
      oneTimePrekeyCount: input.oneTimePrekeys.length,
    });
    const result = await publishCurrentUserDmE2eeDevice({
      userId: user.id,
      ...input,
    });

    logDmE2eeDeviceRouteDiagnostics('publish:ok');
    return NextResponse.json(result);
  } catch (error) {
    const rawMessage =
      error instanceof Error ? error.message : 'Unable to publish DM E2EE device.';
    const debugState = extractBootstrapDebugState(error);
    const exactFailurePoint = extractDmE2eeFailurePoint(rawMessage);
    const message = stripDmE2eeFailurePoint(rawMessage);
    const reason = classifyDmE2eeDevice400Reason(message);
    logDmE2eeDeviceRouteDiagnostics('publish:error', {
      exactFailurePoint,
      message,
      ...debugState,
      ...(reason === 'missing profile row' ||
      reason === 'profile seed failed' ||
      reason === 'publish failed'
        ? create400Diagnostics({
            exact400ReasonCode: reason,
            failedValidationBranch: reason,
          })
        : {}),
    });

    if (message.includes('DM E2EE bootstrap schema is missing')) {
      return NextResponse.json(
        {
          error: message,
          code: 'dm_e2ee_schema_missing',
        },
        { status: 409 },
      );
    }

    if (reason === 'missing profile row') {
      const diagnostics = create400Diagnostics({
        exact400ReasonCode: 'missing profile row',
        failedValidationBranch: getBootstrapAttemptBranch(
          request,
          'missing profile row',
        ),
      });
      logDmE2eeDeviceRouteDiagnostics('response:400:profile-row-missing', {
        code: 'dm_e2ee_local_state_incomplete',
        exactFailurePoint,
        ...debugState,
        ...diagnostics,
      });
      return NextResponse.json(
        {
          error:
            'Encrypted setup needs a profile identity row before device registration.',
          code: 'dm_e2ee_local_state_incomplete',
          exactFailurePoint,
          ...debugState,
          ...diagnostics,
        },
        { status: 400 },
      );
    }

    if (reason === 'profile seed failed') {
      const diagnostics = create400Diagnostics({
        exact400ReasonCode: 'profile seed failed',
        failedValidationBranch: getBootstrapAttemptBranch(
          request,
          'profile seed failed',
        ),
      });
      logDmE2eeDeviceRouteDiagnostics('response:400:profile-seed-failed', {
        code: 'dm_e2ee_local_state_incomplete',
        exactFailurePoint,
        ...debugState,
        ...diagnostics,
      });
      return NextResponse.json(
        {
          error: 'Encrypted setup could not prepare local profile identity state.',
          code: 'dm_e2ee_local_state_incomplete',
          exactFailurePoint,
          ...debugState,
          ...diagnostics,
        },
        { status: 400 },
      );
    }

    const diagnostics = create400Diagnostics({
      exact400ReasonCode: 'publish failed',
      failedValidationBranch: getBootstrapAttemptBranch(request, 'publish failed'),
    });
    logDmE2eeDeviceRouteDiagnostics('response:400:publish-failed', {
      code: 'dm_e2ee_local_state_incomplete',
      exactFailurePoint,
      ...debugState,
      ...diagnostics,
    });
    return NextResponse.json(
      {
        error: 'Unable to refresh encrypted setup on this device.',
        code: 'dm_e2ee_local_state_incomplete',
        exactFailurePoint,
        ...debugState,
        ...diagnostics,
      },
      { status: 400 },
    );
  }
}

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  if (
    !isDmE2eeEnabledForUser(user.id, user.email ?? null, {
      source: 'api-dm-e2ee-device:get',
    })
  ) {
    return NextResponse.json(
      {
        error: 'Encrypted direct messages are not enabled for this account yet.',
        code: 'dm_e2ee_rollout_disabled',
      },
      { status: 403 },
    );
  }

  const { data, error } = await supabase
    .from('user_devices')
    .select('id, device_id, retired_at')
    .eq('user_id', user.id)
    .is('retired_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    if (isMissingDmE2eeSchemaMessage(error.message)) {
      return NextResponse.json(
        {
          error: 'DM E2EE bootstrap schema is missing.',
          code: 'dm_e2ee_schema_missing',
        },
        { status: 409 },
      );
    }

    return NextResponse.json(
      {
        error: 'Unable to inspect encrypted device state right now.',
      },
      { status: 400 },
    );
  }

  const activeDeviceRowIds = ((data ?? []) as Array<{ id?: string | null }>)
    .map((row) => row.id?.trim() || null)
    .filter((value): value is string => Boolean(value));

  return NextResponse.json({
    activeDeviceRowIds,
    hasActiveDevice: activeDeviceRowIds.length > 0,
  });
}
