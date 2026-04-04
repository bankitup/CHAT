'use server';

import { getTranslations, normalizeLanguage } from '@/modules/i18n';
import { getRequestLanguage, setLanguageCookie } from '@/modules/i18n/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  removeCurrentUserAvatar,
  updateCurrentUserLanguagePreference,
  updateCurrentUserProfile,
} from '@/modules/messaging/data/server';

function redirectWithMessage(
  kind: 'error' | 'message',
  value: string,
): never {
  const params = new URLSearchParams({ [kind]: value });
  redirect(`/settings?${params.toString()}`);
}

export async function updateProfileAction(formData: FormData) {
  const language = await getRequestLanguage();
  const t = getTranslations(language);
  const displayName = String(formData.get('displayName') ?? '').trim();
  const avatarEntry = formData.get('avatar');
  const avatarFile =
    avatarEntry instanceof File && avatarEntry.size > 0 ? avatarEntry : null;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    redirectWithMessage('error', t.login.managedAccess);
  }

  try {
    await updateCurrentUserProfile({
      userId: user.id,
      displayName: displayName || null,
      avatarFile,
    });
  } catch (error) {
    redirectWithMessage(
      'error',
      error instanceof Error ? error.message : 'Unable to update your profile.',
    );
  }

  revalidatePath('/settings');
  revalidatePath('/inbox');
  revalidatePath('/activity');
  revalidatePath('/', 'layout');
  redirectWithMessage('message', t.settings.profileUpdated);
}

export async function removeAvatarAction() {
  const language = await getRequestLanguage();
  const t = getTranslations(language);
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    redirectWithMessage('error', t.login.managedAccess);
  }

  try {
    await removeCurrentUserAvatar(user.id);
  } catch (error) {
    redirectWithMessage(
      'error',
      error instanceof Error ? error.message : 'Unable to update your profile.',
    );
  }

  revalidatePath('/settings');
  revalidatePath('/inbox');
  revalidatePath('/activity');
  revalidatePath('/', 'layout');
  redirectWithMessage('message', t.settings.profileUpdated);
}

export async function updateLanguagePreferenceAction(formData: FormData) {
  const preferredLanguage = normalizeLanguage(
    String(formData.get('preferredLanguage') ?? '').trim(),
  );
  const t = getTranslations(preferredLanguage);
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    redirectWithMessage('error', t.login.managedAccess);
  }

  try {
    await updateCurrentUserLanguagePreference({
      userId: user.id,
      preferredLanguage,
    });
    await setLanguageCookie(preferredLanguage);
  } catch (error) {
    redirectWithMessage(
      'error',
      error instanceof Error ? error.message : 'Unable to update language.',
    );
  }

  redirectWithMessage('message', t.settings.languageUpdated);
}
