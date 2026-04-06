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
  const diagnosticsEnabled =
    typeof window !== 'undefined' &&
    (process.env.NEXT_PUBLIC_CHAT_DEBUG_DM_THREAD_CLIENT === '1' ||
      process.env.NEXT_PUBLIC_CHAT_DEBUG_DM_E2EE_BOOTSTRAP === '1');

  useEffect(() => {
    if (!diagnosticsEnabled) {
      return;
    }

    console.info('[chat-thread-runtime]', 'mark-read:mount', {
      acknowledgedReadMessageSeq,
      conversationId,
      currentReadMessageSeq,
      latestVisibleMessageSeq,
    });

    return () => {
      console.info('[chat-thread-runtime]', 'mark-read:dispose', {
        conversationId,
      });
    };
  }, [
    acknowledgedReadMessageSeq,
    conversationId,
    currentReadMessageSeq,
    diagnosticsEnabled,
    latestVisibleMessageSeq,
  ]);

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
    const markConversationRead = async () => {
      if (hasSubmittedRef.current) {
        return;
      }

      hasSubmittedRef.current = true;

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
    };

    if (typeof IntersectionObserver !== 'function') {
      if (diagnosticsEnabled) {
        console.info('[chat-thread-runtime]', 'mark-read:intersection-observer-unavailable', {
          conversationId,
          latestVisibleMessageSeq,
        });
      }

      const scrollRoot = root instanceof HTMLElement ? root : null;
      const maybeMarkReadFromScrollPosition = () => {
        if (!scrollRoot || hasSubmittedRef.current) {
          return;
        }

        const distanceFromBottom =
          scrollRoot.scrollHeight - scrollRoot.scrollTop - scrollRoot.clientHeight;

        if (distanceFromBottom <= 80) {
          void markConversationRead();
        }
      };

      maybeMarkReadFromScrollPosition();
      scrollRoot?.addEventListener('scroll', maybeMarkReadFromScrollPosition, {
        passive: true,
      });

      return () => {
        scrollRoot?.removeEventListener(
          'scroll',
          maybeMarkReadFromScrollPosition,
        );
      };
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];

        if (!entry?.isIntersecting || hasSubmittedRef.current) {
          return;
        }

        void markConversationRead();
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
  }, [
    acknowledgedReadMessageSeq,
    conversationId,
    diagnosticsEnabled,
    latestVisibleMessageSeq,
  ]);

  return (
    <div
      aria-hidden="true"
      className="message-read-sentinel"
      id={bottomSentinelId}
      ref={sentinelRef}
    />
  );
}
