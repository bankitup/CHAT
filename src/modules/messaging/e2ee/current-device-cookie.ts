export const DM_E2EE_CURRENT_DEVICE_COOKIE =
  'chat_dm_e2ee_current_device_row_id';

function isBrowser() {
  return typeof document !== 'undefined';
}

export function persistCurrentDmE2eeDeviceCookie(
  deviceRecordId: string | null | undefined,
) {
  if (!isBrowser()) {
    return;
  }

  const normalized = deviceRecordId?.trim() ?? '';

  if (!normalized) {
    document.cookie = `${DM_E2EE_CURRENT_DEVICE_COOKIE}=; path=/; max-age=0; samesite=lax`;
    return;
  }

  document.cookie = `${DM_E2EE_CURRENT_DEVICE_COOKIE}=${encodeURIComponent(normalized)}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
}

export function clearCurrentDmE2eeDeviceCookie() {
  persistCurrentDmE2eeDeviceCookie(null);
}
