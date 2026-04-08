'use client';

import { useEffect } from 'react';
import {
  applyUnreadAppBadge,
  supportsAppBadge,
} from '@/modules/messaging/sdk/badge';

type ChatUnreadBadgeResponse = {
  mutedExcluded: boolean;
  unreadCount: number;
};

async function fetchChatUnreadBadgeState(signal?: AbortSignal) {
  const response = await fetch('/api/messaging/unread-badge', {
    cache: 'no-store',
    credentials: 'same-origin',
    headers: {
      accept: 'application/json',
    },
    signal,
  });

  if (!response.ok) {
    throw new Error('Unable to load unread badge state.');
  }

  return (await response.json()) as ChatUnreadBadgeResponse;
}

export function ChatUnreadBadgeSync({
  syncKey,
}: {
  syncKey: string;
}) {
  useEffect(() => {
    if (!supportsAppBadge()) {
      return;
    }

    let cancelled = false;
    let controller: AbortController | null = null;

    const sync = () => {
      controller?.abort();
      controller = new AbortController();

      void fetchChatUnreadBadgeState(controller.signal)
        .then((state) => {
          if (cancelled) {
            return;
          }

          void applyUnreadAppBadge(state.unreadCount);
        })
        .catch((error) => {
          if (
            cancelled ||
            (error instanceof Error && error.name === 'AbortError')
          ) {
            return;
          }
        });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        sync();
      }
    };

    const handleFocus = () => {
      sync();
    };

    sync();

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        sync();
      }
    }, 60_000);

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      controller?.abort();
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [syncKey]);

  return null;
}
