export type LocalEncryptedDmPreview = {
  conversationId: string;
  messageId: string;
  snippet: string;
  updatedAt: string;
};

const PREVIEW_CACHE_KEY = 'chat_dm_e2ee_preview_cache_v1';
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

function readPreviewCacheMap() {
  if (!isBrowserStorageAvailable()) {
    return {} as Record<string, LocalEncryptedDmPreview>;
  }

  try {
    const raw = window.localStorage.getItem(PREVIEW_CACHE_KEY);

    if (!raw) {
      return {} as Record<string, LocalEncryptedDmPreview>;
    }

    return JSON.parse(raw) as Record<string, LocalEncryptedDmPreview>;
  } catch {
    return {} as Record<string, LocalEncryptedDmPreview>;
  }
}

function writePreviewCacheMap(value: Record<string, LocalEncryptedDmPreview>) {
  if (!isBrowserStorageAvailable()) {
    return;
  }

  window.localStorage.setItem(PREVIEW_CACHE_KEY, JSON.stringify(value));
}

export function readLocalEncryptedDmPreview(conversationId: string) {
  const cacheMap = readPreviewCacheMap();
  return cacheMap[conversationId] ?? null;
}

export function writeLocalEncryptedDmPreview(input: {
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
  cacheMap[input.conversationId] = {
    conversationId: input.conversationId,
    messageId: input.messageId,
    snippet,
    updatedAt: input.updatedAt ?? new Date().toISOString(),
  };
  writePreviewCacheMap(cacheMap);
}
