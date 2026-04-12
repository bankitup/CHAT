'use client';

import { useEffect, type MutableRefObject } from 'react';
import { persistCurrentDmE2eeDeviceCookie } from '@/modules/messaging/e2ee/current-device-cookie';
import { ensureDmE2eeDeviceRegistered } from '@/modules/messaging/e2ee/device-registration';
import { getLocalDmE2eeDeviceRecord } from '@/modules/messaging/e2ee/device-store';
import { emitThreadHistorySyncRequest } from '@/modules/messaging/realtime/thread-history-sync-events';

type UseThreadHistoryRecoveryInput = {
  attachmentReopenRecoveryReason: string;
  attachmentReopenRecoveryRequestedRef: MutableRefObject<Set<string>>;
  conversationId: string;
  conversationKind: 'dm' | 'group';
  currentDeviceResyncReason: string;
  currentUserId: string;
  historyContinuityRecoveryReason: string;
  historySyncDiagnosticsEnabled: boolean;
  historyFetchActiveDeviceIdRef: MutableRefObject<string | null>;
  recoverableEncryptedHistoryMessageIds: string[];
  recentAttachmentMessageIdsNeedingRecovery: string[];
  recentVoiceMessageIdsNeedingRecovery: string[];
  voiceReopenRecoveryReason: string;
  voiceReopenRecoveryRequestedRef: MutableRefObject<Set<string>>;
  encryptedHistoryBootstrapRecoveryAttemptedMessageIdsRef: MutableRefObject<Set<string>>;
  encryptedHistoryBootstrapRecoveryInFlightMessageIdsRef: MutableRefObject<Set<string>>;
};

export function useThreadHistoryRecovery({
  attachmentReopenRecoveryReason,
  attachmentReopenRecoveryRequestedRef,
  conversationId,
  conversationKind,
  currentDeviceResyncReason,
  currentUserId,
  historyContinuityRecoveryReason,
  historyFetchActiveDeviceIdRef,
  historySyncDiagnosticsEnabled,
  recoverableEncryptedHistoryMessageIds,
  recentAttachmentMessageIdsNeedingRecovery,
  recentVoiceMessageIdsNeedingRecovery,
  voiceReopenRecoveryReason,
  voiceReopenRecoveryRequestedRef,
  encryptedHistoryBootstrapRecoveryAttemptedMessageIdsRef,
  encryptedHistoryBootstrapRecoveryInFlightMessageIdsRef,
}: UseThreadHistoryRecoveryInput) {
  useEffect(() => {
    const requestedRecoveries = voiceReopenRecoveryRequestedRef.current;
    const activeRecoveryIds = new Set(recentVoiceMessageIdsNeedingRecovery);

    for (const messageId of Array.from(requestedRecoveries)) {
      if (!activeRecoveryIds.has(messageId)) {
        requestedRecoveries.delete(messageId);
      }
    }

    for (const messageId of recentVoiceMessageIdsNeedingRecovery) {
      if (requestedRecoveries.has(messageId)) {
        continue;
      }

      requestedRecoveries.add(messageId);

      if (historySyncDiagnosticsEnabled) {
        console.info('[chat-history]', 'voice-reopen-recovery:requested', {
          conversationId,
          messageId,
          reason: voiceReopenRecoveryReason,
        });
      }

      emitThreadHistorySyncRequest({
        conversationId,
        messageIds: [messageId],
        reason: voiceReopenRecoveryReason,
      });
    }
  }, [
    conversationId,
    historySyncDiagnosticsEnabled,
    recentVoiceMessageIdsNeedingRecovery,
    voiceReopenRecoveryReason,
    voiceReopenRecoveryRequestedRef,
  ]);

  useEffect(() => {
    const requestedRecoveries = attachmentReopenRecoveryRequestedRef.current;
    const activeRecoveryIds = new Set(recentAttachmentMessageIdsNeedingRecovery);

    for (const messageId of Array.from(requestedRecoveries)) {
      if (!activeRecoveryIds.has(messageId)) {
        requestedRecoveries.delete(messageId);
      }
    }

    for (const messageId of recentAttachmentMessageIdsNeedingRecovery) {
      if (requestedRecoveries.has(messageId)) {
        continue;
      }

      requestedRecoveries.add(messageId);

      if (historySyncDiagnosticsEnabled) {
        console.info('[chat-history]', 'attachment-reopen-recovery:requested', {
          conversationId,
          messageId,
          reason: attachmentReopenRecoveryReason,
        });
      }

      emitThreadHistorySyncRequest({
        conversationId,
        messageIds: [messageId],
        reason: attachmentReopenRecoveryReason,
      });
    }
  }, [
    attachmentReopenRecoveryReason,
    attachmentReopenRecoveryRequestedRef,
    conversationId,
    historySyncDiagnosticsEnabled,
    recentAttachmentMessageIdsNeedingRecovery,
  ]);

  useEffect(() => {
    if (
      conversationKind !== 'dm' ||
      recoverableEncryptedHistoryMessageIds.length === 0
    ) {
      return;
    }

    const attemptedMessageIds =
      encryptedHistoryBootstrapRecoveryAttemptedMessageIdsRef.current;
    const inFlightMessageIds =
      encryptedHistoryBootstrapRecoveryInFlightMessageIdsRef.current;
    const nextMessageIds = recoverableEncryptedHistoryMessageIds.filter(
      (messageId) =>
        !attemptedMessageIds.has(messageId) && !inFlightMessageIds.has(messageId),
    );

    if (nextMessageIds.length === 0) {
      return;
    }

    nextMessageIds.forEach((messageId) => {
      inFlightMessageIds.add(messageId);
    });

    let cancelled = false;

    void (async () => {
      try {
        const localRecord = await getLocalDmE2eeDeviceRecord(currentUserId);
        const localServerDeviceRecordId =
          localRecord?.serverDeviceRecordId?.trim() || null;
        const selectedActiveDeviceRecordId =
          historyFetchActiveDeviceIdRef.current?.trim() || null;

        if (
          localServerDeviceRecordId &&
          localServerDeviceRecordId !== selectedActiveDeviceRecordId
        ) {
          historyFetchActiveDeviceIdRef.current = localServerDeviceRecordId;
          persistCurrentDmE2eeDeviceCookie(localServerDeviceRecordId);
          nextMessageIds.forEach((messageId) => {
            inFlightMessageIds.delete(messageId);
          });

          if (process.env.NEXT_PUBLIC_CHAT_DEBUG_DM_E2EE_BOOTSTRAP === '1') {
            console.info(
              '[chat-history]',
              'dm-e2ee-history-current-device-resync:dispatch',
              {
                conversationId,
                localServerDeviceRecordId,
                messageIds: nextMessageIds,
                selectedActiveDeviceRecordId,
              },
            );
          }

          emitThreadHistorySyncRequest({
            conversationId,
            messageIds: nextMessageIds,
            reason: currentDeviceResyncReason,
          });
          return;
        }
      } catch (error) {
        if (process.env.NEXT_PUBLIC_CHAT_DEBUG_DM_E2EE_BOOTSTRAP === '1') {
          console.info(
            '[chat-history]',
            'dm-e2ee-history-current-device-resync:local-record-lookup-failed',
            {
              conversationId,
              errorMessage: error instanceof Error ? error.message : String(error),
              messageIds: nextMessageIds,
            },
          );
        }
      }

      const bootstrap = await ensureDmE2eeDeviceRegistered(currentUserId, {
        forcePublish: false,
        triggerReason: 'bootstrap-component',
      });

      if (cancelled || bootstrap.status !== 'registered') {
        nextMessageIds.forEach((messageId) => {
          inFlightMessageIds.delete(messageId);
        });
        return;
      }

      const resolvedActiveDeviceId =
        bootstrap.result?.deviceRecordId?.trim() || null;

      if (resolvedActiveDeviceId) {
        historyFetchActiveDeviceIdRef.current = resolvedActiveDeviceId;
      }

      nextMessageIds.forEach((messageId) => {
        inFlightMessageIds.delete(messageId);
        attemptedMessageIds.add(messageId);
      });

      if (process.env.NEXT_PUBLIC_CHAT_DEBUG_DM_E2EE_BOOTSTRAP === '1') {
        console.info(
          '[chat-history]',
          'dm-e2ee-history-continuity-recovery:dispatch',
          {
            conversationId,
            messageIds: nextMessageIds,
            resultKind: bootstrap.result?.resultKind ?? null,
            serverDeviceRecordId: bootstrap.result?.deviceRecordId ?? null,
          },
        );
      }

      emitThreadHistorySyncRequest({
        conversationId,
        messageIds: nextMessageIds,
        reason: historyContinuityRecoveryReason,
      });
    })().catch((error) => {
      nextMessageIds.forEach((messageId) => {
        inFlightMessageIds.delete(messageId);
      });

      if (cancelled) {
        return;
      }

      console.error('[chat-history]', 'dm-e2ee-history-continuity-recovery-failed', {
        conversationId,
        errorMessage: error instanceof Error ? error.message : String(error),
        messageIds: nextMessageIds,
      });
    });

    return () => {
      cancelled = true;
    };
  }, [
    conversationId,
    conversationKind,
    currentDeviceResyncReason,
    currentUserId,
    encryptedHistoryBootstrapRecoveryAttemptedMessageIdsRef,
    encryptedHistoryBootstrapRecoveryInFlightMessageIdsRef,
    historyContinuityRecoveryReason,
    historyFetchActiveDeviceIdRef,
    recoverableEncryptedHistoryMessageIds,
  ]);
}
