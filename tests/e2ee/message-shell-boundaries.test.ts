import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMessageInsertPayload } from '../../src/modules/messaging/data/message-shell.ts';

test('encrypted DM message shells never populate plaintext body fields', () => {
  const payload = buildMessageInsertPayload({
    messageId: 'message-1',
    conversationId: 'conversation-1',
    senderId: 'user-1',
    clientId: 'client-1',
    body: 'secret plaintext',
    contentMode: 'dm_e2ee_v1',
    senderDeviceId: 'device-1',
  });

  assert.equal(payload.body, null);
  assert.equal(payload.content_mode, 'dm_e2ee_v1');
  assert.equal(payload.sender_device_id, 'device-1');
});

test('legacy plaintext messages still keep trimmed body content', () => {
  const payload = buildMessageInsertPayload({
    messageId: 'message-2',
    conversationId: 'conversation-1',
    senderId: 'user-1',
    clientId: 'client-2',
    body: '  hello  ',
    contentMode: 'plaintext',
  });

  assert.equal(payload.body, 'hello');
  assert.equal(payload.content_mode, 'plaintext');
});
