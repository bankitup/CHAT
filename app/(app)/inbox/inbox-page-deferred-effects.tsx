'use client';

import dynamic from 'next/dynamic';
import type { InboxConversationLiveSummary } from '@/modules/messaging/realtime/inbox-summary-store';

const DeferredInboxRealtimeSync = dynamic(
  () =>
    import('./deferred-inbox-realtime-sync').then(
      (mod) => mod.DeferredInboxRealtimeSync,
    ),
  { ssr: false },
);

const DeferredWarmNavReadyProbe = dynamic(
  () =>
    import('@/modules/messaging/performance/warm-nav-client').then(
      (mod) => mod.WarmNavReadyProbe,
    ),
  { ssr: false },
);

type InboxPageDeferredEffectsProps = {
  activeSpaceId: string;
  allConversationIds: string[];
  archivedConversationCount: number;
  initialSummaries: InboxConversationLiveSummary[];
  mainConversationCount: number;
  userId: string;
  warmNavRouteKey: string;
};

export function InboxPageDeferredEffects({
  activeSpaceId,
  allConversationIds,
  archivedConversationCount,
  initialSummaries,
  mainConversationCount,
  userId,
  warmNavRouteKey,
}: InboxPageDeferredEffectsProps) {
  return (
    <>
      <DeferredInboxRealtimeSync
        conversationIds={allConversationIds}
        initialSummaries={initialSummaries}
        userId={userId}
      />
      <DeferredWarmNavReadyProbe
        details={{
          archivedCount: archivedConversationCount,
          mainCount: mainConversationCount,
          spaceId: activeSpaceId,
        }}
        routeKey={warmNavRouteKey}
        routePath="/inbox"
        surface="inbox"
      />
    </>
  );
}
