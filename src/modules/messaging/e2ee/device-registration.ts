import type {
  DmE2eeApiErrorCode,
  DmE2eeBootstrapDebugState,
  PublishDmE2eeDeviceRequest,
  PublishDmE2eeDeviceResult,
  DmE2eeBootstrap400ReasonCode,
  DmE2eeBootstrapFailedValidationBranch,
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
  publishAttempt?: 'initial' | 'manual-refresh' | 'repair-republish';
};

type DmE2eeServerDeviceState = {
  activeDeviceRowIds: string[];
  activeDeviceRowCount: number;
  availableOneTimePrekeyCount: number;
  hasActiveDevice: boolean;
  hasSignedPrekey: boolean;
};

export type CurrentDmE2eeDeviceInspection =
  | {
      status: 'schema-missing';
      state: null;
    }
  | {
      status: 'ok';
      state: DmE2eeServerDeviceState;
    };

function shouldLogDmE2eeBootstrapClientDiagnostics() {
  return (
    typeof window !== 'undefined' &&
    process.env.NEXT_PUBLIC_CHAT_DEBUG_DM_E2EE_BOOTSTRAP === '1'
  );
}

function logDmE2eeBootstrapClientDiagnostics(
  stage: string,
  details?: Record<string, unknown>,
) {
  if (!shouldLogDmE2eeBootstrapClientDiagnostics()) {
    return;
  }

  if (details) {
    console.info('[dm-e2ee-bootstrap-client]', stage, details);
    return;
  }

  console.info('[dm-e2ee-bootstrap-client]', stage);
}

function createLocalDmE2eeError(
  code: DmE2eeApiErrorCode,
  message: string,
  details?: {
    exact400ReasonCode?: DmE2eeBootstrap400ReasonCode | null;
    failedValidationBranch?: DmE2eeBootstrapFailedValidationBranch | null;
    exactFailurePoint?: string | null;
  } & DmE2eeBootstrapDebugState,
) {
  const error = new Error(message) as Error & {
    code?: DmE2eeApiErrorCode;
    exact400ReasonCode?: DmE2eeBootstrap400ReasonCode | null;
    failedValidationBranch?: DmE2eeBootstrapFailedValidationBranch | null;
    exactFailurePoint?: string | null;
  } & DmE2eeBootstrapDebugState;
  error.code = code;
  error.exact400ReasonCode = details?.exact400ReasonCode ?? null;
  error.failedValidationBranch = details?.failedValidationBranch ?? null;
  error.exactFailurePoint = details?.exactFailurePoint ?? null;
  error.authRetireAttempted = details?.authRetireAttempted ?? null;
  error.authRetireFailed = details?.authRetireFailed ?? null;
  error.serviceRetireAttempted = details?.serviceRetireAttempted ?? null;
  error.serviceRetireSucceeded = details?.serviceRetireSucceeded ?? null;
  error.serviceRetireFailed = details?.serviceRetireFailed ?? null;
  error.currentDeviceRowId = details?.currentDeviceRowId ?? null;
  error.retireTargetIds = details?.retireTargetIds ?? null;
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
    return {
      record: existing,
      wasCreated: false,
    };
  }

  const created = await createLocalDmE2eeDeviceRecord(userId);
  await saveLocalDmE2eeDeviceRecord(created);
  return {
    record: created,
    wasCreated: true,
  };
}

function isLocalDmE2eeDeviceRecordUsable(record: LocalDmE2eeDeviceRecord) {
  const hasValidOneTimePrekeys =
    Array.isArray(record.oneTimePrekeys) &&
    record.oneTimePrekeys.every(
      (prekey) =>
        Number.isInteger(prekey.prekeyId) &&
        prekey.prekeyId > 0 &&
        Boolean(prekey.publicKey?.trim()) &&
        Boolean(prekey.privateKeyJwk?.kty),
    );

  return Boolean(
    Number.isInteger(record.deviceId) &&
      record.deviceId > 0 &&
      Number.isInteger(record.registrationId) &&
      record.registrationId > 0 &&
      Number.isInteger(record.signedPrekeyId) &&
      record.signedPrekeyId > 0 &&
      record.identityPublicKey?.trim() &&
      record.identityPrivateKeyJwk?.kty &&
      record.signedPrekeyPublicKey?.trim() &&
      record.signedPrekeyPrivateKeyJwk?.kty &&
      record.signedPrekeySignature?.trim() &&
      hasValidOneTimePrekeys,
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

function isServerDmE2eeDeviceStateReady(
  serverState: DmE2eeServerDeviceState,
  serverDeviceRecordId: string | null | undefined,
) {
  return Boolean(
    serverDeviceRecordId &&
      serverState.hasActiveDevice &&
      serverState.activeDeviceRowIds.includes(serverDeviceRecordId) &&
      serverState.hasSignedPrekey &&
      serverState.availableOneTimePrekeyCount > 0,
  );
}

export function isCurrentDmE2eeDeviceInspectionReady(input: {
  inspection: CurrentDmE2eeDeviceInspection;
  serverDeviceRecordId: string | null | undefined;
}) {
  return (
    input.inspection.status === 'ok' &&
    isServerDmE2eeDeviceStateReady(
      input.inspection.state,
      input.serverDeviceRecordId,
    )
  );
}

export async function inspectCurrentUserDmE2eeDeviceState(): Promise<CurrentDmE2eeDeviceInspection> {
  const response = await fetch('/api/messaging/dm-e2ee/device', {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });

  const payload = (await response.json()) as {
    activeDeviceRowIds?: string[] | null;
    activeDeviceRowCount?: number | null;
    availableOneTimePrekeyCount?: number | null;
    code?: string | null;
    error?: string | null;
    hasActiveDevice?: boolean | null;
    hasSignedPrekey?: boolean | null;
  };

  if (!response.ok) {
    if (payload.code === 'dm_e2ee_schema_missing') {
      return {
        status: 'schema-missing' as const,
        state: null,
      };
    }

    throw new Error(
      payload.error || 'Unable to inspect encrypted device state.',
    );
  }

  return {
    status: 'ok' as const,
    state: {
      activeDeviceRowIds: Array.isArray(payload.activeDeviceRowIds)
        ? payload.activeDeviceRowIds
            .map((value) => value?.trim())
            .filter((value): value is string => Boolean(value))
        : [],
      activeDeviceRowCount: Number(payload.activeDeviceRowCount ?? 0),
      availableOneTimePrekeyCount: Number(
        payload.availableOneTimePrekeyCount ?? 0,
      ),
      hasActiveDevice: Boolean(payload.hasActiveDevice),
      hasSignedPrekey: Boolean(payload.hasSignedPrekey),
    } satisfies DmE2eeServerDeviceState,
  };
}

export async function ensureDmE2eeDeviceRegistered(
  userId: string,
  options: EnsureDmE2eeDeviceRegisteredOptions = {},
) {
  const allowRepair = options.allowRepair !== false;
  const publishAttempt =
    options.publishAttempt ??
    (options.forcePublish ? 'manual-refresh' : 'initial');
  logDmE2eeBootstrapClientDiagnostics('ensure:start', {
    allowRepair,
    forcePublish: Boolean(options.forcePublish),
    publishAttempt,
    userIdPresent: Boolean(userId),
  });

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

  const initialLocalDeviceState = await ensureLocalDmE2eeDeviceRecord(userId);
  let localRecord = initialLocalDeviceState.record;
  logDmE2eeBootstrapClientDiagnostics('local-record:loaded', {
    currentUserId: userId,
    localDeviceCreatedNow: initialLocalDeviceState.wasCreated,
    localDeviceCreatedAt: localRecord.createdAt,
    localDeviceLogicalId: localRecord.deviceId,
    serverDeviceRecordId: localRecord.serverDeviceRecordId,
    hasServerDeviceRecordId: Boolean(localRecord.serverDeviceRecordId),
    oneTimePrekeyCount: localRecord.oneTimePrekeys.length,
    usable: isLocalDmE2eeDeviceRecordUsable(localRecord),
  });

  if (!isLocalDmE2eeDeviceRecordUsable(localRecord)) {
    if (allowRepair) {
      logDmE2eeBootstrapClientDiagnostics('local-record:repair:start', {
        currentUserId: userId,
        failedValidationBranch: 'incomplete local state',
        reason: 'local-record-unusable',
      });
      await deleteLocalDmE2eeDeviceRecord(userId);
      localRecord = (await ensureLocalDmE2eeDeviceRecord(userId)).record;
      logDmE2eeBootstrapClientDiagnostics('local-record:repair:rebuilt', {
        currentUserId: userId,
        localDeviceCreatedAt: localRecord.createdAt,
        localDeviceLogicalId: localRecord.deviceId,
        serverDeviceRecordId: localRecord.serverDeviceRecordId,
        failedValidationBranch: 'incomplete local state',
        hasServerDeviceRecordId: Boolean(localRecord.serverDeviceRecordId),
        oneTimePrekeyCount: localRecord.oneTimePrekeys.length,
        usable: isLocalDmE2eeDeviceRecordUsable(localRecord),
      });
    }

    if (!isLocalDmE2eeDeviceRecordUsable(localRecord)) {
      throw createLocalDmE2eeError(
        'dm_e2ee_local_state_incomplete',
        'Local DM E2EE device state is incomplete on this device.',
        {
          failedValidationBranch: 'incomplete local state',
        },
      );
    }
  }

  if (localRecord.serverDeviceRecordId && !options.forcePublish) {
    const serverState = await inspectCurrentUserDmE2eeDeviceState();

    if (serverState.status === 'schema-missing') {
      return {
        status: 'schema-missing',
        result: null,
      } satisfies {
        status: DmE2eeBootstrapStatus;
        result: null;
      };
    }

    const serverStillMatches = isServerDmE2eeDeviceStateReady(
      serverState.state,
      localRecord.serverDeviceRecordId,
    );

    if (!serverStillMatches) {
      logDmE2eeBootstrapClientDiagnostics('publish:stale-server-state', {
        activeDeviceRowCount: serverState.state.activeDeviceRowCount,
        availableOneTimePrekeyCount:
          serverState.state.availableOneTimePrekeyCount,
        currentUserId: userId,
        hasSignedPrekey: serverState.state.hasSignedPrekey,
        localServerDeviceRecordId: localRecord.serverDeviceRecordId,
        activeDeviceRowIds: serverState.state.activeDeviceRowIds,
        hasActiveDevice: serverState.state.hasActiveDevice,
      });
    } else {
      logDmE2eeBootstrapClientDiagnostics('publish:skip-already-registered', {
        activeDeviceRowCount: serverState.state.activeDeviceRowCount,
        availableOneTimePrekeyCount:
          serverState.state.availableOneTimePrekeyCount,
        currentUserId: userId,
        hasSignedPrekey: serverState.state.hasSignedPrekey,
        reusedExistingServerDeviceRecordId: localRecord.serverDeviceRecordId,
        serverDeviceRecordIdPresent: true,
      });
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
  }

  const response = await fetch('/api/messaging/dm-e2ee/device', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Chat-Dm-E2ee-Bootstrap-Attempt': publishAttempt,
    },
    body: JSON.stringify(buildPublishRequest(localRecord)),
  });

  if (response.ok) {
    const result = (await response.json()) as PublishDmE2eeDeviceResult;
    logDmE2eeBootstrapClientDiagnostics('publish:ok', {
      currentUserId: userId,
      previousServerDeviceRecordId: localRecord.serverDeviceRecordId,
      sameServerDeviceRecordReused:
        localRecord.serverDeviceRecordId === result.deviceRecordId,
      deviceRecordIdPresent: Boolean(result.deviceRecordId),
      serverDeviceRecordId: result.deviceRecordId,
      publishedPrekeyCount: result.publishedPrekeyCount,
    });
    await saveLocalDmE2eeDeviceRecord({
      ...localRecord,
      serverDeviceRecordId: result.deviceRecordId,
      lastPublishedAt: new Date().toISOString(),
    });

    const verifiedServerState = await inspectCurrentUserDmE2eeDeviceState();

    if (verifiedServerState.status === 'schema-missing') {
      return {
        status: 'schema-missing',
        result: null,
      } satisfies {
        status: DmE2eeBootstrapStatus;
        result: null;
      };
    }

    logDmE2eeBootstrapClientDiagnostics('publish:verified', {
      activeDeviceRowCount: verifiedServerState.state.activeDeviceRowCount,
      availableOneTimePrekeyCount:
        verifiedServerState.state.availableOneTimePrekeyCount,
      currentUserId: userId,
      hasSignedPrekey: verifiedServerState.state.hasSignedPrekey,
      hasVerifiedDeviceRow: verifiedServerState.state.activeDeviceRowIds.includes(
        result.deviceRecordId,
      ),
      serverDeviceRecordId: result.deviceRecordId,
    });

    if (
      allowRepair &&
      publishAttempt !== 'repair-republish' &&
      !isServerDmE2eeDeviceStateReady(
        verifiedServerState.state,
        result.deviceRecordId,
      )
    ) {
      logDmE2eeBootstrapClientDiagnostics('publish:verify-repair:retry', {
        activeDeviceRowCount: verifiedServerState.state.activeDeviceRowCount,
        availableOneTimePrekeyCount:
          verifiedServerState.state.availableOneTimePrekeyCount,
        currentUserId: userId,
        hasSignedPrekey: verifiedServerState.state.hasSignedPrekey,
        publishAttempt: 'repair-republish',
        serverDeviceRecordId: result.deviceRecordId,
      });
      return ensureDmE2eeDeviceRegistered(userId, {
        allowRepair: false,
        forcePublish: true,
        publishAttempt: 'repair-republish',
      });
    }

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
  let exact400ReasonCode: DmE2eeBootstrap400ReasonCode | null = null;
  let failedValidationBranch: DmE2eeBootstrapFailedValidationBranch | null =
    null;
  let exactFailurePoint: string | null = null;
  let authRetireAttempted: boolean | null = null;
  let authRetireFailed: boolean | null = null;
  let serviceRetireAvailable: boolean | null = null;
  let serviceRetireSkipReason: string | null = null;
  let serviceRetireAttempted: boolean | null = null;
  let serviceRetireSucceeded: boolean | null = null;
  let serviceRetireFailed: boolean | null = null;
  let serviceRetireErrorMessage: string | null = null;
  let serviceRetireErrorCode: string | null = null;
  let serviceRetireErrorStatus: string | null = null;
  let currentDeviceRowId: string | null = null;
  let retireTargetIds: string[] | null = null;

  try {
    const payload = (await response.json()) as {
      code?: string;
      error?: string;
      exact400ReasonCode?: DmE2eeBootstrap400ReasonCode | null;
      failedValidationBranch?: DmE2eeBootstrapFailedValidationBranch | null;
      exactFailurePoint?: string | null;
      authRetireAttempted?: boolean | null;
      authRetireFailed?: boolean | null;
      serviceRetireAvailable?: boolean | null;
      serviceRetireSkipReason?: string | null;
      serviceRetireAttempted?: boolean | null;
      serviceRetireSucceeded?: boolean | null;
      serviceRetireFailed?: boolean | null;
      serviceRetireErrorMessage?: string | null;
      serviceRetireErrorCode?: string | null;
      serviceRetireErrorStatus?: string | null;
      currentDeviceRowId?: string | null;
      retireTargetIds?: string[] | null;
    };
    errorCode = payload.code ?? null;
    errorMessage = payload.error ?? null;
    exact400ReasonCode = payload.exact400ReasonCode ?? null;
    failedValidationBranch = payload.failedValidationBranch ?? null;
    exactFailurePoint = payload.exactFailurePoint ?? null;
    authRetireAttempted = payload.authRetireAttempted ?? null;
    authRetireFailed = payload.authRetireFailed ?? null;
    serviceRetireAvailable = payload.serviceRetireAvailable ?? null;
    serviceRetireSkipReason = payload.serviceRetireSkipReason ?? null;
    serviceRetireAttempted = payload.serviceRetireAttempted ?? null;
    serviceRetireSucceeded = payload.serviceRetireSucceeded ?? null;
    serviceRetireFailed = payload.serviceRetireFailed ?? null;
    serviceRetireErrorMessage = payload.serviceRetireErrorMessage ?? null;
    serviceRetireErrorCode = payload.serviceRetireErrorCode ?? null;
    serviceRetireErrorStatus = payload.serviceRetireErrorStatus ?? null;
    currentDeviceRowId = payload.currentDeviceRowId ?? null;
    retireTargetIds = payload.retireTargetIds ?? null;
  } catch {
    errorCode = null;
    errorMessage = null;
    exact400ReasonCode = null;
    failedValidationBranch = null;
    exactFailurePoint = null;
    authRetireAttempted = null;
    authRetireFailed = null;
    serviceRetireAvailable = null;
    serviceRetireSkipReason = null;
    serviceRetireAttempted = null;
    serviceRetireSucceeded = null;
    serviceRetireFailed = null;
    serviceRetireErrorMessage = null;
    serviceRetireErrorCode = null;
    serviceRetireErrorStatus = null;
    currentDeviceRowId = null;
    retireTargetIds = null;
  }
    logDmE2eeBootstrapClientDiagnostics('publish:error', {
    errorCode,
    errorMessage,
    exact400ReasonCode,
    failedValidationBranch,
    exactFailurePoint,
    authRetireAttempted,
    authRetireFailed,
    serviceRetireAvailable,
    serviceRetireSkipReason,
    serviceRetireAttempted,
    serviceRetireSucceeded,
    serviceRetireFailed,
    serviceRetireErrorMessage,
    serviceRetireErrorCode,
    serviceRetireErrorStatus,
    currentDeviceRowId,
    retireTargetIds,
    publishAttempt,
    status: response.status,
  });

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
      logDmE2eeBootstrapClientDiagnostics('local-record:repair:start', {
        exact400ReasonCode,
        failedValidationBranch:
          failedValidationBranch ?? 'incomplete local state',
        exactFailurePoint,
        reason: 'server-reported-local-state-incomplete',
      });
      await deleteLocalDmE2eeDeviceRecord(userId);
      logDmE2eeBootstrapClientDiagnostics('local-record:repair:retry', {
        exact400ReasonCode,
        failedValidationBranch: 'failed republish',
        allowRepair: false,
        forcePublish: true,
        publishAttempt: 'repair-republish',
      });
      return ensureDmE2eeDeviceRegistered(userId, {
        forcePublish: true,
        allowRepair: false,
        publishAttempt: 'repair-republish',
      });
    }

      logDmE2eeBootstrapClientDiagnostics('local-record:repair:failed', {
      errorCode,
      errorMessage,
      exact400ReasonCode,
      failedValidationBranch: failedValidationBranch ?? 'failed republish',
      exactFailurePoint,
    });
    throw createLocalDmE2eeError(
      'dm_e2ee_local_state_incomplete',
      errorMessage || 'Local DM E2EE setup is incomplete on this device.',
      {
        exact400ReasonCode,
        failedValidationBranch: failedValidationBranch ?? 'failed republish',
        exactFailurePoint,
        authRetireAttempted,
        authRetireFailed,
        serviceRetireAvailable,
        serviceRetireSkipReason,
        serviceRetireAttempted,
        serviceRetireSucceeded,
        serviceRetireFailed,
        serviceRetireErrorMessage,
        serviceRetireErrorCode,
        serviceRetireErrorStatus,
        currentDeviceRowId,
        retireTargetIds,
      },
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
