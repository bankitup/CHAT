import test from 'node:test';
import assert from 'node:assert/strict';
import { applyConversationVisibility } from '../../src/modules/messaging/data/visibility.ts';

test('visible conversations exclude archived rows when hidden_at data is available', () => {
  const rows = [
    { conversation_id: 'conversation-1' },
    { conversation_id: 'conversation-2' },
    { conversation_id: 'conversation-3' },
  ];

  const visible = applyConversationVisibility(rows, false, [
    { conversation_id: 'conversation-1', hidden_at: null },
    { conversation_id: 'conversation-2', hidden_at: '2026-04-03T10:00:00.000Z' },
    { conversation_id: 'conversation-3', hidden_at: null },
  ]);

  assert.deepEqual(
    visible.map((row) => row.conversation_id),
    ['conversation-1', 'conversation-3'],
  );
  assert.equal(visible[0]?.hidden_at ?? null, null);
});

test('archived conversations include only hidden rows when hidden_at data is available', () => {
  const rows = [
    { conversation_id: 'conversation-1' },
    { conversation_id: 'conversation-2' },
    { conversation_id: 'conversation-3' },
  ];

  const archived = applyConversationVisibility(rows, true, [
    { conversation_id: 'conversation-1', hidden_at: null },
    { conversation_id: 'conversation-2', hidden_at: '2026-04-03T10:00:00.000Z' },
    { conversation_id: 'conversation-3', hidden_at: '2026-04-03T11:00:00.000Z' },
  ]);

  assert.deepEqual(
    archived.map((row) => row.conversation_id),
    ['conversation-2', 'conversation-3'],
  );
  assert.equal(
    archived[0]?.hidden_at,
    '2026-04-03T10:00:00.000Z',
  );
});

test('hidden_at lookup failure fallback keeps inbox alive and archives empty', () => {
  const rows = [
    { conversation_id: 'conversation-1' },
    { conversation_id: 'conversation-2' },
  ];

  const visibleFallback = applyConversationVisibility(rows, false, null);
  const archivedFallback = applyConversationVisibility(rows, true, null);

  assert.deepEqual(
    visibleFallback.map((row) => row.conversation_id),
    ['conversation-1', 'conversation-2'],
  );
  assert.deepEqual(archivedFallback, []);
  assert.ok(
    visibleFallback.every((row) => row.hidden_at === null),
  );
});
