'use server';

import { isRedirectError } from 'next/dist/client/components/redirect-error';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getTranslations, type AppLanguage } from '@/modules/i18n';
import { getRequestLanguage } from '@/modules/i18n/server';
import {
  logControlledUiError,
  sanitizeUserFacingErrorMessage,
} from '@/modules/messaging/ui/user-facing-errors';
import { createGovernedSpace } from '@/modules/spaces/write-server';
import { withSpaceParam } from '@/modules/spaces/url';

function readText(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

function setTextParam(params: URLSearchParams, key: string, value?: string | null) {
  const normalized = value?.trim() ?? '';

  if (normalized) {
    params.set(key, normalized);
  }
}

function redirectToCreateSpaceSurface(input: {
  adminIdentifiers?: string | null;
  error?: string | null;
  memberIdentifiers?: string | null;
  profile?: string | null;
  returnSpaceId?: string | null;
  spaceName?: string | null;
}): never {
  const params = new URLSearchParams();

  setTextParam(params, 'space', input.returnSpaceId);
  setTextParam(params, 'name', input.spaceName);
  setTextParam(params, 'profile', input.profile);
  setTextParam(params, 'members', input.memberIdentifiers);
  setTextParam(params, 'admins', input.adminIdentifiers);
  setTextParam(params, 'error', input.error);

  const href = params.toString() ? `/spaces/new?${params.toString()}` : '/spaces/new';
  redirect(href);
}

function redirectToSpacesSurface(input: {
  message?: string | null;
  spaceId?: string | null;
}): never {
  const params = new URLSearchParams();

  setTextParam(params, 'message', input.message);

  const href = params.toString() ? `/spaces?${params.toString()}` : '/spaces';
  redirect(withSpaceParam(href, input.spaceId));
}

function getFriendlyCreateSpaceErrorMessage(input: {
  error: unknown;
  fallback: string;
  language: AppLanguage;
}) {
  const rawMessage =
    input.error instanceof Error ? input.error.message : input.fallback;

  logControlledUiError({
    fallback: input.fallback,
    rawMessage,
    surface: 'spaces:create-space',
  });

  return sanitizeUserFacingErrorMessage({
    fallback: input.fallback,
    language: input.language,
    rawMessage,
  });
}

export async function createSpaceAction(formData: FormData) {
  const language = await getRequestLanguage();
  const t = getTranslations(language);
  const returnSpaceId = readText(formData, 'returnSpaceId');
  const spaceName = readText(formData, 'spaceName');
  const profile = readText(formData, 'profile');
  const memberIdentifiers = readText(formData, 'memberIdentifiers');
  const adminIdentifiers = readText(formData, 'adminIdentifiers');
  const draft = {
    adminIdentifiers,
    memberIdentifiers,
    profile,
    returnSpaceId,
    spaceName,
  };

  if (!spaceName) {
    redirectToCreateSpaceSurface({
      error: t.spaces.nameRequired,
      ...draft,
    });
  }

  if (!adminIdentifiers) {
    redirectToCreateSpaceSurface({
      error: t.spaces.adminIdentifiersRequired,
      ...draft,
    });
  }

  try {
    const created = await createGovernedSpace({
      adminIdentifiers,
      participantIdentifiers: memberIdentifiers,
      profile,
      spaceName,
    });

    revalidatePath('/spaces');
    revalidatePath('/home');
    revalidatePath('/inbox');

    const successMessage = !created.profilePersisted
      ? created.creatorIsMember
        ? t.spaces.createSpaceSuccessProfileDeferred
        : t.spaces.createSpaceSuccessNoAccessProfileDeferred
      : created.creatorIsMember
        ? t.spaces.createSpaceSuccess
        : t.spaces.createSpaceSuccessNoAccess;

    redirectToSpacesSurface({
      message: successMessage,
      spaceId: created.creatorIsMember ? created.spaceId : returnSpaceId,
    });
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    redirectToCreateSpaceSurface({
      error: getFriendlyCreateSpaceErrorMessage({
        error,
        fallback: t.spaces.createSpaceFailed,
        language,
      }),
      ...draft,
    });
  }
}
