import 'server-only';

import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getTranslations, type AppLanguage } from '@/modules/i18n';
import { getRequestLanguage } from '@/modules/i18n/server';
import { getCurrentUserProfile } from '@/modules/messaging/data/server';
import {
  getUserFacingErrorFallback,
  sanitizeUserFacingErrorMessage,
} from '@/modules/messaging/ui/user-facing-errors';
import {
  isSpaceMembersSchemaCacheErrorMessage,
  resolveActiveSpaceForUser,
} from '@/modules/spaces/server';
import { resolveSpaceProductPosture } from '@/modules/spaces/shell';

export type MessengerSettingsPageQuery = {
  error?: string;
  message?: string;
  space?: string;
};

function buildHomeRedirectHref(input: {
  error?: string;
  message?: string;
  spaceId?: string | null;
}) {
  const params = new URLSearchParams();

  if (input.spaceId) {
    params.set('space', input.spaceId);
  }

  if (input.message?.trim()) {
    params.set('message', input.message.trim());
  }

  if (input.error?.trim()) {
    params.set('error', input.error.trim());
  }

  return params.size > 0 ? `/home?${params.toString()}` : '/home';
}

export async function loadMessengerSettingsPageData(
  params: MessengerSettingsPageQuery,
) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    return null;
  }

  const profile = await getCurrentUserProfile(user.id, user.email ?? null);
  const language = await getRequestLanguage(profile.preferredLanguage);
  const t = getTranslations(language);
  const currentLanguage = (profile.preferredLanguage ?? language) as AppLanguage;
  const hasAvatar = Boolean(profile.avatarPath);
  let activeSpaceId = params.space?.trim() || null;
  let activeSpaceName: string | null = null;

  try {
    const activeSpaceState = await resolveActiveSpaceForUser({
      requestedSpaceId: activeSpaceId,
      source: 'settings-page',
      userEmail: user.email ?? null,
      userId: user.id,
    });

    activeSpaceId = activeSpaceState.activeSpace?.id ?? null;
    activeSpaceName = activeSpaceState.activeSpace?.name ?? null;

    if (
      activeSpaceState.activeSpace &&
      resolveSpaceProductPosture(activeSpaceState.activeSpace.profile) ===
        'messenger'
    ) {
      redirect(
        buildHomeRedirectHref({
          error: params.error,
          message: params.message,
          spaceId: activeSpaceId,
        }),
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (!isSpaceMembersSchemaCacheErrorMessage(message)) {
      throw error;
    }
  }

  const visibleError = params.error
    ? sanitizeUserFacingErrorMessage({
        fallback: getUserFacingErrorFallback(language, 'settings'),
        language,
        rawMessage: params.error,
      })
    : null;

  return {
    activeSpaceId,
    activeSpaceName,
    currentLanguage,
    hasAvatar,
    message: params.message ?? null,
    profile,
    t,
    visibleError,
  };
}
