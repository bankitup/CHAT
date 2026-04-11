import 'server-only';

import { cookies } from 'next/headers';
import type { User } from '@supabase/supabase-js';
import {
  getRequestViewer,
  getRequestSupabaseServerClient,
  requireRequestViewer,
} from '@/lib/request-context/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service';
import { normalizeLanguage, type AppLanguage } from '@/modules/i18n';
import {
  buildAvatarDeliveryPath,
  isAbsoluteAvatarUrl,
} from '@/modules/messaging/avatar-delivery';
import { buildMessageInsertPayload } from '@/modules/messaging/data/message-shell';
import {
  resolveInboxAttachmentPreviewKind,
  resolveInboxAttachmentPreviewKindFromMetadata,
  type InboxAttachmentPreviewKind,
} from '@/modules/messaging/inbox/preview-kind';
import {
  resolveMessagingAssetKindFromMimeType,
  resolveMessagingAttachmentMimeType,
} from '@/modules/messaging/media/message-assets';
import {
  canAddParticipantsToGroupConversation,
  canEditGroupConversationIdentity,
  canRemoveParticipantFromGroupConversation,
  normalizeGroupConversationJoinPolicy,
} from '@/modules/messaging/group-policy';
import {
  isSupportedProfileAvatarType,
  sanitizeProfileFileName,
} from '@/modules/messaging/profile-avatar';
import { DM_E2EE_CURRENT_DEVICE_COOKIE } from '@/modules/messaging/e2ee/current-device-cookie';
import type { EncryptedDmServerHistoryHint } from '@/modules/messaging/e2ee/ui-policy';
import {
  applyConversationVisibility,
  isHiddenAtVisibilityRuntimeError,
} from '@/modules/messaging/data/visibility';
import { requireExactSpaceAccessForUser } from '@/modules/spaces/server';
import type {
  DmE2eeApiErrorCode,
  DmE2eeBootstrapDebugState,
  DmE2eeDevicePublishResultKind,
  DmE2eeMessageKind,
  DmE2eeRecipientReadinessDebugState,
  DmE2eeRecipientBundleResponse,
  DmE2eeSendDebugState,
  DmE2eeSendRequest,
  PublishDmE2eeDeviceRequest,
  PublishDmE2eeDeviceResult,
  StoredDmE2eeEnvelope,
  UserDevicePublicBundle,
} from '@/modules/messaging/contract/dm-e2ee';

class DmE2eeOperationError extends Error {
  code: DmE2eeApiErrorCode;

  constructor(code: DmE2eeApiErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

export function isDmE2eeOperationError(
  error: unknown,
): error is DmE2eeOperationError {
  return (
    error instanceof Error &&
    'code' in error &&
    typeof (error as { code?: unknown }).code === 'string'
  );
}

function createDmE2eeOperationError(
  code: DmE2eeApiErrorCode,
  message: string,
) {
  return new DmE2eeOperationError(code, message);
}

function applyRecipientReadinessDebugState(
  error: Error,
  details?: DmE2eeRecipientReadinessDebugState,
) {
  const target = error as Error & DmE2eeRecipientReadinessDebugState;
  target.recipientBundleQueryStage = details?.recipientBundleQueryStage ?? null;
  target.recipientConversationIdChecked =
    details?.recipientConversationIdChecked ?? null;
  target.recipientRequestedUserId =
    details?.recipientRequestedUserId ?? null;
  target.recipientUserIdChecked = details?.recipientUserIdChecked ?? null;
  target.recipientDeviceRowsFound = details?.recipientDeviceRowsFound ?? null;
  target.recipientActiveDeviceRowsFound =
    details?.recipientActiveDeviceRowsFound ?? null;
  target.recipientSelectedDeviceRowId =
    details?.recipientSelectedDeviceRowId ?? null;
  target.recipientSelectedDeviceLogicalId =
    details?.recipientSelectedDeviceLogicalId ?? null;
  target.recipientSelectedDeviceRetiredAt =
    details?.recipientSelectedDeviceRetiredAt ?? null;
  target.recipientSelectedDeviceIdentityKeyPresent =
    details?.recipientSelectedDeviceIdentityKeyPresent ?? null;
  target.recipientSelectedDeviceSignedPrekeyPresent =
    details?.recipientSelectedDeviceSignedPrekeyPresent ?? null;
  target.recipientSelectedDeviceSignaturePresent =
    details?.recipientSelectedDeviceSignaturePresent ?? null;
  target.recipientSelectedDeviceAvailablePrekeyCount =
    details?.recipientSelectedDeviceAvailablePrekeyCount ?? null;
  target.recipientPrekeyQueryDeviceRef =
    details?.recipientPrekeyQueryDeviceRef ?? null;
  target.recipientBundleQueryErrorMessage =
    details?.recipientBundleQueryErrorMessage ?? null;
  target.recipientBundleQueryErrorCode =
    details?.recipientBundleQueryErrorCode ?? null;
  target.recipientBundleQueryErrorDetails =
    details?.recipientBundleQueryErrorDetails ?? null;
  target.recipientMismatchLeft = details?.recipientMismatchLeft ?? null;
  target.recipientMismatchRight = details?.recipientMismatchRight ?? null;
  target.recipientReadinessFailedReason =
    details?.recipientReadinessFailedReason ?? null;
  return target;
}

function createDmE2eeRecipientReadinessError(
  code: DmE2eeApiErrorCode,
  message: string,
  details?: DmE2eeRecipientReadinessDebugState,
) {
  return applyRecipientReadinessDebugState(
    createDmE2eeOperationError(code, message),
    details,
  );
}

function createDmE2eeRecipientLookupError(
  message: string,
  details?: DmE2eeRecipientReadinessDebugState,
) {
  return applyRecipientReadinessDebugState(new Error(message), details);
}

function applyDmE2eeSendDebugState(
  error: Error,
  details?: DmE2eeSendDebugState,
) {
  const target = error as Error & DmE2eeSendDebugState;
  target.sendExactFailureStage = details?.sendExactFailureStage ?? null;
  target.sendFailedOperation = details?.sendFailedOperation ?? null;
  target.sendReasonCode = details?.sendReasonCode ?? null;
  target.sendErrorMessage = details?.sendErrorMessage ?? null;
  target.sendErrorCode = details?.sendErrorCode ?? null;
  target.sendErrorDetails = details?.sendErrorDetails ?? null;
  target.sendErrorHint = details?.sendErrorHint ?? null;
  target.sendSelectedConversationId = details?.sendSelectedConversationId ?? null;
  target.sendSenderUserId = details?.sendSenderUserId ?? null;
  target.sendRecipientUserId = details?.sendRecipientUserId ?? null;
  target.sendSelectedSenderDeviceRowId =
    details?.sendSelectedSenderDeviceRowId ?? null;
  target.sendSelectedRecipientDeviceRowId =
    details?.sendSelectedRecipientDeviceRowId ?? null;
  return target;
}

function createDmE2eeSendProofError(
  message: string,
  details?: DmE2eeSendDebugState,
) {
  return applyDmE2eeSendDebugState(new Error(message), details);
}

function logDmE2eeRecipientBundleDiagnostics(
  stage: string,
  details?: Record<string, unknown>,
) {
  if (process.env.CHAT_DEBUG_DM_E2EE_BUNDLE !== '1') {
    return;
  }

  if (details) {
    console.info('[dm-e2ee-recipient-bundle]', stage, details);
    return;
  }

  console.info('[dm-e2ee-recipient-bundle]', stage);
}

function logDmE2eeSendDiagnostics(
  stage: string,
  details?: Record<string, unknown>,
) {
  if (process.env.CHAT_DEBUG_DM_E2EE_SEND !== '1') {
    return;
  }

  if (details) {
    console.info('[dm-e2ee-send]', stage, details);
    return;
  }

  console.info('[dm-e2ee-send]', stage);
}

function logDmE2eeBootstrapDiagnostics(
  stage: string,
  details?: Record<string, unknown>,
) {
  if (process.env.CHAT_DEBUG_DM_E2EE_BOOTSTRAP !== '1') {
    return;
  }

  if (details) {
    console.info('[dm-e2ee-bootstrap]', stage, details);
    return;
  }

  console.info('[dm-e2ee-bootstrap]', stage);
}

function isSupabasePermissionDeniedError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  const diagnostics = getSupabaseErrorDiagnostics(error);
  const errorCode =
    typeof diagnostics.error_code === 'string'
      ? diagnostics.error_code.toLowerCase()
      : null;

  return (
    errorCode === '42501' ||
    message.includes('row-level security') ||
    message.includes('permission denied')
  );
}

function logConversationSchemaDiagnostics(
  stage: string,
  details?: Record<string, unknown>,
) {
  if (process.env.CHAT_DEBUG_SCHEMA !== '1') {
    return;
  }

  if (details) {
    console.info('[conversation-schema]', stage, details);
    return;
  }

  console.info('[conversation-schema]', stage);
}

function isDmE2eeDevResetEnabled() {
  return (
    process.env.NODE_ENV !== 'production' ||
    process.env.CHAT_DEBUG_DM_E2EE_BOOTSTRAP === '1'
  );
}

type ConversationRecord = {
  id: string;
  kind: string | null;
  title?: string | null;
  avatar_path?: string | null;
  join_policy?: string | null;
  space_id?: string | null;
  created_by?: string | null;
  last_message_at?: string | null;
  created_at?: string | null;
  last_message_id?: string | null;
  last_message_seq?: number | string | null;
  last_message_sender_id?: string | null;
  last_message_kind?: string | null;
  last_message_content_mode?: string | null;
  last_message_deleted_at?: string | null;
  last_message_body?: string | null;
};

type ConversationMemberRow = {
  conversation_id: string;
  state?: string | null;
  hidden_at?: string | null;
  notification_level?: string | null;
  last_read_message_seq?: number | null;
  last_read_at?: string | null;
  visible_from_seq?: number | null;
  conversations: ConversationRecord | ConversationRecord[] | null;
};

export type InboxConversation = {
  conversationId: string;
  spaceId: string | null;
  title: string | null;
  avatarPath: string | null;
  createdBy?: string | null;
  lastMessageAt: string | null;
  createdAt: string | null;
  kind?: string | null;
  hiddenAt: string | null;
  lastReadMessageSeq: number | null;
  lastReadAt: string | null;
  latestMessageId: string | null;
  latestMessageSeq: number | null;
  latestMessageSenderId: string | null;
  latestMessageAttachmentKind: InboxAttachmentPreviewKind | null;
  latestMessageBody: string | null;
  latestMessageKind: string | null;
  latestMessageContentMode: string | null;
  latestMessageDeletedAt: string | null;
  unreadCount: number;
};

export type InboxConversationSummarySnapshot = {
  conversationId: string;
  createdAt: string | null;
  hiddenAt: string | null;
  lastMessageAt: string | null;
  lastReadAt: string | null;
  lastReadMessageSeq: number | null;
  latestMessageAttachmentKind: InboxAttachmentPreviewKind | null;
  latestMessageBody: string | null;
  latestMessageContentMode: string | null;
  latestMessageDeletedAt: string | null;
  latestMessageId: string | null;
  latestMessageKind: string | null;
  latestMessageSenderId: string | null;
  latestMessageSeq: number | null;
  unreadCount: number;
};

export type ConversationNotificationLevel = 'default' | 'muted';

export type ConversationMessage = {
  id: string;
  conversation_id: string;
  sender_id: string | null;
  reply_to_message_id: string | null;
  seq: number | string;
  kind: string;
  client_id: string | null;
  body: string | null;
  content_mode?: string | null;
  sender_device_id?: string | null;
  edited_at: string | null;
  deleted_at: string | null;
  created_at: string | null;
};

export type ConversationHistoryPageSnapshot = {
  attachmentsByMessage: Array<{
    attachments: MessageAttachment[];
    messageId: string;
  }>;
  dmE2ee:
    | {
        activeDeviceCreatedAt: string | null;
        activeDeviceRecordId: string | null;
        envelopesByMessage: Array<{
          envelope: StoredDmE2eeEnvelope;
          messageId: string;
        }>;
        historyHintsByMessage: Array<{
          hint: EncryptedDmServerHistoryHint;
          messageId: string;
        }>;
        selectionSource: string | null;
      }
    | null;
  hasMoreOlder: boolean;
  messages: ConversationMessage[];
  oldestMessageSeq: number | null;
  reactionsByMessage: Array<{
    messageId: string;
    reactions: MessageReactionGroup[];
  }>;
  senderProfiles: MessageSenderProfile[];
};

type MessageAttachmentRow = {
  id: string;
  message_id: string;
  bucket: string;
  object_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string | null;
};

type MessageAssetAttachmentRow = {
  asset_id: string;
  created_at: string | null;
  duration_ms: number | null;
  external_url: string | null;
  file_name: string | null;
  kind: 'image' | 'file' | 'audio' | 'voice-note';
  message_id: string;
  mime_type: string | null;
  size_bytes: number | null;
  source: 'supabase-storage' | 'external-url';
  storage_bucket: string | null;
  storage_object_path: string | null;
};

type MessageAttachmentPreviewRow = {
  created_at: string | null;
  message_id: string;
  mime_type: string | null;
};

type MessageAssetPreviewRow = {
  created_at: string | null;
  message_assets:
    | {
        kind: 'image' | 'file' | 'audio' | 'voice-note';
        mime_type?: string | null;
      }
    | Array<{
        kind: 'image' | 'file' | 'audio' | 'voice-note';
        mime_type?: string | null;
      }>
    | null;
  message_id: string;
};

export type MessageAttachment = {
  id: string;
  messageId: string;
  bucket: string;
  objectPath: string;
  mimeType: string | null;
  sizeBytes: number | null;
  durationMs?: number | null;
  createdAt: string | null;
  fileName: string;
  signedUrl: string | null;
  isImage: boolean;
  isAudio: boolean;
  isVoiceMessage: boolean;
};

type MessageAssetsWriteClient =
  Awaited<ReturnType<typeof createSupabaseServerClient>>;

export type MessageSenderProfile = {
  userId: string;
  displayName: string | null;
  username?: string | null;
  email?: string | null;
  emailLocalPart?: string | null;
  avatarPath?: string | null;
  statusEmoji?: string | null;
  statusText?: string | null;
  statusUpdatedAt?: string | null;
};

export type AvailableUser = {
  userId: string;
  displayName: string | null;
  username?: string | null;
  email?: string | null;
  emailLocalPart?: string | null;
  avatarPath?: string | null;
  statusEmoji?: string | null;
  statusText?: string | null;
  statusUpdatedAt?: string | null;
};

export type CurrentUserProfile = {
  userId: string;
  email: string | null;
  displayName: string | null;
  username: string | null;
  avatarPath: string | null;
  preferredLanguage: AppLanguage | null;
  statusEmoji: string | null;
  statusText: string | null;
  statusUpdatedAt: string | null;
};

export type ConversationReadState = {
  lastReadMessageSeq: number | null;
  lastReadAt: string | null;
};

export type ConversationMemberReadState = {
  userId: string;
  lastReadMessageSeq: number | null;
  lastReadAt: string | null;
};

export type ConversationParticipant = {
  userId: string;
  role: string | null;
  state: string | null;
};

export type ConversationParticipantIdentity = {
  conversationId: string;
  userId: string;
  displayName: string | null;
  username?: string | null;
  email?: string | null;
  emailLocalPart?: string | null;
  avatarPath?: string | null;
  statusEmoji?: string | null;
  statusText?: string | null;
  statusUpdatedAt?: string | null;
};

export type ConversationMessageStats = {
  totalMessages: number;
  perSenderCount: Map<string, number>;
};

type ConversationNameInput = {
  kind: string | null;
  title?: string | null;
  participantLabels: string[];
  fallbackTitles?: {
    dm?: string;
    group?: string;
  };
};

type MessageReactionRow = {
  id: string;
  message_id: string;
  emoji: string;
  user_id: string;
  created_at: string | null;
};

export type MessageReactionGroup = {
  emoji: string;
  count: number;
  selectedByCurrentUser: boolean;
};

type MessageE2eeEnvelopeRow = {
  message_id: string;
  recipient_device_id: string;
  envelope_type: string;
  ciphertext: string;
  used_one_time_prekey_id: number | null;
  created_at: string | null;
  messages:
    | { sender_device_id?: string | null; sender_id?: string | null }
    | Array<{ sender_device_id?: string | null; sender_id?: string | null }>
    | null;
};

export const STARTER_REACTIONS = ['❤️', '👍', '😂', '😮', '😢', '🎉'] as const;
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
export const PROFILE_AVATAR_MAX_SIZE_BYTES = 5 * 1024 * 1024;
export const PROFILE_AVATAR_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif';

const CANONICAL_CHAT_ATTACHMENT_BUCKET = 'message-media';

type ChatAttachmentBucketConfig = {
  actualBucket: string;
  configuredBucketNormalized: string | null;
  ignoredPublicBucket: string | null;
  rawBucket: string | null;
  source: 'SUPABASE_ATTACHMENTS_BUCKET' | 'default';
};

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

const CHAT_ATTACHMENT_BUCKET_CONFIG = resolveChatAttachmentBucketConfig();
const CHAT_ATTACHMENT_BUCKET = CHAT_ATTACHMENT_BUCKET_CONFIG.actualBucket;
const PROFILE_AVATAR_BUCKET =
  process.env.SUPABASE_AVATARS_BUCKET?.trim() || 'avatars';
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
function getAttachmentFileExtension(fileName: string | null | undefined) {
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

function normalizeConversation(
  value: ConversationRecord | ConversationRecord[] | null,
) {
  if (!value) {
    return null;
  }

  return Array.isArray(value) ? value[0] ?? null : value;
}

function normalizeJoinedRecord<T>(value: T | T[] | null) {
  if (!value) {
    return null;
  }

  return Array.isArray(value) ? value[0] ?? null : value;
}

function isMissingColumnErrorMessage(message: string, columnName: string) {
  const normalizedMessage = message.toLowerCase();
  return (
    normalizedMessage.includes('column') &&
    normalizedMessage.includes(columnName.toLowerCase())
  );
}

const CONVERSATION_SUMMARY_PROJECTION_COLUMNS = [
  'last_message_id',
  'last_message_seq',
  'last_message_sender_id',
  'last_message_kind',
  'last_message_content_mode',
  'last_message_deleted_at',
  'last_message_body',
] as const;

type ConversationSummaryProjectionAvailability =
  | 'unknown'
  | 'available'
  | 'missing';

let conversationSummaryProjectionAvailability: ConversationSummaryProjectionAvailability =
  'unknown';

function isMissingConversationSummaryProjectionErrorMessage(message: string) {
  return CONVERSATION_SUMMARY_PROJECTION_COLUMNS.some((columnName) =>
    isMissingColumnErrorMessage(message, columnName),
  );
}

function markConversationSummaryProjectionAvailability(
  next: ConversationSummaryProjectionAvailability,
  reason?: string,
) {
  if (conversationSummaryProjectionAvailability === next) {
    return;
  }

  conversationSummaryProjectionAvailability = next;

  logConversationSchemaDiagnostics(
    `conversation-summary-projection:${next}`,
    reason ? { reason } : undefined,
  );
}

function normalizeConversationLatestMessageSeq(value: number | string | null | undefined) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function normalizeConversationMemberVisibleFromSeq(
  value: number | string | null | undefined,
) {
  const normalizedValue = normalizeConversationLatestMessageSeq(value);

  if (normalizedValue === null) {
    return null;
  }

  return normalizedValue > 0 ? normalizedValue : null;
}

function resolveConversationVisibleReadFloorSeq(
  visibleFromSeq: number | null,
) {
  if (visibleFromSeq === null) {
    return null;
  }

  return Math.max(0, visibleFromSeq - 1);
}

function resolveConversationEffectiveLastReadSeq(input: {
  lastReadMessageSeq: number | null;
  visibleFromSeq?: number | null;
}) {
  const baselineReadFloorSeq = resolveConversationVisibleReadFloorSeq(
    input.visibleFromSeq ?? null,
  );
  return input.lastReadMessageSeq === null
    ? baselineReadFloorSeq
    : baselineReadFloorSeq === null
      ? input.lastReadMessageSeq
      : Math.max(input.lastReadMessageSeq, baselineReadFloorSeq);
}

async function countConversationUnreadIncomingMessages(input: {
  conversationId: string;
  currentUserId: string;
  lastReadMessageSeq: number | null;
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  visibleFromSeq?: number | null;
}) {
  const effectiveLastReadSeq = resolveConversationEffectiveLastReadSeq({
    lastReadMessageSeq: input.lastReadMessageSeq,
    visibleFromSeq: input.visibleFromSeq ?? null,
  });

  let unreadQuery = input.supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('conversation_id', input.conversationId)
    .neq('sender_id', input.currentUserId);

  if (effectiveLastReadSeq !== null) {
    unreadQuery = unreadQuery.gt('seq', effectiveLastReadSeq);
  }

  const unreadResponse = await unreadQuery;

  if (unreadResponse.error) {
    throw new Error(unreadResponse.error.message);
  }

  return Number(unreadResponse.count ?? 0);
}

async function loadUnreadIncomingCountByConversation(input: {
  currentUserId: string;
  rows: ConversationMemberRow[];
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
}) {
  const unreadCounts = await Promise.all(
    input.rows.map(async (row) => {
      const lastReadMessageSeq =
        typeof row.last_read_message_seq === 'number'
          ? row.last_read_message_seq
          : null;
      const visibleFromSeq = normalizeConversationMemberVisibleFromSeq(
        row.visible_from_seq,
      );

      return [
        row.conversation_id,
        await countConversationUnreadIncomingMessages({
          conversationId: row.conversation_id,
          currentUserId: input.currentUserId,
          lastReadMessageSeq,
          supabase: input.supabase,
          visibleFromSeq,
        }),
      ] as const;
    }),
  );

  return new Map(unreadCounts);
}

function getConversationSummarySelect(input?: {
  includeAvatarPath?: boolean;
  includeGroupJoinPolicy?: boolean;
  includeSpaceId?: boolean;
  includeSummaryProjection?: boolean;
}) {
  const includeSummaryProjection =
    input?.includeSummaryProjection !== false &&
    conversationSummaryProjectionAvailability !== 'missing';
  const columns = [
    'id',
    'kind',
    'title',
    ...(input?.includeAvatarPath === false ? [] : ['avatar_path']),
    ...(input?.includeGroupJoinPolicy ? ['join_policy'] : []),
    ...(input?.includeSpaceId === false ? [] : ['space_id']),
    'created_by',
    'last_message_at',
    'created_at',
    ...(includeSummaryProjection
      ? [
          'last_message_id',
          'last_message_seq',
          'last_message_sender_id',
          'last_message_kind',
          'last_message_content_mode',
          'last_message_deleted_at',
          'last_message_body',
        ]
      : []),
  ];

  return columns.join(', ');
}

function createSchemaRequirementError(details: string) {
  return new Error(
    `${details} Apply the documented Supabase changes in /Users/danya/IOS - Apps/CHAT/docs/schema-assumptions.md.`,
  );
}

function createDmE2eeBootstrapPublishError(
  failurePoint: string,
  message: string,
  details?: DmE2eeBootstrapDebugState,
) {
  const error = new Error(`[${failurePoint}] ${message}`) as Error &
    DmE2eeBootstrapDebugState;
  error.authRetireAttempted = details?.authRetireAttempted ?? null;
  error.authRetireFailed = details?.authRetireFailed ?? null;
  error.serviceRetireAvailable = details?.serviceRetireAvailable ?? null;
  error.serviceRetireSkipReason = details?.serviceRetireSkipReason ?? null;
  error.serviceRetireAttempted = details?.serviceRetireAttempted ?? null;
  error.serviceRetireSucceeded = details?.serviceRetireSucceeded ?? null;
  error.serviceRetireFailed = details?.serviceRetireFailed ?? null;
  error.serviceRetireErrorMessage = details?.serviceRetireErrorMessage ?? null;
  error.serviceRetireErrorCode = details?.serviceRetireErrorCode ?? null;
  error.serviceRetireErrorStatus = details?.serviceRetireErrorStatus ?? null;
  error.currentDeviceRowId = details?.currentDeviceRowId ?? null;
  error.retireTargetIds = details?.retireTargetIds ?? null;
  return error;
}

function getSupabaseErrorDiagnostics(error: unknown) {
  if (!error || typeof error !== 'object') {
    return {};
  }

  const details = error as {
    code?: string | null;
    status?: number | null;
    details?: string | null;
    hint?: string | null;
  };

  return {
    error_code: details.code ?? null,
    error_status: details.status ?? null,
    error_details: details.details ?? null,
    error_hint: details.hint ?? null,
  };
}

function logProfileSettingsDiagnostics(
  stage: string,
  details?: Record<string, unknown>,
) {
  if (details) {
    console.error('[profile-settings]', stage, details);
    return;
  }

  console.error('[profile-settings]', stage);
}

function isMissingRelationErrorMessage(message: string, relationName: string) {
  const normalizedMessage = message.toLowerCase();
  return (
    normalizedMessage.includes('relation') &&
    normalizedMessage.includes(relationName.toLowerCase())
  );
}

function shouldLogChatHistoryDiagnostics() {
  return (
    process.env.CHAT_DEBUG_DM_E2EE_BOOTSTRAP === '1' ||
    process.env.NEXT_PUBLIC_CHAT_DEBUG_LIVE_REFRESH === '1'
  );
}

function logChatHistoryDiagnostics(
  stage: string,
  details?: Record<string, unknown>,
  level: 'info' | 'warn' | 'error' = 'info',
) {
  const shouldLog = level === 'error' || shouldLogChatHistoryDiagnostics();

  if (!shouldLog) {
    return;
  }

  if (details) {
    console[level]('[chat-history-load]', stage, details);
    return;
  }

  console[level]('[chat-history-load]', stage);
}

function shouldLogVoiceSendDiagnostics() {
  return (
    process.env.NEXT_PUBLIC_CHAT_DEBUG_VOICE === '1' ||
    process.env.CHAT_DEBUG_DM_E2EE_BOOTSTRAP === '1'
  );
}

function shouldLogChatThreadSnapshotDiagnostics() {
  return (
    process.env.CHAT_DEBUG_DM_E2EE_BOOTSTRAP === '1' ||
    process.env.NEXT_PUBLIC_CHAT_DEBUG_LIVE_REFRESH === '1' ||
    process.env.CHAT_DEBUG_THREAD_SNAPSHOT === '1'
  );
}

function logVoiceSendDiagnostics(
  stage: string,
  details?: Record<string, unknown>,
  level: 'info' | 'warn' | 'error' = 'info',
) {
  const shouldLog = level === 'error' || shouldLogVoiceSendDiagnostics();

  if (!shouldLog) {
    return;
  }

  if (details) {
    console[level]('[voice-send]', stage, details);
    return;
  }

  console[level]('[voice-send]', stage);
}

function logChatThreadSnapshotCheckpoint(
  stage: string,
  details?: Record<string, unknown>,
) {
  if (!shouldLogChatThreadSnapshotDiagnostics()) {
    return;
  }

  if (details) {
    console.info('[chat-thread-snapshot]', stage, details);
    return;
  }

  console.info('[chat-thread-snapshot]', stage);
}

function logSpaceMembershipDiagnostics(
  stage: string,
  details?: Record<string, unknown>,
) {
  if (process.env.CHAT_DEBUG_SPACES_SSR !== '1') {
    return;
  }

  if (details) {
    console.info('[space-members-query]', stage, details);
    return;
  }

  console.info('[space-members-query]', stage);
}

function isMissingFunctionErrorMessage(message: string, functionName: string) {
  const normalizedMessage = message.toLowerCase();
  return (
    (normalizedMessage.includes('function') ||
      normalizedMessage.includes('could not find the function')) &&
    normalizedMessage.includes(functionName.toLowerCase())
  );
}

export function isUniqueConstraintErrorMessage(message: string, constraintName?: string) {
  const normalizedMessage = message.toLowerCase();
  return (
    normalizedMessage.includes('duplicate key') ||
    normalizedMessage.includes('unique constraint') ||
    (constraintName ? normalizedMessage.includes(constraintName.toLowerCase()) : false)
  );
}

function uniqueNonEmptyLabels(labels: string[]) {
  return Array.from(
    new Set(labels.map((label) => label.trim()).filter(Boolean)),
  );
}

function buildCanonicalDmConversationKey(leftUserId: string, rightUserId: string) {
  return [leftUserId, rightUserId].filter(Boolean).sort().join(':');
}

function buildSpaceScopedDmConversationKey(input: {
  leftUserId: string;
  rightUserId: string;
  spaceId?: string | null;
}) {
  const canonicalKey = buildCanonicalDmConversationKey(
    input.leftUserId,
    input.rightUserId,
  );
  const normalizedSpaceId = input.spaceId?.trim() || null;

  if (!canonicalKey || !normalizedSpaceId) {
    return canonicalKey;
  }

  // Compatibility seam for environments that still enforce global dm_key
  // uniqueness. New spaceful DMs can still coexist across spaces while exact
  // pair reuse inside the current space stays enforced by the lookup path.
  return `${normalizedSpaceId}::${canonicalKey}`;
}

function buildDmConversationLookupKeys(input: {
  leftUserId: string;
  rightUserId: string;
  spaceId?: string | null;
}) {
  const canonicalKey = buildCanonicalDmConversationKey(
    input.leftUserId,
    input.rightUserId,
  );
  const spaceScopedKey = buildSpaceScopedDmConversationKey(input);

  return Array.from(
    new Set([canonicalKey, spaceScopedKey].map((value) => value?.trim()).filter(Boolean)),
  );
}

async function findExistingDmConversationByKey(input: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  creatorUserId: string;
  otherUserId: string;
  spaceId?: string | null;
}) {
  const dmConversationKeys = buildDmConversationLookupKeys({
    leftUserId: input.creatorUserId,
    rightUserId: input.otherUserId,
    spaceId: input.spaceId ?? null,
  });

  if (dmConversationKeys.length === 0) {
    return null;
  }

  let directKeyLookup = input.supabase
    .from('conversations')
    .select(
      input.spaceId
        ? 'id, kind, dm_key, space_id, created_at, last_message_at'
        : 'id, kind, dm_key, created_at, last_message_at',
    )
    .eq('kind', 'dm')
    .in('dm_key', dmConversationKeys);

  if (input.spaceId) {
    directKeyLookup = directKeyLookup.eq('space_id', input.spaceId);
  }

  const { data, error } = await directKeyLookup
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: true })
    .limit(1);

  if (error) {
    if (
      isMissingColumnErrorMessage(error.message, 'dm_key') ||
      isMissingColumnErrorMessage(error.message, 'space_id')
    ) {
      return null;
    }

    throw new Error(error.message);
  }

  const match = ((data ?? []) as Array<{ id?: string | null }>)[0]?.id?.trim() || null;
  return match;
}

type DmConversationLookupCandidate = {
  conversationId: string;
  createdAt: string | null;
  lastMessageAt: string | null;
};

async function selectCanonicalExactPairDmConversationId(input: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  candidateRows: Array<{
    conversation_id: string;
    conversations:
      | {
          id: string;
          kind: string | null;
          created_at?: string | null;
          last_message_at?: string | null;
        }
      | Array<{
          id: string;
          kind: string | null;
          created_at?: string | null;
          last_message_at?: string | null;
        }>
      | null;
  }>;
  expectedUserIds: string[];
}) {
  const candidateConversations = input.candidateRows
    .map((row) => {
      const conversation = normalizeConversation(row.conversations);

      if (!conversation || conversation.kind !== 'dm') {
        return null;
      }

      return {
        conversationId: row.conversation_id,
        createdAt: conversation.created_at ?? null,
        lastMessageAt: conversation.last_message_at ?? null,
      } satisfies DmConversationLookupCandidate;
    })
    .filter((row): row is DmConversationLookupCandidate => Boolean(row));

  if (candidateConversations.length === 0) {
    return null;
  }

  const { data: candidateMembers, error: candidateMembersError } = await input.supabase
    .from('conversation_members')
    .select('conversation_id, user_id')
    .in(
      'conversation_id',
      candidateConversations.map((conversation) => conversation.conversationId),
    )
    .eq('state', 'active');

  if (candidateMembersError) {
    throw new Error(candidateMembersError.message);
  }

  const expectedUserIds = new Set(input.expectedUserIds);
  const memberIdsByConversation = new Map<string, Set<string>>();

  for (const row of (candidateMembers ?? []) as Array<{
    conversation_id: string;
    user_id: string;
  }>) {
    const memberIds =
      memberIdsByConversation.get(row.conversation_id) ?? new Set<string>();
    memberIds.add(row.user_id);
    memberIdsByConversation.set(row.conversation_id, memberIds);
  }

  const exactPairCandidates = candidateConversations.filter((conversation) => {
    const memberIds = memberIdsByConversation.get(conversation.conversationId);

    if (!memberIds || memberIds.size !== expectedUserIds.size) {
      return false;
    }

    for (const userId of expectedUserIds) {
      if (!memberIds.has(userId)) {
        return false;
      }
    }

    return true;
  });

  if (exactPairCandidates.length === 0) {
    return null;
  }

  exactPairCandidates.sort((left, right) => {
    const leftRank = left.lastMessageAt ?? left.createdAt ?? '';
    const rightRank = right.lastMessageAt ?? right.createdAt ?? '';

    if (leftRank !== rightRank) {
      return rightRank.localeCompare(leftRank);
    }

    const leftCreatedAt = left.createdAt ?? '';
    const rightCreatedAt = right.createdAt ?? '';

    if (leftCreatedAt !== rightCreatedAt) {
      return leftCreatedAt.localeCompare(rightCreatedAt);
    }

    return left.conversationId.localeCompare(right.conversationId);
  });

  return exactPairCandidates[0]?.conversationId ?? null;
}

export function getConversationDisplayName({
  kind,
  title,
  participantLabels,
  fallbackTitles,
}: ConversationNameInput) {
  const normalizedTitle = title?.trim() ?? '';
  const labels = uniqueNonEmptyLabels(participantLabels);

  if (kind === 'group') {
    if (normalizedTitle) {
      return normalizedTitle;
    }

    return labels.join(', ') || fallbackTitles?.group || 'New group';
  }

  return labels[0] || fallbackTitles?.dm || 'New chat';
}

export function getDirectMessageDisplayName(
  participantLabels: string[],
  fallbackLabel: string,
) {
  const labels = uniqueNonEmptyLabels(participantLabels);
  return labels[0] || fallbackLabel.trim() || 'Unknown user';
}

export function getConversationParticipantSummary(
  participantLabels: string[],
  maxVisible?: number,
) {
  const labels = uniqueNonEmptyLabels(participantLabels);

  if (labels.length === 0) {
    return null;
  }

  if (!maxVisible || labels.length <= maxVisible) {
    return labels.join(', ');
  }

  const preview = labels.slice(0, maxVisible);
  const remaining = labels.length - preview.length;

  return `${preview.join(', ')} +${remaining}`;
}

async function getConversationsByVisibility(
  userId: string,
  archived: boolean,
  options?: {
    spaceId?: string | null;
  },
) {
  const supabase = await createSupabaseServerClient();
  const diagnosticsEnabled = process.env.CHAT_DEBUG_INBOX_SSR === '1';
  const logDiagnostics = (stage: string, details?: Record<string, unknown>) => {
    if (!diagnosticsEnabled) {
      return;
    }

    const prefix = archived
      ? '[inbox-visibility:archived]'
      : '[inbox-visibility:visible]';
    if (details) {
      console.info(prefix, stage, details);
      return;
    }

    console.info(prefix, stage);
  };
  logDiagnostics('start', { hasSpaceScope: Boolean(options?.spaceId) });
  const baseMembershipSelect =
    'conversation_id, state, last_read_message_seq, last_read_at, visible_from_seq';
  const baseMemberships = await supabase
    .from('conversation_members')
    .select(baseMembershipSelect)
    .eq('user_id', userId)
    .eq('state', 'active');
  const fallbackBaseMemberships =
    baseMemberships.error &&
    isMissingColumnErrorMessage(baseMemberships.error.message, 'visible_from_seq')
      ? await supabase
          .from('conversation_members')
          .select('conversation_id, state, last_read_message_seq, last_read_at')
          .eq('user_id', userId)
          .eq('state', 'active')
      : null;
  const resolvedBaseMemberships = fallbackBaseMemberships ?? baseMemberships;

  if (resolvedBaseMemberships.error) {
    logDiagnostics('base-memberships-error', {
      message: resolvedBaseMemberships.error.message,
    });
    throw new Error(resolvedBaseMemberships.error.message);
  }

  const membershipRows = (resolvedBaseMemberships.data ?? []) as ConversationMemberRow[];
  logDiagnostics('base-memberships-ok', { count: membershipRows.length });

  const fallbackVisibleConversations = async () =>
    mapInboxConversations(
      await attachConversationsToMembershipRows(membershipRows, supabase, options),
      supabase,
      userId,
    );

  try {
    logDiagnostics('visibility-lookup-start');
    const visibilityRows = await supabase
      .from('conversation_members')
      .select('conversation_id, hidden_at')
      .eq('user_id', userId)
      .eq('state', 'active');

    if (visibilityRows.error) {
      logDiagnostics('visibility-lookup-error', {
        message: visibilityRows.error.message,
        isHiddenAtRuntimeError: isHiddenAtVisibilityRuntimeError(
          visibilityRows.error.message,
        ),
      });
      if (isHiddenAtVisibilityRuntimeError(visibilityRows.error.message)) {
        logDiagnostics('fallback-from-visibility-error');
        return archived ? ([] satisfies InboxConversation[]) : fallbackVisibleConversations();
      }

      throw new Error(visibilityRows.error.message);
    }
    logDiagnostics('visibility-lookup-ok', {
      count: (visibilityRows.data ?? []).length,
    });

    const scopedMembershipRows = applyConversationVisibility(
      membershipRows,
      archived,
      (visibilityRows.data ?? []) as Array<{
        conversation_id: string;
        hidden_at: string | null;
      }>,
    ) as ConversationMemberRow[];

    return mapInboxConversations(
      await attachConversationsToMembershipRows(scopedMembershipRows, supabase, options),
      supabase,
      userId,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logDiagnostics('visibility-catch', {
      message,
      isHiddenAtRuntimeError: isHiddenAtVisibilityRuntimeError(message),
    });

    if (isHiddenAtVisibilityRuntimeError(message)) {
      logDiagnostics('fallback-from-catch');
      return archived ? ([] satisfies InboxConversation[]) : fallbackVisibleConversations();
    }

    throw error;
  }
}

async function getConversationsWithoutArchiveVisibility(
  userId: string,
  options?: {
    spaceId?: string | null;
  },
) {
  const supabase = await createSupabaseServerClient();
  const baseMembershipSelect =
    'conversation_id, state, last_read_message_seq, last_read_at, visible_from_seq';
  const baseMemberships = await supabase
    .from('conversation_members')
    .select(baseMembershipSelect)
    .eq('user_id', userId)
    .eq('state', 'active');
  const fallbackBaseMemberships =
    baseMemberships.error &&
    isMissingColumnErrorMessage(baseMemberships.error.message, 'visible_from_seq')
      ? await supabase
          .from('conversation_members')
          .select('conversation_id, state, last_read_message_seq, last_read_at')
          .eq('user_id', userId)
          .eq('state', 'active')
      : null;
  const resolvedBaseMemberships = fallbackBaseMemberships ?? baseMemberships;

  if (resolvedBaseMemberships.error) {
    throw new Error(resolvedBaseMemberships.error.message);
  }

  const membershipRows = (resolvedBaseMemberships.data ?? []) as ConversationMemberRow[];

  return mapInboxConversations(
    await attachConversationsToMembershipRows(membershipRows, supabase, options),
    supabase,
    userId,
  );
}

async function attachConversationsToMembershipRows(
  rows: ConversationMemberRow[],
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  options?: {
    includeGroupJoinPolicy?: boolean;
    spaceId?: string | null;
  },
) {
  const conversationIds = Array.from(
    new Set(rows.map((row) => row.conversation_id).filter(Boolean)),
  );

  if (conversationIds.length === 0) {
    return rows.map((row) => ({
      ...row,
      conversations: null,
    })) satisfies ConversationMemberRow[];
  }

  const { data, error } = await supabase
    .from('conversations')
    .select(
      getConversationSummarySelect({
        includeAvatarPath: true,
        includeGroupJoinPolicy: options?.includeGroupJoinPolicy,
        includeSpaceId: true,
        includeSummaryProjection: true,
      }),
    )
    .in('id', conversationIds);

  let conversations = (data ?? null) as ConversationRecord[] | null;

  if (error) {
    const missingSpaceId = isMissingColumnErrorMessage(error.message, 'space_id');
    const missingAvatarPath = isMissingColumnErrorMessage(error.message, 'avatar_path');
    const missingJoinPolicy = isMissingColumnErrorMessage(error.message, 'join_policy');
    const missingSummaryProjection =
      isMissingConversationSummaryProjectionErrorMessage(error.message);

    if (missingSummaryProjection) {
      markConversationSummaryProjectionAvailability('missing', error.message);
    }

    if (missingSpaceId || missingAvatarPath || missingJoinPolicy || missingSummaryProjection) {
      logConversationSchemaDiagnostics('attachConversationsToMembershipRows:select-error', {
        actualFailingColumn: missingAvatarPath
          ? 'avatar_path'
          : missingJoinPolicy
            ? 'join_policy'
          : missingSummaryProjection
            ? 'conversation-summary-projection'
          : missingSpaceId
            ? 'space_id'
            : 'unknown',
        helper: 'attachConversationsToMembershipRows',
        message: error.message,
        requestedSpaceId: options?.spaceId ?? null,
        schemaCheckAvatarPathMissing: missingAvatarPath,
        schemaCheckJoinPolicyMissing: missingJoinPolicy,
        schemaCheckSpaceIdMissing: missingSpaceId,
        schemaCheckSummaryProjectionMissing: missingSummaryProjection,
      });

      if (options?.spaceId && missingSpaceId) {
        logConversationSchemaDiagnostics('attachConversationsToMembershipRows:throw-space-id-required', {
          actualFailingColumn: missingAvatarPath
            ? 'avatar_path'
            : missingJoinPolicy
              ? 'join_policy'
            : missingSummaryProjection
              ? 'conversation-summary-projection'
            : missingSpaceId
              ? 'space_id'
              : 'unknown',
          helper: 'attachConversationsToMembershipRows',
          message: error.message,
          requestedSpaceId: options.spaceId,
          schemaCheckAvatarPathMissing: missingAvatarPath,
          schemaCheckJoinPolicyMissing: missingJoinPolicy,
          schemaCheckSpaceIdMissing: missingSpaceId,
          schemaCheckSummaryProjectionMissing: missingSummaryProjection,
        });
        throw createSchemaRequirementError(
          'Active space scoping requires public.conversations.space_id.',
        );
      }

      const fallback = await supabase
        .from('conversations')
        .select(
          getConversationSummarySelect({
            includeAvatarPath: !missingAvatarPath,
            includeGroupJoinPolicy:
              Boolean(options?.includeGroupJoinPolicy) && !missingJoinPolicy,
            includeSpaceId: !missingSpaceId,
            includeSummaryProjection: !missingSummaryProjection,
          }),
        )
        .in('id', conversationIds);

      if (fallback.error) {
        logConversationSchemaDiagnostics('attachConversationsToMembershipRows:fallback-error', {
          actualFailingColumn:
            isMissingColumnErrorMessage(fallback.error.message, 'avatar_path')
              ? 'avatar_path'
              : isMissingColumnErrorMessage(fallback.error.message, 'join_policy')
                ? 'join_policy'
              : isMissingConversationSummaryProjectionErrorMessage(
                    fallback.error.message,
                  )
                ? 'conversation-summary-projection'
              : isMissingColumnErrorMessage(fallback.error.message, 'space_id')
                ? 'space_id'
                : 'unknown',
          helper: 'attachConversationsToMembershipRows',
          message: fallback.error.message,
          requestedSpaceId: options?.spaceId ?? null,
          schemaCheckAvatarPathMissing: isMissingColumnErrorMessage(
            fallback.error.message,
            'avatar_path',
          ),
          schemaCheckJoinPolicyMissing: isMissingColumnErrorMessage(
            fallback.error.message,
            'join_policy',
          ),
          schemaCheckSpaceIdMissing: isMissingColumnErrorMessage(
            fallback.error.message,
            'space_id',
          ),
          schemaCheckSummaryProjectionMissing:
            isMissingConversationSummaryProjectionErrorMessage(
              fallback.error.message,
            ),
        });
        throw new Error(fallback.error.message);
      }

      conversations = (fallback.data ?? null) as unknown as ConversationRecord[] | null;
    } else {
      throw new Error(error.message);
    }
  } else if (conversationSummaryProjectionAvailability === 'unknown') {
    const projectionWasRequested =
      rows.length > 0 &&
      Object.prototype.hasOwnProperty.call(
        (conversations ?? [])[0] ?? {},
        'last_message_id',
      );
    if (projectionWasRequested) {
      markConversationSummaryProjectionAvailability('available');
    }
  }

  const conversationById = new Map(
    ((conversations ?? []) as ConversationRecord[]).map((conversation) => [
      conversation.id,
      conversation,
    ]),
  );

  const scopedRows = rows.filter((row) => {
    if (!options?.spaceId) {
      return true;
    }

    return (conversationById.get(row.conversation_id)?.space_id ?? null) === options.spaceId;
  });

  return scopedRows.map((row) => ({
    ...row,
    conversations: conversationById.get(row.conversation_id) ?? null,
  })) satisfies ConversationMemberRow[];
}

async function mapInboxConversations(
  rows: ConversationMemberRow[],
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  currentUserId: string,
) {
  const conversationIds = rows.map((row) => row.conversation_id);
  const latestMessageSeqByConversation = new Map<string, number>();
  const latestMessageByConversation = new Map<
    string,
    {
      createdAt: string | null;
      id: string | null;
      senderId: string | null;
      body: string | null;
      kind: string | null;
      contentMode: string | null;
      deletedAt: string | null;
    }
  >();
  const unreadCountByConversation =
    await loadUnreadIncomingCountByConversation({
      currentUserId,
      rows,
      supabase,
    });
  const latestMessageRowsByConversationId =
    await loadLatestConversationSummaryMessageRowsByConversationId(
      supabase,
      conversationIds,
    );

  for (const membershipRow of rows) {
    const latestRow =
      latestMessageRowsByConversationId.get(membershipRow.conversation_id) ?? null;
    const latestSeq = normalizeConversationLatestMessageSeq(latestRow?.seq ?? null);

    if (latestRow) {
      latestMessageByConversation.set(membershipRow.conversation_id, {
        createdAt: latestRow.created_at ?? null,
        id: latestRow.id ?? null,
        senderId: latestRow.sender_id ?? null,
        body: latestRow.body ?? null,
        kind: latestRow.kind ?? null,
        contentMode: latestRow.content_mode ?? null,
        deletedAt: latestRow.deleted_at ?? null,
      });
    }

    if (latestSeq !== null) {
      latestMessageSeqByConversation.set(membershipRow.conversation_id, latestSeq);
    }

  }

  const latestMessageAttachmentKindByMessageId =
    await getInboxAttachmentPreviewKindsByMessageId(
      supabase,
      Array.from(
        new Set(
          Array.from(latestMessageByConversation.values())
            .map((message) => message.id)
            .filter((messageId): messageId is string => Boolean(messageId)),
        ),
      ),
    );

  const mappedRows = rows.map((row) => {
    const conversation = normalizeConversation(row.conversations);
    const lastReadMessageSeq =
      typeof row.last_read_message_seq === 'number'
        ? row.last_read_message_seq
        : null;
    const visibleFromSeq = normalizeConversationMemberVisibleFromSeq(
      row.visible_from_seq,
    );
    const latestMessageSeq =
      latestMessageSeqByConversation.get(row.conversation_id) ?? null;
    const latestMessage = latestMessageByConversation.get(row.conversation_id);
    const unreadCount =
      unreadCountByConversation.get(row.conversation_id) ?? 0;
    const latestMessageVisible =
      latestMessageSeq !== null &&
      (visibleFromSeq === null || latestMessageSeq >= visibleFromSeq);

    return {
      conversationId: row.conversation_id,
      spaceId: conversation?.space_id ?? null,
      kind: conversation?.kind ?? null,
      title: conversation?.title ?? null,
      avatarPath: resolveStoredAvatarPath(
        supabase,
        conversation?.avatar_path ?? null,
      ),
      createdBy: conversation?.created_by ?? null,
      lastMessageAt: latestMessageVisible ? latestMessage?.createdAt ?? null : null,
      createdAt: conversation?.created_at ?? null,
      hiddenAt: row.hidden_at ?? null,
      lastReadMessageSeq,
      lastReadAt: row.last_read_at ?? null,
      latestMessageId: latestMessageVisible ? latestMessage?.id ?? null : null,
      latestMessageSeq: latestMessageVisible ? latestMessageSeq : null,
      latestMessageSenderId: latestMessageVisible
        ? latestMessage?.senderId ?? null
        : null,
      latestMessageAttachmentKind:
        latestMessageVisible && latestMessage?.id
          ? latestMessageAttachmentKindByMessageId.get(latestMessage.id) ?? null
          : null,
      latestMessageBody: latestMessageVisible ? latestMessage?.body ?? null : null,
      latestMessageKind: latestMessageVisible ? latestMessage?.kind ?? null : null,
      latestMessageContentMode: latestMessageVisible
        ? latestMessage?.contentMode ?? null
        : null,
      latestMessageDeletedAt: latestMessageVisible
        ? latestMessage?.deletedAt ?? null
        : null,
      unreadCount,
    };
  });

  return mappedRows.sort((left, right) => {
    const leftValue = left.lastMessageAt ?? left.createdAt ?? '';
    const rightValue = right.lastMessageAt ?? right.createdAt ?? '';

    return rightValue.localeCompare(leftValue);
  });
}

export async function getInboxConversations(
  userId: string,
  options?: {
    spaceId?: string | null;
  },
) {
  return getConversationsByVisibility(userId, false, options);
}

export async function getInboxConversationsStable(
  userId: string,
  options?: {
    spaceId?: string | null;
  },
) {
  return getConversationsWithoutArchiveVisibility(userId, options);
}

export async function getArchivedConversations(
  userId: string,
  options?: {
    spaceId?: string | null;
  },
) {
  return getConversationsByVisibility(userId, true, options);
}

// Conversation-level read seam. Future access-checked companion metadata reads
// should layer here or in wrappers around it, not inside message history
// loaders.
export async function getConversationForUser(
  conversationId: string,
  userId: string,
  options?: {
    spaceId?: string | null;
  },
) {
  const supabase = await createSupabaseServerClient();
  let membershipResponse = await supabase
    .from('conversation_members')
    .select('conversation_id, notification_level, visible_from_seq')
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
    .eq('state', 'active')
    .maybeSingle();

  if (
    membershipResponse.error &&
    isMissingColumnErrorMessage(membershipResponse.error.message, 'visible_from_seq')
  ) {
    membershipResponse = await supabase
      .from('conversation_members')
      .select('conversation_id, notification_level')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .eq('state', 'active')
      .maybeSingle();
  }

  const { data, error } = membershipResponse;

  if (error) {
    if (isMissingColumnErrorMessage(error.message, 'notification_level')) {
      const fallback = await supabase
        .from('conversation_members')
        .select('conversation_id')
        .eq('conversation_id', conversationId)
        .eq('user_id', userId)
        .eq('state', 'active')
        .maybeSingle();

      if (fallback.error) {
        throw new Error(fallback.error.message);
      }

      if (!fallback.data) {
        return null;
      }

      const [scopedRow] = await attachConversationsToMembershipRows(
        [
          {
            conversation_id: (fallback.data as { conversation_id: string }).conversation_id,
            conversations: null,
          } satisfies ConversationMemberRow,
        ],
        supabase,
        {
          ...options,
          includeGroupJoinPolicy: true,
        },
      );

      const fallbackConversation = normalizeConversation(scopedRow?.conversations ?? null);

      if (!fallbackConversation || !scopedRow) {
        return null;
      }

      return {
        conversationId: scopedRow.conversation_id,
        spaceId: fallbackConversation.space_id ?? null,
        kind: fallbackConversation.kind,
        joinPolicy:
          fallbackConversation.kind === 'group'
            ? normalizeGroupConversationJoinPolicy(
                fallbackConversation.join_policy ?? null,
              )
            : null,
        title: fallbackConversation.title,
        avatarPath: await resolveStoredAvatarPath(
          supabase,
          fallbackConversation.avatar_path ?? null,
        ),
        createdBy: fallbackConversation.created_by ?? null,
        lastMessageAt: fallbackConversation.last_message_at,
        createdAt: fallbackConversation.created_at,
        latestMessageSeq: normalizeConversationLatestMessageSeq(
          fallbackConversation.last_message_seq ?? null,
        ),
        notificationLevel: 'default' as const,
        visibleFromSeq: null,
      };
    }

    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  const [scopedRow] = await attachConversationsToMembershipRows(
    [
      {
        conversation_id: (data as { conversation_id: string }).conversation_id,
        notification_level:
          (data as { notification_level?: string | null }).notification_level ?? null,
        conversations: null,
      } satisfies ConversationMemberRow,
    ],
    supabase,
    {
      ...options,
      includeGroupJoinPolicy: true,
    },
  );
  const conversation = normalizeConversation(scopedRow?.conversations ?? null);

  if (!conversation || !scopedRow) {
    return null;
  }

  return {
    conversationId: scopedRow.conversation_id,
    spaceId: conversation.space_id ?? null,
    kind: conversation.kind,
    joinPolicy:
      conversation.kind === 'group'
        ? normalizeGroupConversationJoinPolicy(conversation.join_policy ?? null)
        : null,
    title: conversation.title,
    avatarPath: await resolveStoredAvatarPath(
      supabase,
      conversation.avatar_path ?? null,
    ),
    createdBy: conversation.created_by ?? null,
    lastMessageAt: conversation.last_message_at,
    createdAt: conversation.created_at,
    latestMessageSeq: normalizeConversationLatestMessageSeq(
      conversation.last_message_seq ?? null,
    ),
    notificationLevel:
      scopedRow.notification_level === 'muted' ? 'muted' : 'default',
    visibleFromSeq: normalizeConversationMemberVisibleFromSeq(
      scopedRow.visible_from_seq,
    ),
  };
}

// Conversation-summary read seam. Future nullable companion metadata reads can
// layer here once conversation-level access and visibility checks are already
// resolved.
export async function getConversationSummaryForUser(
  conversationId: string,
  userId: string,
  options?: {
    spaceId?: string | null;
  },
) {
  const supabase = await createSupabaseServerClient();
  let membershipResponse = await supabase
    .from('conversation_members')
    .select(
      'conversation_id, hidden_at, last_read_message_seq, last_read_at, visible_from_seq',
    )
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
    .eq('state', 'active')
    .maybeSingle();

  if (
    membershipResponse.error &&
    isMissingColumnErrorMessage(membershipResponse.error.message, 'visible_from_seq')
  ) {
    membershipResponse = await supabase
      .from('conversation_members')
      .select('conversation_id, hidden_at, last_read_message_seq, last_read_at')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .eq('state', 'active')
      .maybeSingle();
  }

  if (membershipResponse.error) {
    throw new Error(membershipResponse.error.message);
  }

  if (!membershipResponse.data) {
    return null;
  }

  const [scopedRow] = await attachConversationsToMembershipRows(
    [
      {
        conversation_id: membershipResponse.data.conversation_id,
        hidden_at: membershipResponse.data.hidden_at ?? null,
        last_read_at: membershipResponse.data.last_read_at ?? null,
        last_read_message_seq:
          typeof membershipResponse.data.last_read_message_seq === 'number'
            ? membershipResponse.data.last_read_message_seq
            : null,
        visible_from_seq:
          typeof membershipResponse.data.visible_from_seq === 'number'
            ? membershipResponse.data.visible_from_seq
            : null,
        conversations: null,
      } satisfies ConversationMemberRow,
    ],
    supabase,
    options,
  );
  const conversation = normalizeConversation(scopedRow?.conversations ?? null);

  if (!scopedRow || !conversation) {
    return null;
  }

  const latestRow = await loadLatestConversationSummaryMessageRow(
    supabase,
    conversationId,
  );
  const latestMessageSeq = normalizeConversationLatestMessageSeq(latestRow?.seq ?? null);
  const latestMessage = latestRow
    ? {
        body: latestRow.body ?? null,
        contentMode: latestRow.content_mode ?? null,
        createdAt: latestRow.created_at ?? null,
        deletedAt: latestRow.deleted_at ?? null,
        id: latestRow.id ?? null,
        kind: latestRow.kind ?? null,
        senderId: latestRow.sender_id ?? null,
      }
    : null;

  const lastReadMessageSeq =
    typeof scopedRow.last_read_message_seq === 'number'
      ? scopedRow.last_read_message_seq
      : null;
  const visibleFromSeq = normalizeConversationMemberVisibleFromSeq(
    scopedRow.visible_from_seq,
  );
  const unreadCount = await countConversationUnreadIncomingMessages({
    conversationId,
    currentUserId: userId,
    lastReadMessageSeq,
    supabase,
    visibleFromSeq,
  });
  const latestMessageVisible =
    latestMessageSeq !== null &&
    (visibleFromSeq === null || latestMessageSeq >= visibleFromSeq);
  const latestMessageAttachmentKindByMessageId =
    latestMessage?.id
      ? await getInboxAttachmentPreviewKindsByMessageId(supabase, [latestMessage.id])
      : new Map<string, InboxAttachmentPreviewKind>();

  return {
    conversationId: scopedRow.conversation_id,
    createdAt: conversation.created_at ?? null,
    hiddenAt: scopedRow.hidden_at ?? null,
    lastMessageAt: latestMessageVisible ? latestMessage?.createdAt ?? null : null,
    lastReadAt: scopedRow.last_read_at ?? null,
    lastReadMessageSeq,
    latestMessageAttachmentKind:
      latestMessageVisible && latestMessage?.id
        ? latestMessageAttachmentKindByMessageId.get(latestMessage.id) ?? null
        : null,
    latestMessageBody: latestMessageVisible ? latestMessage?.body ?? null : null,
    latestMessageContentMode: latestMessageVisible
      ? latestMessage?.contentMode ?? null
      : null,
    latestMessageDeletedAt: latestMessageVisible
      ? latestMessage?.deletedAt ?? null
      : null,
    latestMessageId: latestMessageVisible ? latestMessage?.id ?? null : null,
    latestMessageKind: latestMessageVisible ? latestMessage?.kind ?? null : null,
    latestMessageSenderId: latestMessageVisible
      ? latestMessage?.senderId ?? null
      : null,
    latestMessageSeq: latestMessageVisible ? latestMessageSeq : null,
    unreadCount,
  } satisfies InboxConversationSummarySnapshot;
}

export async function getConversationReadState(
  conversationId: string,
  userId: string,
) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('conversation_members')
    .select('last_read_message_seq, last_read_at')
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    if (
      error.message.includes('last_read_message_seq') ||
      error.message.includes('last_read_at') ||
      error.message.includes('column')
    ) {
      return {
        lastReadMessageSeq: null,
        lastReadAt: null,
      } satisfies ConversationReadState;
    }

    throw new Error(error.message);
  }

  return {
    lastReadMessageSeq:
      typeof data?.last_read_message_seq === 'number'
        ? data.last_read_message_seq
        : null,
    lastReadAt:
      typeof data?.last_read_at === 'string' ? data.last_read_at : null,
  } satisfies ConversationReadState;
}

export async function getConversationMemberJoinedAt(
  conversationId: string,
  userId: string,
) {
  const boundary = await getConversationMemberHistoryBoundary(conversationId, userId);
  return boundary?.joinedAt ?? null;
}

export async function getConversationMemberHistoryBoundary(
  conversationId: string,
  userId: string,
) {
  const supabase = await createSupabaseServerClient();
  let response = await supabase
    .from('conversation_members')
    .select('created_at, visible_from_seq')
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
    .eq('state', 'active')
    .maybeSingle();

  if (
    response.error &&
    isMissingColumnErrorMessage(response.error.message, 'visible_from_seq')
  ) {
    response = await supabase
      .from('conversation_members')
      .select('created_at')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .eq('state', 'active')
      .maybeSingle();
  }

  const { data, error } = response;

  if (error) {
    if (
      error.message.includes('created_at') ||
      error.message.includes('column')
    ) {
      return {
        joinedAt: null,
        visibleFromSeq: null,
      };
    }

    throw new Error(error.message);
  }

  return {
    joinedAt: typeof data?.created_at === 'string' ? data.created_at : null,
    visibleFromSeq: normalizeConversationMemberVisibleFromSeq(
      typeof data?.visible_from_seq === 'number' ? data.visible_from_seq : null,
    ),
  };
}

export async function getConversationMemberReadStates(conversationId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('conversation_members')
    .select('user_id, last_read_message_seq, last_read_at')
    .eq('conversation_id', conversationId)
    .eq('state', 'active');

  if (error) {
    if (
      error.message.includes('last_read_message_seq') ||
      error.message.includes('last_read_at') ||
      error.message.includes('column')
    ) {
      const fallback = await supabase
        .from('conversation_members')
        .select('user_id')
        .eq('conversation_id', conversationId)
        .eq('state', 'active');

      if (fallback.error) {
        throw new Error(fallback.error.message);
      }

      return ((fallback.data ?? []) as { user_id: string }[]).map((row) => ({
        userId: row.user_id,
        lastReadMessageSeq: null,
        lastReadAt: null,
      })) satisfies ConversationMemberReadState[];
    }

    throw new Error(error.message);
  }

  return ((data ?? []) as {
    user_id: string;
    last_read_message_seq?: number | null;
    last_read_at?: string | null;
  }[]).map((row) => ({
    userId: row.user_id,
    lastReadMessageSeq:
      typeof row.last_read_message_seq === 'number'
        ? row.last_read_message_seq
        : null,
    lastReadAt: row.last_read_at ?? null,
  })) satisfies ConversationMemberReadState[];
}

export async function getConversationParticipants(conversationId: string) {
  const membershipRows = await getActiveConversationMembershipRows([conversationId], {
    includeRole: true,
  });

  const data = membershipRows
    .filter((membership) => membership.conversation_id === conversationId)
    .map((membership) => ({
      user_id: membership.user_id,
      role: membership.role ?? null,
      state: membership.state ?? null,
    }));

  const memberships = ((data ?? []) as {
    user_id: string;
    role?: string | null;
    state?: string | null;
  }[]).map((member) => ({
    userId: member.user_id,
    role: member.role ?? null,
    state: member.state ?? null,
  }));

  const uniqueMemberships = Array.from(
    new Map(memberships.map((member) => [member.userId, member])).values(),
  );
  const rolePriority = new Map([
    ['owner', 0],
    ['admin', 1],
    ['member', 2],
  ]);

  return uniqueMemberships.sort((left, right) => {
    const leftPriority = rolePriority.get(left.role ?? 'member') ?? 99;
    const rightPriority = rolePriority.get(right.role ?? 'member') ?? 99;

    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority;
    }

    return left.userId.localeCompare(right.userId);
  }) satisfies ConversationParticipant[];
}

export async function getConversationMessageStats(
  conversationId: string,
): Promise<ConversationMessageStats> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('messages')
    .select('sender_id')
    .eq('conversation_id', conversationId);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as Array<{ sender_id?: string | null }>;
  const perSenderCount = new Map<string, number>();

  for (const row of rows) {
    const senderId = row.sender_id?.trim();

    if (!senderId) {
      continue;
    }

    perSenderCount.set(senderId, (perSenderCount.get(senderId) ?? 0) + 1);
  }

  return {
    totalMessages: rows.length,
    perSenderCount,
  };
}

async function getActiveConversationMembershipRows(
  conversationIds: string[],
  options?: {
    includeRole?: boolean;
  },
) {
  type ConversationMembershipRow = {
    conversation_id: string;
    user_id: string;
    role?: string | null;
    state?: string | null;
  };
  const uniqueConversationIds = Array.from(
    new Set(conversationIds.map((value) => value.trim()).filter(Boolean)),
  );

  if (uniqueConversationIds.length === 0) {
    return [] as ConversationMembershipRow[];
  }

  const buildMembershipRowsQuery = async (
    client: Awaited<ReturnType<typeof createSupabaseServerClient>>,
    includeRole: boolean,
  ) => {
    const select = includeRole
      ? 'conversation_id, user_id, role'
      : 'conversation_id, user_id';

    return client
      .from('conversation_members')
      .select(select)
      .in('conversation_id', uniqueConversationIds)
      .eq('state', 'active');
  };
  const supabase = await createSupabaseServerClient();
  const allowRoleFallback = options?.includeRole === true;
  let authResponse = await buildMembershipRowsQuery(
    supabase,
    options?.includeRole === true,
  );

  if (
    authResponse.error &&
    allowRoleFallback &&
    isMissingColumnErrorMessage(authResponse.error.message, 'role')
  ) {
    authResponse = await buildMembershipRowsQuery(supabase, false);
  }

  let baseRows: ConversationMembershipRow[] = [];

  if (authResponse.error) {
    const serviceSupabase = createSupabaseServiceRoleClient();

    if (!serviceSupabase || !isSupabasePermissionDeniedError(authResponse.error)) {
      throw new Error(authResponse.error.message);
    }

    let serviceResponse = await buildMembershipRowsQuery(
      serviceSupabase as Awaited<ReturnType<typeof createSupabaseServerClient>>,
      options?.includeRole === true,
    );

    if (
      serviceResponse.error &&
      allowRoleFallback &&
      isMissingColumnErrorMessage(serviceResponse.error.message, 'role')
    ) {
      serviceResponse = await buildMembershipRowsQuery(
        serviceSupabase as Awaited<ReturnType<typeof createSupabaseServerClient>>,
        false,
      );
    }

    if (serviceResponse.error) {
      throw new Error(serviceResponse.error.message);
    }

    baseRows = (serviceResponse.data ?? []) as unknown as ConversationMembershipRow[];
  } else {
    baseRows = (authResponse.data ?? []) as unknown as ConversationMembershipRow[];
  }

  const mergedRows = new Map<
    string,
    ConversationMembershipRow
  >(
    baseRows.map((row) => [`${row.conversation_id}:${row.user_id}`, row] as const),
  );

  const serviceSupabase = createSupabaseServiceRoleClient();

  if (serviceSupabase) {
    let serviceResponse = await buildMembershipRowsQuery(
      serviceSupabase as Awaited<ReturnType<typeof createSupabaseServerClient>>,
      options?.includeRole === true,
    );

    if (
      serviceResponse.error &&
      allowRoleFallback &&
      isMissingColumnErrorMessage(serviceResponse.error.message, 'role')
    ) {
      serviceResponse = await buildMembershipRowsQuery(
        serviceSupabase as Awaited<ReturnType<typeof createSupabaseServerClient>>,
        false,
      );
    }

    if (!serviceResponse.error) {
      for (const row of (serviceResponse.data ?? []) as unknown as ConversationMembershipRow[]) {
        mergedRows.set(`${row.conversation_id}:${row.user_id}`, row);
      }
    }
  }

  return Array.from(mergedRows.values());
}

async function getActiveGroupMembership(
  conversationId: string,
  userId: string,
) {
  const supabase = await createSupabaseServerClient();
  const buildQuery = (select: string) =>
    supabase
      .from('conversation_members')
      .select(select)
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .eq('state', 'active')
      .eq('conversations.kind', 'group')
      .maybeSingle();
  let data: unknown = null;
  let error: { message: string } | null = null;

  const responseWithJoinPolicy = await buildQuery(
    'user_id, role, state, conversations!inner(id, kind, join_policy)',
  );

  if (
    responseWithJoinPolicy.error &&
    isMissingColumnErrorMessage(responseWithJoinPolicy.error.message, 'join_policy')
  ) {
    const fallbackResponse = await buildQuery(
      'user_id, role, state, conversations!inner(id, kind)',
    );
    data = fallbackResponse.data;
    error = fallbackResponse.error;
  } else {
    data = responseWithJoinPolicy.data;
    error = responseWithJoinPolicy.error;
  }

  if (error) {
    throw new Error(error.message);
  }

  const membership = data as
    | {
        user_id: string;
        role: string | null;
        state: string | null;
        conversations?:
          | {
              join_policy?: string | null;
            }
          | Array<{
              join_policy?: string | null;
            }>
          | null;
      }
    | null;
  const conversation = normalizeJoinedRecord(membership?.conversations ?? null);

  if (!membership) {
    return null;
  }

  return {
    role: membership.role ?? null,
    state: membership.state ?? null,
    user_id: membership.user_id,
    joinPolicy: normalizeGroupConversationJoinPolicy(
      conversation?.join_policy ?? null,
    ),
  };
}

async function assertGroupConversationTarget(input: {
  conversationId: string;
  failureMessage: string;
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
}) {
  const { data, error } = await input.supabase
    .from('conversations')
    .select('kind')
    .eq('id', input.conversationId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error('This chat is no longer available.');
  }

  const kind = ((data as { kind?: string | null } | null)?.kind ?? null)?.trim() ?? null;

  if (kind !== 'group') {
    throw new Error(input.failureMessage);
  }
}

function getGroupManagementWriteClient(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
) {
  return createSupabaseServiceRoleClient() ?? supabase;
}

function dedupeParticipantIds(ids: string[]) {
  return Array.from(new Set(ids.map((value) => value.trim()).filter(Boolean)));
}

function sanitizeAttachmentFileName(value: string) {
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

function isManagedAvatarObjectPath(
  userId: string,
  value: string | null | undefined,
) {
  const normalizedValue = value?.trim() || null;

  if (!normalizedValue || isAbsoluteAvatarUrl(normalizedValue)) {
    return false;
  }

  return normalizedValue.startsWith(`${userId}/`);
}

function isManagedConversationAvatarObjectPath(
  conversationId: string,
  value: string | null | undefined,
) {
  const normalizedValue = value?.trim() || null;

  if (!normalizedValue || isAbsoluteAvatarUrl(normalizedValue)) {
    return false;
  }

  if (normalizedValue.startsWith(`conversations/${conversationId}/`)) {
    return true;
  }

  const pathSegments = normalizedValue.split('/').filter(Boolean);

  return (
    pathSegments.length >= 4 &&
    pathSegments[1] === 'conversation-avatars' &&
    pathSegments[2] === conversationId
  );
}

function isManagedConversationAvatarUploadPathForUser(
  userId: string,
  conversationId: string,
  value: string | null | undefined,
) {
  const normalizedValue = value?.trim() || null;

  if (!normalizedValue || isAbsoluteAvatarUrl(normalizedValue)) {
    return false;
  }

  if (normalizedValue.startsWith(`conversations/${conversationId}/`)) {
    return true;
  }

  return normalizedValue.startsWith(
    `${userId}/conversation-avatars/${conversationId}/`,
  );
}

function isBucketNotFoundStorageErrorMessage(message: string) {
  return message.toLowerCase().includes('bucket not found');
}

function getAvatarBucketRequirementErrorMessage() {
  console.error('[avatar-storage]', {
    issue: 'bucket-not-found',
    bucket: PROFILE_AVATAR_BUCKET,
    setupSql: 'docs/sql/2026-04-03-avatars-storage-policies.sql',
  });

  return 'Avatar uploads are not available right now.';
}

function getChatAttachmentBucketRequirementErrorMessage() {
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

const avatarDiagnosticsEnabled = process.env.CHAT_DEBUG_AVATARS === '1';

function resolveStoredAvatarPath(
  _supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  value: string | null | undefined,
) {
  const normalizedValue = value?.trim() || null;

  if (!normalizedValue) {
    return null;
  }

  if (isAbsoluteAvatarUrl(normalizedValue)) {
    return normalizedValue;
  }

  const deliveryPath = buildAvatarDeliveryPath(normalizedValue);

  if (!deliveryPath) {
    return null;
  }

  if (avatarDiagnosticsEnabled) {
    console.info('[avatar-storage]', {
      issue: 'stable-delivery-path',
      bucket: PROFILE_AVATAR_BUCKET,
      objectPath: normalizedValue,
      url: deliveryPath,
    });
  }

  return deliveryPath;
}

function getAttachmentFileName(objectPath: string) {
  const rawName = objectPath.split('/').pop()?.trim() || 'attachment';

  try {
    return decodeURIComponent(rawName);
  } catch {
    return rawName;
  }
}

function isImageAttachment(mimeType: string | null) {
  return Boolean(mimeType?.startsWith('image/'));
}

export function isAudioAttachment(mimeType: string | null) {
  return Boolean(mimeType?.startsWith('audio/'));
}

export function isSupportedVoiceAttachmentType(mimeType: string | null) {
  return Boolean(mimeType && SUPPORTED_VOICE_ATTACHMENT_TYPES.has(mimeType));
}

function normalizeVoiceDurationMs(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  const normalized = Math.max(0, Math.round(value));
  return normalized >= 0 ? normalized : null;
}

function getAttachmentMessageKind(mimeType: string | null) {
  if (isSupportedVoiceAttachmentType(mimeType)) {
    return 'voice' as const;
  }

  return 'attachment' as const;
}

export async function getProfileIdentities(
  userIds: string[],
  options?: {
    includeAvatarPath?: boolean;
    includeStatuses?: boolean;
  },
) {
  const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));
  const includeAvatarPath = options?.includeAvatarPath !== false;
  const includeStatuses = options?.includeStatuses !== false;

  if (uniqueUserIds.length === 0) {
    return [] as MessageSenderProfile[];
  }

  const supabase = await createSupabaseServerClient();
  const serviceSupabase = createSupabaseServiceRoleClient();
  const loadProfiles = async (
    client: Awaited<ReturnType<typeof createSupabaseServerClient>>,
    ids: string[],
  ) => {
    if (includeStatuses) {
      const withStatusesProjection = [
        'user_id',
        'display_name',
        'username',
        'email_local_part',
        ...(includeAvatarPath ? ['avatar_path'] : []),
        'status_emoji',
        'status_text',
        'status_updated_at',
      ].join(', ');
      const withStatuses = await client
        .from('profiles')
        .select(withStatusesProjection)
        .in('user_id', ids);

      if (!withStatuses.error) {
        const profiles = ((withStatuses.data ?? []) as unknown as {
          user_id: string;
          display_name: string | null;
          username?: string | null;
          email_local_part?: string | null;
          avatar_path?: string | null;
          status_emoji?: string | null;
          status_text?: string | null;
          status_updated_at?: string | null;
        }[]);

        return profiles.map((profile) => ({
          userId: profile.user_id,
          displayName: profile.display_name?.trim() || null,
          username: profile.username?.trim() || null,
          emailLocalPart: profile.email_local_part?.trim() || null,
          avatarPath: includeAvatarPath
            ? resolveStoredAvatarPath(client, profile.avatar_path)
            : null,
          statusEmoji: profile.status_emoji?.trim() || null,
          statusText: profile.status_text?.trim() || null,
          statusUpdatedAt: profile.status_updated_at?.trim() || null,
        }));
      }
    }

    const withIdentityProjection = [
      'user_id',
      'display_name',
      'username',
      'email_local_part',
      ...(includeAvatarPath ? ['avatar_path'] : []),
    ].join(', ');
    const withIdentityFallbacksAndAvatars = await client
      .from('profiles')
      .select(withIdentityProjection)
      .in('user_id', ids);

    if (!withIdentityFallbacksAndAvatars.error) {
      const profiles = ((withIdentityFallbacksAndAvatars.data ?? []) as unknown as {
        user_id: string;
        display_name: string | null;
        username?: string | null;
        email_local_part?: string | null;
        avatar_path?: string | null;
      }[]);

      return profiles.map((profile) => ({
        userId: profile.user_id,
        displayName: profile.display_name?.trim() || null,
        username: profile.username?.trim() || null,
        emailLocalPart: profile.email_local_part?.trim() || null,
        avatarPath: includeAvatarPath
          ? resolveStoredAvatarPath(client, profile.avatar_path)
          : null,
        statusEmoji: null,
        statusText: null,
        statusUpdatedAt: null,
      }));
    }

    if (includeAvatarPath) {
      const withDisplayNamesAndAvatars = await client
        .from('profiles')
        .select('user_id, display_name, avatar_path')
        .in('user_id', ids);

      if (!withDisplayNamesAndAvatars.error) {
        const profiles = ((withDisplayNamesAndAvatars.data ?? []) as {
          user_id: string;
          display_name: string | null;
          avatar_path?: string | null;
        }[]);

        return profiles.map((profile) => ({
          userId: profile.user_id,
          displayName: profile.display_name?.trim() || null,
          username: null,
          emailLocalPart: null,
          avatarPath: resolveStoredAvatarPath(client, profile.avatar_path),
          statusEmoji: null,
          statusText: null,
          statusUpdatedAt: null,
        }));
      }
    }

    const withIdentityFallbacks = await client
      .from('profiles')
      .select('user_id, display_name, username, email_local_part')
      .in('user_id', ids);

    if (!withIdentityFallbacks.error) {
      return ((withIdentityFallbacks.data ?? []) as {
        user_id: string;
        display_name: string | null;
        username?: string | null;
        email_local_part?: string | null;
      }[]).map((profile) => ({
        userId: profile.user_id,
        displayName: profile.display_name?.trim() || null,
        username: profile.username?.trim() || null,
        emailLocalPart: profile.email_local_part?.trim() || null,
        avatarPath: null,
        statusEmoji: null,
        statusText: null,
        statusUpdatedAt: null,
      }));
    }

    const withDisplayNames = await client
      .from('profiles')
      .select('user_id, display_name')
      .in('user_id', ids);

    if (!withDisplayNames.error) {
      return ((withDisplayNames.data ?? []) as {
        user_id: string;
        display_name: string | null;
      }[]).map((profile) => ({
        userId: profile.user_id,
        displayName: profile.display_name?.trim() || null,
        username: null,
        emailLocalPart: null,
        avatarPath: null,
        statusEmoji: null,
        statusText: null,
        statusUpdatedAt: null,
      }));
    }

    const fallback = await client.from('profiles').select('user_id').in('user_id', ids);

    if (fallback.error) {
      throw new Error(fallback.error.message);
    }

    return ((fallback.data ?? []) as { user_id: string }[]).map((profile) => ({
      userId: profile.user_id,
      displayName: null,
      username: null,
      emailLocalPart: null,
      avatarPath: null,
      statusEmoji: null,
      statusText: null,
      statusUpdatedAt: null,
    }));
  };
  const mergeIdentity = (
    base: MessageSenderProfile | undefined,
    fallback: MessageSenderProfile,
  ) => ({
    userId: fallback.userId,
    displayName: base?.displayName ?? fallback.displayName ?? null,
    username: base?.username ?? fallback.username ?? null,
    emailLocalPart: base?.emailLocalPart ?? fallback.emailLocalPart ?? null,
    avatarPath: base?.avatarPath ?? fallback.avatarPath ?? null,
    statusEmoji: base?.statusEmoji ?? fallback.statusEmoji ?? null,
    statusText: base?.statusText ?? fallback.statusText ?? null,
    statusUpdatedAt: base?.statusUpdatedAt ?? fallback.statusUpdatedAt ?? null,
  });

  const authProfiles = await loadProfiles(supabase, uniqueUserIds);
  const profilesByUserId = new Map(
    authProfiles.map((profile) => [profile.userId, profile]),
  );

  const missingUserIds = uniqueUserIds.filter(
    (userId) => !profilesByUserId.has(userId),
  );

  if (missingUserIds.length > 0 && serviceSupabase) {
    // DM titles and avatars must reflect the counterpart's current public profile
    // identity even when auth-scoped profile reads are narrower than chat UX needs.
    const fallbackProfiles = await loadProfiles(serviceSupabase, missingUserIds);

    for (const profile of fallbackProfiles) {
      profilesByUserId.set(
        profile.userId,
        mergeIdentity(profilesByUserId.get(profile.userId), profile),
      );
    }
  }

  const orderedProfiles: MessageSenderProfile[] = [];

  for (const userId of uniqueUserIds) {
    const profile = profilesByUserId.get(userId);

    if (profile) {
      orderedProfiles.push(profile);
    }
  }

  return orderedProfiles;
}

export async function getCurrentUserProfile(userId: string, email?: string | null) {
  const supabase = await createSupabaseServerClient();
  const requestViewer = await getRequestViewer();
  const [identity] = await getProfileIdentities([userId]);
  let preferredLanguage: AppLanguage | null = null;
  let statusEmoji: string | null = null;
  let statusText: string | null = null;
  let statusUpdatedAt: string | null = null;
  let usedStatusMetadataFallback = false;
  const requestViewerStatusFallback = getProfileStatusFromUserMetadata(
    requestViewer?.id === userId ? requestViewer : null,
  );

  const withLanguage = await supabase
    .from('profiles')
    .select('preferred_language, status_emoji, status_text, status_updated_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (!withLanguage.error) {
    const row = withLanguage.data as
      | {
          preferred_language?: string | null;
          status_emoji?: string | null;
          status_text?: string | null;
          status_updated_at?: string | null;
        }
      | null;
    const rawLanguage = row?.preferred_language;
    preferredLanguage = rawLanguage ? normalizeLanguage(rawLanguage) : null;
    statusEmoji = row?.status_emoji?.trim() || null;
    statusText = row?.status_text?.trim() || null;
    statusUpdatedAt = row?.status_updated_at?.trim() || null;
  } else if (
    isMissingColumnErrorMessage(withLanguage.error.message, 'status_emoji') ||
    isMissingColumnErrorMessage(withLanguage.error.message, 'status_text') ||
    isMissingColumnErrorMessage(withLanguage.error.message, 'status_updated_at')
  ) {
    const languageOnly = await supabase
      .from('profiles')
      .select('preferred_language')
      .eq('user_id', userId)
      .maybeSingle();

    if (!languageOnly.error) {
      const rawLanguage = (
        languageOnly.data as { preferred_language?: string | null } | null
      )?.preferred_language;
      preferredLanguage = rawLanguage ? normalizeLanguage(rawLanguage) : null;
    } else if (
      !isMissingColumnErrorMessage(languageOnly.error.message, 'preferred_language')
    ) {
      throw new Error(languageOnly.error.message);
    }
    usedStatusMetadataFallback = true;
  } else if (!isMissingColumnErrorMessage(withLanguage.error.message, 'preferred_language')) {
    throw new Error(withLanguage.error.message);
  }

  const hasMetadataStatusFallback = Boolean(
    requestViewerStatusFallback.statusEmoji ||
      requestViewerStatusFallback.statusText ||
      requestViewerStatusFallback.statusUpdatedAt,
  );

  if (
    usedStatusMetadataFallback ||
    (hasMetadataStatusFallback &&
      !statusEmoji &&
      !statusText &&
      !statusUpdatedAt)
  ) {
    statusEmoji = requestViewerStatusFallback.statusEmoji;
    statusText = requestViewerStatusFallback.statusText;
    statusUpdatedAt = requestViewerStatusFallback.statusUpdatedAt;
  }

  return {
    userId,
    email: email?.trim() || null,
    displayName: identity?.displayName ?? null,
    username: identity?.username ?? null,
    avatarPath: identity?.avatarPath ?? null,
    preferredLanguage,
    statusEmoji,
    statusText,
    statusUpdatedAt,
  } satisfies CurrentUserProfile;
}

function getProfileStatusFromUserMetadata(user: User | null) {
  const metadata =
    user?.user_metadata && typeof user.user_metadata === 'object'
      ? (user.user_metadata as Record<string, unknown>)
      : null;

  const normalizeMetadataValue = (value: unknown) =>
    typeof value === 'string' ? value.trim() || null : null;

  return {
    statusEmoji: normalizeMetadataValue(metadata?.status_emoji),
    statusText: normalizeMetadataValue(metadata?.status_text),
    statusUpdatedAt: normalizeMetadataValue(metadata?.status_updated_at),
  };
}

async function updateCurrentUserStatusMetadata(input: {
  supabase: Awaited<ReturnType<typeof getRequestSupabaseServerClient>>;
  statusEmoji: string | null;
  statusText: string | null;
  statusUpdatedAt: string | null;
}) {
  const response = await input.supabase.auth.updateUser({
    data: {
      status_emoji: input.statusEmoji,
      status_text: input.statusText,
      status_updated_at: input.statusUpdatedAt,
    },
  });

  if (response.error) {
    throw new Error(response.error.message);
  }
}

export async function getStoredProfileLanguage(userId: string) {
  const supabase = await createSupabaseServerClient();
  const response = await supabase
    .from('profiles')
    .select('preferred_language')
    .eq('user_id', userId)
    .maybeSingle();

  if (!response.error) {
    const rawLanguage = (
      response.data as { preferred_language?: string | null } | null
    )?.preferred_language;
    return rawLanguage ? normalizeLanguage(rawLanguage) : null;
  }

  if (isMissingColumnErrorMessage(response.error.message, 'preferred_language')) {
    return null;
  }

  throw new Error(response.error.message);
}

export async function publishCurrentUserDmE2eeDevice(
  input: PublishDmE2eeDeviceRequest & { userId: string },
) {
  const supabase = await createSupabaseServerClient();
  const now = new Date().toISOString();
  let resultKind: DmE2eeDevicePublishResultKind = 'first_publish';
  logDmE2eeBootstrapDiagnostics('publish:start', {
    hasUserId: Boolean(input.userId),
    oneTimePrekeyCount: input.oneTimePrekeys.length,
  });

  const profileLookup = await supabase
    .from('profiles')
    .select('user_id')
    .eq('user_id', input.userId)
    .maybeSingle();

  if (profileLookup.error) {
    logDmE2eeBootstrapDiagnostics('publish:profile-lookup-error', {
      message: profileLookup.error.message,
    });

    if (
      isMissingRelationErrorMessage(profileLookup.error.message, 'profiles') ||
      isMissingColumnErrorMessage(profileLookup.error.message, 'user_id')
    ) {
      throw createSchemaRequirementError(
        'DM E2EE bootstrap schema is missing.',
      );
    }

    throw createDmE2eeBootstrapPublishError(
      'profile lookup',
      profileLookup.error.message,
    );
  }

  if (!profileLookup.data) {
    logDmE2eeBootstrapDiagnostics('publish:profile-missing-insert:start');
    const profileInsert = await supabase.from('profiles').insert({
      user_id: input.userId,
    });

    if (profileInsert.error) {
      logDmE2eeBootstrapDiagnostics('publish:profile-missing-insert:error', {
        message: profileInsert.error.message,
      });

      if (
        isMissingRelationErrorMessage(profileInsert.error.message, 'profiles') ||
        isMissingColumnErrorMessage(profileInsert.error.message, 'user_id')
      ) {
        throw createSchemaRequirementError(
          'DM E2EE bootstrap schema is missing.',
        );
      }

      throw createDmE2eeBootstrapPublishError(
        'profile seed insert',
        `DM E2EE profile seed failed: ${profileInsert.error.message}`,
      );
    }

    logDmE2eeBootstrapDiagnostics('publish:profile-missing-insert:ok');
  } else {
    logDmE2eeBootstrapDiagnostics('publish:profile-existing');
  }

  const existingDeviceLookup = await supabase
    .from('user_devices')
    .select(
      'id, device_id, registration_id, identity_key_public, signed_prekey_id, signed_prekey_public, signed_prekey_signature, retired_at',
    )
    .eq('user_id', input.userId)
    .eq('device_id', input.deviceId)
    .maybeSingle();

  if (existingDeviceLookup.error) {
    if (
      isMissingRelationErrorMessage(existingDeviceLookup.error.message, 'user_devices') ||
      isMissingColumnErrorMessage(existingDeviceLookup.error.message, 'identity_key_public') ||
      isMissingColumnErrorMessage(existingDeviceLookup.error.message, 'signed_prekey_public')
    ) {
      throw createSchemaRequirementError(
        'DM E2EE bootstrap schema is missing.',
      );
    }

    throw createDmE2eeBootstrapPublishError(
      'existing device lookup',
      existingDeviceLookup.error.message,
    );
  }

  const existingDevice = existingDeviceLookup.data as
    | {
        id?: string | null;
        registration_id?: number | null;
        identity_key_public?: string | null;
        signed_prekey_id?: number | null;
        signed_prekey_public?: string | null;
        signed_prekey_signature?: string | null;
        retired_at?: string | null;
      }
    | null;
  const existingDeviceRecordId = String(existingDevice?.id ?? '').trim() || null;
  const hasExistingActiveSameDevice =
    Boolean(existingDeviceRecordId) && !existingDevice?.retired_at;
  const sameDevicePayloadMatches =
    hasExistingActiveSameDevice &&
    existingDevice?.registration_id === input.registrationId &&
    (existingDevice?.identity_key_public?.trim() ?? '') ===
      input.identityKeyPublic.trim() &&
    existingDevice?.signed_prekey_id === input.signedPrekeyId &&
    (existingDevice?.signed_prekey_public?.trim() ?? '') ===
      input.signedPrekeyPublic.trim() &&
    (existingDevice?.signed_prekey_signature?.trim() ?? '') ===
      input.signedPrekeySignature.trim();

  if (hasExistingActiveSameDevice && !sameDevicePayloadMatches) {
    logDmE2eeBootstrapDiagnostics('publish:conflicting-device-publish', {
      current_device_row_id: existingDeviceRecordId,
      device_id: input.deviceId,
      user_id_present: Boolean(input.userId),
    });
    throw createDmE2eeBootstrapPublishError(
      'conflicting device publish',
      'Conflicting DM E2EE publish detected for an existing device id.',
    );
  }

  if (hasExistingActiveSameDevice) {
    const activePrekeyLookup = await supabase
      .from('device_one_time_prekeys')
      .select('prekey_id', { count: 'exact' })
      .eq('device_id', existingDeviceRecordId)
      .is('claimed_at', null)
      .limit(1);

    if (activePrekeyLookup.error) {
      if (
        isMissingRelationErrorMessage(
          activePrekeyLookup.error.message,
          'device_one_time_prekeys',
        ) ||
        isMissingColumnErrorMessage(activePrekeyLookup.error.message, 'claimed_at')
      ) {
        throw createSchemaRequirementError(
          'DM E2EE bootstrap schema is missing.',
        );
      }

      throw createDmE2eeBootstrapPublishError(
        'existing device prekey lookup',
        activePrekeyLookup.error.message,
      );
    }

    const sameDeviceAvailablePrekeyCount = Number(activePrekeyLookup.count ?? 0);
    const otherActiveDevicesLookup = await supabase
      .from('user_devices')
      .select('id', { count: 'exact' })
      .eq('user_id', input.userId)
      .neq('id', existingDeviceRecordId)
      .is('retired_at', null)
      .limit(1);

    if (otherActiveDevicesLookup.error) {
      throw createDmE2eeBootstrapPublishError(
        'existing device sibling lookup',
        otherActiveDevicesLookup.error.message,
      );
    }

    const otherActiveDeviceCount = Number(otherActiveDevicesLookup.count ?? 0);
    const sameDeviceReady =
      sameDeviceAvailablePrekeyCount > 0 && otherActiveDeviceCount === 0;

    if (sameDeviceReady) {
      const touchExistingDevice = await supabase
        .from('user_devices')
        .update({
          last_seen_at: now,
          retired_at: null,
        })
        .eq('id', existingDeviceRecordId)
        .select('id')
        .single();

      if (touchExistingDevice.error) {
        throw createDmE2eeBootstrapPublishError(
          'existing device touch',
          touchExistingDevice.error.message,
        );
      }

      logDmE2eeBootstrapDiagnostics('publish:already-initialized-same-device', {
        current_device_row_id: existingDeviceRecordId,
        available_prekey_count: sameDeviceAvailablePrekeyCount,
      });

      return {
        deviceRecordId: existingDeviceRecordId as string,
        publishedPrekeyCount: 0,
        resultKind: 'already_initialized_same_device',
      } satisfies PublishDmE2eeDeviceResult;
    }

    resultKind = 'refresh_existing_device';
  }

  const userDevices = await supabase
    .from('user_devices')
    .upsert(
      {
        user_id: input.userId,
        device_id: input.deviceId,
        registration_id: input.registrationId,
        identity_key_public: input.identityKeyPublic,
        signed_prekey_id: input.signedPrekeyId,
        signed_prekey_public: input.signedPrekeyPublic,
        signed_prekey_signature: input.signedPrekeySignature,
        last_seen_at: now,
        retired_at: null,
      },
      {
        onConflict: 'user_id,device_id',
      },
    )
    .select('id')
    .single();

  if (userDevices.error) {
    logDmE2eeBootstrapDiagnostics('publish:user-devices-error', {
      message: userDevices.error.message,
    });
    if (
      isMissingRelationErrorMessage(userDevices.error.message, 'user_devices') ||
      isMissingColumnErrorMessage(userDevices.error.message, 'identity_key_public') ||
      isMissingColumnErrorMessage(userDevices.error.message, 'signed_prekey_public')
    ) {
      throw createSchemaRequirementError(
        'DM E2EE bootstrap schema is missing.',
      );
    }

    throw createDmE2eeBootstrapPublishError(
      'user device upsert',
      userDevices.error.message,
    );
  }

  const deviceRecordId = String((userDevices.data as { id: string } | null)?.id ?? '').trim();

  if (!deviceRecordId) {
    throw createDmE2eeBootstrapPublishError(
      'persist device identity',
      'Unable to persist DM E2EE device identity.',
    );
  }
  logDmE2eeBootstrapDiagnostics('publish:user-device-ok');

  const serviceRoleSupabase = createSupabaseServiceRoleClient();
  const serviceRetireAvailable = Boolean(serviceRoleSupabase);
  const retireOtherDevices = async (
    client: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  ) =>
    client
      .from('user_devices')
      .update({
        retired_at: now,
      })
      .eq('user_id', input.userId)
      .neq('id', deviceRecordId)
      .is('retired_at', null);

  const listOtherActiveDevices = async (
    client: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  ) =>
    client
      .from('user_devices')
      .select('id')
      .eq('user_id', input.userId)
      .neq('id', deviceRecordId)
      .is('retired_at', null);

  const summarizeOtherActiveDevices = (
    rows: Array<{ id: string }> | null | undefined,
  ) => {
    const ids = (rows ?? [])
      .map((row) => String(row.id ?? '').trim())
      .filter(Boolean);

    return {
      otherDeviceIds: ids,
      otherDeviceCount: ids.length,
      includesCurrentDevice: ids.includes(deviceRecordId),
    };
  };

  const otherActiveDevicesLookup = await listOtherActiveDevices(supabase);

  if (otherActiveDevicesLookup.error) {
    logDmE2eeBootstrapDiagnostics('publish:retire-others:prepare-error', {
      current_device_row_id: deviceRecordId,
      message: otherActiveDevicesLookup.error.message,
    });
    throw createDmE2eeBootstrapPublishError(
      'retire other devices: prepare failed',
      otherActiveDevicesLookup.error.message,
      {
        currentDeviceRowId: deviceRecordId,
      },
    );
  }

  const otherActiveDevices = summarizeOtherActiveDevices(
    otherActiveDevicesLookup.data as Array<{ id: string }> | null,
  );

  logDmE2eeBootstrapDiagnostics('publish:retire-others:prepare', {
    current_device_row_id: deviceRecordId,
    other_device_count: otherActiveDevices.otherDeviceCount,
    includes_current_device: otherActiveDevices.includesCurrentDevice,
    retire_target_ids: otherActiveDevices.otherDeviceIds,
    auth_retire_attempted: false,
    auth_retire_failed: false,
    service_retire_available: serviceRetireAvailable,
    service_retire_skip_reason: null,
    service_retire_attempted: false,
    service_retire_succeeded: false,
    service_retire_failed: false,
    service_retire_error_message: null,
    service_retire_error_code: null,
    service_retire_error_status: null,
  });

  if (otherActiveDevices.includesCurrentDevice) {
    logDmE2eeBootstrapDiagnostics('publish:retire-others:current-device-included', {
      current_device_row_id: deviceRecordId,
      other_device_count: otherActiveDevices.otherDeviceCount,
      includes_current_device: true,
      retire_target_ids: otherActiveDevices.otherDeviceIds,
      service_retire_available: serviceRetireAvailable,
      service_retire_skip_reason: 'current device included by mistake',
    });
    throw createDmE2eeBootstrapPublishError(
      'retire other devices: current device included by mistake',
      'The current device row was unexpectedly included in the retire-others candidate set.',
      {
        serviceRetireAvailable,
        serviceRetireSkipReason: 'current device included by mistake',
        currentDeviceRowId: deviceRecordId,
        retireTargetIds: otherActiveDevices.otherDeviceIds,
      },
    );
  }

  if (otherActiveDevices.otherDeviceCount === 0) {
    logDmE2eeBootstrapDiagnostics('publish:retire-others:none-found', {
      current_device_row_id: deviceRecordId,
      other_device_count: 0,
      includes_current_device: false,
      retire_target_ids: [],
      auth_retire_attempted: false,
      auth_retire_failed: false,
      service_retire_available: serviceRetireAvailable,
      service_retire_skip_reason: 'no retire targets',
      service_retire_attempted: false,
      service_retire_succeeded: false,
      service_retire_failed: false,
      service_retire_error_message: null,
      service_retire_error_code: null,
      service_retire_error_status: null,
    });
  } else {
    logDmE2eeBootstrapDiagnostics('publish:retire-others:auth-attempt', {
      current_device_row_id: deviceRecordId,
      other_device_count: otherActiveDevices.otherDeviceCount,
      includes_current_device: false,
      retire_target_ids: otherActiveDevices.otherDeviceIds,
      auth_retire_attempted: true,
      auth_retire_failed: false,
      service_retire_available: serviceRetireAvailable,
      service_retire_skip_reason: null,
      service_retire_attempted: false,
      service_retire_succeeded: false,
      service_retire_failed: false,
      service_retire_error_message: null,
      service_retire_error_code: null,
      service_retire_error_status: null,
    });
  }

  let retireOthers = otherActiveDevices.otherDeviceCount
    ? await retireOtherDevices(supabase)
    : { error: null };
  let usedPrivilegedRetireOthers = false;

  if (retireOthers.error) {
    const authErrorDiagnostics = getSupabaseErrorDiagnostics(retireOthers.error);
    logDmE2eeBootstrapDiagnostics('publish:retire-others:auth-failed', {
      current_device_row_id: deviceRecordId,
      other_device_count: otherActiveDevices.otherDeviceCount,
      retire_target_ids: otherActiveDevices.otherDeviceIds,
      auth_retire_attempted: true,
      auth_retire_failed: true,
      service_retire_available: serviceRetireAvailable,
      service_retire_skip_reason: serviceRetireAvailable
        ? null
        : 'service client unavailable',
      service_retire_attempted: false,
      service_retire_succeeded: false,
      service_retire_failed: false,
      service_retire_error_message: null,
      service_retire_error_code: null,
      service_retire_error_status: null,
      message: retireOthers.error.message,
      ...authErrorDiagnostics,
    });

    if (!serviceRoleSupabase) {
      logDmE2eeBootstrapDiagnostics('publish:retire-others:service-unavailable', {
        current_device_row_id: deviceRecordId,
        other_device_count: otherActiveDevices.otherDeviceCount,
        retire_target_ids: otherActiveDevices.otherDeviceIds,
        auth_retire_attempted: true,
        auth_retire_failed: true,
        service_retire_available: false,
        service_retire_skip_reason: 'service client unavailable',
        service_retire_attempted: false,
        service_retire_succeeded: false,
        service_retire_failed: false,
        service_retire_error_message: null,
        service_retire_error_code: null,
        service_retire_error_status: null,
      });
      throw createDmE2eeBootstrapPublishError(
        'retire other devices: service fallback unavailable',
        retireOthers.error.message,
        {
          authRetireAttempted: true,
          authRetireFailed: true,
          serviceRetireAvailable: false,
          serviceRetireSkipReason: 'service client unavailable',
          serviceRetireAttempted: false,
          serviceRetireSucceeded: false,
          serviceRetireFailed: false,
          serviceRetireErrorMessage: null,
          serviceRetireErrorCode: null,
          serviceRetireErrorStatus: null,
          currentDeviceRowId: deviceRecordId,
          retireTargetIds: otherActiveDevices.otherDeviceIds,
        },
      );
    }

    logDmE2eeBootstrapDiagnostics('publish:retire-others:service-entered', {
      current_device_row_id: deviceRecordId,
      other_device_count: otherActiveDevices.otherDeviceCount,
      retire_target_ids: otherActiveDevices.otherDeviceIds,
      auth_retire_attempted: true,
      auth_retire_failed: true,
      service_retire_available: true,
      service_retire_skip_reason: null,
      service_retire_attempted: true,
      service_retire_succeeded: false,
      service_retire_failed: false,
      service_retire_error_message: null,
      service_retire_error_code: null,
      service_retire_error_status: null,
    });
    const privilegedRetireOthers = await retireOtherDevices(serviceRoleSupabase);

    if (privilegedRetireOthers.error) {
      const serviceErrorDiagnostics = getSupabaseErrorDiagnostics(
        privilegedRetireOthers.error,
      );
      logDmE2eeBootstrapDiagnostics('publish:retire-others:service-failed', {
        current_device_row_id: deviceRecordId,
        other_device_count: otherActiveDevices.otherDeviceCount,
        retire_target_ids: otherActiveDevices.otherDeviceIds,
        auth_retire_attempted: true,
        auth_retire_failed: true,
        service_retire_available: true,
        service_retire_skip_reason: null,
        service_retire_attempted: true,
        service_retire_succeeded: false,
        service_retire_failed: true,
        service_retire_error_message: privilegedRetireOthers.error.message,
        service_retire_error_code: serviceErrorDiagnostics.error_code,
        service_retire_error_status: serviceErrorDiagnostics.error_status,
        message: privilegedRetireOthers.error.message,
        ...serviceErrorDiagnostics,
      });
      throw createDmE2eeBootstrapPublishError(
        'retire other devices: service fallback failed',
        privilegedRetireOthers.error.message,
        {
          authRetireAttempted: true,
          authRetireFailed: true,
          serviceRetireAvailable: true,
          serviceRetireSkipReason: null,
          serviceRetireAttempted: true,
          serviceRetireSucceeded: false,
          serviceRetireFailed: true,
          serviceRetireErrorMessage: privilegedRetireOthers.error.message,
          serviceRetireErrorCode:
            serviceErrorDiagnostics.error_code ?? null,
          serviceRetireErrorStatus:
            serviceErrorDiagnostics.error_status !== null &&
            serviceErrorDiagnostics.error_status !== undefined
              ? String(serviceErrorDiagnostics.error_status)
              : null,
          currentDeviceRowId: deviceRecordId,
          retireTargetIds: otherActiveDevices.otherDeviceIds,
        },
      );
    }

    retireOthers = privilegedRetireOthers;
    usedPrivilegedRetireOthers = true;
    logDmE2eeBootstrapDiagnostics('publish:retire-others:service-succeeded', {
      current_device_row_id: deviceRecordId,
      other_device_count: otherActiveDevices.otherDeviceCount,
      retire_target_ids: otherActiveDevices.otherDeviceIds,
      auth_retire_attempted: true,
      auth_retire_failed: true,
      service_retire_available: true,
      service_retire_skip_reason: null,
      service_retire_attempted: true,
      service_retire_succeeded: true,
      service_retire_failed: false,
      service_retire_error_message: null,
      service_retire_error_code: null,
      service_retire_error_status: null,
    });
  }

  const verifyRemainingOtherActiveDevices = await listOtherActiveDevices(
    usedPrivilegedRetireOthers && serviceRoleSupabase
      ? serviceRoleSupabase
      : supabase,
  );

  if (verifyRemainingOtherActiveDevices.error) {
    logDmE2eeBootstrapDiagnostics('publish:retire-others:verify-error', {
      current_device_row_id: deviceRecordId,
      other_device_count: otherActiveDevices.otherDeviceCount,
      retire_target_ids: otherActiveDevices.otherDeviceIds,
      auth_retire_attempted: otherActiveDevices.otherDeviceCount > 0,
      auth_retire_failed: Boolean(retireOthers.error),
      service_retire_available: serviceRetireAvailable,
      service_retire_skip_reason: null,
      service_retire_attempted: usedPrivilegedRetireOthers,
      service_retire_succeeded: usedPrivilegedRetireOthers,
      service_retire_failed: false,
      service_retire_error_message: null,
      service_retire_error_code: null,
      service_retire_error_status: null,
      message: verifyRemainingOtherActiveDevices.error.message,
    });
    throw createDmE2eeBootstrapPublishError(
      usedPrivilegedRetireOthers
        ? 'retire other devices: service fallback failed'
        : 'retire other devices: update returned unexpected result',
      verifyRemainingOtherActiveDevices.error.message,
      {
        authRetireAttempted: otherActiveDevices.otherDeviceCount > 0,
        authRetireFailed: false,
        serviceRetireAvailable,
        serviceRetireSkipReason: null,
        serviceRetireAttempted: usedPrivilegedRetireOthers,
        serviceRetireSucceeded: usedPrivilegedRetireOthers,
        serviceRetireFailed: false,
        serviceRetireErrorMessage: null,
        serviceRetireErrorCode: null,
        serviceRetireErrorStatus: null,
        currentDeviceRowId: deviceRecordId,
        retireTargetIds: otherActiveDevices.otherDeviceIds,
      },
    );
  }

  const remainingOtherActiveDevices = summarizeOtherActiveDevices(
    verifyRemainingOtherActiveDevices.data as Array<{ id: string }> | null,
  );

  if (remainingOtherActiveDevices.otherDeviceCount > 0) {
    logDmE2eeBootstrapDiagnostics('publish:retire-others:remaining-active', {
      current_device_row_id: deviceRecordId,
      other_device_count: otherActiveDevices.otherDeviceCount,
      retire_target_ids: otherActiveDevices.otherDeviceIds,
      remaining_other_device_count: remainingOtherActiveDevices.otherDeviceCount,
      auth_retire_attempted: otherActiveDevices.otherDeviceCount > 0,
      auth_retire_failed: false,
      service_retire_available: serviceRetireAvailable,
      service_retire_skip_reason: null,
      service_retire_attempted: usedPrivilegedRetireOthers,
      service_retire_succeeded: usedPrivilegedRetireOthers,
      service_retire_failed: false,
      service_retire_error_message: null,
      service_retire_error_code: null,
      service_retire_error_status: null,
    });
    throw createDmE2eeBootstrapPublishError(
      usedPrivilegedRetireOthers
        ? 'retire other devices: rows still active after fallback'
        : 'retire other devices: update returned unexpected result',
      'Other active device rows remained after the retire-others update.',
      {
        authRetireAttempted: otherActiveDevices.otherDeviceCount > 0,
        authRetireFailed: false,
        serviceRetireAvailable: serviceRetireAvailable,
        serviceRetireSkipReason: null,
        serviceRetireAttempted: usedPrivilegedRetireOthers,
        serviceRetireSucceeded: usedPrivilegedRetireOthers,
        serviceRetireFailed: false,
        serviceRetireErrorMessage: null,
        serviceRetireErrorCode: null,
        serviceRetireErrorStatus: null,
        currentDeviceRowId: deviceRecordId,
        retireTargetIds: otherActiveDevices.otherDeviceIds,
      },
    );
  }

  logDmE2eeBootstrapDiagnostics('publish:retire-others:ok', {
    current_device_row_id: deviceRecordId,
    other_device_count: otherActiveDevices.otherDeviceCount,
    retire_target_ids: otherActiveDevices.otherDeviceIds,
    auth_retire_attempted: otherActiveDevices.otherDeviceCount > 0,
    auth_retire_failed: false,
    service_retire_available: serviceRetireAvailable,
    service_retire_skip_reason: otherActiveDevices.otherDeviceCount
      ? null
      : 'no retire targets',
    service_retire_attempted: usedPrivilegedRetireOthers,
    service_retire_succeeded: usedPrivilegedRetireOthers,
    service_retire_failed: false,
    service_retire_error_message: null,
    service_retire_error_code: null,
    service_retire_error_status: null,
  });

  const prekeyWriteSupabase = serviceRoleSupabase ?? supabase;
  const prekeyWriteContext = serviceRoleSupabase
    ? 'service-role'
    : 'request-auth';

  logDmE2eeBootstrapDiagnostics('publish:replace-prekeys:start', {
    current_device_row_id: deviceRecordId,
    prekey_write_context: prekeyWriteContext,
    published_prekey_count: input.oneTimePrekeys.length,
    result_kind: resultKind,
  });

  // A repaired device publish must replace the full server-side prekey batch for
  // this device record. Keeping previously claimed rows around can block
  // re-insert on the unique (device_id, prekey_id) constraint during republish.
  const deleteExistingPrekeys = await prekeyWriteSupabase
    .from('device_one_time_prekeys')
    .delete()
    .eq('device_id', deviceRecordId);

  if (deleteExistingPrekeys.error) {
    logDmE2eeBootstrapDiagnostics('publish:delete-prekeys-error', {
      message: deleteExistingPrekeys.error.message,
      prekey_write_context: prekeyWriteContext,
    });
    if (
      isMissingRelationErrorMessage(
        deleteExistingPrekeys.error.message,
        'device_one_time_prekeys',
      ) ||
      isMissingColumnErrorMessage(deleteExistingPrekeys.error.message, 'claimed_at')
    ) {
      throw createSchemaRequirementError(
        'DM E2EE bootstrap schema is missing.',
      );
    }

    throw createDmE2eeBootstrapPublishError(
      'delete prekeys',
      deleteExistingPrekeys.error.message,
    );
  }

  if (input.oneTimePrekeys.length > 0) {
    const insertedPrekeys = await prekeyWriteSupabase
      .from('device_one_time_prekeys')
      .upsert(
        input.oneTimePrekeys.map((prekey) => ({
          device_id: deviceRecordId,
          prekey_id: prekey.prekeyId,
          public_key: prekey.publicKey,
        })),
        {
          onConflict: 'device_id,prekey_id',
        },
      );

    if (insertedPrekeys.error) {
      const errorDiagnostics = getSupabaseErrorDiagnostics(insertedPrekeys.error);
      logDmE2eeBootstrapDiagnostics('publish:insert-prekeys-error', {
        error_code:
          typeof errorDiagnostics.error_code === 'string'
            ? errorDiagnostics.error_code
            : null,
        error_details:
          typeof errorDiagnostics.error_details === 'string'
            ? errorDiagnostics.error_details
            : null,
        error_hint:
          typeof errorDiagnostics.error_hint === 'string'
            ? errorDiagnostics.error_hint
            : null,
        message: insertedPrekeys.error.message,
        prekey_write_context: prekeyWriteContext,
        published_prekey_count: input.oneTimePrekeys.length,
      });
      throw createDmE2eeBootstrapPublishError(
        'insert prekeys',
        insertedPrekeys.error.message,
      );
    }
  }

  logDmE2eeBootstrapDiagnostics('publish:replace-prekeys:ok', {
    current_device_row_id: deviceRecordId,
    prekey_write_context: prekeyWriteContext,
    published_prekey_count: input.oneTimePrekeys.length,
  });

  logDmE2eeBootstrapDiagnostics('publish:done', {
    resultKind,
    publishedPrekeyCount: input.oneTimePrekeys.length,
  });

  return {
    deviceRecordId,
    publishedPrekeyCount: input.oneTimePrekeys.length,
    resultKind,
  } satisfies PublishDmE2eeDeviceResult;
}

export async function getCurrentUserDmE2eeRecipientBundle(input: {
  conversationId: string;
  recipientUserId?: string | null;
  userId: string;
}) {
  const supabase = await createSupabaseServerClient();
  const serviceRoleSupabase = createSupabaseServiceRoleClient();
  const conversation = await getConversationForUser(
    input.conversationId,
    input.userId,
  );

  if (!conversation) {
    throw new Error('Conversation is not available.');
  }

  if (conversation.kind !== 'dm') {
    throw new Error('Encrypted DM send is only available for direct chats.');
  }

  const recipientDebugState: DmE2eeRecipientReadinessDebugState = {
    recipientBundleQueryStage: 'participants:auth-query',
    recipientConversationIdChecked: input.conversationId,
    recipientRequestedUserId: input.recipientUserId?.trim() || null,
    recipientUserIdChecked: null,
    recipientDeviceRowsFound: null,
    recipientActiveDeviceRowsFound: null,
    recipientSelectedDeviceRowId: null,
    recipientSelectedDeviceLogicalId: null,
    recipientSelectedDeviceRetiredAt: null,
    recipientSelectedDeviceIdentityKeyPresent: null,
    recipientSelectedDeviceSignedPrekeyPresent: null,
    recipientSelectedDeviceSignaturePresent: null,
    recipientSelectedDeviceAvailablePrekeyCount: null,
    recipientPrekeyQueryDeviceRef: null,
    recipientBundleQueryErrorMessage: null,
    recipientBundleQueryErrorCode: null,
    recipientBundleQueryErrorDetails: null,
    recipientMismatchLeft: null,
    recipientMismatchRight: null,
    recipientReadinessFailedReason: null,
  };
  const rawRequestedRecipientUserId = input.recipientUserId?.trim() || null;
  const requestedRecipientUserId =
    rawRequestedRecipientUserId && rawRequestedRecipientUserId !== input.userId
      ? rawRequestedRecipientUserId
      : null;

  if (rawRequestedRecipientUserId && rawRequestedRecipientUserId === input.userId) {
    recipientDebugState.recipientBundleQueryStage =
      'participants:selected-invalid-self-hint';
    recipientDebugState.recipientMismatchLeft = rawRequestedRecipientUserId;
    recipientDebugState.recipientMismatchRight = input.userId;
    logDmE2eeRecipientBundleDiagnostics('participants:self-hint-ignored', {
      conversationId: input.conversationId,
      requestedRecipientUserId: rawRequestedRecipientUserId,
      userId: input.userId,
    });
  }

  const normalizeConversationParticipants = (
    rows: Array<{
      role?: string | null;
      state?: string | null;
      user_id: string;
    }>,
  ) => {
    const memberships = rows.map((member) => ({
      userId: member.user_id,
      role: member.role ?? null,
      state: member.state ?? null,
    }));
    const uniqueMemberships = Array.from(
      new Map(memberships.map((member) => [member.userId, member])).values(),
    );
    const rolePriority = new Map([
      ['owner', 0],
      ['admin', 1],
      ['member', 2],
    ]);

    return uniqueMemberships.sort((left, right) => {
      const leftPriority = rolePriority.get(left.role ?? 'member') ?? 99;
      const rightPriority = rolePriority.get(right.role ?? 'member') ?? 99;

      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority;
      }

      return left.userId.localeCompare(right.userId);
    }) satisfies ConversationParticipant[];
  };

  let activeConversationParticipants: ConversationParticipant[] = [];

  try {
    activeConversationParticipants = await getConversationParticipants(
      input.conversationId,
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Unable to resolve direct-message participants.';

    if (serviceRoleSupabase && isSupabasePermissionDeniedError(error)) {
      recipientDebugState.recipientBundleQueryStage = 'participants:service';
      recipientDebugState.recipientBundleQueryErrorMessage = message;
      recipientDebugState.recipientReadinessFailedReason =
        'recipient readiness: participant list auth query failed';
      logDmE2eeRecipientBundleDiagnostics('participants:auth-error-fallback', {
        conversationId: input.conversationId,
        message,
        requestedRecipientUserId,
        userId: input.userId,
      });

      const serviceResponse = await serviceRoleSupabase
        .from('conversation_members')
        .select('conversation_id, user_id, role, state')
        .eq('conversation_id', input.conversationId)
        .eq('state', 'active')
        .returns<
          {
            conversation_id: string;
            role?: string | null;
            state?: string | null;
            user_id: string;
          }[]
        >();

      if (serviceResponse.error) {
        recipientDebugState.recipientBundleQueryStage = 'participants:error';
        recipientDebugState.recipientBundleQueryErrorMessage =
          serviceResponse.error.message;
        recipientDebugState.recipientReadinessFailedReason =
          'recipient readiness: participant list query failed';
        throw createDmE2eeRecipientLookupError(
          serviceResponse.error.message,
          recipientDebugState,
        );
      }

      activeConversationParticipants = normalizeConversationParticipants(
        (serviceResponse.data ?? []).filter(
          (membership) => membership.conversation_id === input.conversationId,
        ),
      );
      logDmE2eeRecipientBundleDiagnostics('participants:service-recovered', {
        conversationId: input.conversationId,
        participantCount: activeConversationParticipants.length,
        requestedRecipientUserId,
        userId: input.userId,
      });
    } else {
      recipientDebugState.recipientBundleQueryStage = 'participants:error';
      recipientDebugState.recipientBundleQueryErrorMessage = message;
      recipientDebugState.recipientReadinessFailedReason =
        'recipient readiness: participant list query failed';
      throw createDmE2eeRecipientLookupError(message, recipientDebugState);
    }
  }

  const activeOtherParticipants = activeConversationParticipants.filter(
    (participant) => participant.userId !== input.userId,
  );
  let recipientParticipant =
    requestedRecipientUserId
      ? activeOtherParticipants.find(
          (participant) => participant.userId === requestedRecipientUserId,
        ) ?? null
      : null;

  if (!recipientParticipant && activeOtherParticipants.length === 1) {
    recipientParticipant = activeOtherParticipants[0] ?? null;

    if (
      requestedRecipientUserId &&
      recipientParticipant &&
      recipientParticipant.userId !== requestedRecipientUserId
    ) {
      logDmE2eeRecipientBundleDiagnostics(
        'participants:requested-recipient-recovered',
        {
          conversationId: input.conversationId,
          recipientRecoveredUserId: recipientParticipant.userId,
          recipientRequestedUserId: requestedRecipientUserId,
          userId: input.userId,
        },
      );
    }
  }

  recipientDebugState.recipientBundleQueryStage = 'participants:selected';
  recipientDebugState.recipientUserIdChecked = recipientParticipant?.userId ?? null;

  if (!recipientParticipant?.userId) {
    recipientDebugState.recipientBundleQueryStage =
      activeOtherParticipants.length > 1
        ? 'participants:selected-ambiguous'
        : 'participants:selected-recipient-missing';
    recipientDebugState.recipientReadinessFailedReason =
      activeOtherParticipants.length > 1
        ? 'recipient readiness: multiple active DM recipients found'
        : requestedRecipientUserId
          ? 'recipient readiness: requested recipient participant missing'
          : 'recipient readiness: recipient participant missing';
    recipientDebugState.recipientMismatchLeft =
      requestedRecipientUserId ?? input.userId;
    recipientDebugState.recipientMismatchRight =
      activeOtherParticipants[0]?.userId ?? null;
    throw createDmE2eeRecipientReadinessError(
      'dm_e2ee_recipient_unavailable',
      'Direct-message recipient is not available.',
      recipientDebugState,
    );
  }

  if (
    requestedRecipientUserId &&
    recipientParticipant.userId !== requestedRecipientUserId
  ) {
    recipientDebugState.recipientBundleQueryStage =
      'participants:selected-recipient-mismatch-recovered';
    recipientDebugState.recipientMismatchLeft = requestedRecipientUserId;
    recipientDebugState.recipientMismatchRight = recipientParticipant.userId;
  }
  const lookupRecipientDevices = async (
    client: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  ) =>
    client
      .from('user_devices')
      .select(
        'id, user_id, device_id, registration_id, identity_key_public, signed_prekey_id, signed_prekey_public, signed_prekey_signature, retired_at, created_at',
      )
      .eq('user_id', recipientParticipant.userId)
      .order('created_at', { ascending: false })
      .returns<
        {
          id: string;
          user_id: string;
          device_id: number;
          registration_id: number;
          identity_key_public: string | null;
          signed_prekey_id: number | null;
          signed_prekey_public: string | null;
          signed_prekey_signature: string | null;
          retired_at: string | null;
          created_at: string | null;
        }[]
      >();

  recipientDebugState.recipientBundleQueryStage = 'device-query:auth';
  let deviceLookup = await lookupRecipientDevices(supabase);
  let usedPrivilegedDeviceLookup = false;

  const shouldRetryDeviceLookupPrivileged =
    serviceRoleSupabase &&
    ((!deviceLookup.error && (!deviceLookup.data || deviceLookup.data.length === 0)) ||
      isSupabasePermissionDeniedError(deviceLookup.error));

  if (shouldRetryDeviceLookupPrivileged) {
    recipientDebugState.recipientBundleQueryStage = 'device-query:service';
    logDmE2eeRecipientBundleDiagnostics(
      deviceLookup.error
        ? 'device-lookup:auth-error-fallback'
        : 'device-lookup:auth-empty',
      {
        conversationId: input.conversationId,
        recipientUserId: recipientParticipant.userId,
        message: deviceLookup.error?.message ?? null,
      },
    );
    const privilegedLookup = await lookupRecipientDevices(serviceRoleSupabase);

    if (!privilegedLookup.error) {
      deviceLookup = privilegedLookup;
      usedPrivilegedDeviceLookup = Array.isArray(privilegedLookup.data)
        ? privilegedLookup.data.length > 0
        : false;
    }
  }

  if (deviceLookup.error) {
    const errorDiagnostics = getSupabaseErrorDiagnostics(deviceLookup.error);
    recipientDebugState.recipientBundleQueryStage = 'device-query:error';
    recipientDebugState.recipientBundleQueryErrorMessage =
      deviceLookup.error.message;
    recipientDebugState.recipientBundleQueryErrorCode =
      typeof errorDiagnostics.error_code === 'string'
        ? errorDiagnostics.error_code
        : null;
    recipientDebugState.recipientBundleQueryErrorDetails =
      typeof errorDiagnostics.error_details === 'string'
        ? errorDiagnostics.error_details
        : null;
    recipientDebugState.recipientReadinessFailedReason =
      'recipient readiness: lookup query failed';
    if (
      isMissingRelationErrorMessage(deviceLookup.error.message, 'user_devices') ||
      isMissingColumnErrorMessage(deviceLookup.error.message, 'signed_prekey_public')
    ) {
      throw createDmE2eeRecipientLookupError(
        'DM E2EE bootstrap schema is missing.',
        recipientDebugState,
      );
    }

    throw createDmE2eeRecipientLookupError(
      deviceLookup.error.message,
      recipientDebugState,
    );
  }

  const recipientDeviceRows = Array.isArray(deviceLookup.data)
    ? deviceLookup.data
    : [];
  const activeRecipientDeviceRows = recipientDeviceRows.filter(
    (device) => device.retired_at === null,
  );
  const selectedRecipientDevice = activeRecipientDeviceRows[0] ?? null;
  recipientDebugState.recipientDeviceRowsFound = recipientDeviceRows.length;
  recipientDebugState.recipientActiveDeviceRowsFound =
    activeRecipientDeviceRows.length;
  recipientDebugState.recipientSelectedDeviceRowId =
    selectedRecipientDevice?.id ?? null;
  recipientDebugState.recipientSelectedDeviceLogicalId =
    selectedRecipientDevice?.device_id ?? null;
  recipientDebugState.recipientSelectedDeviceRetiredAt =
    selectedRecipientDevice?.retired_at ?? null;
  recipientDebugState.recipientSelectedDeviceIdentityKeyPresent =
    Boolean(selectedRecipientDevice?.identity_key_public?.trim());
  recipientDebugState.recipientSelectedDeviceSignedPrekeyPresent =
    Boolean(selectedRecipientDevice?.signed_prekey_public?.trim());
  recipientDebugState.recipientSelectedDeviceSignaturePresent =
    Boolean(selectedRecipientDevice?.signed_prekey_signature?.trim());

  if (recipientDeviceRows.length === 0) {
    recipientDebugState.recipientBundleQueryStage = 'device-selection:none';
    recipientDebugState.recipientReadinessFailedReason =
      'recipient readiness: no device rows found';
    throw createDmE2eeRecipientReadinessError(
      'dm_e2ee_recipient_device_missing',
      'Recipient does not have a DM E2EE device registered yet.',
      recipientDebugState,
    );
  }

  if (activeRecipientDeviceRows.length === 0 || !selectedRecipientDevice) {
    recipientDebugState.recipientBundleQueryStage = 'device-selection:no-active';
    recipientDebugState.recipientReadinessFailedReason =
      'recipient readiness: no active device rows found';
    throw createDmE2eeRecipientReadinessError(
      'dm_e2ee_recipient_device_missing',
      'Recipient does not have an active DM E2EE device registered yet.',
      recipientDebugState,
    );
  }

  if (selectedRecipientDevice.retired_at !== null) {
    recipientDebugState.recipientBundleQueryStage =
      'device-selection:selected-retired';
    recipientDebugState.recipientReadinessFailedReason =
      'recipient readiness: selected device is retired';
    throw createDmE2eeRecipientReadinessError(
      'dm_e2ee_recipient_unavailable',
      'Recipient DM E2EE device is retired.',
      recipientDebugState,
    );
  }

  if (!selectedRecipientDevice.identity_key_public?.trim()) {
    recipientDebugState.recipientBundleQueryStage =
      'device-selection:identity-missing';
    recipientDebugState.recipientReadinessFailedReason =
      'recipient readiness: identity key missing';
    throw createDmE2eeRecipientReadinessError(
      'dm_e2ee_recipient_unavailable',
      'Recipient DM E2EE identity material is incomplete.',
      recipientDebugState,
    );
  }

  if (
    !Number.isInteger(selectedRecipientDevice.signed_prekey_id) ||
    !selectedRecipientDevice.signed_prekey_public?.trim()
  ) {
    recipientDebugState.recipientBundleQueryStage =
      'device-selection:signed-prekey-missing';
    recipientDebugState.recipientReadinessFailedReason =
      'recipient readiness: signed prekey missing';
    throw createDmE2eeRecipientReadinessError(
      'dm_e2ee_recipient_unavailable',
      'Recipient DM E2EE signed prekey is missing.',
      recipientDebugState,
    );
  }

  if (!selectedRecipientDevice.signed_prekey_signature?.trim()) {
    recipientDebugState.recipientBundleQueryStage =
      'device-selection:signature-missing';
    recipientDebugState.recipientReadinessFailedReason =
      'recipient readiness: signed prekey signature missing';
    throw createDmE2eeRecipientReadinessError(
      'dm_e2ee_recipient_unavailable',
      'Recipient DM E2EE signed prekey signature is missing.',
      recipientDebugState,
    );
  }

  const recipientSignedPrekeyId = selectedRecipientDevice.signed_prekey_id as number;
  const recipientSignedPrekeyPublic =
    selectedRecipientDevice.signed_prekey_public as string;
  const recipientSignedPrekeySignature =
    selectedRecipientDevice.signed_prekey_signature as string;
  const recipientIdentityKeyPublic =
    selectedRecipientDevice.identity_key_public as string;
  // Enforce one identifier contract in this path:
  // - user_devices.id (UUID) is the relational device row id for DB lookups
  // - user_devices.device_id (integer) is protocol metadata returned to the client
  const selectedRecipientDeviceRowId = selectedRecipientDevice.id;
  const selectedRecipientLogicalDeviceId = selectedRecipientDevice.device_id;
  recipientDebugState.recipientBundleQueryStage = 'device-selection:selected';
  recipientDebugState.recipientPrekeyQueryDeviceRef =
    selectedRecipientDeviceRowId;

  const lookupAvailableOneTimePrekey = async (
    client: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  ) =>
    client
      .from('device_one_time_prekeys')
      .select('prekey_id, public_key', { count: 'exact' })
      .eq('device_id', selectedRecipientDeviceRowId)
      .is('claimed_at', null)
      .order('created_at', { ascending: true })
      .limit(1)
      .returns<
        {
          prekey_id: number;
          public_key: string;
        }[]
      >();

  recipientDebugState.recipientBundleQueryStage = 'prekey-query:auth';
  let oneTimePrekeyLookup = await lookupAvailableOneTimePrekey(supabase);
  let usedPrivilegedPrekeyLookup = false;

  const shouldRetryPrekeyLookupPrivileged =
    serviceRoleSupabase &&
    ((!oneTimePrekeyLookup.error &&
      (!oneTimePrekeyLookup.data || oneTimePrekeyLookup.data.length === 0)) ||
      isSupabasePermissionDeniedError(oneTimePrekeyLookup.error));

  if (shouldRetryPrekeyLookupPrivileged) {
    recipientDebugState.recipientBundleQueryStage = 'prekey-query:service';
    logDmE2eeRecipientBundleDiagnostics(
      oneTimePrekeyLookup.error
        ? 'prekey-lookup:auth-error-fallback'
        : 'prekey-lookup:auth-empty',
      {
        conversationId: input.conversationId,
        recipientUserId: recipientParticipant.userId,
        recipientDeviceRecordId: selectedRecipientDeviceRowId,
        recipientLogicalDeviceId: selectedRecipientLogicalDeviceId,
        usedPrivilegedDeviceLookup,
        message: oneTimePrekeyLookup.error?.message ?? null,
      },
    );
    const privilegedLookup =
      await lookupAvailableOneTimePrekey(serviceRoleSupabase);

    if (!privilegedLookup.error) {
      oneTimePrekeyLookup = privilegedLookup;
      usedPrivilegedPrekeyLookup = Array.isArray(privilegedLookup.data)
        ? privilegedLookup.data.length > 0
        : false;
    }
  }

  if (oneTimePrekeyLookup.error) {
    const errorDiagnostics = getSupabaseErrorDiagnostics(oneTimePrekeyLookup.error);
    recipientDebugState.recipientBundleQueryStage = 'prekey-query:error';
    recipientDebugState.recipientBundleQueryErrorMessage =
      oneTimePrekeyLookup.error.message;
    recipientDebugState.recipientBundleQueryErrorCode =
      typeof errorDiagnostics.error_code === 'string'
        ? errorDiagnostics.error_code
        : null;
    recipientDebugState.recipientBundleQueryErrorDetails =
      typeof errorDiagnostics.error_details === 'string'
        ? errorDiagnostics.error_details
        : null;
    recipientDebugState.recipientReadinessFailedReason =
      'recipient readiness: lookup query failed';
    if (
      isMissingRelationErrorMessage(
        oneTimePrekeyLookup.error.message,
        'device_one_time_prekeys',
      ) ||
      isMissingColumnErrorMessage(oneTimePrekeyLookup.error.message, 'claimed_at')
    ) {
      throw createDmE2eeRecipientLookupError(
        'DM E2EE bootstrap schema is missing.',
        recipientDebugState,
      );
    }

    throw createDmE2eeRecipientLookupError(
      oneTimePrekeyLookup.error.message,
      recipientDebugState,
    );
  }

  const availablePrekeys = Array.isArray(oneTimePrekeyLookup.data)
    ? oneTimePrekeyLookup.data
    : [];
  const availablePrekeyCount = oneTimePrekeyLookup.count ?? 0;
  recipientDebugState.recipientSelectedDeviceAvailablePrekeyCount =
    availablePrekeyCount;

  const hasAvailableOneTimePrekey =
    availablePrekeyCount > 0 && availablePrekeys.length > 0;

  recipientDebugState.recipientBundleQueryStage = hasAvailableOneTimePrekey
    ? 'bundle:resolved'
    : 'bundle:resolved:signed-prekey-only';
  recipientDebugState.recipientReadinessFailedReason = null;
  logDmE2eeRecipientBundleDiagnostics(
    hasAvailableOneTimePrekey
      ? 'bundle:resolved'
      : 'bundle:resolved:signed-prekey-only',
    {
    conversationId: input.conversationId,
    recipientUserId: recipientParticipant.userId,
    usedPrivilegedDeviceLookup,
    usedPrivilegedPrekeyLookup,
    ...recipientDebugState,
    hasRecipientDevice: true,
    hasOneTimePrekey: hasAvailableOneTimePrekey,
  },
  );

  return {
    conversationId: input.conversationId,
    recipient: {
      deviceRecordId: selectedRecipientDeviceRowId,
      userId: selectedRecipientDevice.user_id,
      deviceId: selectedRecipientLogicalDeviceId,
      registrationId: selectedRecipientDevice.registration_id,
      identityKeyPublic: recipientIdentityKeyPublic,
      signedPrekeyId: recipientSignedPrekeyId,
      signedPrekeyPublic: recipientSignedPrekeyPublic,
      signedPrekeySignature: recipientSignedPrekeySignature,
      oneTimePrekeyId: hasAvailableOneTimePrekey
        ? availablePrekeys[0]?.prekey_id ?? null
        : null,
      oneTimePrekeyPublic: hasAvailableOneTimePrekey
        ? availablePrekeys[0]?.public_key ?? null
        : null,
    } satisfies UserDevicePublicBundle,
  } satisfies DmE2eeRecipientBundleResponse;
}

export async function resetCurrentUserDmE2eeDeviceForDev(input: {
  userId: string;
}) {
  if (!isDmE2eeDevResetEnabled()) {
    throw new Error('DM E2EE dev reset is disabled.');
  }

  const supabase = await createSupabaseServerClient();
  const now = new Date().toISOString();
  logDmE2eeBootstrapDiagnostics('dev-reset:start', {
    hasUserId: Boolean(input.userId),
  });

  const deviceLookup = await supabase
    .from('user_devices')
    .select('id')
    .eq('user_id', input.userId)
    .is('retired_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (deviceLookup.error) {
    logDmE2eeBootstrapDiagnostics('dev-reset:device-lookup-error', {
      message: deviceLookup.error.message,
    });
    throw createDmE2eeBootstrapPublishError(
      'dev reset device lookup',
      deviceLookup.error.message,
    );
  }

  const activeDeviceId = String(
    (deviceLookup.data as { id: string } | null)?.id ?? '',
  ).trim();

  if (!activeDeviceId) {
    logDmE2eeBootstrapDiagnostics('dev-reset:device-not-found');
    return {
      foundDevice: false,
      clearedPrekeys: 0,
      retiredDevice: false,
    };
  }

  logDmE2eeBootstrapDiagnostics('dev-reset:device-found');

  const deletePrekeys = await supabase
    .from('device_one_time_prekeys')
    .delete()
    .eq('device_id', activeDeviceId)
    .select('id');

  if (deletePrekeys.error) {
    logDmE2eeBootstrapDiagnostics('dev-reset:delete-prekeys-error', {
      message: deletePrekeys.error.message,
    });
    throw createDmE2eeBootstrapPublishError(
      'dev reset delete prekeys',
      deletePrekeys.error.message,
    );
  }

  const clearedPrekeys = ((deletePrekeys.data ?? []) as Array<{ id: string }>)
    .length;
  logDmE2eeBootstrapDiagnostics('dev-reset:prekeys-cleared', {
    clearedPrekeys,
  });

  const retireDevice = await supabase
    .from('user_devices')
    .update({
      retired_at: now,
      last_seen_at: now,
    })
    .eq('id', activeDeviceId)
    .is('retired_at', null)
    .select('id')
    .maybeSingle();

  if (retireDevice.error) {
    logDmE2eeBootstrapDiagnostics('dev-reset:retire-device-error', {
      message: retireDevice.error.message,
    });
    throw createDmE2eeBootstrapPublishError(
      'dev reset retire device',
      retireDevice.error.message,
    );
  }

  const retiredDevice = Boolean((retireDevice.data as { id: string } | null)?.id);
  logDmE2eeBootstrapDiagnostics('dev-reset:device-retired', {
    retiredDevice,
  });

  return {
    foundDevice: true,
    clearedPrekeys,
    retiredDevice,
  };
}

async function getCurrentUserActiveDmE2eeDeviceInfo(input: {
  preferredDeviceRecordId?: string | null;
  userId: string;
}) {
  const supabase = await createSupabaseServerClient();
  const cookieStore = await cookies();
  const hintedDeviceRecordId =
    cookieStore.get(DM_E2EE_CURRENT_DEVICE_COOKIE)?.value?.trim() || null;
  const preferredDeviceRecordId =
    input.preferredDeviceRecordId?.trim() || null;
  const resolveDevice = async (hintedId: string | null) =>
    hintedId
      ? supabase
          .from('user_devices')
          .select('id, created_at')
          .eq('user_id', input.userId)
          .eq('id', hintedId)
          .is('retired_at', null)
          .maybeSingle()
      : supabase
          .from('user_devices')
          .select('id, created_at')
          .eq('user_id', input.userId)
          .is('retired_at', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
  const candidateDeviceIds = Array.from(
    new Set(
      [preferredDeviceRecordId, hintedDeviceRecordId]
        .map((value) => value?.trim() || '')
        .filter(Boolean),
    ),
  );
  let response:
    | Awaited<ReturnType<typeof resolveDevice>>
    | null = null;
  let selectionSource: 'client-hint' | 'cookie' | 'latest-active' =
    'latest-active';

  for (const candidateDeviceId of candidateDeviceIds) {
    response = await resolveDevice(candidateDeviceId);

    if (response.error || response.data) {
      selectionSource =
        candidateDeviceId === preferredDeviceRecordId ? 'client-hint' : 'cookie';
      break;
    }
  }

  if (!response || (!response.error && !response.data)) {
    response = await resolveDevice(null);
    selectionSource = 'latest-active';
  }

  if (response.error) {
    if (
      isMissingRelationErrorMessage(response.error.message, 'user_devices') ||
      isMissingColumnErrorMessage(response.error.message, 'retired_at')
    ) {
      return null;
    }

    throw new Error(response.error.message);
  }

  const row = response.data as
    | { id?: string | null; created_at?: string | null }
    | null;

  return {
    createdAt: row?.created_at ?? null,
    id: (row?.id ?? null) as string | null,
    selectionSource,
  } as const;
}

export async function getCurrentUserDmE2eeEnvelopesForMessages(input: {
  debugRequestId?: string | null;
  userId: string;
  messageIds: string[];
  preferredDeviceRecordId?: string | null;
}) {
  const diagnosticsEnabled = process.env.CHAT_DEBUG_DM_E2EE_BOOTSTRAP === '1';
  const logDiagnostics = (stage: string, details?: Record<string, unknown>) => {
    if (!diagnosticsEnabled) {
      return;
    }

    if (details) {
      console.info('[dm-e2ee-history]', stage, details);
      return;
    }

    console.info('[dm-e2ee-history]', stage);
  };
  const uniqueMessageIds = Array.from(
    new Set(input.messageIds.map((value) => value.trim()).filter(Boolean)),
  );

  if (uniqueMessageIds.length === 0) {
    return {
      activeDeviceCreatedAt: null,
      activeDeviceRecordId: null,
      envelopesByMessage: new Map<string, StoredDmE2eeEnvelope>(),
      selectionSource: null,
    };
  }

  const activeDevice = await getCurrentUserActiveDmE2eeDeviceInfo({
    preferredDeviceRecordId: input.preferredDeviceRecordId ?? null,
    userId: input.userId,
  });
  const activeDeviceRecordId = activeDevice?.id ?? null;
  logDiagnostics('envelopes:active-device-resolved', {
    currentUserId: input.userId,
    activeDeviceRecordId,
    activeDeviceCreatedAt: activeDevice?.createdAt ?? null,
    debugRequestId: input.debugRequestId ?? null,
    messageCount: uniqueMessageIds.length,
    selectionSource: activeDevice?.selectionSource ?? null,
  });

  const supabase = await createSupabaseServerClient();
  const serviceRoleSupabase = createSupabaseServiceRoleClient();
  const lookupEnvelopes = async (
    client: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  ) =>
    client
      .from('message_e2ee_envelopes')
      .select(
        'message_id, recipient_device_id, envelope_type, ciphertext, used_one_time_prekey_id, created_at, messages!inner(sender_device_id,sender_id)',
      )
      .in('message_id', uniqueMessageIds);

  const selectReadableEnvelopes = (
    rows: MessageE2eeEnvelopeRow[] | null | undefined,
  ) => {
    let malformedEnvelopeCount = 0;
    let selectedCurrentDeviceEnvelopeCount = 0;
    let selectedSenderSelfEnvelopeCount = 0;
    const messagesWithAnyEnvelopeRows = new Set<string>();
    const messagesWithOtherDeviceEnvelopes = new Set<string>();
    const messagesWithReadableEnvelope = new Set<string>();
    const otherRecipientDeviceIds = new Set<string>();
    const selectedEnvelopes = (rows ?? []).flatMap<
      [string, StoredDmE2eeEnvelope]
    >((row) => {
      const messageRecord = normalizeJoinedRecord(row.messages);
      const senderDeviceRecordId = String(
        messageRecord?.sender_device_id ?? '',
      ).trim();
      const senderId = String(messageRecord?.sender_id ?? '').trim();
      const recipientDeviceRecordId = String(row.recipient_device_id ?? '').trim();
      const ciphertext = String(row.ciphertext ?? '').trim();
      messagesWithAnyEnvelopeRows.add(row.message_id);

      const isCurrentDeviceEnvelope =
        Boolean(activeDeviceRecordId) &&
        recipientDeviceRecordId === activeDeviceRecordId;
      const isSenderSelfEnvelope =
        senderId === input.userId &&
        Boolean(senderDeviceRecordId) &&
        recipientDeviceRecordId === senderDeviceRecordId;

      if (!isCurrentDeviceEnvelope && !isSenderSelfEnvelope) {
        if (recipientDeviceRecordId) {
          otherRecipientDeviceIds.add(recipientDeviceRecordId);
        }
        messagesWithOtherDeviceEnvelopes.add(row.message_id);
        return [];
      }

      if (!senderDeviceRecordId || !ciphertext) {
        malformedEnvelopeCount += 1;
        logDiagnostics('envelopes:skip-malformed', {
          currentUserId: input.userId,
          debugRequestId: input.debugRequestId ?? null,
          hasCiphertext: Boolean(ciphertext),
          messageId: row.message_id,
          recipientDeviceRecordId,
          senderDeviceRecordId,
        });
        return [];
      }

      if (isCurrentDeviceEnvelope) {
        selectedCurrentDeviceEnvelopeCount += 1;
      } else if (isSenderSelfEnvelope) {
        selectedSenderSelfEnvelopeCount += 1;
      }
      messagesWithReadableEnvelope.add(row.message_id);

      return [[
        row.message_id,
        {
          messageId: row.message_id,
          senderDeviceRecordId,
          recipientDeviceRecordId,
          envelopeType:
            row.envelope_type === 'signal_message'
              ? 'signal_message'
              : 'prekey_signal_message',
          ciphertext,
          usedOneTimePrekeyId: row.used_one_time_prekey_id ?? null,
          createdAt: row.created_at ?? null,
        } satisfies StoredDmE2eeEnvelope,
      ]];
    });

    return {
      envelopeMap: new Map(selectedEnvelopes),
      malformedEnvelopeCount,
      messagesWithOnlyOtherDeviceEnvelopes: Array.from(
        messagesWithOtherDeviceEnvelopes,
      ).filter((messageId) => !messagesWithReadableEnvelope.has(messageId)),
      otherRecipientDeviceIds: Array.from(otherRecipientDeviceIds),
      selectedCurrentDeviceEnvelopeCount,
      selectedSenderSelfEnvelopeCount,
      totalEnvelopeRowCount: (rows ?? []).length,
      totalMessagesWithAnyEnvelopeRows: messagesWithAnyEnvelopeRows.size,
    };
  };

  let response = await lookupEnvelopes(supabase);
  let usedPrivilegedEnvelopeLookup = false;
  const authEnvelopeRowCount = Array.isArray(response.data)
    ? response.data.length
    : 0;
  let selectedEnvelopeResult = selectReadableEnvelopes(
    (response.data ?? null) as MessageE2eeEnvelopeRow[] | null,
  );
  const authSelectedEnvelopeCount = selectedEnvelopeResult.envelopeMap.size;
  const shouldRetryWithPrivilegedEnvelopeLookup =
    serviceRoleSupabase &&
    (isSupabasePermissionDeniedError(response.error) ||
      (!response.error &&
        authSelectedEnvelopeCount < uniqueMessageIds.length));

  if (shouldRetryWithPrivilegedEnvelopeLookup) {
    logDiagnostics(
      response.error
        ? 'envelopes:auth-error-fallback'
        : 'envelopes:auth-selection-fallback',
      {
        activeDeviceRecordId,
        authEnvelopeRowCount,
        authSelectedEnvelopeCount,
        currentUserId: input.userId,
        debugRequestId: input.debugRequestId ?? null,
        errorMessage: response.error?.message ?? null,
        requestedMessageCount: uniqueMessageIds.length,
      },
    );

    const privilegedResponse = await lookupEnvelopes(serviceRoleSupabase);
    const privilegedEnvelopeRowCount = Array.isArray(privilegedResponse.data)
      ? privilegedResponse.data.length
      : 0;
    const privilegedSelectedEnvelopeResult = selectReadableEnvelopes(
      (privilegedResponse.data ?? null) as MessageE2eeEnvelopeRow[] | null,
    );
    const privilegedSelectedEnvelopeCount =
      privilegedSelectedEnvelopeResult.envelopeMap.size;

    if (
      !privilegedResponse.error &&
      (response.error ||
        privilegedSelectedEnvelopeCount > authSelectedEnvelopeCount ||
        (privilegedSelectedEnvelopeCount === authSelectedEnvelopeCount &&
          privilegedEnvelopeRowCount > authEnvelopeRowCount))
    ) {
      response = privilegedResponse;
      selectedEnvelopeResult = privilegedSelectedEnvelopeResult;
      usedPrivilegedEnvelopeLookup = true;
    }
  }

  if (response.error) {
    if (
      isMissingRelationErrorMessage(
        response.error.message,
        'message_e2ee_envelopes',
      ) ||
      isMissingColumnErrorMessage(response.error.message, 'sender_device_id') ||
      isMissingColumnErrorMessage(response.error.message, 'ciphertext')
    ) {
      return {
        activeDeviceCreatedAt: activeDevice?.createdAt ?? null,
        activeDeviceRecordId,
        envelopesByMessage: new Map<string, StoredDmE2eeEnvelope>(),
        selectionSource: activeDevice?.selectionSource ?? null,
      };
    }

    throw new Error(response.error.message);
  }

  if (!activeDeviceRecordId) {
    logDiagnostics('envelopes:no-active-device', {
      currentUserId: input.userId,
      debugRequestId: input.debugRequestId ?? null,
    });
  }
  logDiagnostics('envelopes:loaded', {
    currentUserId: input.userId,
    activeDeviceRecordId,
    activeDeviceCreatedAt: activeDevice?.createdAt ?? null,
    authEnvelopeRowCount,
    authSelectedEnvelopeCount,
    debugRequestId: input.debugRequestId ?? null,
    messagesWithOnlyOtherDeviceEnvelopes:
      selectedEnvelopeResult.messagesWithOnlyOtherDeviceEnvelopes,
    messagesWithOnlyOtherDeviceEnvelopesCount:
      selectedEnvelopeResult.messagesWithOnlyOtherDeviceEnvelopes.length,
    malformedEnvelopeCount: selectedEnvelopeResult.malformedEnvelopeCount,
    otherRecipientDeviceCount:
      selectedEnvelopeResult.otherRecipientDeviceIds.length,
    otherRecipientDeviceIds: selectedEnvelopeResult.otherRecipientDeviceIds,
    selectedCurrentDeviceEnvelopeCount:
      selectedEnvelopeResult.selectedCurrentDeviceEnvelopeCount,
    selectedSenderSelfEnvelopeCount:
      selectedEnvelopeResult.selectedSenderSelfEnvelopeCount,
    requestedMessageCount: uniqueMessageIds.length,
    envelopeCount: selectedEnvelopeResult.envelopeMap.size,
    selectionSource: activeDevice?.selectionSource ?? null,
    totalEnvelopeRowCount: selectedEnvelopeResult.totalEnvelopeRowCount,
    totalMessagesWithAnyEnvelopeRows:
      selectedEnvelopeResult.totalMessagesWithAnyEnvelopeRows,
    usedPrivilegedEnvelopeLookup,
  });

  return {
    activeDeviceCreatedAt: activeDevice?.createdAt ?? null,
    activeDeviceRecordId,
    envelopesByMessage: selectedEnvelopeResult.envelopeMap,
    selectionSource: activeDevice?.selectionSource ?? null,
  };
}

export async function getAvailableUsers(
  currentUserId: string,
  options?: {
    spaceId?: string | null;
    source?: string;
  },
) {
  const supabase = await createSupabaseServerClient();
  let userIds: string[] = [];
  const source = options?.source ?? 'unknown';
  const requestedSpaceId = options?.spaceId?.trim() || null;

  if (!requestedSpaceId) {
    throw new Error(
      'Space-scoped user lookup requires an explicit current space.',
    );
  }

  const exactSpaceAccess = await requireExactSpaceAccessForUser({
    requestedSpaceId,
    source: `${source}:available-users-space-access`,
    userId: currentUserId,
  });

  logSpaceMembershipDiagnostics('getAvailableUsers:space-members:start', {
    source,
    queryShape:
      "from('space_members').select('user_id').eq('space_id', ?).neq('user_id', ?).order('user_id')",
    requestedSpaceId,
    resolvedSpaceId: exactSpaceAccess.activeSpace.id,
  });
  const { data, error } = await supabase
    .from('space_members')
    .select('user_id')
    .eq('space_id', exactSpaceAccess.activeSpace.id)
    .neq('user_id', currentUserId)
    .order('user_id', { ascending: true });

  if (error) {
    logSpaceMembershipDiagnostics('getAvailableUsers:space-members:error', {
      source,
      message: error.message,
    });
    if (isMissingRelationErrorMessage(error.message, 'space_members')) {
      throw createSchemaRequirementError(
        'Space-scoped user lookup requires public.space_members.',
      );
    }

    throw new Error(error.message);
  }

  userIds = ((data ?? []) as { user_id: string }[]).map((row) => row.user_id);
  logSpaceMembershipDiagnostics('getAvailableUsers:space-members:ok', {
    source,
    count: userIds.length,
  });

  const identities = await getProfileIdentities(userIds);
  const identityByUserId = new Map<string, MessageSenderProfile>(
    identities.map((identity) => [identity.userId, identity] as const),
  );

  return userIds.map((userId) => {
    const identity = identityByUserId.get(userId);

    return {
      userId,
      displayName: identity?.displayName ?? null,
      username: identity?.username ?? null,
      emailLocalPart: identity?.emailLocalPart ?? null,
      avatarPath: identity?.avatarPath ?? null,
      statusEmoji: identity?.statusEmoji ?? null,
      statusText: identity?.statusText ?? null,
      statusUpdatedAt: identity?.statusUpdatedAt ?? null,
    };
  }) satisfies AvailableUser[];
}

export async function getExistingActiveDmPartnerUserIds(
  currentUserId: string,
  options?: {
    spaceId?: string | null;
  },
) {
  const supabase = await createSupabaseServerClient();
  let activeDmMembershipQuery = supabase
    .from('conversation_members')
    .select(
      options?.spaceId
        ? 'conversation_id, conversations!inner(id, kind, space_id)'
        : 'conversation_id, conversations!inner(id, kind)',
    )
    .eq('user_id', currentUserId)
    .eq('state', 'active')
    .eq('conversations.kind', 'dm');

  if (options?.spaceId) {
    activeDmMembershipQuery = activeDmMembershipQuery.eq(
      'conversations.space_id',
      options.spaceId,
    );
  }

  const { data: activeDmMemberships, error: activeDmMembershipsError } =
    await activeDmMembershipQuery;

  if (activeDmMembershipsError) {
    throw new Error(activeDmMembershipsError.message);
  }

  const conversationIds = ((activeDmMemberships ?? []) as Array<{
    conversation_id: string;
  }>)
    .map((row) => row.conversation_id)
    .filter(Boolean);

  if (conversationIds.length === 0) {
    return [] as string[];
  }

  const { data: partnerMemberships, error: partnerMembershipsError } =
    await supabase
      .from('conversation_members')
      .select('conversation_id, user_id')
      .in('conversation_id', conversationIds)
      .eq('state', 'active')
      .neq('user_id', currentUserId);

  if (partnerMembershipsError) {
    throw new Error(partnerMembershipsError.message);
  }

  return Array.from(
    new Set(
      ((partnerMemberships ?? []) as Array<{ user_id: string }>).map(
        (row) => row.user_id,
      ),
    ),
  );
}

export async function getExistingActiveDmPartnerUserIdsForCandidates(
  currentUserId: string,
  candidateUserIds: string[],
  options?: {
    spaceId?: string | null;
  },
) {
  const uniqueCandidateUserIds = Array.from(
    new Set(
      candidateUserIds
        .map((value) => value.trim())
        .filter((value) => value && value !== currentUserId),
    ),
  );

  if (uniqueCandidateUserIds.length === 0) {
    return [] as string[];
  }

  const supabase = await createSupabaseServerClient();
  const lookupKeysByCandidateUserId = new Map(
    uniqueCandidateUserIds.map((candidateUserId) => [
      candidateUserId,
      buildDmConversationLookupKeys({
        leftUserId: currentUserId,
        rightUserId: candidateUserId,
        spaceId: options?.spaceId ?? null,
      }),
    ]),
  );
  const dmConversationKeys = Array.from(
    new Set(
      Array.from(lookupKeysByCandidateUserId.values()).flatMap((keys) => keys),
    ),
  );

  if (dmConversationKeys.length === 0) {
    return [] as string[];
  }

  let keyedLookupQuery = supabase
    .from('conversations')
    .select(
      options?.spaceId
        ? 'id, kind, dm_key, space_id, created_at, last_message_at'
        : 'id, kind, dm_key, created_at, last_message_at',
    )
    .eq('kind', 'dm')
    .in('dm_key', dmConversationKeys);

  if (options?.spaceId) {
    keyedLookupQuery = keyedLookupQuery.eq('space_id', options.spaceId);
  }

  const { data: keyedRows, error: keyedLookupError } = await keyedLookupQuery;

  if (keyedLookupError) {
    if (
      isMissingColumnErrorMessage(keyedLookupError.message, 'dm_key') ||
      isMissingColumnErrorMessage(keyedLookupError.message, 'space_id')
    ) {
      const existingPartnerUserIds = await getExistingActiveDmPartnerUserIds(
        currentUserId,
        options,
      );

      return uniqueCandidateUserIds.filter((candidateUserId) =>
        existingPartnerUserIds.includes(candidateUserId),
      );
    }

    throw new Error(keyedLookupError.message);
  }

  const candidateConversationRows = ((keyedRows ?? []) as unknown as Array<{
    id: string;
    kind: string | null;
    dm_key?: string | null;
    created_at?: string | null;
    last_message_at?: string | null;
  }>).map((row) => ({
    conversationId: row.id,
    conversationKey: row.dm_key?.trim() || null,
    createdAt: row.created_at ?? null,
    lastMessageAt: row.last_message_at ?? null,
  }));

  if (candidateConversationRows.length === 0) {
    return [] as string[];
  }

  const { data: candidateMembers, error: candidateMembersError } = await supabase
    .from('conversation_members')
    .select('conversation_id, user_id')
    .in(
      'conversation_id',
      candidateConversationRows.map((conversation) => conversation.conversationId),
    )
    .eq('state', 'active');

  if (candidateMembersError) {
    throw new Error(candidateMembersError.message);
  }

  const memberIdsByConversation = new Map<string, Set<string>>();

  for (const row of (candidateMembers ?? []) as Array<{
    conversation_id: string;
    user_id: string;
  }>) {
    const memberIds =
      memberIdsByConversation.get(row.conversation_id) ?? new Set<string>();
    memberIds.add(row.user_id);
    memberIdsByConversation.set(row.conversation_id, memberIds);
  }

  const existingPartnerUserIds = new Set<string>();

  for (const candidateUserId of uniqueCandidateUserIds) {
    const expectedConversationKeys = new Set(
      lookupKeysByCandidateUserId.get(candidateUserId) ?? [],
    );
    const matchingConversations = candidateConversationRows
      .filter((conversation) =>
        conversation.conversationKey
          ? expectedConversationKeys.has(conversation.conversationKey)
          : false,
      )
      .filter((conversation) => {
        const memberIds = memberIdsByConversation.get(conversation.conversationId);

        if (!memberIds || memberIds.size !== 2) {
          return false;
        }

        return memberIds.has(currentUserId) && memberIds.has(candidateUserId);
      });

    if (matchingConversations.length > 0) {
      existingPartnerUserIds.add(candidateUserId);
    }
  }

  return Array.from(existingPartnerUserIds);
}

export async function getConversationParticipantIdentities(
  conversationIds: string[],
) {
  const uniqueConversationIds = Array.from(
    new Set(conversationIds.map((value) => value.trim()).filter(Boolean)),
  );

  if (uniqueConversationIds.length === 0) {
    return [] as ConversationParticipantIdentity[];
  }

  const memberships = await getActiveConversationMembershipRows(uniqueConversationIds);
  const identities = await getProfileIdentities(
    memberships.map((membership) => membership.user_id),
    {
      includeStatuses: false,
    },
  );
  const identityByUserId = new Map<string, MessageSenderProfile>(
    identities.map((identity) => [identity.userId, identity] as const),
  );

  return memberships.map((membership) => {
    const identity = identityByUserId.get(membership.user_id);

    return {
      conversationId: membership.conversation_id,
      userId: membership.user_id,
      displayName: identity?.displayName ?? null,
      username: identity?.username ?? null,
      emailLocalPart: identity?.emailLocalPart ?? null,
      avatarPath: identity?.avatarPath ?? null,
      statusEmoji: identity?.statusEmoji ?? null,
      statusText: identity?.statusText ?? null,
      statusUpdatedAt: identity?.statusUpdatedAt ?? null,
    };
  }) satisfies ConversationParticipantIdentity[];
}

export async function findExistingActiveDmConversation(
  creatorUserId: string,
  otherUserId: string,
  options?: {
    spaceId?: string | null;
  },
) {
  const supabase = await createSupabaseServerClient();
  const dmConversationKeys = buildDmConversationLookupKeys({
    leftUserId: creatorUserId,
    rightUserId: otherUserId,
    spaceId: options?.spaceId ?? null,
  });
  let keyedLookupQuery = supabase
    .from('conversation_members')
    .select(
      options?.spaceId
        ? 'conversation_id, conversations!inner(id, kind, dm_key, space_id, created_at, last_message_at)'
        : 'conversation_id, conversations!inner(id, kind, dm_key, created_at, last_message_at)',
    )
    .eq('user_id', creatorUserId)
    .eq('state', 'active')
    .eq('conversations.kind', 'dm')
    .in('conversations.dm_key', dmConversationKeys);

  if (options?.spaceId) {
    keyedLookupQuery = keyedLookupQuery.eq('conversations.space_id', options.spaceId);
  }

  const { data: keyedMemberships, error: keyedLookupError } = await keyedLookupQuery;

  if (keyedLookupError) {
    if (
      !isMissingColumnErrorMessage(keyedLookupError.message, 'dm_key') &&
      !isMissingColumnErrorMessage(keyedLookupError.message, 'space_id')
    ) {
      throw new Error(keyedLookupError.message);
    }
  } else {
    const keyedMatch = await selectCanonicalExactPairDmConversationId({
      supabase,
      candidateRows: ((keyedMemberships ?? []) as Array<{
      conversation_id: string;
      conversations:
        | {
            id: string;
            kind: string | null;
            dm_key?: string | null;
            space_id?: string | null;
            created_at?: string | null;
            last_message_at?: string | null;
          }
        | Array<{
            id: string;
            kind: string | null;
            dm_key?: string | null;
            space_id?: string | null;
            created_at?: string | null;
            last_message_at?: string | null;
          }>
        | null;
      }>),
      expectedUserIds: [creatorUserId, otherUserId],
    });

    if (keyedMatch) {
      return keyedMatch;
    }

    const directKeyMatch = await findExistingDmConversationByKey({
      supabase,
      creatorUserId,
      otherUserId,
      spaceId: options?.spaceId ?? null,
    });

    if (directKeyMatch) {
      return directKeyMatch;
    }
  }

  const { data: creatorMemberships, error: creatorError } = await supabase
    .from('conversation_members')
    .select('conversation_id')
    .eq('user_id', creatorUserId)
    .eq('state', 'active');

  if (creatorError) {
    throw new Error(creatorError.message);
  }

  const conversationIds = (creatorMemberships ?? []).map(
    (row) => row.conversation_id as string,
  );

  if (conversationIds.length === 0) {
    return null;
  }

  let otherMembershipQuery = supabase
    .from('conversation_members')
    .select(
      options?.spaceId
        ? 'conversation_id, conversations!inner(id, kind, space_id, created_at, last_message_at)'
        : 'conversation_id, conversations!inner(id, kind, created_at, last_message_at)',
    )
    .eq('user_id', otherUserId)
    .eq('state', 'active')
    .in('conversation_id', conversationIds)
    .eq('conversations.kind', 'dm');

  if (options?.spaceId) {
    otherMembershipQuery = otherMembershipQuery.eq(
      'conversations.space_id',
      options.spaceId,
    );
  }

  const { data: otherMemberships, error: otherError } = await otherMembershipQuery;

  if (otherError) {
    if (options?.spaceId && isMissingColumnErrorMessage(otherError.message, 'space_id')) {
      logConversationSchemaDiagnostics('findExistingActiveDmConversation:throw-space-id-required', {
        actualFailingColumn: isMissingColumnErrorMessage(
          otherError.message,
          'avatar_path',
        )
          ? 'avatar_path'
          : isMissingColumnErrorMessage(otherError.message, 'space_id')
            ? 'space_id'
            : 'unknown',
        helper: 'findExistingActiveDmConversation',
        message: otherError.message,
        requestedSpaceId: options.spaceId,
        schemaCheckAvatarPathMissing: isMissingColumnErrorMessage(
          otherError.message,
          'avatar_path',
        ),
        schemaCheckSpaceIdMissing: isMissingColumnErrorMessage(
          otherError.message,
          'space_id',
        ),
      });
      throw createSchemaRequirementError(
        'Space-scoped DM lookup requires public.conversations.space_id.',
      );
    }

    throw new Error(otherError.message);
  }

  const exactMembershipMatch = await selectCanonicalExactPairDmConversationId({
    supabase,
    candidateRows: (otherMemberships ?? []) as Array<{
      conversation_id: string;
      conversations:
        | {
            id: string;
            kind: string | null;
            space_id?: string | null;
            created_at?: string | null;
            last_message_at?: string | null;
          }
        | Array<{
            id: string;
            kind: string | null;
            space_id?: string | null;
            created_at?: string | null;
            last_message_at?: string | null;
          }>
        | null;
    }>,
    expectedUserIds: [creatorUserId, otherUserId],
  });

  if (exactMembershipMatch) {
    return exactMembershipMatch;
  }

  return findExistingDmConversationByKey({
    supabase,
    creatorUserId,
    otherUserId,
    spaceId: options?.spaceId ?? null,
  });
}

// Conversation shell creation seam. Future operational-thread creation should
// wrap this helper rather than widening it with companion metadata writes
// directly in place.
export async function createConversationWithMembers(input: {
  kind: 'dm' | 'group';
  creatorUserId: string;
  participantUserIds: string[];
  title?: string | null;
  spaceId?: string | null;
}) {
  const supabase = await getRequestSupabaseServerClient();
  const conversationId = crypto.randomUUID();
  const normalizedSpaceId = input.spaceId?.trim() || null;

  if (!input.creatorUserId) {
    throw new Error('Authenticated user is required to create a conversation.');
  }

  if (!normalizedSpaceId) {
    throw new Error('Active space is required to create a conversation.');
  }

  const user = await requireRequestViewer('Conversation creation debug');

  if (!user) {
    throw new Error(
      'Conversation creation debug: no authenticated user found in the server action client.',
    );
  }

  if (!user.id) {
    throw new Error(
      'Conversation creation debug: authenticated user is present but user.id is missing.',
    );
  }

  const participantUserIds = dedupeParticipantIds(input.participantUserIds).filter(
    (userId) => userId !== input.creatorUserId,
  );

  if (participantUserIds.length === 0) {
    throw new Error('At least one participant is required.');
  }

  if (input.kind === 'dm' && participantUserIds.length !== 1) {
    throw new Error('Direct-message creation requires exactly one other participant.');
  }

  if (input.kind === 'dm') {
    const existingConversationId = await findExistingActiveDmConversation(
      input.creatorUserId,
      participantUserIds[0] ?? '',
      {
        spaceId: normalizedSpaceId,
      },
    );

    if (existingConversationId) {
      return existingConversationId;
    }
  }

  const canonicalDmConversationKey =
    input.kind === 'dm'
      ? buildCanonicalDmConversationKey(
          input.creatorUserId,
          participantUserIds[0] ?? '',
        )
      : null;
  const spaceScopedDmConversationKey =
    input.kind === 'dm'
      ? buildSpaceScopedDmConversationKey({
          leftUserId: input.creatorUserId,
          rightUserId: participantUserIds[0] ?? '',
          spaceId: normalizedSpaceId,
        })
      : null;

  const conversationPayloadBase =
    input.kind === 'group'
      ? {
          id: conversationId,
          created_by: input.creatorUserId,
          kind: 'group',
          title: input.title?.trim() || null,
        }
      : {
          id: conversationId,
          created_by: input.creatorUserId,
          kind: 'dm',
          title: null,
        };

  const conversationPayload =
    input.kind === 'dm'
      ? {
          ...conversationPayloadBase,
          space_id: normalizedSpaceId,
          dm_key: canonicalDmConversationKey,
        }
      : {
          ...conversationPayloadBase,
          space_id: normalizedSpaceId,
        };

  const conversationPayloadWithScopedDmKey =
    input.kind === 'dm' && spaceScopedDmConversationKey
      ? {
          ...conversationPayloadBase,
          space_id: normalizedSpaceId,
          dm_key: spaceScopedDmConversationKey,
        }
      : null;

  const conversationPayloadWithoutDmKey = {
    ...conversationPayloadBase,
    space_id: normalizedSpaceId,
  };

  if (conversationPayload.created_by !== input.creatorUserId) {
    throw new Error(
      'Conversation created_by must match the authenticated user.',
    );
  }

  if (conversationPayload.created_by !== user.id) {
    throw new Error(
      `Conversation creation debug: created_by mismatch. auth user id=${user.id}, payload created_by=${conversationPayload.created_by}.`,
    );
  }

  let conversationError: { message: string } | null = null;
  const { error: initialConversationError } = await supabase
    .from('conversations')
    .insert(conversationPayload);
  conversationError = initialConversationError;

  if (
    conversationError &&
    input.kind === 'dm' &&
    isMissingColumnErrorMessage(conversationError.message, 'dm_key')
  ) {
    const { error: fallbackConversationError } = await supabase
      .from('conversations')
      .insert(conversationPayloadWithoutDmKey);
    conversationError = fallbackConversationError;
  }

  if (conversationError) {
    if (
      input.kind === 'dm' &&
      isUniqueConstraintErrorMessage(conversationError.message, 'dm_key')
    ) {
      const existingConversationId = await findExistingActiveDmConversation(
        input.creatorUserId,
        participantUserIds[0] ?? '',
        {
          spaceId: normalizedSpaceId,
        },
      );

      if (existingConversationId) {
        return existingConversationId;
      }

      if (
        conversationPayloadWithScopedDmKey &&
        conversationPayloadWithScopedDmKey.dm_key !== canonicalDmConversationKey
      ) {
        // Older environments may still enforce global dm_key uniqueness. Retry
        // with a space-aware compatibility key so the same pair can open one DM
        // per space without weakening same-space reuse.
        const { error: scopedConversationError } = await supabase
          .from('conversations')
          .insert(conversationPayloadWithScopedDmKey);

        if (!scopedConversationError) {
          conversationError = null;
        } else if (
          isUniqueConstraintErrorMessage(scopedConversationError.message, 'dm_key')
        ) {
          const scopedExistingConversationId = await findExistingActiveDmConversation(
            input.creatorUserId,
            participantUserIds[0] ?? '',
            {
              spaceId: normalizedSpaceId,
            },
          );

          if (scopedExistingConversationId) {
            return scopedExistingConversationId;
          }

          conversationError = scopedConversationError;
        } else {
          conversationError = scopedConversationError;
        }
      }
    }

    if (conversationError?.message.includes('row-level security policy')) {
      throw new Error(
        `Conversation creation debug: insert blocked by conversations RLS. auth user id=${user.id}, payload created_by=${conversationPayload.created_by}. Values match, so the failure is likely in database policy state or auth context rather than payload construction.`,
      );
    }

    if (conversationError) {
      throw new Error(conversationError.message);
    }
  }

  const membershipRows =
    input.kind === 'dm'
      ? [
          {
            conversation_id: conversationId,
            user_id: input.creatorUserId,
            role: 'member',
            state: 'active',
          },
          ...participantUserIds.map((userId) => ({
            conversation_id: conversationId,
            user_id: userId,
            role: 'member',
            state: 'active',
          })),
        ]
      : [
          {
            conversation_id: conversationId,
            user_id: input.creatorUserId,
            role: 'owner',
            state: 'active',
          },
          ...participantUserIds.map((userId) => ({
            conversation_id: conversationId,
            user_id: userId,
            role: 'member',
            state: 'active',
          })),
        ];

  const { error: membershipError } = await supabase
    .from('conversation_members')
    .insert(membershipRows);

  if (membershipError) {
    await supabase.from('conversations').delete().eq('id', conversationId);
    throw new Error(membershipError.message);
  }

  return conversationId;
}

export async function updateCurrentUserProfile(input: {
  userId: string;
  displayName: string | null;
  avatarObjectPath?: string | null;
  avatarFile?: File | null;
  removeAvatar?: boolean;
}) {
  const supabase = await getRequestSupabaseServerClient();

  if (!input.userId) {
    throw new Error('Authenticated user is required to update a profile.');
  }

  const user = await requireRequestViewer('Profile settings debug');

  if (!user?.id) {
    throw new Error('Profile settings debug: no authenticated user found.');
  }

  if (user.id !== input.userId) {
    throw new Error(
      `Profile settings debug: user mismatch. auth user id=${user.id}, payload user id=${input.userId}.`,
    );
  }

  const nextDisplayName = input.displayName?.trim() || null;
  const existingProfileResponse = await supabase
    .from('profiles')
    .select('avatar_path')
    .eq('user_id', input.userId)
    .maybeSingle();

  if (existingProfileResponse.error) {
    logProfileSettingsDiagnostics('profile-lookup-error', {
      userId: input.userId,
      ...getSupabaseErrorDiagnostics(existingProfileResponse.error),
      message: existingProfileResponse.error.message,
    });
    throw new Error(existingProfileResponse.error.message);
  }

  const existingAvatarPath =
    (
      existingProfileResponse.data as
        | {
            avatar_path?: string | null;
          }
        | null
    )?.avatar_path?.trim() || null;

  if (nextDisplayName && nextDisplayName.length > 40) {
    throw new Error('Display name can be up to 40 characters.');
  }

  let nextAvatarPath: string | null | undefined;
  let uploadedAvatarObjectPath: string | null = null;
  const requestedAvatarObjectPath = input.avatarObjectPath?.trim() || null;
  const shouldRemoveAvatar =
    Boolean(input.removeAvatar) &&
    !requestedAvatarObjectPath &&
    !(input.avatarFile && input.avatarFile.size > 0);

  if (requestedAvatarObjectPath) {
    if (!isManagedAvatarObjectPath(input.userId, requestedAvatarObjectPath)) {
      throw new Error('Avatar upload path is invalid for this user.');
    }

    uploadedAvatarObjectPath = requestedAvatarObjectPath;
    nextAvatarPath = requestedAvatarObjectPath;
  } else if (input.avatarFile && input.avatarFile.size > 0) {
    if (input.avatarFile.size > PROFILE_AVATAR_MAX_SIZE_BYTES) {
      throw new Error('Avatar images can be up to 5 MB.');
    }

    if (!isSupportedProfileAvatarType(input.avatarFile.type)) {
      throw new Error('Avatar must be a JPG, PNG, WEBP, or GIF image.');
    }

    const fileName = sanitizeProfileFileName(input.avatarFile.name);
    const objectPath = `${input.userId}/${crypto.randomUUID()}-${fileName}`;
    const { error: uploadError } = await supabase.storage
      .from(PROFILE_AVATAR_BUCKET)
      .upload(objectPath, input.avatarFile, {
        upsert: false,
        contentType: input.avatarFile.type,
      });

    if (uploadError) {
      if (isBucketNotFoundStorageErrorMessage(uploadError.message)) {
        throw new Error(getAvatarBucketRequirementErrorMessage());
      }

      throw new Error(uploadError.message);
    }

    uploadedAvatarObjectPath = objectPath;
    nextAvatarPath = objectPath;
  } else if (shouldRemoveAvatar) {
    nextAvatarPath = null;
  }

  const profilePayload = {
    user_id: input.userId,
    display_name: nextDisplayName,
    ...(nextAvatarPath !== undefined ? { avatar_path: nextAvatarPath } : {}),
  };

  const profileExists = Boolean(existingProfileResponse.data);
  const profileWrite = profileExists
    ? await supabase
        .from('profiles')
        .update({
          display_name: nextDisplayName,
          ...(nextAvatarPath !== undefined ? { avatar_path: nextAvatarPath } : {}),
        })
        .eq('user_id', input.userId)
    : await supabase.from('profiles').insert(profilePayload);

  if (profileWrite.error) {
    if (uploadedAvatarObjectPath) {
      await supabase.storage.from(PROFILE_AVATAR_BUCKET).remove([uploadedAvatarObjectPath]);
    }

    logProfileSettingsDiagnostics('profile-write-error', {
      operation: profileExists ? 'update-existing-profile' : 'insert-missing-profile',
      userId: input.userId,
      hasDisplayName: nextDisplayName !== null,
      hasAvatarPath: nextAvatarPath !== undefined,
      ...getSupabaseErrorDiagnostics(profileWrite.error),
      message: profileWrite.error.message,
    });

    if (profileWrite.error.message.includes('row-level security policy')) {
      throw new Error('Profile settings update was blocked by profiles RLS.');
    }

    throw new Error(profileWrite.error.message);
  }

  if (
    existingAvatarPath &&
    isManagedAvatarObjectPath(input.userId, existingAvatarPath) &&
    existingAvatarPath !== uploadedAvatarObjectPath &&
    (uploadedAvatarObjectPath || shouldRemoveAvatar)
  ) {
    await supabase.storage.from(PROFILE_AVATAR_BUCKET).remove([existingAvatarPath]);
  }
}

export async function updateCurrentUserStatus(input: {
  userId: string;
  statusEmoji: string | null;
  statusText: string | null;
}) {
  const supabase = await getRequestSupabaseServerClient();

  if (!input.userId) {
    throw new Error('Authenticated user is required to update status.');
  }

  const user = await requireRequestViewer('Profile status debug');

  if (!user?.id) {
    throw new Error('Profile status debug: no authenticated user found.');
  }

  if (user.id !== input.userId) {
    throw new Error(
      `Profile status debug: user mismatch. auth user id=${user.id}, payload user id=${input.userId}.`,
    );
  }

  const nextStatusEmoji = input.statusEmoji?.trim() || null;
  const nextStatusText = input.statusText?.trim() || null;
  const nextStatusUpdatedAt =
    nextStatusEmoji || nextStatusText ? new Date().toISOString() : null;

  if (nextStatusEmoji && nextStatusEmoji.length > 16) {
    throw new Error('Status emoji can be up to 16 characters.');
  }

  if (nextStatusText && nextStatusText.length > 80) {
    throw new Error('Status text can be up to 80 characters.');
  }

  const existingProfileResponse = await supabase
    .from('profiles')
    .select('user_id')
    .eq('user_id', input.userId)
    .maybeSingle();

  if (existingProfileResponse.error) {
    logProfileSettingsDiagnostics('status-profile-lookup-error', {
      userId: input.userId,
      ...getSupabaseErrorDiagnostics(existingProfileResponse.error),
      message: existingProfileResponse.error.message,
    });
    throw new Error(existingProfileResponse.error.message);
  }

  const profileExists = Boolean(existingProfileResponse.data);
  const statusPayload = {
    status_emoji: nextStatusEmoji,
    status_text: nextStatusText,
    status_updated_at: nextStatusUpdatedAt,
  };
  const profileWrite = profileExists
    ? await supabase
        .from('profiles')
        .update(statusPayload)
        .eq('user_id', input.userId)
    : await supabase.from('profiles').insert({
        user_id: input.userId,
        ...statusPayload,
      });

  if (profileWrite.error) {
    logProfileSettingsDiagnostics('status-profile-write-error', {
      operation: profileExists ? 'update-existing-profile' : 'insert-missing-profile',
      userId: input.userId,
      ...getSupabaseErrorDiagnostics(profileWrite.error),
      message: profileWrite.error.message,
    });

    if (
      isMissingColumnErrorMessage(profileWrite.error.message, 'status_emoji') ||
      isMissingColumnErrorMessage(profileWrite.error.message, 'status_text') ||
      isMissingColumnErrorMessage(profileWrite.error.message, 'status_updated_at')
    ) {
      logProfileSettingsDiagnostics('status-profile-write:fallback-auth-metadata', {
        userId: input.userId,
      });

      await updateCurrentUserStatusMetadata({
        supabase,
        statusEmoji: nextStatusEmoji,
        statusText: nextStatusText,
        statusUpdatedAt: nextStatusUpdatedAt,
      });
      return;
    }

    if (profileWrite.error.message.includes('row-level security policy')) {
      throw new Error('Profile status update was blocked by profiles RLS.');
    }

    throw new Error(profileWrite.error.message);
  }

  try {
    await updateCurrentUserStatusMetadata({
      supabase,
      statusEmoji: nextStatusEmoji,
      statusText: nextStatusText,
      statusUpdatedAt: nextStatusUpdatedAt,
    });
  } catch (error) {
    logProfileSettingsDiagnostics('status-auth-metadata-sync-error', {
      userId: input.userId,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function removeCurrentUserAvatar(userId: string) {
  const supabase = await getRequestSupabaseServerClient();

  if (!userId) {
    throw new Error('Authenticated user is required to update a profile.');
  }

  const user = await requireRequestViewer('Profile settings debug');

  if (!user?.id) {
    throw new Error('Profile settings debug: no authenticated user found.');
  }

  if (user.id !== userId) {
    throw new Error(
      `Profile settings debug: user mismatch. auth user id=${user.id}, payload user id=${userId}.`,
    );
  }

  const existingProfileResponse = await supabase
    .from('profiles')
    .select('avatar_path')
    .eq('user_id', userId)
    .maybeSingle();

  if (existingProfileResponse.error) {
    logProfileSettingsDiagnostics('avatar-remove-profile-lookup-error', {
      userId,
      ...getSupabaseErrorDiagnostics(existingProfileResponse.error),
      message: existingProfileResponse.error.message,
    });
    throw new Error(existingProfileResponse.error.message);
  }

  const existingAvatarPath =
    (
      existingProfileResponse.data as
        | {
            avatar_path?: string | null;
          }
        | null
    )?.avatar_path?.trim() || null;

  const profileExists = Boolean(existingProfileResponse.data);
  const profileWrite = profileExists
    ? await supabase
        .from('profiles')
        .update({ avatar_path: null })
        .eq('user_id', userId)
    : await supabase.from('profiles').insert({
        user_id: userId,
        avatar_path: null,
      });

  if (profileWrite.error) {
    logProfileSettingsDiagnostics('avatar-remove-profile-write-error', {
      operation: profileExists ? 'update-existing-profile' : 'insert-missing-profile',
      userId,
      ...getSupabaseErrorDiagnostics(profileWrite.error),
      message: profileWrite.error.message,
    });

    if (profileWrite.error.message.includes('row-level security policy')) {
      throw new Error('Profile settings update was blocked by profiles RLS.');
    }

    throw new Error(profileWrite.error.message);
  }

  if (isManagedAvatarObjectPath(userId, existingAvatarPath)) {
    await supabase.storage
      .from(PROFILE_AVATAR_BUCKET)
      .remove([existingAvatarPath ?? '']);
  }
}

export async function updateCurrentUserLanguagePreference(input: {
  userId: string;
  preferredLanguage: AppLanguage;
}) {
  const supabase = await getRequestSupabaseServerClient();

  if (!input.userId) {
    throw new Error('Authenticated user is required to update language.');
  }

  const user = await requireRequestViewer('Language update debug');

  if (!user?.id) {
    throw new Error('Language update debug: no authenticated user found.');
  }

  if (user.id !== input.userId) {
    throw new Error(
      `Language update debug: user mismatch. auth user id=${user.id}, payload user id=${input.userId}.`,
    );
  }

  const existingProfileResponse = await supabase
    .from('profiles')
    .select('user_id')
    .eq('user_id', input.userId)
    .maybeSingle();

  if (existingProfileResponse.error) {
    logProfileSettingsDiagnostics('language-profile-lookup-error', {
      userId: input.userId,
      ...getSupabaseErrorDiagnostics(existingProfileResponse.error),
      message: existingProfileResponse.error.message,
    });
    throw new Error(existingProfileResponse.error.message);
  }

  const profileExists = Boolean(existingProfileResponse.data);
  const profileWrite = profileExists
    ? await supabase
        .from('profiles')
        .update({
          preferred_language: input.preferredLanguage,
        })
        .eq('user_id', input.userId)
    : await supabase.from('profiles').insert({
        user_id: input.userId,
        preferred_language: input.preferredLanguage,
      });

  if (profileWrite.error) {
    logProfileSettingsDiagnostics('language-profile-write-error', {
      operation: profileExists ? 'update-existing-profile' : 'insert-missing-profile',
      userId: input.userId,
      ...getSupabaseErrorDiagnostics(profileWrite.error),
      message: profileWrite.error.message,
    });

    if (isMissingColumnErrorMessage(profileWrite.error.message, 'preferred_language')) {
      throw createSchemaRequirementError(
        'Profile language preference requires profiles.preferred_language.',
      );
    }

    if (profileWrite.error.message.includes('row-level security policy')) {
      throw new Error('Language preference update was blocked by profiles RLS.');
    }

    throw new Error(profileWrite.error.message);
  }
}

export async function getConversationMessages(
  conversationId: string,
  options?: {
    afterSeqExclusive?: number | null;
    beforeSeqExclusive?: number | null;
    debugRequestId?: string | null;
    limitLatest?: number | null;
    messageIds?: string[] | null;
    visibleFromSeqInclusive?: number | null;
  },
) {
  const supabase = await createSupabaseServerClient();
  const normalizedLimit =
    typeof options?.limitLatest === 'number' &&
    Number.isFinite(options.limitLatest) &&
    options.limitLatest > 0
      ? Math.floor(options.limitLatest)
      : null;
  const afterSeqExclusive =
    typeof options?.afterSeqExclusive === 'number' &&
    Number.isFinite(options.afterSeqExclusive)
      ? Math.floor(options.afterSeqExclusive)
      : null;
  const beforeSeqExclusive =
    typeof options?.beforeSeqExclusive === 'number' &&
    Number.isFinite(options.beforeSeqExclusive)
      ? Math.floor(options.beforeSeqExclusive)
      : null;
  const normalizedMessageIds = Array.from(
    new Set((options?.messageIds ?? []).map((messageId) => messageId.trim()).filter(Boolean)),
  );
  const queryMode =
    normalizedMessageIds.length > 0
      ? 'by-id'
      : afterSeqExclusive !== null
        ? 'after-seq'
        : 'latest';
  const queryLimit =
    queryMode === 'latest'
      ? normalizedLimit !== null
        ? normalizedLimit + 1
        : null
      : queryMode === 'after-seq'
        ? normalizedLimit
        : null;
  const visibleFromSeqInclusive =
    typeof options?.visibleFromSeqInclusive === 'number' &&
    Number.isFinite(options.visibleFromSeqInclusive) &&
    options.visibleFromSeqInclusive > 0
      ? Math.floor(options.visibleFromSeqInclusive)
      : null;
  const buildMessagesQuery = (selectClause: string) => {
    let query = supabase
      .from('messages')
      .select(selectClause)
      .eq('conversation_id', conversationId);

    if (visibleFromSeqInclusive !== null) {
      query = query.gte('seq', visibleFromSeqInclusive);
    }

    if (normalizedMessageIds.length > 0) {
      query = query
        .in('id', normalizedMessageIds)
        .order('seq', { ascending: true });
    } else if (afterSeqExclusive !== null) {
      query = query
        .gt('seq', afterSeqExclusive)
        .order('seq', { ascending: true });
    } else {
      query = query.order('seq', { ascending: false });
    }

    if (queryMode === 'latest' && beforeSeqExclusive !== null) {
      query = query.lt('seq', beforeSeqExclusive);
    }

    return queryLimit !== null ? query.limit(queryLimit) : query;
  };
  const response = await buildMessagesQuery(
    'id, conversation_id, sender_id, sender_device_id, reply_to_message_id, seq, kind, client_id, body, content_mode, edited_at, deleted_at, created_at',
  );

  const normalizeMessages = (data: ConversationMessage[]) => {
    const hasMoreOlder =
      queryMode === 'latest' &&
      normalizedLimit !== null &&
      data.length > normalizedLimit;
    const pagedRows =
      queryMode === 'latest' && normalizedLimit !== null && hasMoreOlder
        ? data.slice(0, normalizedLimit)
        : data;
    const normalizedMessages =
      queryMode === 'latest' ? [...pagedRows].reverse() : [...pagedRows];

    if (process.env.CHAT_DEBUG_DM_E2EE_BOOTSTRAP === '1') {
      console.info('[chat-history-load]', 'messages:loaded', {
        afterSeqExclusive,
        conversationId,
        count: normalizedMessages.length,
        debugRequestId: options?.debugRequestId ?? null,
        deploymentId: process.env.VERCEL_DEPLOYMENT_ID ?? null,
        firstMessageId: normalizedMessages[0]?.id ?? null,
        gitCommitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
        hasMoreOlder,
        beforeSeqExclusive,
        lastMessageId:
          normalizedMessages[normalizedMessages.length - 1]?.id ?? null,
        limitLatest: normalizedLimit,
        messageIds:
          normalizedMessageIds.length > 0 ? normalizedMessageIds : null,
        mode: queryMode,
        queryLimit,
        visibleFromSeqInclusive,
        vercelUrl: process.env.VERCEL_URL ?? null,
      });
    }

    return {
      hasMoreOlder,
      messages: normalizedMessages,
    };
  };

  if (response.error) {
    if (isMissingColumnErrorMessage(response.error.message, 'content_mode')) {
      const fallback =
        await buildMessagesQuery(
          'id, conversation_id, sender_id, reply_to_message_id, seq, kind, client_id, body, edited_at, deleted_at, created_at',
        );

      if (fallback.error) {
        throw new Error(fallback.error.message);
      }

      return normalizeMessages(
        ((fallback.data ?? []) as unknown) as ConversationMessage[],
      );
    }

    throw new Error(response.error.message);
  }

  return normalizeMessages(
    ((response.data ?? []) as unknown) as ConversationMessage[],
  );
}

function parseConversationHistoryDate(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function getConversationHistoryWindowSizeForMessageTargets(input: {
  conversationId: string;
  messageIds: string[];
  userId: string;
}) {
  const normalizedMessageIds = Array.from(
    new Set(input.messageIds.map((value) => value.trim()).filter(Boolean)),
  );

  if (normalizedMessageIds.length === 0) {
    return null;
  }

  const [supabase, historyBoundary] = await Promise.all([
    createSupabaseServerClient(),
    getConversationMemberHistoryBoundary(input.conversationId, input.userId),
  ]);
  const visibleFromSeq = historyBoundary?.visibleFromSeq ?? null;
  const targetMessages = await supabase
    .from('messages')
    .select('id, seq')
    .eq('conversation_id', input.conversationId)
    .gte('seq', visibleFromSeq ?? 0)
    .in('id', normalizedMessageIds);

  if (targetMessages.error) {
    throw new Error(targetMessages.error.message);
  }

  const minimumTargetSeq = (targetMessages.data ?? []).reduce<number | null>(
    (currentMinimum, row) => {
      const normalizedSeq =
        typeof row.seq === 'number'
          ? row.seq
          : typeof row.seq === 'string'
            ? Number(row.seq)
            : null;

      if (normalizedSeq === null || !Number.isFinite(normalizedSeq)) {
        return currentMinimum;
      }

      if (currentMinimum === null) {
        return normalizedSeq;
      }

      return Math.min(currentMinimum, normalizedSeq);
    },
    null,
  );

  if (minimumTargetSeq === null) {
    return null;
  }

  const countLookup = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('conversation_id', input.conversationId)
    .gte('seq', visibleFromSeq ?? 0)
    .gte('seq', minimumTargetSeq);

  if (countLookup.error) {
    throw new Error(countLookup.error.message);
  }

  return countLookup.count ?? null;
}

// Message-history seam. Keep thread-level companion metadata out of this loader
// during early backend integration phases; add it at conversation-level read
// boundaries first.
export async function getConversationHistorySnapshot(input: {
  afterSeqExclusive?: number | null;
  beforeSeqExclusive?: number | null;
  conversationId: string;
  debugRequestId?: string | null;
  limit: number;
  messageIds?: string[] | null;
  preferredDeviceRecordId?: string | null;
  userId: string;
}): Promise<ConversationHistoryPageSnapshot> {
  const normalizedLimit =
    Number.isFinite(input.limit) && input.limit > 0
      ? Math.floor(input.limit)
      : 26;
  const historyBoundary = await getConversationMemberHistoryBoundary(
    input.conversationId,
    input.userId,
  );
  const currentUserConversationJoinedAt = historyBoundary?.joinedAt ?? null;
  const visibleFromSeq = historyBoundary?.visibleFromSeq ?? null;
  const { messages, hasMoreOlder } = await getConversationMessages(
    input.conversationId,
    {
      afterSeqExclusive: input.afterSeqExclusive ?? null,
      beforeSeqExclusive: input.beforeSeqExclusive ?? null,
      debugRequestId: input.debugRequestId ?? null,
      limitLatest: normalizedLimit,
      messageIds: input.messageIds ?? null,
      visibleFromSeqInclusive: visibleFromSeq,
    },
  );
  const messageIds = messages.map((message) => message.id);
  const attachmentMessageIds = messages
    .filter(
      (message) => message.kind === 'attachment' || message.kind === 'voice',
    )
    .map((message) => message.id);
  const encryptedMessageIds = messages
    .filter(
      (message) =>
        (message.kind === 'text' || message.kind === 'attachment') &&
        message.content_mode === 'dm_e2ee_v1',
    )
    .map((message) => message.id);
  const senderProfileIds = Array.from(
    new Set(messages.map((message) => message.sender_id ?? '').filter(Boolean)),
  );
  logChatThreadSnapshotCheckpoint('history-loaded', {
    afterSeqExclusive: input.afterSeqExclusive ?? null,
    beforeSeqExclusive: input.beforeSeqExclusive ?? null,
    conversationId: input.conversationId,
    debugRequestId: input.debugRequestId ?? null,
    encryptedMessageCount: encryptedMessageIds.length,
    hasMoreOlder,
    messageCount: messages.length,
    messageIdsCount: messageIds.length,
    oldestMessageSeq:
      messages.length > 0
        ? Number(
            typeof messages[0]?.seq === 'number'
              ? messages[0]?.seq
              : Number(messages[0]?.seq ?? 0),
          )
        : null,
    senderProfileIdCount: senderProfileIds.length,
    visibleFromSeq,
  });
  logChatThreadSnapshotCheckpoint('shared-substeps-started', {
    conversationId: input.conversationId,
    debugRequestId: input.debugRequestId ?? null,
    encryptedMessageCount: encryptedMessageIds.length,
    messageCount: messages.length,
    senderProfileIdCount: senderProfileIds.length,
  });
  logChatThreadSnapshotCheckpoint('sender-profiles-started', {
    conversationId: input.conversationId,
    debugRequestId: input.debugRequestId ?? null,
    senderProfileIdCount: senderProfileIds.length,
  });
  logChatThreadSnapshotCheckpoint('reaction-mapping-started', {
    conversationId: input.conversationId,
    debugRequestId: input.debugRequestId ?? null,
    messageIdsCount: messageIds.length,
  });
  logChatThreadSnapshotCheckpoint('attachment-voice-mapping-started', {
    conversationId: input.conversationId,
    debugRequestId: input.debugRequestId ?? null,
    messageIdsCount: attachmentMessageIds.length,
  });
  logChatThreadSnapshotCheckpoint('encrypted-envelope-load-started', {
    conversationId: input.conversationId,
    debugRequestId: input.debugRequestId ?? null,
    encryptedMessageCount: encryptedMessageIds.length,
  });
  const [
    senderProfilesResult,
    reactionsByMessageResult,
    attachmentsByMessageResult,
    e2eeEnvelopeHistoryResult,
  ] = await Promise.allSettled([
    getMessageSenderProfiles(senderProfileIds, {
      includeAvatarPath: false,
      includeStatuses: false,
    }),
    getGroupedReactionsForMessages(messageIds, input.userId),
    getMessageAttachments(input.conversationId, attachmentMessageIds),
    getCurrentUserDmE2eeEnvelopesForMessages({
      debugRequestId: input.debugRequestId ?? null,
      messageIds: encryptedMessageIds,
      preferredDeviceRecordId: input.preferredDeviceRecordId ?? null,
      userId: input.userId,
    }),
  ]);
  const unwrapSnapshotSubstep = <T,>(
    stage: string,
    result: PromiseSettledResult<T>,
  ) => {
    if (result.status === 'fulfilled') {
      return result.value;
    }

    const error =
      result.reason instanceof Error
        ? result.reason
        : new Error(String(result.reason));

    logChatHistoryDiagnostics(
      'snapshot:substep-failed',
      {
        conversationId: input.conversationId,
        debugRequestId: input.debugRequestId ?? null,
        encryptedMessageCount: encryptedMessageIds.length,
        errorMessage: error.message,
        messageCount: messages.length,
        messageIdsCount: messageIds.length,
        stage,
        userId: input.userId,
        visibleFromSeq,
      },
      'error',
    );

    throw error;
  };
  const senderProfiles = unwrapSnapshotSubstep(
    'sender-profiles',
    senderProfilesResult,
  );
  logChatThreadSnapshotCheckpoint('sender-profiles-completed', {
    conversationId: input.conversationId,
    debugRequestId: input.debugRequestId ?? null,
    profileCount: senderProfiles.length,
  });
  const reactionsByMessage = unwrapSnapshotSubstep(
    'reactions',
    reactionsByMessageResult,
  );
  logChatThreadSnapshotCheckpoint('reaction-mapping-completed', {
    conversationId: input.conversationId,
    debugRequestId: input.debugRequestId ?? null,
    messagesWithReactionsCount: Array.from(reactionsByMessage.values()).filter(
      (reactions) => reactions.length > 0,
    ).length,
    reactionGroupCount: Array.from(reactionsByMessage.values()).reduce(
      (count, reactions) => count + reactions.length,
      0,
    ),
  });
  const attachmentsByMessage = unwrapSnapshotSubstep(
    'attachments',
    attachmentsByMessageResult,
  );
  logChatThreadSnapshotCheckpoint('attachment-voice-mapping-completed', {
    conversationId: input.conversationId,
    debugRequestId: input.debugRequestId ?? null,
    messagesWithAttachmentsCount: Array.from(attachmentsByMessage.values()).filter(
      (attachments) => attachments.length > 0,
    ).length,
    totalAttachmentCount: Array.from(attachmentsByMessage.values()).reduce(
      (count, attachments) => count + attachments.length,
      0,
    ),
    voiceAttachmentCount: Array.from(attachmentsByMessage.values()).reduce(
      (count, attachments) =>
        count + attachments.filter((attachment) => attachment.isVoiceMessage).length,
      0,
    ),
    voicePlayableCount: Array.from(attachmentsByMessage.values()).reduce(
      (count, attachments) =>
        count +
        attachments.filter(
          (attachment) => attachment.isVoiceMessage && Boolean(attachment.signedUrl),
        ).length,
      0,
    ),
    voiceUnavailableCount: Array.from(attachmentsByMessage.values()).reduce(
      (count, attachments) =>
        count +
        attachments.filter(
          (attachment) => attachment.isVoiceMessage && !attachment.signedUrl,
        ).length,
      0,
    ),
  });
  if (shouldLogChatHistoryDiagnostics()) {
    for (const message of messages) {
      if (message.kind !== 'voice') {
        continue;
      }

      const attachments = attachmentsByMessage.get(message.id) ?? [];
      const voiceAttachments = attachments.filter(
        (attachment) => attachment.isVoiceMessage || attachment.isAudio,
      );

      logChatHistoryDiagnostics('voice-row-resolution', {
        attachmentCount: attachments.length,
        conversationId: input.conversationId,
        debugRequestId: input.debugRequestId ?? null,
        hasPlaybackReadyVoiceAttachment: voiceAttachments.some((attachment) =>
          Boolean(attachment.signedUrl),
        ),
        messageId: message.id,
        mode:
          (input.messageIds?.length ?? 0) > 0
            ? 'by-id'
            : input.afterSeqExclusive !== null
              ? 'after-seq'
              : input.beforeSeqExclusive !== null
                ? 'before-seq'
                : 'latest',
        signedUrlReadyCount: voiceAttachments.filter((attachment) =>
          Boolean(attachment.signedUrl),
        ).length,
        storageLocatorCount: voiceAttachments.filter(
          (attachment) =>
            Boolean(attachment.bucket) && Boolean(attachment.objectPath),
        ).length,
        voiceAttachmentCount: voiceAttachments.length,
      });
    }
  }
  const e2eeEnvelopeHistory = unwrapSnapshotSubstep(
    'dm-e2ee-envelopes',
    e2eeEnvelopeHistoryResult,
  );
  logChatThreadSnapshotCheckpoint('encrypted-unavailable-mapping-started', {
    conversationId: input.conversationId,
    debugRequestId: input.debugRequestId ?? null,
    encryptedEnvelopeCount: e2eeEnvelopeHistory.envelopesByMessage.size,
    encryptedMessageCount: encryptedMessageIds.length,
  });
  const messagesById = new Map(messages.map((message) => [message.id, message]));
  const currentUserJoinedAtDate = parseConversationHistoryDate(
    currentUserConversationJoinedAt,
  );
  const encryptedHistoryHints = encryptedMessageIds.map((messageId) => {
    const message = messagesById.get(messageId) ?? null;
    const messageCreatedAtDate = parseConversationHistoryDate(
      message?.created_at ?? null,
    );
    const wasSentBeforeViewerJoined =
      Boolean(message) &&
      message?.sender_id !== input.userId &&
      messageCreatedAtDate !== null &&
      currentUserJoinedAtDate !== null &&
      messageCreatedAtDate.getTime() < currentUserJoinedAtDate.getTime();

    return {
      hint: {
        code: e2eeEnvelopeHistory.envelopesByMessage.has(messageId)
          ? 'envelope-present'
          : wasSentBeforeViewerJoined
            ? 'policy-blocked-history'
            : 'missing-envelope',
        committedHistoryState: 'present',
        currentDeviceAvailability: e2eeEnvelopeHistory.envelopesByMessage.has(messageId)
          ? 'envelope-present'
          : wasSentBeforeViewerJoined
            ? 'policy-blocked-history'
            : 'missing-envelope',
        recoveryDisposition: e2eeEnvelopeHistory.envelopesByMessage.has(messageId)
          ? 'already-readable'
          : wasSentBeforeViewerJoined
            ? 'policy-blocked'
            : 'not-supported-v1',
        activeDeviceRecordId: e2eeEnvelopeHistory.activeDeviceRecordId,
        messageCreatedAt: message?.created_at ?? null,
        viewerJoinedAt: currentUserConversationJoinedAt,
      } satisfies EncryptedDmServerHistoryHint,
      messageId,
    };
  });
  logChatThreadSnapshotCheckpoint('encrypted-unavailable-mapping-completed', {
    conversationId: input.conversationId,
    debugRequestId: input.debugRequestId ?? null,
    encryptedEnvelopeCount: e2eeEnvelopeHistory.envelopesByMessage.size,
    encryptedHintCount: encryptedHistoryHints.length,
    encryptedMessageCount: encryptedMessageIds.length,
    missingEnvelopeCount: encryptedHistoryHints.filter(
      (entry) => entry.hint.code === 'missing-envelope',
    ).length,
    policyBlockedCount: encryptedHistoryHints.filter(
      (entry) => entry.hint.code === 'policy-blocked-history',
    ).length,
  });

  if (process.env.CHAT_DEBUG_DM_E2EE_BOOTSTRAP === '1') {
    console.info('[chat-history-load]', 'dm-e2ee-history-snapshot', {
      conversationId: input.conversationId,
      debugRequestId: input.debugRequestId ?? null,
      encryptedEnvelopeCount: e2eeEnvelopeHistory.envelopesByMessage.size,
      encryptedMessageCount: encryptedMessageIds.length,
      encryptedMessageIds,
      selectionSource: e2eeEnvelopeHistory.selectionSource,
      visibleFromSeq,
      userId: input.userId,
    });
  }

  logChatThreadSnapshotCheckpoint('snapshot-props-prepared', {
    conversationId: input.conversationId,
    debugRequestId: input.debugRequestId ?? null,
    hasMoreOlder,
    messageCount: messages.length,
    senderProfileCount: senderProfiles.length,
  });

  return {
    attachmentsByMessage: messageIds.map((messageId) => ({
      attachments: attachmentsByMessage.get(messageId) ?? [],
      messageId,
    })),
    dmE2ee: {
      activeDeviceCreatedAt: e2eeEnvelopeHistory.activeDeviceCreatedAt,
      activeDeviceRecordId: e2eeEnvelopeHistory.activeDeviceRecordId,
      envelopesByMessage: encryptedMessageIds.flatMap((messageId) => {
        const envelope = e2eeEnvelopeHistory.envelopesByMessage.get(messageId);

        return envelope ? [{ envelope, messageId }] : [];
      }),
      historyHintsByMessage: encryptedHistoryHints,
      selectionSource: e2eeEnvelopeHistory.selectionSource,
    },
    hasMoreOlder,
    messages,
    oldestMessageSeq:
      messages.length > 0
        ? Number(
            typeof messages[0]?.seq === 'number'
              ? messages[0]?.seq
              : Number(messages[0]?.seq ?? 0),
          )
        : null,
    reactionsByMessage: messageIds.map((messageId) => ({
      messageId,
      reactions: reactionsByMessage.get(messageId) ?? [],
    })),
    senderProfiles,
  };
}

export async function getMessageSenderProfiles(
  userIds: string[],
  options?: {
    includeAvatarPath?: boolean;
    includeStatuses?: boolean;
  },
) {
  return getProfileIdentities(userIds, options);
}

function buildChatAttachmentDeliveryUrl(input: {
  attachmentId: string;
  bucket: string;
  conversationId?: string | null;
  isVoiceMessage: boolean;
  messageId: string;
  objectPath: string;
  preferredClient: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  serviceClient: Awaited<ReturnType<typeof createSupabaseServiceRoleClient>> | null;
  source: 'legacy-attachment' | 'message-asset';
}) {
  return buildConversationAttachmentContentUrl({
    attachmentId: input.attachmentId,
    conversationId: input.conversationId ?? '',
    messageId: input.messageId,
  });
}

function buildConversationAttachmentContentUrl(input: {
  attachmentId: string;
  conversationId: string;
  messageId: string;
}) {
  return `/api/messaging/conversations/${input.conversationId}/messages/${input.messageId}/attachments/${input.attachmentId}/content`;
}

export type ResolvedConversationAttachmentContentTarget = {
  attachmentId: string;
  bucket: string;
  fileName: string | null;
  messageId: string;
  mimeType: string | null;
  objectPath: string;
  source: 'legacy-attachment' | 'message-asset';
};

export async function resolveConversationAttachmentContentTarget(input: {
  attachmentId: string;
  conversationId: string;
  messageId: string;
  userId: string;
}): Promise<ResolvedConversationAttachmentContentTarget | null> {
  const supabase = await createSupabaseServerClient();
  const serviceSupabase = createSupabaseServiceRoleClient();
  const normalizedAttachmentId = input.attachmentId.trim();
  const normalizedConversationId = input.conversationId.trim();
  const normalizedMessageId = input.messageId.trim();

  if (
    !normalizedAttachmentId ||
    !normalizedConversationId ||
    !normalizedMessageId ||
    !input.userId.trim()
  ) {
    return null;
  }

  const messageLookup = await supabase
    .from('messages')
    .select('id')
    .eq('id', normalizedMessageId)
    .eq('conversation_id', normalizedConversationId)
    .maybeSingle();

  if (messageLookup.error) {
    throw new Error(messageLookup.error.message);
  }

  if (!messageLookup.data) {
    logChatHistoryDiagnostics('attachment-content:message-missing', {
      attachmentId: normalizedAttachmentId,
      conversationId: normalizedConversationId,
      messageId: normalizedMessageId,
      userId: input.userId,
    });
    return null;
  }

  const legacyAttachmentLookup = await supabase
    .from('message_attachments')
    .select('id, message_id, bucket, object_path, mime_type')
    .eq('id', normalizedAttachmentId)
    .eq('message_id', normalizedMessageId)
    .maybeSingle();

  if (legacyAttachmentLookup.error) {
    if (
      !isMissingRelationErrorMessage(
        legacyAttachmentLookup.error.message,
        'message_attachments',
      )
    ) {
      throw new Error(legacyAttachmentLookup.error.message);
    }
  } else if (legacyAttachmentLookup.data) {
    return {
      attachmentId: String(legacyAttachmentLookup.data.id),
      bucket: String(legacyAttachmentLookup.data.bucket),
      fileName: getAttachmentFileName(String(legacyAttachmentLookup.data.object_path)),
      messageId: normalizedMessageId,
      mimeType:
        typeof legacyAttachmentLookup.data.mime_type === 'string'
          ? legacyAttachmentLookup.data.mime_type
          : null,
      objectPath: String(legacyAttachmentLookup.data.object_path),
      source: 'legacy-attachment' as const,
    };
  }

  const loadAssetLinkRow = async (client: MessageAssetsWriteClient) =>
    client
      .from('message_asset_links')
      .select(
        'message_id, message_assets!inner(id, kind, source, storage_bucket, storage_object_path, external_url, mime_type, file_name)',
      )
      .eq('message_id', normalizedMessageId)
      .eq('asset_id', normalizedAttachmentId)
      .maybeSingle();

  let assetLookup = await loadAssetLinkRow(supabase);

  if (assetLookup.error) {
    const shouldRetryWithServiceRole =
      !isMissingRelationErrorMessage(assetLookup.error.message, 'message_asset_links') &&
      !isMissingRelationErrorMessage(assetLookup.error.message, 'message_assets');

    if (shouldRetryWithServiceRole && serviceSupabase) {
      assetLookup = await loadAssetLinkRow(
        serviceSupabase as MessageAssetsWriteClient,
      );
    }

    if (assetLookup.error) {
      throw new Error(assetLookup.error.message);
    }
  }

  const asset = normalizeJoinedRecord(assetLookup.data?.message_assets ?? null);

  if (!asset) {
    logChatHistoryDiagnostics('attachment-content:asset-missing', {
      attachmentId: normalizedAttachmentId,
      conversationId: normalizedConversationId,
      messageId: normalizedMessageId,
      userId: input.userId,
    });
    return null;
  }

  if (asset.source === 'external-url') {
    logChatHistoryDiagnostics(
      'attachment-content:external-url-blocked',
      {
        attachmentId: normalizedAttachmentId,
        conversationId: normalizedConversationId,
        messageId: normalizedMessageId,
        source: asset.source,
        userId: input.userId,
      },
      'warn',
    );
    return null;
  }

  if (!asset.storage_bucket || !asset.storage_object_path) {
    logChatHistoryDiagnostics('attachment-content:storage-locator-missing', {
      attachmentId: normalizedAttachmentId,
      conversationId: normalizedConversationId,
      messageId: normalizedMessageId,
      source: asset.source,
      userId: input.userId,
    });
    return null;
  }

  return {
    attachmentId: String(asset.id),
    bucket: String(asset.storage_bucket),
    fileName:
      typeof asset.file_name === 'string' && asset.file_name.trim()
        ? asset.file_name.trim()
        : getAttachmentFileName(String(asset.storage_object_path)),
    messageId: normalizedMessageId,
    mimeType:
      typeof asset.mime_type === 'string' ? asset.mime_type : null,
    objectPath: String(asset.storage_object_path),
    source: 'message-asset' as const,
  };
}

export async function getGroupedReactionsForMessages(
  messageIds: string[],
  currentUserId: string,
) {
  if (messageIds.length === 0) {
    return new Map<string, MessageReactionGroup[]>();
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('message_reactions')
    .select('id, message_id, emoji, user_id, created_at')
    .in('message_id', messageIds);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as MessageReactionRow[];
  const grouped = new Map<string, Map<string, MessageReactionGroup>>();

  for (const row of rows) {
    const perMessage = grouped.get(row.message_id) ?? new Map<string, MessageReactionGroup>();
    const current = perMessage.get(row.emoji) ?? {
      emoji: row.emoji,
      count: 0,
      selectedByCurrentUser: false,
    };

    current.count += 1;
    current.selectedByCurrentUser ||= row.user_id === currentUserId;

    perMessage.set(row.emoji, current);
    grouped.set(row.message_id, perMessage);
  }

  return new Map(
    Array.from(grouped.entries()).map(([messageId, reactions]) => {
      const groups = Array.from(reactions.values())
        .sort((left, right) => {
          if (left.selectedByCurrentUser !== right.selectedByCurrentUser) {
            return left.selectedByCurrentUser ? -1 : 1;
          }

          if (left.count !== right.count) {
            return right.count - left.count;
          }

          return left.emoji.localeCompare(right.emoji);
        })
        .slice(0, 5);

      return [messageId, groups];
    }),
  );
}

export async function getMessageAttachments(
  conversationId: string,
  messageIds: string[],
) {
  const uniqueMessageIds = Array.from(new Set(messageIds.filter(Boolean)));

  if (uniqueMessageIds.length === 0) {
    return new Map<string, MessageAttachment[]>();
  }

  const supabase = await createSupabaseServerClient();
  const serviceSupabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from('message_attachments')
    .select('id, message_id, bucket, object_path, mime_type, size_bytes, created_at')
    .in('message_id', uniqueMessageIds)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  let assetRows: MessageAssetAttachmentRow[] = [];
  const isMissingOptionalMessageAssetProjectionErrorMessage = (
    message: string,
  ) =>
    [
      'ordinal',
      'render_as_primary',
      'storage_bucket',
      'storage_object_path',
      'external_url',
      'file_name',
      'size_bytes',
      'duration_ms',
    ].some((columnName) => isMissingColumnErrorMessage(message, columnName));
  const canIgnoreMessageAssetProjectionError = (message: string) =>
    isMissingRelationErrorMessage(message, 'message_asset_links') ||
    isMissingRelationErrorMessage(message, 'message_assets') ||
    isMissingOptionalMessageAssetProjectionErrorMessage(message);
  const loadMessageAssetRows = async (client: MessageAssetsWriteClient) =>
    client
      .from('message_asset_links')
      .select(
        'message_id, created_at, message_assets!inner(id, kind, source, storage_bucket, storage_object_path, external_url, mime_type, file_name, size_bytes, duration_ms, created_at)',
      )
      .in('message_id', uniqueMessageIds)
      .order('created_at', { ascending: true });

  let assetResponse = await loadMessageAssetRows(supabase);

  if (assetResponse.error) {
    if (!canIgnoreMessageAssetProjectionError(assetResponse.error.message)) {
      if (serviceSupabase) {
        assetResponse = await loadMessageAssetRows(
          serviceSupabase as MessageAssetsWriteClient,
        );
      }
    }

    if (assetResponse.error && !canIgnoreMessageAssetProjectionError(assetResponse.error.message)) {
      throw new Error(assetResponse.error.message);
    }

    if (
      assetResponse.error &&
      isMissingOptionalMessageAssetProjectionErrorMessage(
        assetResponse.error.message,
      )
    ) {
      logChatHistoryDiagnostics(
        'attachments:asset-projection-schema-fallback',
        {
          errorMessage: assetResponse.error.message,
          messageIdsCount: uniqueMessageIds.length,
        },
        'warn',
      );
    }
  }

  if (!assetResponse.error) {
    assetRows = ((assetResponse.data ?? []) as Array<{
      created_at: string | null;
      message_assets:
        | {
            created_at?: string | null;
            duration_ms?: number | null;
            external_url?: string | null;
            file_name?: string | null;
            id: string;
            kind: 'image' | 'file' | 'audio' | 'voice-note';
            mime_type?: string | null;
            size_bytes?: number | null;
            source: 'supabase-storage' | 'external-url';
            storage_bucket?: string | null;
            storage_object_path?: string | null;
          }
        | Array<{
            created_at?: string | null;
            duration_ms?: number | null;
            external_url?: string | null;
            file_name?: string | null;
            id: string;
            kind: 'image' | 'file' | 'audio' | 'voice-note';
            mime_type?: string | null;
            size_bytes?: number | null;
            source: 'supabase-storage' | 'external-url';
            storage_bucket?: string | null;
            storage_object_path?: string | null;
          }>
        | null;
      message_id: string;
    }>)
      .map((row) => {
        const asset = normalizeJoinedRecord(row.message_assets);

        if (!asset) {
          return null;
        }

        return {
          asset_id: asset.id,
          created_at: row.created_at ?? asset.created_at ?? null,
          duration_ms: asset.duration_ms ?? null,
          external_url: asset.external_url ?? null,
          file_name: asset.file_name ?? null,
          kind: asset.kind,
          message_id: row.message_id,
          mime_type: asset.mime_type ?? null,
          size_bytes: asset.size_bytes ?? null,
          source: asset.source,
          storage_bucket: asset.storage_bucket ?? null,
          storage_object_path: asset.storage_object_path ?? null,
        } satisfies MessageAssetAttachmentRow;
      })
      .filter((row): row is MessageAssetAttachmentRow => Boolean(row));
  }

  const attachments = await Promise.all(
    [
      ...((data ?? []) as MessageAttachmentRow[]).map(async (row) => {
        const isVoiceMessage = row.object_path.includes('/voice/');
        const signedUrl = buildChatAttachmentDeliveryUrl({
          attachmentId: row.id,
          bucket: row.bucket,
          conversationId,
          isVoiceMessage,
          messageId: row.message_id,
          objectPath: row.object_path,
          preferredClient: supabase,
          serviceClient: serviceSupabase,
          source: 'legacy-attachment',
        });

        return {
          id: row.id,
          messageId: row.message_id,
          bucket: row.bucket,
          objectPath: row.object_path,
          mimeType: row.mime_type,
          sizeBytes: row.size_bytes,
          durationMs: null,
          createdAt: row.created_at,
          fileName: getAttachmentFileName(row.object_path),
          signedUrl,
          isImage: isImageAttachment(row.mime_type),
          isAudio: isAudioAttachment(row.mime_type),
          isVoiceMessage,
        } satisfies MessageAttachment;
      }),
      ...assetRows.map(async (row) => {
        let signedUrl: string | null = null;
        const isVoiceMessage = row.kind === 'voice-note';

        if (row.source === 'external-url') {
          logChatHistoryDiagnostics(
            'attachments:external-url-blocked',
            {
              attachmentId: row.asset_id,
              conversationId,
              messageId: row.message_id,
              source: row.source,
            },
            'warn',
          );
        } else if (
          row.source === 'supabase-storage' &&
          row.storage_bucket &&
          row.storage_object_path
        ) {
          signedUrl = buildChatAttachmentDeliveryUrl({
            attachmentId: row.asset_id,
            bucket: row.storage_bucket,
            conversationId,
            isVoiceMessage,
            messageId: row.message_id,
            objectPath: row.storage_object_path,
            preferredClient: supabase,
            serviceClient: serviceSupabase,
            source: 'message-asset',
          });
        }

        return {
          id: row.asset_id,
          messageId: row.message_id,
          bucket: row.storage_bucket ?? CHAT_ATTACHMENT_BUCKET,
          objectPath: row.storage_object_path ?? '',
          mimeType: row.mime_type,
          sizeBytes: row.size_bytes,
          durationMs: row.duration_ms,
          createdAt: row.created_at,
          fileName:
            row.file_name?.trim() ||
            (row.storage_object_path
              ? getAttachmentFileName(row.storage_object_path)
              : 'attachment'),
          signedUrl,
          isImage: row.kind === 'image' || isImageAttachment(row.mime_type),
          isAudio: row.kind === 'audio' || row.kind === 'voice-note' || isAudioAttachment(row.mime_type),
          isVoiceMessage,
        } satisfies MessageAttachment;
      }),
    ],
  );

  const grouped = new Map<string, MessageAttachment[]>();

  for (const attachment of attachments) {
    const existing = grouped.get(attachment.messageId) ?? [];
    existing.push(attachment);
    grouped.set(attachment.messageId, existing);
  }

  return grouped;
}

export async function resolveConversationAttachmentSignedUrl(input: {
  attachmentId: string;
  conversationId: string;
  messageId: string;
  userId: string;
}) {
  const resolvedTarget = await resolveConversationAttachmentContentTarget(input);

  if (!resolvedTarget) {
    return null;
  }

  const signedUrl = buildConversationAttachmentContentUrl({
    attachmentId: resolvedTarget.attachmentId,
    conversationId: input.conversationId.trim(),
    messageId: resolvedTarget.messageId,
  });

  logChatHistoryDiagnostics('attachment-delivery-url:resolved', {
    attachmentId: resolvedTarget.attachmentId,
    bucket: resolvedTarget.bucket,
    conversationId: input.conversationId.trim(),
    hasDeliveryUrl: Boolean(signedUrl),
    messageId: resolvedTarget.messageId,
    objectPath: resolvedTarget.objectPath,
    source: resolvedTarget.source,
    userId: input.userId,
  });

  return {
    signedUrl,
    source: resolvedTarget.source,
  };
}

async function getInboxAttachmentPreviewKindsByMessageId(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  messageIds: string[],
) {
  const uniqueMessageIds = Array.from(new Set(messageIds.filter(Boolean)));
  type MessageAttachmentLookupClient =
    Awaited<ReturnType<typeof createSupabaseServerClient>>;

  if (uniqueMessageIds.length === 0) {
    return new Map<string, InboxAttachmentPreviewKind>();
  }

  const previewKindsByMessageId = new Map<string, InboxAttachmentPreviewKind>();
  const serviceSupabase = createSupabaseServiceRoleClient();
  const canIgnoreMessageAssetPreviewError = (message: string) =>
    isMissingRelationErrorMessage(message, 'message_asset_links') ||
    isMissingRelationErrorMessage(message, 'message_assets');
  const loadAssetRows = async (client: MessageAttachmentLookupClient) =>
    client
      .from('message_asset_links')
      .select('message_id, created_at, message_assets!inner(kind, mime_type)')
      .in('message_id', uniqueMessageIds)
      .order('created_at', { ascending: true });

  let assetResponse = await loadAssetRows(supabase);

  if (assetResponse.error) {
    if (!canIgnoreMessageAssetPreviewError(assetResponse.error.message) && serviceSupabase) {
      assetResponse = await loadAssetRows(
        serviceSupabase as MessageAttachmentLookupClient,
      );
    }

    if (assetResponse.error && !canIgnoreMessageAssetPreviewError(assetResponse.error.message)) {
      throw new Error(assetResponse.error.message);
    }
  }

  if (!assetResponse.error) {
    for (const row of (assetResponse.data ?? []) as MessageAssetPreviewRow[]) {
      if (previewKindsByMessageId.has(row.message_id)) {
        continue;
      }

      const asset = normalizeJoinedRecord(row.message_assets);

      if (!asset) {
        continue;
      }

      previewKindsByMessageId.set(
        row.message_id,
        resolveInboxAttachmentPreviewKindFromMetadata({
          assetKind: asset.kind,
          mimeType: asset.mime_type ?? null,
        }),
      );
    }
  }

  const remainingMessageIds = uniqueMessageIds.filter(
    (messageId) => !previewKindsByMessageId.has(messageId),
  );

  if (remainingMessageIds.length === 0) {
    return previewKindsByMessageId;
  }

  const loadLegacyRows = async (client: MessageAttachmentLookupClient) => {
    return client
      .from('message_attachments')
      .select('message_id, mime_type, created_at')
      .in('message_id', remainingMessageIds)
      .order('created_at', { ascending: true });
  };

  let response = await loadLegacyRows(supabase);

  if (response.error) {
    if (isMissingRelationErrorMessage(response.error.message, 'message_attachments')) {
      return previewKindsByMessageId;
    }

    if (!serviceSupabase) {
      throw new Error(response.error.message);
    }

    const serviceResponse = await loadLegacyRows(
      serviceSupabase as MessageAttachmentLookupClient,
    );

    if (serviceResponse.error) {
      if (
        isMissingRelationErrorMessage(
          serviceResponse.error.message,
          'message_attachments',
        )
      ) {
        return previewKindsByMessageId;
      }

      throw new Error(serviceResponse.error.message);
    }

    response = serviceResponse;
  }

  const rows = (response.data ?? []) as MessageAttachmentPreviewRow[];

  for (const row of rows) {
    if (previewKindsByMessageId.has(row.message_id)) {
      continue;
    }

    previewKindsByMessageId.set(
      row.message_id,
      resolveInboxAttachmentPreviewKind(row.mime_type),
    );
  }

  return previewKindsByMessageId;
}

export async function assertConversationMembership(
  conversationId: string,
  userId: string,
) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('conversation_members')
    .select('conversation_id')
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
    .eq('state', 'active')
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data);
}

export async function markConversationRead(input: {
  conversationId: string;
  userId: string;
  lastReadMessageSeq: number;
}) {
  const supabase = await getRequestSupabaseServerClient();

  if (!input.userId) {
    throw new Error('Read state debug: authenticated user is required.');
  }

  if (!Number.isFinite(input.lastReadMessageSeq) || input.lastReadMessageSeq < 0) {
    throw new Error('Read state debug: invalid last read message sequence.');
  }

  const user = await requireRequestViewer('Read state debug');

  if (!user?.id) {
    throw new Error('Read state debug: no authenticated user found.');
  }

  if (user.id !== input.userId) {
    throw new Error(
      `Read state debug: user mismatch. auth user id=${user.id}, payload user id=${input.userId}.`,
    );
  }

  const { data: membershipRow, error: membershipError } = await supabase
    .from('conversation_members')
    .select('last_read_message_seq')
    .eq('conversation_id', input.conversationId)
    .eq('user_id', input.userId)
    .eq('state', 'active')
    .maybeSingle();

  if (membershipError) {
    if (isHiddenAtVisibilityRuntimeError(membershipError.message)) {
      throw createSchemaRequirementError(
        'Inbox archive/hide requires public.conversation_members.hidden_at.',
      );
    }

    throw new Error(membershipError.message);
  }

  if (!membershipRow) {
    throw new Error(
      'Read state debug: authenticated user is not an active member of this conversation.',
    );
  }

  const currentReadSeq =
    typeof membershipRow.last_read_message_seq === 'number'
      ? membershipRow.last_read_message_seq
      : null;

  const { data: latestMessageRow, error: latestMessageError } = await supabase
    .from('messages')
    .select('seq')
    .eq('conversation_id', input.conversationId)
    .order('seq', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestMessageError) {
    throw new Error(latestMessageError.message);
  }

  const latestMessageSeq =
    typeof latestMessageRow?.seq === 'number'
      ? latestMessageRow.seq
      : typeof latestMessageRow?.seq === 'string'
        ? Number(latestMessageRow.seq)
        : null;

  if (latestMessageSeq === null || !Number.isFinite(latestMessageSeq)) {
    return {
      updated: false,
      lastReadMessageSeq: currentReadSeq,
    };
  }

  const nextReadSeq = Math.min(input.lastReadMessageSeq, latestMessageSeq);

  if (currentReadSeq !== null && currentReadSeq >= nextReadSeq) {
    return {
      updated: false,
      lastReadMessageSeq: currentReadSeq,
    };
  }

  const { error: updateError } = await supabase
    .from('conversation_members')
    .update({
      last_read_message_seq: nextReadSeq,
      last_read_at: new Date().toISOString(),
    })
    .eq('conversation_id', input.conversationId)
    .eq('user_id', input.userId)
    .eq('state', 'active');

  if (updateError) {
    if (updateError.message.includes('row-level security policy')) {
      throw new Error(
        'Read state debug: update blocked by conversation_members RLS.',
      );
    }

    throw new Error(updateError.message);
  }

  return {
    updated: true,
    lastReadMessageSeq: nextReadSeq,
  };
}

export async function hideConversationForUser(input: {
  conversationId: string;
  userId: string;
}) {
  const supabase = await getRequestSupabaseServerClient();

  if (!input.userId) {
    throw new Error('Conversation archive debug: authenticated user is required.');
  }

  const user = await requireRequestViewer('Conversation archive debug');

  if (!user?.id) {
    throw new Error('Conversation archive debug: no authenticated user found.');
  }

  if (user.id !== input.userId) {
    throw new Error(
      `Conversation archive debug: user mismatch. auth user id=${user.id}, payload user id=${input.userId}.`,
    );
  }

  const { data: membershipRow, error: membershipError } = await supabase
    .from('conversation_members')
    .select('hidden_at')
    .eq('conversation_id', input.conversationId)
    .eq('user_id', input.userId)
    .eq('state', 'active')
    .maybeSingle();

  if (membershipError) {
    if (isHiddenAtVisibilityRuntimeError(membershipError.message)) {
      throw createSchemaRequirementError(
        'Inbox archive/hide requires public.conversation_members.hidden_at.',
      );
    }

    throw new Error(membershipError.message);
  }

  if (!membershipRow) {
    throw new Error('Only an active participant can hide this chat.');
  }

  if (membershipRow.hidden_at) {
    return { updated: false };
  }

  const { error: updateError } = await supabase
    .from('conversation_members')
    .update({ hidden_at: new Date().toISOString() })
    .eq('conversation_id', input.conversationId)
    .eq('user_id', input.userId)
    .eq('state', 'active');

  if (updateError) {
    if (isHiddenAtVisibilityRuntimeError(updateError.message)) {
      throw createSchemaRequirementError(
        'Inbox archive/hide requires public.conversation_members.hidden_at.',
      );
    }

    if (updateError.message.includes('row-level security policy')) {
      throw new Error(
        'Conversation archive debug: update blocked by conversation_members RLS.',
      );
    }

    throw new Error(updateError.message);
  }

  return { updated: true };
}

export async function deleteDirectConversationForUser(input: {
  conversationId: string;
  userId: string;
}) {
  if (!input.userId) {
    throw new Error('Direct chat delete requires an authenticated user.');
  }

  const user = await requireRequestViewer('Direct chat delete debug');

  if (!user?.id) {
    throw new Error('Direct chat delete debug: no authenticated user found.');
  }

  if (user.id !== input.userId) {
    throw new Error(
      `Direct chat delete debug: user mismatch. auth user id=${user.id}, payload user id=${input.userId}.`,
    );
  }

  const conversation = await getConversationForUser(input.conversationId, input.userId);

  if (!conversation) {
    throw new Error('This direct chat is no longer available.');
  }

  if (conversation.kind !== 'dm') {
    throw new Error('Delete chat is currently available for direct chats only.');
  }

  const serviceSupabase = createSupabaseServiceRoleClient();

  if (!serviceSupabase) {
    throw new Error('Delete chat requires server-side service access.');
  }

  const { data: messageRows, error: messageRowsError } = await serviceSupabase
    .from('messages')
    .select('id')
    .eq('conversation_id', input.conversationId);

  if (messageRowsError) {
    throw new Error(messageRowsError.message);
  }

  const messageIds = ((messageRows ?? []) as Array<{ id: string }>).map((row) => row.id);

  if (messageIds.length > 0) {
    const { error: reactionsError } = await serviceSupabase
      .from('message_reactions')
      .delete()
      .in('message_id', messageIds);

    if (reactionsError && !isMissingRelationErrorMessage(reactionsError.message, 'message_reactions')) {
      throw new Error(reactionsError.message);
    }

    const { data: attachmentRows, error: attachmentRowsError } = await serviceSupabase
      .from('message_attachments')
      .select('bucket, object_path')
      .in('message_id', messageIds);

    if (attachmentRowsError && !isMissingRelationErrorMessage(attachmentRowsError.message, 'message_attachments')) {
      throw new Error(attachmentRowsError.message);
    }

    const { data: assetLinkRows, error: assetLinkRowsError } = await serviceSupabase
      .from('message_asset_links')
      .select(
        'message_id, message_assets!inner(id, source, storage_bucket, storage_object_path)',
      )
      .in('message_id', messageIds);

    if (
      assetLinkRowsError &&
      !isMissingRelationErrorMessage(assetLinkRowsError.message, 'message_asset_links') &&
      !isMissingRelationErrorMessage(assetLinkRowsError.message, 'message_assets')
    ) {
      throw new Error(assetLinkRowsError.message);
    }

    const { error: attachmentsError } = await serviceSupabase
      .from('message_attachments')
      .delete()
      .in('message_id', messageIds);

    if (attachmentsError && !isMissingRelationErrorMessage(attachmentsError.message, 'message_attachments')) {
      throw new Error(attachmentsError.message);
    }

    const { error: envelopesError } = await serviceSupabase
      .from('message_e2ee_envelopes')
      .delete()
      .in('message_id', messageIds);

    if (envelopesError && !isMissingRelationErrorMessage(envelopesError.message, 'message_e2ee_envelopes')) {
      throw new Error(envelopesError.message);
    }

    const { error: messagesError } = await serviceSupabase
      .from('messages')
      .delete()
      .eq('conversation_id', input.conversationId);

    if (messagesError) {
      throw new Error(messagesError.message);
    }

    const storageObjectsByBucket = new Map<string, string[]>();

    for (const row of (attachmentRows ?? []) as Array<{
      bucket: string | null;
      object_path: string | null;
    }>) {
      const bucket = row.bucket?.trim();
      const objectPath = row.object_path?.trim();

      if (!bucket || !objectPath) {
        continue;
      }

      const existing = storageObjectsByBucket.get(bucket) ?? [];
      existing.push(objectPath);
      storageObjectsByBucket.set(bucket, existing);
    }

    for (const row of (assetLinkRows ?? []) as Array<{
      message_assets:
        | {
            id: string;
            source: 'supabase-storage' | 'external-url';
            storage_bucket?: string | null;
            storage_object_path?: string | null;
          }
        | Array<{
            id: string;
            source: 'supabase-storage' | 'external-url';
            storage_bucket?: string | null;
            storage_object_path?: string | null;
          }>
        | null;
    }>) {
      const asset = normalizeJoinedRecord(row.message_assets);

      if (
        !asset ||
        asset.source !== 'supabase-storage' ||
        !asset.storage_bucket?.trim() ||
        !asset.storage_object_path?.trim()
      ) {
        continue;
      }

      const existing = storageObjectsByBucket.get(asset.storage_bucket.trim()) ?? [];
      existing.push(asset.storage_object_path.trim());
      storageObjectsByBucket.set(asset.storage_bucket.trim(), existing);
    }

    for (const [bucket, objectPaths] of storageObjectsByBucket) {
      const uniqueObjectPaths = Array.from(new Set(objectPaths.filter(Boolean)));

      if (uniqueObjectPaths.length === 0) {
        continue;
      }

      await serviceSupabase.storage.from(bucket).remove(uniqueObjectPaths);
    }
  }

  const { error: membersError } = await serviceSupabase
    .from('conversation_members')
    .delete()
    .eq('conversation_id', input.conversationId);

  if (membersError) {
    throw new Error(membersError.message);
  }

  const { error: conversationDeleteError } = await serviceSupabase
    .from('conversations')
    .delete()
    .eq('id', input.conversationId)
    .eq('kind', 'dm');

  if (conversationDeleteError) {
    throw new Error(conversationDeleteError.message);
  }

  return {
    deleted: true,
    deletedMessageCount: messageIds.length,
  };
}

export async function restoreConversationForUser(input: {
  conversationId: string;
  userId: string;
}) {
  const supabase = await getRequestSupabaseServerClient();

  if (!input.userId) {
    throw new Error('Conversation archive debug: authenticated user is required.');
  }

  const user = await requireRequestViewer('Conversation archive debug');

  if (!user?.id) {
    throw new Error('Conversation archive debug: no authenticated user found.');
  }

  if (user.id !== input.userId) {
    throw new Error(
      `Conversation archive debug: user mismatch. auth user id=${user.id}, payload user id=${input.userId}.`,
    );
  }

  const { data: membershipRow, error: membershipError } = await supabase
    .from('conversation_members')
    .select('hidden_at')
    .eq('conversation_id', input.conversationId)
    .eq('user_id', input.userId)
    .eq('state', 'active')
    .maybeSingle();

  if (membershipError) {
    if (isHiddenAtVisibilityRuntimeError(membershipError.message)) {
      throw createSchemaRequirementError(
        'Inbox archive/hide requires public.conversation_members.hidden_at.',
      );
    }

    throw new Error(membershipError.message);
  }

  if (!membershipRow) {
    throw new Error('Only an active participant can restore this chat.');
  }

  if (!membershipRow.hidden_at) {
    return { updated: false };
  }

  const { error: updateError } = await supabase
    .from('conversation_members')
    .update({ hidden_at: null })
    .eq('conversation_id', input.conversationId)
    .eq('user_id', input.userId)
    .eq('state', 'active');

  if (updateError) {
    if (isHiddenAtVisibilityRuntimeError(updateError.message)) {
      throw createSchemaRequirementError(
        'Inbox archive/hide requires public.conversation_members.hidden_at.',
      );
    }

    if (updateError.message.includes('row-level security policy')) {
      throw new Error(
        'Conversation archive debug: update blocked by conversation_members RLS.',
      );
    }

    throw new Error(updateError.message);
  }

  return { updated: true };
}

export async function updateConversationNotificationLevel(input: {
  conversationId: string;
  userId: string;
  notificationLevel: ConversationNotificationLevel;
}) {
  const supabase = await getRequestSupabaseServerClient();

  if (!input.userId) {
    throw new Error('Conversation notifications debug: authenticated user is required.');
  }

  const user = await requireRequestViewer('Conversation notifications debug');

  if (!user?.id) {
    throw new Error('Conversation notifications debug: no authenticated user found.');
  }

  if (user.id !== input.userId) {
    throw new Error(
      `Conversation notifications debug: user mismatch. auth user id=${user.id}, payload user id=${input.userId}.`,
    );
  }

  if (input.notificationLevel !== 'default' && input.notificationLevel !== 'muted') {
    throw new Error('Choose a valid notification preference.');
  }

  const { data: membershipRow, error: membershipError } = await supabase
    .from('conversation_members')
    .select('conversation_id')
    .eq('conversation_id', input.conversationId)
    .eq('user_id', input.userId)
    .eq('state', 'active')
    .maybeSingle();

  if (membershipError) {
    throw new Error(membershipError.message);
  }

  if (!membershipRow) {
    throw new Error('Only an active participant can change this setting.');
  }

  const { error: updateError } = await supabase
    .from('conversation_members')
    .update({ notification_level: input.notificationLevel })
    .eq('conversation_id', input.conversationId)
    .eq('user_id', input.userId)
    .eq('state', 'active');

  if (updateError) {
    if (isMissingColumnErrorMessage(updateError.message, 'notification_level')) {
      throw createSchemaRequirementError(
        'Per-chat notification preferences require public.conversation_members.notification_level.',
      );
    }

    if (updateError.message.includes('row-level security policy')) {
      throw new Error(
        'Conversation notifications debug: update blocked by conversation_members RLS.',
      );
    }

    throw new Error(updateError.message);
  }

  return { updated: true };
}

export async function setConversationHistoryVisibleFromNextMessage(input: {
  conversationId: string;
  userId: string;
}) {
  const supabase = await getRequestSupabaseServerClient();

  if (!input.userId) {
    throw new Error('Conversation history baseline debug: authenticated user is required.');
  }

  const user = await requireRequestViewer('Conversation history baseline debug');

  if (!user?.id) {
    throw new Error('Conversation history baseline debug: no authenticated user found.');
  }

  if (user.id !== input.userId) {
    throw new Error(
      `Conversation history baseline debug: user mismatch. auth user id=${user.id}, payload user id=${input.userId}.`,
    );
  }

  const { data: membershipRow, error: membershipError } = await supabase
    .from('conversation_members')
    .select('conversation_id')
    .eq('conversation_id', input.conversationId)
    .eq('user_id', input.userId)
    .eq('state', 'active')
    .maybeSingle();

  if (membershipError) {
    throw new Error(membershipError.message);
  }

  if (!membershipRow) {
    throw new Error('Only an active participant can reset visible history.');
  }

  const latestRow = await supabase
    .from('messages')
    .select('seq')
    .eq('conversation_id', input.conversationId)
    .order('seq', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestRow.error) {
    throw new Error(latestRow.error.message);
  }

  const latestMessageSeq = normalizeConversationLatestMessageSeq(
    latestRow.data?.seq ?? null,
  );
  const nextVisibleFromSeq = latestMessageSeq === null ? 1 : latestMessageSeq + 1;

  const { error: updateError } = await supabase
    .from('conversation_members')
    .update({ visible_from_seq: nextVisibleFromSeq })
    .eq('conversation_id', input.conversationId)
    .eq('user_id', input.userId)
    .eq('state', 'active');

  if (updateError) {
    if (isMissingColumnErrorMessage(updateError.message, 'visible_from_seq')) {
      throw createSchemaRequirementError(
        'Per-member history baselines require public.conversation_members.visible_from_seq.',
      );
    }

    if (updateError.message.includes('row-level security policy')) {
      throw new Error(
        'Conversation history baseline debug: update blocked by conversation_members RLS.',
      );
    }

    throw new Error(updateError.message);
  }

  return {
    nextVisibleFromSeq,
    updated: true,
  };
}

export async function assertConversationExists(conversationId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('conversations')
    .select('id')
    .eq('id', conversationId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data);
}

export async function assertMessageInConversation(
  messageId: string,
  conversationId: string,
) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('messages')
    .select('id')
    .eq('id', messageId)
    .eq('conversation_id', conversationId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data);
}

export async function assertMessageOwnedByUser(
  messageId: string,
  conversationId: string,
  userId: string,
) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('messages')
    .select('id')
    .eq('id', messageId)
    .eq('conversation_id', conversationId)
    .eq('sender_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data);
}

export async function toggleMessageReaction(input: {
  messageId: string;
  userId: string;
  emoji: string;
}) {
  const supabase = await createSupabaseServerClient();
  const { data: existingRows, error: existingError } = await supabase
    .from('message_reactions')
    .select('id, emoji')
    .eq('message_id', input.messageId)
    .eq('user_id', input.userId);

  if (existingError) {
    throw new Error(existingError.message);
  }

  const userRows = existingRows ?? [];
  const sameEmojiRows = userRows.filter((row) => row.emoji === input.emoji);

  if (sameEmojiRows.length > 0) {
    const ids = sameEmojiRows.map((row) => row.id);
    const { error: deleteError } = await supabase
      .from('message_reactions')
      .delete()
      .in('id', ids);

    if (deleteError) {
      throw new Error(deleteError.message);
    }

    return {
      selected: false,
    } as const;
  }

  if (userRows.length >= 3) {
    throw new Error('You can add up to 3 reactions to a single message.');
  }

  const { error: insertError } = await supabase.from('message_reactions').insert({
    message_id: input.messageId,
    user_id: input.userId,
    emoji: input.emoji,
  });

  if (insertError) {
    throw new Error(insertError.message);
  }

  return {
    selected: true,
  } as const;
}

type ConversationSummaryMessageRow = {
  id: string;
  seq: number | string;
  sender_id: string | null;
  body: string | null;
  kind: string | null;
  content_mode?: string | null;
  deleted_at: string | null;
  created_at: string | null;
};

type ConversationSummaryMessageRowWithConversationId =
  ConversationSummaryMessageRow & {
    conversation_id: string;
  };

async function loadConversationSummaryMessageRowById(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  messageId: string,
) {
  const response = await supabase
    .from('messages')
    .select('id, seq, sender_id, body, kind, content_mode, deleted_at, created_at')
    .eq('id', messageId)
    .maybeSingle();

  if (response.error) {
    if (isMissingColumnErrorMessage(response.error.message, 'content_mode')) {
      const fallback = await supabase
        .from('messages')
        .select('id, seq, sender_id, body, kind, deleted_at, created_at')
        .eq('id', messageId)
        .maybeSingle();

      if (fallback.error) {
        throw new Error(fallback.error.message);
      }

      return (fallback.data ?? null) as ConversationSummaryMessageRow | null;
    }

    throw new Error(response.error.message);
  }

  return (response.data ?? null) as ConversationSummaryMessageRow | null;
}

async function loadLatestConversationSummaryMessageRowsByConversationId(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  conversationIds: string[],
) {
  const uniqueConversationIds = Array.from(new Set(conversationIds.filter(Boolean)));

  if (uniqueConversationIds.length === 0) {
    return new Map<string, ConversationSummaryMessageRowWithConversationId>();
  }

  const loadLatestRowsWithContentMode = async () =>
    supabase
      .from('messages')
      .select(
        'id, conversation_id, seq, sender_id, body, kind, content_mode, deleted_at, created_at',
      )
      .in('conversation_id', uniqueConversationIds)
      .order('conversation_id', { ascending: true })
      .order('seq', { ascending: false });

  const loadLatestRowsWithoutContentMode = async () =>
    supabase
      .from('messages')
      .select(
        'id, conversation_id, seq, sender_id, body, kind, deleted_at, created_at',
      )
      .in('conversation_id', uniqueConversationIds)
      .order('conversation_id', { ascending: true })
      .order('seq', { ascending: false });

  const responseWithContentMode = await loadLatestRowsWithContentMode();
  let rows: ConversationSummaryMessageRowWithConversationId[] = [];

  if (responseWithContentMode.error) {
    if (isMissingColumnErrorMessage(responseWithContentMode.error.message, 'content_mode')) {
      const fallbackResponse = await loadLatestRowsWithoutContentMode();

      if (fallbackResponse.error) {
        throw new Error(fallbackResponse.error.message);
      }

      rows =
        (fallbackResponse.data ?? []) as ConversationSummaryMessageRowWithConversationId[];
    } else {
      throw new Error(responseWithContentMode.error.message);
    }
  } else {
    rows =
      (responseWithContentMode.data ?? []) as ConversationSummaryMessageRowWithConversationId[];
  }

  const latestRowsByConversationId = new Map<
    string,
    ConversationSummaryMessageRowWithConversationId
  >();

  for (const row of rows) {
    const conversationId = row.conversation_id?.trim();

    if (!conversationId || latestRowsByConversationId.has(conversationId)) {
      continue;
    }

    const normalizedSeq = normalizeConversationLatestMessageSeq(row.seq ?? null);

    if (normalizedSeq === null) {
      continue;
    }

    latestRowsByConversationId.set(conversationId, row);
  }

  return latestRowsByConversationId;
}

async function loadLatestConversationSummaryMessageRow(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  conversationId: string,
) {
  const response = await supabase
    .from('messages')
    .select('id, seq, sender_id, body, kind, content_mode, deleted_at, created_at')
    .eq('conversation_id', conversationId)
    .order('seq', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (response.error) {
    if (isMissingColumnErrorMessage(response.error.message, 'content_mode')) {
      const fallback = await supabase
        .from('messages')
        .select('id, seq, sender_id, body, kind, deleted_at, created_at')
        .eq('conversation_id', conversationId)
        .order('seq', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fallback.error) {
        throw new Error(fallback.error.message);
      }

      return (fallback.data ?? null) as ConversationSummaryMessageRow | null;
    }

    throw new Error(response.error.message);
  }

  return (response.data ?? null) as ConversationSummaryMessageRow | null;
}

async function updateConversationSummaryProjectionFromRow(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  conversationId: string,
  row: ConversationSummaryMessageRow | null,
) {
  if (conversationSummaryProjectionAvailability === 'missing') {
    const { error: fallbackUpdate } = await supabase
      .from('conversations')
      .update({
        last_message_at: row?.created_at ?? null,
      })
      .eq('id', conversationId);

    if (fallbackUpdate) {
      throw new Error(fallbackUpdate.message);
    }

    return;
  }

  const latestMessageSeq = normalizeConversationLatestMessageSeq(row?.seq ?? null);
  const updatePayload = row
    ? {
        last_message_at: row.created_at ?? null,
        last_message_id: row.id,
        last_message_seq: latestMessageSeq,
        last_message_sender_id: row.sender_id ?? null,
        last_message_kind: row.kind ?? null,
        last_message_content_mode: row.content_mode ?? null,
        last_message_deleted_at: row.deleted_at ?? null,
        last_message_body: row.body ?? null,
      }
    : {
        last_message_at: null,
        last_message_id: null,
        last_message_seq: null,
        last_message_sender_id: null,
        last_message_kind: null,
        last_message_content_mode: null,
        last_message_deleted_at: null,
        last_message_body: null,
      };

  const { error } = await supabase
    .from('conversations')
    .update(updatePayload)
    .eq('id', conversationId);

  if (error) {
    if (
      isMissingConversationSummaryProjectionErrorMessage(error.message)
    ) {
      markConversationSummaryProjectionAvailability('missing', error.message);
      const fallbackUpdate = await supabase
        .from('conversations')
        .update({
          last_message_at: row?.created_at ?? null,
        })
        .eq('id', conversationId);

      if (fallbackUpdate.error) {
        throw new Error(fallbackUpdate.error.message);
      }

      return;
    }

    throw new Error(error.message);
  }
}

async function syncConversationSummaryProjectionByMessageId(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  conversationId: string,
  messageId: string,
) {
  const messageRow = await loadConversationSummaryMessageRowById(supabase, messageId);
  await updateConversationSummaryProjectionFromRow(
    supabase,
    conversationId,
    messageRow,
  );
}

async function syncConversationSummaryProjectionFromLatestMessage(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  conversationId: string,
) {
  const latestMessageRow = await loadLatestConversationSummaryMessageRow(
    supabase,
    conversationId,
  );
  await updateConversationSummaryProjectionFromRow(
    supabase,
    conversationId,
    latestMessageRow,
  );
}

export async function sendTextMessage(input: {
  conversationId: string;
  body: string;
  senderId: string;
  replyToMessageId?: string | null;
  clientId?: string;
}) {
  return createMessageRecord({
    conversationId: input.conversationId,
    senderId: input.senderId,
    body: input.body,
    clientId: input.clientId,
    replyToMessageId: input.replyToMessageId ?? null,
  });
}

type CommitEncryptedDmMessageShellInput = DmE2eeSendRequest & {
  messageKind?: DmE2eeMessageKind;
  senderId: string;
  syncConversationSummaryProjection?: boolean;
};

async function commitEncryptedDmMessageShell(
  input: CommitEncryptedDmMessageShellInput,
) {
  const sendDebugState: DmE2eeSendDebugState = {
    sendExactFailureStage: 'send:start',
    sendFailedOperation: null,
    sendReasonCode: null,
    sendErrorMessage: null,
    sendErrorCode: null,
    sendErrorDetails: null,
    sendErrorHint: null,
    sendSelectedConversationId: input.conversationId,
    sendSenderUserId: input.senderId,
    sendRecipientUserId: null,
    sendSelectedSenderDeviceRowId: input.senderDeviceRecordId,
    sendSelectedRecipientDeviceRowId:
      input.envelopes[0]?.recipientDeviceRecordId ?? null,
  };
  const requestedMessageKind = input.messageKind ?? input.kind ?? 'text';
  logDmE2eeSendDiagnostics('start', {
    hasConversationId: Boolean(input.conversationId),
    hasSenderDeviceRecordId: Boolean(input.senderDeviceRecordId),
    envelopeCount: input.envelopes.length,
    requestedMessageKind,
  });
  const conversation = await getConversationForUser(
    input.conversationId,
    input.senderId,
  );

  if (!conversation) {
    sendDebugState.sendExactFailureStage = 'send:conversation-missing';
    sendDebugState.sendFailedOperation = 'conversation lookup';
    sendDebugState.sendReasonCode = 'send: selected conversation unavailable';
    sendDebugState.sendErrorMessage = 'This chat is no longer available.';
    throw createDmE2eeSendProofError(
      'This chat is no longer available.',
      sendDebugState,
    );
  }

  if (conversation.kind !== 'dm') {
    sendDebugState.sendExactFailureStage = 'send:conversation-not-dm';
    sendDebugState.sendFailedOperation = 'conversation kind check';
    sendDebugState.sendReasonCode = 'send: selected conversation unavailable';
    sendDebugState.sendErrorMessage =
      'Encrypted DM send is only available for direct chats.';
    throw createDmE2eeSendProofError(
      'Encrypted DM send is only available for direct chats.',
      sendDebugState,
    );
  }

  sendDebugState.sendExactFailureStage = 'send:conversation-ok';

  const participants = await getConversationParticipants(input.conversationId);
  sendDebugState.sendRecipientUserId =
    participants.find((participant) => participant.userId !== input.senderId)
      ?.userId ?? null;

  if (!input.envelopes.length) {
    sendDebugState.sendExactFailureStage = 'send:missing-envelopes';
    sendDebugState.sendFailedOperation = 'envelope validation';
    sendDebugState.sendReasonCode = 'send: envelope build failed';
    sendDebugState.sendErrorMessage =
      'Encrypted DM send requires at least one ciphertext envelope.';
    throw createDmE2eeSendProofError(
      'Encrypted DM send requires at least one ciphertext envelope.',
      sendDebugState,
    );
  }

  const supabase = await createSupabaseServerClient();
  sendDebugState.sendExactFailureStage = 'send:sender-device-lookup';
  const deviceOwnership = await supabase
    .from('user_devices')
    .select('id')
    .eq('id', input.senderDeviceRecordId)
    .eq('user_id', input.senderId)
    .is('retired_at', null)
    .maybeSingle();

  if (deviceOwnership.error) {
    const diagnostics = getSupabaseErrorDiagnostics(deviceOwnership.error);
    sendDebugState.sendFailedOperation = 'sender device lookup';
    sendDebugState.sendReasonCode = 'send: sender device lookup failed';
    sendDebugState.sendErrorMessage = deviceOwnership.error.message;
    sendDebugState.sendErrorCode =
      typeof diagnostics.error_code === 'string'
        ? diagnostics.error_code
        : null;
    sendDebugState.sendErrorDetails =
      typeof diagnostics.error_details === 'string'
        ? diagnostics.error_details
        : null;
    sendDebugState.sendErrorHint =
      typeof diagnostics.error_hint === 'string'
        ? diagnostics.error_hint
        : null;
    if (
      isMissingRelationErrorMessage(deviceOwnership.error.message, 'user_devices') ||
      isMissingColumnErrorMessage(deviceOwnership.error.message, 'retired_at')
    ) {
      sendDebugState.sendExactFailureStage = 'send:sender-device-lookup:schema';
      throw createDmE2eeSendProofError(
        createSchemaRequirementError(
          'DM E2EE bootstrap schema is missing.',
        ).message,
        sendDebugState,
      );
    }

    sendDebugState.sendExactFailureStage = 'send:sender-device-lookup:error';
    throw createDmE2eeSendProofError(
      deviceOwnership.error.message,
      sendDebugState,
    );
  }

  if (!deviceOwnership.data) {
    sendDebugState.sendExactFailureStage = 'send:sender-device-lookup:stale';
    sendDebugState.sendFailedOperation = 'sender device ownership';
    sendDebugState.sendReasonCode = 'send: sender device lookup failed';
    sendDebugState.sendErrorMessage =
      'Sending device is not registered for DM E2EE.';
    throw applyDmE2eeSendDebugState(
      createDmE2eeOperationError(
        'dm_e2ee_sender_device_stale',
        'Sending device is not registered for DM E2EE.',
      ),
      sendDebugState,
    );
  }
  logDmE2eeSendDiagnostics('sender-device-ok');

  sendDebugState.sendExactFailureStage = 'send:rpc';
  const rpcResult = await supabase.rpc('send_dm_e2ee_message_atomic', {
    p_conversation_id: input.conversationId,
    p_reply_to_message_id: input.replyToMessageId ?? null,
    p_client_id: input.clientId,
    p_sender_device_id: input.senderDeviceRecordId,
    p_envelopes: input.envelopes,
  });

  if (rpcResult.error) {
    const diagnostics = getSupabaseErrorDiagnostics(rpcResult.error);
    sendDebugState.sendFailedOperation = 'send_dm_e2ee_message_atomic';
    sendDebugState.sendErrorMessage = rpcResult.error.message;
    sendDebugState.sendErrorCode =
      typeof diagnostics.error_code === 'string'
        ? diagnostics.error_code
        : null;
    sendDebugState.sendErrorDetails =
      typeof diagnostics.error_details === 'string'
        ? diagnostics.error_details
        : null;
    sendDebugState.sendErrorHint =
      typeof diagnostics.error_hint === 'string'
        ? diagnostics.error_hint
        : null;
    logDmE2eeSendDiagnostics('rpc-error', {
      message: rpcResult.error.message,
      ...sendDebugState,
    });
    if (
      isMissingRelationErrorMessage(rpcResult.error.message, 'message_e2ee_envelopes') ||
      isMissingRelationErrorMessage(rpcResult.error.message, 'user_devices') ||
      isMissingRelationErrorMessage(rpcResult.error.message, 'device_one_time_prekeys') ||
      isMissingFunctionErrorMessage(
        rpcResult.error.message,
        'send_dm_e2ee_message_atomic',
      ) ||
      isMissingColumnErrorMessage(rpcResult.error.message, 'content_mode') ||
      isMissingColumnErrorMessage(rpcResult.error.message, 'sender_device_id') ||
      isMissingColumnErrorMessage(rpcResult.error.message, 'ciphertext') ||
      isMissingColumnErrorMessage(rpcResult.error.message, 'claimed_at')
    ) {
      sendDebugState.sendExactFailureStage = 'send:rpc:schema';
      sendDebugState.sendReasonCode = 'send: rpc schema failed';
      throw createDmE2eeSendProofError(
        createSchemaRequirementError(
          'DM E2EE send schema is missing.',
        ).message,
        sendDebugState,
      );
    }

    if (rpcResult.error.message.includes('dm_e2ee_prekey_conflict')) {
      sendDebugState.sendExactFailureStage = 'send:rpc:prekey-conflict';
      sendDebugState.sendReasonCode = 'send: envelope build failed';
      throw applyDmE2eeSendDebugState(
        createDmE2eeOperationError(
          'dm_e2ee_prekey_conflict',
          'Recipient prekey was already used. Refresh and try sending again.',
        ),
        sendDebugState,
      );
    }

    if (rpcResult.error.message.includes('dm_e2ee_sender_device_stale')) {
      sendDebugState.sendExactFailureStage = 'send:rpc:sender-device-stale';
      sendDebugState.sendReasonCode = 'send: sender device lookup failed';
      throw applyDmE2eeSendDebugState(
        createDmE2eeOperationError(
          'dm_e2ee_sender_device_stale',
          'Sending device is not registered for DM E2EE.',
        ),
        sendDebugState,
      );
    }

    if (
      rpcResult.error.message.includes('dm_e2ee_conversation_unavailable') ||
      rpcResult.error.message.includes('dm_e2ee_recipient_unavailable')
    ) {
      sendDebugState.sendExactFailureStage = 'send:rpc:recipient-unavailable';
      sendDebugState.sendReasonCode = 'send: recipient bundle missing';
      throw applyDmE2eeSendDebugState(
        createDmE2eeOperationError(
          'dm_e2ee_recipient_unavailable',
          'Recipient encrypted setup is unavailable for this direct chat.',
        ),
        sendDebugState,
      );
    }

    if (rpcResult.error.message.includes('dm_e2ee_missing_envelopes')) {
      sendDebugState.sendExactFailureStage = 'send:rpc:missing-envelopes';
      sendDebugState.sendReasonCode = 'send: envelope build failed';
      throw applyDmE2eeSendDebugState(
        createDmE2eeOperationError(
          'dm_e2ee_local_state_incomplete',
          'Local encrypted payload was incomplete. Refresh encrypted setup and try again.',
        ),
        sendDebugState,
      );
    }

    if (rpcResult.error.message.includes('row-level security policy')) {
      sendDebugState.sendExactFailureStage = 'send:rpc:rls';
      sendDebugState.sendReasonCode = 'send: post-send update failed';
      throw createDmE2eeSendProofError(
        createSchemaRequirementError(
          'DM E2EE send is blocked by database policy. Apply the latest atomic send SQL patch.',
        ).message,
        sendDebugState,
      );
    }

    sendDebugState.sendExactFailureStage = 'send:rpc:error';
    sendDebugState.sendReasonCode = 'send: message row insert failed';
    throw createDmE2eeSendProofError(
      rpcResult.error.message,
      sendDebugState,
    );
  }

  sendDebugState.sendExactFailureStage = 'send:rpc:ok';
  const row = Array.isArray(rpcResult.data)
    ? (rpcResult.data[0] as
        | { message_id?: string | null; created_at?: string | null; client_id?: string | null }
        | undefined)
    : (rpcResult.data as
        | { message_id?: string | null; created_at?: string | null; client_id?: string | null }
        | null);

  const messageId = String(row?.message_id ?? '').trim();

  if (!messageId) {
    sendDebugState.sendExactFailureStage = 'send:rpc:missing-message-id';
    sendDebugState.sendFailedOperation = 'atomic send result';
    sendDebugState.sendReasonCode = 'send: message row insert failed';
    sendDebugState.sendErrorMessage =
      'Encrypted DM send did not return a persisted message id.';
    throw createDmE2eeSendProofError(
      'Encrypted DM send did not return a persisted message id.',
      sendDebugState,
    );
  }

  const cleanupClient = createSupabaseServiceRoleClient() ?? supabase;

  if (requestedMessageKind !== 'text') {
    sendDebugState.sendExactFailureStage = 'send:message-kind-update';
    const { error: messageKindUpdateError } = await cleanupClient
      .from('messages')
      .update({
        kind: requestedMessageKind,
      })
      .eq('id', messageId)
      .eq('conversation_id', input.conversationId)
      .eq('sender_id', input.senderId);

    if (messageKindUpdateError) {
      await cleanupClient
        .from('messages')
        .delete()
        .eq('id', messageId)
        .eq('conversation_id', input.conversationId);
      sendDebugState.sendFailedOperation = 'messages.kind update';
      sendDebugState.sendReasonCode = 'send: message row finalize failed';
      sendDebugState.sendErrorMessage = messageKindUpdateError.message;
      throw createDmE2eeSendProofError(
        messageKindUpdateError.message,
        sendDebugState,
      );
    }
  }

  logDmE2eeSendDiagnostics('done', {
    hasMessageId: true,
    requestedMessageKind,
  });

  if (input.syncConversationSummaryProjection !== false) {
    await syncConversationSummaryProjectionByMessageId(
      supabase,
      input.conversationId,
      messageId,
    );
  }

  return {
    messageId,
    timestamp: row?.created_at ?? new Date().toISOString(),
    clientId: String(row?.client_id ?? input.clientId),
  };
}

export async function sendEncryptedDmTextMessage(
  input: DmE2eeSendRequest & { senderId: string },
) {
  return commitEncryptedDmMessageShell({
    ...input,
    messageKind: 'text',
  });
}

export async function sendEncryptedDmMessageWithAttachment(
  input: DmE2eeSendRequest & {
    file: File;
    senderId: string;
    voiceDurationMs?: number | null;
  },
) {
  if (!input.file || input.file.size === 0) {
    throw new Error('Choose a file before sending.');
  }

  if (input.file.size > CHAT_ATTACHMENT_MAX_SIZE_BYTES) {
    throw new Error('Attachments can be up to 10 MB in this first version.');
  }

  if (!isSupportedChatAttachmentType(input.file.type, input.file.name)) {
    throw new Error(CHAT_ATTACHMENT_HELP_TEXT);
  }

  const supabase = await createSupabaseServerClient();
  const serviceSupabase = createSupabaseServiceRoleClient();
  const storageClient =
    (serviceSupabase ?? supabase) as Awaited<
      ReturnType<typeof createSupabaseServerClient>
    >;
  const effectiveAttachmentMimeType = resolveMessagingAttachmentMimeType({
    fileName: input.file.name,
    mimeType: input.file.type,
  });
  const attachmentMessageKind = getAttachmentMessageKind(
    effectiveAttachmentMimeType,
  );

  if (attachmentMessageKind === 'voice') {
    throw new Error(
      'Encrypted direct-message text with voice recordings is not supported yet.',
    );
  }

  const committedAssetKind = resolveMessagingAssetKindFromMimeType({
    fileName: input.file.name,
    messageKind: attachmentMessageKind,
    mimeType: effectiveAttachmentMimeType,
  });
  const storageFolder =
    committedAssetKind === 'image'
      ? 'images'
      : committedAssetKind === 'audio'
        ? 'audio'
        : 'files';
  const normalizedClientId = input.clientId.trim();

  if (!normalizedClientId) {
    throw new Error('Encrypted DM send requires a stable client id.');
  }

  const fileName = sanitizeAttachmentFileName(input.file.name);
  const objectPath = `${input.conversationId}/${normalizedClientId}/${storageFolder}/${Date.now()}-${fileName}`;
  const fileBuffer = Buffer.from(await input.file.arrayBuffer());
  let uploadedObject = false;
  let shellResult:
    | {
        clientId: string;
        messageId: string;
        timestamp: string;
      }
    | null = null;

  const cleanupUploadedObject = async () => {
    if (!uploadedObject) {
      return;
    }

    await storageClient.storage.from(CHAT_ATTACHMENT_BUCKET).remove([objectPath]);
  };

  const cleanupCommittedShell = async () => {
    if (!shellResult?.messageId) {
      return;
    }

    await (createSupabaseServiceRoleClient() ?? supabase)
      .from('messages')
      .delete()
      .eq('id', shellResult.messageId)
      .eq('conversation_id', input.conversationId);
  };

  const { error: uploadError } = await storageClient.storage
    .from(CHAT_ATTACHMENT_BUCKET)
    .upload(objectPath, fileBuffer, {
      cacheControl: '3600',
      contentType: effectiveAttachmentMimeType ?? undefined,
      upsert: false,
    });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  uploadedObject = true;

  try {
    shellResult = await commitEncryptedDmMessageShell({
      ...input,
      clientId: normalizedClientId,
      kind: 'attachment',
      messageKind: attachmentMessageKind,
      syncConversationSummaryProjection: false,
    });

    await insertCommittedMessageAssetAndLink({
      assetKind: committedAssetKind,
      client: supabase,
      conversationId: input.conversationId,
      durationMs: input.voiceDurationMs ?? null,
      file: input.file,
      mimeType: effectiveAttachmentMimeType,
      messageId: shellResult.messageId,
      objectPath,
      schemaRequirementErrorMessage: 'Chat media asset schema is missing.',
      senderId: input.senderId,
    });

    await syncConversationSummaryProjectionByMessageId(
      supabase,
      input.conversationId,
      shellResult.messageId,
    );

    return shellResult;
  } catch (error) {
    await cleanupCommittedShell();
    await cleanupUploadedObject();
    throw error;
  }
}

async function createMessageRecord(input: {
  conversationId: string;
  senderId: string;
  body?: string | null;
  replyToMessageId?: string | null;
  touchConversation?: boolean;
  kind?: 'text' | 'attachment' | 'voice';
  clientId?: string;
  contentMode?: 'plaintext' | 'dm_e2ee_v1';
  senderDeviceId?: string | null;
}) {
  const supabase = await getRequestSupabaseServerClient();
  const timestamp = new Date().toISOString();
  const clientId = input.clientId?.trim() || crypto.randomUUID();
  const messageId = crypto.randomUUID();

  if (!input.senderId) {
    throw new Error(
      'Message sending debug: authenticated sender is required before insert.',
    );
  }

  const user = await requireRequestViewer('Message sending debug');

  if (!user) {
    throw new Error(
      'Message sending debug: no authenticated user found in the server action client.',
    );
  }

  if (!user.id) {
    throw new Error(
      'Message sending debug: authenticated user is present but user.id is missing.',
    );
  }

  if (input.senderId !== user.id) {
    throw new Error(
      `Message sending debug: sender_id mismatch. auth user id=${user.id}, payload sender_id=${input.senderId}.`,
    );
  }

  const payload = buildMessageInsertPayload({
    messageId,
    conversationId: input.conversationId,
    senderId: input.senderId,
    replyToMessageId: input.replyToMessageId ?? null,
    kind: input.kind ?? 'text',
    clientId,
    body: input.body ?? null,
    contentMode: input.contentMode,
    senderDeviceId: input.senderDeviceId ?? null,
  });

  const { error: insertError } = await supabase.from('messages').insert(payload);

  if (insertError) {
    if (
      (input.contentMode === 'dm_e2ee_v1' &&
        (isMissingColumnErrorMessage(insertError.message, 'content_mode') ||
          isMissingColumnErrorMessage(insertError.message, 'sender_device_id'))) ||
      (input.contentMode === 'dm_e2ee_v1' &&
        isMissingColumnErrorMessage(insertError.message, 'body'))
    ) {
      throw createSchemaRequirementError('DM E2EE send schema is missing.');
    }

    if (
      input.kind === 'voice' &&
      insertError.message.includes('messages_kind_check')
    ) {
      throw createSchemaRequirementError(
        "Voice message send schema is missing `public.messages.kind = 'voice'` support.",
      );
    }

    if (
      input.kind === 'voice' &&
      isUniqueConstraintErrorMessage(
        insertError.message,
        'messages_sender_id_client_id_key',
      )
    ) {
      logVoiceSendDiagnostics(
        'message-commit:duplicate-client-id',
        {
          clientId,
          conversationId: input.conversationId,
          errorMessage: insertError.message,
          senderId: input.senderId,
        },
        'error',
      );
      throw new Error(
        'Voice message retry conflicted with an earlier send attempt. Try sending it again.',
      );
    }

    if (insertError.message.includes('row-level security policy')) {
      throw new Error(
        `Message sending debug: insert blocked by messages RLS. auth user id=${user.id}, payload sender_id=${input.senderId}, conversation_id=${input.conversationId}. Values match, so the failure is likely database-side RLS state or membership policy rather than payload construction.`,
      );
    }

    throw new Error(insertError.message);
  }

  if (input.touchConversation ?? true) {
    await syncConversationSummaryProjectionByMessageId(
      supabase,
      input.conversationId,
      messageId,
    );
  }

  return {
    messageId,
    timestamp,
    clientId,
  };
}

export async function editMessage(input: {
  messageId: string;
  conversationId: string;
  senderId: string;
  body: string;
}) {
  const supabase = await getRequestSupabaseServerClient();
  const timestamp = new Date().toISOString();

  if (!input.senderId) {
    throw new Error('Authenticated sender is required to edit a message.');
  }

  const user = await requireRequestViewer('Message edit debug');

  if (!user?.id) {
    throw new Error('Message edit debug: no authenticated user found.');
  }

  if (user.id !== input.senderId) {
    throw new Error(
      `Message edit debug: sender mismatch. auth user id=${user.id}, payload sender_id=${input.senderId}.`,
    );
  }

  const { error } = await supabase
    .from('messages')
    .update({
      body: input.body.trim(),
      edited_at: timestamp,
    })
    .eq('id', input.messageId)
    .eq('conversation_id', input.conversationId)
    .eq('sender_id', input.senderId)
    .is('deleted_at', null);

  if (error) {
    if (error.message.includes('row-level security policy')) {
      throw new Error(
        'Message edit debug: update blocked by messages RLS.',
      );
    }

    throw new Error(error.message);
  }

  await syncConversationSummaryProjectionFromLatestMessage(
    supabase,
    input.conversationId,
  );

  return {
    body: input.body.trim(),
    editedAt: timestamp,
  };
}

export async function softDeleteMessage(input: {
  messageId: string;
  conversationId: string;
  senderId: string;
}) {
  const supabase = await getRequestSupabaseServerClient();
  const timestamp = new Date().toISOString();

  if (!input.senderId) {
    throw new Error('Authenticated sender is required to delete a message.');
  }

  const user = await requireRequestViewer('Message delete debug');

  if (!user?.id) {
    throw new Error('Message delete debug: no authenticated user found.');
  }

  if (user.id !== input.senderId) {
    throw new Error(
      `Message delete debug: sender mismatch. auth user id=${user.id}, payload sender_id=${input.senderId}.`,
    );
  }

  const { error } = await supabase
    .from('messages')
    .update({
      deleted_at: timestamp,
      edited_at: null,
    })
    .eq('id', input.messageId)
    .eq('conversation_id', input.conversationId)
    .eq('sender_id', input.senderId)
    .is('deleted_at', null);

  if (error) {
    if (error.message.includes('row-level security policy')) {
      throw new Error(
        'Message delete debug: update blocked by messages RLS.',
      );
    }

    throw new Error(error.message);
  }

  await syncConversationSummaryProjectionFromLatestMessage(
    supabase,
    input.conversationId,
  );

  return {
    deletedAt: timestamp,
  };
}

export async function updateConversationTitle(input: {
  conversationId: string;
  userId: string;
  title: string;
}) {
  const supabase = await getRequestSupabaseServerClient();
  const writeSupabase = getGroupManagementWriteClient(supabase);

  if (!input.userId) {
    throw new Error('Authenticated user is required to edit a group title.');
  }

  const user = await requireRequestViewer('Conversation settings debug');

  if (!user?.id) {
    throw new Error('Conversation settings debug: no authenticated user found.');
  }

  if (user.id !== input.userId) {
    throw new Error(
      `Conversation settings debug: user mismatch. auth user id=${user.id}, payload user id=${input.userId}.`,
    );
  }

  const actingMembership = await getActiveGroupMembership(
    input.conversationId,
    input.userId,
  );

  if (!actingMembership) {
    throw new Error('You are no longer an active member of this group.');
  }

  if (!canEditGroupConversationIdentity(actingMembership.role)) {
    throw new Error('Only group admins can edit chat identity.');
  }

  const { error } = await writeSupabase
    .from('conversations')
    .update({ title: input.title.trim() })
    .eq('id', input.conversationId)
    .eq('kind', 'group');

  if (error) {
    if (error.message.includes('row-level security policy')) {
      throw new Error(
        'Conversation settings debug: title update blocked by conversations RLS.',
      );
    }

    throw new Error(error.message);
  }
}

export async function updateConversationIdentity(input: {
  conversationId: string;
  userId: string;
  title: string;
  avatarObjectPath?: string | null;
  avatarFile?: File | null;
  joinPolicy?: 'closed' | 'open' | null;
  removeAvatar?: boolean;
}) {
  const supabase = await getRequestSupabaseServerClient();
  const writeSupabase = getGroupManagementWriteClient(supabase);

  if (!input.userId) {
    throw new Error('Authenticated user is required to edit group settings.');
  }

  const user = await requireRequestViewer('Conversation settings debug');

  if (!user?.id) {
    throw new Error('Conversation settings debug: no authenticated user found.');
  }

  if (user.id !== input.userId) {
    throw new Error(
      `Conversation settings debug: user mismatch. auth user id=${user.id}, payload user id=${input.userId}.`,
    );
  }

  const nextTitle = input.title.trim();

  if (!nextTitle) {
    throw new Error('Group title cannot be empty.');
  }

  if (nextTitle.length > 80) {
    throw new Error('Group title can be up to 80 characters.');
  }

  const actingMembership = await getActiveGroupMembership(
    input.conversationId,
    input.userId,
  );

  if (!actingMembership) {
    throw new Error('You are no longer an active member of this group.');
  }

  if (!canEditGroupConversationIdentity(actingMembership.role)) {
    throw new Error('Only group admins can edit chat identity.');
  }

  const nextJoinPolicy =
    input.joinPolicy == null
      ? actingMembership.joinPolicy
      : normalizeGroupConversationJoinPolicy(input.joinPolicy);

  const existingConversationResponse = await supabase
    .from('conversations')
    .select('kind, avatar_path, join_policy')
    .eq('id', input.conversationId)
    .maybeSingle();

  let existingConversation = existingConversationResponse.data as
    | {
        kind?: string | null;
        avatar_path?: string | null;
        join_policy?: string | null;
      }
    | null;

  if (existingConversationResponse.error) {
    if (
      isMissingColumnErrorMessage(existingConversationResponse.error.message, 'avatar_path') ||
      isMissingColumnErrorMessage(existingConversationResponse.error.message, 'join_policy')
    ) {
      const fallbackConversationResponse = await supabase
        .from('conversations')
        .select('kind')
        .eq('id', input.conversationId)
        .maybeSingle();

      if (fallbackConversationResponse.error) {
        throw new Error(fallbackConversationResponse.error.message);
      }

      existingConversation = (fallbackConversationResponse.data as
        | {
            kind?: string | null;
          }
        | null) ?? null;
    } else {
      throw new Error(existingConversationResponse.error.message);
    }
  }

  if (!existingConversation || existingConversation.kind !== 'group') {
    throw new Error('Only group chats support editable chat identity.');
  }

  const conversationSupportsJoinPolicy = Object.prototype.hasOwnProperty.call(
    existingConversation,
    'join_policy',
  );

  if (!conversationSupportsJoinPolicy && nextJoinPolicy !== 'closed') {
    throw createSchemaRequirementError(
      'Group privacy settings require public.conversations.join_policy.',
    );
  }

  const existingAvatarPath = existingConversation.avatar_path?.trim() || null;
  const requestedAvatarObjectPath = input.avatarObjectPath?.trim() || null;
  const avatarFile = input.avatarFile && input.avatarFile.size > 0 ? input.avatarFile : null;
  const shouldRemoveAvatar =
    Boolean(input.removeAvatar) &&
    !requestedAvatarObjectPath &&
    !avatarFile;
  let nextAvatarPath: string | null | undefined;
  let uploadedAvatarObjectPath: string | null = null;

  if (requestedAvatarObjectPath) {
    if (
      !isManagedConversationAvatarUploadPathForUser(
        input.userId,
        input.conversationId,
        requestedAvatarObjectPath,
      )
    ) {
      throw new Error('Avatar upload path is invalid for this chat.');
    }

    uploadedAvatarObjectPath = requestedAvatarObjectPath;
    nextAvatarPath = requestedAvatarObjectPath;
  } else if (avatarFile) {
    if (avatarFile.size > PROFILE_AVATAR_MAX_SIZE_BYTES) {
      throw new Error('Avatar images can be up to 5 MB.');
    }

    if (!isSupportedProfileAvatarType(avatarFile.type)) {
      throw new Error('Avatar must be a JPG, PNG, WEBP, or GIF image.');
    }

    const serviceSupabase = createSupabaseServiceRoleClient();

    if (!serviceSupabase) {
      throw new Error('Chat avatar uploads are not available right now.');
    }

    const fileName = sanitizeProfileFileName(avatarFile.name);
    const objectPath = `conversations/${input.conversationId}/${crypto.randomUUID()}-${fileName}`;
    const { error: uploadError } = await serviceSupabase.storage
      .from(PROFILE_AVATAR_BUCKET)
      .upload(objectPath, avatarFile, {
        upsert: false,
        contentType: avatarFile.type,
      });

    if (uploadError) {
      if (isBucketNotFoundStorageErrorMessage(uploadError.message)) {
        throw new Error(getAvatarBucketRequirementErrorMessage());
      }

      throw new Error(uploadError.message);
    }

    uploadedAvatarObjectPath = objectPath;
    nextAvatarPath = objectPath;
  } else if (shouldRemoveAvatar) {
    nextAvatarPath = null;
  }

  const updatePayload = {
    title: nextTitle,
    ...(conversationSupportsJoinPolicy ? { join_policy: nextJoinPolicy } : {}),
    ...(nextAvatarPath !== undefined ? { avatar_path: nextAvatarPath } : {}),
  };

  const { error } = await writeSupabase
    .from('conversations')
    .update(updatePayload)
    .eq('id', input.conversationId)
    .eq('kind', 'group');

  if (error) {
    if (uploadedAvatarObjectPath) {
      await (createSupabaseServiceRoleClient() ?? supabase)
        .storage.from(PROFILE_AVATAR_BUCKET)
        .remove([uploadedAvatarObjectPath]);
    }

    if (isMissingColumnErrorMessage(error.message, 'avatar_path')) {
      throw createSchemaRequirementError(
        'Editable group avatars require public.conversations.avatar_path.',
      );
    }

    if (isMissingColumnErrorMessage(error.message, 'join_policy')) {
      throw createSchemaRequirementError(
        'Group privacy settings require public.conversations.join_policy.',
      );
    }

    if (error.message.includes('row-level security policy')) {
      throw new Error(
        'Conversation settings debug: identity update blocked by conversations RLS.',
      );
    }

    throw new Error(error.message);
  }

  if (
    existingAvatarPath &&
    isManagedConversationAvatarObjectPath(input.conversationId, existingAvatarPath) &&
    existingAvatarPath !== uploadedAvatarObjectPath &&
    (uploadedAvatarObjectPath || shouldRemoveAvatar)
  ) {
    await (createSupabaseServiceRoleClient() ?? supabase)
      .storage.from(PROFILE_AVATAR_BUCKET)
      .remove([existingAvatarPath]);
  }
}

export async function addParticipantsToGroupConversation(input: {
  conversationId: string;
  actingUserId: string;
  participantUserIds: string[];
}) {
  const supabase = await getRequestSupabaseServerClient();
  const writeSupabase = getGroupManagementWriteClient(supabase);

  await assertGroupConversationTarget({
    conversationId: input.conversationId,
    failureMessage: 'Direct messages are private and cannot add participants.',
    supabase,
  });

  if (!input.actingUserId) {
    throw new Error('Group management debug: authenticated member is required.');
  }

  const user = await requireRequestViewer('Group management debug');

  if (!user?.id) {
    throw new Error('Group management debug: no authenticated user found.');
  }

  if (user.id !== input.actingUserId) {
    throw new Error(
      `Group management debug: user mismatch. auth user id=${user.id}, payload user id=${input.actingUserId}.`,
    );
  }

  const actingMembership = await getActiveGroupMembership(
    input.conversationId,
    input.actingUserId,
  );

  if (!actingMembership) {
    throw new Error('You are no longer an active member of this group.');
  }

  if (
    !canAddParticipantsToGroupConversation(
      actingMembership.joinPolicy,
      actingMembership.role,
    )
  ) {
    throw new Error(
      actingMembership.joinPolicy === 'open'
        ? 'Only active group members can add people here.'
        : 'Only group admins can add people to a closed group.',
    );
  }

  const participantUserIds = dedupeParticipantIds(input.participantUserIds).filter(
    (participantUserId) => participantUserId !== input.actingUserId,
  );

  if (participantUserIds.length === 0) {
    throw new Error('Choose at least one participant to add.');
  }

  const { data: existingMemberships, error: membershipLookupError } = await writeSupabase
    .from('conversation_members')
    .select('user_id, state')
    .eq('conversation_id', input.conversationId)
    .in('user_id', participantUserIds);

  if (membershipLookupError) {
    throw new Error(membershipLookupError.message);
  }

  const existingByUserId = new Map(
    ((existingMemberships ?? []) as {
      user_id: string;
      state: string | null;
    }[]).map((row) => [row.user_id, row]),
  );
  const usersToReactivate = participantUserIds.filter((participantUserId) => {
    const existing = existingByUserId.get(participantUserId);
    return existing && existing.state !== 'active';
  });
  const usersToInsert = participantUserIds.filter(
    (participantUserId) => !existingByUserId.has(participantUserId),
  );

  if (usersToReactivate.length > 0) {
    const { error: reactivateError } = await writeSupabase
      .from('conversation_members')
      .update({
        state: 'active',
        role: 'member',
        last_read_message_seq: null,
        last_read_at: null,
      })
      .eq('conversation_id', input.conversationId)
      .in('user_id', usersToReactivate);

    if (reactivateError) {
      throw new Error(reactivateError.message);
    }
  }

  if (usersToInsert.length > 0) {
    const { error: insertError } = await writeSupabase
      .from('conversation_members')
      .insert(
        usersToInsert.map((participantUserId) => ({
          conversation_id: input.conversationId,
          user_id: participantUserId,
          role: 'member',
          state: 'active',
        })),
      );

    if (insertError) {
      throw new Error(insertError.message);
    }
  }
}

export async function removeParticipantFromGroupConversation(input: {
  conversationId: string;
  actingUserId: string;
  targetUserId: string;
}) {
  const supabase = await getRequestSupabaseServerClient();
  const writeSupabase = getGroupManagementWriteClient(supabase);

  await assertGroupConversationTarget({
    conversationId: input.conversationId,
    failureMessage: 'Only group chats can remove participants.',
    supabase,
  });

  if (!input.actingUserId) {
    throw new Error('Group management debug: authenticated member is required.');
  }

  const user = await requireRequestViewer('Group management debug');

  if (!user?.id) {
    throw new Error('Group management debug: no authenticated user found.');
  }

  if (user.id !== input.actingUserId) {
    throw new Error(
      `Group management debug: user mismatch. auth user id=${user.id}, payload user id=${input.actingUserId}.`,
    );
  }

  const actingMembership = await getActiveGroupMembership(
    input.conversationId,
    input.actingUserId,
  );

  if (!actingMembership) {
    throw new Error('You are no longer an active member of this group.');
  }

  if (!input.targetUserId) {
    throw new Error('Choose a participant to remove.');
  }

  if (input.targetUserId === input.actingUserId) {
    throw new Error('Use leave group to remove yourself from the conversation.');
  }

  const targetMembership = await getActiveGroupMembership(
    input.conversationId,
    input.targetUserId,
  );

  if (!targetMembership) {
    throw new Error('That participant is no longer active in this group.');
  }

  if (
    !canRemoveParticipantFromGroupConversation(
      actingMembership.role,
      targetMembership.role,
    )
  ) {
    throw new Error(
      targetMembership.role === 'owner'
        ? 'The current group owner cannot be removed here.'
        : 'Only group admins can remove that participant.',
    );
  }

  const { error: removeError } = await writeSupabase
    .from('conversation_members')
    .update({ state: 'removed' })
    .eq('conversation_id', input.conversationId)
    .eq('user_id', input.targetUserId)
    .eq('state', 'active');

  if (removeError) {
    throw new Error(removeError.message);
  }
}

export async function leaveGroupConversation(input: {
  conversationId: string;
  userId: string;
}) {
  const supabase = await getRequestSupabaseServerClient();
  const writeSupabase = getGroupManagementWriteClient(supabase);

  await assertGroupConversationTarget({
    conversationId: input.conversationId,
    failureMessage: 'Only group chats can use leave group.',
    supabase,
  });

  if (!input.userId) {
    throw new Error('Group leave debug: authenticated user is required.');
  }

  const user = await requireRequestViewer('Group leave debug');

  if (!user?.id) {
    throw new Error('Group leave debug: no authenticated user found.');
  }

  if (user.id !== input.userId) {
    throw new Error(
      `Group leave debug: user mismatch. auth user id=${user.id}, payload user id=${input.userId}.`,
    );
  }

  const actingMembership = await getActiveGroupMembership(
    input.conversationId,
    input.userId,
  );

  if (!actingMembership) {
    throw new Error('You are no longer an active member of this group.');
  }

  if (actingMembership.role === 'owner') {
    const { data: nextOwnerRows, error: nextOwnerError } = await writeSupabase
      .from('conversation_members')
      .select('user_id, role')
      .eq('conversation_id', input.conversationId)
      .eq('state', 'active')
      .neq('user_id', input.userId)
      .order('user_id', { ascending: true });

    if (nextOwnerError) {
      throw new Error(nextOwnerError.message);
    }

    const nextOwnerUserId = ((nextOwnerRows ?? []) as Array<{
      role?: string | null;
      user_id: string;
    }>)
      .sort((left, right) => {
        const leftPriority = left.role === 'admin' ? 0 : 1;
        const rightPriority = right.role === 'admin' ? 0 : 1;

        if (leftPriority !== rightPriority) {
          return leftPriority - rightPriority;
        }

        return left.user_id.localeCompare(right.user_id);
      })[0]?.user_id;

    if (nextOwnerUserId) {
      const { error: promoteError } = await writeSupabase
        .from('conversation_members')
        .update({ role: 'owner' })
        .eq('conversation_id', input.conversationId)
        .eq('user_id', nextOwnerUserId)
        .eq('state', 'active');

      if (promoteError) {
        throw new Error(promoteError.message);
      }
    }
  }

  const { error: leaveError } = await writeSupabase
    .from('conversation_members')
    .update({ state: 'left' })
    .eq('conversation_id', input.conversationId)
    .eq('user_id', input.userId)
    .eq('state', 'active');

  if (leaveError) {
    throw new Error(leaveError.message);
  }
}

async function insertCommittedMessageAssetAndLink(input: {
  assetKind: 'image' | 'file' | 'audio' | 'voice-note';
  client: MessageAssetsWriteClient;
  conversationId: string;
  durationMs: number | null;
  file: File;
  mimeType: string | null;
  messageId: string;
  objectPath: string;
  schemaRequirementErrorMessage: string;
  senderId: string;
}) {
  const isVoiceAsset = input.assetKind === 'voice-note';
  const normalizedDurationMs = isVoiceAsset
    ? normalizeVoiceDurationMs(input.durationMs)
    : null;

  if (isVoiceAsset) {
    logVoiceSendDiagnostics('message-assets-insert:started', {
      conversationId: input.conversationId,
      durationMs: normalizedDurationMs,
      fileName: sanitizeAttachmentFileName(input.file.name),
      messageId: input.messageId,
      mimeType: input.mimeType,
      objectPath: input.objectPath,
      sizeBytes: input.file.size,
    });
  }

  const { data: assetRow, error: assetError } = await input.client
    .from('message_assets')
    .insert({
      conversation_id: input.conversationId,
      created_by: input.senderId,
      duration_ms: normalizedDurationMs,
      file_name: sanitizeAttachmentFileName(input.file.name),
      kind: input.assetKind,
      mime_type: input.mimeType,
      size_bytes: input.file.size,
      source: 'supabase-storage',
      storage_bucket: CHAT_ATTACHMENT_BUCKET,
      storage_object_path: input.objectPath,
    })
    .select('id')
    .single();

  if (assetError) {
    if (isVoiceAsset) {
      logVoiceSendDiagnostics(
        'message-assets-insert:failed',
        {
          conversationId: input.conversationId,
          errorMessage: assetError.message,
          messageId: input.messageId,
          objectPath: input.objectPath,
        },
        'error',
      );
    }

    if (
      isMissingRelationErrorMessage(assetError.message, 'message_assets') ||
      isMissingColumnErrorMessage(assetError.message, 'storage_bucket') ||
      isMissingColumnErrorMessage(assetError.message, 'storage_object_path') ||
      (isVoiceAsset &&
        isMissingColumnErrorMessage(assetError.message, 'duration_ms'))
    ) {
      throw createSchemaRequirementError(input.schemaRequirementErrorMessage);
    }

    throw new Error(assetError.message);
  }

  const assetId = String(assetRow?.id ?? '').trim();

  if (!assetId) {
    throw new Error('Message asset insert did not return an asset id.');
  }

  if (isVoiceAsset) {
    logVoiceSendDiagnostics('message-assets-insert:completed', {
      assetId,
      conversationId: input.conversationId,
      messageId: input.messageId,
    });
    logVoiceSendDiagnostics('message-asset-links-insert:started', {
      assetId,
      conversationId: input.conversationId,
      messageId: input.messageId,
    });
  }

  const { error: linkError } = await input.client.from('message_asset_links').insert({
    asset_id: assetId,
    message_id: input.messageId,
    ordinal: 0,
    render_as_primary: true,
  });

  if (linkError) {
    const cleanupClient =
      (createSupabaseServiceRoleClient() ?? input.client) as MessageAssetsWriteClient;
    const { error: assetCleanupError } = await cleanupClient
      .from('message_assets')
      .delete()
      .eq('id', assetId);

    if (assetCleanupError && isVoiceAsset) {
      logVoiceSendDiagnostics(
        'message-assets-cleanup:failed',
        {
          assetId,
          conversationId: input.conversationId,
          errorMessage: assetCleanupError.message,
          messageId: input.messageId,
        },
        'error',
      );
    }

    if (isVoiceAsset) {
      logVoiceSendDiagnostics(
        'message-asset-links-insert:failed',
        {
          assetId,
          conversationId: input.conversationId,
          errorMessage: linkError.message,
          messageId: input.messageId,
        },
        'error',
      );
    }

    if (
      isMissingRelationErrorMessage(linkError.message, 'message_asset_links') ||
      isMissingColumnErrorMessage(linkError.message, 'render_as_primary')
    ) {
      throw createSchemaRequirementError(input.schemaRequirementErrorMessage);
    }

    throw new Error(linkError.message);
  }

  if (isVoiceAsset) {
    logVoiceSendDiagnostics('message-asset-links-insert:completed', {
      assetId,
      conversationId: input.conversationId,
      messageId: input.messageId,
    });
  }
}

export async function sendMessageWithAttachment(input: {
  conversationId: string;
  senderId: string;
  body?: string | null;
  replyToMessageId?: string | null;
  clientId?: string;
  file: File;
  voiceDurationMs?: number | null;
}) {
  if (!input.file || input.file.size === 0) {
    throw new Error('Choose a file before sending.');
  }

  if (input.file.size > CHAT_ATTACHMENT_MAX_SIZE_BYTES) {
    throw new Error('Attachments can be up to 10 MB in this first version.');
  }

  if (!isSupportedChatAttachmentType(input.file.type, input.file.name)) {
    throw new Error(CHAT_ATTACHMENT_HELP_TEXT);
  }

  const supabase = await createSupabaseServerClient();
  const serviceSupabase = createSupabaseServiceRoleClient();
  const storageClient =
    (serviceSupabase ?? supabase) as Awaited<
      ReturnType<typeof createSupabaseServerClient>
    >;
  const effectiveAttachmentMimeType = resolveMessagingAttachmentMimeType({
    fileName: input.file.name,
    mimeType: input.file.type,
  });
  const attachmentMessageKind = getAttachmentMessageKind(
    effectiveAttachmentMimeType,
  );
  const committedAssetKind = resolveMessagingAssetKindFromMimeType({
    fileName: input.file.name,
    messageKind: attachmentMessageKind,
    mimeType: effectiveAttachmentMimeType,
  });
  const isVoiceMessageSend = attachmentMessageKind === 'voice';
  const storageFolder =
    committedAssetKind === 'voice-note'
      ? 'voice'
      : committedAssetKind === 'image'
        ? 'images'
        : committedAssetKind === 'audio'
          ? 'audio'
          : 'files';

  if (isVoiceMessageSend) {
    logVoiceSendDiagnostics('send:start', {
      bucket: CHAT_ATTACHMENT_BUCKET,
      bucketUsedForUpload: CHAT_ATTACHMENT_BUCKET,
      bucketConfiguredNormalized:
        CHAT_ATTACHMENT_BUCKET_CONFIG.configuredBucketNormalized,
      bucketIgnoredPublic: CHAT_ATTACHMENT_BUCKET_CONFIG.ignoredPublicBucket,
      bucketRaw: CHAT_ATTACHMENT_BUCKET_CONFIG.rawBucket,
      bucketSource: CHAT_ATTACHMENT_BUCKET_CONFIG.source,
      conversationId: input.conversationId,
      fileName: sanitizeAttachmentFileName(input.file.name),
      mimeType: input.file.type,
      requestedClientId: input.clientId?.trim() || null,
      replyToMessageId: input.replyToMessageId ?? null,
      senderId: input.senderId,
      sizeBytes: input.file.size,
      storageClientType: serviceSupabase ? 'service-role' : 'request-auth',
      voiceDurationMs: normalizeVoiceDurationMs(input.voiceDurationMs ?? null),
    });
  }

  const messageResult = await createMessageRecord({
    conversationId: input.conversationId,
    senderId: input.senderId,
    body: input.body ?? null,
    clientId: input.clientId,
    replyToMessageId: input.replyToMessageId ?? null,
    touchConversation: false,
    kind: attachmentMessageKind,
  });

  if (isVoiceMessageSend) {
    logVoiceSendDiagnostics('message-commit:completed', {
      clientId: messageResult.clientId,
      conversationId: input.conversationId,
      messageId: messageResult.messageId,
      timestamp: messageResult.timestamp,
    });
  }

  const fileName = sanitizeAttachmentFileName(input.file.name);
  const objectPath = `${input.conversationId}/${messageResult.messageId}/${storageFolder}/${Date.now()}-${fileName}`;
  const fileBuffer = Buffer.from(await input.file.arrayBuffer());
  const cleanupFailedMessageShell = async (failureStage: string) => {
    const { error: messageCleanupError } = await storageClient
      .from('messages')
      .delete()
      .eq('id', messageResult.messageId)
      .eq('conversation_id', input.conversationId);

    if (messageCleanupError) {
      logVoiceSendDiagnostics(
        'cleanup:message-delete-failed',
        {
          clientId: messageResult.clientId,
          conversationId: input.conversationId,
          errorMessage: messageCleanupError.message,
          failureStage,
          messageId: messageResult.messageId,
        },
        'error',
      );
      return false;
    }

    logVoiceSendDiagnostics('cleanup:message-delete-completed', {
      clientId: messageResult.clientId,
      conversationId: input.conversationId,
      failureStage,
      messageId: messageResult.messageId,
    });
    return true;
  };
  const cleanupUploadedObject = async (failureStage: string) => {
    const { error: storageCleanupError } = await storageClient.storage
      .from(CHAT_ATTACHMENT_BUCKET)
      .remove([objectPath]);

    if (storageCleanupError) {
      logVoiceSendDiagnostics(
        'cleanup:object-remove-failed',
        {
          bucket: CHAT_ATTACHMENT_BUCKET,
          conversationId: input.conversationId,
          errorMessage: storageCleanupError.message,
          failureStage,
          messageId: messageResult.messageId,
          objectPath,
        },
        'error',
      );
      return false;
    }

    logVoiceSendDiagnostics('cleanup:object-remove-completed', {
      bucket: CHAT_ATTACHMENT_BUCKET,
      conversationId: input.conversationId,
      failureStage,
      messageId: messageResult.messageId,
      objectPath,
    });
    return true;
  };

  if (isVoiceMessageSend) {
    logVoiceSendDiagnostics('upload:started', {
      bucket: CHAT_ATTACHMENT_BUCKET,
      bucketUsedForUpload: CHAT_ATTACHMENT_BUCKET,
      bucketConfiguredNormalized:
        CHAT_ATTACHMENT_BUCKET_CONFIG.configuredBucketNormalized,
      bucketIgnoredPublic: CHAT_ATTACHMENT_BUCKET_CONFIG.ignoredPublicBucket,
      bucketRaw: CHAT_ATTACHMENT_BUCKET_CONFIG.rawBucket,
      bucketSource: CHAT_ATTACHMENT_BUCKET_CONFIG.source,
      conversationId: input.conversationId,
      messageId: messageResult.messageId,
      objectPath,
    });
  }

  const { error: uploadError } = await storageClient.storage
    .from(CHAT_ATTACHMENT_BUCKET)
    .upload(objectPath, fileBuffer, {
      cacheControl: '3600',
      contentType: effectiveAttachmentMimeType ?? undefined,
      upsert: false,
    });

  if (uploadError) {
    if (isVoiceMessageSend) {
      logVoiceSendDiagnostics(
        'upload:failed',
        {
          bucket: CHAT_ATTACHMENT_BUCKET,
          bucketUsedForUpload: CHAT_ATTACHMENT_BUCKET,
          bucketConfiguredNormalized:
            CHAT_ATTACHMENT_BUCKET_CONFIG.configuredBucketNormalized,
          bucketIgnoredPublic: CHAT_ATTACHMENT_BUCKET_CONFIG.ignoredPublicBucket,
          bucketRaw: CHAT_ATTACHMENT_BUCKET_CONFIG.rawBucket,
          bucketSource: CHAT_ATTACHMENT_BUCKET_CONFIG.source,
          clientId: messageResult.clientId,
          conversationId: input.conversationId,
          errorMessage: uploadError.message,
          messageId: messageResult.messageId,
          objectPath,
        },
        'error',
      );
    }
    await cleanupFailedMessageShell('upload');

    if (isBucketNotFoundStorageErrorMessage(uploadError.message)) {
      getChatAttachmentBucketRequirementErrorMessage();
      throw createSchemaRequirementError(
        `Chat attachment storage bucket \`${CHAT_ATTACHMENT_BUCKET}\` is missing.`,
      );
    }

    throw new Error(uploadError.message);
  }

  if (isVoiceMessageSend) {
    logVoiceSendDiagnostics('upload:completed', {
      bucket: CHAT_ATTACHMENT_BUCKET,
      bucketUsedForUpload: CHAT_ATTACHMENT_BUCKET,
      bucketConfiguredNormalized:
        CHAT_ATTACHMENT_BUCKET_CONFIG.configuredBucketNormalized,
      bucketIgnoredPublic: CHAT_ATTACHMENT_BUCKET_CONFIG.ignoredPublicBucket,
      bucketRaw: CHAT_ATTACHMENT_BUCKET_CONFIG.rawBucket,
      bucketSource: CHAT_ATTACHMENT_BUCKET_CONFIG.source,
      conversationId: input.conversationId,
      messageId: messageResult.messageId,
      objectPath,
    });
  }

  const assetCommitError = await (async () => {
    try {
      if (isVoiceMessageSend) {
        logVoiceSendDiagnostics('asset-link-commit:started', {
          conversationId: input.conversationId,
          messageId: messageResult.messageId,
          objectPath,
        });
      }

      await insertCommittedMessageAssetAndLink({
        assetKind: committedAssetKind,
        client: supabase,
        conversationId: input.conversationId,
        durationMs: input.voiceDurationMs ?? null,
        file: input.file,
        mimeType: effectiveAttachmentMimeType,
        messageId: messageResult.messageId,
        objectPath,
        schemaRequirementErrorMessage: isVoiceMessageSend
          ? 'Voice message media schema is missing.'
          : 'Chat media asset schema is missing.',
        senderId: input.senderId,
      });

      if (isVoiceMessageSend) {
        logVoiceSendDiagnostics('asset-link-commit:completed', {
          conversationId: input.conversationId,
          messageId: messageResult.messageId,
        });
      }

      return null;
    } catch (error) {
      if (isVoiceMessageSend) {
        logVoiceSendDiagnostics(
          'asset-link-commit:failed',
          {
            conversationId: input.conversationId,
            errorMessage:
              error instanceof Error ? error.message : String(error),
            messageId: messageResult.messageId,
          },
          'error',
        );
      }

      return error instanceof Error ? error : new Error('Unknown media asset error');
    }
  })();

  if (assetCommitError) {
    if (isVoiceMessageSend) {
      logVoiceSendDiagnostics(
        'send:rollback-after-attachment-failure',
        {
          bucket: CHAT_ATTACHMENT_BUCKET,
          clientId: messageResult.clientId,
          conversationId: input.conversationId,
          errorMessage: assetCommitError.message,
          messageId: messageResult.messageId,
          objectPath,
        },
        'error',
      );
    }
    await cleanupUploadedObject('attachment-metadata');
    await cleanupFailedMessageShell('attachment-metadata');
    throw assetCommitError;
  }

  await syncConversationSummaryProjectionByMessageId(
    supabase,
    input.conversationId,
    messageResult.messageId,
  );

  if (isVoiceMessageSend) {
    logVoiceSendDiagnostics('summary-sync:completed', {
      conversationId: input.conversationId,
      messageId: messageResult.messageId,
    });
    logVoiceSendDiagnostics('send:completed', {
      clientId: messageResult.clientId,
      conversationId: input.conversationId,
      messageId: messageResult.messageId,
      timestamp: messageResult.timestamp,
    });
  }

  return messageResult;
}
