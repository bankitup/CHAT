'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';

type AutoScrollToLatestProps = {
  bottomSentinelId: string;
  conversationId: string;
  targetId: string;
  latestVisibleMessageSeq: number | null;
};

export function AutoScrollToLatest({
  bottomSentinelId,
  conversationId,
  targetId,
  latestVisibleMessageSeq,
}: AutoScrollToLatestProps) {
  const hasInitializedRef = useRef(false);
  const isNearBottomRef = useRef(true);
  const lastConversationIdRef = useRef(conversationId);
  const resizeFrameRef = useRef<number | null>(null);
  const diagnosticsEnabled =
    typeof window !== 'undefined' &&
    (process.env.NEXT_PUBLIC_CHAT_DEBUG_DM_THREAD_CLIENT === '1' ||
      process.env.NEXT_PUBLIC_CHAT_DEBUG_DM_E2EE_BOOTSTRAP === '1');

  useEffect(() => {
    if (!diagnosticsEnabled) {
      return;
    }

    console.info('[chat-thread-runtime]', 'auto-scroll:mount', {
      bottomSentinelId,
      conversationId,
      latestVisibleMessageSeq,
      targetId,
    });

    return () => {
      console.info('[chat-thread-runtime]', 'auto-scroll:dispose', {
        conversationId,
        targetId,
      });
    };
  }, [
    bottomSentinelId,
    conversationId,
    diagnosticsEnabled,
    latestVisibleMessageSeq,
    targetId,
  ]);

  useEffect(() => {
    const target =
      typeof document === 'undefined'
        ? null
        : document.getElementById(targetId);

    if (!target) {
      return;
    }

    const updateNearBottomState = () => {
      const distanceFromBottom =
        target.scrollHeight - target.scrollTop - target.clientHeight;
      isNearBottomRef.current = distanceFromBottom < 160;
    };

    updateNearBottomState();
    target.addEventListener('scroll', updateNearBottomState, { passive: true });

    return () => {
      target.removeEventListener('scroll', updateNearBottomState);
    };
  }, [conversationId, targetId]);

  useLayoutEffect(() => {
    if (lastConversationIdRef.current !== conversationId) {
      hasInitializedRef.current = false;
      isNearBottomRef.current = true;
      lastConversationIdRef.current = conversationId;
    }

    const target =
      typeof document === 'undefined'
        ? null
        : document.getElementById(targetId);
    const bottomSentinel =
      typeof document === 'undefined'
        ? null
        : document.getElementById(bottomSentinelId);

    if (!target || !bottomSentinel || latestVisibleMessageSeq === null) {
      return;
    }

    const snapToBottom = () => {
      bottomSentinel.scrollIntoView({
        block: 'end',
      });
      hasInitializedRef.current = true;
      isNearBottomRef.current = true;
    };

    const shouldSnapToBottom =
      !hasInitializedRef.current || isNearBottomRef.current;

    if (!shouldSnapToBottom) {
      return;
    }

    let firstFrameId: number | null = requestAnimationFrame(() => {
      firstFrameId = null;
      resizeFrameRef.current = requestAnimationFrame(() => {
        resizeFrameRef.current = null;
        snapToBottom();
      });
    });

    if (typeof ResizeObserver !== 'function') {
      if (diagnosticsEnabled) {
        console.info('[chat-thread-runtime]', 'auto-scroll:resize-observer-unavailable', {
          conversationId,
          latestVisibleMessageSeq,
          targetId,
        });
      }

      return () => {
        if (firstFrameId !== null) {
          cancelAnimationFrame(firstFrameId);
        }
        if (resizeFrameRef.current !== null) {
          cancelAnimationFrame(resizeFrameRef.current);
          resizeFrameRef.current = null;
        }
      };
    }

    const resizeObserver = new ResizeObserver(() => {
      if (resizeFrameRef.current !== null) {
        cancelAnimationFrame(resizeFrameRef.current);
      }

      resizeFrameRef.current = requestAnimationFrame(() => {
        resizeFrameRef.current = null;

        if (!hasInitializedRef.current || isNearBottomRef.current) {
          snapToBottom();
        }
      });
    });

    resizeObserver.observe(target);
    resizeObserver.observe(bottomSentinel);

    return () => {
      if (firstFrameId !== null) {
        cancelAnimationFrame(firstFrameId);
      }
      if (resizeFrameRef.current !== null) {
        cancelAnimationFrame(resizeFrameRef.current);
        resizeFrameRef.current = null;
      }
      resizeObserver.disconnect();
    };
  }, [
    bottomSentinelId,
    conversationId,
    diagnosticsEnabled,
    latestVisibleMessageSeq,
    targetId,
  ]);

  return null;
}
