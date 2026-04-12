import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const workspaceRoot = resolve(import.meta.dirname, '..', '..');

function readWorkspaceFile(relativePath: string) {
  return readFileSync(resolve(workspaceRoot, relativePath), 'utf8');
}

test('thread page content wraps the history viewport in a contained rescue boundary', () => {
  const threadPageContentSource = readWorkspaceFile(
    'app/(app)/chat/[conversationId]/thread-page-content.tsx',
  );

  assert.match(
    threadPageContentSource,
    /from ['"]\.\/thread-body-rescue-boundary['"]/,
  );
  assert.match(threadPageContentSource, /<ThreadBodyRescueBoundary/);
  assert.match(
    threadPageContentSource,
    /<ThreadBodyRescueBoundary[\s\S]*<ThreadHistoryViewport/,
  );
  assert.match(
    threadPageContentSource,
    /settingsHref=\{withSpaceParam\(/,
  );
});

test('thread body rescue boundary keeps retry and escape paths local to the conversation body', () => {
  const rescueBoundarySource = readWorkspaceFile(
    'app/(app)/chat/[conversationId]/thread-body-rescue-boundary.tsx',
  );

  assert.match(rescueBoundarySource, /<DmThreadClientSubtree/);
  assert.match(rescueBoundarySource, /surface="thread-history-viewport"/);
  assert.match(
    rescueBoundarySource,
    /key=\{boundaryNonce\}/,
  );
  assert.match(
    rescueBoundarySource,
    /readLastDmThreadHydrationSnapshot|readLastDmThreadClientSubtree/,
  );
  assert.match(rescueBoundarySource, /getThreadLiveStateSnapshot/);
  assert.match(rescueBoundarySource, /readThreadMessagePatchSnapshot/);
  assert.match(rescueBoundarySource, /rescue:fallback-mounted/);
  assert.match(rescueBoundarySource, /rescue:render-error-captured/);
  assert.match(rescueBoundarySource, /patchSummary:/);
  assert.match(rescueBoundarySource, /Retry history/);
  assert.match(rescueBoundarySource, /Back to Chats/);
  assert.match(rescueBoundarySource, /Open info/);
  assert.match(rescueBoundarySource, /withSpaceParam\('\/inbox', activeSpaceId\)/);
  assert.match(rescueBoundarySource, /prefetch=\{false\}/);
});
