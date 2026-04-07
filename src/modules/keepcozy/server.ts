import 'server-only';

import { redirect } from 'next/navigation';
import { getRequestViewer } from '@/lib/request-context/server';
import { getTranslations } from '@/modules/i18n';
import { getRequestLanguage } from '@/modules/i18n/server';
import {
  isSpaceMembersSchemaCacheErrorMessage,
  resolveActiveSpaceForUser,
  resolveV1TestSpaceFallback,
} from '@/modules/spaces/server';

type ResolveKeepCozyContextInput = {
  requestedSpaceId?: string | null;
  source: string;
};

export async function requireKeepCozyContext(
  input: ResolveKeepCozyContextInput,
) {
  const [user, language] = await Promise.all([
    getRequestViewer(),
    getRequestLanguage(),
  ]);

  if (!user?.id) {
    redirect('/login');
  }

  let activeSpaceId: string | null = null;
  let activeSpaceName: string | null = null;

  const explicitV1TestSpace = await resolveV1TestSpaceFallback({
    requestedSpaceId: input.requestedSpaceId,
    source: `${input.source}-explicit-v1-test-bypass`,
  });

  if (explicitV1TestSpace) {
    activeSpaceId = explicitV1TestSpace.id;
    activeSpaceName = explicitV1TestSpace.name;
  } else {
    try {
      const activeSpaceState = await resolveActiveSpaceForUser({
        requestedSpaceId: input.requestedSpaceId,
        source: input.source,
        userId: user.id,
      });

      if (!activeSpaceState.activeSpace) {
        redirect('/spaces');
      }

      if (activeSpaceState.requestedSpaceWasInvalid) {
        redirect('/spaces');
      }

      activeSpaceId = activeSpaceState.activeSpace.id;
      activeSpaceName = activeSpaceState.activeSpace.name;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (isSpaceMembersSchemaCacheErrorMessage(message)) {
        redirect('/spaces');
      }

      throw error;
    }
  }

  if (!activeSpaceId || !activeSpaceName) {
    redirect('/spaces');
  }

  return {
    activeSpace: {
      id: activeSpaceId,
      name: activeSpaceName,
    },
    language,
    t: getTranslations(language),
    user,
  };
}
