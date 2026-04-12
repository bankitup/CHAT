'use client';

import { useEffect, useState } from 'react';

export const WARM_NAV_CLIENT_DIAGNOSTICS_ENABLED =
  process.env.NEXT_PUBLIC_CHAT_DEBUG_WARM_NAV === '1';

export function useDeferredMessengerRouteEffectsReady() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let animationFrameId: number | null = null;
    let idleCallbackId: number | null = null;
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

    animationFrameId = window.requestAnimationFrame(() => {
      if (typeof idleWindow.requestIdleCallback === 'function') {
        idleCallbackId = idleWindow.requestIdleCallback(markReady, {
          timeout: 1200,
        });
        return;
      }

      timeoutId = window.setTimeout(markReady, 120);
    });

    return () => {
      cancelled = true;

      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
      }

      if (
        idleCallbackId !== null &&
        typeof idleWindow.cancelIdleCallback === 'function'
      ) {
        idleWindow.cancelIdleCallback(idleCallbackId);
      }

      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, []);

  return isReady;
}
