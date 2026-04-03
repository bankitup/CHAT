import type {
  DmE2eeApiErrorCode,
  PublishDmE2eeDeviceRequest,
  PublishDmE2eeDeviceResult,
} from '@/modules/messaging/contract/dm-e2ee';
import {
  deleteLocalDmE2eeDeviceRecord,
  getLocalDmE2eeDeviceRecord,
  saveLocalDmE2eeDeviceRecord,
  updateLocalDmE2eeDeviceRecord,
  type LocalDmE2eeDeviceRecord,
} from './device-store';

const ONE_TIME_PREKEY_BATCH_SIZE = 12;

type DmE2eeBootstrapStatus =
  | 'registered'
  | 'unsupported'
  | 'schema-missing';

type EnsureDmE2eeDeviceRegisteredOptions = {
  forcePublish?: boolean;
  allowRepair?: boolean;
};

function createLocalDmE2eeError(
  code: DmE2eeApiErrorCode,
  message: string,
) {
  const error = new Error(message) as Error & {
    code?: DmE2eeApiErrorCode;
  };
  error.code = code;
  return error;
}

function randomPositiveInt31() {
  const value = crypto.getRandomValues(new Uint32Array(1))[0] ?? 1;
  return (value & 0x7fffffff) || 1;
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function bufferToBase64Url(buffer: ArrayBuffer) {
  return bytesToBase64Url(new Uint8Array(buffer));
}

async function exportPrivateKeyJwk(key: CryptoKey) {
  return (await crypto.subtle.exportKey('jwk', key)) as JsonWebKey;
}

async function exportPublicKeyRaw(key: CryptoKey) {
  const raw = await crypto.subtle.exportKey('raw', key);
  return bufferToBase64Url(raw);
}

function x25519Algorithm() {
  return { name: 'X25519' } as AlgorithmIdentifier;
}

function ed25519Algorithm() {
  return { name: 'Ed25519' } as AlgorithmIdentifier;
}

async function generateX25519KeyPair() {
  return crypto.subtle.generateKey(
    x25519Algorithm(),
    true,
    ['deriveBits'],
  ) as Promise<CryptoKeyPair>;
}

async function generateEd25519KeyPair() {
  return crypto.subtle.generateKey(
    ed25519Algorithm(),
    true,
    ['sign', 'verify'],
  ) as Promise<CryptoKeyPair>;
}

async function createLocalDmE2eeDeviceRecord(
  userId: string,
): Promise<LocalDmE2eeDeviceRecord> {
  const deviceId = randomPositiveInt31();
  const registrationId = randomPositiveInt31();
  const signedPrekeyId = randomPositiveInt31();
  const usedPrekeyIds = new Set<number>([signedPrekeyId]);
  const identityKeyPair = await generateEd25519KeyPair();
  const signedPrekeyPair = await generateX25519KeyPair();
  const signedPrekeyPublicRaw = await crypto.subtle.exportKey(
    'raw',
    signedPrekeyPair.publicKey,
  );
  const signedPrekeySignature = await crypto.subtle.sign(
    ed25519Algorithm(),
    identityKeyPair.privateKey,
    signedPrekeyPublicRaw,
  );

  const oneTimePrekeys = await Promise.all(
    Array.from({ length: ONE_TIME_PREKEY_BATCH_SIZE }, async () => {
      let prekeyId = randomPositiveInt31();

      while (usedPrekeyIds.has(prekeyId)) {
        prekeyId = randomPositiveInt31();
      }

      usedPrekeyIds.add(prekeyId);
      const oneTimePrekeyPair = await generateX25519KeyPair();

      return {
        prekeyId,
        publicKey: await exportPublicKeyRaw(oneTimePrekeyPair.publicKey),
        privateKeyJwk: await exportPrivateKeyJwk(oneTimePrekeyPair.privateKey),
      };
    }),
  );

  return {
    version: 1,
    userId,
    serverDeviceRecordId: null,
    deviceId,
    registrationId,
    identityPublicKey: await exportPublicKeyRaw(identityKeyPair.publicKey),
    identityPrivateKeyJwk: await exportPrivateKeyJwk(identityKeyPair.privateKey),
    signedPrekeyId,
    signedPrekeyPublicKey: bufferToBase64Url(signedPrekeyPublicRaw),
    signedPrekeyPrivateKeyJwk: await exportPrivateKeyJwk(
      signedPrekeyPair.privateKey,
    ),
    signedPrekeySignature: bufferToBase64Url(signedPrekeySignature),
    oneTimePrekeys,
    createdAt: new Date().toISOString(),
    lastPublishedAt: null,
  };
}

async function ensureLocalDmE2eeDeviceRecord(userId: string) {
  const existing = await getLocalDmE2eeDeviceRecord(userId);

  if (existing) {
    return existing;
  }

  const created = await createLocalDmE2eeDeviceRecord(userId);
  await saveLocalDmE2eeDeviceRecord(created);
  return created;
}

function isLocalDmE2eeDeviceRecordUsable(record: LocalDmE2eeDeviceRecord) {
  return Boolean(
    record.identityPublicKey &&
      record.identityPrivateKeyJwk?.kty &&
      record.signedPrekeyPublicKey &&
      record.signedPrekeyPrivateKeyJwk?.kty &&
      Array.isArray(record.oneTimePrekeys),
  );
}

function buildPublishRequest(
  record: LocalDmE2eeDeviceRecord,
): PublishDmE2eeDeviceRequest {
  return {
    deviceId: record.deviceId,
    registrationId: record.registrationId,
    identityKeyPublic: record.identityPublicKey,
    signedPrekeyId: record.signedPrekeyId,
    signedPrekeyPublic: record.signedPrekeyPublicKey,
    signedPrekeySignature: record.signedPrekeySignature,
    oneTimePrekeys: record.oneTimePrekeys.map((prekey) => ({
      prekeyId: prekey.prekeyId,
      publicKey: prekey.publicKey,
    })),
  };
}

export async function ensureDmE2eeDeviceRegistered(
  userId: string,
  options: EnsureDmE2eeDeviceRegisteredOptions = {},
) {
  if (
    typeof window === 'undefined' ||
    typeof window.indexedDB === 'undefined' ||
    typeof window.crypto === 'undefined' ||
    typeof window.crypto.subtle === 'undefined'
  ) {
    return {
      status: 'unsupported',
      result: null,
    } satisfies {
      status: DmE2eeBootstrapStatus;
      result: PublishDmE2eeDeviceResult | null;
    };
  }

  const allowRepair = options.allowRepair !== false;
  let localRecord = await ensureLocalDmE2eeDeviceRecord(userId);

  if (!isLocalDmE2eeDeviceRecordUsable(localRecord)) {
    if (allowRepair) {
      await deleteLocalDmE2eeDeviceRecord(userId);
      localRecord = await ensureLocalDmE2eeDeviceRecord(userId);
    }

    if (!isLocalDmE2eeDeviceRecordUsable(localRecord)) {
      throw createLocalDmE2eeError(
        'dm_e2ee_local_state_incomplete',
        'Local DM E2EE device state is incomplete on this device.',
      );
    }
  }

  if (localRecord.serverDeviceRecordId && !options.forcePublish) {
    return {
      status: 'registered',
      result: {
        deviceRecordId: localRecord.serverDeviceRecordId,
        publishedPrekeyCount: 0,
      },
    } satisfies {
      status: DmE2eeBootstrapStatus;
      result: PublishDmE2eeDeviceResult;
    };
  }

  const response = await fetch('/api/messaging/dm-e2ee/device', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(buildPublishRequest(localRecord)),
  });

  if (response.ok) {
    const result = (await response.json()) as PublishDmE2eeDeviceResult;
    await saveLocalDmE2eeDeviceRecord({
      ...localRecord,
      serverDeviceRecordId: result.deviceRecordId,
      lastPublishedAt: new Date().toISOString(),
    });

    return {
      status: 'registered',
      result,
    } satisfies {
      status: DmE2eeBootstrapStatus;
      result: PublishDmE2eeDeviceResult;
    };
  }

  let errorCode: string | null = null;
  let errorMessage: string | null = null;

  try {
    const payload = (await response.json()) as { code?: string; error?: string };
    errorCode = payload.code ?? null;
    errorMessage = payload.error ?? null;
  } catch {
    errorCode = null;
    errorMessage = null;
  }

  if (errorCode === 'dm_e2ee_schema_missing') {
    return {
      status: 'schema-missing',
      result: null,
    } satisfies {
      status: DmE2eeBootstrapStatus;
      result: null;
    };
  }

  if (errorCode === 'dm_e2ee_local_state_incomplete') {
    if (allowRepair) {
      await deleteLocalDmE2eeDeviceRecord(userId);
      return ensureDmE2eeDeviceRegistered(userId, {
        forcePublish: true,
        allowRepair: false,
      });
    }

    throw createLocalDmE2eeError(
      'dm_e2ee_local_state_incomplete',
      errorMessage || 'Local DM E2EE setup is incomplete on this device.',
    );
  }

  throw new Error(errorMessage || 'Unable to publish DM E2EE device bootstrap.');
}

export async function markLocalDmE2eeDeviceRegistrationStale(userId: string) {
  await updateLocalDmE2eeDeviceRecord(userId, (record) => {
    if (!record) {
      return null;
    }

    return {
      ...record,
      serverDeviceRecordId: null,
      lastPublishedAt: null,
    };
  });
}
