import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const workspaceRoot = resolve(import.meta.dirname, '..', '..');

function readWorkspaceFile(relativePath: string) {
  return readFileSync(resolve(workspaceRoot, relativePath), 'utf8');
}

test('broken thread history stays isolated to the body while header and composer remain outside the rescue boundary', () => {
  const threadPageContentSource = readWorkspaceFile(
    'app/(app)/chat/[conversationId]/thread-page-content.tsx',
  );
  const rescueBoundarySource = readWorkspaceFile(
    'app/(app)/chat/[conversationId]/thread-body-rescue-boundary.tsx',
  );

  assert.match(
    threadPageContentSource,
    /<section className="chat-main">[\s\S]*<section className="message-thread" id="message-thread-scroll">[\s\S]*<ThreadBodyRescueBoundary[\s\S]*<ThreadHistoryViewport/,
  );
  assert.match(
    threadPageContentSource,
    /<\/ThreadBodyRescueBoundary>[\s\S]*<ThreadComposerRuntime/,
  );
  assert.match(
    threadPageContentSource,
    /<section className="stack chat-header-stack" id="chat-header-shell">/,
  );
  assert.match(
    rescueBoundarySource,
    /const \[boundaryNonce, setBoundaryNonce\] = useState\(0\);/,
  );
  assert.match(
    rescueBoundarySource,
    /onRetry=\{\(\) => setBoundaryNonce\(\(currentValue\) => currentValue \+ 1\)\}/,
  );
  assert.doesNotMatch(
    rescueBoundarySource,
    /router\.refresh|window\.location|redirect\(/,
  );
});

test('voice playback runtime stays isolated from thread-wide sync and unrelated attachment invalidation seams', () => {
  const voiceRuntimeSource = readWorkspaceFile(
    'app/(app)/chat/[conversationId]/use-thread-voice-playback-runtime.ts',
  );
  const voiceResolverSource = readWorkspaceFile(
    'app/(app)/chat/[conversationId]/voice-playback-source.ts',
  );
  const viewportSource = readWorkspaceFile(
    'app/(app)/chat/[conversationId]/thread-history-viewport.tsx',
  );

  assert.doesNotMatch(
    voiceRuntimeSource,
    /emitThreadHistorySyncRequest|getThreadLiveStateSnapshot|readThreadMessagePatchSnapshot/,
  );
  assert.doesNotMatch(
    voiceResolverSource,
    /emitThreadHistorySyncRequest|getThreadLiveStateSnapshot|readThreadMessagePatchSnapshot/,
  );
  assert.match(
    viewportSource,
    /function hasPlaybackReadyVoiceAttachment\(\s*messageId: string,\s*attachments: MessageAttachment\[\],\s*\)/,
  );
  assert.match(
    viewportSource,
    /hasMessagingVoiceLocallyRecoverableSource\(/,
  );
  assert.match(
    viewportSource,
    /reason: VOICE_MESSAGE_REOPEN_RECOVERY_REASON/,
  );
  assert.match(
    viewportSource,
    /reason: VOICE_MESSAGE_ATTACHMENT_RECOVERY_REASON/,
  );
  assert.match(
    viewportSource,
    /!hasPlaybackReadyVoiceAttachment\(\s*messageId,\s*filterRenderableMessageAttachments\(/,
  );
});

test('mobile image preview keeps a full-viewport overlay contract instead of a strip-sized media box', () => {
  const imageOverlaySource = readWorkspaceFile(
    'app/(app)/chat/[conversationId]/thread-image-preview-overlay.tsx',
  );
  const globalsSource = readWorkspaceFile('app/globals.css');

  assert.match(imageOverlaySource, /createPortal\(/);
  assert.match(imageOverlaySource, /document\.body/);
  assert.match(imageOverlaySource, /className="chat-image-preview-overlay"/);
  assert.match(imageOverlaySource, /className="chat-image-preview-shell"/);
  assert.match(imageOverlaySource, /className="chat-image-preview-stage"/);
  assert.match(imageOverlaySource, /className="chat-image-preview-frame"/);
  assert.match(imageOverlaySource, /className="chat-image-preview-image"/);

  assert.match(
    globalsSource,
    /\.chat-image-preview-overlay\s*\{[\s\S]*min-height:\s*100dvh/,
  );
  assert.match(
    globalsSource,
    /\.chat-image-preview-shell\s*\{[\s\S]*min-height:\s*100dvh[\s\S]*overflow:\s*hidden/,
  );
  assert.match(
    globalsSource,
    /\.chat-image-preview-stage\s*\{[\s\S]*height:\s*100%[\s\S]*min-width:\s*0[\s\S]*min-height:\s*0/,
  );
  assert.match(
    globalsSource,
    /\.chat-image-preview-frame\s*\{[\s\S]*width:\s*100%[\s\S]*max-height:\s*100%/,
  );
  assert.match(
    globalsSource,
    /\.chat-image-preview-image\s*\{[\s\S]*width:\s*100%[\s\S]*max-width:\s*100%[\s\S]*height:\s*auto[\s\S]*max-height:\s*calc\(100dvh - 9rem[\s\S]*object-fit:\s*contain/,
  );
});
