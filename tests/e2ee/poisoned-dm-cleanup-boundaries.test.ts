import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const workspaceRoot = resolve(import.meta.dirname, '..', '..');

function readWorkspaceFile(relativePath: string) {
  return readFileSync(resolve(workspaceRoot, relativePath), 'utf8');
}

test('direct-chat delete action uses the full poisoned-DM cleanup helper instead of hide-only inbox removal', () => {
  const actionsSource = readWorkspaceFile(
    'app/(app)/chat/[conversationId]/actions.ts',
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
  assert.doesNotMatch(
    actionsSource,
    /export async function deleteDirectConversationAction\(formData: FormData\) \{[\s\S]*await hideConversationForUser\(\{/,
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

test('DM recreation still reuses only an existing active conversation, so a deleted poisoned DM will recreate cleanly', () => {
  const inboxActionsSource = readWorkspaceFile('app/(app)/inbox/actions.ts');
  const dataSource = readWorkspaceFile('src/modules/messaging/data/server.ts');

  assert.match(
    inboxActionsSource,
    /const existingConversationId = await findExistingActiveDmConversation\(/,
  );
  assert.match(
    inboxActionsSource,
    /if \(existingConversationId\) \{[\s\S]*redirectToExistingDmConversation/,
  );
  assert.match(
    inboxActionsSource,
    /const conversationId = await createConversationWithMembers\(\{[\s\S]*kind: 'dm'/,
  );
  assert.match(
    dataSource,
    /if \(existingConversationId\) \{\s*return existingConversationId;\s*\}/,
  );
});
