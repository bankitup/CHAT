import { resolveMessagingAssetKindFromMimeType } from '@/modules/messaging/media/message-assets';
import type { MessagingMediaAssetKind } from '@/modules/messaging/media/types';

export type InboxAttachmentPreviewKind = 'audio' | 'file' | 'image';
export type InboxAttachmentPreviewAssetKind =
  | 'audio'
  | 'file'
  | 'image'
  | 'voice-note';

export function resolveInboxAttachmentPreviewKindFromMetadata(input: {
  assetKind?: MessagingMediaAssetKind | null;
  fileName?: string | null;
  mimeType?: string | null;
}): InboxAttachmentPreviewKind {
  const resolvedAssetKind =
    input.assetKind ??
    resolveMessagingAssetKindFromMimeType({
      fileName: input.fileName ?? null,
      mimeType: input.mimeType ?? null,
    });

  if (resolvedAssetKind === 'image') {
    return 'image';
  }

  if (resolvedAssetKind === 'audio' || resolvedAssetKind === 'voice-note') {
    return 'audio';
  }

  if (resolvedAssetKind === 'file') {
    return 'file';
  }

  return 'file';
}

export function resolveInboxAttachmentPreviewKind(
  mimeType: string | null | undefined,
  fileName?: string | null,
): InboxAttachmentPreviewKind {
  return resolveInboxAttachmentPreviewKindFromMetadata({
    fileName: fileName ?? null,
    mimeType: mimeType ?? null,
  });
}

export function resolveInboxAttachmentPreviewKindFromAsset(input: {
  kind: InboxAttachmentPreviewAssetKind | null | undefined;
  mimeType: string | null | undefined;
}): InboxAttachmentPreviewKind {
  return resolveInboxAttachmentPreviewKindFromMetadata({
    assetKind: input.kind ?? null,
    mimeType: input.mimeType ?? null,
  });
}
