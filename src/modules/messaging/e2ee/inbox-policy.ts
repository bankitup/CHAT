import type { InboxAttachmentPreviewKind } from '@/modules/messaging/inbox/preview-kind';
import type { InboxPreviewDisplayMode } from '@/modules/messaging/inbox/preferences';

export type InboxPreviewLabels = {
  audio: string;
  deletedMessage: string;
  voiceMessage: string;
  encryptedMessage: string;
  newEncryptedMessage: string;
  attachment: string;
  file: string;
  image: string;
};

export type InboxDisplayPreviewLabels = InboxPreviewLabels & {
  newMessage: string;
};

export type EncryptedDmPreviewCacheEntry = {
  conversationId: string;
  messageId: string;
  snippet: string;
  updatedAt: string;
};

function getGenericConversationPreviewByKind(
  conversation: {
    latestMessageAttachmentKind?: InboxAttachmentPreviewKind | null;
    latestMessageKind: string | null;
  },
  labels: Pick<InboxPreviewLabels, 'audio' | 'attachment' | 'file' | 'image' | 'voiceMessage'>,
) {
  if (conversation.latestMessageKind === 'voice') {
    return labels.voiceMessage;
  }

  if (conversation.latestMessageAttachmentKind === 'image') {
    return labels.image;
  }

  if (conversation.latestMessageAttachmentKind === 'audio') {
    return labels.audio;
  }

  if (conversation.latestMessageAttachmentKind === 'file') {
    return labels.file;
  }

  return labels.attachment;
}

export function getInboxPreviewText(
  conversation: {
    lastMessageAt: string | null;
    latestMessageDeletedAt: string | null;
    latestMessageKind: string | null;
    latestMessageContentMode: string | null;
    latestMessageBody: string | null;
    latestMessageAttachmentKind?: InboxAttachmentPreviewKind | null;
    unreadCount?: number | null;
  },
  labels: InboxPreviewLabels,
) {
  if (!conversation.lastMessageAt) {
    return null;
  }

  if (conversation.latestMessageDeletedAt) {
    return labels.deletedMessage;
  }

  if (conversation.latestMessageContentMode === 'dm_e2ee_v1') {
    return (conversation.unreadCount ?? 0) > 0
      ? labels.newEncryptedMessage
      : labels.encryptedMessage;
  }

  const body = conversation.latestMessageBody?.trim();

  if (body) {
    return body;
  }

  return getGenericConversationPreviewByKind(conversation, labels);
}

export function getMaskedInboxPreviewText(
  conversation: {
    lastMessageAt: string | null;
    latestMessageDeletedAt: string | null;
    latestMessageKind: string | null;
    latestMessageContentMode: string | null;
    latestMessageBody: string | null;
    latestMessageAttachmentKind?: InboxAttachmentPreviewKind | null;
    unreadCount?: number | null;
  },
  labels: InboxDisplayPreviewLabels,
) {
  if (!conversation.lastMessageAt) {
    return null;
  }

  if (conversation.latestMessageDeletedAt) {
    return labels.deletedMessage;
  }

  if (conversation.latestMessageContentMode === 'dm_e2ee_v1') {
    return (conversation.unreadCount ?? 0) > 0
      ? labels.newEncryptedMessage
      : labels.encryptedMessage;
  }

  if (conversation.latestMessageBody?.trim()) {
    return labels.newMessage;
  }

  return getGenericConversationPreviewByKind(conversation, labels);
}

export function getInboxDisplayPreviewText(
  conversation: {
    lastMessageAt: string | null;
    latestMessageDeletedAt: string | null;
    latestMessageKind: string | null;
    latestMessageContentMode: string | null;
    latestMessageBody: string | null;
    latestMessageAttachmentKind?: InboxAttachmentPreviewKind | null;
    unreadCount?: number | null;
  },
  labels: InboxDisplayPreviewLabels,
  mode: InboxPreviewDisplayMode,
) {
  if (mode === 'mask') {
    return getMaskedInboxPreviewText(conversation, labels);
  }

  if (mode === 'reveal_after_open' && (conversation.unreadCount ?? 0) > 0) {
    return getMaskedInboxPreviewText(conversation, labels);
  }

  return getInboxPreviewText(conversation, labels);
}

export function getSearchableConversationPreview(input: {
  latestMessageContentMode: string | null;
  preview: string | null;
}) {
  if (input.latestMessageContentMode === 'dm_e2ee_v1') {
    return '';
  }

  return input.preview ?? '';
}

export function resolveEncryptedDmInboxPreview(input: {
  conversationId: string;
  fallbackPreview: string | null;
  latestMessageContentMode: string | null;
  latestMessageId: string | null;
  cachedPreview: EncryptedDmPreviewCacheEntry | null;
}) {
  if (
    input.latestMessageContentMode !== 'dm_e2ee_v1' ||
    !input.latestMessageId ||
    !input.conversationId
  ) {
    return input.fallbackPreview;
  }

  if (
    input.cachedPreview &&
    input.cachedPreview.conversationId === input.conversationId &&
    input.cachedPreview.messageId === input.latestMessageId
  ) {
    return input.cachedPreview.snippet;
  }

  return input.fallbackPreview;
}
