'use server';

import { isRedirectError } from 'next/dist/client/components/redirect-error';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  getTranslations,
  normalizeLanguage,
  type AppLanguage,
} from '@/modules/i18n';
import { getRequestLanguage, setLanguageCookie } from '@/modules/i18n/server';
import { getRequestViewer } from '@/lib/request-context/server';
import { updateCurrentUserLanguagePreference } from '@/modules/messaging/data/server';
import {
  normalizeAppZoomMode,
  type AppZoomMode,
} from '@/modules/ui-preferences/app-zoom';
import { setAppZoomCookie } from '@/modules/ui-preferences/app-zoom-server';
import {
  logControlledUiError,
  sanitizeUserFacingErrorMessage,
} from '@/modules/messaging/ui/user-facing-errors';
import {
  removeMembersFromGovernedSpace,
  requestAdditionalAccountsForGovernedSpace,
  updateGovernedSpaceTheme,
} from '@/modules/spaces/write-server';
import {
  normalizeSpaceTheme,
  type SpaceTheme,
} from '@/modules/spaces/model';

function readText(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

function setTextParam(params: URLSearchParams, key: string, value?: string | null) {
  const normalized = value?.trim() ?? '';

  if (normalized) {
    params.set(key, normalized);
  }
}

function redirectToHomeSurface(input: {
  error?: string | null;
  message?: string | null;
  openParticipants?: boolean;
  spaceId?: string | null;
}): never {
  const params = new URLSearchParams();

  setTextParam(params, 'space', input.spaceId);
  setTextParam(params, 'message', input.message);
  setTextParam(params, 'error', input.error);

  if (input.openParticipants) {
    params.set('participants', 'open');
  }

  const href = params.toString() ? `/home?${params.toString()}` : '/home';
  redirect(href);
}

function getFriendlyHomeErrorMessage(input: {
  error: unknown;
  fallback: string;
  language: AppLanguage;
  surface:
    | 'home:language-preference'
    | 'home:space-theme'
    | 'home:zoom-preference'
    | 'home:participants-remove'
    | 'home:participants-request';
}) {
  const rawMessage =
    input.error instanceof Error ? input.error.message : input.fallback;

  logControlledUiError({
    fallback: input.fallback,
    rawMessage,
    surface: input.surface,
  });

  return sanitizeUserFacingErrorMessage({
    fallback: input.fallback,
    language: input.language,
    rawMessage,
  });
}

export async function saveHomeAppZoomPreferenceAction(input: {
  language: AppLanguage;
  zoomMode: AppZoomMode;
}): Promise<{ ok: true } | { error: string; ok: false }> {
  const language = normalizeLanguage(input.language);
  const t = getTranslations(language);
  const zoomMode = normalizeAppZoomMode(input.zoomMode);

  try {
    await setAppZoomCookie(zoomMode);
    revalidatePath('/', 'layout');
    revalidatePath('/home');

    return { ok: true };
  } catch (error) {
    return {
      error: getFriendlyHomeErrorMessage({
        error,
        fallback: t.zoomSwitcher.saveFailed,
        language,
        surface: 'home:zoom-preference',
      }),
      ok: false,
    };
  }
}

export async function saveHomeSpaceThemeAction(input: {
  language: AppLanguage;
  spaceId: string;
  theme: SpaceTheme;
}): Promise<{ ok: true } | { error: string; ok: false }> {
  const language = normalizeLanguage(input.language);
  const t = getTranslations(language);
  const spaceId = input.spaceId.trim();
  const theme = normalizeSpaceTheme(input.theme) ?? 'dark';
  const user = await getRequestViewer();

  if (!spaceId) {
    return {
      error: t.homeDashboard.spaceThemeSaveFailed,
      ok: false,
    };
  }

  if (!user?.id) {
    return {
      error: t.login.managedAccess,
      ok: false,
    };
  }

  try {
    await updateGovernedSpaceTheme({
      spaceId,
      theme,
    });
    revalidatePath('/', 'layout');
    revalidatePath('/home');
    revalidatePath('/inbox');
    revalidatePath('/activity');

    return { ok: true };
  } catch (error) {
    return {
      error: getFriendlyHomeErrorMessage({
        error,
        fallback: t.homeDashboard.spaceThemeSaveFailed,
        language,
        surface: 'home:space-theme',
      }),
      ok: false,
    };
  }
}

export async function updateHomeLanguagePreferenceAction(formData: FormData) {
  const preferredLanguage = normalizeLanguage(
    String(formData.get('preferredLanguage') ?? '').trim(),
  );
  const t = getTranslations(preferredLanguage);
  const spaceId = readText(formData, 'spaceId');
  const user = await getRequestViewer();

  if (!spaceId) {
    redirect('/spaces');
  }

  if (!user?.id) {
    redirectToHomeSurface({
      error: t.login.managedAccess,
      spaceId,
    });
  }

  try {
    await updateCurrentUserLanguagePreference({
      preferredLanguage,
      userId: user.id,
    });
    await setLanguageCookie(preferredLanguage);
  } catch (error) {
    redirectToHomeSurface({
      error: getFriendlyHomeErrorMessage({
        error,
        fallback:
          preferredLanguage === 'ru'
            ? 'Не удалось обновить язык. Попробуйте ещё раз.'
            : 'Unable to update language right now. Please try again.',
        language: preferredLanguage,
        surface: 'home:language-preference',
      }),
      spaceId,
    });
  }

  revalidatePath('/home');
  revalidatePath('/settings');
  revalidatePath('/inbox');
  revalidatePath('/activity');
  revalidatePath('/', 'layout');

  redirectToHomeSurface({
    spaceId,
  });
}

export async function removeSpaceParticipantsAction(formData: FormData) {
  const language = await getRequestLanguage();
  const t = getTranslations(language);
  const spaceId = readText(formData, 'spaceId');
  const selectedUserIds = readText(formData, 'selectedUserIds');

  if (!spaceId) {
    redirect('/spaces');
  }

  if (!selectedUserIds) {
    redirectToHomeSurface({
      error: t.messengerHome.participantsSelectionRequired,
      openParticipants: true,
      spaceId,
    });
  }

  try {
    await removeMembersFromGovernedSpace({
      selectedUserIds,
      spaceId,
    });

    revalidatePath('/home');
    revalidatePath('/inbox');
    revalidatePath('/activity');
    revalidatePath('/spaces');

    redirectToHomeSurface({
      message: t.messengerHome.participantsRemoveSuccess,
      openParticipants: true,
      spaceId,
    });
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    redirectToHomeSurface({
      error: getFriendlyHomeErrorMessage({
        error,
        fallback: t.messengerHome.participantsRemoveFailed,
        language,
        surface: 'home:participants-remove',
      }),
      openParticipants: true,
      spaceId,
    });
  }
}

export async function requestAdditionalSpaceAccountsAction(formData: FormData) {
  const language = await getRequestLanguage();
  const t = getTranslations(language);
  const spaceId = readText(formData, 'spaceId');

  if (!spaceId) {
    redirect('/spaces');
  }

  try {
    await requestAdditionalAccountsForGovernedSpace({
      spaceId,
    });

    redirectToHomeSurface({
      message: t.messengerHome.participantsRequestSuccess,
      openParticipants: true,
      spaceId,
    });
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    redirectToHomeSurface({
      error: getFriendlyHomeErrorMessage({
        error,
        fallback: t.messengerHome.participantsRequestFailed,
        language,
        surface: 'home:participants-request',
      }),
      openParticipants: true,
      spaceId,
    });
  }
}
