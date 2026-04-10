import type { MessagingMediaAssetKind } from '@/modules/messaging/media/types';

export type InboxAttachmentPreviewKind = 'audio' | 'file' | 'image';
export type InboxAttachmentPreviewAssetKind =
  | 'audio'
  | 'file'
  | 'image'
  | 'voice-note';

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
export function resolveInboxAttachmentPreviewKindFromAsset(input: {
  kind: InboxAttachmentPreviewAssetKind | null | undefined;
  mimeType: string | null | undefined;
}): InboxAttachmentPreviewKind {
  if (input.kind === 'image') {
    return 'image';
  }

  if (input.kind === 'audio' || input.kind === 'voice-note') {
    return 'audio';
  }

  if (input.kind === 'file') {
    return 'file';
  }

  return resolveInboxAttachmentPreviewKind(input.mimeType);
}
