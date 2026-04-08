import type { MessagingVoiceMessageDraftRecord } from './voice';

type LocalMessagingVoiceDraftRecord = Omit<
  MessagingVoiceMessageDraftRecord,
  'blobUrl'
> & {
  blob: Blob;
  updatedAt: string;
  version: 1;
};

const DATABASE_NAME = 'chat-messaging-runtime';
const DATABASE_VERSION = 1;
const VOICE_DRAFT_STORE_NAME = 'voice-drafts';

function canUseIndexedDb() {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
}

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (!canUseIndexedDb()) {
      reject(new Error('IndexedDB is unavailable.'));
      return;
    }

    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(VOICE_DRAFT_STORE_NAME)) {
        database.createObjectStore(VOICE_DRAFT_STORE_NAME, {
          keyPath: 'conversationId',
        });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(
        request.error ?? new Error('Unable to open local voice draft storage.'),
      );
  });
}

export async function getLocalMessagingVoiceDraft(conversationId: string) {
  if (!canUseIndexedDb() || !conversationId.trim()) {
    return null;
  }

  const database = await openDatabase();

  return new Promise<LocalMessagingVoiceDraftRecord | null>((resolve, reject) => {
    const transaction = database.transaction(VOICE_DRAFT_STORE_NAME, 'readonly');
    const store = transaction.objectStore(VOICE_DRAFT_STORE_NAME);
    const request = store.get(conversationId.trim());

    request.onsuccess = () =>
      resolve(
        (request.result as LocalMessagingVoiceDraftRecord | undefined) ?? null,
      );
    request.onerror = () =>
      reject(
        request.error ?? new Error('Unable to read local voice draft storage.'),
      );
  });
}

export async function saveLocalMessagingVoiceDraft(
  record: LocalMessagingVoiceDraftRecord,
) {
  if (!canUseIndexedDb() || !record.conversationId.trim()) {
    return;
  }

  const database = await openDatabase();

  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(VOICE_DRAFT_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(VOICE_DRAFT_STORE_NAME);

    store.put({
      ...record,
      conversationId: record.conversationId.trim(),
      updatedAt: new Date().toISOString(),
      version: 1,
    } satisfies LocalMessagingVoiceDraftRecord);

    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(
        transaction.error ??
          new Error('Unable to persist local voice draft storage.'),
      );
  });
}

export async function deleteLocalMessagingVoiceDraft(conversationId: string) {
  if (!canUseIndexedDb() || !conversationId.trim()) {
    return;
  }

  const database = await openDatabase();

  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(VOICE_DRAFT_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(VOICE_DRAFT_STORE_NAME);

    store.delete(conversationId.trim());

    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(
        transaction.error ??
          new Error('Unable to clear local voice draft storage.'),
      );
  });
}
