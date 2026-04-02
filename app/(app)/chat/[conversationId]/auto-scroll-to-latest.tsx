'use client';

import { useEffect, useRef } from 'react';

type AutoScrollToLatestProps = {
  targetId: string;
  latestVisibleMessageSeq: number | null;
};

export function AutoScrollToLatest({
  targetId,
  latestVisibleMessageSeq,
}: AutoScrollToLatestProps) {
  const hasInitializedRef = useRef(false);

  useEffect(() => {
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
  }, [latestVisibleMessageSeq, targetId]);

  return null;
}
