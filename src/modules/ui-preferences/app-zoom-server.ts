import 'server-only';

import { cache } from 'react';
import { cookies } from 'next/headers';
import {
  APP_ZOOM_COOKIE_NAME,
  DEFAULT_APP_ZOOM_MODE,
  normalizeAppZoomMode,
  type AppZoomMode,
} from './app-zoom';

const getCookieAppZoomModeCached = cache(async () => {
  const cookieStore = await cookies();
  return normalizeAppZoomMode(cookieStore.get(APP_ZOOM_COOKIE_NAME)?.value);
});

export async function getCookieAppZoomMode() {
  return getCookieAppZoomModeCached();
}

export async function getRequestAppZoomMode() {
  return (await getCookieAppZoomModeCached()) ?? DEFAULT_APP_ZOOM_MODE;
}

export async function setAppZoomCookie(mode: AppZoomMode) {
  const cookieStore = await cookies();
  cookieStore.set(APP_ZOOM_COOKIE_NAME, mode, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  });
}
