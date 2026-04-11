import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const workspaceRoot = resolve(import.meta.dirname, '..', '..');

function readWorkspaceFile(relativePath: string) {
  return readFileSync(resolve(workspaceRoot, relativePath), 'utf8');
}

test('messenger route pages stay loader-driven instead of importing heavy messaging data helpers directly', () => {
  const inboxPageSource = readWorkspaceFile('app/(app)/inbox/page.tsx');
  const chatPageSource = readWorkspaceFile('app/(app)/chat/[conversationId]/page.tsx');
  const chatSettingsPageSource = readWorkspaceFile(
    'app/(app)/chat/[conversationId]/settings/page.tsx',
  );
  const settingsPageSource = readWorkspaceFile('app/(app)/settings/page.tsx');

  assert.match(inboxPageSource, /loadMessengerInboxPageData/);
  assert.match(chatPageSource, /loadMessengerThreadPageData/);
  assert.match(chatSettingsPageSource, /loadMessengerThreadSettingsPageData/);
  assert.match(settingsPageSource, /loadMessengerSettingsPageData/);

  for (const source of [
    inboxPageSource,
    chatPageSource,
    chatSettingsPageSource,
    settingsPageSource,
  ]) {
    assert.doesNotMatch(
      source,
      /from ['"]@\/modules\/messaging\/data\/server['"]/,
    );
  }
});

test('messenger chat entry route stays composition-light after the thread page split', () => {
  const chatPageSource = readWorkspaceFile('app/(app)/chat/[conversationId]/page.tsx');

  assert.doesNotMatch(chatPageSource, /ThreadHistoryViewport/);
  assert.doesNotMatch(chatPageSource, /ThreadComposerRuntime/);
  assert.doesNotMatch(chatPageSource, /GuardedServerActionForm/);
  assert.doesNotMatch(chatPageSource, /createSupabaseServerClient|getRequestViewer/);
});
