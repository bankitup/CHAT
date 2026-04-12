import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const workspaceRoot = resolve(import.meta.dirname, '..', '..');

function readWorkspaceFile(relativePath: string) {
  return readFileSync(resolve(workspaceRoot, relativePath), 'utf8');
}

function readWorkspaceLineCount(relativePath: string) {
  return readWorkspaceFile(relativePath).split('\n').length;
}

test('hot Messenger client surfaces stay on route-scoped i18n seams instead of broad shared dictionaries', () => {
  const shellFrameSource = readWorkspaceFile('app/(app)/app-shell-frame.tsx');
  const inboxContentSource = readWorkspaceFile(
    'app/(app)/inbox/inbox-filterable-content.tsx',
  );
  const inboxCreateRuntimeSource = readWorkspaceFile(
    'app/(app)/inbox/inbox-create-sheet-runtime.tsx',
  );
  const newChatSheetSource = readWorkspaceFile(
    'app/(app)/inbox/new-chat-sheet.tsx',
  );
  const viewportSource = readWorkspaceFile(
    'app/(app)/chat/[conversationId]/thread-history-viewport.tsx',
  );
  const rowSource = readWorkspaceFile(
    'app/(app)/chat/[conversationId]/thread-message-row.tsx',
  );
  const rowContentSource = readWorkspaceFile(
    'app/(app)/chat/[conversationId]/thread-message-row-content.tsx',
  );
  const composerRuntimeSource = readWorkspaceFile(
    'app/(app)/chat/[conversationId]/thread-composer-runtime.tsx',
  );
  const voiceBubbleSource = readWorkspaceFile(
    'app/(app)/chat/[conversationId]/thread-voice-message-bubble.tsx',
  );
  const thinClientFacadeSource = readWorkspaceFile('src/modules/i18n/client.ts');

  assert.match(
    shellFrameSource,
    /from ['"]@\/modules\/i18n\/client-shell['"]/,
  );
  assert.match(
    inboxContentSource,
    /from ['"]@\/modules\/i18n\/client-inbox['"]/,
  );
  assert.match(
    inboxCreateRuntimeSource,
    /from ['"]@\/modules\/i18n\/client-inbox['"]/,
  );
  assert.match(
    newChatSheetSource,
    /from ['"]@\/modules\/i18n\/client-inbox['"]/,
  );
  assert.match(
    viewportSource,
    /from ['"]@\/modules\/i18n\/client-chat['"]/,
  );
  assert.match(
    viewportSource,
    /from ['"]@\/modules\/i18n\/client-shared['"]/,
  );
  assert.match(
    rowSource,
    /from ['"]@\/modules\/i18n\/client-chat['"]/,
  );
  assert.match(
    rowSource,
    /from ['"]@\/modules\/i18n\/client-shared['"]/,
  );
  assert.match(
    rowContentSource,
    /from ['"]@\/modules\/i18n\/client-chat['"]/,
  );
  assert.match(
    composerRuntimeSource,
    /from ['"]@\/modules\/i18n\/client-chat['"]/,
  );
  assert.match(
    voiceBubbleSource,
    /from ['"]@\/modules\/i18n\/client-chat['"]/,
  );

  for (const source of [
    shellFrameSource,
    inboxContentSource,
    inboxCreateRuntimeSource,
    newChatSheetSource,
    viewportSource,
    rowSource,
    rowContentSource,
    composerRuntimeSource,
    voiceBubbleSource,
  ]) {
    assert.doesNotMatch(
      source,
      /from ['"]@\/modules\/i18n(?:\/index)?['"]|from ['"]@\/modules\/i18n\/client['"]/,
    );
  }

  assert.match(
    thinClientFacadeSource,
    /export \{[\s\S]*getShellClientTranslations[\s\S]*\} from ['"]\.\/client-shell['"]/,
  );
  assert.match(
    thinClientFacadeSource,
    /export \{[\s\S]*getChatClientTranslations[\s\S]*\} from ['"]\.\/client-chat['"]/,
  );
  assert.match(
    thinClientFacadeSource,
    /export \{[\s\S]*getInboxClientTranslations[\s\S]*\} from ['"]\.\/client-inbox['"]/,
  );
});

test('Messenger route styling stays route-local instead of regrowing into app/globals.css', () => {
  const rootLayoutSource = readWorkspaceFile('app/layout.tsx');
  const inboxLayoutSource = readWorkspaceFile('app/(app)/inbox/layout.tsx');
  const chatLayoutSource = readWorkspaceFile(
    'app/(app)/chat/[conversationId]/layout.tsx',
  );
  const globalsCssSource = readWorkspaceFile('app/globals.css');
  const messengerRouteCssSource = readWorkspaceFile(
    'app/(app)/messenger-route.css',
  );

  assert.match(rootLayoutSource, /import ['"]\.\/globals\.css['"]/);
  assert.doesNotMatch(rootLayoutSource, /messenger-route\.css/);

  assert.match(
    inboxLayoutSource,
    /import ['"]\.\.\/messenger-route\.css['"]/,
  );
  assert.match(
    chatLayoutSource,
    /import ['"]\.\.\/\.\.\/messenger-route\.css['"]/,
  );

  assert.doesNotMatch(
    globalsCssSource,
    /^\.(?:chat-main|composer-card|message-voice-card|conversation-card|conversation-row|chat-image-preview-overlay)\s*\{/m,
  );

  assert.match(
    messengerRouteCssSource,
    /^\.(?:chat-main|composer-card|message-voice-card|conversation-card|conversation-row|chat-image-preview-overlay)\s*\{/m,
  );
});

test('current global-weight hot spots stay under the agreed lightweight size caps', () => {
  assert.ok(readWorkspaceLineCount('src/modules/i18n/client.ts') <= 40);
  assert.ok(readWorkspaceLineCount('src/modules/i18n/client-chat.ts') <= 380);
  assert.ok(readWorkspaceLineCount('src/modules/i18n/client-inbox.ts') <= 330);
  assert.ok(readWorkspaceLineCount('src/modules/i18n/client-shell.ts') <= 90);
  assert.ok(
    readWorkspaceLineCount('app/(app)/chat/[conversationId]/thread-history-viewport.tsx') <=
      2625,
  );
  assert.ok(
    readWorkspaceLineCount('app/(app)/chat/[conversationId]/thread-message-row.tsx') <=
      2300,
  );
  assert.ok(
    readWorkspaceLineCount('app/(app)/inbox/inbox-filterable-content.tsx') <=
      700,
  );
  assert.ok(readWorkspaceLineCount('src/modules/messaging/data/server.ts') <= 4000);
  assert.ok(readWorkspaceLineCount('app/globals.css') <= 5800);
  assert.ok(readWorkspaceLineCount('app/(app)/messenger-route.css') <= 4700);
});
