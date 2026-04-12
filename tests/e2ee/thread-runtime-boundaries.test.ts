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

test('thread viewport delegates voice runtime to the extracted voice bubble seam', () => {
  const viewportSource = readWorkspaceFile(
    'app/(app)/chat/[conversationId]/thread-history-viewport.tsx',
  );

  assert.match(
    viewportSource,
    /const MemoizedThreadVoiceMessageBubble = dynamic\(\(\) =>\s*import\('\.\/thread-voice-message-bubble'\)/,
  );
  assert.match(viewportSource, /<MemoizedThreadVoiceMessageBubble/);
  assert.match(
    viewportSource,
    /import \{ configureInlineAudioElement \} from ['"]\.\/voice-playback-source['"]/,
  );
  assert.doesNotMatch(
    viewportSource,
    /function ThreadVoiceMessageBubble\(/,
  );
});

test('extracted voice bubble owns playback-source wiring and voice diagnostics', () => {
  const voiceBubbleSource = readWorkspaceFile(
    'app/(app)/chat/[conversationId]/thread-voice-message-bubble.tsx',
  );

  assert.match(
    voiceBubbleSource,
    /from ['"]\.\/voice-playback-source['"]/,
  );
  assert.match(
    voiceBubbleSource,
    /from ['"]\.\/thread-voice-diagnostics['"]/,
  );
  assert.match(voiceBubbleSource, /export const MemoizedThreadVoiceMessageBubble = memo\(/);
});

test('thread runtime split stays within the first-pass size boundaries', () => {
  const chatPageSource = readWorkspaceFile('app/(app)/chat/[conversationId]/page.tsx');
  const threadPageContentSource = readWorkspaceFile(
    'app/(app)/chat/[conversationId]/thread-page-content.tsx',
  );
  const viewportSource = readWorkspaceFile(
    'app/(app)/chat/[conversationId]/thread-history-viewport.tsx',
  );
  const voiceBubbleSource = readWorkspaceFile(
    'app/(app)/chat/[conversationId]/thread-voice-message-bubble.tsx',
  );

  assert.ok(chatPageSource.split('\n').length <= 80);
  assert.ok(threadPageContentSource.split('\n').length <= 1200);
  assert.ok(viewportSource.split('\n').length <= 5800);
  assert.ok(voiceBubbleSource.split('\n').length <= 2400);
});

test('thread page content remains the composition layer for thread UI pieces', () => {
  const threadPageContentSource = readWorkspaceFile(
    'app/(app)/chat/[conversationId]/thread-page-content.tsx',
  );

  assert.match(threadPageContentSource, /from ['"]\.\/thread-history-viewport['"]/);
  assert.match(threadPageContentSource, /from ['"]\.\/thread-composer-runtime['"]/);
  assert.match(threadPageContentSource, /<ThreadHistoryViewport/);
  assert.match(threadPageContentSource, /<ThreadComposerRuntime/);
});
