'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

type ProgressiveHistoryLoaderProps = {
  conversationId: string;
  currentLimit: number;
  hasMoreOlder: boolean;
  idleLabel: string;
  loadingLabel: string;
  pageSize: number;
  targetId: string;
};

const LOAD_OLDER_THRESHOLD_PX = 180;

type PendingScrollRestore = {
  nextLimit: number;
  previousScrollHeight: number;
  previousScrollTop: number;
};

export function ProgressiveHistoryLoader({
  conversationId,
  currentLimit,
  hasMoreOlder,
  idleLabel,
  loadingLabel,
  pageSize,
  targetId,
}: ProgressiveHistoryLoaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const pendingRestoreRef = useRef<PendingScrollRestore | null>(null);

  useEffect(() => {
    const target =
      typeof document === 'undefined'
        ? null
        : document.getElementById(targetId);

    if (!target) {
      return;
    }

    const maybeLoadOlder = () => {
      if (
        !hasMoreOlder ||
        isLoadingOlder ||
        pendingRestoreRef.current ||
        target.scrollTop > LOAD_OLDER_THRESHOLD_PX
      ) {
        return;
      }

      const nextLimit = currentLimit + pageSize;
      pendingRestoreRef.current = {
        nextLimit,
        previousScrollHeight: target.scrollHeight,
        previousScrollTop: target.scrollTop,
      };
      setIsLoadingOlder(true);

      const nextParams = new URLSearchParams(searchParams.toString());
      nextParams.set('history', String(nextLimit));

      router.replace(`${pathname}?${nextParams.toString()}`, {
        scroll: false,
      });
    };

    target.addEventListener('scroll', maybeLoadOlder, { passive: true });

    return () => {
      target.removeEventListener('scroll', maybeLoadOlder);
    };
  }, [
    currentLimit,
    hasMoreOlder,
    isLoadingOlder,
    pageSize,
    pathname,
    router,
    searchParams,
    targetId,
  ]);

  useLayoutEffect(() => {
    const pendingRestore = pendingRestoreRef.current;

    if (!pendingRestore || currentLimit < pendingRestore.nextLimit) {
      return;
    }

    const target =
      typeof document === 'undefined'
        ? null
        : document.getElementById(targetId);

    if (!target) {
      pendingRestoreRef.current = null;
      requestAnimationFrame(() => {
        setIsLoadingOlder(false);
      });
      return;
    }

    const frameId = requestAnimationFrame(() => {
      const scrollHeightDelta =
        target.scrollHeight - pendingRestore.previousScrollHeight;
      target.scrollTop = pendingRestore.previousScrollTop + scrollHeightDelta;
      pendingRestoreRef.current = null;
      setIsLoadingOlder(false);
    });

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [currentLimit, targetId]);

  if (!hasMoreOlder && !isLoadingOlder) {
    return null;
  }

  return (
    <div
      aria-live="polite"
      className="message-history-loader"
      data-conversation-id={conversationId}
    >
      {isLoadingOlder ? (
        <span className="message-history-loader-label">
          {loadingLabel}
        </span>
      ) : (
        <span className="sr-only">{idleLabel}</span>
      )}
    </div>
  );
}
