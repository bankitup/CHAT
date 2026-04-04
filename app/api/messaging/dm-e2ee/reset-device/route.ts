import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { resetCurrentUserDmE2eeDeviceForDev } from '@/modules/messaging/data/server';

function isDmE2eeDevResetEnabled() {
  return (
    process.env.NODE_ENV !== 'production' ||
    process.env.CHAT_DEBUG_DM_E2EE_BOOTSTRAP === '1'
  );
}

function logDmE2eeDevResetRouteDiagnostics(
  stage: string,
  details?: Record<string, unknown>,
) {
  if (process.env.CHAT_DEBUG_DM_E2EE_BOOTSTRAP !== '1') {
    return;
  }

  if (details) {
    console.info('[api-dm-e2ee-reset-device]', stage, details);
    return;
  }

  console.info('[api-dm-e2ee-reset-device]', stage);
}

export async function POST() {
  if (!isDmE2eeDevResetEnabled()) {
    return NextResponse.json(
      {
        error: 'DM E2EE dev reset is disabled.',
      },
      { status: 403 },
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    logDmE2eeDevResetRouteDiagnostics('reset:start');
    const result = await resetCurrentUserDmE2eeDeviceForDev({
      userId: user.id,
    });
    logDmE2eeDevResetRouteDiagnostics('reset:done', result);
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to reset DM E2EE device.';
    logDmE2eeDevResetRouteDiagnostics('reset:error', {
      message,
    });
    return NextResponse.json(
      {
        error: 'Unable to reset encrypted setup on the server for this device.',
      },
      { status: 400 },
    );
  }
}
