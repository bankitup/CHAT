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
    /const shouldMountDmBoundary =\s*dmE2eeEnabled && \(isChatRoute \|\| isInboxRoute\);/,
  );
  assert.match(
    shellSource,
    /const shouldMountImmediatePresenceSync = isMessengerSurface && isChatRoute;/,
  );
  assert.match(
    shellSource,
    /const shouldMountDeferredMessengerEffects = isMessengerSurface;/,
  );
  assert.match(shellSource, /function DeferredMessengerShellEffects\(/);
  assert.match(shellSource, /<ChatUnreadBadgeSync syncKey=\{syncKey\} \/>/);
  assert.match(shellSource, /<WarmNavRouteObserver \/>/);
});

test('chat route keeps heavy secondary interaction paths behind on-demand boundaries', () => {
  const threadPageContentSource = readWorkspaceFile(
    'app/(app)/chat/[conversationId]/thread-page-content.tsx',
  );
  const viewportSource = readWorkspaceFile(
    'app/(app)/chat/[conversationId]/thread-history-viewport.tsx',
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
    /const ThreadReactionPicker = dynamic\(\(\) =>\s*import\('\.\/thread-reaction-picker'\)/,
  );
  assert.match(
    viewportSource,
    /const ThreadInlineEditForm = dynamic\(\(\) =>\s*import\('\.\/thread-inline-edit-form'\)/,
  );
  assert.match(
    viewportSource,
    /const ThreadDeleteMessageConfirm = dynamic\(\(\) =>\s*import\('\.\/thread-delete-message-confirm'\)/,
  );
  assert.match(
    viewportSource,
    /const MemoizedThreadVoiceMessageBubble = dynamic\(\(\) =>\s*import\('\.\/thread-voice-message-bubble'\)/,
  );
  assert.match(
    viewportSource,
    /const ThreadReactionGroups = dynamic\(\(\) =>\s*import\('\.\/thread-reaction-groups'\)/,
  );
  assert.match(
    viewportSource,
    /const ThreadImagePreviewOverlay = dynamic\(\(\) =>\s*import\('\.\/thread-image-preview-overlay'\)/,
  );
  assert.match(
    viewportSource,
    /from ['"]\.\/thread-viewport-deferred-effects['"]/,
  );
  assert.match(
    viewportSource,
    /from ['"]\.\/thread-history-render-list['"]/,
  );
  assert.match(viewportSource, /<ThreadViewportDeferredEffects/);
  assert.match(viewportSource, /<ThreadHistoryRenderList/);
  assert.match(
    composerSource,
    /const EncryptedDmComposerForm = dynamic\(\(\) =>\s*import\('\.\/encrypted-dm-composer-form'\)/,
  );
  assert.match(
    composerSource,
    /const PlaintextChatComposerForm = dynamic\(\(\) =>\s*import\('\.\/plaintext-chat-composer-form'\)/,
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
