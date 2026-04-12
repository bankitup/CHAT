import type {
  MessagingMediaAssetKind,
  MessagingMediaPreviewMode,
  MessagingMediaAssetSource,
} from './types';
import type { MessagingMessageKind } from './message-metadata';

export type MessagingCommittedMediaAssetSource = Exclude<
  MessagingMediaAssetSource,
  'local-draft'
>;

export type MessagingMessageAssetRow = {
  id: string;
  conversation_id: string;
  created_at: string;
  created_by: string;
  duration_ms: number | null;
  external_url: string | null;
  file_name: string | null;
  kind: MessagingMediaAssetKind;
  mime_type: string | null;
  size_bytes: number | null;
  source: MessagingCommittedMediaAssetSource;
  storage_bucket: string | null;
  storage_object_path: string | null;
};

export type MessagingMessageAssetLinkRow = {
  asset_id: string;
  created_at: string;
  message_id: string;
  ordinal: number;
  render_as_primary: boolean;
};

export type MessagingMessageAssetRecord = {
  assetId: string;
  conversationId: string;
  createdAt: string;
  createdByUserId: string;
  durationMs: number | null;
  externalUrl: string | null;
  fileName: string | null;
  kind: MessagingMediaAssetKind;
  mimeType: string | null;
  sizeBytes: number | null;
  source: MessagingCommittedMediaAssetSource;
  storageBucket: string | null;
  storageObjectPath: string | null;
};

export type MessagingMessageAssetLink = {
  assetId: string;
  createdAt: string;
  messageId: string;
  ordinal: number;
  renderAsPrimary: boolean;
};

export type MessagingVoiceMessageAssetFields = Pick<
  MessagingMessageAssetRecord,
  | 'durationMs'
  | 'fileName'
  | 'mimeType'
  | 'sizeBytes'
  | 'source'
  | 'storageBucket'
  | 'storageObjectPath'
  | 'externalUrl'
> & {
  kind: 'voice-note';
};

export type MessagingVoicePlaybackVariantRole = 'playback-normalized';

export type MessagingVoicePlaybackOriginalSourceRecord = Pick<
  MessagingVoiceMessageAssetFields,
  | 'durationMs'
  | 'fileName'
  | 'mimeType'
  | 'source'
  | 'storageBucket'
  | 'storageObjectPath'
> & {
  assetId: string | null;
  transportSourceUrl?: string | null;
};

export type MessagingVoicePlaybackVariantRecord = Pick<
  MessagingMessageAssetRecord,
  | 'assetId'
  | 'durationMs'
  | 'fileName'
  | 'mimeType'
  | 'source'
  | 'storageBucket'
  | 'storageObjectPath'
> & {
  role: MessagingVoicePlaybackVariantRole;
  transportSourceUrl?: string | null;
};

export type MessagingVoicePlaybackSourceOption = {
  assetId: string | null;
  durationMs: number | null;
  fileName: string | null;
  mimeType: string | null;
  origin: 'derived' | 'original';
  role: 'original-capture' | MessagingVoicePlaybackVariantRole;
  source: MessagingCommittedMediaAssetSource | null;
  sourceId: string;
  storageBucket: string | null;
  storageObjectPath: string | null;
  transportSourceUrl: string | null;
};

export type MessagingVoicePlaybackAttachmentSourceRecord = {
  bucket?: string | null;
  id?: string | null;
  isAudio?: boolean;
  isVoiceMessage?: boolean;
  messageId?: string | null;
  objectPath?: string | null;
  signedUrl?: string | null;
  voicePlaybackVariants?:
    | readonly Pick<
        MessagingVoicePlaybackVariantRecord,
        'assetId' | 'storageBucket' | 'storageObjectPath' | 'transportSourceUrl'
      >[]
    | null;
};

export type MessagingMessageAssetCommitIntent = {
  assetId: string | null;
  clientUploadId: string | null;
  conversationId: string;
  currentUserId: string;
  durationMs: number | null;
  externalUrl: string | null;
  fileName: string | null;
  kind: MessagingMediaAssetKind;
  messageId: string | null;
  mimeType: string | null;
  replyToMessageId: string | null;
  sizeBytes: number | null;
  source: MessagingCommittedMediaAssetSource;
  storageBucket: string | null;
  storageObjectPath: string | null;
};

function normalizeMessagingVoicePlaybackSourceValue(value: string | null | undefined) {
  const normalizedValue = value?.trim() || '';
  return normalizedValue || null;
}

function buildMessagingVoicePlaybackSourceId(input: {
  assetId: string | null;
  origin: MessagingVoicePlaybackSourceOption['origin'];
  role: MessagingVoicePlaybackSourceOption['role'];
  storageObjectPath: string | null;
  transportSourceUrl: string | null;
}) {
  return [
    input.origin,
    input.role,
    input.assetId ?? 'asset-missing',
    input.storageObjectPath ?? 'object-missing',
    input.transportSourceUrl ?? 'transport-missing',
  ].join(':');
}

function hasMessagingVoicePlaybackLocator(input: {
  assetId?: string | null;
  attachmentMessageId?: string | null;
  expectedMessageId?: string | null;
  storageBucket?: string | null;
  storageObjectPath?: string | null;
}) {
  const assetId = normalizeMessagingVoicePlaybackSourceValue(input.assetId);
  const attachmentMessageId = normalizeMessagingVoicePlaybackSourceValue(
    input.attachmentMessageId,
  );
  const expectedMessageId = normalizeMessagingVoicePlaybackSourceValue(
    input.expectedMessageId,
  );
  const storageBucket = normalizeMessagingVoicePlaybackSourceValue(
    input.storageBucket,
  );
  const storageObjectPath = normalizeMessagingVoicePlaybackSourceValue(
    input.storageObjectPath,
  );

  if (!assetId || !attachmentMessageId || !storageBucket || !storageObjectPath) {
    return false;
  }

  if (expectedMessageId && attachmentMessageId !== expectedMessageId) {
    return false;
  }

  return true;
}

export function resolveMessagingVoicePlaybackSourceOptions(input: {
  original: MessagingVoicePlaybackOriginalSourceRecord | null;
  variants?: readonly MessagingVoicePlaybackVariantRecord[] | null;
}) {
  const candidates: MessagingVoicePlaybackSourceOption[] = [];

  for (const variant of input.variants ?? []) {
    const assetId = normalizeMessagingVoicePlaybackSourceValue(variant.assetId);
    const storageObjectPath = normalizeMessagingVoicePlaybackSourceValue(
      variant.storageObjectPath,
    );
    const transportSourceUrl = normalizeMessagingVoicePlaybackSourceValue(
      variant.transportSourceUrl,
    );

    if (!assetId && !storageObjectPath && !transportSourceUrl) {
      continue;
    }

    candidates.push({
      assetId,
      durationMs: variant.durationMs ?? null,
      fileName: normalizeMessagingVoicePlaybackSourceValue(variant.fileName),
      mimeType: normalizeMessagingVoicePlaybackSourceValue(variant.mimeType),
      origin: 'derived',
      role: variant.role,
      source: variant.source ?? null,
      sourceId: buildMessagingVoicePlaybackSourceId({
        assetId,
        origin: 'derived',
        role: variant.role,
        storageObjectPath,
        transportSourceUrl,
      }),
      storageBucket: normalizeMessagingVoicePlaybackSourceValue(
        variant.storageBucket,
      ),
      storageObjectPath,
      transportSourceUrl,
    });
  }

  if (input.original) {
    const assetId = normalizeMessagingVoicePlaybackSourceValue(input.original.assetId);
    const storageObjectPath = normalizeMessagingVoicePlaybackSourceValue(
      input.original.storageObjectPath,
    );
    const transportSourceUrl = normalizeMessagingVoicePlaybackSourceValue(
      input.original.transportSourceUrl,
    );

    if (
      assetId ||
      storageObjectPath ||
      transportSourceUrl ||
      normalizeMessagingVoicePlaybackSourceValue(input.original.fileName) ||
      normalizeMessagingVoicePlaybackSourceValue(input.original.mimeType) ||
      input.original.durationMs !== null
    ) {
      candidates.push({
        assetId,
        durationMs: input.original.durationMs ?? null,
        fileName: normalizeMessagingVoicePlaybackSourceValue(input.original.fileName),
        mimeType: normalizeMessagingVoicePlaybackSourceValue(input.original.mimeType),
        origin: 'original',
        role: 'original-capture',
        source: input.original.source ?? null,
        sourceId: buildMessagingVoicePlaybackSourceId({
          assetId,
          origin: 'original',
          role: 'original-capture',
          storageObjectPath,
          transportSourceUrl,
        }),
        storageBucket: normalizeMessagingVoicePlaybackSourceValue(
          input.original.storageBucket,
        ),
        storageObjectPath,
        transportSourceUrl,
      });
    }
  }

  const dedupedCandidates = new Map<string, MessagingVoicePlaybackSourceOption>();

  for (const candidate of candidates) {
    if (!dedupedCandidates.has(candidate.sourceId)) {
      dedupedCandidates.set(candidate.sourceId, candidate);
    }
  }

  return Array.from(dedupedCandidates.values());
}

export function hasMessagingVoiceLocallyRecoverableSource(input: {
  attachment: MessagingVoicePlaybackAttachmentSourceRecord | null;
  expectedMessageId?: string | null;
}) {
  const attachment = input.attachment;

  if (!attachment) {
    return false;
  }

  if (!attachment.isVoiceMessage && !attachment.isAudio) {
    return false;
  }

  if (normalizeMessagingVoicePlaybackSourceValue(attachment.signedUrl)) {
    return true;
  }

  const attachmentMessageId = normalizeMessagingVoicePlaybackSourceValue(
    attachment.messageId,
  );

  if (
    hasMessagingVoicePlaybackLocator({
      assetId: attachment.id,
      attachmentMessageId,
      expectedMessageId: input.expectedMessageId,
      storageBucket: attachment.bucket,
      storageObjectPath: attachment.objectPath,
    })
  ) {
    return true;
  }

  for (const variant of attachment.voicePlaybackVariants ?? []) {
    if (normalizeMessagingVoicePlaybackSourceValue(variant.transportSourceUrl)) {
      return true;
    }

    if (
      hasMessagingVoicePlaybackLocator({
        assetId: variant.assetId,
        attachmentMessageId,
        expectedMessageId: input.expectedMessageId,
        storageBucket: variant.storageBucket,
        storageObjectPath: variant.storageObjectPath,
      })
    ) {
      return true;
    }
  }

  return false;
}

export function resolveMessagingAssetPreviewMode(
  kind: MessagingMediaAssetKind,
): MessagingMediaPreviewMode {
  switch (kind) {
    case 'image':
      return 'thumbnail';
    case 'audio':
      return 'audio-inline';
    case 'voice-note':
      return 'voice-inline';
    default:
      return 'download-only';
  }
}

export function resolveMessagingMessageKindForAsset(
  kind: MessagingMediaAssetKind,
): MessagingMessageKind {
  return kind === 'voice-note' ? 'voice' : 'attachment';
}

const ATTACHMENT_EXTENSION_TO_MIME_TYPE = new Map<string, string>([
  ['.aac', 'audio/aac'],
  ['.csv', 'text/csv'],
  ['.doc', 'application/msword'],
  [
    '.docx',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
  ['.gif', 'image/gif'],
  ['.heic', 'image/heic'],
  ['.heif', 'image/heif'],
  ['.jpeg', 'image/jpeg'],
  ['.jpg', 'image/jpeg'],
  ['.json', 'application/json'],
  ['.m4a', 'audio/m4a'],
  ['.markdown', 'text/markdown'],
  ['.md', 'text/markdown'],
  ['.mp3', 'audio/mp3'],
  ['.ogg', 'audio/ogg'],
  ['.pdf', 'application/pdf'],
  ['.png', 'image/png'],
  ['.ppt', 'application/vnd.ms-powerpoint'],
  [
    '.pptx',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ],
  ['.rtf', 'application/rtf'],
  ['.txt', 'text/plain'],
  ['.wav', 'audio/wav'],
  ['.webm', 'audio/webm'],
  ['.webp', 'image/webp'],
  ['.xls', 'application/vnd.ms-excel'],
  [
    '.xlsx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ],
  ['.zip', 'application/zip'],
]);

function getMessageAssetFileExtension(fileName: string | null | undefined) {
  const normalizedFileName = fileName?.trim() || '';

  if (!normalizedFileName) {
    return null;
  }

  const lastSegment = normalizedFileName.split(/[\\/]/).pop()?.trim() || '';
  const extensionIndex = lastSegment.lastIndexOf('.');

  if (extensionIndex < 0 || extensionIndex === lastSegment.length - 1) {
    return null;
  }

  return lastSegment.slice(extensionIndex).toLowerCase();
}

function isBinaryAttachmentMimeType(mimeType: string | null | undefined) {
  const normalizedMimeType = mimeType?.trim().toLowerCase() || '';

  return (
    !normalizedMimeType ||
    normalizedMimeType === 'application/octet-stream' ||
    normalizedMimeType === 'binary/octet-stream' ||
    normalizedMimeType === 'application/x-download'
  );
}

export function resolveMessagingAttachmentMimeType(input: {
  fileName?: string | null;
  mimeType: string | null | undefined;
}) {
  const normalizedMimeType = input.mimeType?.trim().toLowerCase() || '';

  if (normalizedMimeType && !isBinaryAttachmentMimeType(normalizedMimeType)) {
    return normalizedMimeType;
  }

  const fileExtension = getMessageAssetFileExtension(input.fileName);
  const fallbackMimeType = fileExtension
    ? ATTACHMENT_EXTENSION_TO_MIME_TYPE.get(fileExtension) ?? null
    : null;

  return fallbackMimeType ?? (normalizedMimeType || null);
}

export function resolveMessagingAssetKindFromMimeType(input: {
  fileName?: string | null;
  messageKind?: MessagingMessageKind | null;
  mimeType: string | null | undefined;
}): MessagingMediaAssetKind {
  if (input.messageKind === 'voice') {
    return 'voice-note';
  }

  const normalizedMimeType =
    resolveMessagingAttachmentMimeType({
      fileName: input.fileName,
      mimeType: input.mimeType,
    }) ?? '';

  if (normalizedMimeType.startsWith('image/')) {
    return 'image';
  }

  if (normalizedMimeType.startsWith('audio/')) {
    return 'audio';
  }

  return 'file';
}

export function isMessagingVoiceMessageAssetRow(
  asset: Pick<MessagingMessageAssetRow, 'kind'>,
) {
  return asset.kind === 'voice-note';
}

export function isMessagingCommittedVoiceAsset(
  asset: Pick<MessagingMessageAssetRecord, 'kind'>,
) {
  return asset.kind === 'voice-note';
}

export function mapMessageAssetRowToRecord(
  row: MessagingMessageAssetRow,
): MessagingMessageAssetRecord {
  return {
    assetId: row.id,
    conversationId: row.conversation_id,
    createdAt: row.created_at,
    createdByUserId: row.created_by,
    durationMs: row.duration_ms,
    externalUrl: row.external_url,
    fileName: row.file_name,
    kind: row.kind,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    source: row.source,
    storageBucket: row.storage_bucket,
    storageObjectPath: row.storage_object_path,
  };
}

export function mapMessageAssetLinkRowToRecord(
  row: MessagingMessageAssetLinkRow,
): MessagingMessageAssetLink {
  return {
    assetId: row.asset_id,
    createdAt: row.created_at,
    messageId: row.message_id,
    ordinal: row.ordinal,
    renderAsPrimary: row.render_as_primary,
  };
}
