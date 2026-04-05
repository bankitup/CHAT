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
import {
  logControlledUiError,
  sanitizeUserFacingErrorMessage,
} from '@/modules/messaging/ui/user-facing-errors';

function redirectWithMessage(
  kind: 'error' | 'message',
  value: string,
): never {
  const params = new URLSearchParams({ [kind]: value });
  redirect(`/settings?${params.toString()}`);
}

function getProfileSettingsErrorMessage(
  error: unknown,
  fallbackMessage: string,
  storageUnavailableMessage: string,
) {
  const rawMessage = error instanceof Error ? error.message : '';
  const normalized = rawMessage.toLowerCase();

  if (normalized.includes('avatar uploads are not available right now')) {
    return storageUnavailableMessage;
  }

  if (
    normalized.includes('row-level security policy') ||
    normalized.includes('profiles rls') ||
    normalized.includes('avatar upload path is invalid') ||
    normalized.includes('no authenticated user') ||
    normalized.includes('user mismatch')
  ) {
    return fallbackMessage;
  }

  return rawMessage || fallbackMessage;
}

export async function updateProfileAction(formData: FormData) {
  const language = await getRequestLanguage();
  const t = getTranslations(language);
  const displayName = String(formData.get('displayName') ?? '').trim();
  const avatarObjectPath =
    String(formData.get('avatarObjectPath') ?? '').trim() || null;
  const removeAvatar = String(formData.get('removeAvatar') ?? '').trim() === '1';
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
      avatarObjectPath,
      avatarFile,
      removeAvatar,
    });
  } catch (error) {
    redirectWithMessage(
      'error',
      getProfileSettingsErrorMessage(
        error,
        t.settings.profileUpdateFailed,
        t.settings.avatarStorageUnavailable,
      ),
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
      getProfileSettingsErrorMessage(
        error,
        t.settings.profileUpdateFailed,
        t.settings.avatarStorageUnavailable,
      ),
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
    const rawMessage =
      error instanceof Error ? error.message : 'Unable to update language.';
    const fallbackMessage =
      preferredLanguage === 'ru'
        ? 'Не удалось обновить язык. Попробуйте еще раз.'
        : 'Unable to update language right now. Please try again.';

    logControlledUiError({
      fallback: fallbackMessage,
      rawMessage,
      surface: 'settings:update-language',
    });

    redirectWithMessage(
      'error',
      sanitizeUserFacingErrorMessage({
        fallback: fallbackMessage,
        language: preferredLanguage,
        rawMessage,
      }),
    );
  }

  redirectWithMessage('message', t.settings.languageUpdated);
}
