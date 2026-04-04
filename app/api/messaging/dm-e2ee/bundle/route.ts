import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type {
  DmE2eeApiErrorResponse,
  DmE2eeRecipientReadinessDebugState,
} from '@/modules/messaging/contract/dm-e2ee';
import { isDmE2eeEnabledForUser } from '@/modules/messaging/e2ee/rollout';
import {
  getCurrentUserDmE2eeRecipientBundle,
  isDmE2eeOperationError,
} from '@/modules/messaging/data/server';

function extractRecipientReadinessDebugState(
  error: unknown,
): DmE2eeRecipientReadinessDebugState {
  if (!(error instanceof Error)) {
    return {};
  }

  const details = error as Error & DmE2eeRecipientReadinessDebugState;

  return {
    recipientUserIdChecked: details.recipientUserIdChecked ?? null,
    recipientDeviceRowsFound: details.recipientDeviceRowsFound ?? null,
    recipientActiveDeviceRowsFound:
      details.recipientActiveDeviceRowsFound ?? null,
    recipientSelectedDeviceRowId: details.recipientSelectedDeviceRowId ?? null,
    recipientSelectedDeviceRetiredAt:
      details.recipientSelectedDeviceRetiredAt ?? null,
    recipientSelectedDeviceIdentityKeyPresent:
      details.recipientSelectedDeviceIdentityKeyPresent ?? null,
    recipientSelectedDeviceSignedPrekeyPresent:
      details.recipientSelectedDeviceSignedPrekeyPresent ?? null,
    recipientSelectedDeviceSignaturePresent:
      details.recipientSelectedDeviceSignaturePresent ?? null,
    recipientSelectedDeviceAvailablePrekeyCount:
      details.recipientSelectedDeviceAvailablePrekeyCount ?? null,
    recipientReadinessFailedReason:
      details.recipientReadinessFailedReason ?? null,
  };
}

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  if (
    !isDmE2eeEnabledForUser(user.id, user.email ?? null, {
      source: 'api-dm-e2ee-bundle',
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

  const { searchParams } = new URL(request.url);
  const conversationId = searchParams.get('conversationId')?.trim() ?? '';

  if (!conversationId) {
    return NextResponse.json(
      { error: 'Missing conversation id.' },
      { status: 400 },
    );
  }

  try {
    const bundle = await getCurrentUserDmE2eeRecipientBundle({
      conversationId,
      userId: user.id,
    });

    return NextResponse.json(bundle);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to load DM E2EE recipient bundle.';
    const code = isDmE2eeOperationError(error)
      ? error.code
      : message.includes('schema is missing')
        ? 'dm_e2ee_schema_missing'
        : null;
    const recipientDebugState = extractRecipientReadinessDebugState(error);

    return NextResponse.json(
      {
        error:
          code === 'dm_e2ee_schema_missing'
            ? message
            : code === 'dm_e2ee_recipient_device_missing' ||
                code === 'dm_e2ee_recipient_unavailable'
              ? message
              : 'Unable to prepare encrypted direct message setup.',
        code,
        ...recipientDebugState,
      } satisfies DmE2eeApiErrorResponse,
      { status: code === 'dm_e2ee_schema_missing' ? 409 : 400 },
    );
  }
}
