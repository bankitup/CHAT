'use client';

import dynamic from 'next/dynamic';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  WARM_NAV_CLIENT_DIAGNOSTICS_ENABLED,
  useDeferredMessengerRouteEffectsReady,
} from '../messenger-route-runtime-shared';

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

type InboxRouteRuntimeEffectsProps = {
  dmE2eeEnabled: boolean;
  userId: string | null;
};

export function InboxRouteRuntimeEffects({
  dmE2eeEnabled,
  userId,
}: InboxRouteRuntimeEffectsProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const deferredReady = useDeferredMessengerRouteEffectsReady();
  const syncKey = `${pathname}?${searchParams.toString()}`;
  const shouldMountDmBoundary = dmE2eeEnabled && Boolean(userId);
  const shouldMountPresenceSync = deferredReady;
  const shouldMountUnreadBadgeSync = deferredReady;
  const shouldMountWarmNavObserver =
    deferredReady && WARM_NAV_CLIENT_DIAGNOSTICS_ENABLED;

  return (
    <>
      {shouldMountDmBoundary ? (
        <DmE2eeAuthenticatedBoundary enabled={dmE2eeEnabled} userId={userId ?? ''} />
      ) : null}
      {shouldMountUnreadBadgeSync ? <ChatUnreadBadgeSync syncKey={syncKey} /> : null}
      {shouldMountPresenceSync ? <PushSubscriptionPresenceSync /> : null}
      {shouldMountWarmNavObserver ? <WarmNavRouteObserver /> : null}
    </>
  );
}
