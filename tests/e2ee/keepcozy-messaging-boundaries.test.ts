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
    /from ['"]@\/modules\/messaging\//,
  );
  assert.doesNotMatch(
    adapterSource,
    /from ['"].*app\/\(app\)\/(inbox|chat)\//,
  );
  assert.doesNotMatch(adapterSource, /from ['"]\.\.\/\.\.\/app\//);
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

test('messenger inbox route consumes the shared messaging route-context seam', () => {
  const inboxPageSource = readWorkspaceFile('app/(app)/inbox/page.tsx');

  assert.match(
    inboxPageSource,
    /resolveMessagingRouteSpaceContextForUser/,
  );
  assert.doesNotMatch(
    inboxPageSource,
    /from ['"]@\/modules\/spaces\/server['"]/,
  );
});
