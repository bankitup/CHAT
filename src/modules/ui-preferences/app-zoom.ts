export const APP_ZOOM_COOKIE_NAME = 'chat_app_zoom';
export const DEFAULT_APP_ZOOM_MODE = 'standard';
export const SUPPORTED_APP_ZOOM_MODES = [
  'standard',
  'larger',
  'largest',
] as const;

export type AppZoomMode = (typeof SUPPORTED_APP_ZOOM_MODES)[number];

export function normalizeAppZoomMode(value?: string | null): AppZoomMode {
  return SUPPORTED_APP_ZOOM_MODES.includes(value as AppZoomMode)
    ? (value as AppZoomMode)
    : DEFAULT_APP_ZOOM_MODE;
}

export function applyAppZoomModeToDocument(mode: AppZoomMode) {
  if (typeof document === 'undefined') {
    return;
  }

  document.documentElement.dataset.appZoom = mode;
}
