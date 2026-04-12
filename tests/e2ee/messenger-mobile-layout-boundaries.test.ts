import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const workspaceRoot = resolve(import.meta.dirname, '..', '..');

function readWorkspaceFile(relativePath: string) {
  return readFileSync(resolve(workspaceRoot, relativePath), 'utf8');
}

test('inbox rows keep a coherent avatar, content, title-meta, and preview structure', () => {
  const staticInboxRowSource = readWorkspaceFile(
    'app/(app)/inbox/inbox-conversation-static-row.tsx',
  );
  const liveInboxRowSource = readWorkspaceFile(
    'app/(app)/inbox/inbox-conversation-live-row.tsx',
  );

  for (const source of [staticInboxRowSource, liveInboxRowSource]) {
    assert.match(
      source,
      /from ['"]\.\/inbox-conversation-row-contract\.module\.css['"]/,
    );
    assert.match(
      source,
      /<Link[\s\S]*className=\{joinClassNames\([\s\S]*styles\.link/,
    );
    assert.match(
      source,
      /<div className=\{styles\.avatarSlot\}>[\s\S]*<InboxConversationAvatarVisual/,
    );
    assert.match(
      source,
      /className=\{joinClassNames\([\s\S]*styles\.copy/,
    );
    assert.match(
      source,
      /className=\{joinClassNames\([\s\S]*styles\.mainCopy/,
    );
    assert.match(
      source,
      /className=\{joinClassNames\([\s\S]*styles\.titleRow/,
    );
    assert.match(
      source,
      /className=\{joinClassNames\([\s\S]*['"]conversation-title-meta['"][\s\S]*styles\.titleMeta/,
    );
    assert.match(
      source,
      /className=\{joinClassNames\([\s\S]*styles\.preview/,
    );
  }
});

test('chat route keeps the mobile shell split between header, message thread, and composer', () => {
  const appShellFrameSource = readWorkspaceFile('app/(app)/app-shell-frame.tsx');
  const threadPageContentSource = readWorkspaceFile(
    'app/(app)/chat/[conversationId]/thread-page-content.tsx',
  );

  assert.match(
    appShellFrameSource,
    /'page',[\s\S]*'page-mobile',[\s\S]*'app-shell'/,
  );
  assert.match(
    appShellFrameSource,
    /shellState\.showBottomNav \? 'app-shell-with-nav' : null/,
  );
  assert.match(
    appShellFrameSource,
    /'app-bottom-nav app-bottom-nav-messenger'/,
  );
  assert.match(
    appShellFrameSource,
    /'app-bottom-nav-shell app-bottom-nav-shell-messenger'/,
  );
  assert.match(
    threadPageContentSource,
    /<section className="stack chat-screen">[\s\S]*<section className="stack chat-header-stack" id="chat-header-shell">[\s\S]*<section className="chat-main">[\s\S]*<section className="message-thread" id="message-thread-scroll">[\s\S]*<ThreadComposerRuntime/,
  );
});

test('settings surface keeps stacked shell structure and editable top-row alignment seams', () => {
  const settingsPageSource = readWorkspaceFile('app/(app)/settings/page.tsx');
  const profileSettingsFormSource = readWorkspaceFile(
    'app/(app)/settings/profile-settings-form.tsx',
  );
  const profileStatusFormSource = readWorkspaceFile(
    'app/(app)/settings/profile-status-form.tsx',
  );

  assert.match(
    settingsPageSource,
    /<section className="settings-screen settings-shell settings-layout">/,
  );
  assert.match(
    settingsPageSource,
    /<div className="stack settings-main-content">/,
  );
  assert.match(
    settingsPageSource,
    /<div className="settings-space-summary">[\s\S]*settings-space-copy[\s\S]*settings-space-switch/,
  );
  assert.match(
    settingsPageSource,
    /<div className="settings-bottom-actions">/,
  );
  assert.match(
    profileSettingsFormSource,
    /<div className="profile-inline-shell">[\s\S]*<div className="profile-inline-top-row">[\s\S]*<div className="profile-inline-main">[\s\S]*<div className="profile-inline-actions profile-inline-actions-top-row">/,
  );
  assert.match(
    profileStatusFormSource,
    /<div className="profile-status-top-row">[\s\S]*<div className="profile-inline-actions profile-inline-actions-top-row">/,
  );
});
