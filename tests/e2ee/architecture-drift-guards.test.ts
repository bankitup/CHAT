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

const PRODUCT_ROUTE_IMPORT_PATTERN =
  /from ['"](?:\.\.?\/(?:.*\/)?(?:chat|inbox|rooms|issues|tasks|home|activity)\/|@\/app\/\(app\)\/(?:chat|inbox|rooms|issues|tasks|home|activity)\/)/;

test('shared platform and shell seams stay free of product-route and product-domain imports', () => {
  const layoutSource = readWorkspaceFile('app/(app)/layout.tsx');
  const shellFrameSource = readWorkspaceFile('app/(app)/app-shell-frame.tsx');
  const spacesAccessSource = readWorkspaceFile('src/modules/spaces/access.ts');
  const spacesGovernanceSource = readWorkspaceFile(
    'src/modules/spaces/governance.ts',
  );
  const spacesServerSource = readWorkspaceFile('src/modules/spaces/server.ts');
  const spacesModelSource = readWorkspaceFile('src/modules/spaces/model.ts');
  const spacesPostureSource = readWorkspaceFile('src/modules/spaces/posture.ts');
  const spacesShellSource = readWorkspaceFile('src/modules/spaces/shell.ts');
  const appShellStateSource = readWorkspaceFile('src/modules/app-shell/state.ts');
  const appShellSpacePostureSource = readWorkspaceFile(
    'src/modules/app-shell/space-posture.ts',
  );

  for (const source of [
    layoutSource,
    shellFrameSource,
    spacesAccessSource,
    spacesGovernanceSource,
    spacesServerSource,
    spacesModelSource,
    spacesPostureSource,
    spacesShellSource,
    appShellStateSource,
    appShellSpacePostureSource,
  ]) {
    assert.doesNotMatch(source, PRODUCT_ROUTE_IMPORT_PATTERN);
    assert.doesNotMatch(source, /from ['"]@\/modules\/keepcozy\//);
    assert.doesNotMatch(
      source,
      /from ['"]@\/modules\/messaging\/server\/(?:inbox-page|thread-page|thread-settings-page|settings-page|operational-activity|operational-thread-context)['"]/,
    );
  }

  assert.doesNotMatch(
    layoutSource,
    /from ['"]@\/modules\/messaging\/data\/server['"]/,
  );
  assert.doesNotMatch(
    shellFrameSource,
    /from ['"]@\/modules\/messaging\/data\/server['"]/,
  );
  assert.doesNotMatch(
    shellFrameSource,
    /DmE2eeAuthenticatedBoundary|ChatUnreadBadgeSync|PushSubscriptionPresenceSync|WarmNavRouteObserver|MessengerSurfaceRuntimeEffects/,
  );
});

test('shared and mixed seams avoid broad messaging data facade imports when narrower seams or platform seams should lead', () => {
  const shellFrameSource = readWorkspaceFile('app/(app)/app-shell-frame.tsx');
  const layoutSource = readWorkspaceFile('app/(app)/layout.tsx');
  const homePageSource = readWorkspaceFile('app/(app)/home/page.tsx');
  const activityPageSource = readWorkspaceFile('app/(app)/activity/page.tsx');
  const settingsPageSource = readWorkspaceFile('app/(app)/settings/page.tsx');
  const profileServerSource = readWorkspaceFile('src/modules/profile/server.ts');

  for (const source of [
    shellFrameSource,
    layoutSource,
    homePageSource,
    activityPageSource,
    settingsPageSource,
    profileServerSource,
  ]) {
    assert.doesNotMatch(
      source,
      /from ['"]@\/modules\/messaging\/data\/server['"]/,
    );
  }

  assert.match(
    profileServerSource,
    /from ['"]@\/modules\/messaging\/data\/profiles-server['"]/,
  );
});

test('mixed routes stay composed through bounded module seams instead of product-route reach-through', () => {
  const homePageSource = readWorkspaceFile('app/(app)/home/page.tsx');
  const activityPageSource = readWorkspaceFile('app/(app)/activity/page.tsx');

  assert.match(homePageSource, /from ['"]@\/modules\/keepcozy\/server['"]/);
  assert.match(
    homePageSource,
    /from ['"]@\/modules\/profile\/server['"]/,
  );
  assert.doesNotMatch(homePageSource, PRODUCT_ROUTE_IMPORT_PATTERN);
  assert.doesNotMatch(
    homePageSource,
    /from ['"]@\/modules\/messaging\/server\/(?:inbox-page|thread-page|thread-settings-page)['"]/,
  );

  assert.match(
    activityPageSource,
    /from ['"]@\/modules\/keepcozy\/messaging-adapter['"]/,
  );
  assert.match(
    activityPageSource,
    /from ['"]@\/modules\/keepcozy\/server['"]/,
  );
  assert.doesNotMatch(activityPageSource, PRODUCT_ROUTE_IMPORT_PATTERN);
  assert.doesNotMatch(
    activityPageSource,
    /from ['"]@\/modules\/messaging\/server\/(?:inbox-page|thread-page|thread-settings-page)['"]/,
  );
});

test('key mixed ownership files stay within lean guard size caps until cleanup waves land', () => {
  assert.ok(readWorkspaceLineCount('app/(app)/app-shell-frame.tsx') <= 220);
  assert.ok(readWorkspaceLineCount('app/(app)/home/page.tsx') <= 1100);
  assert.ok(readWorkspaceLineCount('app/(app)/activity/page.tsx') <= 1100);
  assert.ok(readWorkspaceLineCount('src/modules/spaces/model.ts') <= 175);
  assert.ok(readWorkspaceLineCount('src/modules/spaces/posture.ts') <= 140);
  assert.ok(readWorkspaceLineCount('src/modules/spaces/shell.ts') <= 40);
  assert.ok(readWorkspaceLineCount('src/modules/app-shell/state.ts') <= 220);
  assert.ok(
    readWorkspaceLineCount('src/modules/app-shell/space-posture.ts') <= 60,
  );
  assert.ok(readWorkspaceLineCount('src/modules/profile/server.ts') <= 24);
  assert.ok(
    readWorkspaceLineCount('src/modules/messaging/ui/user-facing-errors.ts') <=
      190,
  );
});
