'use client';

import {
  clearAllLocalDmE2eeDeviceRecords,
  clearLocalDmE2eeDeviceRecordsExcept,
  deleteLocalDmE2eeDeviceRecord,
} from './device-store';
import {
  clearAllLocalEncryptedDmPreviews,
  clearLocalEncryptedDmPreview,
  clearLocalEncryptedDmPreviewsExceptUser,
  clearLocalEncryptedDmPreviewsForUser,
} from './preview-cache';
import { ensureDmE2eeDeviceRegistered } from './device-registration';

function supportsBrowserStateCleanup() {
  return typeof window !== 'undefined';
}

function logDmE2eeLifecycleDiagnostics(
  stage: string,
  details?: Record<string, unknown>,
) {
  if (
    typeof window === 'undefined' ||
    process.env.NEXT_PUBLIC_CHAT_DEBUG_DM_E2EE_BOOTSTRAP !== '1'
  ) {
    return;
  }

  if (details) {
    console.info('[dm-e2ee-lifecycle]', stage, details);
    return;
  }

  console.info('[dm-e2ee-lifecycle]', stage);
}

async function resetServerDmE2eeStateForCurrentDevice() {
  const response = await fetch('/api/messaging/dm-e2ee/reset-device', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  const payload = (await response.json()) as {
    error?: string;
    foundDevice?: boolean;
    clearedPrekeys?: number;
    retiredDevice?: boolean;
  };

  if (!response.ok) {
    throw new Error(
      payload.error || 'Unable to reset encrypted setup on the server.',
    );
  }

  return {
    foundDevice: Boolean(payload.foundDevice),
    clearedPrekeys: Number(payload.clearedPrekeys ?? 0),
    retiredDevice: Boolean(payload.retiredDevice),
  };
}

export async function clearAllLocalDmE2eeState() {
  if (!supportsBrowserStateCleanup()) {
    return;
  }

  try {
    clearAllLocalEncryptedDmPreviews();

    if (typeof window.indexedDB !== 'undefined') {
      await clearAllLocalDmE2eeDeviceRecords();
    }
  } catch (error) {
    console.error('Unable to clear local DM E2EE state.', error);
  }
}

export async function clearLocalDmE2eeStateForUser(userId: string) {
  if (!supportsBrowserStateCleanup()) {
    return;
  }

  try {
    clearLocalEncryptedDmPreviewsForUser(userId);

    if (typeof window.indexedDB !== 'undefined') {
      await deleteLocalDmE2eeDeviceRecord(userId);
    }
  } catch (error) {
    console.error('Unable to clear local DM E2EE user state.', error);
  }
}

export async function keepOnlyLocalDmE2eeStateForUser(userId: string) {
  if (!supportsBrowserStateCleanup()) {
    return;
  }

  try {
    clearLocalEncryptedDmPreviewsExceptUser(userId);

    if (typeof window.indexedDB !== 'undefined') {
      await clearLocalDmE2eeDeviceRecordsExcept(userId);
    }
  } catch (error) {
    console.error('Unable to prune local DM E2EE state.', error);
  }
}

export async function reinitializeLocalDmE2eeStateForUser(userId: string) {
  logDmE2eeLifecycleDiagnostics('reinitialize:start', {
    userIdPresent: Boolean(userId),
  });
  await clearLocalDmE2eeStateForUser(userId);
  const result = await ensureDmE2eeDeviceRegistered(userId, {
    forcePublish: true,
  });
  logDmE2eeLifecycleDiagnostics('reinitialize:done', {
    status: result.status,
    published: Boolean(result.result?.deviceRecordId),
  });
  return result;
}

export async function hardResetDmE2eeStateForCurrentDevice(userId: string) {
  logDmE2eeLifecycleDiagnostics('hard-reset:start', {
    userIdPresent: Boolean(userId),
  });
  await clearAllLocalDmE2eeState();
  logDmE2eeLifecycleDiagnostics('hard-reset:local-cleared');
  const serverReset = await resetServerDmE2eeStateForCurrentDevice();
  logDmE2eeLifecycleDiagnostics('hard-reset:server-cleared', serverReset);
  logDmE2eeLifecycleDiagnostics('hard-reset:bootstrap-rerun:start');
  const result = await ensureDmE2eeDeviceRegistered(userId, {
    forcePublish: true,
    publishAttempt: 'manual-refresh',
  });
  logDmE2eeLifecycleDiagnostics('hard-reset:done', {
    status: result.status,
    published: Boolean(result.result?.deviceRecordId),
  });
  return result;
}

export function invalidateEncryptedDmPreviewForConversation(
  userId: string,
  conversationId: string,
) {
  if (!supportsBrowserStateCleanup()) {
    return;
  }

  clearLocalEncryptedDmPreview(userId, conversationId);
}
