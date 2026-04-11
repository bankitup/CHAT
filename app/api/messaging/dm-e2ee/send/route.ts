import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type {
  DmE2eeApiErrorResponse,
  DmE2eeEnvelopeInsert,
  DmE2eeSendDebugState,
  DmE2eeSendRequest,
} from '@/modules/messaging/contract/dm-e2ee';
import { isDmE2eeEnabledForUser } from '@/modules/messaging/e2ee/rollout';
import {
  isDmE2eeOperationError,
  sendEncryptedDmMessageWithAttachment,
  sendEncryptedDmTextMessage,
} from '@/modules/messaging/data/server';
import { resolveInboxAttachmentPreviewKind } from '@/modules/messaging/inbox/preview-kind';
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

function parseEnvelopeInserts(rawValue: string): DmE2eeEnvelopeInsert[] {
  if (!rawValue.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.flatMap((value) => {
      if (!value || typeof value !== 'object') {
        return [];
      }

      const envelope = value as Record<string, unknown>;
      const recipientDeviceRecordId =
        typeof envelope.recipientDeviceRecordId === 'string'
          ? envelope.recipientDeviceRecordId.trim()
          : '';
      const envelopeType =
        envelope.envelopeType === 'prekey_signal_message' ||
        envelope.envelopeType === 'signal_message'
          ? envelope.envelopeType
          : null;
      const ciphertext =
        typeof envelope.ciphertext === 'string' ? envelope.ciphertext.trim() : '';
      const usedOneTimePrekeyId =
        typeof envelope.usedOneTimePrekeyId === 'number' &&
        Number.isFinite(envelope.usedOneTimePrekeyId)
          ? envelope.usedOneTimePrekeyId
          : envelope.usedOneTimePrekeyId === null
            ? null
            : typeof envelope.usedOneTimePrekeyId === 'string' &&
                envelope.usedOneTimePrekeyId.trim()
              ? Number(envelope.usedOneTimePrekeyId)
              : null;

      if (
        !recipientDeviceRecordId ||
        !envelopeType ||
        !ciphertext ||
        (usedOneTimePrekeyId !== null && !Number.isFinite(usedOneTimePrekeyId))
      ) {
        return [];
      }

      return [
        {
          ciphertext,
          envelopeType,
          recipientDeviceRecordId,
          usedOneTimePrekeyId,
        } satisfies DmE2eeEnvelopeInsert,
      ];
    });
  } catch {
    return [];
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

  const contentType = request.headers.get('content-type') ?? '';
  const isMultipartRequest = contentType.includes('multipart/form-data');

  try {
    logDmE2eeSendRouteDiagnostics('send:start');
    if (isMultipartRequest) {
      const formData = await request.formData();
      const conversationId = String(formData.get('conversationId') ?? '').trim();
      const clientId = String(formData.get('clientId') ?? '').trim();
      const replyToMessageId =
        String(formData.get('replyToMessageId') ?? '').trim() || null;
      const senderDeviceRecordId = String(
        formData.get('senderDeviceRecordId') ?? '',
      ).trim();
      const attachmentEntry = formData.get('attachment');
      const attachment =
        attachmentEntry instanceof File && attachmentEntry.size > 0
          ? attachmentEntry
          : null;
      const envelopes = parseEnvelopeInserts(
        String(formData.get('envelopes') ?? ''),
      );

      if (
        !conversationId ||
        !clientId ||
        !senderDeviceRecordId ||
        !attachment ||
        envelopes.length === 0
      ) {
        return NextResponse.json(
          {
            code: 'dm_e2ee_local_state_incomplete',
            error:
              'Local encrypted payload was incomplete. Refresh encrypted setup and try again.',
          } satisfies DmE2eeApiErrorResponse,
          { status: 400 },
        );
      }

      const result = await sendEncryptedDmMessageWithAttachment({
        clientId,
        contentMode: 'dm_e2ee_v1',
        conversationId,
        envelopes,
        file: attachment,
        kind: 'attachment',
        replyToMessageId,
        senderDeviceRecordId,
        senderId: user.id,
      });

      try {
        await sendChatPushNotifications({
          attachmentPreviewKind: resolveInboxAttachmentPreviewKind(
            attachment.type,
            attachment.name,
          ),
          body: null,
          contentMode: 'dm_e2ee_v1',
          conversationId,
          messageId: result.messageId,
          messageKind: 'attachment',
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

      logDmE2eeSendRouteDiagnostics('send:ok', {
        transport: 'multipart-attachment',
      });
      return NextResponse.json(result);
    }

    const input = (await request.json()) as DmE2eeSendRequest;
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

    logDmE2eeSendRouteDiagnostics('send:ok', {
      transport: 'json-text',
    });
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
