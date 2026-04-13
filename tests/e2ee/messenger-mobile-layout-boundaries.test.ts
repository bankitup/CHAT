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
  const inboxRowContractCssSource = readWorkspaceFile(
    'app/(app)/inbox/inbox-conversation-row-contract.module.css',
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

  assert.match(
    inboxRowContractCssSource,
    /\.card\s*\{[\s\S]*border-bottom:\s*1px solid rgba\(221,\s*226,\s*232,\s*0\.72\)[\s\S]*background:\s*transparent[\s\S]*box-shadow:\s*none/,
  );
  assert.match(
    inboxRowContractCssSource,
    /\.link\s*\{[\s\S]*padding:\s*9px 2px[\s\S]*border-radius:\s*18px[\s\S]*background:\s*transparent/,
  );
  assert.match(
    inboxRowContractCssSource,
    /\.linkUnread\s*\{[\s\S]*linear-gradient\(180deg,\s*rgba\(250,\s*252,\s*255,\s*0\.94\),\s*rgba\(246,\s*249,\s*255,\s*0\.82\)\)[\s\S]*box-shadow:\s*inset 2px 0 0 rgba\(31,\s*111,\s*235,\s*0\.24\)/,
  );
});

test('chat route keeps the mobile shell split between header, message thread, and composer', () => {
  const appShellFrameSource = readWorkspaceFile('app/(app)/app-shell-frame.tsx');
  const threadPageContentSource = readWorkspaceFile(
    'app/(app)/chat/[conversationId]/thread-page-content.tsx',
  );
  const threadMessageRowSource = readWorkspaceFile(
    'app/(app)/chat/[conversationId]/thread-message-row.tsx',
  );
  const threadMessageRowContentSource = readWorkspaceFile(
    'app/(app)/chat/[conversationId]/thread-message-row-content.tsx',
  );
  const plaintextComposerSource = readWorkspaceFile(
    'app/(app)/chat/[conversationId]/plaintext-chat-composer-form.tsx',
  );
  const encryptedComposerSource = readWorkspaceFile(
    'app/(app)/chat/[conversationId]/encrypted-dm-composer-form.tsx',
  );
  const attachmentPickerSource = readWorkspaceFile(
    'app/(app)/chat/[conversationId]/composer-attachment-picker.tsx',
  );
  const threadComposerRuntimeSource = readWorkspaceFile(
    'app/(app)/chat/[conversationId]/thread-composer-runtime.tsx',
  );
  const composerContractCssSource = readWorkspaceFile(
    'app/(app)/chat/[conversationId]/composer-shell-contract.module.css',
  );
  const messengerRouteCssSource = readWorkspaceFile(
    'app/(app)/messenger-route.css',
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
  assert.match(
    messengerRouteCssSource,
    /\.route-loading-inbox-time\s*\{[\s\S]*width:\s*34px[\s\S]*min-height:\s*12px[\s\S]*border-radius:\s*999px[\s\S]*\}\s*\.chat-header-stack\s*\{/,
  );
  assert.match(
    messengerRouteCssSource,
    /\.attachment-native-input\s*\{[\s\S]*display:\s*none[\s\S]*\}/,
  );
  assert.match(
    threadPageContentSource,
    /chat-header-shell[\s\S]*chat-header-back[\s\S]*chat-header-main-link[\s\S]*chat-header-avatar-slot/,
  );
  assert.match(
    messengerRouteCssSource,
    /\.chat-header-main-link\s*\{[\s\S]*display:\s*grid[\s\S]*align-content:\s*center[\s\S]*min-height:\s*var\(--app-chat-header-avatar-size\)/,
  );
  assert.match(
    messengerRouteCssSource,
    /\.chat-header-avatar-slot\s*\{[\s\S]*justify-content:\s*center[\s\S]*width:\s*100%/,
  );
  assert.match(
    messengerRouteCssSource,
    /\.chat-header-back\s*\{[\s\S]*justify-self:\s*center/,
  );
  assert.match(
    messengerRouteCssSource,
    /@keyframes composer-voice-pulse\s*\{[\s\S]*100%\s*\{[\s\S]*box-shadow:\s*0 0 0 0 rgba\(180,\s*35,\s*24,\s*0\)[\s\S]*\}\s*\}\s*@keyframes chat-typing-pulse\s*\{/,
  );
  assert.match(
    threadMessageRowContentSource,
    /className=\{\s*isOwnMessage\s*\?\s*'message-bubble-stack message-bubble-stack-own'\s*:\s*'message-bubble-stack'\s*\}/,
  );
  assert.match(
    threadMessageRowContentSource,
    /message-meta message-meta-own message-meta-attached/,
  );
  assert.match(
    messengerRouteCssSource,
    /\.message-bubble-stack\s*\{[\s\S]*display:\s*grid[\s\S]*width:\s*fit-content[\s\S]*max-width:\s*100%/,
  );
  assert.match(
    messengerRouteCssSource,
    /\.message-row\s*\{[\s\S]*width:\s*100%[\s\S]*display:\s*flex[\s\S]*min-width:\s*0/,
  );
  assert.match(
    messengerRouteCssSource,
    /\.message-card\s*\{[\s\S]*width:\s*min\(100%,\s*350px\)[\s\S]*min-width:\s*0[\s\S]*max-width:\s*100%/,
  );
  assert.match(
    messengerRouteCssSource,
    /\.message-meta-attached\s*\{[\s\S]*max-width:\s*100%/,
  );
  assert.match(
    messengerRouteCssSource,
    /\.message-voice-stack\s*\{[\s\S]*display:\s*grid[\s\S]*gap:\s*7px[\s\S]*min-width:\s*0/,
  );
  assert.doesNotMatch(
    threadMessageRowSource,
    /!\s*canInlineMessageMeta\s*\?\s*\(\s*<span[\s\S]*message-meta message-meta-own/,
  );
  for (const source of [plaintextComposerSource, encryptedComposerSource]) {
    assert.match(
      source,
      /from ['"]\.\/composer-shell-contract\.module\.css['"]/,
    );
    assert.match(
      source,
      /<div className=\{joinClassNames\(\[styles\.inputShell,\s*'composer-input-shell'\]\)\}>[\s\S]*<ComposerAttachmentPicker[\s\S]*<label[\s\S]*composer-input-field[\s\S]*<div[\s\S]*composer-action-cluster/,
    );
    assert.match(
      source,
      /<ComposerAttachmentPicker[\s\S]*className="button button-secondary composer-button composer-button-mic"[\s\S]*aria-label=\{t\.chat\.sendMessage\}[\s\S]*type="submit"/,
    );
    assert.match(
      source,
      /className=\{joinClassNames\(\[styles\.form,\s*'stack',\s*'composer-form'\]\)\}/,
    );
    assert.match(
      source,
      /className=\{joinClassNames\(\[styles\.inputShell,\s*'composer-input-shell'\]\)\}/,
    );
    assert.match(
      source,
      /className=\{joinClassNames\(\[styles\.field,\s*'field',\s*'composer-input-field'\]\)\}/,
    );
    assert.match(
      source,
      /className=\{joinClassNames\(\[styles\.actions,\s*'composer-action-cluster'\]\)\}/,
    );
  }
  assert.match(
    attachmentPickerSource,
    /from ['"]\.\/composer-shell-contract\.module\.css['"]/,
  );
  assert.match(
    attachmentPickerSource,
    /styles\.attachmentDetails/,
  );
  assert.match(
    attachmentPickerSource,
    /styles\.selectedCard/,
  );
  assert.match(
    attachmentPickerSource,
    /styles\.nativeInput/,
  );
  assert.match(
    attachmentPickerSource,
    /style=\{\{\s*display:\s*'none'\s*\}\}/,
  );
  assert.match(
    attachmentPickerSource,
    /tabIndex=\{-1\}/,
  );
  assert.match(
    threadComposerRuntimeSource,
    /from ['"]\.\/composer-shell-contract\.module\.css['"]/,
  );
  assert.match(
    threadComposerRuntimeSource,
    /composer-runtime-shell \$\{styles\.runtimeShell\}/,
  );
  assert.match(
    composerContractCssSource,
    /\.inputShell\s*\{[\s\S]*grid-template-columns:\s*auto minmax\(0,\s*1fr\) auto/,
  );
  assert.match(
    composerContractCssSource,
    /\.nativeInput\s*\{[\s\S]*display:\s*none !important/,
  );
  assert.match(
    messengerRouteCssSource,
    /\.composer-action-cluster\s*\{[\s\S]*display:\s*inline-flex[\s\S]*min-width:\s*max-content/,
  );
});

test('bottom nav keeps a compact mobile shell with bounded links and labels', () => {
  const appShellFrameSource = readWorkspaceFile('app/(app)/app-shell-frame.tsx');
  const globalsSource = readWorkspaceFile('app/globals.css');

  assert.match(
    appShellFrameSource,
    /<nav[\s\S]*className=\{[\s\S]*'app-bottom-nav app-bottom-nav-messenger'[\s\S]*<div[\s\S]*'app-bottom-nav-shell app-bottom-nav-shell-messenger'[\s\S]*<Link[\s\S]*<span className="app-bottom-nav-label">/,
  );
  assert.match(
    globalsSource,
    /\.app-bottom-nav\s*\{[\s\S]*width:\s*min\(calc\(100% - 16px\),\s*var\(--app-shell-bottom-nav-max-width\)\)/,
  );
  assert.match(
    globalsSource,
    /\.app-bottom-nav-shell\s*\{[\s\S]*width:\s*100%[\s\S]*box-sizing:\s*border-box/,
  );
  assert.match(
    globalsSource,
    /\.app-bottom-nav-shell-messenger\s*\{[\s\S]*width:\s*100%[\s\S]*min-width:\s*0/,
  );
  assert.match(
    globalsSource,
    /\.app-bottom-nav-link\s*\{[\s\S]*width:\s*100%[\s\S]*min-width:\s*0/,
  );
  assert.match(
    globalsSource,
    /\.app-bottom-nav-label\s*\{[\s\S]*overflow:\s*hidden[\s\S]*text-overflow:\s*ellipsis[\s\S]*white-space:\s*nowrap/,
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
  const globalsSource = readWorkspaceFile('app/globals.css');
  assert.match(
    globalsSource,
    /\.settings-space-summary\s*\{[\s\S]*min-width:\s*0/,
  );
  assert.match(
    globalsSource,
    /\.settings-capability-row\s*\{[\s\S]*min-width:\s*0/,
  );
  assert.match(
    globalsSource,
    /\.settings-capability-value\s*\{[\s\S]*min-width:\s*0[\s\S]*max-width:\s*100%[\s\S]*overflow-wrap:\s*anywhere/,
  );
  assert.match(
    globalsSource,
    /\.settings-bottom-actions\s*\{[\s\S]*position:\s*sticky[\s\S]*min-width:\s*0/,
  );
});
