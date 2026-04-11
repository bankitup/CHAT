import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const workspaceRoot = resolve(import.meta.dirname, '..', '..');

function readWorkspaceFile(relativePath: string) {
  return readFileSync(resolve(workspaceRoot, relativePath), 'utf8');
}

const messagingServerFiles = [
  'src/modules/messaging/server/route-context.ts',
  'src/modules/messaging/server/inbox-page.ts',
  'src/modules/messaging/server/thread-page.ts',
  'src/modules/messaging/server/settings-page.ts',
  'src/modules/messaging/server/thread-settings-page.ts',
  'src/modules/messaging/server/operational-activity.ts',
  'src/modules/messaging/server/operational-thread-context.ts',
] as const;

test('messaging server seams stay independent from app route files and KeepCozy product code', () => {
  for (const relativePath of messagingServerFiles) {
    const source = readWorkspaceFile(relativePath);

    assert.doesNotMatch(
      source,
      /from ['"].*app\/\(app\)\//,
      relativePath,
    );
    assert.doesNotMatch(
      source,
      /from ['"]@\/modules\/keepcozy\//,
      relativePath,
    );
  }
});

test('messenger product loaders keep canonical access resolution in shared route-context helpers', () => {
  const inboxLoaderSource = readWorkspaceFile(
    'src/modules/messaging/server/inbox-page.ts',
  );
  const threadLoaderSource = readWorkspaceFile(
    'src/modules/messaging/server/thread-page.ts',
  );
  const threadSettingsLoaderSource = readWorkspaceFile(
    'src/modules/messaging/server/thread-settings-page.ts',
  );

  assert.match(
    inboxLoaderSource,
    /resolveMessagingRouteSpaceContextForUser/,
  );
  assert.match(
    threadLoaderSource,
    /resolveMessagingConversationRouteContextForUser/,
  );
  assert.match(
    threadSettingsLoaderSource,
    /resolveMessagingConversationRouteContextForUser/,
  );
});

test('operational messaging seams stay capability-scoped instead of depending on Messenger page loaders', () => {
  const operationalActivitySource = readWorkspaceFile(
    'src/modules/messaging/server/operational-activity.ts',
  );
  const operationalThreadContextSource = readWorkspaceFile(
    'src/modules/messaging/server/operational-thread-context.ts',
  );

  for (const source of [operationalActivitySource, operationalThreadContextSource]) {
    assert.doesNotMatch(source, /thread-page|thread-settings-page|inbox-page|settings-page/);
  }
});
