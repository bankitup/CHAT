import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const workspaceRoot = resolve(import.meta.dirname, '..', '..');

function readWorkspaceFile(relativePath: string) {
  return readFileSync(resolve(workspaceRoot, relativePath), 'utf8');
}

test('shell posture resolver keeps Messenger and KeepCozy nav contracts distinct', () => {
  const shellSource = readWorkspaceFile('src/modules/spaces/shell.ts');

  assert.match(
    shellSource,
    /export type AppProductPosture = 'messenger' \| 'keepcozy'/,
  );
  assert.match(
    shellSource,
    /if \(isMessengerProductPosture\(input\.activeSpace\.productPosture\)\)/,
  );
  assert.match(
    shellSource,
    /key: 'home'[\s\S]*key: 'chats'[\s\S]*key: 'activity'/,
  );
  assert.match(
    shellSource,
    /key: 'home'[\s\S]*key: 'rooms'[\s\S]*key: 'issues'[\s\S]*key: 'tasks'[\s\S]*key: 'activity'/,
  );
});

test('route groups resolve product posture from shared shell helpers instead of raw profile branching', () => {
  const inboxPageSource = readWorkspaceFile('app/(app)/inbox/page.tsx');
  const inboxLoaderSource = readWorkspaceFile(
    'src/modules/messaging/server/inbox-page.ts',
  );
  const homePageSource = readWorkspaceFile('app/(app)/home/page.tsx');

  assert.match(
    inboxPageSource,
    /loadMessengerInboxPageData/,
  );
  assert.match(
    inboxLoaderSource,
    /productAccess\.messenger\.isPrimaryProfile/,
  );
  assert.match(homePageSource, /resolveSpaceProductPosture\(activeSpace\.profile\)/);
  assert.doesNotMatch(
    inboxLoaderSource,
    /profile === 'messenger_full'|profile === 'keepcozy_ops'/,
  );
});
