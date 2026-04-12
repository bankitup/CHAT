'use client';

import dynamic from 'next/dynamic';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

const DmE2eeAuthenticatedBoundary = dynamic(
  () =>
    import('@/modules/messaging/e2ee/local-state-boundary').then(
      (module) => module.DmE2eeAuthenticatedBoundary,
    ),
  { ssr: false },
);

const ChatUnreadBadgeSync = dynamic(
  () =>
    import('@/modules/messaging/push/chat-unread-badge-sync').then(
      (module) => module.ChatUnreadBadgeSync,
    ),
  { ssr: false },
);

const PushSubscriptionPresenceSync = dynamic(
  () =>
    import('@/modules/messaging/push/presence-sync').then(
      (module) => module.PushSubscriptionPresenceSync,
    ),
  { ssr: false },
);

const WarmNavRouteObserver = dynamic(
  () =>
    import('@/modules/messaging/performance/warm-nav-client').then(
      (module) => module.WarmNavRouteObserver,
    ),
  { ssr: false },
);

const WARM_NAV_CLIENT_DIAGNOSTICS_ENABLED =
  process.env.NEXT_PUBLIC_CHAT_DEBUG_WARM_NAV === '1';

type MessengerSurfaceRuntimeEffectsProps = {
  dmE2eeEnabled?: boolean;
  includeDeferredPresenceSync?: boolean;
  includeDmBoundary?: boolean;
  includeImmediatePresenceSync?: boolean;
  includeUnreadBadgeSync?: boolean;
  includeWarmNavObserver?: boolean;
  userId?: string | null;
};

function useDeferredMessengerSurfaceEffectsReady() {
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

export function MessengerSurfaceRuntimeEffects({
  dmE2eeEnabled = false,
  includeDeferredPresenceSync = false,
  includeDmBoundary = false,
  includeImmediatePresenceSync = false,
  includeUnreadBadgeSync = false,
  includeWarmNavObserver = false,
  userId = null,
}: MessengerSurfaceRuntimeEffectsProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const deferredReady = useDeferredMessengerSurfaceEffectsReady();
  const syncKey = `${pathname}?${searchParams.toString()}`;
  const shouldMountDmBoundary = includeDmBoundary && dmE2eeEnabled && Boolean(userId);
  const shouldMountImmediatePresenceSync = includeImmediatePresenceSync;
  const shouldMountDeferredPresenceSync =
    deferredReady && includeDeferredPresenceSync;
  const shouldMountUnreadBadgeSync = deferredReady && includeUnreadBadgeSync;
  const shouldMountWarmNavObserver =
    deferredReady &&
    includeWarmNavObserver &&
    WARM_NAV_CLIENT_DIAGNOSTICS_ENABLED;

  return (
    <>
      {shouldMountDmBoundary ? (
        <DmE2eeAuthenticatedBoundary enabled={dmE2eeEnabled} userId={userId ?? ''} />
      ) : null}
      {shouldMountImmediatePresenceSync ? <PushSubscriptionPresenceSync /> : null}
      {shouldMountUnreadBadgeSync ? <ChatUnreadBadgeSync syncKey={syncKey} /> : null}
      {shouldMountDeferredPresenceSync ? <PushSubscriptionPresenceSync /> : null}
      {shouldMountWarmNavObserver ? <WarmNavRouteObserver /> : null}
    </>
  );
}
