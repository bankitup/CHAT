import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type {
  DmE2eeBootstrap400ReasonCode,
  DmE2eeBootstrapFailedValidationBranch,
  PublishDmE2eeDeviceRequest,
} from '@/modules/messaging/contract/dm-e2ee';
import { isDmE2eeEnabledForUser } from '@/modules/messaging/e2ee/rollout';
import { publishCurrentUserDmE2eeDevice } from '@/modules/messaging/data/server';

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

function create400Diagnostics(input: {
  exact400ReasonCode: DmE2eeBootstrap400ReasonCode;
  failedValidationBranch: DmE2eeBootstrapFailedValidationBranch;
}) {
  return {
    exact400ReasonCode: input.exact400ReasonCode,
    failedValidationBranch: input.failedValidationBranch,
  };
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
      failedValidationBranch: 'bad payload',
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
    const message =
      error instanceof Error ? error.message : 'Unable to publish DM E2EE device.';
    const reason = classifyDmE2eeDevice400Reason(message);
    logDmE2eeDeviceRouteDiagnostics('publish:error', {
      message,
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
        failedValidationBranch: 'missing profile row',
      });
      logDmE2eeDeviceRouteDiagnostics('response:400:profile-row-missing', {
        code: 'dm_e2ee_local_state_incomplete',
        ...diagnostics,
      });
      return NextResponse.json(
        {
          error:
            'Encrypted setup needs a profile identity row before device registration.',
          code: 'dm_e2ee_local_state_incomplete',
          ...diagnostics,
        },
        { status: 400 },
      );
    }

    if (reason === 'profile seed failed') {
      const diagnostics = create400Diagnostics({
        exact400ReasonCode: 'profile seed failed',
        failedValidationBranch: 'profile seed failed',
      });
      logDmE2eeDeviceRouteDiagnostics('response:400:profile-seed-failed', {
        code: 'dm_e2ee_local_state_incomplete',
        ...diagnostics,
      });
      return NextResponse.json(
        {
          error: 'Encrypted setup could not prepare local profile identity state.',
          code: 'dm_e2ee_local_state_incomplete',
          ...diagnostics,
        },
        { status: 400 },
      );
    }

    const diagnostics = create400Diagnostics({
      exact400ReasonCode: 'publish failed',
      failedValidationBranch: 'publish failed',
    });
    logDmE2eeDeviceRouteDiagnostics('response:400:publish-failed', {
      code: 'dm_e2ee_local_state_incomplete',
      ...diagnostics,
    });
    return NextResponse.json(
      {
        error: 'Unable to refresh encrypted setup on this device.',
        code: 'dm_e2ee_local_state_incomplete',
        ...diagnostics,
      },
      { status: 400 },
    );
  }
}
