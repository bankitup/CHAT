export type InboxAttachmentPreviewKind = 'audio' | 'file' | 'image';

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
