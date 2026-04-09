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
import { persistCurrentDmE2eeDeviceCookie } from './current-device-cookie';

const ONE_TIME_PREKEY_BATCH_SIZE = 12;

type DmE2eeBootstrapStatus =
  | 'registered'
  | 'unsupported'
  | 'schema-missing';

type EnsureDmE2eeDeviceRegisteredOptions = {
  forcePublish?: boolean;
  allowRepair?: boolean;
  publishAttempt?: 'initial' | 'manual-refresh' | 'repair-republish';
  triggerReason?:
    | 'boundary-initial'
    | 'boundary-focus'
    | 'boundary-visibility'
    | 'boundary-delayed-retry'
    | 'composer-send'
    | 'reinitialize'
    | 'hard-reset'
    | 'bootstrap-component'
    | 'unknown';
};

type DmE2eeServerDeviceState = {
  activeDeviceRowIds: string[];
  activeDeviceRowCount: number;
  availableOneTimePrekeyCount: number;
  hasActiveDevice: boolean;
  hasSignedPrekey: boolean;
};

type EnsureDmE2eeDeviceRegisteredResult = {
  status: DmE2eeBootstrapStatus;
  result: PublishDmE2eeDeviceResult | null;
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

const ensureDmE2eeDeviceRegistrationInflight = new Map<
  string,
  Promise<EnsureDmE2eeDeviceRegisteredResult>
>();
const ROUTINE_READY_INSPECTION_CACHE_MS = 20_000;
const recentReadyDmE2eeInspectionByUser = new Map<
  string,
  {
    checkedAt: number;
    serverDeviceRecordId: string;
    activeDeviceRowCount: number;
    availableOneTimePrekeyCount: number;
    hasSignedPrekey: boolean;
  }
>();

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

function isRoutineBootstrapTriggerReason(
  triggerReason: EnsureDmE2eeDeviceRegisteredOptions['triggerReason'],
) {
  return (
    triggerReason === 'boundary-focus' || triggerReason === 'boundary-visibility'
  );
}

function rememberRecentReadyDmE2eeInspection(input: {
  userId: string;
  serverDeviceRecordId: string;
  serverState: DmE2eeServerDeviceState;
}) {
  recentReadyDmE2eeInspectionByUser.set(input.userId, {
    checkedAt: Date.now(),
    serverDeviceRecordId: input.serverDeviceRecordId,
    activeDeviceRowCount: input.serverState.activeDeviceRowCount,
    availableOneTimePrekeyCount: input.serverState.availableOneTimePrekeyCount,
    hasSignedPrekey: input.serverState.hasSignedPrekey,
  });
}

function clearRecentReadyDmE2eeInspection(userId: string) {
  recentReadyDmE2eeInspectionByUser.delete(userId);
}

function shouldResetLocalDmE2eeRecordForBootstrapRepair(input: {
  exact400ReasonCode: DmE2eeBootstrap400ReasonCode | null;
}) {
  // Resetting IndexedDB state creates a brand-new DM device identity and can
  // strand older encrypted history on the previous device record. Only do that
  // when the server explicitly reports a malformed local bootstrap payload.
  return input.exact400ReasonCode === 'bad payload';
}

function getReusableRecentReadyDmE2eeInspection(input: {
  userId: string;
  triggerReason: EnsureDmE2eeDeviceRegisteredOptions['triggerReason'];
  serverDeviceRecordId: string | null;
}) {
  if (
    !input.serverDeviceRecordId ||
    !isRoutineBootstrapTriggerReason(input.triggerReason)
  ) {
    return null;
  }

  const recent = recentReadyDmE2eeInspectionByUser.get(input.userId);

  if (!recent) {
    return null;
  }

  if (recent.serverDeviceRecordId !== input.serverDeviceRecordId) {
    return null;
  }

  if (Date.now() - recent.checkedAt > ROUTINE_READY_INSPECTION_CACHE_MS) {
    recentReadyDmE2eeInspectionByUser.delete(input.userId);
    return null;
  }

  return recent;
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

export async function inspectCurrentUserDmE2eeDeviceState(input?: {
  reason?: string;
}): Promise<CurrentDmE2eeDeviceInspection> {
  const response = await fetch('/api/messaging/dm-e2ee/device', {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      ...(input?.reason
        ? {
            'X-Chat-Dm-E2ee-Inspect-Reason': input.reason,
          }
        : {}),
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
): Promise<EnsureDmE2eeDeviceRegisteredResult> {
  const inflight = ensureDmE2eeDeviceRegistrationInflight.get(userId);

  if (inflight) {
    logDmE2eeBootstrapClientDiagnostics('ensure:join-inflight', {
      forcePublish: Boolean(options.forcePublish),
      publishAttempt:
        options.publishAttempt ??
        (options.forcePublish ? 'manual-refresh' : 'initial'),
      triggerReason: options.triggerReason ?? 'unknown',
      userIdPresent: Boolean(userId),
    });
    return inflight;
  }

  const run = async (): Promise<EnsureDmE2eeDeviceRegisteredResult> => {
    const allowRepair = options.allowRepair !== false;
    const publishAttempt =
      options.publishAttempt ??
      (options.forcePublish ? 'manual-refresh' : 'initial');
    const triggerReason = options.triggerReason ?? 'unknown';
    logDmE2eeBootstrapClientDiagnostics('ensure:start', {
      allowRepair,
      forcePublish: Boolean(options.forcePublish),
      publishAttempt,
      triggerReason,
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
      triggerReason,
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
      const recentReadyInspection = getReusableRecentReadyDmE2eeInspection({
        userId,
        triggerReason,
        serverDeviceRecordId: localRecord.serverDeviceRecordId,
      });

      if (recentReadyInspection) {
        logDmE2eeBootstrapClientDiagnostics('inspect:skip-recent-ready', {
          activeDeviceRowCount: recentReadyInspection.activeDeviceRowCount,
          availableOneTimePrekeyCount:
            recentReadyInspection.availableOneTimePrekeyCount,
          currentUserId: userId,
          hasSignedPrekey: recentReadyInspection.hasSignedPrekey,
          localServerDeviceRecordId: localRecord.serverDeviceRecordId,
          triggerReason,
        });
        persistCurrentDmE2eeDeviceCookie(localRecord.serverDeviceRecordId);
        return {
          status: 'registered',
          result: {
            deviceRecordId: localRecord.serverDeviceRecordId,
            publishedPrekeyCount: 0,
            resultKind: 'already_initialized_same_device',
          },
        } satisfies {
          status: DmE2eeBootstrapStatus;
          result: PublishDmE2eeDeviceResult;
        };
      }

      const serverState = await inspectCurrentUserDmE2eeDeviceState({
        reason: triggerReason,
      });

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
        clearRecentReadyDmE2eeInspection(userId);
        logDmE2eeBootstrapClientDiagnostics('publish:stale-server-state', {
          activeDeviceRowCount: serverState.state.activeDeviceRowCount,
          availableOneTimePrekeyCount:
            serverState.state.availableOneTimePrekeyCount,
          currentUserId: userId,
          hasSignedPrekey: serverState.state.hasSignedPrekey,
          localServerDeviceRecordId: localRecord.serverDeviceRecordId,
          activeDeviceRowIds: serverState.state.activeDeviceRowIds,
          hasActiveDevice: serverState.state.hasActiveDevice,
          triggerReason,
        });
      } else {
        rememberRecentReadyDmE2eeInspection({
          userId,
          serverDeviceRecordId: localRecord.serverDeviceRecordId,
          serverState: serverState.state,
        });
        logDmE2eeBootstrapClientDiagnostics('publish:skip-already-registered', {
          activeDeviceRowCount: serverState.state.activeDeviceRowCount,
          availableOneTimePrekeyCount:
            serverState.state.availableOneTimePrekeyCount,
          currentUserId: userId,
          hasSignedPrekey: serverState.state.hasSignedPrekey,
          resultKind: 'already_initialized_same_device',
          reusedExistingServerDeviceRecordId: localRecord.serverDeviceRecordId,
          serverDeviceRecordIdPresent: true,
          triggerReason,
        });
        persistCurrentDmE2eeDeviceCookie(localRecord.serverDeviceRecordId);
        return {
          status: 'registered',
          result: {
            deviceRecordId: localRecord.serverDeviceRecordId,
            publishedPrekeyCount: 0,
            resultKind: 'already_initialized_same_device',
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
        'X-Chat-Dm-E2ee-Trigger-Reason': triggerReason,
      },
      body: JSON.stringify(buildPublishRequest(localRecord)),
    });

    if (response.ok) {
      const result = (await response.json()) as PublishDmE2eeDeviceResult;
      logDmE2eeBootstrapClientDiagnostics('publish:ok', {
        currentUserId: userId,
        resultKind: result.resultKind ?? 'refresh_existing_device',
        previousServerDeviceRecordId: localRecord.serverDeviceRecordId,
        sameServerDeviceRecordReused:
          localRecord.serverDeviceRecordId === result.deviceRecordId,
        deviceRecordIdPresent: Boolean(result.deviceRecordId),
        serverDeviceRecordId: result.deviceRecordId,
        publishedPrekeyCount: result.publishedPrekeyCount,
        triggerReason,
      });
      await saveLocalDmE2eeDeviceRecord({
        ...localRecord,
        serverDeviceRecordId: result.deviceRecordId,
        lastPublishedAt: new Date().toISOString(),
      });
      persistCurrentDmE2eeDeviceCookie(result.deviceRecordId);

      const verifiedServerState = await inspectCurrentUserDmE2eeDeviceState({
        reason: `${triggerReason}:verify`,
      });

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
        triggerReason,
      });

      if (
        allowRepair &&
        publishAttempt !== 'repair-republish' &&
        !isServerDmE2eeDeviceStateReady(
          verifiedServerState.state,
          result.deviceRecordId,
        )
      ) {
        clearRecentReadyDmE2eeInspection(userId);
        logDmE2eeBootstrapClientDiagnostics('publish:verify-repair:retry', {
          activeDeviceRowCount: verifiedServerState.state.activeDeviceRowCount,
          availableOneTimePrekeyCount:
            verifiedServerState.state.availableOneTimePrekeyCount,
          currentUserId: userId,
          hasSignedPrekey: verifiedServerState.state.hasSignedPrekey,
          publishAttempt: 'repair-republish',
          serverDeviceRecordId: result.deviceRecordId,
          triggerReason,
        });
        return ensureDmE2eeDeviceRegistered(userId, {
          allowRepair: false,
          forcePublish: true,
          publishAttempt: 'repair-republish',
          triggerReason,
        });
      }

      if (
        isServerDmE2eeDeviceStateReady(
          verifiedServerState.state,
          result.deviceRecordId,
        )
      ) {
        rememberRecentReadyDmE2eeInspection({
          userId,
          serverDeviceRecordId: result.deviceRecordId,
          serverState: verifiedServerState.state,
        });
      } else {
        clearRecentReadyDmE2eeInspection(userId);
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
      triggerReason,
    });
    clearRecentReadyDmE2eeInspection(userId);

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
      const shouldResetLocalRecord =
        shouldResetLocalDmE2eeRecordForBootstrapRepair({
          exact400ReasonCode,
        });

      if (allowRepair && shouldResetLocalRecord) {
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
          triggerReason,
        });
      }

      if (allowRepair && !shouldResetLocalRecord) {
        logDmE2eeBootstrapClientDiagnostics('local-record:repair:preserved', {
          exact400ReasonCode,
          failedValidationBranch:
            failedValidationBranch ?? 'incomplete local state',
          exactFailurePoint,
          reason: 'preserve-history-continuity',
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
  };

  const pending: Promise<EnsureDmE2eeDeviceRegisteredResult> = run().finally(() => {
    ensureDmE2eeDeviceRegistrationInflight.delete(userId);
  });
  ensureDmE2eeDeviceRegistrationInflight.set(userId, pending);
  return pending;
}

export async function markLocalDmE2eeDeviceRegistrationStale(userId: string) {
  clearRecentReadyDmE2eeInspection(userId);
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
