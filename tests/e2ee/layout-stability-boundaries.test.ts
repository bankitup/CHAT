import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const workspaceRoot = resolve(import.meta.dirname, '..', '..');

function readWorkspaceFile(relativePath: string) {
  return readFileSync(resolve(workspaceRoot, relativePath), 'utf8');
}

test('shared shell and messenger globals keep reserved layout space for CLS-sensitive surfaces', () => {
  const globalsSource = readWorkspaceFile('app/globals.css');

  assert.match(globalsSource, /--app-bottom-nav-shell-min-height:/);
  assert.match(globalsSource, /--app-bottom-nav-shell-messenger-min-height:/);
  assert.match(globalsSource, /--app-composer-runtime-min-height:/);
  assert.match(globalsSource, /\.app-bottom-nav-shell\s*\{[\s\S]*min-height:\s*var\(--app-bottom-nav-shell-min-height\)/);
  assert.match(
    globalsSource,
    /\.app-bottom-nav-shell-messenger\s*\{[\s\S]*min-height:\s*var\(--app-bottom-nav-shell-messenger-min-height\)/,
  );
  assert.match(
    globalsSource,
    /\.composer-runtime-shell\s*\{[\s\S]*min-height:\s*var\(--app-composer-runtime-min-height\)/,
  );
  assert.match(
    globalsSource,
    /\.chat-header-meta\s*\{[\s\S]*min-height:\s*18px/,
  );
  assert.match(
    globalsSource,
    /\.chat-presence-status\s*\{[\s\S]*min-height:\s*18px/,
  );
  assert.match(
    globalsSource,
    /\.conversation-preview-placeholder\s*\{[\s\S]*visibility:\s*hidden/,
  );
  assert.match(
    globalsSource,
    /\.message-voice-card-loading/,
  );
});

test('chat and inbox components keep explicit reserved-shell fallbacks instead of late zero-height settlement', () => {
  const composerRuntimeSource = readWorkspaceFile(
    'app/(app)/chat/[conversationId]/thread-composer-runtime.tsx',
  );
  const presenceSource = readWorkspaceFile(
    'app/(app)/chat/[conversationId]/conversation-presence-status.tsx',
  );
  const viewportSource = readWorkspaceFile(
    'app/(app)/chat/[conversationId]/thread-history-viewport.tsx',
  );
  const staticInboxRowSource = readWorkspaceFile(
    'app/(app)/inbox/inbox-conversation-static-row.tsx',
  );
  const liveInboxRowSource = readWorkspaceFile(
    'app/(app)/inbox/inbox-conversation-live-row.tsx',
  );

  assert.match(composerRuntimeSource, /function ComposerFormShellFallback\(/);
  assert.match(composerRuntimeSource, /className="composer-runtime-shell"/);
  assert.match(composerRuntimeSource, /loading:\s*ComposerFormShellFallback/);

  assert.match(
    presenceSource,
    /data-presence-active=\{isOtherParticipantPresent \? 'true' : 'false'\}/,
  );
  assert.match(presenceSource, /aria-hidden=\{!isOtherParticipantPresent\}/);

  assert.match(
    viewportSource,
    /function ThreadVoiceMessageBubbleLoadingFallback\(/,
  );
  assert.match(
    viewportSource,
    /className="message-voice-card message-voice-card-loading"/,
  );
  assert.match(viewportSource, /loading:\s*ThreadVoiceMessageBubbleLoadingFallback/);

  assert.match(staticInboxRowSource, /conversation-preview-placeholder/);
  assert.match(liveInboxRowSource, /conversation-preview-placeholder/);
});
