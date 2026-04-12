'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type TouchEvent,
} from 'react';
import { requestInboxManualRefresh } from '@/modules/messaging/realtime/inbox-manual-refresh';

const INBOX_PULL_REFRESH_MAX_OFFSET = 92;
const INBOX_PULL_REFRESH_HOLD_OFFSET = 58;
const INBOX_PULL_REFRESH_THRESHOLD = 72;

type UseInboxPullRefreshInput = {
  enabled: boolean;
};

export function useInboxPullRefresh({ enabled }: UseInboxPullRefreshInput) {
  const [pullRefreshOffset, setPullRefreshOffset] = useState(0);
  const [isPullRefreshing, setIsPullRefreshing] = useState(false);
  const touchGestureRef = useRef<{
    dragging: boolean;
    pointerX: number;
    pointerY: number;
  } | null>(null);

  const getInboxScrollTop = useCallback(() => {
    if (typeof window === 'undefined') {
      return 0;
    }

    return Math.max(
      window.scrollY,
      document.scrollingElement?.scrollTop ?? 0,
      document.documentElement?.scrollTop ?? 0,
      0,
    );
  }, []);

  const resetPullRefreshGesture = useCallback(() => {
    touchGestureRef.current = null;
    setPullRefreshOffset(0);
  }, []);

  const handlePullRefreshStart = useCallback(
    (event: TouchEvent<HTMLDivElement>) => {
      if (
        !enabled ||
        isPullRefreshing ||
        event.touches.length !== 1 ||
        getInboxScrollTop() > 0
      ) {
        touchGestureRef.current = null;
        return;
      }

      const touch = event.touches[0];
      touchGestureRef.current = {
        dragging: false,
        pointerX: touch.clientX,
        pointerY: touch.clientY,
      };
    },
    [enabled, getInboxScrollTop, isPullRefreshing],
  );

  const handlePullRefreshMove = useCallback(
    (event: TouchEvent<HTMLDivElement>) => {
      const gesture = touchGestureRef.current;

      if (
        !enabled ||
        !gesture ||
        isPullRefreshing ||
        event.touches.length !== 1
      ) {
        return;
      }

      const touch = event.touches[0];
      const deltaX = touch.clientX - gesture.pointerX;
      const deltaY = touch.clientY - gesture.pointerY;

      if (deltaY <= 0) {
        if (!gesture.dragging) {
          touchGestureRef.current = null;
        }
        return;
      }

      if (Math.abs(deltaX) > deltaY * 0.8) {
        return;
      }

      if (getInboxScrollTop() > 0) {
        resetPullRefreshGesture();
        return;
      }

      const resistedOffset = Math.min(
        INBOX_PULL_REFRESH_MAX_OFFSET,
        Math.round(Math.pow(deltaY, 0.92) * 0.52),
      );

      gesture.dragging = true;
      event.preventDefault();
      setPullRefreshOffset(resistedOffset);
    },
    [enabled, getInboxScrollTop, isPullRefreshing, resetPullRefreshGesture],
  );

  const handlePullRefreshEnd = useCallback(async () => {
    const shouldRefresh =
      enabled &&
      touchGestureRef.current?.dragging &&
      pullRefreshOffset >= INBOX_PULL_REFRESH_THRESHOLD;

    touchGestureRef.current = null;

    if (!shouldRefresh || isPullRefreshing) {
      setPullRefreshOffset(0);
      return;
    }

    setIsPullRefreshing(true);
    setPullRefreshOffset(INBOX_PULL_REFRESH_HOLD_OFFSET);

    try {
      await requestInboxManualRefresh();
    } finally {
      setIsPullRefreshing(false);
      setPullRefreshOffset(0);
    }
  }, [enabled, isPullRefreshing, pullRefreshOffset]);

  useEffect(() => {
    if (!enabled) {
      touchGestureRef.current = null;
      setPullRefreshOffset(0);
    }
  }, [enabled]);

  return {
    handlePullRefreshEnd,
    handlePullRefreshMove,
    handlePullRefreshStart,
    isDragging: Boolean(touchGestureRef.current?.dragging),
    isPullRefreshing,
    pullRefreshOffset,
    pullRefreshThreshold: INBOX_PULL_REFRESH_THRESHOLD,
    resetPullRefreshGesture,
  };
}
