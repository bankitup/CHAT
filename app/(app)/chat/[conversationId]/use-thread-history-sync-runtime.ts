'use client';

import { useEffect, type MutableRefObject } from 'react';
import {
  emitThreadHistorySyncRequest,
  emitThreadHistoryVisibleMessageIds,
  LOCAL_THREAD_HISTORY_LIVE_MESSAGE_EVENT,
  LOCAL_THREAD_HISTORY_SYNC_REQUEST_EVENT,
  type ThreadHistoryLiveMessagePayload,
  type ThreadHistorySyncRequestPayload,
} from '@/modules/messaging/realtime/thread-history-sync-events';
import type {
  ThreadHistoryPageSnapshot,
  ThreadHistoryState,
} from './thread-history-types';

export type PendingByIdThreadHistorySyncRequest = {
  messageIds: string[];
  reason: string | null;
};

export type PendingAfterSeqThreadHistorySyncRequest = {
  reason: string | null;
};

type NormalizedThreadHistorySyncRequest = {
  messageIds: string[];
  newerThanLatest: boolean;
  reason: string | null;
};

type UseThreadHistorySyncRuntimeInput = {
  attachmentRecoveryAttemptsRef: MutableRefObject<Map<string, number>>;
  attachmentRecoveryTimeoutsRef: MutableRefObject<
    Map<string, ReturnType<typeof setTimeout>>
  >;
  conversationId: string;
  encryptedDmRecoveryAttemptsRef: MutableRefObject<Map<string, number>>;
  encryptedDmRecoveryTimeoutsRef: MutableRefObject<
    Map<string, ReturnType<typeof setTimeout>>
  >;
  getLatestLoadedSeq: () => number | null;
  historyMessageIds: string[];
  historyStateRef: MutableRefObject<ThreadHistoryState>;
  historySyncDiagnosticsEnabled: boolean;
  isSyncingRef: MutableRefObject<boolean>;
  mergeSyncRequest: (nextRequest: ThreadHistorySyncRequestPayload) => void;
  normalizeSyncRequest: (input: {
    messageIds?: string[] | null;
    newerThanLatest?: boolean | null;
    reason?: string | null;
  }) => NormalizedThreadHistorySyncRequest;
  onApplySyncSnapshot: (snapshot: ThreadHistoryPageSnapshot) => void;
  onLiveMessage: (payload: ThreadHistoryLiveMessagePayload) => void;
  pageSize: number;
  pendingAfterSeqSyncRequestRef: MutableRefObject<PendingAfterSeqThreadHistorySyncRequest | null>;
  pendingByIdSyncRequestRef: MutableRefObject<PendingByIdThreadHistorySyncRequest | null>;
  performSyncFetch: (input: {
    afterSeq?: number | null;
    allowLatest?: boolean;
    messageIds?: string[] | null;
    reason: string | null;
  }) => Promise<ThreadHistoryPageSnapshot | null>;
  scheduleAttachmentRecovery: (input: {
    reason: string | null;
    requestedMessageIds: string[];
    snapshot: ThreadHistoryPageSnapshot;
  }) => void;
  scheduleMissingEncryptedDmEnvelopeRecovery: (input: {
    reason: string | null;
    requestedMessageIds: string[];
    snapshot: ThreadHistoryPageSnapshot;
  }) => void;
  scheduleVoiceAttachmentRecovery: (input: {
    reason: string | null;
    requestedMessageIds: string[];
    snapshot: ThreadHistoryPageSnapshot;
  }) => void;
  shouldTrackPendingEncryptedCommitTransition: (reason: string | null) => boolean;
  syncTimeoutRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
  threadMountRecoveryReason: string;
  updatePendingEncryptedCommitTransitionMessageIds: (input: {
    add?: string[];
    remove?: string[];
  }) => void;
  voiceAttachmentRecoveryAttemptsRef: MutableRefObject<Map<string, number>>;
  voiceAttachmentRecoveryTimeoutsRef: MutableRefObject<
    Map<string, ReturnType<typeof setTimeout>>
  >;
};

export function useThreadHistorySyncRuntime({
  attachmentRecoveryAttemptsRef,
  attachmentRecoveryTimeoutsRef,
  conversationId,
  encryptedDmRecoveryAttemptsRef,
  encryptedDmRecoveryTimeoutsRef,
  getLatestLoadedSeq,
  historyMessageIds,
  historyStateRef,
  historySyncDiagnosticsEnabled,
  isSyncingRef,
  mergeSyncRequest,
  normalizeSyncRequest,
  onApplySyncSnapshot,
  onLiveMessage,
  pageSize,
  pendingAfterSeqSyncRequestRef,
  pendingByIdSyncRequestRef,
  performSyncFetch,
  scheduleAttachmentRecovery,
  scheduleMissingEncryptedDmEnvelopeRecovery,
  scheduleVoiceAttachmentRecovery,
  shouldTrackPendingEncryptedCommitTransition,
  syncTimeoutRef,
  threadMountRecoveryReason,
  updatePendingEncryptedCommitTransitionMessageIds,
  voiceAttachmentRecoveryAttemptsRef,
  voiceAttachmentRecoveryTimeoutsRef,
}: UseThreadHistorySyncRuntimeInput) {
  useEffect(() => {
    emitThreadHistoryVisibleMessageIds({
      conversationId,
      messageIds: historyMessageIds,
    });
  }, [conversationId, historyMessageIds]);

  useEffect(() => {
    const handleLiveMessage = (event: Event) => {
      const detail = (event as CustomEvent<ThreadHistoryLiveMessagePayload>).detail;

      if (!detail || detail.conversationId !== conversationId) {
        return;
      }

      onLiveMessage(detail);
    };

    window.addEventListener(
      LOCAL_THREAD_HISTORY_LIVE_MESSAGE_EVENT,
      handleLiveMessage as EventListener,
    );

    return () => {
      window.removeEventListener(
        LOCAL_THREAD_HISTORY_LIVE_MESSAGE_EVENT,
        handleLiveMessage as EventListener,
      );
    };
  }, [conversationId, onLiveMessage]);

  useEffect(() => {
    let isDisposed = false;
    const encryptedDmRecoveryAttempts = encryptedDmRecoveryAttemptsRef.current;
    const encryptedDmRecoveryTimeouts = encryptedDmRecoveryTimeoutsRef.current;
    const voiceAttachmentRecoveryAttempts =
      voiceAttachmentRecoveryAttemptsRef.current;
    const voiceAttachmentRecoveryTimeouts =
      voiceAttachmentRecoveryTimeoutsRef.current;
    const attachmentRecoveryAttempts = attachmentRecoveryAttemptsRef.current;
    const attachmentRecoveryTimeouts = attachmentRecoveryTimeoutsRef.current;

    const flushPendingSyncRequest = async () => {
      if (isDisposed || isSyncingRef.current) {
        return;
      }

      const pendingByIdRequest = pendingByIdSyncRequestRef.current;
      const pendingAfterSeqRequest = pendingAfterSeqSyncRequestRef.current;

      if (!pendingByIdRequest && !pendingAfterSeqRequest) {
        return;
      }

      const request = pendingByIdRequest
        ? {
            messageIds: pendingByIdRequest.messageIds,
            mode: 'by-id' as const,
            newerThanLatest: false,
            reason: pendingByIdRequest.reason,
          }
        : {
            messageIds: [] as string[],
            mode: 'after-seq' as const,
            newerThanLatest: true,
            reason: pendingAfterSeqRequest?.reason ?? null,
          };

      if (request.mode === 'by-id') {
        pendingByIdSyncRequestRef.current = null;
      } else {
        pendingAfterSeqSyncRequestRef.current = null;
      }

      isSyncingRef.current = true;

      try {
        if (historySyncDiagnosticsEnabled) {
          console.info('[chat-history]', 'topology-sync:flush', {
            afterSeqRequested: request.mode === 'after-seq',
            chosenMode: request.mode,
            conversationId,
            messageIds: request.messageIds,
            reason: request.reason,
          });
        }

        if (request.mode === 'by-id') {
          const snapshot = await performSyncFetch({
            messageIds: request.messageIds,
            reason: request.reason,
          });

          if (isDisposed || !snapshot) {
            return;
          }

          scheduleMissingEncryptedDmEnvelopeRecovery({
            reason: request.reason,
            requestedMessageIds: request.messageIds,
            snapshot,
          });
          scheduleVoiceAttachmentRecovery({
            reason: request.reason,
            requestedMessageIds: request.messageIds,
            snapshot,
          });
          scheduleAttachmentRecovery({
            reason: request.reason,
            requestedMessageIds: request.messageIds,
            snapshot,
          });

          onApplySyncSnapshot(snapshot);
        }

        if (request.mode === 'after-seq') {
          while (true) {
            const latestLoadedSeq = getLatestLoadedSeq();
            const snapshot = await performSyncFetch({
              allowLatest: latestLoadedSeq === null,
              afterSeq: latestLoadedSeq,
              reason: request.reason,
            });

            if (isDisposed || !snapshot) {
              return;
            }

            onApplySyncSnapshot(snapshot);

            if (latestLoadedSeq === null || snapshot.messages.length < pageSize) {
              break;
            }
          }
        }
      } catch (error) {
        console.error('[chat-history]', 'topology-sync-failed', {
          conversationId,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          messageIds: request.messageIds,
          newerThanLatest: request.newerThanLatest,
          preservedMessageCount: historyStateRef.current.messages.length,
          reason: request.reason,
        });

        if (!isDisposed && historySyncDiagnosticsEnabled) {
          console.info('[chat-history]', 'topology-sync:degraded-preserving-thread', {
            conversationId,
            preservedMessageCount: historyStateRef.current.messages.length,
            reason: request.reason,
          });
        }
      } finally {
        isSyncingRef.current = false;

        if (
          !isDisposed &&
          (pendingByIdSyncRequestRef.current || pendingAfterSeqSyncRequestRef.current)
        ) {
          syncTimeoutRef.current = setTimeout(() => {
            syncTimeoutRef.current = null;
            void flushPendingSyncRequest();
          }, 0);
        }
      }
    };

    const schedulePendingSyncRequest = () => {
      if (syncTimeoutRef.current) {
        return;
      }

      syncTimeoutRef.current = setTimeout(() => {
        syncTimeoutRef.current = null;
        void flushPendingSyncRequest();
      }, 70);
    };

    const handleSyncRequest = (event: Event) => {
      const detail = (event as CustomEvent<ThreadHistorySyncRequestPayload>).detail;

      if (!detail || detail.conversationId !== conversationId) {
        return;
      }

      const normalizedSyncRequest = normalizeSyncRequest(detail);

      if (
        shouldTrackPendingEncryptedCommitTransition(normalizedSyncRequest.reason) &&
        normalizedSyncRequest.messageIds.length > 0
      ) {
        updatePendingEncryptedCommitTransitionMessageIds({
          add: normalizedSyncRequest.messageIds,
        });
      }

      mergeSyncRequest(detail);
      schedulePendingSyncRequest();
    };

    window.addEventListener(
      LOCAL_THREAD_HISTORY_SYNC_REQUEST_EVENT,
      handleSyncRequest as EventListener,
    );

    return () => {
      isDisposed = true;

      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
        syncTimeoutRef.current = null;
      }

      for (const timeoutId of encryptedDmRecoveryTimeouts.values()) {
        clearTimeout(timeoutId);
      }
      for (const timeoutId of voiceAttachmentRecoveryTimeouts.values()) {
        clearTimeout(timeoutId);
      }
      for (const timeoutId of attachmentRecoveryTimeouts.values()) {
        clearTimeout(timeoutId);
      }

      pendingByIdSyncRequestRef.current = null;
      pendingAfterSeqSyncRequestRef.current = null;
      encryptedDmRecoveryAttempts.clear();
      encryptedDmRecoveryTimeouts.clear();
      voiceAttachmentRecoveryAttempts.clear();
      voiceAttachmentRecoveryTimeouts.clear();
      attachmentRecoveryAttempts.clear();
      attachmentRecoveryTimeouts.clear();

      window.removeEventListener(
        LOCAL_THREAD_HISTORY_SYNC_REQUEST_EVENT,
        handleSyncRequest as EventListener,
      );
    };
  }, [
    attachmentRecoveryAttemptsRef,
    attachmentRecoveryTimeoutsRef,
    conversationId,
    encryptedDmRecoveryAttemptsRef,
    encryptedDmRecoveryTimeoutsRef,
    getLatestLoadedSeq,
    historyStateRef,
    historySyncDiagnosticsEnabled,
    isSyncingRef,
    mergeSyncRequest,
    normalizeSyncRequest,
    onApplySyncSnapshot,
    pendingAfterSeqSyncRequestRef,
    pendingByIdSyncRequestRef,
    pageSize,
    performSyncFetch,
    scheduleAttachmentRecovery,
    scheduleMissingEncryptedDmEnvelopeRecovery,
    scheduleVoiceAttachmentRecovery,
    shouldTrackPendingEncryptedCommitTransition,
    syncTimeoutRef,
    updatePendingEncryptedCommitTransitionMessageIds,
    voiceAttachmentRecoveryAttemptsRef,
    voiceAttachmentRecoveryTimeoutsRef,
  ]);

  useEffect(() => {
    if (historySyncDiagnosticsEnabled) {
      console.info('[chat-history]', 'topology-sync:mount-recovery-requested', {
        conversationId,
        latestLoadedSeq: getLatestLoadedSeq(),
        reason: threadMountRecoveryReason,
      });
    }

    emitThreadHistorySyncRequest({
      conversationId,
      newerThanLatest: true,
      reason: threadMountRecoveryReason,
    });
  }, [
    conversationId,
    getLatestLoadedSeq,
    historySyncDiagnosticsEnabled,
    threadMountRecoveryReason,
  ]);
}
