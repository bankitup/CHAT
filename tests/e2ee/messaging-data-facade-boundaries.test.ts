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

test('messaging data facade stays materially smaller and re-exports narrowed read seams', () => {
  const serverSource = readWorkspaceFile('src/modules/messaging/data/server.ts');

  assert.ok(
    readWorkspaceLineCount('src/modules/messaging/data/server.ts') <= 5600,
  );
  assert.match(
    serverSource,
    /export \{[\s\S]*getInboxConversations[\s\S]*\} from ['"]\.\/conversation-read-server['"]/,
  );
  assert.match(
    serverSource,
    /export \{[\s\S]*getConversationHistorySnapshot[\s\S]*\} from ['"]\.\/thread-read-server['"]/,
  );
  assert.match(
    serverSource,
    /export \{[\s\S]*resolveConversationAttachmentSignedUrl[\s\S]*\} from ['"]\.\/thread-read-server['"]/,
  );
});

test('messenger route loaders prefer narrowed read modules over the kitchen-sink data facade', () => {
  const inboxLoaderSource = readWorkspaceFile(
    'src/modules/messaging/server/inbox-page.ts',
  );
  const threadLoaderSource = readWorkspaceFile(
    'src/modules/messaging/server/thread-page.ts',
  );
  const threadSettingsLoaderSource = readWorkspaceFile(
    'src/modules/messaging/server/thread-settings-page.ts',
  );
  const routeContextSource = readWorkspaceFile(
    'src/modules/messaging/server/route-context.ts',
  );
  const operationalActivitySource = readWorkspaceFile(
    'src/modules/messaging/server/operational-activity.ts',
  );

  assert.match(inboxLoaderSource, /conversation-read-server/);
  assert.doesNotMatch(inboxLoaderSource, /from ['"]@\/modules\/messaging\/data\/server['"]/);

  assert.match(threadLoaderSource, /conversation-read-server/);
  assert.match(threadLoaderSource, /thread-read-server/);
  assert.match(
    threadLoaderSource,
    /from ['"]@\/modules\/messaging\/data\/server['"]/,
  );
  assert.match(threadLoaderSource, /CHAT_ATTACHMENT_HELP_TEXT/);

  assert.match(threadSettingsLoaderSource, /conversation-read-server/);
  assert.doesNotMatch(
    threadSettingsLoaderSource,
    /from ['"]@\/modules\/messaging\/data\/server['"]/,
  );

  assert.match(routeContextSource, /conversation-read-server/);
  assert.doesNotMatch(
    routeContextSource,
    /from ['"]@\/modules\/messaging\/data\/server['"]/,
  );

  assert.match(operationalActivitySource, /conversation-read-server/);
  assert.doesNotMatch(
    operationalActivitySource,
    /from ['"]@\/modules\/messaging\/data\/server['"]/,
  );
});
