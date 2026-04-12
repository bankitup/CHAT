'use client';

import { useEffect, useState } from 'react';

type UseDeferredInboxRuntimeReadyOptions = {
  fallbackDelayMs?: number;
  idleTimeoutMs?: number;
};

export function useDeferredInboxRuntimeReady(
  options?: UseDeferredInboxRuntimeReadyOptions,
) {
  const fallbackDelayMs = options?.fallbackDelayMs ?? 120;
  const idleTimeoutMs = options?.idleTimeoutMs ?? 1200;
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let frameId: number | null = null;
    let idleId: number | null = null;
    let timeoutId: number | null = null;
    const idleWindow = window as Window & {
      cancelIdleCallback?: (handle: number) => void;
      requestIdleCallback?: (
        callback: IdleRequestCallback,
        options?: IdleRequestOptions,
      ) => number;
    };

    const markReady = () => {
      if (!cancelled) {
        setIsReady(true);
      }
    };

    frameId = window.requestAnimationFrame(() => {
      if (typeof idleWindow.requestIdleCallback === 'function') {
        idleId = idleWindow.requestIdleCallback(markReady, {
          timeout: idleTimeoutMs,
        });
        return;
      }

      timeoutId = window.setTimeout(markReady, fallbackDelayMs);
    });

    return () => {
      cancelled = true;

      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }

      if (
        idleId !== null &&
        typeof idleWindow.cancelIdleCallback === 'function'
      ) {
        idleWindow.cancelIdleCallback(idleId);
      }

      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [fallbackDelayMs, idleTimeoutMs]);

  return isReady;
}
