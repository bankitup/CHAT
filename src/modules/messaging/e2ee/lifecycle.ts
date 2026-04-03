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

export async function clearAllLocalDmE2eeState() {
  if (!supportsBrowserStateCleanup()) {
    return;
  }

  clearAllLocalEncryptedDmPreviews();

  if (typeof window.indexedDB !== 'undefined') {
    await clearAllLocalDmE2eeDeviceRecords();
  }
}

export async function clearLocalDmE2eeStateForUser(userId: string) {
  if (!supportsBrowserStateCleanup()) {
    return;
  }

  clearLocalEncryptedDmPreviewsForUser(userId);

  if (typeof window.indexedDB !== 'undefined') {
    await deleteLocalDmE2eeDeviceRecord(userId);
  }
}

export async function keepOnlyLocalDmE2eeStateForUser(userId: string) {
  if (!supportsBrowserStateCleanup()) {
    return;
  }

  clearLocalEncryptedDmPreviewsExceptUser(userId);

  if (typeof window.indexedDB !== 'undefined') {
    await clearLocalDmE2eeDeviceRecordsExcept(userId);
  }
}

export async function reinitializeLocalDmE2eeStateForUser(userId: string) {
  await clearLocalDmE2eeStateForUser(userId);
  return ensureDmE2eeDeviceRegistered(userId, { forcePublish: true });
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
