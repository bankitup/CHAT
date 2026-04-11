import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const workspaceRoot = resolve(import.meta.dirname, '..', '..');

function readWorkspaceFile(relativePath: string) {
  return readFileSync(resolve(workspaceRoot, relativePath), 'utf8');
}

test('keepcozy messaging adapter stays independent from Messenger route files', () => {
  const adapterSource = readWorkspaceFile(
    'src/modules/keepcozy/messaging-adapter.ts',
  );

  assert.match(
    adapterSource,
    /from ['"]@\/modules\/messaging\/server\//,
  );
  assert.doesNotMatch(
    adapterSource,
    /from ['"].*app\/\(app\)\/(inbox|chat)\//,
  );
  assert.doesNotMatch(adapterSource, /from ['"]\.\.\/\.\.\/app\//);
  assert.doesNotMatch(
    adapterSource,
    /from ['"]@\/modules\/messaging\/data\/server['"]/,
  );
  assert.doesNotMatch(
    adapterSource,
    /from ['"]@\/modules\/messaging\/data\/conversation-thread-context['"]/,
  );
  assert.doesNotMatch(
    adapterSource,
    /from ['"]@\/modules\/messaging\/ui\//,
  );
  assert.doesNotMatch(
    adapterSource,
    /from ['"]@\/modules\/spaces\/server['"]/,
  );
  assert.doesNotMatch(
    adapterSource,
    /from ['"]@\/modules\/messaging\/server\/(thread-page|thread-settings-page|inbox-page|settings-page)['"]/,
  );
});

test('keepcozy activity route consumes the bounded messaging adapter instead of raw Messenger data wiring', () => {
  const activityPageSource = readWorkspaceFile('app/(app)/activity/page.tsx');

  assert.match(
    activityPageSource,
    /from ['"]@\/modules\/keepcozy\/messaging-adapter['"]/,
  );
  assert.doesNotMatch(
    activityPageSource,
    /from ['"]@\/modules\/messaging\/data\/server['"]/,
  );
});

test('messenger inbox route consumes the shared messaging route-context seam through its page loader', () => {
  const inboxPageSource = readWorkspaceFile('app/(app)/inbox/page.tsx');
  const inboxLoaderSource = readWorkspaceFile(
    'src/modules/messaging/server/inbox-page.ts',
  );

  assert.match(
    inboxPageSource,
    /loadMessengerInboxPageData/,
  );
  assert.match(
    inboxLoaderSource,
    /resolveMessagingRouteSpaceContextForUser/,
  );
  assert.doesNotMatch(
    inboxLoaderSource,
    /from ['"]@\/modules\/spaces\/server['"]/,
  );
});

test('keepcozy adapter only consumes the bounded messaging server seams it is allowed to compose', () => {
  const adapterSource = readWorkspaceFile(
    'src/modules/keepcozy/messaging-adapter.ts',
  );

  assert.match(
    adapterSource,
    /from ['"]@\/modules\/messaging\/server\/operational-activity['"]/,
  );
  assert.match(
    adapterSource,
    /from ['"]@\/modules\/messaging\/server\/operational-thread-context['"]/,
  );
  assert.match(
    adapterSource,
    /from ['"]@\/modules\/messaging\/server\/route-context['"]/,
  );
});
