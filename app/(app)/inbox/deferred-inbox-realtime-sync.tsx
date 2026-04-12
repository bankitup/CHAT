'use client';

import { useEffect, useState } from 'react';
import {
  InboxRealtimeSync,
  type InboxRealtimeSyncProps,
} from '@/modules/messaging/realtime/inbox-sync';

export function DeferredInboxRealtimeSync(props: InboxRealtimeSyncProps) {
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
          timeout: 1200,
        });
        return;
      }

      timeoutId = window.setTimeout(markReady, 180);
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
  }, []);

  if (!isReady) {
    return null;
  }

  return <InboxRealtimeSync {...props} />;
}
