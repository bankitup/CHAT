import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const workspaceRoot = resolve(import.meta.dirname, '..', '..');

function readWorkspaceFile(relativePath: string) {
  return readFileSync(resolve(workspaceRoot, relativePath), 'utf8');
}

test('shared authenticated shell gates Messenger-only startup effects behind route and posture checks', () => {
  const shellSource = readWorkspaceFile('app/(app)/app-shell-frame.tsx');

  assert.match(
    shellSource,
    /const DmE2eeAuthenticatedBoundary = dynamic\(/,
  );
  assert.match(
    shellSource,
    /const ChatUnreadBadgeSync = dynamic\(/,
  );
  assert.match(
    shellSource,
    /const PushSubscriptionPresenceSync = dynamic\(/,
  );
  assert.match(
    shellSource,
    /const WarmNavRouteObserver = dynamic\(/,
  );
  assert.doesNotMatch(
    shellSource,
    /from ['"]@\/modules\/messaging\/e2ee\/local-state-boundary['"]|from ['"]@\/modules\/messaging\/push\/chat-unread-badge-sync['"]|from ['"]@\/modules\/messaging\/push\/presence-sync['"]|from ['"]@\/modules\/messaging\/performance\/warm-nav-client['"]/,
  );
  assert.match(
    shellSource,
    /const isThreadRoute = isChatRoute && !isChatSettingsRoute;/,
  );
  assert.match(
    shellSource,
    /const isMessengerCoreRuntimeSurface =\s*isMessengerSurface && \(isThreadRoute \|\| isInboxRoute \|\| isActivityRoute\);/,
  );
  assert.match(
    shellSource,
    /const shouldMountDmBoundary =\s*dmE2eeEnabled && \(isThreadRoute \|\| isInboxRoute\);/,
  );
  assert.match(
    shellSource,
    /const shouldMountImmediatePresenceSync = isMessengerSurface && isThreadRoute;/,
  );
  assert.match(
    shellSource,
    /const shouldMountDeferredPresenceSync =\s*isMessengerSurface && !shouldMountImmediatePresenceSync && isInboxRoute;/,
  );
  assert.match(
    shellSource,
    /const shouldMountUnreadBadgeSync = isMessengerCoreRuntimeSurface;/,
  );
  assert.match(
    shellSource,
    /const shouldMountWarmNavObserver =\s*isMessengerCoreRuntimeSurface && WARM_NAV_CLIENT_DIAGNOSTICS_ENABLED;/,
  );
  assert.match(shellSource, /function DeferredMessengerShellEffects\(/);
  assert.match(
    shellSource,
    /includeChatUnreadBadgeSync: boolean;/,
  );
  assert.match(
    shellSource,
    /includeWarmNavObserver: boolean;/,
  );
  assert.match(
    shellSource,
    /\{includeChatUnreadBadgeSync \? \(\s*<ChatUnreadBadgeSync syncKey=\{syncKey\} \/>/,
  );
  assert.match(
    shellSource,
    /\{includeWarmNavObserver \? <WarmNavRouteObserver \/> : null\}/,
  );
});

test('chat route keeps heavy secondary interaction paths behind on-demand boundaries', () => {
  const threadPageContentSource = readWorkspaceFile(
    'app/(app)/chat/[conversationId]/thread-page-content.tsx',
  );
  const viewportSource = readWorkspaceFile(
    'app/(app)/chat/[conversationId]/thread-history-viewport.tsx',
  );
  const rowSource = readWorkspaceFile(
    'app/(app)/chat/[conversationId]/thread-message-row.tsx',
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
    /from ['"]\.\/thread-message-row['"]/,
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
    /from ['"]\.\/thread-history-render-list['"]/,
  );
  assert.match(
    viewportSource,
    /<ThreadViewportDeferredEffects/,
  );
  assert.match(
    viewportSource,
    /<ThreadHistoryRenderList/,
  );
  assert.match(
    rowSource,
    /const ThreadReactionPicker = dynamic\(/,
  );
  assert.match(
    rowSource,
    /const ThreadInlineEditForm = dynamic\(/,
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
    rowSource,
    /const MemoizedThreadVoiceMessageBubble = dynamic\(/,
  );
  assert.match(
    rowSource,
    /function ThreadVoiceMessageBubbleLoadingFallback\(/,
  );
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
  const inboxCreateRuntimeSource = readWorkspaceFile(
    'app/(app)/inbox/inbox-create-sheet-runtime.tsx',
  );
  const inboxDeferredEffectsSource = readWorkspaceFile(
    'app/(app)/inbox/inbox-page-deferred-effects.tsx',
  );
  const deferredRealtimeSource = readWorkspaceFile(
    'app/(app)/inbox/deferred-inbox-realtime-sync.tsx',
  );

  assert.match(inboxPageSource, /from ['"]\.\/inbox-page-deferred-effects['"]/);
  assert.match(inboxPageSource, /<InboxPageDeferredEffects/);

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
    /from ['"]\.\/use-deferred-inbox-runtime-ready['"]/,
  );
  assert.match(
    inboxContentSource,
    /from ['"]\.\/inbox-conversation-sections-static['"]/,
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
    /subscribeToInboxSummaryRevision|getInboxSummaryRevisionSnapshot|useSyncExternalStore/,
  );
  assert.doesNotMatch(
    inboxContentSource,
    /createDerivedConversationItemsMemoizer|deriveConversationItemFromLiveState/,
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
});
