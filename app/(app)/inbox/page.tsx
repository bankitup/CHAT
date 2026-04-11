import {
  WarmNavReadyProbe,
} from '@/modules/messaging/performance/warm-nav-client';
import { InboxRealtimeSync } from '@/modules/messaging/realtime/inbox-sync';
import { loadMessengerInboxPageData } from '@/modules/messaging/server/inbox-page';
import { InboxFilterableContent } from './inbox-filterable-content';
import {
  restoreConversationAction,
} from './actions';

type InboxPageProps = {
  searchParams: Promise<{
    create?: string;
    createMode?: string;
    error?: string;
    filter?: string;
    q?: string;
    space?: string;
    view?: string;
  }>;
};

export default async function InboxPage({ searchParams }: InboxPageProps) {
  const query = await searchParams;
  const data = await loadMessengerInboxPageData(query);

  if (!data) {
    return null;
  }

  return (
    <section className="stack inbox-screen inbox-screen-minimal">
      <InboxRealtimeSync
        conversationIds={data.allConversationIds}
        initialSummaries={[...data.mainSummaries, ...data.archivedSummaries]}
        userId={data.userId}
      />
      <WarmNavReadyProbe
        details={{
          archivedCount: data.archivedConversationItems.length,
          mainCount: data.mainConversationItems.length,
          spaceId: data.activeSpaceId,
        }}
        routeKey={data.warmNavRouteKey}
        routePath="/inbox"
        surface="inbox"
      />

      {data.visibleError ? <p className="notice notice-error">{data.visibleError}</p> : null}
      <InboxFilterableContent
        activeSpaceId={data.activeSpaceId}
        activeSpaceName={data.activeSpaceName}
        archivedConversationItems={data.archivedConversationItems}
        archivedSummaries={data.archivedSummaries}
        availableDmUserEntries={data.availableDmUserEntries}
        availableUserEntries={data.availableUserEntries}
        canManageMembers={data.canManageMembers}
        createOpen={data.isCreateOpen}
        createTargetsLoaded={false}
        currentUserId={data.userId}
        initialCreateMode={data.initialCreateMode}
        initialFilter={data.activeFilter}
        initialView={data.activeView}
        isMessengerSpace={data.isMessengerProductSpace}
        language={data.language}
        mainConversationItems={data.mainConversationItems}
        mainSummaries={data.mainSummaries}
        preferences={data.inboxPreferences}
        queryValue={query.q ?? ''}
        restoreAction={restoreConversationAction}
      />
    </section>
  );
}
