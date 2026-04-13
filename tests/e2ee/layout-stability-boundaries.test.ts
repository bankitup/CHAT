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
  const messengerRouteCssSource = readWorkspaceFile(
    'app/(app)/messenger-route.css',
  );

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
    /\.app-bottom-nav-link\s*\{[\s\S]*min-width:\s*0/,
  );
  assert.match(
    globalsSource,
    /\.app-bottom-nav-label\s*\{[\s\S]*overflow:\s*hidden[\s\S]*text-overflow:\s*ellipsis[\s\S]*white-space:\s*nowrap/,
  );
  assert.match(
    messengerRouteCssSource,
    /\.composer-runtime-shell\s*\{[\s\S]*min-height:\s*var\(--app-composer-runtime-min-height\)/,
  );
  assert.match(
    messengerRouteCssSource,
    /\.chat-header-meta\s*\{[\s\S]*min-height:\s*18px/,
  );
  assert.match(
    messengerRouteCssSource,
    /\.chat-presence-status\s*\{[\s\S]*min-height:\s*18px/,
  );
  assert.match(
    messengerRouteCssSource,
    /\.conversation-preview-placeholder\s*\{[\s\S]*visibility:\s*hidden/,
  );
  assert.match(
    messengerRouteCssSource,
    /\.message-voice-card-loading/,
  );
  assert.match(
    messengerRouteCssSource,
    /\.message-voice-card\s*\{[\s\S]*overflow-anchor:\s*none/,
  );
  assert.match(
    messengerRouteCssSource,
    /\.message-voice-card\s*\{[\s\S]*position:\s*relative/,
  );
  assert.match(
    messengerRouteCssSource,
    /\.message-voice-title\s*\{[\s\S]*overflow:\s*hidden[\s\S]*text-overflow:\s*ellipsis[\s\S]*white-space:\s*nowrap/,
  );
  assert.match(
    messengerRouteCssSource,
    /\.message-voice-duration\s*\{[\s\S]*flex:\s*0 0 6\.5rem[\s\S]*font-variant-numeric:\s*tabular-nums[\s\S]*min-width:\s*6\.5rem[\s\S]*text-align:\s*right/,
  );
  assert.match(
    messengerRouteCssSource,
    /\.message-voice-audio\s*\{[\s\S]*position:\s*absolute[\s\S]*clip-path:\s*inset\(50%\)/,
  );
  assert.match(
    messengerRouteCssSource,
    /\.chat-image-preview-shell\s*\{[\s\S]*overflow:\s*hidden/,
  );
  assert.match(
    messengerRouteCssSource,
    /\.chat-image-preview-stage\s*\{[\s\S]*height:\s*100%[\s\S]*min-width:\s*0[\s\S]*min-height:\s*0/,
  );
  assert.match(
    messengerRouteCssSource,
    /\.chat-image-preview-frame\s*\{[\s\S]*max-height:\s*100%[\s\S]*min-width:\s*0[\s\S]*min-height:\s*0/,
  );
  assert.match(
    messengerRouteCssSource,
    /\.chat-image-preview-image\s*\{[\s\S]*width:\s*100%[\s\S]*max-width:\s*100%[\s\S]*height:\s*auto[\s\S]*object-fit:\s*contain/,
  );
});

test('chat and inbox components keep explicit reserved-shell fallbacks instead of late zero-height settlement', () => {
  const globalsSource = readWorkspaceFile('app/globals.css');
  const composerRuntimeSource = readWorkspaceFile(
    'app/(app)/chat/[conversationId]/thread-composer-runtime.tsx',
  );
  const presenceSource = readWorkspaceFile(
    'app/(app)/chat/[conversationId]/conversation-presence-status.tsx',
  );
  const viewportSource = readWorkspaceFile(
    'app/(app)/chat/[conversationId]/thread-history-viewport.tsx',
  );
  const rowContentSource = readWorkspaceFile(
    'app/(app)/chat/[conversationId]/thread-message-row-content.tsx',
  );
  const messengerRouteCssSource = readWorkspaceFile(
    'app/(app)/messenger-route.css',
  );
  const staticInboxRowSource = readWorkspaceFile(
    'app/(app)/inbox/inbox-conversation-static-row.tsx',
  );
  const liveInboxRowSource = readWorkspaceFile(
    'app/(app)/inbox/inbox-conversation-live-row.tsx',
  );
  const inboxRowContractCssSource = readWorkspaceFile(
    'app/(app)/inbox/inbox-conversation-row-contract.module.css',
  );

  assert.match(composerRuntimeSource, /function ComposerFormShellFallback\(/);
  assert.match(
    composerRuntimeSource,
    /from ['"]\.\/composer-shell-contract\.module\.css['"]/,
  );
  assert.match(
    composerRuntimeSource,
    /composer-runtime-shell \$\{styles\.runtimeShell\}/,
  );
  assert.match(composerRuntimeSource, /loading:\s*ComposerFormShellFallback/);

  assert.match(
    presenceSource,
    /data-presence-active=\{isOtherParticipantPresent \? 'true' : 'false'\}/,
  );
  assert.match(presenceSource, /aria-hidden=\{!isOtherParticipantPresent\}/);

  assert.match(
    rowContentSource,
    /function ThreadVoiceMessageBubbleLoadingFallback\(/,
  );
  assert.match(
    rowContentSource,
    /className="message-voice-card message-voice-card-loading"/,
  );
  assert.match(
    rowContentSource,
    /loading:\s*ThreadVoiceMessageBubbleLoadingFallback/,
  );
  assert.match(
    viewportSource,
    /from ['"]\.\/thread-history-message-list['"]/,
  );

  assert.match(staticInboxRowSource, /conversation-preview-placeholder/);
  assert.match(liveInboxRowSource, /conversation-preview-placeholder/);
  assert.match(
    staticInboxRowSource,
    /from ['"]\.\/inbox-conversation-row-contract\.module\.css['"]/,
  );
  assert.match(
    liveInboxRowSource,
    /from ['"]\.\/inbox-conversation-row-contract\.module\.css['"]/,
  );
  assert.match(staticInboxRowSource, /styles\.row/);
  assert.match(staticInboxRowSource, /styles\.link/);
  assert.match(staticInboxRowSource, /styles\.titleRow/);
  assert.match(staticInboxRowSource, /styles\.preview/);
  assert.match(liveInboxRowSource, /styles\.row/);
  assert.match(liveInboxRowSource, /styles\.link/);
  assert.match(liveInboxRowSource, /styles\.titleRow/);
  assert.match(liveInboxRowSource, /styles\.preview/);
  assert.match(
    inboxRowContractCssSource,
    /\.row\s*\{[\s\S]*grid-template-columns:\s*auto minmax\(0,\s*1fr\)/,
  );
  assert.match(
    inboxRowContractCssSource,
    /\.link\s*\{[\s\S]*grid-template-columns:\s*auto minmax\(0,\s*1fr\)[\s\S]*min-width:\s*0/,
  );
  assert.match(
    inboxRowContractCssSource,
    /\.titleRow\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s*auto/,
  );
  assert.match(
    inboxRowContractCssSource,
    /\.preview\s*\{[\s\S]*overflow:\s*hidden[\s\S]*text-overflow:\s*ellipsis[\s\S]*white-space:\s*nowrap/,
  );
  assert.match(
    messengerRouteCssSource,
    /\.chat-screen\s*\{[\s\S]*min-width:\s*0[\s\S]*width:\s*100%/,
  );
  assert.match(
    messengerRouteCssSource,
    /\.chat-header-shell\s*\{[\s\S]*min-width:\s*0[\s\S]*width:\s*100%/,
  );
  assert.match(
    messengerRouteCssSource,
    /\.composer-card\s*\{[\s\S]*min-width:\s*0[\s\S]*width:\s*100%/,
  );
  assert.match(
    globalsSource,
    /@media \(max-width:\s*520px\)\s*\{[\s\S]*\.profile-inline-top-row,[\s\S]*\.profile-status-top-row[\s\S]*flex-wrap:\s*wrap/,
  );
});
