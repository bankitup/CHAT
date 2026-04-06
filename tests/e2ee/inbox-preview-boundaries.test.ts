import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getInboxDisplayPreviewText,
  getInboxPreviewText,
  getSearchableConversationPreview,
  resolveEncryptedDmInboxPreview,
} from '../../src/modules/messaging/e2ee/inbox-policy.ts';

const labels = {
  audio: 'Audio',
  deletedMessage: 'Deleted message',
  voiceMessage: 'Voice message',
  encryptedMessage: 'Encrypted message',
  newEncryptedMessage: 'New encrypted message',
  attachment: 'Attachment',
  file: 'File',
  image: 'Image',
};

const displayLabels = {
  ...labels,
  newMessage: 'New message',
};

test('encrypted DM inbox preview uses truthful generic fallback instead of plaintext body', () => {
  const preview = getInboxPreviewText(
    {
      lastMessageAt: '2026-04-03T10:00:00.000Z',
      latestMessageDeletedAt: null,
      latestMessageKind: 'text',
      latestMessageContentMode: 'dm_e2ee_v1',
      latestMessageBody: 'legacy plaintext should not be shown',
      unreadCount: 0,
    },
    labels,
  );

  assert.equal(preview, 'Encrypted message');
});

test('encrypted DM preview resolves from local cache only when message id matches latest encrypted message', () => {
  const preview = resolveEncryptedDmInboxPreview({
    conversationId: 'conversation-1',
    fallbackPreview: 'Encrypted message',
    latestMessageContentMode: 'dm_e2ee_v1',
    latestMessageId: 'message-2',
    cachedPreview: {
      conversationId: 'conversation-1',
      messageId: 'message-2',
      snippet: 'hello from local cache',
      updatedAt: '2026-04-03T10:00:00.000Z',
    },
  });

  assert.equal(preview, 'hello from local cache');
});

test('encrypted DM preview falls back truthfully when cache is stale or missing', () => {
  const preview = resolveEncryptedDmInboxPreview({
    conversationId: 'conversation-1',
    fallbackPreview: 'Encrypted message',
    latestMessageContentMode: 'dm_e2ee_v1',
    latestMessageId: 'message-3',
    cachedPreview: {
      conversationId: 'conversation-1',
      messageId: 'message-2',
      snippet: 'old local cache',
      updatedAt: '2026-04-03T09:00:00.000Z',
    },
  });

  assert.equal(preview, 'Encrypted message');
});

test('generic encrypted fallback text does not become fake searchable content', () => {
  const searchablePreview = getSearchableConversationPreview({
    latestMessageContentMode: 'dm_e2ee_v1',
    preview: 'Encrypted message',
  });

  assert.equal(searchablePreview, '');
});

test('mixed-mode conversation still uses latest encrypted fallback rather than older plaintext preview', () => {
  const preview = getInboxPreviewText(
    {
      lastMessageAt: '2026-04-03T11:00:00.000Z',
      latestMessageDeletedAt: null,
      latestMessageKind: 'text',
      latestMessageContentMode: 'dm_e2ee_v1',
      latestMessageBody: 'older plaintext history should not leak forward',
      unreadCount: 0,
    },
    labels,
  );

  assert.equal(preview, 'Encrypted message');
});

test('unread encrypted DM inbox preview uses explicit new-encrypted fallback', () => {
  const preview = getInboxPreviewText(
    {
      lastMessageAt: '2026-04-03T12:00:00.000Z',
      latestMessageDeletedAt: null,
      latestMessageKind: 'text',
      latestMessageContentMode: 'dm_e2ee_v1',
      latestMessageBody: null,
      unreadCount: 2,
    },
    labels,
  );

  assert.equal(preview, 'New encrypted message');
});

test('mask mode hides plaintext inbox preview behind generic new-message text', () => {
  const preview = getInboxDisplayPreviewText(
    {
      lastMessageAt: '2026-04-03T12:00:00.000Z',
      latestMessageDeletedAt: null,
      latestMessageKind: 'text',
      latestMessageContentMode: 'plaintext',
      latestMessageBody: 'see you at 5',
      latestMessageAttachmentKind: null,
      unreadCount: 0,
    },
    displayLabels,
    'mask',
  );

  assert.equal(preview, 'New message');
});

test('reveal-after-open keeps unread plaintext previews masked', () => {
  const preview = getInboxDisplayPreviewText(
    {
      lastMessageAt: '2026-04-03T12:00:00.000Z',
      latestMessageDeletedAt: null,
      latestMessageKind: 'text',
      latestMessageContentMode: 'plaintext',
      latestMessageBody: 'private snippet',
      latestMessageAttachmentKind: null,
      unreadCount: 2,
    },
    displayLabels,
    'reveal_after_open',
  );

  assert.equal(preview, 'New message');
});

test('reveal-after-open shows plaintext previews once the chat is read', () => {
  const preview = getInboxDisplayPreviewText(
    {
      lastMessageAt: '2026-04-03T12:00:00.000Z',
      latestMessageDeletedAt: null,
      latestMessageKind: 'text',
      latestMessageContentMode: 'plaintext',
      latestMessageBody: 'private snippet',
      latestMessageAttachmentKind: null,
      unreadCount: 0,
    },
    displayLabels,
    'reveal_after_open',
  );

  assert.equal(preview, 'private snippet');
});
