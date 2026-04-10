import type { MessagingMediaAssetKind } from '@/modules/messaging/media/types';

export type InboxAttachmentPreviewKind = 'audio' | 'file' | 'image';

export function resolveInboxAttachmentPreviewKindFromMetadata(input: {
  assetKind?: MessagingMediaAssetKind | null;
  mimeType?: string | null;
}): InboxAttachmentPreviewKind {
  if (input.assetKind === 'image') {
    return 'image';
  }

  if (input.assetKind === 'audio' || input.assetKind === 'voice-note') {
    return 'audio';
  }

  if (input.assetKind === 'file') {
    return 'file';
  }

  if (input.mimeType?.startsWith('image/')) {
    return 'image';
  }

  if (input.mimeType?.startsWith('audio/')) {
    return 'audio';
  }

  return 'file';
}

export function resolveInboxAttachmentPreviewKind(
  mimeType: string | null | undefined,
): InboxAttachmentPreviewKind {
  return resolveInboxAttachmentPreviewKindFromMetadata({ mimeType: mimeType ?? null });
}
