import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const workspaceRoot = resolve(import.meta.dirname, '..', '..');

function readWorkspaceFile(relativePath: string) {
  return readFileSync(resolve(workspaceRoot, relativePath), 'utf8');
}

test('shell posture resolver keeps Messenger and KeepCozy nav contracts distinct', () => {
  const shellStateSource = readWorkspaceFile('src/modules/app-shell/state.ts');
  const shellPostureSource = readWorkspaceFile(
    'src/modules/app-shell/space-posture.ts',
  );
  const spacesShellSource = readWorkspaceFile('src/modules/spaces/shell.ts');

  assert.match(
    shellPostureSource,
    /export type AppProductPosture = 'messenger' \| 'keepcozy'/,
  );
  assert.match(
    shellStateSource,
    /const activeProductPosture = input\.activeSpace[\s\S]*resolveSpaceProductPosture\(input\.activeSpace\.profile\)/,
  );
  assert.match(
    shellStateSource,
    /if \(isMessengerProductPosture\(activeProductPosture\)\)/,
  );
  assert.match(
    shellStateSource,
    /key: 'home'[\s\S]*key: 'chats'[\s\S]*key: 'activity'/,
  );
  assert.match(
    shellStateSource,
    /key: 'home'[\s\S]*key: 'rooms'[\s\S]*key: 'issues'[\s\S]*key: 'tasks'[\s\S]*key: 'activity'/,
  );
  assert.match(
    spacesShellSource,
    /from ['"]\.\.\/app-shell\/state['"]/,
  );
  assert.match(
    spacesShellSource,
    /from ['"]\.\.\/app-shell\/space-posture['"]/,
  );
});

test('route groups resolve product posture from shared shell helpers instead of raw profile branching', () => {
  const inboxPageSource = readWorkspaceFile('app/(app)/inbox/page.tsx');
  const inboxLoaderSource = readWorkspaceFile(
    'src/modules/messaging/server/inbox-page.ts',
  );
  const homePageSource = readWorkspaceFile('app/(app)/home/page.tsx');
  const activityPageSource = readWorkspaceFile('app/(app)/activity/page.tsx');
  const layoutSource = readWorkspaceFile('app/(app)/layout.tsx');

  assert.match(
    inboxPageSource,
    /loadMessengerInboxPageData/,
  );
  assert.match(
    inboxLoaderSource,
    /productAccess\.messenger\.isPrimaryProfile/,
  );
  assert.match(homePageSource, /resolveSpaceProductPosture\(activeSpace\.profile\)/);
  assert.match(
    homePageSource,
    /from ['"]@\/modules\/app-shell\/space-posture['"]/,
  );
  assert.match(
    activityPageSource,
    /from ['"]@\/modules\/app-shell\/space-posture['"]/,
  );
  assert.match(
    layoutSource,
    /from ['"]@\/modules\/app-shell\/state['"]/,
  );
  assert.doesNotMatch(
    inboxLoaderSource,
    /profile === 'messenger_full'|profile === 'keepcozy_ops'/,
  );
});
