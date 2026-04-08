import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type {
  DmE2eeApiErrorResponse,
  DmE2eeSendDebugState,
  DmE2eeSendRequest,
} from '@/modules/messaging/contract/dm-e2ee';
import { isDmE2eeEnabledForUser } from '@/modules/messaging/e2ee/rollout';
import {
  isDmE2eeOperationError,
  sendEncryptedDmTextMessage,
} from '@/modules/messaging/data/server';
import { sendChatPushNotifications } from '@/modules/messaging/push/server';

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

function extractSendDebugState(error: unknown): DmE2eeSendDebugState {
  if (!(error instanceof Error)) {
    return {};
  }

  const details = error as Error & DmE2eeSendDebugState;

  return {
    sendExactFailureStage: details.sendExactFailureStage ?? null,
    sendFailedOperation: details.sendFailedOperation ?? null,
    sendReasonCode: details.sendReasonCode ?? null,
    sendErrorMessage: details.sendErrorMessage ?? null,
    sendErrorCode: details.sendErrorCode ?? null,
    sendErrorDetails: details.sendErrorDetails ?? null,
    sendErrorHint: details.sendErrorHint ?? null,
    sendSelectedConversationId: details.sendSelectedConversationId ?? null,
    sendSenderUserId: details.sendSenderUserId ?? null,
    sendRecipientUserId: details.sendRecipientUserId ?? null,
    sendSelectedSenderDeviceRowId:
      details.sendSelectedSenderDeviceRowId ?? null,
    sendSelectedRecipientDeviceRowId:
      details.sendSelectedRecipientDeviceRowId ?? null,
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

    try {
      await sendChatPushNotifications({
        body: null,
        contentMode: 'dm_e2ee_v1',
        conversationId: input.conversationId,
        messageId: result.messageId,
        messageKind: 'text',
        senderId: user.id,
      });
    } catch (pushError) {
      logDmE2eeSendRouteDiagnostics('push:error', {
        message:
          pushError instanceof Error
            ? pushError.message
            : 'Unable to send encrypted DM push.',
      });
    }

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
    const sendDebugState = extractSendDebugState(error);

    logDmE2eeSendRouteDiagnostics('send:error', {
      message,
      code,
      ...sendDebugState,
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
        ...sendDebugState,
      } satisfies DmE2eeApiErrorResponse,
      { status: code === 'dm_e2ee_schema_missing' ? 409 : 400 },
    );
  }
}
