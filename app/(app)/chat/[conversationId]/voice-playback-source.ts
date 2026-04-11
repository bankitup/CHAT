import {
  resolveMessagingAttachmentMimeType,
  type MessagingVoicePlaybackSourceOption,
} from '@/modules/messaging/media/message-assets';
import {
  classifyMessagingVoiceDevicePlaybackSupport,
  resolveMessagingVoicePlaybackSourcePreference,
} from '@/modules/messaging/media/voice';

const THREAD_VOICE_PLAYBACK_CACHE_MAX_ENTRIES = 120;

export type ThreadVoicePlaybackAttachmentDescriptor = {
  bucket?: string | null;
  durationMs?: number | null;
  id?: string | null;
  messageId?: string | null;
  objectPath?: string | null;
};

export type ThreadVoicePlaybackCacheEntry = {
  durationMs: number | null;
  playbackUrl: string | null;
  sessionReady: boolean;
  sourceUrl: string | null;
  warmed: boolean;
};

export type ThreadVoicePlaybackSourceSnapshot = {
  cacheKey: string | null;
  cachedDurationMs: number | null;
  localPlaybackUrl: string | null;
  selectedSourceId: string | null;
  shouldHydratePreparedPlayback: boolean;
  transportSourceUrl: string | null;
};

export type ThreadVoiceTransportSourceLocator = {
  attachmentId: string | null;
  conversationId: string | null;
  messageId: string | null;
};

export type ThreadVoiceTransportSourceResolution =
  | {
      status: 'failed' | 'skipped';
      transportSourceUrl: null;
    }
  | {
      status: 'resolved';
      transportSourceUrl: string | null;
    };

export type ThreadVoicePreparedPlaybackSource = {
  playbackSourceUrl: string | null;
  selectedPlaybackSource: MessagingVoicePlaybackSourceOption | null;
  status: ThreadVoiceTransportSourceResolution['status'];
  transportSourceUrl: string | null;
};

export type ThreadVoiceDevicePlaybackSupport = {
  canPlayType: 'maybe' | 'no' | 'probably' | null;
  mediaCapabilitiesPowerEfficient: boolean | null;
  mediaCapabilitiesSmooth: boolean | null;
  mediaCapabilitiesSupported: boolean | null;
  mimeType: string | null;
  status: 'supported' | 'unknown' | 'unsupported';
};

export type ThreadVoicePreferredPlaybackSourceResolution = {
  playbackSource: MessagingVoicePlaybackSourceOption | null;
  playbackSupport: ThreadVoiceDevicePlaybackSupport;
};

type ThreadVoiceTransportSourceResolver = (input: {
  transportSourceUrl: string;
}) => Promise<Blob | string | null>;

type ThreadVoiceSourceDiagnosticLogger = (
  stage: string,
  details: Record<string, unknown>,
) => void;

const threadVoicePlaybackCache = new Map<string, ThreadVoicePlaybackCacheEntry>();
const threadVoicePlaybackWarmPromises = new Map<string, Promise<string | null>>();

function normalizeThreadVoicePlaybackSourceUrl(value: string | null | undefined) {
  const normalizedValue = value?.trim() || '';
  return normalizedValue || null;
}

function buildLegacyThreadVoicePlaybackSources(input: {
  attachment: ThreadVoicePlaybackAttachmentDescriptor | null;
  messageId: string;
  transportSourceUrl: string | null;
}): MessagingVoicePlaybackSourceOption[] {
  if (!input.attachment) {
    return [];
  }

  const assetId =
    typeof input.attachment.id === 'string' ? input.attachment.id.trim() : '';
  const storageObjectPath =
    typeof input.attachment.objectPath === 'string'
      ? input.attachment.objectPath.trim()
      : '';

  if (!assetId && !storageObjectPath && !input.transportSourceUrl) {
    return [];
  }

  return [
    {
      assetId: assetId || null,
      durationMs: input.attachment.durationMs ?? null,
      fileName: null,
      mimeType: null,
      origin: 'original',
      role: 'original-capture',
      source: null,
      sourceId: ['legacy-original', assetId || 'asset-missing', storageObjectPath || 'object-missing']
        .join(':'),
      storageBucket:
        typeof input.attachment.bucket === 'string'
          ? input.attachment.bucket.trim() || null
          : null,
      storageObjectPath: storageObjectPath || null,
      transportSourceUrl: input.transportSourceUrl,
    },
  ];
}

function orderThreadVoicePlaybackSources(input: {
  playbackSources?: readonly MessagingVoicePlaybackSourceOption[] | null;
  preferredSourceId?: string | null;
}) {
  const preferredSourceId = input.preferredSourceId?.trim() || null;
  const dedupedSources = new Map<string, MessagingVoicePlaybackSourceOption>();

  for (const source of input.playbackSources ?? []) {
    if (!source.sourceId || dedupedSources.has(source.sourceId)) {
      continue;
    }

    dedupedSources.set(source.sourceId, source);
  }

  const orderedSources = Array.from(dedupedSources.values());

  if (!preferredSourceId) {
    return orderedSources;
  }

  const preferredSourceIndex = orderedSources.findIndex(
    (source) => source.sourceId === preferredSourceId,
  );

  if (preferredSourceIndex < 1) {
    return orderedSources;
  }

  const [preferredSource] = orderedSources.splice(preferredSourceIndex, 1);
  orderedSources.unshift(preferredSource);
  return orderedSources;
}

function getThreadVoicePlaybackCacheKeyForSource(input: {
  messageId: string;
  playbackSource: MessagingVoicePlaybackSourceOption;
}) {
  return getThreadVoicePlaybackCacheKey({
    attachment: {
      bucket: input.playbackSource.storageBucket,
      durationMs: input.playbackSource.durationMs ?? null,
      id: input.playbackSource.assetId,
      messageId: input.messageId,
      objectPath: input.playbackSource.storageObjectPath,
    },
    messageId: input.messageId,
  });
}

function resolveThreadVoicePlaybackSupportPriority(input: {
  playbackSource: MessagingVoicePlaybackSourceOption;
  playbackSupport: ThreadVoiceDevicePlaybackSupport;
}) {
  const { sourcePriority, supportPriority } =
    resolveMessagingVoicePlaybackSourcePreference({
      origin: input.playbackSource.origin,
      supportStatus: input.playbackSupport.status,
    });

  return [supportPriority, sourcePriority, input.playbackSource.sourceId] as const;
}

function looksLikeUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export function configureInlineAudioElement(audio: HTMLAudioElement | null) {
  if (!audio) {
    return;
  }

  audio.setAttribute('playsinline', '');
  audio.setAttribute('webkit-playsinline', '');
  audio.setAttribute('disableremoteplayback', '');
  audio.setAttribute('x-webkit-airplay', 'deny');
}

export async function resolveThreadVoiceDevicePlaybackSupport(input: {
  audio: HTMLAudioElement | null;
  mimeType: string | null;
}): Promise<ThreadVoiceDevicePlaybackSupport> {
  const normalizedMimeType = input.mimeType?.trim().toLowerCase() || null;

  if (
    !input.audio ||
    !normalizedMimeType ||
    typeof input.audio.canPlayType !== 'function'
  ) {
    return {
      canPlayType: null,
      mediaCapabilitiesPowerEfficient: null,
      mediaCapabilitiesSmooth: null,
      mediaCapabilitiesSupported: null,
      mimeType: normalizedMimeType,
      status: 'unknown',
    };
  }

  const canPlayTypeResult = input.audio.canPlayType(normalizedMimeType);
  const canPlayType = canPlayTypeResult
    ? (canPlayTypeResult as 'maybe' | 'probably')
    : 'no';
  let mediaCapabilitiesSupported: boolean | null = null;
  let mediaCapabilitiesSmooth: boolean | null = null;
  let mediaCapabilitiesPowerEfficient: boolean | null = null;

  if (
    typeof navigator !== 'undefined' &&
    'mediaCapabilities' in navigator &&
    navigator.mediaCapabilities &&
    typeof navigator.mediaCapabilities.decodingInfo === 'function'
  ) {
    try {
      const decodingInfo = await navigator.mediaCapabilities.decodingInfo({
        audio: {
          contentType: normalizedMimeType,
        },
        type: 'file',
      });

      mediaCapabilitiesSupported = decodingInfo.supported;
      mediaCapabilitiesSmooth = decodingInfo.smooth;
      mediaCapabilitiesPowerEfficient = decodingInfo.powerEfficient;
    } catch {
      mediaCapabilitiesSupported = null;
      mediaCapabilitiesSmooth = null;
      mediaCapabilitiesPowerEfficient = null;
    }
  }

  const status = classifyMessagingVoiceDevicePlaybackSupport({
    canPlayType,
    mediaCapabilitiesSupported,
  });

  return {
    canPlayType,
    mediaCapabilitiesPowerEfficient,
    mediaCapabilitiesSmooth,
    mediaCapabilitiesSupported,
    mimeType: normalizedMimeType,
    status,
  };
}

export async function resolveThreadVoicePreferredPlaybackSource(input: {
  audio: HTMLAudioElement | null;
  playbackSources?: readonly MessagingVoicePlaybackSourceOption[] | null;
  preferredSourceId?: string | null;
}): Promise<ThreadVoicePreferredPlaybackSourceResolution> {
  const orderedSources = orderThreadVoicePlaybackSources({
    playbackSources: input.playbackSources,
    preferredSourceId: input.preferredSourceId,
  });

  if (orderedSources.length === 0) {
    return {
      playbackSource: null,
      playbackSupport: {
        canPlayType: null,
        mediaCapabilitiesPowerEfficient: null,
        mediaCapabilitiesSmooth: null,
        mediaCapabilitiesSupported: null,
        mimeType: null,
        status: 'unknown',
      },
    };
  }

  if (input.preferredSourceId) {
    const preferredSource = orderedSources[0] ?? null;
    const preferredMimeType = preferredSource
      ? resolveMessagingAttachmentMimeType({
          fileName: preferredSource.fileName,
          mimeType: preferredSource.mimeType,
        })
      : null;

    return {
      playbackSource: preferredSource,
      playbackSupport: await resolveThreadVoiceDevicePlaybackSupport({
        audio: input.audio,
        mimeType: preferredMimeType,
      }),
    };
  }

  const evaluatedSources = await Promise.all(
    orderedSources.map(async (playbackSource) => {
      const playbackMimeType = resolveMessagingAttachmentMimeType({
        fileName: playbackSource.fileName,
        mimeType: playbackSource.mimeType,
      });

      return {
        playbackSource,
        playbackSupport: await resolveThreadVoiceDevicePlaybackSupport({
          audio: input.audio,
          mimeType: playbackMimeType,
        }),
      };
    }),
  );

  evaluatedSources.sort((left, right) => {
    const leftPriority = resolveThreadVoicePlaybackSupportPriority(left);
    const rightPriority = resolveThreadVoicePlaybackSupportPriority(right);

    for (let index = 0; index < leftPriority.length; index += 1) {
      const leftValue = leftPriority[index];
      const rightValue = rightPriority[index];

      if (leftValue < rightValue) {
        return -1;
      }

      if (leftValue > rightValue) {
        return 1;
      }
    }

    return 0;
  });

  const selectedSource = evaluatedSources[0];

  return {
    playbackSource: selectedSource?.playbackSource ?? null,
    playbackSupport: selectedSource?.playbackSupport ?? {
      canPlayType: null,
      mediaCapabilitiesPowerEfficient: null,
      mediaCapabilitiesSmooth: null,
      mediaCapabilitiesSupported: null,
      mimeType: null,
      status: 'unknown',
    },
  };
}

export function getThreadVoicePlaybackCacheKey(input: {
  attachment: ThreadVoicePlaybackAttachmentDescriptor | null;
  messageId: string;
}) {
  const objectPath =
    typeof input.attachment?.objectPath === 'string'
      ? input.attachment.objectPath.trim()
      : '';

  if (objectPath) {
    // Prefer the stable storage locator so the same committed voice keeps its
    // warmed/session-ready cache across thread re-entry even if attachment row
    // projection details shift.
    return `${input.messageId}:${objectPath}`;
  }

  const attachmentId =
    typeof input.attachment?.id === 'string' ? input.attachment.id.trim() : '';

  if (attachmentId) {
    return attachmentId;
  }

  return input.messageId;
}

export function hasRecoverableThreadVoicePlaybackLocator(input: {
  attachment: ThreadVoicePlaybackAttachmentDescriptor | null;
  expectedMessageId?: string | null;
}) {
  const attachmentId =
    typeof input.attachment?.id === 'string' ? input.attachment.id.trim() : '';
  const attachmentMessageId =
    typeof input.attachment?.messageId === 'string'
      ? input.attachment.messageId.trim()
      : '';
  const bucket =
    typeof input.attachment?.bucket === 'string'
      ? input.attachment.bucket.trim()
      : '';
  const objectPath =
    typeof input.attachment?.objectPath === 'string'
      ? input.attachment.objectPath.trim()
      : '';
  const normalizedExpectedMessageId =
    typeof input.expectedMessageId === 'string' ? input.expectedMessageId.trim() : '';

  if (!attachmentId || !attachmentMessageId || !bucket || !objectPath) {
    return false;
  }

  if (
    normalizedExpectedMessageId &&
    attachmentMessageId !== normalizedExpectedMessageId
  ) {
    return false;
  }

  return true;
}

export function buildThreadVoiceTransportResolveUrl(
  input: ThreadVoiceTransportSourceLocator,
) {
  if (!input.attachmentId || !input.conversationId || !input.messageId) {
    return null;
  }

  if (
    !looksLikeUuid(input.attachmentId) ||
    !looksLikeUuid(input.conversationId) ||
    !looksLikeUuid(input.messageId)
  ) {
    return null;
  }

  return `/api/messaging/conversations/${input.conversationId}/messages/${input.messageId}/attachments/${input.attachmentId}/signed-url`;
}

function readThreadVoicePlaybackCacheEntry(key: string | null) {
  if (!key) {
    return null;
  }

  return threadVoicePlaybackCache.get(key) ?? null;
}

function resolvePreferredLocalThreadVoicePlaybackUrl(input: {
  cacheEntry: ThreadVoicePlaybackCacheEntry | null;
  transportSourceUrl: string | null;
}) {
  if (
    input.cacheEntry?.warmed &&
    input.cacheEntry.playbackUrl?.startsWith('blob:')
  ) {
    // The player consumes a local playable source URL. Today this is a warmed
    // plaintext blob; later encrypted voice can provide a decrypted object URL
    // through the same boundary without changing the audio UI again.
    return input.cacheEntry.playbackUrl;
  }

  return input.transportSourceUrl ?? input.cacheEntry?.playbackUrl ?? null;
}

export function resolveThreadVoicePlaybackSourceSnapshot(input: {
  attachment: ThreadVoicePlaybackAttachmentDescriptor | null;
  ignoredTransportSourceUrl?: string | null;
  messageId: string;
  playbackSources?: readonly MessagingVoicePlaybackSourceOption[] | null;
  preferredSourceId?: string | null;
  transportSourceUrl: string | null;
}): ThreadVoicePlaybackSourceSnapshot {
  const normalizedIgnoredTransportSourceUrl =
    typeof input.ignoredTransportSourceUrl === 'string' &&
    input.ignoredTransportSourceUrl.trim()
      ? input.ignoredTransportSourceUrl.trim()
      : null;
  const normalizedPlaybackSources =
    orderThreadVoicePlaybackSources({
      playbackSources:
        input.playbackSources && input.playbackSources.length > 0
          ? input.playbackSources
          : buildLegacyThreadVoicePlaybackSources({
              attachment: input.attachment,
              messageId: input.messageId,
              transportSourceUrl: normalizeThreadVoicePlaybackSourceUrl(
                input.transportSourceUrl,
              ),
            }),
      preferredSourceId: input.preferredSourceId,
    }) ?? [];
  const selectedPlaybackSource = normalizedPlaybackSources[0] ?? null;
  const cacheKey = selectedPlaybackSource
    ? getThreadVoicePlaybackCacheKeyForSource({
        messageId: input.messageId,
        playbackSource: selectedPlaybackSource,
      })
    : getThreadVoicePlaybackCacheKey({
        attachment: input.attachment,
        messageId: input.messageId,
      });
  const cacheEntry = readThreadVoicePlaybackCacheEntry(cacheKey);
  const requestedTransportSourceUrl = selectedPlaybackSource
    ? normalizeThreadVoicePlaybackSourceUrl(
        selectedPlaybackSource.transportSourceUrl,
      )
    : normalizeThreadVoicePlaybackSourceUrl(input.transportSourceUrl);
  const cacheTransportSourceUrl =
    cacheEntry?.sourceUrl &&
    cacheEntry.sourceUrl !== normalizedIgnoredTransportSourceUrl
      ? cacheEntry.sourceUrl
      : null;
  const transportSourceUrl =
    requestedTransportSourceUrl &&
    requestedTransportSourceUrl !== normalizedIgnoredTransportSourceUrl
      ? requestedTransportSourceUrl
      : cacheTransportSourceUrl;
  const localPlaybackUrl = resolvePreferredLocalThreadVoicePlaybackUrl({
    cacheEntry,
    transportSourceUrl,
  });

  return {
    cacheKey,
    cachedDurationMs:
      cacheEntry?.durationMs ??
      selectedPlaybackSource?.durationMs ??
      input.attachment?.durationMs ??
      null,
    localPlaybackUrl,
    selectedSourceId: selectedPlaybackSource?.sourceId ?? null,
    shouldHydratePreparedPlayback: Boolean(
      localPlaybackUrl && (cacheEntry?.warmed || cacheEntry?.sessionReady),
    ),
    transportSourceUrl,
  };
}

export function writeThreadVoicePlaybackCacheEntry(
  key: string | null,
  patch: Partial<ThreadVoicePlaybackCacheEntry>,
) {
  if (!key) {
    return;
  }

  const currentEntry = threadVoicePlaybackCache.get(key);
  const requestedPlaybackUrl = patch.playbackUrl ?? currentEntry?.playbackUrl ?? null;
  const requestedSourceUrl = patch.sourceUrl ?? currentEntry?.sourceUrl ?? null;
  const shouldPreserveWarmBlobPlaybackUrl = Boolean(
    currentEntry?.warmed &&
      currentEntry.playbackUrl?.startsWith('blob:') &&
      (!patch.playbackUrl || !patch.playbackUrl.startsWith('blob:')) &&
      requestedSourceUrl &&
      currentEntry.sourceUrl === requestedSourceUrl,
  );
  const shouldPreserveSessionReady = Boolean(
    currentEntry?.sessionReady &&
      patch.sessionReady !== false &&
      requestedSourceUrl &&
      currentEntry.sourceUrl === requestedSourceUrl,
  );
  const nextEntry: ThreadVoicePlaybackCacheEntry = {
    durationMs: patch.durationMs ?? currentEntry?.durationMs ?? null,
    playbackUrl: shouldPreserveWarmBlobPlaybackUrl
      ? currentEntry?.playbackUrl ?? null
      : requestedPlaybackUrl,
    sessionReady: shouldPreserveSessionReady
      ? true
      : patch.sessionReady ?? currentEntry?.sessionReady ?? false,
    sourceUrl: requestedSourceUrl,
    warmed: shouldPreserveWarmBlobPlaybackUrl
      ? true
      : patch.warmed ?? currentEntry?.warmed ?? false,
  };

  if (
    nextEntry.durationMs === null &&
    nextEntry.playbackUrl === null &&
    nextEntry.sourceUrl === null &&
    !nextEntry.sessionReady &&
    !nextEntry.warmed
  ) {
    if (
      currentEntry?.playbackUrl &&
      currentEntry.playbackUrl.startsWith('blob:')
    ) {
      URL.revokeObjectURL(currentEntry.playbackUrl);
    }
    threadVoicePlaybackCache.delete(key);
    return;
  }

  if (
    currentEntry?.playbackUrl &&
    currentEntry.playbackUrl !== nextEntry.playbackUrl &&
    currentEntry.playbackUrl.startsWith('blob:')
  ) {
    URL.revokeObjectURL(currentEntry.playbackUrl);
  }

  if (threadVoicePlaybackCache.has(key)) {
    threadVoicePlaybackCache.delete(key);
  }

  threadVoicePlaybackCache.set(key, nextEntry);

  while (threadVoicePlaybackCache.size > THREAD_VOICE_PLAYBACK_CACHE_MAX_ENTRIES) {
    const oldestKey = threadVoicePlaybackCache.keys().next().value;

    if (!oldestKey) {
      break;
    }

    const oldestEntry = threadVoicePlaybackCache.get(oldestKey);

    if (oldestEntry?.playbackUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(oldestEntry.playbackUrl);
    }

    threadVoicePlaybackCache.delete(oldestKey);
    threadVoicePlaybackWarmPromises.delete(oldestKey);
  }
}

async function defaultResolveThreadVoiceTransportSource(input: {
  transportSourceUrl: string;
}) {
  const response = await fetch(input.transportSourceUrl, {
    cache: 'force-cache',
    credentials: 'same-origin',
  });

  if (!response.ok) {
    throw new Error(
      `Voice transport source fetch failed with status ${response.status}`,
    );
  }

  return response.blob();
}

export async function resolveThreadVoiceTransportSourceUrl(input: {
  locator: ThreadVoiceTransportSourceLocator;
  onDiagnostic?: ThreadVoiceSourceDiagnosticLogger;
}): Promise<ThreadVoiceTransportSourceResolution> {
  // Current plaintext voice resolves a short-lived transport URL here. Future
  // encrypted voice can keep the same outer contract and swap this step for a
  // private-media locator/envelope resolver before handing the player a local
  // playable source.
  const resolveUrl = buildThreadVoiceTransportResolveUrl(input.locator);

  if (!resolveUrl) {
    input.onDiagnostic?.('attachment-url-resolve-skipped-invalid-locator', {
      attachmentId: input.locator.attachmentId,
      conversationId: input.locator.conversationId,
      messageId: input.locator.messageId,
    });
    return {
      status: 'skipped',
      transportSourceUrl: null,
    };
  }

  try {
    const response = await fetch(resolveUrl, {
      cache: 'no-store',
      credentials: 'same-origin',
    });

    if (!response.ok) {
      throw new Error(
        `Voice attachment URL resolve failed with status ${response.status}`,
      );
    }

    const payload = (await response.json()) as { signedUrl?: string | null };
    const nextSignedUrl =
      typeof payload.signedUrl === 'string' && payload.signedUrl.trim()
        ? payload.signedUrl.trim()
        : null;

    input.onDiagnostic?.('attachment-url-resolved', {
      attachmentId: input.locator.attachmentId,
      conversationId: input.locator.conversationId,
      messageId: input.locator.messageId,
      resolved: Boolean(nextSignedUrl),
    });

    return {
      status: 'resolved',
      transportSourceUrl: nextSignedUrl,
    };
  } catch (error) {
    input.onDiagnostic?.('attachment-url-resolve-failed', {
      attachmentId: input.locator.attachmentId,
      conversationId: input.locator.conversationId,
      errorMessage: error instanceof Error ? error.message : String(error),
      messageId: input.locator.messageId,
    });
    return {
      status: 'failed',
      transportSourceUrl: null,
    };
  }
}

export async function prepareThreadVoicePlaybackSource(input: {
  cacheKey: string | null;
  conversationId?: string | null;
  locator: ThreadVoiceTransportSourceLocator;
  messageId?: string | null;
  onDiagnostic?: ThreadVoiceSourceDiagnosticLogger;
  playbackSources?: readonly MessagingVoicePlaybackSourceOption[] | null;
  preferredSourceId?: string | null;
  resolveTransportSource?: ThreadVoiceTransportSourceResolver;
  transportSourceUrl: string | null;
}): Promise<ThreadVoicePreparedPlaybackSource> {
  // This is the thread's one player-facing resolver boundary:
  // committed voice locator -> transport source -> local playable source.
  // Future encrypted voice can swap the inside of this function to resolve
  // ciphertext and return a decrypted object URL without rewriting the player.
  const orderedPlaybackSources = orderThreadVoicePlaybackSources({
    playbackSources: input.playbackSources,
    preferredSourceId: input.preferredSourceId,
  });

  if (orderedPlaybackSources.length > 0) {
    let lastStatus: ThreadVoiceTransportSourceResolution['status'] = 'skipped';

    for (const playbackSource of orderedPlaybackSources) {
      const sourceCacheKey = getThreadVoicePlaybackCacheKeyForSource({
        messageId:
          (input.messageId?.trim() || input.locator.messageId?.trim() || ''),
        playbackSource,
      });
      let transportSourceUrl = normalizeThreadVoicePlaybackSourceUrl(
        playbackSource.transportSourceUrl,
      );
      let status: ThreadVoiceTransportSourceResolution['status'] =
        transportSourceUrl ? 'resolved' : 'skipped';

      if (!transportSourceUrl) {
        const transportResolution = await resolveThreadVoiceTransportSourceUrl({
          locator: {
            attachmentId: playbackSource.assetId,
            conversationId:
              input.conversationId?.trim() ||
              input.locator.conversationId?.trim() ||
              null,
            messageId:
              input.messageId?.trim() || input.locator.messageId?.trim() || null,
          },
          onDiagnostic: input.onDiagnostic,
        });

        status = transportResolution.status;
        transportSourceUrl = transportResolution.transportSourceUrl;
      }

      if (!transportSourceUrl) {
        if (status === 'failed') {
          lastStatus = 'failed';
        }

        continue;
      }

      const playbackSourceUrl = await resolveLocalThreadVoicePlaybackSource({
        cacheKey: sourceCacheKey,
        onDiagnostic: input.onDiagnostic,
        resolveTransportSource: input.resolveTransportSource,
        transportSourceUrl,
      });

      return {
        playbackSourceUrl: playbackSourceUrl ?? transportSourceUrl,
        selectedPlaybackSource: playbackSource,
        status: 'resolved',
        transportSourceUrl,
      };
    }

    return {
      playbackSourceUrl: null,
      selectedPlaybackSource: orderedPlaybackSources[0] ?? null,
      status: lastStatus,
      transportSourceUrl: null,
    };
  }

  let transportSourceUrl =
    typeof input.transportSourceUrl === 'string' &&
    input.transportSourceUrl.trim()
      ? input.transportSourceUrl.trim()
      : null;
  let status: ThreadVoiceTransportSourceResolution['status'] =
    transportSourceUrl ? 'resolved' : 'skipped';

  if (!transportSourceUrl) {
    const transportResolution = await resolveThreadVoiceTransportSourceUrl({
      locator: input.locator,
      onDiagnostic: input.onDiagnostic,
    });

    status = transportResolution.status;
    transportSourceUrl = transportResolution.transportSourceUrl;
  }

  if (!transportSourceUrl) {
    return {
      playbackSourceUrl: null,
      selectedPlaybackSource: null,
      status,
      transportSourceUrl: null,
    };
  }

  const playbackSourceUrl = await resolveLocalThreadVoicePlaybackSource({
    cacheKey: input.cacheKey,
    onDiagnostic: input.onDiagnostic,
    resolveTransportSource: input.resolveTransportSource,
    transportSourceUrl,
  });

  return {
    playbackSourceUrl: playbackSourceUrl ?? transportSourceUrl,
    selectedPlaybackSource: null,
    status: 'resolved',
    transportSourceUrl,
  };
}

export async function resolveLocalThreadVoicePlaybackSource(input: {
  cacheKey: string | null;
  onDiagnostic?: ThreadVoiceSourceDiagnosticLogger;
  resolveTransportSource?: ThreadVoiceTransportSourceResolver;
  transportSourceUrl: string | null;
}) {
  // The player only consumes a local playable source URL. Today this warms a
  // plaintext transport URL into a blob URL; later encrypted voice can fetch
  // ciphertext and return a decrypted object URL through the same boundary.
  input.onDiagnostic?.('local-playable-source-requested', {
    cacheKey: input.cacheKey,
    hasTransportSourceUrl: Boolean(input.transportSourceUrl),
  });

  if (
    typeof window === 'undefined' ||
    !input.cacheKey ||
    !input.transportSourceUrl
  ) {
    input.onDiagnostic?.('proof-source-prepared', {
      cacheKey: input.cacheKey,
      mode: 'passthrough',
      playbackSourceKind: input.transportSourceUrl ? 'transport' : 'missing',
      resolvedMimeType: null,
      transportSourceUrl: input.transportSourceUrl,
    });
    return input.transportSourceUrl;
  }

  const cacheKey = input.cacheKey;
  const transportSourceUrl = input.transportSourceUrl;
  const currentEntry = threadVoicePlaybackCache.get(cacheKey);

  if (
    currentEntry?.warmed &&
    currentEntry.sourceUrl === transportSourceUrl &&
    currentEntry.playbackUrl
  ) {
    input.onDiagnostic?.('proof-source-prepared', {
      cacheKey,
      mode: 'cache-hit',
      playbackSourceKind: currentEntry.playbackUrl.startsWith('blob:')
        ? 'blob'
        : 'transport',
      resolvedMimeType: null,
      transportSourceUrl,
    });
    input.onDiagnostic?.('local-playable-source-cache-hit', {
      cacheKey,
      transportSourceUrl,
    });
    return currentEntry.playbackUrl;
  }

  const existingPromise = threadVoicePlaybackWarmPromises.get(cacheKey);

  if (existingPromise) {
    input.onDiagnostic?.('local-playable-source-promise-reuse', {
      cacheKey,
      transportSourceUrl,
    });
    return existingPromise;
  }

  const resolveTransportSource =
    input.resolveTransportSource ?? defaultResolveThreadVoiceTransportSource;

  const promise = (async () => {
    try {
      input.onDiagnostic?.('local-playable-source-fetch-start', {
        cacheKey,
        transportSourceUrl,
      });
      const resolvedTransportSource = await resolveTransportSource({
        transportSourceUrl,
      });

      if (!resolvedTransportSource) {
        return null;
      }

      const localPlaybackUrl =
        typeof resolvedTransportSource === 'string'
          ? resolvedTransportSource
          : URL.createObjectURL(resolvedTransportSource);
      const warmed =
        resolvedTransportSource instanceof Blob ||
        localPlaybackUrl.startsWith('blob:');
      const resolvedMimeType =
        resolvedTransportSource instanceof Blob
          ? resolvedTransportSource.type || null
          : null;

      writeThreadVoicePlaybackCacheEntry(cacheKey, {
        playbackUrl: localPlaybackUrl,
        sessionReady:
          threadVoicePlaybackCache.get(cacheKey)?.sessionReady ?? false,
        sourceUrl: transportSourceUrl,
        warmed,
      });
      input.onDiagnostic?.('local-playable-source-ready', {
        cacheKey,
        resolvedMimeType,
        transportSourceUrl,
        warmed,
      });
      input.onDiagnostic?.('proof-source-prepared', {
        cacheKey,
        mode: warmed ? 'warmed' : 'resolved',
        playbackSourceKind: localPlaybackUrl.startsWith('blob:')
          ? 'blob'
          : 'transport',
        resolvedMimeType,
        transportSourceUrl,
      });
      return localPlaybackUrl;
    } catch (error) {
      input.onDiagnostic?.('local-playable-source-failed', {
        cacheKey,
        errorMessage: error instanceof Error ? error.message : String(error),
        transportSourceUrl,
      });
      input.onDiagnostic?.('proof-source-prepare-failed', {
        cacheKey,
        errorMessage: error instanceof Error ? error.message : String(error),
        transportSourceUrl,
      });
      return null;
    } finally {
      threadVoicePlaybackWarmPromises.delete(cacheKey);
    }
  })();

  threadVoicePlaybackWarmPromises.set(cacheKey, promise);
  return promise;
}
