import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const workspaceRoot = resolve(import.meta.dirname, '..', '..');

function readWorkspaceFile(relativePath: string) {
  return readFileSync(resolve(workspaceRoot, relativePath), 'utf8');
}

test('messenger thread route composes the slim page seam instead of owning full thread composition inline', () => {
  const pageSource = readWorkspaceFile('app/(app)/chat/[conversationId]/page.tsx');

  assert.match(
    pageSource,
    /from ['"]@\/modules\/messaging\/server\/thread-page['"]/,
  );
  assert.match(
    pageSource,
    /from ['"]\.\/thread-page-content['"]/,
  );
  assert.match(pageSource, /return <ThreadPageContent conversationId=\{conversationId\} data=\{data\} \/>/);
  assert.doesNotMatch(pageSource, /ThreadHistoryViewport|ThreadComposerRuntime|GuardedServerActionForm/);
});

test('thread viewport delegates row rendering and secondary runtime to extracted seams', () => {
  const viewportSource = readWorkspaceFile(
    'app/(app)/chat/[conversationId]/thread-history-viewport.tsx',
  );
  const rowSource = readWorkspaceFile(
    'app/(app)/chat/[conversationId]/thread-message-row.tsx',
  );

  assert.match(
    viewportSource,
    /from ['"]\.\/thread-message-row['"]/,
  );
  assert.match(
    viewportSource,
    /from ['"]\.\/thread-viewport-deferred-effects['"]/,
  );
  assert.match(viewportSource, /<ThreadViewportDeferredEffects/);
  assert.match(
    viewportSource,
    /from ['"]\.\/use-thread-history-recovery['"]/,
  );
  assert.match(viewportSource, /useThreadHistoryRecovery\(/);
  assert.match(
    viewportSource,
    /from ['"]\.\/use-thread-history-sync-runtime['"]/,
  );
  assert.match(viewportSource, /useThreadHistorySyncRuntime\(/);
  assert.match(
    viewportSource,
    /from ['"]\.\/use-thread-history-prepend-scroll-restore['"]/,
  );
  assert.match(viewportSource, /useThreadHistoryPrependScrollRestore\(/);
  assert.match(
    viewportSource,
    /from ['"]\.\/thread-history-render-list['"]/,
  );
  assert.match(viewportSource, /<ThreadHistoryRenderList/);
  assert.match(
    viewportSource,
    /const ThreadImagePreviewOverlay = dynamic\(/,
  );
  assert.match(viewportSource, /<ThreadImagePreviewOverlay/);
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
  assert.match(rowSource, /<MemoizedThreadVoiceMessageBubble/);
  assert.match(rowSource, /surface="thread-message-row"/);
  assert.match(rowSource, /data-thread-message-row-fallback="true"/);
  assert.doesNotMatch(
    viewportSource,
    /const MemoizedThreadVoiceMessageBubble = dynamic\(|const ThreadReactionPicker = dynamic\(|const ThreadInlineEditForm = dynamic\(|const ThreadDeleteMessageConfirm = dynamic\(/,
  );
});

test('extracted voice bubble stays render-focused while the runtime hook owns playback wiring', () => {
  const voiceBubbleSource = readWorkspaceFile(
    'app/(app)/chat/[conversationId]/thread-voice-message-bubble.tsx',
  );
  const voiceRuntimeHookSource = readWorkspaceFile(
    'app/(app)/chat/[conversationId]/use-thread-voice-playback-runtime.ts',
  );

  assert.match(
    voiceBubbleSource,
    /from ['"]\.\/use-thread-voice-playback-runtime['"]/,
  );
  assert.match(
    voiceBubbleSource,
    /from ['"]\.\/thread-voice-diagnostics['"]/,
  );
  assert.match(voiceBubbleSource, /export const MemoizedThreadVoiceMessageBubble = memo\(/);
  assert.doesNotMatch(voiceBubbleSource, /const activeThreadVoicePlayback:/);
  assert.doesNotMatch(voiceBubbleSource, /prepareThreadVoicePlaybackSource\(/);
  assert.doesNotMatch(
    voiceBubbleSource,
    /resolveActiveThreadVoicePlaybackOwnership\(/,
  );

  assert.match(
    voiceRuntimeHookSource,
    /from ['"]\.\/thread-voice-playback-controller['"]/,
  );
  assert.match(
    voiceRuntimeHookSource,
    /from ['"]\.\/voice-playback-source['"]/,
  );
  assert.match(
    voiceRuntimeHookSource,
    /export function useThreadVoicePlaybackRuntime\(/,
  );
});

test('thread runtime split stays within the first-pass size boundaries', () => {
  const chatPageSource = readWorkspaceFile('app/(app)/chat/[conversationId]/page.tsx');
  const threadPageContentSource = readWorkspaceFile(
    'app/(app)/chat/[conversationId]/thread-page-content.tsx',
  );
  const viewportSource = readWorkspaceFile(
    'app/(app)/chat/[conversationId]/thread-history-viewport.tsx',
  );
  const rowSource = readWorkspaceFile(
    'app/(app)/chat/[conversationId]/thread-message-row.tsx',
  );
  const voiceBubbleSource = readWorkspaceFile(
    'app/(app)/chat/[conversationId]/thread-voice-message-bubble.tsx',
  );
  const voiceRuntimeHookSource = readWorkspaceFile(
    'app/(app)/chat/[conversationId]/use-thread-voice-playback-runtime.ts',
  );

  assert.ok(chatPageSource.split('\n').length <= 80);
  assert.ok(threadPageContentSource.split('\n').length <= 1000);
  assert.ok(viewportSource.split('\n').length <= 3000);
  assert.ok(rowSource.split('\n').length <= 2700);
  assert.ok(voiceBubbleSource.split('\n').length <= 800);
  assert.ok(voiceRuntimeHookSource.split('\n').length <= 1900);
});

test('thread page content remains the composition layer for thread UI pieces', () => {
  const threadPageContentSource = readWorkspaceFile(
    'app/(app)/chat/[conversationId]/thread-page-content.tsx',
  );

  assert.match(threadPageContentSource, /from ['"]\.\/thread-history-viewport['"]/);
  assert.match(threadPageContentSource, /from ['"]\.\/thread-composer-runtime['"]/);
  assert.match(
    threadPageContentSource,
    /from ['"]\.\/thread-page-deferred-effects['"]/,
  );
  assert.match(threadPageContentSource, /<ThreadHistoryViewport/);
  assert.match(threadPageContentSource, /<ThreadComposerRuntime/);
  assert.match(threadPageContentSource, /<ThreadPageDeferredEffects/);
});
