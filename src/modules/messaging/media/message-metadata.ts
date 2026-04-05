import type { MessagingMediaAssetKind, MessagingMediaPreviewMode } from './types';

export type MessagingMessageKind = 'text' | 'attachment' | 'voice';

export type MessagingMessageContentMode = 'plaintext' | 'dm_e2ee_v1';

export type MessagingMessageMediaRole = 'primary' | 'secondary';

export type MessagingThreadMediaLoadStrategy = 'on-demand' | 'eager';

export type MessagingConversationSummaryPreviewKind =
  | 'empty'
  | 'text'
  | 'attachment'
  | 'voice'
  | 'encrypted'
  | 'deleted';

export type MessagingMessageMediaDescriptor = {
  assetId: string | null;
  fileName: string | null;
  kind: MessagingMediaAssetKind;
  loadStrategy: MessagingThreadMediaLoadStrategy;
  mimeType: string | null;
  objectPath: string | null;
  previewMode: MessagingMediaPreviewMode;
  role: MessagingMessageMediaRole;
  sizeBytes: number | null;
};

export type MessagingMessageMediaSnapshot = {
  contentMode: MessagingMessageContentMode;
  descriptors: MessagingMessageMediaDescriptor[];
  kind: MessagingMessageKind;
  messageId: string;
};

export type MessagingConversationSummaryMediaProjection = {
  body: string | null;
  contentMode: MessagingMessageContentMode | null;
  deletedAt: string | null;
  kind: MessagingMessageKind | null;
  lastMessageAt: string | null;
  messageId: string | null;
};

export function isMessagingVoiceMessageKind(
  kind: string | null | undefined,
): kind is 'voice' {
  return kind === 'voice';
}

export function resolveMessagingConversationSummaryPreviewKind(
  input: MessagingConversationSummaryMediaProjection,
): MessagingConversationSummaryPreviewKind {
  if (!input.lastMessageAt) {
    return 'empty';
  }

  if (input.deletedAt) {
    return 'deleted';
  }

  if (input.kind === 'voice') {
    return 'voice';
  }

  if (input.contentMode === 'dm_e2ee_v1') {
    return 'encrypted';
  }

  if (input.body?.trim()) {
    return 'text';
  }

  return 'attachment';
}
