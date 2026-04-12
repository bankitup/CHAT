import { loadMessengerInboxPageData } from '@/modules/messaging/server/inbox-page';
import { InboxFilterableContent } from './inbox-filterable-content';
import { InboxPageDeferredEffects } from './inbox-page-deferred-effects';
import {
  restoreConversationAction,
} from './actions';
import { InboxRouteRuntimeEffects } from './inbox-route-runtime-effects';

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
      <InboxRouteRuntimeEffects
        dmE2eeEnabled={data.dmE2eeEnabled}
        userId={data.userId}
      />

      <InboxPageDeferredEffects
        activeSpaceId={data.activeSpaceId}
        allConversationIds={data.allConversationIds}
        archivedConversationCount={data.archivedConversationItems.length}
        initialSummaries={[...data.mainSummaries, ...data.archivedSummaries]}
        mainConversationCount={data.mainConversationItems.length}
        userId={data.userId}
        warmNavRouteKey={data.warmNavRouteKey}
      />

      {data.visibleError ? <p className="notice notice-error">{data.visibleError}</p> : null}
      <InboxFilterableContent
        activeSpaceId={data.activeSpaceId}
        activeSpaceName={data.activeSpaceName}
        archivedConversationItems={data.archivedConversationItems}
        archivedSummaries={data.archivedSummaries}
        availableDmUserCount={data.availableDmUserCount}
        availableUserCount={data.availableUserCount}
        canManageMembers={data.canManageMembers}
        createOpen={data.isCreateOpen}
        createTargetsLoaded={false}
        currentUserId={data.userId}
        initialCreateDmUserEntries={data.initialCreateDmUserEntries}
        initialCreateMode={data.initialCreateMode}
        initialCreateUserEntries={data.initialCreateUserEntries}
        initialFilter={data.activeFilter}
        initialView={data.activeView}
        isMessengerSpace={data.isMessengerProductSpace}
        language={data.language}
        mainConversationItems={data.mainConversationItems}
        mainSummaries={data.mainSummaries}
        preferences={data.inboxPreferences}
        queryValue={query.q ?? ''}
        restoreAction={restoreConversationAction}
        searchScopedAvailableUserCount={data.searchScopedAvailableUserCount}
      />
    </section>
  );
}
