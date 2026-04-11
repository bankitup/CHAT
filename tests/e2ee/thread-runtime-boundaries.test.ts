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
    /from ['"]\.\/thread-voice-message-bubble['"]/,
  );
  assert.match(viewportSource, /<MemoizedThreadVoiceMessageBubble/);
  assert.doesNotMatch(
    viewportSource,
    /from ['"]\.\/voice-playback-source['"]/,
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
