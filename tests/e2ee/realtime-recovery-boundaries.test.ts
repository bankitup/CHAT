import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const workspaceRoot = resolve(import.meta.dirname, '..', '..');

function readWorkspaceFile(relativePath: string) {
  return readFileSync(resolve(workspaceRoot, relativePath), 'utf8');
}

test('Messenger realtime subscriptions stay route-scoped instead of mounting from the shared shell', () => {
  const appShellFrameSource = readWorkspaceFile(
    'app/(app)/app-shell-frame.tsx',
  );
  const threadPageContentSource = readWorkspaceFile(
    'app/(app)/chat/[conversationId]/thread-page-content.tsx',
  );
  const threadRouteRuntimeEffectsSource = readWorkspaceFile(
    'app/(app)/chat/[conversationId]/thread-route-runtime-effects.tsx',
  );
  const threadPageDeferredEffectsSource = readWorkspaceFile(
    'app/(app)/chat/[conversationId]/thread-page-deferred-effects.tsx',
  );
  const inboxPageSource = readWorkspaceFile('app/(app)/inbox/page.tsx');
  const inboxRouteRuntimeEffectsSource = readWorkspaceFile(
    'app/(app)/inbox/inbox-route-runtime-effects.tsx',
  );
  const inboxPageDeferredEffectsSource = readWorkspaceFile(
    'app/(app)/inbox/inbox-page-deferred-effects.tsx',
  );
  const activityRouteRuntimeEffectsSource = readWorkspaceFile(
    'app/(app)/activity/activity-route-runtime-effects.tsx',
  );

  assert.doesNotMatch(
    appShellFrameSource,
    /ActiveChatRealtimeSync|InboxRealtimeSync|PushSubscriptionPresenceSync|ChatUnreadBadgeSync|WarmNavRouteObserver|DmE2eeAuthenticatedBoundary/,
  );

  assert.match(threadPageContentSource, /<ThreadRouteRuntimeEffects/);
  assert.match(threadPageContentSource, /<ThreadPageDeferredEffects/);
  assert.match(
    threadRouteRuntimeEffectsSource,
    /const PushSubscriptionPresenceSync = dynamic/,
  );
  assert.match(
    threadPageDeferredEffectsSource,
    /const DeferredActiveChatRealtimeSync = dynamic/,
  );
  assert.match(
    threadPageDeferredEffectsSource,
    /const DeferredThreadLiveStateHydrator = dynamic/,
  );

  assert.match(inboxPageSource, /<InboxRouteRuntimeEffects/);
  assert.match(inboxPageSource, /<InboxPageDeferredEffects/);
  assert.match(
    inboxRouteRuntimeEffectsSource,
    /const PushSubscriptionPresenceSync = dynamic/,
  );
  assert.match(
    inboxPageDeferredEffectsSource,
    /const DeferredInboxRealtimeSync = dynamic/,
  );

  assert.match(activityRouteRuntimeEffectsSource, /<InboxRealtimeSync/);
  assert.doesNotMatch(
    activityRouteRuntimeEffectsSource,
    /ActiveChatRealtimeSync/,
  );
});

test('thread reconnect recovery requests both after-seq catch-up and authoritative latest-window reconciliation', () => {
  const activeChatSyncSource = readWorkspaceFile(
    'src/modules/messaging/realtime/active-chat-sync.tsx',
  );
  const syncEventsSource = readWorkspaceFile(
    'src/modules/messaging/realtime/thread-history-sync-events.ts',
  );
  const syncRuntimeSource = readWorkspaceFile(
    'app/(app)/chat/[conversationId]/use-thread-history-sync-runtime.ts',
  );
  const viewportSource = readWorkspaceFile(
    'app/(app)/chat/[conversationId]/thread-history-viewport.tsx',
  );

  assert.match(syncEventsSource, /authoritativeLatestWindow\?: boolean;/);
  assert.match(
    activeChatSyncSource,
    /const THREAD_AUTHORITATIVE_LATEST_WINDOW_RECOVERY_REASON =/,
  );
  assert.match(
    activeChatSyncSource,
    /const requestAuthoritativeLatestWindowSync = \(reason: string\) =>/,
  );
  assert.match(activeChatSyncSource, /authoritativeLatestWindow: true/);
  assert.match(
    activeChatSyncSource,
    /requestAuthoritativeLatestWindowSync\('visibility-visible'\)/,
  );
  assert.match(
    activeChatSyncSource,
    /requestAuthoritativeLatestWindowSync\(\s*THREAD_AUTHORITATIVE_LATEST_WINDOW_RECOVERY_REASON,\s*\)/,
  );
  assert.match(
    syncRuntimeSource,
    /PendingAuthoritativeLatestWindowThreadHistorySyncRequest/,
  );
  assert.match(
    syncRuntimeSource,
    /chosenMode: 'authoritative-latest-window'/,
  );
  assert.match(syncRuntimeSource, /allowLatest: true/);
  assert.match(
    viewportSource,
    /reconcileThreadLiveReactionSnapshot/,
  );
  assert.match(
    viewportSource,
    /reconcileThreadMessagePatchesWithAuthoritativeMessages/,
  );
  assert.match(
    viewportSource,
    /input\.mode === 'authoritative-latest-window'\s*\?\s*'refresh-base'\s*:\s*'sync-topology'/,
  );
});

test('background to foreground recovery stays explicit for both thread and inbox routes', () => {
  const activeChatSyncSource = readWorkspaceFile(
    'src/modules/messaging/realtime/active-chat-sync.tsx',
  );
  const inboxSyncSource = readWorkspaceFile(
    'src/modules/messaging/realtime/inbox-sync.tsx',
  );

  assert.match(
    activeChatSyncSource,
    /document\.addEventListener\('visibilitychange', handleVisibilityChange\)/,
  );
  assert.match(
    activeChatSyncSource,
    /requestTopologySync\(\{\s*newerThanLatest: true,\s*reason: 'visibility-visible',\s*\}\);/,
  );
  assert.match(
    activeChatSyncSource,
    /requestAuthoritativeLatestWindowSync\('visibility-visible'\);/,
  );

  assert.match(
    inboxSyncSource,
    /document\.addEventListener\('visibilitychange', handleVisibilityChange\)/,
  );
  assert.match(
    inboxSyncSource,
    /void syncTrackedConversationSummaries\('visibility-visible'\);/,
  );
});

test('thread hot-path message inserts prefer local or broadcast hints before duplicate postgres insert sync', () => {
  const activeChatSyncSource = readWorkspaceFile(
    'src/modules/messaging/realtime/active-chat-sync.tsx',
  );

  assert.match(
    activeChatSyncSource,
    /const THREAD_RECENT_HINTED_MESSAGE_SUPPRESSION_MS = 5000;/,
  );
  assert.match(
    activeChatSyncSource,
    /const recentHintedMessageIdsRef = useRef\(new Map<string, number>\(\)\);/,
  );
  assert.match(
    activeChatSyncSource,
    /markRecentHintedMessageId\(payload\.messageId, 'message-broadcast'\);/,
  );
  assert.match(
    activeChatSyncSource,
    /markRecentHintedMessageId\(\s*detail\.messageId,\s*detail\.source \?\? 'message-local-committed',\s*\);/,
  );
  assert.match(
    activeChatSyncSource,
    /payload\.eventType === 'INSERT'[\s\S]*wasRecentlyHintedMessageId\(messageId\)[\s\S]*message-postgres:insert-topology-sync-suppressed-by-hint/,
  );
});

test('inbox reconnect recovery adds explicit resubscribe catch-up', () => {
  const inboxSyncSource = readWorkspaceFile(
    'src/modules/messaging/realtime/inbox-sync.tsx',
  );

  assert.match(
    inboxSyncSource,
    /const hasSeenSubscribedStatusRef = useRef\(false\);/,
  );
  assert.match(
    inboxSyncSource,
    /const isRealtimeChannelSubscribedRef = useRef\(false\);/,
  );
  assert.match(inboxSyncSource, /channel\.subscribe\(\(status\) =>/);
  assert.match(
    inboxSyncSource,
    /const isReconnect =\s*hasSeenSubscribedStatusRef\.current &&\s*!isRealtimeChannelSubscribedRef\.current;/,
  );
  assert.match(
    inboxSyncSource,
    /void syncTrackedConversationSummaries\('realtime-resubscribe'\);/,
  );
});

test('thread and inbox live surfaces keep summary catch-up narrower and more independent', () => {
  const inboxSyncSource = readWorkspaceFile(
    'src/modules/messaging/realtime/inbox-sync.tsx',
  );
  const inboxSummaryStoreSource = readWorkspaceFile(
    'src/modules/messaging/realtime/inbox-summary-store.ts',
  );
  const activeChatSyncSource = readWorkspaceFile(
    'src/modules/messaging/realtime/active-chat-sync.tsx',
  );
  const threadLiveStateStoreSource = readWorkspaceFile(
    'src/modules/messaging/realtime/thread-live-state-store.ts',
  );

  assert.match(
    inboxSummaryStoreSource,
    /export function doesInboxConversationSummaryReflectMessageId\(/,
  );
  assert.match(
    inboxSummaryStoreSource,
    /export function doesInboxConversationSummaryReflectLatestMessageRecord\(/,
  );
  assert.match(
    inboxSummaryStoreSource,
    /export function doesInboxConversationSummaryReflectMembershipRecord\(/,
  );
  assert.match(
    inboxSummaryStoreSource,
    /export function doesInboxConversationSummaryReflectConversationRecord\(/,
  );
  assert.match(
    inboxSyncSource,
    /summary-refresh-suppressed:local-already-projected/,
  );
  assert.match(
    inboxSyncSource,
    /summary-refresh-suppressed:broadcast-already-projected/,
  );
  assert.match(
    inboxSyncSource,
    /summary-refresh-suppressed:message-update-nonlatest/,
  );
  assert.match(
    inboxSyncSource,
    /summary-refresh-suppressed:membership-already-projected/,
  );
  assert.match(
    inboxSyncSource,
    /summary-refresh-suppressed:conversation-already-projected/,
  );
  assert.doesNotMatch(
    inboxSyncSource,
    /thread-live-state-store|thread-message-patch-store|emitThreadHistorySyncRequest|emitThreadHistoryLiveMessage/,
  );
  assert.doesNotMatch(
    activeChatSyncSource,
    /inbox-summary-store|patchInboxConversationSummary|syncConversationSummary/,
  );
  assert.doesNotMatch(
    threadLiveStateStoreSource,
    /inbox-summary-store|patchInboxConversationSummary|syncConversationSummary/,
  );
  assert.doesNotMatch(
    inboxSummaryStoreSource,
    /thread-live-state-store|thread-message-patch-store|emitThreadHistorySyncRequest/,
  );
});

test('presence and typing stay auxiliary and do not drive message truth or catch-up', () => {
  const presenceProviderSource = readWorkspaceFile(
    'app/(app)/chat/[conversationId]/conversation-presence-provider.tsx',
  );
  const typingTextareaSource = readWorkspaceFile(
    'app/(app)/chat/[conversationId]/composer-typing-textarea.tsx',
  );
  const typingIndicatorSource = readWorkspaceFile(
    'app/(app)/chat/[conversationId]/typing-indicator.tsx',
  );
  const liveOutgoingStatusSource = readWorkspaceFile(
    'app/(app)/chat/[conversationId]/live-outgoing-message-status.tsx',
  );
  const pushPresenceSyncSource = readWorkspaceFile(
    'src/modules/messaging/push/presence-sync.tsx',
  );

  assert.doesNotMatch(
    presenceProviderSource,
    /emitThreadHistorySyncRequest|patchInboxConversationSummary|router\.refresh|syncConversationSummary/,
  );
  assert.match(
    presenceProviderSource,
    /document\.visibilityState !== 'visible'/,
  );
  assert.match(
    presenceProviderSource,
    /status === 'CHANNEL_ERROR'[\s\S]*status === 'TIMED_OUT'[\s\S]*status === 'CLOSED'/,
  );

  assert.doesNotMatch(
    typingTextareaSource,
    /emitThreadHistorySyncRequest|patchInboxConversationSummary|router\.refresh|syncConversationSummary/,
  );
  assert.match(
    typingTextareaSource,
    /document\.visibilityState !== 'visible'/,
  );
  assert.match(
    typingTextareaSource,
    /window\.addEventListener\('pagehide', handlePageHide\)/,
  );
  assert.match(
    typingTextareaSource,
    /status === 'CHANNEL_ERROR'[\s\S]*status === 'TIMED_OUT'[\s\S]*status === 'CLOSED'/,
  );

  assert.doesNotMatch(
    typingIndicatorSource,
    /emitThreadHistorySyncRequest|patchInboxConversationSummary|router\.refresh|syncConversationSummary/,
  );
  assert.match(
    typingIndicatorSource,
    /document\.addEventListener\('visibilitychange', handleVisibilityChange\)/,
  );
  assert.match(
    typingIndicatorSource,
    /status === 'CHANNEL_ERROR'[\s\S]*status === 'TIMED_OUT'[\s\S]*status === 'CLOSED'/,
  );

  assert.doesNotMatch(
    pushPresenceSyncSource,
    /emitThreadHistorySyncRequest|patchInboxConversationSummary|router\.refresh|syncTrackedConversationSummaries|thread-live-state-store|inbox-summary-store/,
  );
  assert.match(
    pushPresenceSyncSource,
    /window\.addEventListener\('pagehide', handlePageHide\)/,
  );
  assert.match(
    pushPresenceSyncSource,
    /document\.addEventListener\('visibilitychange', handleVisibilityChange\)/,
  );

  assert.doesNotMatch(
    liveOutgoingStatusSource,
    /conversation-presence-provider/,
  );
  assert.doesNotMatch(
    liveOutgoingStatusSource,
    /baseStatus === 'sent' && isOtherParticipantPresent/,
  );
  assert.match(
    liveOutgoingStatusSource,
    /const effectiveStatus = seenByReadState \? 'seen' : normalizedStatus;/,
  );
});
