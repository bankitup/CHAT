import 'server-only';

export const CHAT_ATTACHMENT_MAX_SIZE_BYTES = 10 * 1024 * 1024;

const SUPPORTED_ATTACHMENT_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.heic',
  '.heif',
  '.pdf',
  '.txt',
  '.csv',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
  '.rtf',
  '.json',
  '.md',
  '.markdown',
  '.zip',
] as const;

const SUPPORTED_ATTACHMENT_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/rtf',
  'application/json',
  'text/markdown',
  'application/zip',
  'application/x-zip-compressed',
  'audio/webm',
  'audio/mp4',
  'audio/mpeg',
  'audio/ogg',
  'audio/wav',
  'audio/x-wav',
  'audio/aac',
  'audio/mp3',
  'audio/m4a',
] as const;

export const CHAT_ATTACHMENT_ACCEPT = [
  ...SUPPORTED_ATTACHMENT_MIME_TYPES,
  ...SUPPORTED_ATTACHMENT_EXTENSIONS,
].join(',');

export const CHAT_ATTACHMENT_HELP_TEXT =
  'Supported photos, documents, ZIP files, and common audio files up to 10 MB.';

type ChatAttachmentBucketConfig = {
  actualBucket: string;
  configuredBucketNormalized: string | null;
  ignoredPublicBucket: string | null;
  rawBucket: string | null;
  source: 'SUPABASE_ATTACHMENTS_BUCKET' | 'default';
};

const CANONICAL_CHAT_ATTACHMENT_BUCKET = 'message-media';
const SUPPORTED_ATTACHMENT_TYPES = new Set<string>(SUPPORTED_ATTACHMENT_MIME_TYPES);
const SUPPORTED_ATTACHMENT_EXTENSION_SET = new Set<string>(
  SUPPORTED_ATTACHMENT_EXTENSIONS,
);
const SUPPORTED_VOICE_ATTACHMENT_TYPES = new Set([
  'audio/webm',
  'audio/mp4',
  'audio/ogg',
  'audio/mpeg',
  'audio/mp3',
  'audio/m4a',
  'audio/aac',
  'audio/wav',
  'audio/x-wav',
]);

function readServerEnvironmentValue(name: string) {
  const rawValue = globalThis.process?.env?.[name];

  if (typeof rawValue !== 'string') {
    return null;
  }

  const trimmedValue = rawValue.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
}

function normalizeChatAttachmentBucketName(value: string | null | undefined) {
  const normalizedValue = value?.trim() || null;

  if (!normalizedValue) {
    return null;
  }

  if (normalizedValue === 'message-attachments') {
    return CANONICAL_CHAT_ATTACHMENT_BUCKET;
  }

  return normalizedValue;
}

function resolveChatAttachmentBucketConfig(): ChatAttachmentBucketConfig {
  const serverBucket = readServerEnvironmentValue('SUPABASE_ATTACHMENTS_BUCKET');
  const ignoredPublicBucket = readServerEnvironmentValue(
    'NEXT_PUBLIC_SUPABASE_ATTACHMENTS_BUCKET',
  );
  const configuredBucketNormalized =
    normalizeChatAttachmentBucketName(serverBucket) ?? null;

  if (serverBucket) {
    return {
      actualBucket: CANONICAL_CHAT_ATTACHMENT_BUCKET,
      configuredBucketNormalized,
      ignoredPublicBucket,
      rawBucket: serverBucket,
      source: 'SUPABASE_ATTACHMENTS_BUCKET',
    };
  }

  return {
    actualBucket: CANONICAL_CHAT_ATTACHMENT_BUCKET,
    configuredBucketNormalized,
    ignoredPublicBucket,
    rawBucket: null,
    source: 'default',
  };
}

export const CHAT_ATTACHMENT_BUCKET_CONFIG = resolveChatAttachmentBucketConfig();
export const CHAT_ATTACHMENT_BUCKET = CHAT_ATTACHMENT_BUCKET_CONFIG.actualBucket;

export function getAttachmentFileExtension(
  fileName: string | null | undefined,
) {
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

export function isSupportedChatAttachmentType(
  mimeType: string,
  fileName?: string | null,
) {
  const normalizedMimeType = mimeType.trim().toLowerCase();

  if (SUPPORTED_ATTACHMENT_TYPES.has(normalizedMimeType)) {
    return true;
  }

  if (!isBinaryAttachmentMimeType(normalizedMimeType)) {
    return false;
  }

  const extension = getAttachmentFileExtension(fileName);
  return Boolean(extension && SUPPORTED_ATTACHMENT_EXTENSION_SET.has(extension));
}

export function sanitizeAttachmentFileName(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return 'attachment';
  }

  return trimmed
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

export function isBucketNotFoundStorageErrorMessage(message: string) {
  return message.toLowerCase().includes('bucket not found');
}

export function getChatAttachmentBucketRequirementErrorMessage() {
  console.error('[message-attachment-storage]', {
    issue: 'bucket-not-found',
    bucket: CHAT_ATTACHMENT_BUCKET,
    bucket_used_for_upload: CHAT_ATTACHMENT_BUCKET,
    bucket_configured_normalized:
      CHAT_ATTACHMENT_BUCKET_CONFIG.configuredBucketNormalized,
    bucket_ignored_public: CHAT_ATTACHMENT_BUCKET_CONFIG.ignoredPublicBucket,
    bucket_raw: CHAT_ATTACHMENT_BUCKET_CONFIG.rawBucket,
    bucket_source: CHAT_ATTACHMENT_BUCKET_CONFIG.source,
    setupSql: 'docs/sql/2026-04-06-message-attachments-storage-policies.sql',
  });

  return 'Chat attachment uploads are not available right now.';
}

export function isSupportedVoiceAttachmentType(mimeType: string | null) {
  return Boolean(mimeType && SUPPORTED_VOICE_ATTACHMENT_TYPES.has(mimeType));
}

export function normalizeVoiceDurationMs(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  const normalized = Math.max(0, Math.round(value));
  return normalized >= 0 ? normalized : null;
}

export function getAttachmentMessageKind(mimeType: string | null) {
  if (isSupportedVoiceAttachmentType(mimeType)) {
    return 'voice' as const;
  }

  return 'attachment' as const;
}
