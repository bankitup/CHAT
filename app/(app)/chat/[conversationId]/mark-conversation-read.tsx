'use client';

import { useEffect, useRef } from 'react';
import { markConversationReadAction } from './actions';

type MarkConversationReadProps = {
  conversationId: string;
  latestVisibleMessageSeq: number | null;
  currentReadMessageSeq: number | null;
};

export function MarkConversationRead({
  conversationId,
  latestVisibleMessageSeq,
  currentReadMessageSeq,
}: MarkConversationReadProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const hasSubmittedRef = useRef(false);

  useEffect(() => {
    hasSubmittedRef.current = false;
  }, [conversationId, latestVisibleMessageSeq, currentReadMessageSeq]);

  useEffect(() => {
    const sentinel = sentinelRef.current;

    if (!sentinel) {
      return;
    }

    if (
      latestVisibleMessageSeq === null ||
      !Number.isFinite(latestVisibleMessageSeq) ||
      (currentReadMessageSeq !== null &&
        currentReadMessageSeq >= latestVisibleMessageSeq)
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
        formRef.current?.requestSubmit();
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
  }, [conversationId, latestVisibleMessageSeq, currentReadMessageSeq]);

  return (
    <>
      <form action={markConversationReadAction} className="sr-only" ref={formRef}>
        <input name="conversationId" type="hidden" value={conversationId} />
        <input
          name="latestVisibleMessageSeq"
          type="hidden"
          value={latestVisibleMessageSeq ?? ''}
        />
      </form>
      <div aria-hidden="true" className="message-read-sentinel" ref={sentinelRef} />
    </>
  );
}
