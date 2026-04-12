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

  assert.ok(readWorkspaceLineCount('src/modules/messaging/data/server.ts') <= 4000);
  assert.match(
    serverSource,
    /export \{[\s\S]*getInboxConversations[\s\S]*\} from ['"]\.\/conversation-read-server['"]/,
  );
  assert.match(
    serverSource,
    /export \{[\s\S]*findExistingActiveDmConversation[\s\S]*\} from ['"]\.\/conversation-lifecycle-server['"]/,
  );
  assert.match(
    serverSource,
    /export \{[\s\S]*getConversationHistorySnapshot[\s\S]*\} from ['"]\.\/thread-read-server['"]/,
  );
  assert.match(
    serverSource,
    /export \{[\s\S]*resolveConversationAttachmentSignedUrl[\s\S]*\} from ['"]\.\/thread-read-server['"]/,
  );
  assert.match(
    serverSource,
    /export \{[\s\S]*CHAT_ATTACHMENT_ACCEPT[\s\S]*\} from ['"]\.\/message-attachment-policy['"]/,
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
  assert.match(threadLoaderSource, /message-attachment-policy/);
  assert.doesNotMatch(
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

test('messenger actions and attachment routes prefer narrowed lifecycle and attachment seams', () => {
  const inboxActionsSource = readWorkspaceFile('app/(app)/inbox/actions.ts');
  const chatActionsSource = readWorkspaceFile(
    'app/(app)/chat/[conversationId]/actions.ts',
  );
  const attachmentContentRouteSource = readWorkspaceFile(
    'app/api/messaging/conversations/[conversationId]/messages/[messageId]/attachments/[attachmentId]/content/route.ts',
  );
  const attachmentSignedUrlRouteSource = readWorkspaceFile(
    'app/api/messaging/conversations/[conversationId]/messages/[messageId]/attachments/[attachmentId]/signed-url/route.ts',
  );
  const createTargetsRouteSource = readWorkspaceFile(
    'app/api/messaging/inbox/create-targets/route.ts',
  );
  const threadPageContentSource = readWorkspaceFile(
    'app/(app)/chat/[conversationId]/thread-page-content.tsx',
  );

  assert.match(inboxActionsSource, /conversation-lifecycle-server/);
  assert.match(inboxActionsSource, /thread-read-server/);
  assert.doesNotMatch(
    inboxActionsSource,
    /from ['"]@\/modules\/messaging\/data\/server['"]/,
  );

  assert.match(chatActionsSource, /conversation-lifecycle-server/);
  assert.match(chatActionsSource, /conversation-read-server/);
  assert.match(chatActionsSource, /conversation-admin-server/);
  assert.match(chatActionsSource, /message-attachment-policy/);
  assert.match(chatActionsSource, /reactions-server/);

  assert.match(attachmentContentRouteSource, /conversation-lifecycle-server/);
  assert.doesNotMatch(
    attachmentContentRouteSource,
    /from ['"]@\/modules\/messaging\/data\/server['"]/,
  );

  assert.match(attachmentSignedUrlRouteSource, /conversation-lifecycle-server/);
  assert.doesNotMatch(
    attachmentSignedUrlRouteSource,
    /from ['"]@\/modules\/messaging\/data\/server['"]/,
  );

  assert.match(createTargetsRouteSource, /conversation-lifecycle-server/);
  assert.doesNotMatch(
    createTargetsRouteSource,
    /from ['"]@\/modules\/messaging\/data\/server['"]/,
  );

  assert.match(threadPageContentSource, /message-attachment-policy/);
  assert.doesNotMatch(
    threadPageContentSource,
    /from ['"]@\/modules\/messaging\/data\/server['"]/,
  );
});
