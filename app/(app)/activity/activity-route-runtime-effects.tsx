'use client';

import dynamic from 'next/dynamic';
import {
  InboxRealtimeSync,
  type InboxRealtimeSyncProps,
} from '@/modules/messaging/realtime/inbox-sync';
import {
  WARM_NAV_CLIENT_DIAGNOSTICS_ENABLED,
  useDeferredMessengerRouteEffectsReady,
} from '../messenger-route-runtime-shared';
import { usePathname, useSearchParams } from 'next/navigation';

const ChatUnreadBadgeSync = dynamic(
  () =>
    import('@/modules/messaging/push/chat-unread-badge-sync').then(
      (module) => module.ChatUnreadBadgeSync,
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

type ActivityRouteRuntimeEffectsProps = InboxRealtimeSyncProps & {
  includeUnreadBadgeSync?: boolean;
  includeWarmNavObserver?: boolean;
};

export function ActivityRouteRuntimeEffects({
  conversationIds,
  includeUnreadBadgeSync = false,
  includeWarmNavObserver = false,
  initialSummaries,
  userId,
}: ActivityRouteRuntimeEffectsProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const deferredReady = useDeferredMessengerRouteEffectsReady();
  const syncKey = `${pathname}?${searchParams.toString()}`;
  const shouldMountUnreadBadgeSync =
    deferredReady && includeUnreadBadgeSync;
  const shouldMountWarmNavObserver =
    deferredReady &&
    includeWarmNavObserver &&
    WARM_NAV_CLIENT_DIAGNOSTICS_ENABLED;

  return (
    <>
      <InboxRealtimeSync
        conversationIds={conversationIds}
        initialSummaries={initialSummaries}
        userId={userId}
      />
      {shouldMountUnreadBadgeSync ? <ChatUnreadBadgeSync syncKey={syncKey} /> : null}
      {shouldMountWarmNavObserver ? <WarmNavRouteObserver /> : null}
    </>
  );
}
