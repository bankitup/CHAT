'use client';

import { useLayoutEffect, useRef } from 'react';

type AutoScrollToLatestProps = {
  conversationId: string;
  targetId: string;
  latestVisibleMessageSeq: number | null;
};

export function AutoScrollToLatest({
  conversationId,
  targetId,
  latestVisibleMessageSeq,
}: AutoScrollToLatestProps) {
  const hasInitializedRef = useRef(false);
  const lastConversationIdRef = useRef(conversationId);

  useLayoutEffect(() => {
    if (lastConversationIdRef.current !== conversationId) {
      hasInitializedRef.current = false;
      lastConversationIdRef.current = conversationId;
    }

    const target =
      typeof document === 'undefined'
        ? null
        : document.getElementById(targetId);

    if (!target || latestVisibleMessageSeq === null) {
      return;
    }

    const distanceFromBottom =
      target.scrollHeight - target.scrollTop - target.clientHeight;
    const shouldSnapToBottom =
      !hasInitializedRef.current || distanceFromBottom < 160;

    if (!shouldSnapToBottom) {
      return;
    }

    const animationFrame = requestAnimationFrame(() => {
      target.scrollTop = target.scrollHeight;
      hasInitializedRef.current = true;
    });

    return () => {
      cancelAnimationFrame(animationFrame);
    };
  }, [conversationId, latestVisibleMessageSeq, targetId]);

  return null;
}
