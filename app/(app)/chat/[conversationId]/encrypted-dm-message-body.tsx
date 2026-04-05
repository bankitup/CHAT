'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import type { StoredDmE2eeEnvelope } from '@/modules/messaging/contract/dm-e2ee';
import { reinitializeLocalDmE2eeStateForUser } from '@/modules/messaging/e2ee/lifecycle';
import { decryptStoredDmEnvelope } from '@/modules/messaging/e2ee/prekey-encrypt';
import {
  getLocalDmE2eeDeviceRecord,
  getLocalDmE2eeDeviceRecordByServerDeviceId,
  type LocalDmE2eeDeviceRecord,
} from '@/modules/messaging/e2ee/device-store';
import { writeLocalEncryptedDmPreview } from '@/modules/messaging/e2ee/preview-cache';
import {
  classifyEncryptedDmFailure,
  classifyEncryptedDmFailureDiagnostic,
  getEncryptedDmFailureKindForDiagnostic,
  getEncryptedDmBodyRenderState,
  type EncryptedDmDiagnosticCode,
  type EncryptedDmFailureKind,
  type EncryptedDmServerHistoryHint,
} from '@/modules/messaging/e2ee/ui-policy';
import { setDmThreadVisibleMessageState } from './dm-thread-visible-message-store';

type EncryptedDmMessageBodyProps = {
  clientId: string | null;
  conversationId: string;
  currentUserId: string;
  envelope: StoredDmE2eeEnvelope | null;
  fallbackLabel: string;
  historyDiagnosticHint: EncryptedDmServerHistoryHint;
  messageSenderId: string | null;
  refreshSetupLabel: string;
  reloadConversationLabel: string;
  retryLabel: string;
  setupUnavailableLabel: string;
  unavailableLabel: string;
  messageId: string;
  messageCreatedAt: string | null;
  shouldCachePreview?: boolean;
};

function parseSafeDate(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function shouldClassifySelfHistoryGap(input: {
  currentUserId: string;
  localRecord: LocalDmE2eeDeviceRecord | null;
  messageCreatedAt: string | null;
  messageSenderId: string | null;
}) {
  if (input.messageSenderId !== input.currentUserId || !input.localRecord) {
    return false;
  }

  const messageCreatedAt = parseSafeDate(input.messageCreatedAt);
  const localDeviceCreatedAt = parseSafeDate(input.localRecord.createdAt);

  if (!messageCreatedAt || !localDeviceCreatedAt) {
    return false;
  }

  return localDeviceCreatedAt.getTime() > messageCreatedAt.getTime();
}

export function EncryptedDmMessageBody({
  clientId,
  conversationId,
  currentUserId,
  envelope,
  fallbackLabel,
  historyDiagnosticHint,
  messageSenderId,
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
  const [diagnosticCode, setDiagnosticCode] =
    useState<EncryptedDmDiagnosticCode>('temporary-loading');
  const [retryNonce, setRetryNonce] = useState(0);
  const [isRefreshingSetup, setIsRefreshingSetup] = useState(false);
  const previousFailureCodeRef =
    useRef<EncryptedDmDiagnosticCode | null>(null);
  const diagnosticsEnabled =
    typeof window !== 'undefined' &&
    process.env.NEXT_PUBLIC_CHAT_DEBUG_DM_E2EE_BOOTSTRAP === '1';

  const normalizeString = (value: unknown) =>
    typeof value === 'string' ? value.trim() : '';

  useEffect(() => {
    let cancelled = false;
    const previousFailureCode = previousFailureCodeRef.current;
    const normalizedClientId = normalizeString(clientId);

    if (previousFailureCode && diagnosticsEnabled) {
      console.info('[dm-e2ee-history-client]', 'decrypt:stale-failure-state', {
        conversationId,
        currentUserId,
        messageId,
        previousFailureCode,
        retryNonce,
      });
    }

    previousFailureCodeRef.current = null;
    setPlaintext(null);
    setIsUnavailable(false);
    setFailureKind('unavailable');
    setDiagnosticCode('temporary-loading');
    setDmThreadVisibleMessageState({
      conversationId,
      diagnosticCode: 'temporary-loading',
      messageId,
      plaintext: null,
    });

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
      setDiagnosticCode('malformed-envelope');
      previousFailureCodeRef.current = 'malformed-envelope';
      setDmThreadVisibleMessageState({
        conversationId,
        diagnosticCode: 'malformed-envelope',
        messageId,
        plaintext: null,
      });
      return;
    }

    void (async () => {
      const resolveUnavailable = (
        nextDiagnosticCode: EncryptedDmDiagnosticCode,
        details?: Record<string, unknown>,
      ) => {
        if (diagnosticsEnabled) {
          console.info('[dm-e2ee-history-client]', 'decrypt:resolved-unavailable', {
            conversationId,
            currentUserId,
            currentUserConversationJoinedAt:
              historyDiagnosticHint.viewerJoinedAt ?? null,
            diagnosticCode: nextDiagnosticCode,
            historyHintCode: historyDiagnosticHint.code,
            messageCreatedAt: historyDiagnosticHint.messageCreatedAt ?? null,
            messageId,
            messageSenderId,
            ...details,
          });
        }

        if (!cancelled) {
          setPlaintext(null);
          setIsUnavailable(true);
          setFailureKind(
            getEncryptedDmFailureKindForDiagnostic(nextDiagnosticCode),
          );
          setDiagnosticCode(nextDiagnosticCode);
          previousFailureCodeRef.current = nextDiagnosticCode;
        }

        setDmThreadVisibleMessageState({
          conversationId,
          diagnosticCode: nextDiagnosticCode,
          messageId,
          plaintext: null,
        });
      };

      let currentLocalRecord: LocalDmE2eeDeviceRecord | null = null;

      try {
        currentLocalRecord = await getLocalDmE2eeDeviceRecord(currentUserId);
      } catch (error) {
        resolveUnavailable('client-session-lookup-failed', {
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          lookupStage: 'current-local-device-record',
        });
        return;
      }

      if (!envelope) {
        let nextDiagnosticCode: EncryptedDmDiagnosticCode = 'missing-envelope';

        if (historyDiagnosticHint.code === 'policy-blocked-history') {
          nextDiagnosticCode = 'policy-blocked-history';
        } else if (!currentLocalRecord) {
          nextDiagnosticCode = 'local-device-record-missing';
        } else if (
          shouldClassifySelfHistoryGap({
            currentUserId,
            localRecord: currentLocalRecord,
            messageCreatedAt,
            messageSenderId,
          })
        ) {
          nextDiagnosticCode = 'same-user-new-device-history-gap';
        } else if (
          !historyDiagnosticHint.activeDeviceRecordId ||
          (currentLocalRecord.serverDeviceRecordId &&
            currentLocalRecord.serverDeviceRecordId !==
              historyDiagnosticHint.activeDeviceRecordId)
        ) {
          nextDiagnosticCode = 'device-retired-or-mismatched';
        }

        resolveUnavailable(nextDiagnosticCode, {
          activeDeviceRecordId: historyDiagnosticHint.activeDeviceRecordId,
          currentLocalDeviceCreatedAt: currentLocalRecord?.createdAt ?? null,
          currentLocalServerDeviceRecordId:
            currentLocalRecord?.serverDeviceRecordId ?? null,
          envelopePresent: false,
        });
        return;
      }

      const senderDeviceRecordId = normalizeString(envelope.senderDeviceRecordId);
      const recipientDeviceRecordId = normalizeString(
        envelope.recipientDeviceRecordId,
      );
      const ciphertext = normalizeString(envelope.ciphertext);

      if (!senderDeviceRecordId || !recipientDeviceRecordId || !ciphertext) {
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
        resolveUnavailable('malformed-envelope', {
          envelopePresent: true,
        });
        return;
      }

      try {
        const localRecord =
          currentLocalRecord?.serverDeviceRecordId === recipientDeviceRecordId
            ? currentLocalRecord
            : await getLocalDmE2eeDeviceRecordByServerDeviceId(
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
            currentLocalServerDeviceRecordId:
              currentLocalRecord?.serverDeviceRecordId ?? null,
            localRecordFound: Boolean(localRecord),
            localRecordUserId: localRecord?.userId ?? null,
            localRecordServerDeviceRecordId:
              localRecord?.serverDeviceRecordId ?? null,
          });
        }

        if (!localRecord) {
          resolveUnavailable(
            currentLocalRecord?.serverDeviceRecordId &&
              currentLocalRecord.serverDeviceRecordId !== recipientDeviceRecordId
              ? 'device-retired-or-mismatched'
              : 'local-device-record-missing',
            {
              envelopePresent: true,
              envelopeRecipientDeviceRecordId: recipientDeviceRecordId,
              currentLocalServerDeviceRecordId:
                currentLocalRecord?.serverDeviceRecordId ?? null,
            },
          );
          return;
        }

        if (diagnosticsEnabled) {
          console.info('[dm-e2ee-history-client]', 'decrypt:attempt', {
            conversationId,
            currentUserId,
            diagnosticHistoryHintCode: historyDiagnosticHint.code,
            messageId,
            messageSenderId,
            localRecordServerDeviceRecordId:
              localRecord.serverDeviceRecordId ?? null,
            recipientDeviceRecordId,
            senderDeviceRecordId,
          });
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
          setDiagnosticCode('temporary-loading');
        }

        setDmThreadVisibleMessageState({
          conversationId,
          diagnosticCode: null,
          messageId,
          plaintext: nextPlaintext,
        });

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
        let nextDiagnosticCode = classifyEncryptedDmFailureDiagnostic(error);

        if (
          nextDiagnosticCode === 'decrypt-failed' &&
          shouldClassifySelfHistoryGap({
            currentUserId,
            localRecord: currentLocalRecord,
            messageCreatedAt,
            messageSenderId,
          })
        ) {
          nextDiagnosticCode = 'same-user-new-device-history-gap';
        }

        if (diagnosticsEnabled) {
          console.info('[dm-e2ee-history-client]', 'decrypt:error', {
            currentUserId,
            conversationId,
            clientId: normalizedClientId,
            messageId,
            envelopeRecipientDeviceRecordId:
              recipientDeviceRecordId || null,
            diagnosticCode: nextDiagnosticCode,
            failureKind: classifyEncryptedDmFailure(error),
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
          });
        }
        resolveUnavailable(nextDiagnosticCode, {
          currentLocalDeviceCreatedAt: currentLocalRecord?.createdAt ?? null,
          currentLocalServerDeviceRecordId:
            currentLocalRecord?.serverDeviceRecordId ?? null,
          envelopePresent: true,
          envelopeRecipientDeviceRecordId: recipientDeviceRecordId,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        });
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
    historyDiagnosticHint.activeDeviceRecordId,
    historyDiagnosticHint.code,
    historyDiagnosticHint.messageCreatedAt,
    historyDiagnosticHint.viewerJoinedAt,
    messageCreatedAt,
    messageId,
    messageSenderId,
    retryNonce,
    shouldCachePreview,
    currentUserId,
  ]);

  const renderState = getEncryptedDmBodyRenderState({
    plaintext,
    isUnavailable,
    failureKind,
    diagnosticCode,
    fallbackLabel,
    setupUnavailableLabel,
    unavailableLabel,
  });

  if (renderState.kind === 'plaintext') {
    return <p className="message-body">{renderState.text}</p>;
  }

  if (renderState.kind === 'unavailable') {
    return (
      <div
        className="message-encryption-state"
        data-dm-e2ee-debug-bucket={
          diagnosticsEnabled ? renderState.debugBucket ?? undefined : undefined
        }
        data-dm-e2ee-diagnostic={
          diagnosticsEnabled ? renderState.diagnosticCode ?? undefined : undefined
        }
      >
        <p className="message-body">{renderState.text}</p>
        {diagnosticsEnabled && renderState.diagnosticCode ? (
          <p className="message-encryption-debug-label">
            {renderState.diagnosticCode}
          </p>
        ) : null}
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

  return (
    <div
      data-dm-e2ee-debug-bucket={
        diagnosticsEnabled ? renderState.debugBucket ?? undefined : undefined
      }
      data-dm-e2ee-diagnostic={
        diagnosticsEnabled ? renderState.diagnosticCode ?? undefined : undefined
      }
    >
      <p className="message-body">{renderState.text}</p>
      {diagnosticsEnabled && renderState.diagnosticCode ? (
        <p className="message-encryption-debug-label">
          {renderState.diagnosticCode}
        </p>
      ) : null}
    </div>
  );
}
