'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getStoredProfileLanguage } from '@/modules/messaging/data/server';
import { LANGUAGE_COOKIE_NAME } from '@/modules/i18n';
import { resolveChatsHrefForUser } from '@/modules/spaces/server';

function readFormValue(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === 'string' ? value.trim() : '';
}

function redirectWithMessage(
  path: '/login',
  type: 'error' | 'message',
  value: string,
) {
  const params = new URLSearchParams({ [type]: value });
  redirect(`${path}?${params.toString()}`);
}

export async function loginAction(formData: FormData) {
  const email = readFormValue(formData, 'email');
  const password = readFormValue(formData, 'password');

  if (!email || !password) {
    redirectWithMessage('/login', 'error', 'Email and password are required.');
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    redirectWithMessage('/login', 'error', error.message);
  }

  const profileLanguage = data.user?.id
    ? await getStoredProfileLanguage(data.user.id)
    : null;

  if (profileLanguage) {
    const cookieStore = await cookies();
    cookieStore.set(LANGUAGE_COOKIE_NAME, profileLanguage, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
    });
  }

  const nextHref = data.user?.id
    ? await resolveChatsHrefForUser({
        userId: data.user.id,
        source: 'login-action',
      })
    : '/spaces';

  redirect(nextHref);
}
