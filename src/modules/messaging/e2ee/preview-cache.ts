export type LocalEncryptedDmPreview = {
  userId: string;
  conversationId: string;
  messageId: string;
  snippet: string;
  updatedAt: string;
};

type LocalEncryptedDmPreviewCache = Record<
  string,
  Record<string, LocalEncryptedDmPreview>
>;

const PREVIEW_CACHE_KEY = 'chat_dm_e2ee_preview_cache_v2';
const LEGACY_PREVIEW_CACHE_KEY = 'chat_dm_e2ee_preview_cache_v1';
const PREVIEW_MAX_LENGTH = 120;

function isBrowserStorageAvailable() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function normalizeSnippet(value: string) {
  const trimmed = value.trim().replace(/\s+/g, ' ');

  if (trimmed.length <= PREVIEW_MAX_LENGTH) {
    return trimmed;
  }

  return `${trimmed.slice(0, PREVIEW_MAX_LENGTH).trimEnd()}...`;
}

function clearLegacyPreviewCache() {
  if (!isBrowserStorageAvailable()) {
    return;
  }

  window.localStorage.removeItem(LEGACY_PREVIEW_CACHE_KEY);
}

function readPreviewCacheMap() {
  if (!isBrowserStorageAvailable()) {
    return {} as LocalEncryptedDmPreviewCache;
  }

  try {
    clearLegacyPreviewCache();
    const raw = window.localStorage.getItem(PREVIEW_CACHE_KEY);

    if (!raw) {
      return {} as LocalEncryptedDmPreviewCache;
    }

    return JSON.parse(raw) as LocalEncryptedDmPreviewCache;
  } catch {
    return {} as LocalEncryptedDmPreviewCache;
  }
}

function writePreviewCacheMap(value: LocalEncryptedDmPreviewCache) {
  if (!isBrowserStorageAvailable()) {
    return;
  }

  clearLegacyPreviewCache();
  window.localStorage.setItem(PREVIEW_CACHE_KEY, JSON.stringify(value));
}

export function readLocalEncryptedDmPreview(
  userId: string,
  conversationId: string,
) {
  const cacheMap = readPreviewCacheMap();
  return cacheMap[userId]?.[conversationId] ?? null;
}

export function writeLocalEncryptedDmPreview(input: {
  userId: string;
  conversationId: string;
  messageId: string;
  plaintext: string;
  updatedAt?: string | null;
}) {
  const snippet = normalizeSnippet(input.plaintext);

  if (!snippet) {
    return;
  }

  const cacheMap = readPreviewCacheMap();
  const userCache = cacheMap[input.userId] ?? {};
  userCache[input.conversationId] = {
    userId: input.userId,
    conversationId: input.conversationId,
    messageId: input.messageId,
    snippet,
    updatedAt: input.updatedAt ?? new Date().toISOString(),
  };
  cacheMap[input.userId] = userCache;
  writePreviewCacheMap(cacheMap);
}

export function clearLocalEncryptedDmPreview(
  userId: string,
  conversationId: string,
) {
  const cacheMap = readPreviewCacheMap();
  const userCache = cacheMap[userId];

  if (!userCache?.[conversationId]) {
    return;
  }

  delete userCache[conversationId];

  if (Object.keys(userCache).length === 0) {
    delete cacheMap[userId];
  } else {
    cacheMap[userId] = userCache;
  }

  writePreviewCacheMap(cacheMap);
}

export function clearLocalEncryptedDmPreviewsForUser(userId: string) {
  const cacheMap = readPreviewCacheMap();

  if (!cacheMap[userId]) {
    return;
  }

  delete cacheMap[userId];
  writePreviewCacheMap(cacheMap);
}

export function clearLocalEncryptedDmPreviewsExceptUser(userId: string) {
  const cacheMap = readPreviewCacheMap();
  const nextCache: LocalEncryptedDmPreviewCache = {};

  if (cacheMap[userId]) {
    nextCache[userId] = cacheMap[userId];
  }

  writePreviewCacheMap(nextCache);
}

export function clearAllLocalEncryptedDmPreviews() {
  if (!isBrowserStorageAvailable()) {
    return;
  }

  clearLegacyPreviewCache();
  window.localStorage.removeItem(PREVIEW_CACHE_KEY);
}
