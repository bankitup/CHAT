export type LocalDmE2eeOneTimePrekey = {
  prekeyId: number;
  publicKey: string;
  privateKeyJwk: JsonWebKey;
};

export type LocalDmE2eeDeviceRecord = {
  version: 1;
  userId: string;
  serverDeviceRecordId: string | null;
  deviceId: number;
  registrationId: number;
  identityPublicKey: string;
  identityPrivateKeyJwk: JsonWebKey;
  signedPrekeyId: number;
  signedPrekeyPublicKey: string;
  signedPrekeyPrivateKeyJwk: JsonWebKey;
  signedPrekeySignature: string;
  oneTimePrekeys: LocalDmE2eeOneTimePrekey[];
  createdAt: string;
  lastPublishedAt: string | null;
};

const DATABASE_NAME = 'chat-dm-e2ee';
const DATABASE_VERSION = 1;
const DEVICE_STORE_NAME = 'device-records';

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(DEVICE_STORE_NAME)) {
        database.createObjectStore(DEVICE_STORE_NAME, {
          keyPath: 'userId',
        });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error('Unable to open DM E2EE device storage.'));
  });
}

export async function getLocalDmE2eeDeviceRecord(userId: string) {
  const database = await openDatabase();

  return new Promise<LocalDmE2eeDeviceRecord | null>((resolve, reject) => {
    const transaction = database.transaction(DEVICE_STORE_NAME, 'readonly');
    const store = transaction.objectStore(DEVICE_STORE_NAME);
    const request = store.get(userId);

    request.onsuccess = () =>
      resolve((request.result as LocalDmE2eeDeviceRecord | undefined) ?? null);
    request.onerror = () =>
      reject(request.error ?? new Error('Unable to read DM E2EE device record.'));
  });
}

export async function saveLocalDmE2eeDeviceRecord(
  record: LocalDmE2eeDeviceRecord,
) {
  const database = await openDatabase();

  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(DEVICE_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(DEVICE_STORE_NAME);

    store.put(record);

    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(
        transaction.error ?? new Error('Unable to persist DM E2EE device record.'),
      );
  });
}

export async function updateLocalDmE2eeDeviceRecord(
  userId: string,
  update: (
    record: LocalDmE2eeDeviceRecord | null,
  ) => LocalDmE2eeDeviceRecord | null,
) {
  const existing = await getLocalDmE2eeDeviceRecord(userId);
  const next = update(existing);

  if (!next) {
    return null;
  }

  await saveLocalDmE2eeDeviceRecord(next);
  return next;
}

export async function getLocalDmE2eeDeviceRecordByServerDeviceId(
  serverDeviceRecordId: string,
) {
  if (!serverDeviceRecordId) {
    return null;
  }

  const database = await openDatabase();

  return new Promise<LocalDmE2eeDeviceRecord | null>((resolve, reject) => {
    const transaction = database.transaction(DEVICE_STORE_NAME, 'readonly');
    const store = transaction.objectStore(DEVICE_STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const records = (request.result ?? []) as LocalDmE2eeDeviceRecord[];
      resolve(
        records.find(
          (record) => record.serverDeviceRecordId === serverDeviceRecordId,
        ) ?? null,
      );
    };
    request.onerror = () =>
      reject(
        request.error ??
          new Error('Unable to read DM E2EE device records by server id.'),
      );
  });
}
