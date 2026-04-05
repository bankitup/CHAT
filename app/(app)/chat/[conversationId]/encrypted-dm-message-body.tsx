'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import type { StoredDmE2eeEnvelope } from '@/modules/messaging/contract/dm-e2ee';
import { reinitializeLocalDmE2eeStateForUser } from '@/modules/messaging/e2ee/lifecycle';
import { decryptStoredDmEnvelope } from '@/modules/messaging/e2ee/prekey-encrypt';
import { getLocalDmE2eeDeviceRecordByServerDeviceId } from '@/modules/messaging/e2ee/device-store';
import { writeLocalEncryptedDmPreview } from '@/modules/messaging/e2ee/preview-cache';
import {
  classifyEncryptedDmFailure,
  getEncryptedDmBodyRenderState,
  type EncryptedDmFailureKind,
} from '@/modules/messaging/e2ee/ui-policy';

type EncryptedDmMessageBodyProps = {
  clientId: string | null;
  conversationId: string;
  currentUserId: string;
  envelope: StoredDmE2eeEnvelope | null;
  fallbackLabel: string;
  refreshSetupLabel: string;
  reloadConversationLabel: string;
  retryLabel: string;
  setupUnavailableLabel: string;
  unavailableLabel: string;
  messageId: string;
  messageCreatedAt: string | null;
  shouldCachePreview?: boolean;
};

export function EncryptedDmMessageBody({
  clientId,
  conversationId,
  currentUserId,
  envelope,
  fallbackLabel,
  refreshSetupLabel,
  reloadConversationLabel,
  retryLabel,
  setupUnavailableLabel,
  unavailableLabel,
  messageId,
  messageCreatedAt,
  shouldCachePreview = false,
}: EncryptedDmMessageBodyProps) {
  const router = useRouter();
  const [, startRefreshTransition] = useTransition();
  const [plaintext, setPlaintext] = useState<string | null>(null);
  const [isUnavailable, setIsUnavailable] = useState(false);
  const [failureKind, setFailureKind] = useState<EncryptedDmFailureKind>('unavailable');
  const [retryNonce, setRetryNonce] = useState(0);
  const [isRefreshingSetup, setIsRefreshingSetup] = useState(false);
  const diagnosticsEnabled =
    typeof window !== 'undefined' &&
    process.env.NEXT_PUBLIC_CHAT_DEBUG_DM_E2EE_BOOTSTRAP === '1';

  const normalizeString = (value: unknown) =>
    typeof value === 'string' ? value.trim() : '';

  useEffect(() => {
    let cancelled = false;

    if (!envelope) {
      if (diagnosticsEnabled) {
        console.info('[dm-e2ee-history-client]', 'decrypt:no-envelope', {
          currentUserId,
          conversationId,
          clientId,
          messageId,
        });
      }
      setPlaintext(null);
      setIsUnavailable(true);
      setFailureKind('unavailable');
      return;
    }

    const normalizedClientId = normalizeString(clientId);

    if (!normalizedClientId) {
      if (diagnosticsEnabled) {
        console.info('[dm-e2ee-history-client]', 'decrypt:missing-client-id', {
          currentUserId,
          conversationId,
          clientIdType: typeof clientId,
          messageId,
        });
      }
      setPlaintext(null);
      setIsUnavailable(true);
      setFailureKind('unavailable');
      return;
    }

    const senderDeviceRecordId = normalizeString(envelope.senderDeviceRecordId);
    const recipientDeviceRecordId = normalizeString(
      envelope.recipientDeviceRecordId,
    );
    const ciphertext = normalizeString(envelope.ciphertext);

    if (
      !senderDeviceRecordId ||
      !recipientDeviceRecordId ||
      !ciphertext
    ) {
      if (diagnosticsEnabled) {
        console.info('[dm-e2ee-history-client]', 'decrypt:malformed-envelope', {
          currentUserId,
          conversationId,
          clientId: normalizedClientId,
          ciphertextType: typeof envelope.ciphertext,
          hasCiphertext: Boolean(ciphertext),
          messageId,
          recipientDeviceRecordId: recipientDeviceRecordId || null,
          recipientDeviceRecordIdType: typeof envelope.recipientDeviceRecordId,
          senderDeviceRecordId: senderDeviceRecordId || null,
          senderDeviceRecordIdType: typeof envelope.senderDeviceRecordId,
        });
      }
      setPlaintext(null);
      setIsUnavailable(true);
      setFailureKind('unavailable');
      return;
    }

    void (async () => {
      try {
        const localRecord = await getLocalDmE2eeDeviceRecordByServerDeviceId(
          recipientDeviceRecordId,
        );

        if (diagnosticsEnabled) {
          console.info('[dm-e2ee-history-client]', 'decrypt:local-record-lookup', {
            currentUserId,
            conversationId,
            clientId: normalizedClientId,
            messageId,
            envelopeRecipientDeviceRecordId: recipientDeviceRecordId,
            envelopeSenderDeviceRecordId: senderDeviceRecordId,
            localRecordFound: Boolean(localRecord),
            localRecordUserId: localRecord?.userId ?? null,
            localRecordServerDeviceRecordId:
              localRecord?.serverDeviceRecordId ?? null,
          });
        }

        if (!localRecord) {
          throw new Error('Local DM E2EE device record is missing.');
        }

        const nextPlaintext = await decryptStoredDmEnvelope({
          conversationId,
          clientId: normalizedClientId,
          localRecord,
          envelope: {
            ...envelope,
            ciphertext,
            recipientDeviceRecordId,
            senderDeviceRecordId,
          },
        });

        if (!cancelled) {
          setPlaintext(nextPlaintext);
          setIsUnavailable(false);
          setFailureKind('unavailable');
        }

        if (shouldCachePreview) {
          writeLocalEncryptedDmPreview({
            userId: currentUserId,
            conversationId,
            messageId,
            plaintext: nextPlaintext,
            updatedAt: messageCreatedAt,
          });
        }
      } catch (error) {
        if (diagnosticsEnabled) {
          console.info('[dm-e2ee-history-client]', 'decrypt:error', {
            currentUserId,
            conversationId,
            clientId: normalizedClientId,
            messageId,
            envelopeRecipientDeviceRecordId:
              recipientDeviceRecordId || null,
            failureKind: classifyEncryptedDmFailure(error),
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
          });
        }
        if (!cancelled) {
          setPlaintext(null);
          setIsUnavailable(true);
          setFailureKind(classifyEncryptedDmFailure(error));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    clientId,
    conversationId,
    diagnosticsEnabled,
    envelope,
    messageCreatedAt,
    messageId,
    retryNonce,
    shouldCachePreview,
    currentUserId,
  ]);

  const renderState = getEncryptedDmBodyRenderState({
    plaintext,
    isUnavailable,
    failureKind,
    fallbackLabel,
    setupUnavailableLabel,
    unavailableLabel,
  });

  if (renderState.kind === 'plaintext') {
    return <p className="message-body">{renderState.text}</p>;
  }

  if (renderState.kind === 'unavailable') {
    return (
      <div className="message-encryption-state">
        <p className="message-body">{renderState.text}</p>
        <div className="message-encryption-actions">
          <button
            className="button button-secondary button-compact message-encryption-action"
            onClick={() => setRetryNonce((value) => value + 1)}
            type="button"
          >
            {retryLabel}
          </button>
          {renderState.showRefreshSetup ? (
            <button
              className="button button-secondary button-compact message-encryption-action"
              disabled={isRefreshingSetup}
              onClick={async () => {
                setIsRefreshingSetup(true);
                try {
                  const bootstrap = await reinitializeLocalDmE2eeStateForUser(
                    currentUserId,
                  );

                  if (bootstrap.status === 'registered') {
                    setRetryNonce((value) => value + 1);
                  }
                } finally {
                  setIsRefreshingSetup(false);
                }
              }}
              type="button"
            >
              {refreshSetupLabel}
            </button>
          ) : null}
          <button
            className="button button-secondary button-compact message-encryption-action"
            onClick={() => {
              startRefreshTransition(() => {
                router.refresh();
              });
            }}
            type="button"
          >
            {reloadConversationLabel}
          </button>
        </div>
      </div>
    );
  }

  return <p className="message-body">{renderState.text}</p>;
}
