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

type ThreadVoiceTransportSourceResolver = (input: {
  transportSourceUrl: string;
}) => Promise<Blob | string | null>;

type ThreadVoiceSourceDiagnosticLogger = (
  stage: string,
  details: Record<string, unknown>,
) => void;

const threadVoicePlaybackCache = new Map<string, ThreadVoicePlaybackCacheEntry>();
const threadVoicePlaybackWarmPromises = new Map<string, Promise<string | null>>();

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
  transportSourceUrl: string | null;
}): ThreadVoicePlaybackSourceSnapshot {
  const cacheKey = getThreadVoicePlaybackCacheKey({
    attachment: input.attachment,
    messageId: input.messageId,
  });
  const cacheEntry = readThreadVoicePlaybackCacheEntry(cacheKey);
  const normalizedIgnoredTransportSourceUrl =
    typeof input.ignoredTransportSourceUrl === 'string' &&
    input.ignoredTransportSourceUrl.trim()
      ? input.ignoredTransportSourceUrl.trim()
      : null;
  const requestedTransportSourceUrl =
    typeof input.transportSourceUrl === 'string' && input.transportSourceUrl.trim()
      ? input.transportSourceUrl.trim()
      : null;
  const cacheTransportSourceUrl =
    cacheEntry?.sourceUrl &&
    cacheEntry.sourceUrl !== normalizedIgnoredTransportSourceUrl
      ? cacheEntry.sourceUrl
      : null;
  const transportSourceUrl = requestedTransportSourceUrl ?? cacheTransportSourceUrl;
  const localPlaybackUrl = resolvePreferredLocalThreadVoicePlaybackUrl({
    cacheEntry:
      cacheEntry?.warmed || cacheEntry?.playbackUrl?.startsWith('blob:')
        ? cacheEntry
        : cacheTransportSourceUrl
          ? cacheEntry
          : null,
    transportSourceUrl,
  });

  return {
    cacheKey,
    cachedDurationMs: cacheEntry?.durationMs ?? input.attachment?.durationMs ?? null,
    localPlaybackUrl,
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

      writeThreadVoicePlaybackCacheEntry(cacheKey, {
        playbackUrl: localPlaybackUrl,
        sessionReady:
          threadVoicePlaybackCache.get(cacheKey)?.sessionReady ?? false,
        sourceUrl: transportSourceUrl,
        warmed,
      });
      input.onDiagnostic?.('local-playable-source-ready', {
        cacheKey,
        transportSourceUrl,
        warmed,
      });
      input.onDiagnostic?.('proof-source-prepared', {
        cacheKey,
        mode: warmed ? 'warmed' : 'resolved',
        playbackSourceKind: localPlaybackUrl.startsWith('blob:')
          ? 'blob'
          : 'transport',
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
