'use client';

import { useLayoutEffect, type MutableRefObject } from 'react';
import type { ConversationMessageRow } from './thread-history-types';
import { resolveThreadScrollTarget } from './thread-scroll';

export type PendingScrollRestore = {
  previousScrollHeight: number;
  previousScrollTop: number;
};

type UseThreadHistoryPrependScrollRestoreInput = {
  idleMs: number;
  maxMs: number;
  messages: ConversationMessageRow[];
  pendingRestoreRef: MutableRefObject<PendingScrollRestore | null>;
  targetId: string;
};

export function useThreadHistoryPrependScrollRestore({
  idleMs,
  maxMs,
  messages,
  pendingRestoreRef,
  targetId,
}: UseThreadHistoryPrependScrollRestoreInput) {
  useLayoutEffect(() => {
    const pendingRestore = pendingRestoreRef.current;

    if (!pendingRestore) {
      return;
    }

    const target = resolveThreadScrollTarget(targetId);

    if (!target) {
      pendingRestoreRef.current = null;
      return;
    }

    let frameId: number | null = null;
    let isDisposed = false;
    let lastMeasuredScrollHeight = -1;
    let lastHeightChangeAt = performance.now();
    const startedAt = lastHeightChangeAt;

    const applyPendingRestore = () => {
      const activeRestore = pendingRestoreRef.current;

      if (!activeRestore) {
        return false;
      }

      const nextScrollHeight = target.scrollHeight;

      if (nextScrollHeight !== lastMeasuredScrollHeight) {
        lastMeasuredScrollHeight = nextScrollHeight;
        lastHeightChangeAt = performance.now();
      }

      const scrollHeightDelta =
        nextScrollHeight - activeRestore.previousScrollHeight;
      const nextScrollTop = activeRestore.previousScrollTop + scrollHeightDelta;

      if (Math.abs(target.scrollTop - nextScrollTop) > 1) {
        target.scrollTop = nextScrollTop;
      }

      const now = performance.now();
      const isSettled =
        now - lastHeightChangeAt >= idleMs || now - startedAt >= maxMs;

      if (isSettled) {
        pendingRestoreRef.current = null;
      }

      return !isSettled;
    };

    const continueRestore = () => {
      if (isDisposed) {
        return;
      }

      const shouldContinue = applyPendingRestore();

      if (shouldContinue) {
        frameId = requestAnimationFrame(continueRestore);
      }
    };

    applyPendingRestore();
    frameId = requestAnimationFrame(continueRestore);

    return () => {
      isDisposed = true;

      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }
    };
  }, [idleMs, maxMs, messages, pendingRestoreRef, targetId]);
}
