'use server';

import { getTranslations, normalizeLanguage } from '@/modules/i18n';
import { getRequestLanguage, setLanguageCookie } from '@/modules/i18n/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getRequestViewer } from '@/lib/request-context/server';
import {
  removeCurrentUserAvatar,
  updateCurrentUserLanguagePreference,
  updateCurrentUserProfile,
  updateCurrentUserStatus,
} from '@/modules/messaging/data/server';
import {
  logControlledUiError,
  sanitizeUserFacingErrorMessage,
} from '@/modules/messaging/ui/user-facing-errors';

function readOptionalText(formData: FormData, key: string) {
  const normalized = String(formData.get(key) ?? '').trim();
  return normalized.length > 0 ? normalized : null;
}

function redirectWithMessage(input: {
  destination?: 'home' | 'settings';
  kind: 'error' | 'message';
  value: string;
  spaceId?: string | null;
}): never {
  const params = new URLSearchParams({ [input.kind]: input.value });

  if (input.spaceId) {
    params.set('space', input.spaceId);
  }

  redirect(
    input.destination === 'home'
      ? `/home?${params.toString()}`
      : `/settings?${params.toString()}`,
  );
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
  const spaceId = readOptionalText(formData, 'spaceId');
  const redirectSurface =
    readOptionalText(formData, 'redirectSurface') === 'home'
      ? 'home'
      : 'settings';
  const avatarObjectPath =
    String(formData.get('avatarObjectPath') ?? '').trim() || null;
  const removeAvatar = String(formData.get('removeAvatar') ?? '').trim() === '1';
  const avatarEntry = formData.get('avatar');
  const avatarFile =
    avatarEntry instanceof File && avatarEntry.size > 0 ? avatarEntry : null;

  const user = await getRequestViewer();

  if (!user?.id) {
    redirectWithMessage({
      destination: redirectSurface,
      kind: 'error',
      spaceId,
      value: t.login.managedAccess,
    });
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
    redirectWithMessage({
      destination: redirectSurface,
      kind: 'error',
      spaceId,
      value: getProfileSettingsErrorMessage(
        error,
        t.settings.profileUpdateFailed,
        t.settings.avatarStorageUnavailable,
      ),
    });
  }

  revalidatePath('/home');
  revalidatePath('/settings');
  revalidatePath('/inbox');
  revalidatePath('/activity');
  revalidatePath('/', 'layout');
  redirectWithMessage({
    destination: redirectSurface,
    kind: 'message',
    spaceId,
    value: t.settings.profileUpdated,
  });
}

export async function removeAvatarAction() {
  const language = await getRequestLanguage();
  const t = getTranslations(language);
  const user = await getRequestViewer();

  if (!user?.id) {
    redirectWithMessage({
      kind: 'error',
      value: t.login.managedAccess,
    });
  }

  try {
    await removeCurrentUserAvatar(user.id);
  } catch (error) {
    redirectWithMessage({
      kind: 'error',
      value: getProfileSettingsErrorMessage(
        error,
        t.settings.profileUpdateFailed,
        t.settings.avatarStorageUnavailable,
      ),
    });
  }

  revalidatePath('/settings');
  revalidatePath('/inbox');
  revalidatePath('/activity');
  revalidatePath('/', 'layout');
  redirectWithMessage({
    kind: 'message',
    value: t.settings.profileUpdated,
  });
}

export async function updateLanguagePreferenceAction(formData: FormData) {
  const preferredLanguage = normalizeLanguage(
    String(formData.get('preferredLanguage') ?? '').trim(),
  );
  const t = getTranslations(preferredLanguage);
  const user = await getRequestViewer();

  if (!user?.id) {
    redirectWithMessage({
      kind: 'error',
      value: t.login.managedAccess,
    });
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

    redirectWithMessage({
      kind: 'error',
      value: sanitizeUserFacingErrorMessage({
        fallback: fallbackMessage,
        language: preferredLanguage,
        rawMessage,
      }),
    });
  }

  redirectWithMessage({
    kind: 'message',
    value: t.settings.languageUpdated,
  });
}

export async function updateProfileStatusAction(formData: FormData) {
  const language = await getRequestLanguage();
  const t = getTranslations(language);
  const statusEmoji = String(formData.get('statusEmoji') ?? '').trim();
  const statusText = String(formData.get('statusText') ?? '').trim();
  const spaceId = readOptionalText(formData, 'spaceId');
  const redirectSurface =
    readOptionalText(formData, 'redirectSurface') === 'home'
      ? 'home'
      : 'settings';
  const user = await getRequestViewer();

  if (!user?.id) {
    redirectWithMessage({
      destination: redirectSurface,
      kind: 'error',
      spaceId,
      value: t.login.managedAccess,
    });
  }

  if (statusEmoji.length > 16) {
    redirectWithMessage({
      destination: redirectSurface,
      kind: 'error',
      spaceId,
      value: t.settings.statusEmojiTooLong,
    });
  }

  if (statusText.length > 80) {
    redirectWithMessage({
      destination: redirectSurface,
      kind: 'error',
      spaceId,
      value: t.settings.statusTextTooLong,
    });
  }

  try {
    await updateCurrentUserStatus({
      userId: user.id,
      statusEmoji: statusEmoji || null,
      statusText: statusText || null,
    });
  } catch (error) {
    const rawMessage =
      error instanceof Error ? error.message : t.settings.statusUpdateFailed;
    const safeMessage = sanitizeUserFacingErrorMessage({
      fallback: t.settings.statusUpdateFailed,
      language,
      rawMessage,
    });

    redirectWithMessage({
      destination: redirectSurface,
      kind: 'error',
      spaceId,
      value: safeMessage,
    });
  }

  revalidatePath('/home');
  revalidatePath('/settings');
  revalidatePath('/inbox');
  revalidatePath('/activity');
  revalidatePath('/', 'layout');
  redirectWithMessage({
    destination: redirectSurface,
    kind: 'message',
    spaceId,
    value: t.settings.statusUpdated,
  });
}
