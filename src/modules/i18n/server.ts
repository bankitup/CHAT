import 'server-only';

import { cache } from 'react';
import { cookies } from 'next/headers';
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_COOKIE_NAME,
  type AppLanguage,
  normalizeLanguage,
} from './index';

const getCookieLanguageCached = cache(async () => {
  const cookieStore = await cookies();
  return normalizeLanguage(cookieStore.get(LANGUAGE_COOKIE_NAME)?.value);
});

export async function getCookieLanguage() {
  return getCookieLanguageCached();
}

export async function setLanguageCookie(language: AppLanguage) {
  const cookieStore = await cookies();
  cookieStore.set(LANGUAGE_COOKIE_NAME, language, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  });
}

export async function getRequestLanguage(fallback?: string | null) {
  if (fallback) {
    return normalizeLanguage(fallback);
  }

  const cookieLanguage = await getCookieLanguageCached();
  return cookieLanguage ?? DEFAULT_LANGUAGE;
}
