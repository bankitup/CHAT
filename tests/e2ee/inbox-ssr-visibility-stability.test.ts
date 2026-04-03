import test from 'node:test';
import assert from 'node:assert/strict';
import {
  loadArchivedConversationsForSsr,
  loadInboxConversationsForSsr,
} from '../../src/modules/messaging/data/inbox-ssr-stability.ts';

test('main inbox SSR uses stable visibility loader and succeeds without precise hidden_at path', async () => {
  let stableCalls = 0;
  let preciseCalls = 0;

  const result = await loadInboxConversationsForSsr({
    view: 'main',
    loadStable: async () => {
      stableCalls += 1;
      return ['conversation-1', 'conversation-2'];
    },
    loadPrecise: async () => {
      preciseCalls += 1;
      throw new Error('hidden_at path should not run for main view');
    },
  });

  assert.deepEqual(result, ['conversation-1', 'conversation-2']);
  assert.equal(stableCalls, 1);
  assert.equal(preciseCalls, 0);
});

test('archived visibility failure degrades safely to empty instead of crashing SSR', async () => {
  const result = await loadArchivedConversationsForSsr({
    view: 'archived',
    emptyValue: [] as string[],
    loadArchived: async () => {
      throw new Error('column conversation_members.hidden_at does not exist');
    },
  });

  assert.deepEqual(result, []);
});

