import type {
  MessagingCommittedMediaAttachment,
  MessagingMediaAssetKind,
  MessagingVoiceMessageStage,
} from './types';

export type MessagingMediaUploadJobKind =
  | 'message-attachment'
  | 'voice-message';

export type MessagingMediaUploadJobStatus =
  | 'queued'
  | 'preparing'
  | 'uploading'
  | 'uploaded'
  | 'committing'
  | 'committed'
  | 'failed'
  | 'cancelled';

export type MessagingMediaUploadFailureCode =
  | 'file-too-large'
  | 'unsupported-type'
  | 'upload-auth-failed'
  | 'upload-network-failed'
  | 'metadata-commit-failed'
  | 'message-commit-failed'
  | 'local-aborted'
  | 'unknown';

export type MessagingMediaUploadIntent = {
  clientUploadId: string;
  conversationId: string;
  fileName: string;
  jobKind: MessagingMediaUploadJobKind;
  kind: MessagingMediaAssetKind;
  mimeType: string | null;
  replyToMessageId: string | null;
  sizeBytes: number | null;
};

export type MessagingMediaUploadJobRecord = {
  assetId: string | null;
  clientUploadId: string;
  committedAttachment: MessagingCommittedMediaAttachment | null;
  conversationId: string;
  createdAt: string;
  errorCode: MessagingMediaUploadFailureCode | null;
  errorMessage: string | null;
  kind: MessagingMediaUploadJobKind;
  messageId: string | null;
  progressPercent: number | null;
  startedAt: string | null;
  status: MessagingMediaUploadJobStatus;
  updatedAt: string;
  voiceStage: MessagingVoiceMessageStage | null;
};

export type MessagingMediaUploadMutationResult = {
  job: MessagingMediaUploadJobRecord;
  ok: boolean;
};

export type MessagingMediaUploadRuntime = {
  cancel(jobId: string): Promise<void>;
  getSnapshot(conversationId: string): MessagingMediaUploadJobRecord[];
  prepare(intent: MessagingMediaUploadIntent): Promise<MessagingMediaUploadJobRecord>;
  retry(jobId: string): Promise<MessagingMediaUploadJobRecord>;
  subscribe(conversationId: string, listener: () => void): () => void;
};

export function isMessagingMediaUploadTerminalStatus(
  status: MessagingMediaUploadJobStatus,
) {
  return (
    status === 'committed' ||
    status === 'failed' ||
    status === 'cancelled'
  );
}

export function shouldPatchThreadFromMediaCommit(
  job: Pick<MessagingMediaUploadJobRecord, 'messageId' | 'status'>,
) {
  return job.status === 'committed' && Boolean(job.messageId);
}
