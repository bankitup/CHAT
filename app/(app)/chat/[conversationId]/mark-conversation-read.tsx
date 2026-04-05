'use client';

import { useEffect, useRef, useState } from 'react';
import { patchInboxConversationSummary } from '@/modules/messaging/realtime/inbox-summary-store';
import { patchThreadConversationReadState } from '@/modules/messaging/realtime/thread-live-state-store';
import { markConversationReadMutationAction } from './actions';

type MarkConversationReadProps = {
  bottomSentinelId?: string;
  conversationId: string;
  latestVisibleMessageSeq: number | null;
  currentReadMessageSeq: number | null;
};

export function MarkConversationRead({
  bottomSentinelId = 'message-thread-bottom-sentinel',
  conversationId,
  latestVisibleMessageSeq,
  currentReadMessageSeq,
}: MarkConversationReadProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const hasSubmittedRef = useRef(false);
  const [acknowledgedReadMessageSeq, setAcknowledgedReadMessageSeq] = useState<
    number | null
  >(currentReadMessageSeq);

  useEffect(() => {
    const sentinel = sentinelRef.current;

    if (!sentinel) {
      return;
    }

    if (
      latestVisibleMessageSeq === null ||
      !Number.isFinite(latestVisibleMessageSeq) ||
      (acknowledgedReadMessageSeq !== null &&
        acknowledgedReadMessageSeq >= latestVisibleMessageSeq)
    ) {
      return;
    }

    const root = sentinel.closest('.message-thread');
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];

        if (!entry?.isIntersecting || hasSubmittedRef.current) {
          return;
        }

        hasSubmittedRef.current = true;
        void (async () => {
          try {
            const result = await markConversationReadMutationAction({
              conversationId,
              latestVisibleMessageSeq,
            });

            if (!result.ok) {
              hasSubmittedRef.current = false;
              return;
            }

            setAcknowledgedReadMessageSeq(result.data.lastReadMessageSeq);
            patchThreadConversationReadState({
              conversationId,
              isCurrentUser: true,
              lastReadMessageSeq: result.data.lastReadMessageSeq,
            });

            if (result.data.summary) {
              patchInboxConversationSummary(result.data.summary);
            }
          } catch {
            hasSubmittedRef.current = false;
          }
        })();
      },
      {
        root: root instanceof Element ? root : null,
        threshold: 0.9,
      },
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [acknowledgedReadMessageSeq, conversationId, latestVisibleMessageSeq]);

  return (
    <div
      aria-hidden="true"
      className="message-read-sentinel"
      id={bottomSentinelId}
      ref={sentinelRef}
    />
  );
}
