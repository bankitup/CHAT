'use client';

import { useCallback, useRef } from 'react';
import {
  emitOptimisticThreadMessage,
  type OptimisticThreadMessagePayload,
} from '@/modules/messaging/realtime/optimistic-thread';

export type OutgoingMessageLifecycleState =
  | 'local_pending'
  | 'sending'
  | 'sent'
  | 'failed';

export type OutgoingQueueDisplayDraft = Pick<
  OptimisticThreadMessagePayload,
  | 'attachment'
  | 'attachmentLabel'
  | 'body'
  | 'clientId'
  | 'createdAt'
  | 'kind'
  | 'replyToMessageId'
  | 'voiceDurationMs'
>;

export type OutgoingQueueItem<TPayload> = {
  attachment: File | null;
  attachmentLabel: string | null;
  body: string;
  clientId: string;
  conversationId: string;
  createdAt: string;
  kind: 'text' | 'attachment' | 'voice';
  payload: TPayload;
  replyToMessageId: string | null;
  voiceDurationMs: number | null;
};

type UseConversationOutgoingQueueOptions<TPayload> = {
  conversationId: string;
  onItemFailed?: (input: {
    error: unknown;
    errorMessage: string;
    item: OutgoingQueueItem<TPayload>;
  }) => void;
  onItemSent?: (item: OutgoingQueueItem<TPayload>) => void;
  processItem: (item: OutgoingQueueItem<TPayload>) => Promise<void>;
  resolveErrorMessage: (error: unknown) => string;
};

type EnqueueOutgoingQueueItemInput<TPayload> = {
  attachmentLabel?: string | null;
  attachment?: File | null;
  body: string;
  clientId?: string | null;
  createdAt?: string | null;
  kind?: 'text' | 'attachment' | 'voice';
  payload: TPayload;
  replyToMessageId?: string | null;
  voiceDurationMs?: number | null;
};

function emitLifecycleUpdate(
  item: Pick<
    OptimisticThreadMessagePayload,
    | 'attachmentLabel'
    | 'attachment'
    | 'body'
    | 'clientId'
    | 'conversationId'
    | 'createdAt'
    | 'kind'
    | 'replyToMessageId'
    | 'voiceDurationMs'
  >,
  status: OutgoingMessageLifecycleState,
  errorMessage?: string | null,
) {
  emitOptimisticThreadMessage({
    ...item,
    errorMessage: errorMessage ?? null,
    status,
  });
}

export function useConversationOutgoingQueue<TPayload>({
  conversationId,
  onItemFailed,
  onItemSent,
  processItem,
  resolveErrorMessage,
}: UseConversationOutgoingQueueOptions<TPayload>) {
  const queueRef = useRef<OutgoingQueueItem<TPayload>[]>([]);
  const isProcessingRef = useRef(false);
  const processItemRef = useRef(processItem);
  const resolveErrorMessageRef = useRef(resolveErrorMessage);
  const onItemFailedRef = useRef(onItemFailed);
  const onItemSentRef = useRef(onItemSent);

  processItemRef.current = processItem;
  resolveErrorMessageRef.current = resolveErrorMessage;
  onItemFailedRef.current = onItemFailed;
  onItemSentRef.current = onItemSent;

  const processQueue = useCallback(async () => {
    if (isProcessingRef.current) {
      return;
    }

    isProcessingRef.current = true;

    try {
      while (queueRef.current.length > 0) {
        const nextItem = queueRef.current[0];

        if (!nextItem) {
          break;
        }

        emitLifecycleUpdate(nextItem, 'sending');

        try {
          await processItemRef.current(nextItem);
          emitLifecycleUpdate(nextItem, 'sent');
          onItemSentRef.current?.(nextItem);
        } catch (error) {
          const errorMessage = resolveErrorMessageRef.current(error);
          emitLifecycleUpdate(nextItem, 'failed', errorMessage);
          onItemFailedRef.current?.({
            error,
            errorMessage,
            item: nextItem,
          });
        } finally {
          queueRef.current = queueRef.current.filter(
            (item) => item.clientId !== nextItem.clientId,
          );
        }
      }
    } finally {
      isProcessingRef.current = false;

      if (queueRef.current.length > 0) {
        void processQueue();
      }
    }
  }, []);

  const enqueue = useCallback(
    (input: EnqueueOutgoingQueueItemInput<TPayload>) => {
      const queuedItem: OutgoingQueueItem<TPayload> = {
        attachment: input.attachment ?? null,
        attachmentLabel: input.attachmentLabel?.trim() || null,
        body: input.body,
        clientId: input.clientId?.trim() || crypto.randomUUID(),
        conversationId,
        createdAt: input.createdAt?.trim() || new Date().toISOString(),
        kind:
          input.kind ??
          (input.attachment ? 'attachment' : 'text'),
        payload: input.payload,
        replyToMessageId: input.replyToMessageId?.trim() || null,
        voiceDurationMs: input.voiceDurationMs ?? null,
      };

      queueRef.current = [...queueRef.current, queuedItem];
      emitLifecycleUpdate(queuedItem, 'local_pending');
      void processQueue();

      return queuedItem;
    },
    [conversationId, processQueue],
  );

  return {
    enqueue,
  };
}
