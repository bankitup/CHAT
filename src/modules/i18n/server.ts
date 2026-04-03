import 'server-only';

import { cookies } from 'next/headers';
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_COOKIE_NAME,
  type AppLanguage,
  normalizeLanguage,
} from './index';

export async function getCookieLanguage() {
  const cookieStore = await cookies();
  return normalizeLanguage(cookieStore.get(LANGUAGE_COOKIE_NAME)?.value);
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

  const cookieLanguage = await getCookieLanguage();
  return cookieLanguage ?? DEFAULT_LANGUAGE;
}
