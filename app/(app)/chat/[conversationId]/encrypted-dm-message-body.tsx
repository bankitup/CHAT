'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { StoredDmE2eeEnvelope } from '@/modules/messaging/contract/dm-e2ee';
import { ensureDmE2eeDeviceRegistered } from '@/modules/messaging/e2ee/device-registration';
import { decryptStoredDmEnvelope } from '@/modules/messaging/e2ee/prekey-encrypt';
import { getLocalDmE2eeDeviceRecordByServerDeviceId } from '@/modules/messaging/e2ee/device-store';
import { writeLocalEncryptedDmPreview } from '@/modules/messaging/e2ee/preview-cache';

type EncryptedDmFailureKind = 'device-setup' | 'unavailable';

type EncryptedDmMessageBodyProps = {
  clientId: string;
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
  const [plaintext, setPlaintext] = useState<string | null>(null);
  const [isUnavailable, setIsUnavailable] = useState(false);
  const [failureKind, setFailureKind] = useState<EncryptedDmFailureKind>('unavailable');
  const [retryNonce, setRetryNonce] = useState(0);
  const [isRefreshingSetup, setIsRefreshingSetup] = useState(false);

  function classifyFailure(error: unknown): EncryptedDmFailureKind {
    if (!(error instanceof Error)) {
      return 'unavailable';
    }

    if (
      error.message.includes('Local DM E2EE device record is missing') ||
      error.message.includes('one-time prekey is missing locally')
    ) {
      return 'device-setup';
    }

    return 'unavailable';
  }

  useEffect(() => {
    let cancelled = false;

    if (!envelope) {
      setPlaintext(null);
      setIsUnavailable(true);
      setFailureKind('unavailable');
      return;
    }

    void (async () => {
      try {
        const localRecord = await getLocalDmE2eeDeviceRecordByServerDeviceId(
          envelope.recipientDeviceRecordId,
        );

        if (!localRecord) {
          throw new Error('Local DM E2EE device record is missing.');
        }

        const nextPlaintext = await decryptStoredDmEnvelope({
          conversationId,
          clientId,
          localRecord,
          envelope,
        });

        if (!cancelled) {
          setPlaintext(nextPlaintext);
          setIsUnavailable(false);
          setFailureKind('unavailable');
        }

        if (shouldCachePreview) {
          writeLocalEncryptedDmPreview({
            conversationId,
            messageId,
            plaintext: nextPlaintext,
            updatedAt: messageCreatedAt,
          });
        }
      } catch (error) {
        if (!cancelled) {
          setPlaintext(null);
          setIsUnavailable(true);
          setFailureKind(classifyFailure(error));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    clientId,
    conversationId,
    envelope,
    messageCreatedAt,
    messageId,
    retryNonce,
    shouldCachePreview,
  ]);

  if (plaintext?.trim()) {
    return <p className="message-body">{plaintext.trim()}</p>;
  }

  if (isUnavailable) {
    return (
      <div className="message-encryption-state">
        <p className="message-body">
          {failureKind === 'device-setup'
            ? setupUnavailableLabel
            : unavailableLabel}
        </p>
        <div className="message-encryption-actions">
          <button
            className="button button-secondary button-compact message-encryption-action"
            onClick={() => setRetryNonce((value) => value + 1)}
            type="button"
          >
            {retryLabel}
          </button>
          {failureKind === 'device-setup' ? (
            <button
              className="button button-secondary button-compact message-encryption-action"
              disabled={isRefreshingSetup}
              onClick={async () => {
                setIsRefreshingSetup(true);
                try {
                  const bootstrap = await ensureDmE2eeDeviceRegistered(currentUserId, {
                    forcePublish: true,
                  });

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
            onClick={() => router.refresh()}
            type="button"
          >
            {reloadConversationLabel}
          </button>
        </div>
      </div>
    );
  }

  return <p className="message-body">{fallbackLabel}</p>;
}
