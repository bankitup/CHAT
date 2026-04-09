'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useRef } from 'react';
import { syncCurrentPushSubscriptionPresence } from '@/modules/messaging/sdk/notifications';

const PUSH_PRESENCE_HEARTBEAT_MS = 25_000;
const PUSH_PRESENCE_MIN_RESEND_MS = 10_000;

function getActiveConversationIdFromPathname(pathname: string) {
  const match = pathname.match(/^\/chat\/([^/]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export function PushSubscriptionPresenceSync() {
  const pathname = usePathname();
  const activeConversationId = useMemo(
    () => getActiveConversationIdFromPathname(pathname),
    [pathname],
  );
  const lastSyncedRef = useRef<{
    activeConversationId: string | null;
    activeInApp: boolean;
    syncedAt: number;
  } | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    let cancelled = false;

    const syncPresence = async (options?: { force?: boolean }) => {
      const activeInApp = document.visibilityState === 'visible';
      const nextState = {
        activeConversationId: activeInApp ? activeConversationId : null,
        activeInApp,
      };
      const now = Date.now();
      const previousState = lastSyncedRef.current;

      if (
        !options?.force &&
        previousState &&
        previousState.activeInApp === nextState.activeInApp &&
        previousState.activeConversationId === nextState.activeConversationId &&
        now - previousState.syncedAt < PUSH_PRESENCE_MIN_RESEND_MS
      ) {
        return;
      }

      try {
        const result = await syncCurrentPushSubscriptionPresence(nextState);

        if (cancelled || !result.synced) {
          return;
        }

        lastSyncedRef.current = {
          ...nextState,
          syncedAt: now,
        };
      } catch {
        // Presence sync is additive and should stay silent when unavailable.
      }
    };

    const handleVisibilityChange = () => {
      void syncPresence({ force: true });
    };

    const handleFocus = () => {
      void syncPresence({ force: true });
    };

    const handlePageHide = () => {
      void syncCurrentPushSubscriptionPresence({
        activeConversationId: null,
        activeInApp: false,
      });
      lastSyncedRef.current = {
        activeConversationId: null,
        activeInApp: false,
        syncedAt: Date.now(),
      };
    };

    void syncPresence({ force: true });

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void syncPresence({ force: true });
      }
    }, PUSH_PRESENCE_HEARTBEAT_MS);

    window.addEventListener('focus', handleFocus);
    window.addEventListener('pagehide', handlePageHide);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('pagehide', handlePageHide);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [activeConversationId]);

  return null;
}
