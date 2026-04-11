import 'server-only';

import { redirect } from 'next/navigation';
import { getRequestViewer } from '@/lib/request-context/server';
import { getTranslations, type AppLanguage } from '@/modules/i18n';
import { getRequestLanguage } from '@/modules/i18n/server';
import {
  KEEP_COZY_ROLE_LAYER_TRANSLATION_DRAFT,
  type KeepCozyRoleLayerTranslationDraft,
  type KeepCozySpaceRole,
} from '@/modules/keepcozy/contract-types';
import {
  getMessagingOperationalActivityFeedForUser,
  type MessagingOperationalActivityFeed,
  type MessagingOperationalActivityItem,
  type MessagingOperationalActivityLabels,
} from '@/modules/messaging/server/operational-activity';
import {
  getMessagingOperationalThreadContextForUser,
  type MessagingOperationalThreadContext,
} from '@/modules/messaging/server/operational-thread-context';
import { resolveMessagingRouteSpaceContextForUser } from '@/modules/messaging/server/route-context';
import type { SpaceProfile } from '@/modules/spaces/model';

type KeepCozyMessagingViewer = NonNullable<
  Awaited<ReturnType<typeof getRequestViewer>>
>;

export type KeepCozyMessagingActivityLabels =
  MessagingOperationalActivityLabels;
export type KeepCozyMessagingActivityItem =
  MessagingOperationalActivityItem;
export type KeepCozyMessagingActivityFeed =
  MessagingOperationalActivityFeed;

export type KeepCozyMessagingSpaceContext = {
  activeSpace: {
    id: string;
    name: string;
    profile: SpaceProfile;
  };
  language: AppLanguage;
  t: ReturnType<typeof getTranslations>;
  user: KeepCozyMessagingViewer;
};

export function mapKeepCozyActorToMessagingParticipant(
  keepCozySpaceRole: KeepCozySpaceRole | null | undefined,
): KeepCozyRoleLayerTranslationDraft | null {
  if (!keepCozySpaceRole) {
    return null;
  }

  return KEEP_COZY_ROLE_LAYER_TRANSLATION_DRAFT[keepCozySpaceRole] ?? null;
}

export async function getKeepCozyLinkedThreadContextForUser(input: {
  conversationId: string;
  spaceId?: string | null;
  userId: string;
}): Promise<MessagingOperationalThreadContext | null> {
  return getMessagingOperationalThreadContextForUser(input);
}

export async function requireKeepCozyMessagingSpaceContext(
  requestedSpaceId?: string,
): Promise<KeepCozyMessagingSpaceContext> {
  const [user, language] = await Promise.all([
    getRequestViewer(),
    getRequestLanguage(),
  ]);

  if (!user?.id) {
    redirect('/login');
  }

  const spaceContext = await resolveMessagingRouteSpaceContextForUser({
    requestedSpaceId,
    source: 'keepcozy-messaging-adapter',
    userEmail: user.email ?? null,
    userId: user.id,
  });

  if (spaceContext.kind !== 'resolved') {
    redirect('/spaces');
  }

  return {
    activeSpace: {
      id: spaceContext.context.activeSpaceId,
      name: spaceContext.context.activeSpaceName ?? '',
      profile: spaceContext.context.activeSpaceProfile,
    },
    language,
    t: getTranslations(language),
    user,
  };
}

export async function getKeepCozyMessagingActivityFeed(input: {
  labels: KeepCozyMessagingActivityLabels;
  language: AppLanguage;
  spaceId: string;
  userId: string;
}): Promise<KeepCozyMessagingActivityFeed> {
  return getMessagingOperationalActivityFeedForUser(input);
}
