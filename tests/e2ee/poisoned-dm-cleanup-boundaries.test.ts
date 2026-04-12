import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const workspaceRoot = resolve(import.meta.dirname, '..', '..');

function readWorkspaceFile(relativePath: string) {
  return readFileSync(resolve(workspaceRoot, relativePath), 'utf8');
}

function extractFunctionBlock(source: string, functionName: string) {
  const match = source.match(
    new RegExp(
      `export async function ${functionName}\\(formData: FormData\\) \\{[\\s\\S]*?\\n\\}`,
    ),
  );

  assert.ok(match, `Expected to find ${functionName} in source.`);

  return match[0];
}

test('direct-chat delete action uses the full poisoned-DM cleanup helper instead of hide-only inbox removal', () => {
  const actionsSource = readWorkspaceFile(
    'app/(app)/chat/[conversationId]/actions.ts',
  );
  const deleteConfirmFormSource = readWorkspaceFile(
    'app/(app)/chat/[conversationId]/dm-chat-delete-confirm-form.tsx',
  );

  assert.match(
    actionsSource,
    /deleteDirectConversationForUser,/,
  );
  assert.match(
    actionsSource,
    /export async function hideConversationAction\(formData: FormData\) \{[\s\S]*await hideConversationForUser\(\{/,
  );
  assert.match(
    actionsSource,
    /export async function deleteDirectConversationAction\(formData: FormData\) \{[\s\S]*await deleteDirectConversationForUser\(\{/,
  );
  assert.match(
    actionsSource,
    /const deleteMode = String\(formData\.get\('deleteMode'\) \?\? ''\)\.trim\(\);/,
  );
  assert.match(
    actionsSource,
    /if \(deleteMode !== 'hard-delete-direct-chat'\)/,
  );
  assert.doesNotMatch(
    actionsSource,
    /export async function deleteDirectConversationAction\(formData: FormData\) \{[\s\S]*await hideConversationForUser\(\{/,
  );
  assert.match(
    deleteConfirmFormSource,
    /<input name="deleteMode" type="hidden" value="hard-delete-direct-chat" \/>/,
  );
});

test('ordinary hide action stays inbox-only and cannot drift into the poisoned-DM hard-delete path', () => {
  const actionsSource = readWorkspaceFile(
    'app/(app)/chat/[conversationId]/actions.ts',
  );
  const hideConversationActionSource = extractFunctionBlock(
    actionsSource,
    'hideConversationAction',
  );

  assert.match(
    hideConversationActionSource,
    /await hideConversationForUser\(\{/,
  );
  assert.doesNotMatch(
    hideConversationActionSource,
    /deleteDirectConversationForUser\(\{/,
  );
  assert.doesNotMatch(
    hideConversationActionSource,
    /deleteMode/,
  );
});

test('full poisoned-DM cleanup helper clears media metadata before deleting the conversation row', () => {
  const dataSource = readWorkspaceFile('src/modules/messaging/data/server.ts');

  assert.match(
    dataSource,
    /export async function deleteDirectConversationForUser\(input: \{/,
  );
  assert.match(
    dataSource,
    /\.from\('message_reactions'\)\s*\.delete\(\)/,
  );
  assert.match(
    dataSource,
    /\.from\('message_attachments'\)\s*\.delete\(\)/,
  );
  assert.match(
    dataSource,
    /\.from\('message_e2ee_envelopes'\)\s*\.delete\(\)/,
  );
  assert.match(
    dataSource,
    /\.from\('message_asset_links'\)\s*\.delete\(\)/,
  );
  assert.match(
    dataSource,
    /\.from\('message_assets'\)\s*\.delete\(\)/,
  );
  assert.match(
    dataSource,
    /\.from\('messages'\)\s*\.delete\(\)/,
  );
  assert.match(
    dataSource,
    /\.from\('conversation_members'\)\s*\.delete\(\)/,
  );
  assert.match(
    dataSource,
    /\.from\('conversations'\)\s*\.delete\(\)/,
  );
});

test('DM settings keep ordinary hide-from-inbox behavior separate from explicit poisoned-DM hard delete', () => {
  const overlaySettingsSource = readWorkspaceFile(
    'app/(app)/chat/[conversationId]/thread-page-content.tsx',
  );
  const routeSettingsSource = readWorkspaceFile(
    'app/(app)/chat/[conversationId]/settings/page.tsx',
  );

  assert.match(
    overlaySettingsSource,
    /<GuardedServerActionForm action=\{hideConversationAction\}>[\s\S]*\{t\.chat\.hideFromInbox\}/,
  );
  assert.match(
    overlaySettingsSource,
    /<DmChatDeleteConfirmForm[\s\S]*confirmButtonLabel=\{t\.chat\.deleteChatConfirmButton\}/,
  );
  assert.match(
    overlaySettingsSource,
    /t\.chat\.inboxNote/,
  );
  assert.match(
    overlaySettingsSource,
    /t\.chat\.deleteChatCurrentUserOnlyNote/,
  );

  assert.match(
    routeSettingsSource,
    /<GuardedServerActionForm action=\{hideConversationAction\}>[\s\S]*\{data\.t\.chat\.hideFromInbox\}/,
  );
  assert.match(
    routeSettingsSource,
    /<DmChatDeleteConfirmForm[\s\S]*confirmButtonLabel=\{data\.t\.chat\.deleteChatConfirmButton\}/,
  );
  assert.match(
    routeSettingsSource,
    /data\.t\.chat\.inboxNote/,
  );
  assert.match(
    routeSettingsSource,
    /data\.t\.chat\.deleteChatCurrentUserOnlyNote/,
  );
});

test('DM recreation still reuses only an existing active conversation, so a deleted poisoned DM will recreate cleanly', () => {
  const inboxActionsSource = readWorkspaceFile('app/(app)/inbox/actions.ts');
  const dataSource = readWorkspaceFile('src/modules/messaging/data/server.ts');
  const threadReadServerSource = readWorkspaceFile(
    'src/modules/messaging/data/thread-read-server.ts',
  );
  const createDmActionSource = extractFunctionBlock(
    inboxActionsSource,
    'createDmAction',
  );

  assert.match(
    inboxActionsSource,
    /const existingConversationId = await findExistingActiveDmConversation\(/,
  );
  assert.match(
    inboxActionsSource,
    /isExistingDmConversationConflictError,/,
  );
  assert.match(
    inboxActionsSource,
    /getConversationAutoRestoreHealthForUser,/,
  );
  assert.match(
    inboxActionsSource,
    /async function resolveExistingDmAutoRestoreOrThrow\(input: \{/,
  );
  assert.match(
    inboxActionsSource,
    /async function redirectToExistingDmConversation\(input: \{[\s\S]*await restoreConversationForUser\(\{/,
  );
  assert.match(
    inboxActionsSource,
    /const autoRestoreHealth = await getConversationAutoRestoreHealthForUser\(/,
  );
  assert.match(
    inboxActionsSource,
    /if \(autoRestoreHealth\.status === 'blocked'\) \{[\s\S]*explicit recovery before it can be reopened automatically/,
  );
  assert.match(
    inboxActionsSource,
    /if \(existingConversationId\) \{[\s\S]*await resolveExistingDmAutoRestoreOrThrow\(/,
  );
  assert.match(
    createDmActionSource,
    /const conversationId = await createConversationWithMembers\(\{[\s\S]*kind: 'dm'[\s\S]*\}, \{\s*existingDmBehavior: 'throw-conflict',\s*\}\);/,
  );
  assert.match(
    createDmActionSource,
    /if \(isExistingDmConversationConflictError\(error\)\) \{[\s\S]*await resolveExistingDmAutoRestoreOrThrow\(\{[\s\S]*conversationId: error\.conversationId,/,
  );
  assert.doesNotMatch(
    createDmActionSource,
    /restoreConversationForUser\(/,
  );
  assert.match(
    dataSource,
    /existingDmBehavior\?: 'reuse-existing' \| 'throw-conflict';/,
  );
  assert.match(
    dataSource,
    /if \(existingConversationId\) \{[\s\S]*if \(existingDmBehavior === 'throw-conflict'\) \{[\s\S]*throw createExistingDmConversationConflictError\(existingConversationId\);[\s\S]*\}[\s\S]*return existingConversationId;/,
  );
  assert.match(
    dataSource,
    /export function isExistingDmConversationConflictError\(/,
  );
  assert.match(
    threadReadServerSource,
    /export async function getConversationAutoRestoreHealthForUser\(input: \{/,
  );
  assert.match(
    threadReadServerSource,
    /summarizeBrokenThreadHistorySnapshot\(/,
  );
  assert.match(
    threadReadServerSource,
    /logBrokenThreadHistoryProof\('server:auto-restore-blocked'/,
  );
  assert.match(
    threadReadServerSource,
    /reason:\s*'encrypted-render-input'/,
  );
});
