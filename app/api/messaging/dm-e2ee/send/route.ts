import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type {
  DmE2eeApiErrorResponse,
  DmE2eeSendRequest,
} from '@/modules/messaging/contract/dm-e2ee';
import { isDmE2eeEnabledForUser } from '@/modules/messaging/e2ee/rollout';
import {
  isDmE2eeOperationError,
  sendEncryptedDmTextMessage,
} from '@/modules/messaging/data/server';

function logDmE2eeSendRouteDiagnostics(
  stage: string,
  details?: Record<string, unknown>,
) {
  if (process.env.CHAT_DEBUG_DM_E2EE_SEND !== '1') {
    return;
  }

  if (details) {
    console.info('[api-dm-e2ee-send]', stage, details);
    return;
  }

  console.info('[api-dm-e2ee-send]', stage);
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
      source: 'api-dm-e2ee-send',
    })
  ) {
    return NextResponse.json(
      {
        error: 'Encrypted direct messages are not enabled for this account yet.',
        code: 'dm_e2ee_rollout_disabled',
      } satisfies DmE2eeApiErrorResponse,
      { status: 403 },
    );
  }

  const input = (await request.json()) as DmE2eeSendRequest;

  try {
    logDmE2eeSendRouteDiagnostics('send:start');
    const result = await sendEncryptedDmTextMessage({
      ...input,
      senderId: user.id,
    });

    logDmE2eeSendRouteDiagnostics('send:ok');
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to send encrypted DM.';
    const code = isDmE2eeOperationError(error)
      ? error.code
      : message.includes('schema is missing')
        ? 'dm_e2ee_schema_missing'
        : null;

    logDmE2eeSendRouteDiagnostics('send:error', {
      message,
      code,
    });

    return NextResponse.json(
      {
        error:
          code === 'dm_e2ee_schema_missing'
            ? message
            : code === 'dm_e2ee_sender_device_stale' ||
                code === 'dm_e2ee_local_state_incomplete' ||
                code === 'dm_e2ee_recipient_device_missing' ||
                code === 'dm_e2ee_recipient_unavailable' ||
                code === 'dm_e2ee_prekey_conflict'
              ? message
              : 'Unable to send encrypted message right now.',
        code,
      } satisfies DmE2eeApiErrorResponse,
      { status: code === 'dm_e2ee_schema_missing' ? 409 : 400 },
    );
  }
}
