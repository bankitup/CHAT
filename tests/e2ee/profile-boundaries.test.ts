import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const workspaceRoot = resolve(import.meta.dirname, '..', '..');

function readWorkspaceFile(relativePath: string) {
  return readFileSync(resolve(workspaceRoot, relativePath), 'utf8');
}

test('shared profile entry surfaces use the platform profile server seam', () => {
  const homePageSource = readWorkspaceFile('app/(app)/home/page.tsx');
  const homeActionsSource = readWorkspaceFile('app/(app)/home/actions.ts');
  const settingsActionsSource = readWorkspaceFile('app/(app)/settings/actions.ts');
  const authActionsSource = readWorkspaceFile('app/(auth)/actions.ts');
  const messengerSettingsLoaderSource = readWorkspaceFile(
    'src/modules/messaging/server/settings-page.ts',
  );

  for (const source of [
    homePageSource,
    homeActionsSource,
    settingsActionsSource,
    authActionsSource,
    messengerSettingsLoaderSource,
  ]) {
    assert.match(source, /from ['"]@\/modules\/profile\/server['"]/);
  }

  assert.doesNotMatch(
    homePageSource,
    /from ['"]@\/modules\/messaging\/data\/server['"]/,
  );
  assert.doesNotMatch(
    homeActionsSource,
    /from ['"]@\/modules\/messaging\/data\/server['"]/,
  );
  assert.doesNotMatch(
    settingsActionsSource,
    /from ['"]@\/modules\/messaging\/data\/server['"]/,
  );
  assert.doesNotMatch(
    authActionsSource,
    /from ['"]@\/modules\/messaging\/data\/server['"]/,
  );
});

test('shared identity and avatar consumers use profile helpers while messaging keeps compatibility shims', () => {
  const profileSettingsFormSource = readWorkspaceFile(
    'app/(app)/settings/profile-settings-form.tsx',
  );
  const newChatSheetSource = readWorkspaceFile(
    'app/(app)/inbox/new-chat-sheet.tsx',
  );
  const threadPageLoaderSource = readWorkspaceFile(
    'src/modules/messaging/server/thread-page.ts',
  );
  const identityShimSource = readWorkspaceFile(
    'src/modules/messaging/ui/identity.tsx',
  );
  const identityLabelShimSource = readWorkspaceFile(
    'src/modules/messaging/ui/identity-label.ts',
  );
  const identityStatusShimSource = readWorkspaceFile(
    'src/modules/messaging/ui/identity-status.tsx',
  );
  const avatarShimSource = readWorkspaceFile(
    'src/modules/messaging/profile-avatar.ts',
  );

  assert.match(
    profileSettingsFormSource,
    /from ['"]@\/modules\/profile\/ui\/identity['"]/,
  );
  assert.match(
    profileSettingsFormSource,
    /from ['"]@\/modules\/profile\/avatar['"]/,
  );
  assert.match(
    newChatSheetSource,
    /from ['"]@\/modules\/profile\/ui\/identity['"]/,
  );
  assert.match(
    newChatSheetSource,
    /from ['"]@\/modules\/profile\/ui\/identity-status['"]/,
  );
  assert.match(
    threadPageLoaderSource,
    /from ['"]@\/modules\/profile\/ui\/identity-label['"]/,
  );
  assert.match(
    threadPageLoaderSource,
    /from ['"]@\/modules\/profile\/ui\/identity-status['"]/,
  );

  assert.match(
    identityShimSource,
    /from ['"]@\/modules\/profile\/ui\/identity['"]/,
  );
  assert.match(
    identityLabelShimSource,
    /from ['"]@\/modules\/profile\/ui\/identity-label['"]/,
  );
  assert.match(
    identityStatusShimSource,
    /from ['"]@\/modules\/profile\/ui\/identity-status['"]/,
  );
  assert.match(
    avatarShimSource,
    /from ['"]@\/modules\/profile\/avatar['"]/,
  );
});

test('messaging profile persistence helpers depend on shared profile primitives', () => {
  const profileServerSource = readWorkspaceFile('src/modules/profile/server.ts');
  const messagingProfilesSource = readWorkspaceFile(
    'src/modules/messaging/data/profiles-server.ts',
  );
  const conversationAdminSource = readWorkspaceFile(
    'src/modules/messaging/data/conversation-admin-server.ts',
  );
  const avatarRouteSource = readWorkspaceFile(
    'app/api/messaging/avatar/[...objectPath]/route.ts',
  );

  assert.match(
    profileServerSource,
    /from ['"]@\/modules\/messaging\/data\/profiles-server['"]/,
  );
  assert.match(
    messagingProfilesSource,
    /from ['"]@\/modules\/profile\/avatar['"]/,
  );
  assert.match(
    messagingProfilesSource,
    /from ['"]@\/modules\/profile\/types['"]/,
  );
  assert.match(
    conversationAdminSource,
    /from ['"]@\/modules\/profile\/avatar['"]/,
  );
  assert.match(
    avatarRouteSource,
    /from ['"]@\/modules\/profile\/avatar['"]/,
  );
});
