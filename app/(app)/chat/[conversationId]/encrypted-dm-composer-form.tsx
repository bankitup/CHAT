'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { getTranslations, type AppLanguage } from '@/modules/i18n';
import type {
  DmE2eeApiErrorCode,
  DmE2eeApiErrorResponse,
  DmE2eeRecipientBundleResponse,
  DmE2eeSendRequest,
} from '@/modules/messaging/contract/dm-e2ee';
import {
  ensureDmE2eeDeviceRegistered,
  markLocalDmE2eeDeviceRegistrationStale,
} from '@/modules/messaging/e2ee/device-registration';
import { getLocalDmE2eeDeviceRecord } from '@/modules/messaging/e2ee/device-store';
import { reinitializeLocalDmE2eeStateForUser } from '@/modules/messaging/e2ee/lifecycle';
import { encryptDmTextForRecipient } from '@/modules/messaging/e2ee/prekey-encrypt';
import { getEncryptedDmComposerErrorMessage } from '@/modules/messaging/e2ee/ui-policy';
import { withSpaceParam } from '@/modules/spaces/url';
import { ComposerAttachmentPicker } from './composer-attachment-picker';
import { ComposerTypingTextarea } from './composer-typing-textarea';

type MentionParticipant = {
  userId: string;
  label: string;
};

type EncryptedDmComposerFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  accept: string;
  attachmentHelpText: string;
  attachmentMaxSizeBytes: number;
  attachmentMaxSizeLabel: string;
  conversationId: string;
  currentUserId: string;
  currentUserLabel: string;
  encryptedDmEnabled: boolean;
  language: AppLanguage;
  mentionParticipants?: MentionParticipant[];
  mentionSuggestionsLabel: string;
  messagePlaceholder: string;
  replyToMessageId?: string | null;
  spaceId?: string | null;
};

async function fetchRecipientBundle(conversationId: string) {
  const response = await fetch(
    `/api/messaging/dm-e2ee/bundle?conversationId=${encodeURIComponent(
      conversationId,
    )}`,
    {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    },
  );
  const payload = (await response.json()) as
    | DmE2eeRecipientBundleResponse
    | DmE2eeApiErrorResponse;

  if (!response.ok || !('recipient' in payload)) {
    const errorPayload = payload as DmE2eeApiErrorResponse;
    const error = new Error(
      errorPayload.error || 'Unable to load DM encryption material.',
    ) as Error & {
      code?: DmE2eeApiErrorCode | null;
    };
    error.code = errorPayload.code ?? null;
    throw error;
  }

  return payload;
}

async function postEncryptedDmMessage(input: DmE2eeSendRequest) {
  const response = await fetch('/api/messaging/dm-e2ee/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
  const payload = (await response.json()) as DmE2eeApiErrorResponse;

  if (!response.ok) {
    const error = new Error(
      payload.error || 'Unable to send encrypted message.',
    ) as Error & {
      code?: DmE2eeApiErrorCode | null;
    };
    error.code = payload.code ?? null;
    throw error;
  }
}

async function resolveLocalRecordForEncryptedDm(
  userId: string,
  forcePublish = false,
) {
  const bootstrap = await ensureDmE2eeDeviceRegistered(userId, {
    forcePublish,
  });

  if (bootstrap.status === 'unsupported') {
    throw new Error('dm_e2ee_unsupported_browser');
  }

  if (bootstrap.status === 'schema-missing') {
    const error = new Error('dm_e2ee_schema_missing') as Error & {
      code?: DmE2eeApiErrorCode | null;
    };
    error.code = 'dm_e2ee_schema_missing';
    throw error;
  }

  const localRecord = await getLocalDmE2eeDeviceRecord(userId);

  if (!localRecord?.serverDeviceRecordId) {
    const error = new Error('dm_e2ee_sender_device_stale') as Error & {
      code?: DmE2eeApiErrorCode | null;
    };
    error.code = 'dm_e2ee_sender_device_stale';
    throw error;
  }

  return localRecord;
}

function getEncryptedDmErrorMessage(
  error: unknown,
  t: ReturnType<typeof getTranslations>,
) {
  const code =
    error instanceof Error && 'code' in error
      ? ((error as { code?: DmE2eeApiErrorCode | null }).code ?? null)
      : null;

  if (error instanceof Error && error.message === 'dm_e2ee_unsupported_browser') {
    return t.chat.encryptionUnavailableHere;
  }

  return getEncryptedDmComposerErrorMessage({
    code,
    labels: {
      encryptionUnavailableHere: t.chat.encryptionUnavailableHere,
      encryptionSetupUnavailable: t.chat.encryptionSetupUnavailable,
      encryptionRolloutUnavailable: t.chat.encryptionRolloutUnavailable,
      encryptionNeedsRefresh: t.chat.encryptionNeedsRefresh,
      recipientEncryptionUnavailable: t.chat.recipientEncryptionUnavailable,
      encryptionSessionChanged: t.chat.encryptionSessionChanged,
      unableToSendEncryptedMessage: t.chat.unableToSendEncryptedMessage,
    },
  });
}

export function EncryptedDmComposerForm({
  action,
  accept,
  attachmentHelpText,
  attachmentMaxSizeBytes,
  attachmentMaxSizeLabel,
  conversationId,
  currentUserId,
  currentUserLabel,
  encryptedDmEnabled,
  language,
  mentionParticipants,
  mentionSuggestionsLabel,
  messagePlaceholder,
  replyToMessageId,
  spaceId,
}: EncryptedDmComposerFormProps) {
  const router = useRouter();
  const t = getTranslations(language);
  const formRef = useRef<HTMLFormElement | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<DmE2eeApiErrorCode | 'dm_e2ee_unsupported_browser' | null>(null);
  const [isSendingEncrypted, setIsSendingEncrypted] = useState(false);
  const [isRefreshingSetup, setIsRefreshingSetup] = useState(false);

  return (
    <form
      ref={formRef}
      action={action}
      className="stack composer-form"
      onSubmit={async (event) => {
        const form = event.currentTarget;
        const formData = new FormData(form);
        const body = String(formData.get('body') ?? '').trim();
        const attachmentEntry = formData.get('attachment');
        const attachment =
          attachmentEntry instanceof File && attachmentEntry.size > 0
            ? attachmentEntry
            : null;

        if (body && !encryptedDmEnabled) {
          event.preventDefault();
          setErrorMessage(t.chat.encryptionRolloutUnavailable);
          setErrorCode('dm_e2ee_rollout_disabled');
          return;
        }

        if (!body || attachment) {
          if (body && attachment) {
            event.preventDefault();
            setErrorMessage(t.chat.encryptedAttachmentsUnsupported);
            setErrorCode(null);
          } else {
            setErrorMessage(null);
            setErrorCode(null);
          }

          return;
        }

        event.preventDefault();
        setIsSendingEncrypted(true);
        setErrorMessage(null);
        setErrorCode(null);

        try {
          let retriedAfterRepublish = false;
          let retriedAfterBundleRefresh = false;

          while (true) {
            try {
              const localRecord = await resolveLocalRecordForEncryptedDm(
                currentUserId,
                retriedAfterRepublish,
              );
              const recipientBundle = await fetchRecipientBundle(conversationId);
              const clientId = crypto.randomUUID();
              const encryptedPayload = await encryptDmTextForRecipient({
                conversationId,
                clientId,
                plaintext: body,
                localRecord,
                recipientBundle,
              });

              await postEncryptedDmMessage({
                conversationId,
                clientId,
                replyToMessageId: replyToMessageId ?? null,
                senderDeviceRecordId: encryptedPayload.senderDeviceRecordId,
                kind: 'text',
                contentMode: 'dm_e2ee_v1',
                envelopes: encryptedPayload.envelopes,
              });
              break;
            } catch (error) {
              const code =
                error instanceof Error && 'code' in error
                  ? ((error as { code?: DmE2eeApiErrorCode | null }).code ?? null)
                  : null;

              if (code === 'dm_e2ee_sender_device_stale' && !retriedAfterRepublish) {
                retriedAfterRepublish = true;
                await markLocalDmE2eeDeviceRegistrationStale(currentUserId);
                continue;
              }

              if (code === 'dm_e2ee_prekey_conflict' && !retriedAfterBundleRefresh) {
                retriedAfterBundleRefresh = true;
                continue;
              }

              throw error;
            }
          }

          form.reset();
          router.replace(withSpaceParam(`/chat/${conversationId}`, spaceId));
          router.refresh();
        } catch (error) {
          const nextCode =
            error instanceof Error && 'code' in error
              ? ((error as { code?: DmE2eeApiErrorCode | null }).code ?? null)
              : error instanceof Error && error.message === 'dm_e2ee_unsupported_browser'
                ? 'dm_e2ee_unsupported_browser'
                : null;
          setErrorCode(nextCode);
          setErrorMessage(getEncryptedDmErrorMessage(error, t));
        } finally {
          setIsSendingEncrypted(false);
        }
      }}
    >
      <input name="conversationId" type="hidden" value={conversationId} />
      {replyToMessageId ? (
        <input name="replyToMessageId" type="hidden" value={replyToMessageId} />
      ) : null}
      <div className="composer-input-shell">
        <ComposerAttachmentPicker
          accept={accept}
          helperText={attachmentHelpText}
          maxSizeBytes={attachmentMaxSizeBytes}
          maxSizeLabel={attachmentMaxSizeLabel}
          language={language}
        />

        <label className="field composer-input-field">
          <span className="sr-only">{messagePlaceholder}</span>
          <ComposerTypingTextarea
            className="input textarea"
            conversationId={conversationId}
            currentUserId={currentUserId}
            currentUserLabel={currentUserLabel}
            mentionParticipants={mentionParticipants}
            mentionSuggestionsLabel={mentionSuggestionsLabel}
            name="body"
            placeholder={messagePlaceholder}
            rows={1}
            maxHeight={136}
          />
        </label>

        <div className="composer-action-cluster">
          <button
            aria-label={t.chat.microphone}
            className="button button-secondary composer-button composer-button-mic"
            disabled
            title={t.chat.voiceMessagesSoon}
            type="button"
          >
            <span aria-hidden="true" className="composer-mic-icon" />
          </button>

          <button
            aria-label={t.chat.sendMessage}
            className="button composer-button composer-button-icon"
            disabled={isSendingEncrypted}
            type="submit"
          >
            <span aria-hidden="true">➤</span>
          </button>
        </div>
      </div>

      {errorMessage ? (
        <div className="composer-encryption-status composer-encryption-status-error">
          <p className="attachment-helper attachment-helper-error">{errorMessage}</p>
          <div className="composer-encryption-actions">
            {errorCode === 'dm_e2ee_prekey_conflict' ? (
              <button
                className="button button-secondary button-compact composer-recovery-button"
                disabled={isSendingEncrypted}
                onClick={() => formRef.current?.requestSubmit()}
                type="button"
              >
                {t.chat.retryEncryptedAction}
              </button>
            ) : null}
            {(errorCode === 'dm_e2ee_sender_device_stale' ||
              errorCode === 'dm_e2ee_local_state_incomplete') ? (
              <button
                className="button button-secondary button-compact composer-recovery-button"
                disabled={isRefreshingSetup}
                onClick={async () => {
                  setIsRefreshingSetup(true);
                  try {
                    const bootstrap = await reinitializeLocalDmE2eeStateForUser(
                      currentUserId,
                    );

                    if (bootstrap.status === 'registered') {
                      setErrorMessage(null);
                      setErrorCode(null);
                    } else if (bootstrap.status === 'unsupported') {
                      setErrorMessage(t.chat.encryptionUnavailableHere);
                      setErrorCode('dm_e2ee_unsupported_browser');
                    } else {
                      setErrorMessage(t.chat.encryptionSetupUnavailable);
                      setErrorCode('dm_e2ee_schema_missing');
                    }
                  } catch {
                    setErrorMessage(t.chat.encryptionNeedsRefresh);
                    setErrorCode('dm_e2ee_local_state_incomplete');
                  } finally {
                    setIsRefreshingSetup(false);
                  }
                }}
                type="button"
              >
                {t.chat.refreshEncryptedSetup}
              </button>
            ) : null}
            <button
              className="button button-secondary button-compact composer-recovery-button"
              disabled={isSendingEncrypted || isRefreshingSetup}
              onClick={() => {
                setErrorMessage(null);
                setErrorCode(null);
                router.refresh();
              }}
              type="button"
            >
              {t.chat.reloadConversation}
            </button>
          </div>
        </div>
      ) : null}
    </form>
  );
}
