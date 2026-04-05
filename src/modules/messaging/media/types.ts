export type MessagingMediaAssetKind =
  | 'image'
  | 'file'
  | 'audio'
  | 'voice-note';

export type MessagingMediaAssetSource =
  | 'supabase-storage'
  | 'external-url'
  | 'local-draft';

export type MessagingMediaPreviewMode =
  | 'thumbnail'
  | 'audio-inline'
  | 'voice-inline'
  | 'download-only';

export type MessagingVoiceMessageStage =
  | 'draft'
  | 'capturing'
  | 'encoding'
  | 'queued'
  | 'uploading'
  | 'uploaded'
  | 'committing'
  | 'committed'
  | 'failed'
  | 'cancelled';

export type MessagingMediaAssetRecord = {
  assetId: string;
  bucket: string | null;
  conversationId: string;
  createdAt: string;
  durationMs: number | null;
  fileName: string | null;
  height: number | null;
  kind: MessagingMediaAssetKind;
  messageId: string | null;
  mimeType: string | null;
  objectPath: string | null;
  previewMode: MessagingMediaPreviewMode;
  sizeBytes: number | null;
  source: MessagingMediaAssetSource;
  width: number | null;
};

export type MessagingMessageMediaLink = {
  assetId: string;
  messageId: string;
  ordinal: number;
  renderAsPrimary: boolean;
};

export type MessagingCommittedMediaAttachment = {
  asset: MessagingMediaAssetRecord;
  link: MessagingMessageMediaLink;
};

export function isMessagingVoiceAsset(
  asset: Pick<MessagingMediaAssetRecord, 'kind'>,
) {
  return asset.kind === 'voice-note';
}

export function isMessagingAudioAsset(
  asset: Pick<MessagingMediaAssetRecord, 'kind'>,
) {
  return asset.kind === 'audio' || asset.kind === 'voice-note';
}

export function isMessagingBinaryAssetCommitted(
  asset: Pick<MessagingMediaAssetRecord, 'source' | 'objectPath'>,
) {
  return asset.source !== 'local-draft' && Boolean(asset.objectPath);
}
