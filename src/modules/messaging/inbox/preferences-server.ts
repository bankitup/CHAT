import { cookies } from 'next/headers';
import {
  INBOX_SECTION_PREFERENCES_COOKIE,
  parseInboxSectionPreferencesCookie,
  serializeInboxSectionPreferences,
  type InboxSectionPreferences,
} from './preferences';

export async function getInboxSectionPreferences() {
  const cookieStore = await cookies();
  return parseInboxSectionPreferencesCookie(
    cookieStore.get(INBOX_SECTION_PREFERENCES_COOKIE)?.value,
  );
}

export async function setInboxSectionPreferencesCookie(
  value: InboxSectionPreferences,
) {
  const cookieStore = await cookies();
  cookieStore.set(INBOX_SECTION_PREFERENCES_COOKIE, serializeInboxSectionPreferences(value), {
    httpOnly: false,
    maxAge: 60 * 60 * 24 * 365,
    path: '/',
    sameSite: 'lax',
  });
}
