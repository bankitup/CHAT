import type {
  MessagingMediaAssetRecord,
  MessagingVoiceMessageStage,
} from './types';
import type { MessagingMessageContentMode } from './message-metadata';

export type MessagingVoiceCaptureState =
  | 'idle'
  | 'requesting-permission'
  | 'recording'
  | 'paused'
  | 'stopped'
  | 'failed'
  | 'cancelled';

export type MessagingVoicePlaybackState =
  | 'idle'
  | 'buffering'
  | 'playing'
  | 'paused'
  | 'ended'
  | 'failed';

export type MessagingVoiceMessageDraftRecord = {
  blobUrl: string | null;
  clientDraftId: string;
  contentMode: MessagingMessageContentMode;
  conversationId: string;
  createdAt: string;
  durationMs: number | null;
  fileName: string | null;
  mimeType: string | null;
  replyToMessageId: string | null;
  sizeBytes: number | null;
  stage: MessagingVoiceMessageStage;
  waveformPeaks: number[] | null;
};

export type MessagingVoiceMessageCommitIntent = {
  clientMessageId: string | null;
  conversationId: string;
  currentUserId: string;
  draftId: string;
  durationMs: number | null;
  fileName: string;
  mimeType: string | null;
  replyToMessageId: string | null;
  sizeBytes: number | null;
};

export type MessagingVoiceThreadPlaybackSnapshot = {
  asset: Pick<
    MessagingMediaAssetRecord,
    'assetId' | 'durationMs' | 'fileName' | 'kind' | 'mimeType' | 'objectPath'
  >;
  autoplayBlocked: boolean;
  messageId: string;
  playbackState: MessagingVoicePlaybackState;
  progressMs: number;
};

export type MessagingVoiceMessageSummaryProjection = {
  durationMs: number | null;
  kind: 'voice';
  messageId: string | null;
};

export type MessagingVoiceComposerRuntime = {
  cancelDraft(draftId: string): Promise<void>;
  createDraft(input: {
    contentMode?: MessagingMessageContentMode;
    conversationId: string;
    replyToMessageId?: string | null;
  }): Promise<MessagingVoiceMessageDraftRecord>;
  getDraftSnapshot(conversationId: string): MessagingVoiceMessageDraftRecord[];
  subscribe(conversationId: string, listener: () => void): () => void;
};

export function isMessagingVoiceDraftTerminal(
  stage: MessagingVoiceMessageStage,
) {
  return (
    stage === 'committed' ||
    stage === 'failed' ||
    stage === 'cancelled'
  );
}

export function isMessagingVoicePlaybackActive(
  playbackState: MessagingVoicePlaybackState,
) {
  return playbackState === 'buffering' || playbackState === 'playing';
}
