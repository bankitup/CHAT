import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const workspaceRoot = resolve(import.meta.dirname, '..', '..');

function readWorkspaceFile(relativePath: string) {
  return readFileSync(resolve(workspaceRoot, relativePath), 'utf8');
}

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
    activeChatSyncSource,
    /inbox-summary-store/,
  );
});
