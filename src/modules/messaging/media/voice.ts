import type {
  MessagingMediaAssetRecord,
  MessagingVoiceMessageStage,
} from './types';
import type { MessagingMessageContentMode } from './message-metadata';
import type { MessagingVoicePlaybackSourceOption } from './message-assets';

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

export type MessagingVoiceDevicePlaybackSupportStatus =
  | 'supported'
  | 'unknown'
  | 'unsupported';

export type MessagingVoiceBlobPlaybackRisk = {
  bypassLocalBlobPlayback: boolean;
  fileExtension: string | null;
  platform: 'other' | 'webkit-mobile';
  reason: 'webkit-mobile-opus-container' | null;
};

export type MessagingVoiceCaptureMimeType =
  | 'audio/mp4'
  | 'audio/ogg;codecs=opus'
  | 'audio/webm'
  | 'audio/webm;codecs=opus';

export type MessagingVoiceCaptureMimeResolution = {
  mimePreferenceOrder: readonly MessagingVoiceCaptureMimeType[];
  platform: 'other' | 'webkit-mobile';
  selectedMimeType: MessagingVoiceCaptureMimeType | null;
};

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

const CHROMIUM_FRIENDLY_VOICE_CAPTURE_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus',
] as const satisfies readonly MessagingVoiceCaptureMimeType[];

const WEBKIT_FRIENDLY_VOICE_CAPTURE_MIME_TYPES = [
  'audio/mp4',
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
] as const satisfies readonly MessagingVoiceCaptureMimeType[];

function resolveMessagingVoiceClientPlatform(input: {
  maxTouchPoints?: number | null;
  userAgent?: string | null;
  vendor?: string | null;
}) {
  const normalizedUserAgent = input.userAgent?.trim().toLowerCase() || '';
  const normalizedVendor = input.vendor?.trim().toLowerCase() || '';
  const maxTouchPoints =
    typeof input.maxTouchPoints === 'number' ? input.maxTouchPoints : 0;
  const looksLikeAppleMobileBrowser =
    /iphone|ipad|ipod/.test(normalizedUserAgent) ||
    (/macintosh/.test(normalizedUserAgent) &&
      normalizedVendor.includes('apple') &&
      maxTouchPoints > 1);
  const looksLikeWebKit = normalizedUserAgent.includes('applewebkit');

  return looksLikeAppleMobileBrowser && looksLikeWebKit
    ? 'webkit-mobile'
    : 'other';
}

export function classifyMessagingVoiceDevicePlaybackSupport(input: {
  canPlayType: 'maybe' | 'no' | 'probably' | null;
  mediaCapabilitiesSupported: boolean | null;
}): MessagingVoiceDevicePlaybackSupportStatus {
  if (
    input.mediaCapabilitiesSupported === false ||
    (input.mediaCapabilitiesSupported !== true && input.canPlayType === 'no')
  ) {
    return 'unsupported';
  }

  if (
    input.mediaCapabilitiesSupported === true ||
    input.canPlayType === 'probably' ||
    input.canPlayType === 'maybe'
  ) {
    return 'supported';
  }

  return 'unknown';
}

export function resolveMessagingVoicePlaybackSourcePreference(input: {
  origin: MessagingVoicePlaybackSourceOption['origin'];
  supportStatus: MessagingVoiceDevicePlaybackSupportStatus;
}) {
  const supportPriority =
    input.supportStatus === 'supported'
      ? 0
      : input.supportStatus === 'unknown'
        ? 1
        : 2;
  const sourcePriority =
    input.supportStatus === 'supported'
      ? input.origin === 'derived'
        ? 0
        : 1
      : input.origin === 'original'
        ? 0
        : 1;

  return {
    sourcePriority,
    supportPriority,
  };
}

function resolveMessagingVoiceFileExtension(fileName: string | null | undefined) {
  const normalizedFileName = fileName?.trim().toLowerCase() || '';

  if (!normalizedFileName) {
    return null;
  }

  const extensionIndex = normalizedFileName.lastIndexOf('.');

  if (
    extensionIndex < 0 ||
    extensionIndex === normalizedFileName.length - 1
  ) {
    return null;
  }

  return normalizedFileName.slice(extensionIndex);
}

export function resolveMessagingVoiceCaptureMimeType(input: {
  isTypeSupported: (candidate: MessagingVoiceCaptureMimeType) => boolean;
  maxTouchPoints?: number | null;
  userAgent?: string | null;
  vendor?: string | null;
}): MessagingVoiceCaptureMimeResolution {
  const platform = resolveMessagingVoiceClientPlatform(input);
  const mimePreferenceOrder =
    platform === 'webkit-mobile'
      ? WEBKIT_FRIENDLY_VOICE_CAPTURE_MIME_TYPES
      : CHROMIUM_FRIENDLY_VOICE_CAPTURE_MIME_TYPES;

  return {
    mimePreferenceOrder,
    platform,
    selectedMimeType:
      mimePreferenceOrder.find((candidate) => input.isTypeSupported(candidate)) ??
      null,
  };
}

export function resolveMessagingVoiceBlobPlaybackRisk(input: {
  fileName: string | null;
  maxTouchPoints?: number | null;
  mimeType: string | null;
  userAgent?: string | null;
  vendor?: string | null;
}): MessagingVoiceBlobPlaybackRisk {
  const normalizedMimeType = input.mimeType?.trim().toLowerCase() || null;
  const fileExtension = resolveMessagingVoiceFileExtension(input.fileName);
  const platform = resolveMessagingVoiceClientPlatform(input);
  const looksLikeRiskyOpusContainer = Boolean(
    normalizedMimeType &&
      (normalizedMimeType.includes('webm') ||
        normalizedMimeType.includes('opus')),
  );
  const looksLikeRiskyExtension =
    fileExtension === '.webm' || fileExtension === '.opus';
  const bypassLocalBlobPlayback = Boolean(
    platform === 'webkit-mobile' &&
      (looksLikeRiskyOpusContainer || looksLikeRiskyExtension),
  );

  return {
    bypassLocalBlobPlayback,
    fileExtension,
    platform,
    reason: bypassLocalBlobPlayback ? 'webkit-mobile-opus-container' : null,
  };
}

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
