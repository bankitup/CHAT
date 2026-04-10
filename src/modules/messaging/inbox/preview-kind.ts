export type InboxAttachmentPreviewKind = 'audio' | 'file' | 'image';
export type InboxAttachmentPreviewAssetKind =
  | 'audio'
  | 'file'
  | 'image'
  | 'voice-note';

export function resolveInboxAttachmentPreviewKind(
  mimeType: string | null | undefined,
): InboxAttachmentPreviewKind {
  if (mimeType?.startsWith('image/')) {
    return 'image';
  }

  if (mimeType?.startsWith('audio/')) {
    return 'audio';
  }

  return 'file';
}

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
