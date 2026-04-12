import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const workspaceRoot = resolve(import.meta.dirname, '..', '..');

function readWorkspaceFile(relativePath: string) {
  return readFileSync(resolve(workspaceRoot, relativePath), 'utf8');
}

function readWorkspaceLineCount(relativePath: string) {
  return readWorkspaceFile(relativePath).split('\n').length;
}

test('shared shell stays free of direct Messenger runtime while route-local Messenger surfaces own the effect mounting', () => {
  const shellSource = readWorkspaceFile('app/(app)/app-shell-frame.tsx');
  const layoutSource = readWorkspaceFile('app/(app)/layout.tsx');
  const sharedRouteRuntimeSource = readWorkspaceFile(
    'app/(app)/messenger-route-runtime-shared.ts',
  );
  const inboxRouteRuntimeSource = readWorkspaceFile(
    'app/(app)/inbox/inbox-route-runtime-effects.tsx',
  );
  const threadRouteRuntimeSource = readWorkspaceFile(
    'app/(app)/chat/[conversationId]/thread-route-runtime-effects.tsx',
  );
  const activityRouteRuntimeSource = readWorkspaceFile(
    'app/(app)/activity/activity-route-runtime-effects.tsx',
  );
  const inboxPageSource = readWorkspaceFile('app/(app)/inbox/page.tsx');
  const threadPageContentSource = readWorkspaceFile(
    'app/(app)/chat/[conversationId]/thread-page-content.tsx',
  );
  const activityPageSource = readWorkspaceFile('app/(app)/activity/page.tsx');

  assert.doesNotMatch(
    shellSource,
    /DmE2eeAuthenticatedBoundary|ChatUnreadBadgeSync|PushSubscriptionPresenceSync|WarmNavRouteObserver|DeferredMessengerShellEffects|dmE2eeEnabled|userId:/,
  );
  assert.doesNotMatch(
    shellSource,
    /from ['"]@\/modules\/messaging\/e2ee\/local-state-boundary['"]|from ['"]@\/modules\/messaging\/push\/chat-unread-badge-sync['"]|from ['"]@\/modules\/messaging\/push\/presence-sync['"]|from ['"]@\/modules\/messaging\/performance\/warm-nav-client['"]/,
  );

  assert.doesNotMatch(
    layoutSource,
    /isDmE2eeEnabledForUser|dmE2eeEnabled=|userId=/,
  );

  assert.match(
    sharedRouteRuntimeSource,
    /export const WARM_NAV_CLIENT_DIAGNOSTICS_ENABLED =/,
  );
  assert.match(
    sharedRouteRuntimeSource,
    /export function useDeferredMessengerRouteEffectsReady\(/,
  );
  assert.match(
    sharedRouteRuntimeSource,
    /window\.requestAnimationFrame/,
  );
  assert.match(
    sharedRouteRuntimeSource,
    /requestIdleCallback/,
  );

  assert.match(
    inboxRouteRuntimeSource,
    /const DmE2eeAuthenticatedBoundary = dynamic\(/,
  );
  assert.match(
    inboxRouteRuntimeSource,
    /const ChatUnreadBadgeSync = dynamic\(/,
  );
  assert.match(
    inboxRouteRuntimeSource,
    /const PushSubscriptionPresenceSync = dynamic\(/,
  );
  assert.match(
    inboxRouteRuntimeSource,
    /const WarmNavRouteObserver = dynamic\(/,
  );
  assert.match(
    inboxRouteRuntimeSource,
    /const shouldMountPresenceSync = deferredReady;/,
  );
  assert.match(
    inboxRouteRuntimeSource,
    /const shouldMountWarmNavObserver =\s*deferredReady && WARM_NAV_CLIENT_DIAGNOSTICS_ENABLED;/,
  );
  assert.match(
    inboxRouteRuntimeSource,
    /<ChatUnreadBadgeSync syncKey=\{syncKey\} \/>/,
  );

  assert.match(
    threadRouteRuntimeSource,
    /const DmE2eeAuthenticatedBoundary = dynamic\(/,
  );
  assert.match(
    threadRouteRuntimeSource,
    /const PushSubscriptionPresenceSync = dynamic\(/,
  );
  assert.match(
    threadRouteRuntimeSource,
    /const shouldMountDmBoundary = dmE2eeEnabled && Boolean\(userId\);/,
  );
  assert.match(
    threadRouteRuntimeSource,
    /<PushSubscriptionPresenceSync \/>/,
  );
  assert.match(
    threadRouteRuntimeSource,
    /<ChatUnreadBadgeSync syncKey=\{syncKey\} \/>/,
  );

  assert.match(
    activityRouteRuntimeSource,
    /from ['"]@\/modules\/messaging\/realtime\/inbox-sync['"]/,
  );
  assert.match(
    activityRouteRuntimeSource,
    /const ChatUnreadBadgeSync = dynamic\(/,
  );
  assert.match(
    activityRouteRuntimeSource,
    /const WarmNavRouteObserver = dynamic\(/,
  );
  assert.match(
    activityRouteRuntimeSource,
    /<InboxRealtimeSync/,
  );
  assert.match(
    activityRouteRuntimeSource,
    /<ChatUnreadBadgeSync syncKey=\{syncKey\} \/>/,
  );

  assert.match(
    inboxPageSource,
    /from ['"]\.\/inbox-route-runtime-effects['"]/,
  );
  assert.match(
    inboxPageSource,
    /<InboxRouteRuntimeEffects[\s\S]*dmE2eeEnabled=\{data\.dmE2eeEnabled\}[\s\S]*userId=\{data\.userId\}/,
  );
  assert.match(
    threadPageContentSource,
    /from ['"]\.\/thread-route-runtime-effects['"]/,
  );
  assert.match(
    threadPageContentSource,
    /<ThreadRouteRuntimeEffects[\s\S]*dmE2eeEnabled=\{encryptedDmEnabled\}[\s\S]*userId=\{currentUserId\}/,
  );
  assert.match(
    activityPageSource,
    /from ['"]\.\/activity-route-runtime-effects['"]/,
  );
  assert.match(
    activityPageSource,
    /<ActivityRouteRuntimeEffects[\s\S]*conversationIds=\{conversationIds\}[\s\S]*initialSummaries=\{initialSummaries\}[\s\S]*userId=\{user\.id\}/,
  );
  assert.doesNotMatch(
    activityPageSource,
    /from ['"]@\/modules\/messaging\/realtime\/inbox-sync['"]|from ['"]\.\.\/messenger-surface-runtime-effects['"]/,
  );
});

test('chat route keeps heavy secondary interaction paths behind on-demand boundaries', () => {
  const threadPageContentSource = readWorkspaceFile(
    'app/(app)/chat/[conversationId]/thread-page-content.tsx',
  );
  const viewportSource = readWorkspaceFile(
    'app/(app)/chat/[conversationId]/thread-history-viewport.tsx',
  );
  const messageListSource = readWorkspaceFile(
    'app/(app)/chat/[conversationId]/thread-history-message-list.tsx',
  );
  const rowSource = readWorkspaceFile(
    'app/(app)/chat/[conversationId]/thread-message-row.tsx',
  );
  const rowContentSource = readWorkspaceFile(
    'app/(app)/chat/[conversationId]/thread-message-row-content.tsx',
  );
  const quickActionsSource = readWorkspaceFile(
    'app/(app)/chat/[conversationId]/thread-message-quick-actions.tsx',
  );
  const composerSource = readWorkspaceFile(
    'app/(app)/chat/[conversationId]/thread-composer-runtime.tsx',
  );
  const diagnosticsSource = readWorkspaceFile(
    'app/(app)/chat/[conversationId]/dm-thread-client-diagnostics.tsx',
  );

  assert.match(
    threadPageContentSource,
    /from ['"]\.\/thread-page-deferred-effects['"]/,
  );
  assert.match(threadPageContentSource, /<ThreadPageDeferredEffects/);
  assert.match(
    viewportSource,
    /from ['"]\.\/thread-history-message-list['"]/,
  );
  assert.match(
    viewportSource,
    /const ThreadImagePreviewOverlay = dynamic\(/,
  );
  assert.match(
    viewportSource,
    /from ['"]\.\/thread-viewport-deferred-effects['"]/,
  );
  assert.match(
    viewportSource,
    /from ['"]\.\/thread-viewport-deferred-effects['"]/,
  );
  assert.match(
    viewportSource,
    /<ThreadViewportDeferredEffects/,
  );
  assert.match(
    viewportSource,
    /<ThreadHistoryMessageList/,
  );
  assert.match(
    messageListSource,
    /from ['"]\.\/thread-history-render-list['"]/,
  );
  assert.match(
    messageListSource,
    /from ['"]\.\/thread-message-row['"]/,
  );
  assert.match(
    rowSource,
    /const ThreadMessageQuickActionsPanel = dynamic\(/,
  );
  assert.match(
    rowSource,
    /const ThreadDeleteMessageConfirm = dynamic\(/,
  );
  assert.match(
    rowSource,
    /const ThreadReactionGroups = dynamic\(/,
  );
  assert.match(
    quickActionsSource,
    /<ThreadReactionPicker/,
  );
  assert.match(
    rowContentSource,
    /const ThreadInlineEditForm = dynamic\(/,
  );
  assert.match(
    rowContentSource,
    /const MemoizedThreadVoiceMessageBubble = dynamic\(/,
  );
  assert.match(
    rowContentSource,
    /function ThreadVoiceMessageBubbleLoadingFallback\(/,
  );
  assert.match(rowSource, /<ThreadMessageQuickActionsPanel/);
  assert.match(rowContentSource, /<MemoizedThreadVoiceMessageBubble/);
  assert.match(
    composerSource,
    /const EncryptedDmComposerForm = dynamic\(/,
  );
  assert.match(
    composerSource,
    /const PlaintextChatComposerForm = dynamic\(/,
  );
  assert.match(
    composerSource,
    /function ComposerFormShellFallback\(/,
  );
  assert.match(
    diagnosticsSource,
    /const DM_THREAD_CLIENT_DIAGNOSTICS_ENABLED =/,
  );
  assert.match(diagnosticsSource, /class DmThreadSilentErrorBoundary/);
  assert.match(diagnosticsSource, /if \(!DM_THREAD_CLIENT_DIAGNOSTICS_ENABLED\)/);
});

test('inbox route defers create flow, realtime startup, and warm-nav work until needed', () => {
  const inboxPageSource = readWorkspaceFile('app/(app)/inbox/page.tsx');
  const inboxContentSource = readWorkspaceFile(
    'app/(app)/inbox/inbox-filterable-content.tsx',
  );
  const inboxContentModelSource = readWorkspaceFile(
    'app/(app)/inbox/inbox-filterable-content-model.ts',
  );
  const inboxCreateRuntimeSource = readWorkspaceFile(
    'app/(app)/inbox/inbox-create-sheet-runtime.tsx',
  );
  const inboxDeferredEffectsSource = readWorkspaceFile(
    'app/(app)/inbox/inbox-page-deferred-effects.tsx',
  );
  const inboxRouteStateSource = readWorkspaceFile(
    'app/(app)/inbox/use-inbox-filterable-route-state.ts',
  );
  const inboxPullRefreshSource = readWorkspaceFile(
    'app/(app)/inbox/use-inbox-pull-refresh.ts',
  );
  const deferredRealtimeSource = readWorkspaceFile(
    'app/(app)/inbox/deferred-inbox-realtime-sync.tsx',
  );
  const inboxServerSource = readWorkspaceFile(
    'src/modules/messaging/server/inbox-page.ts',
  );

  assert.match(inboxPageSource, /from ['"]\.\/inbox-page-deferred-effects['"]/);
  assert.match(inboxPageSource, /<InboxPageDeferredEffects/);
  assert.match(
    inboxPageSource,
    /availableDmUserCount=\{data\.availableDmUserCount\}/,
  );
  assert.match(
    inboxPageSource,
    /availableUserCount=\{data\.availableUserCount\}/,
  );
  assert.match(
    inboxPageSource,
    /initialCreateDmUserEntries=\{data\.initialCreateDmUserEntries\}/,
  );
  assert.match(
    inboxPageSource,
    /initialCreateUserEntries=\{data\.initialCreateUserEntries\}/,
  );
  assert.match(
    inboxPageSource,
    /searchScopedAvailableUserCount=\{data\.searchScopedAvailableUserCount\}/,
  );
  assert.doesNotMatch(
    inboxPageSource,
    /availableDmUserEntries=\{data\.availableDmUserEntries\}|availableUserEntries=\{data\.availableUserEntries\}/,
  );

  assert.match(
    inboxCreateRuntimeSource,
    /const NewChatSheet = dynamic\(/,
  );
  assert.match(
    inboxContentSource,
    /const DeferredInboxConversationSectionsLive = dynamic\(/,
  );
  assert.match(
    inboxContentSource,
    /const DeferredInboxCreateSheetRuntime = dynamic\(/,
  );
  assert.match(
    inboxContentSource,
    /from ['"]\.\/inbox-filterable-content-model['"]/,
  );
  assert.match(
    inboxContentSource,
    /from ['"]\.\/use-inbox-filterable-route-state['"]/,
  );
  assert.match(
    inboxContentSource,
    /from ['"]\.\/use-inbox-pull-refresh['"]/,
  );
  assert.match(
    inboxContentSource,
    /from ['"]\.\/use-deferred-inbox-runtime-ready['"]/,
  );
  assert.match(
    inboxContentSource,
    /from ['"]\.\/inbox-conversation-sections-static['"]/,
  );
  assert.match(
    inboxContentSource,
    /useInboxFilterableRouteState\(/,
  );
  assert.match(
    inboxContentSource,
    /useInboxPullRefresh\(/,
  );
  assert.match(
    inboxContentSource,
    /useDeferredInboxRuntimeReady\(/,
  );
  assert.match(
    inboxContentSource,
    /<DeferredInboxConversationSectionsLive/,
  );
  assert.match(
    inboxContentSource,
    /<InboxConversationSectionsStatic/,
  );
  assert.match(
    inboxContentSource,
    /<DeferredInboxCreateSheetRuntime/,
  );
  assert.doesNotMatch(
    inboxContentSource,
    /requestInboxManualRefresh|resolveInboxInitialFilter/,
  );
  assert.doesNotMatch(
    inboxContentSource,
    /subscribeToInboxSummaryRevision|getInboxSummaryRevisionSnapshot|useSyncExternalStore/,
  );
  assert.doesNotMatch(
    inboxContentSource,
    /createDerivedConversationItemsMemoizer|deriveConversationItemFromLiveState/,
  );
  assert.match(inboxContentModelSource, /function buildInboxHref\(/);
  assert.match(inboxContentModelSource, /function buildFilterBucket\(/);
  assert.match(
    inboxContentModelSource,
    /function buildOrganizedConversationSectionsByFilter\(/,
  );
  assert.match(inboxContentModelSource, /function normalizeSearchTerm\(/);
  assert.match(
    inboxRouteStateSource,
    /resolveInboxInitialFilter|window\.history\.replaceState|buildInboxHref/,
  );
  assert.match(
    inboxPullRefreshSource,
    /requestInboxManualRefresh|const INBOX_PULL_REFRESH_THRESHOLD = 72;/,
  );
  assert.match(
    inboxPullRefreshSource,
    /if \(!enabled\) \{/,
  );
  assert.match(
    inboxDeferredEffectsSource,
    /const DeferredInboxRealtimeSync = dynamic\(/,
  );
  assert.match(
    inboxDeferredEffectsSource,
    /\{ ssr: false \}/,
  );
  assert.match(
    inboxDeferredEffectsSource,
    /DeferredWarmNavReadyProbe/,
  );
  assert.match(
    deferredRealtimeSource,
    /window\.requestAnimationFrame/,
  );
  assert.match(
    deferredRealtimeSource,
    /requestIdleCallback/,
  );
  assert.match(
    deferredRealtimeSource,
    /if \(!isReady\) \{\s*return null;\s*\}/,
  );
  assert.match(
    deferredRealtimeSource,
    /return <InboxRealtimeSync \{\.\.\.props\} \/>;/,
  );
  assert.match(
    inboxServerSource,
    /availableDmUserCount: availableDmUserEntries\.length/,
  );
  assert.match(
    inboxServerSource,
    /availableUserCount: availableUserEntries\.length/,
  );
  assert.match(
    inboxServerSource,
    /initialCreateDmUserEntries: isCreateOpen \? availableDmUserEntries : \[\]/,
  );
  assert.match(
    inboxServerSource,
    /initialCreateUserEntries: isCreateOpen \? availableUserEntries : \[\]/,
  );
  assert.match(
    inboxServerSource,
    /searchScopedAvailableUserCount/,
  );
  assert.ok(
    readWorkspaceLineCount('app/(app)/inbox/inbox-filterable-content.tsx') <=
      750,
  );
});
