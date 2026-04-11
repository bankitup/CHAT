import 'server-only';

import { getConversationForUser } from '@/modules/messaging/data/server';
import type { SpaceProfile } from '@/modules/spaces/model';
import {
  isSpaceMembersSchemaCacheErrorMessage,
  resolveActiveSpaceForUser,
  resolveV1TestSpaceFallback,
} from '@/modules/spaces/server';

export type MessagingRouteSpaceContext = {
  activeSpaceId: string;
  activeSpaceName: string | null;
  activeSpaceProfile: SpaceProfile;
  canManageMembers: boolean;
  isV1TestBypass: boolean;
};

export type MessagingRouteSpaceContextResolution =
  | {
      kind: 'resolved';
      context: MessagingRouteSpaceContext;
    }
  | {
      kind: 'missing_space';
    }
  | {
      kind: 'requested_space_invalid';
    };

export type MessagingConversationRouteContext = {
  activeSpaceId: string;
  conversation: NonNullable<
    Awaited<ReturnType<typeof getConversationForUser>>
  >;
  isV1TestBypass: boolean;
  shouldRedirectToCanonicalSpace: boolean;
};

export type MessagingConversationRouteContextResolution =
  | {
      kind: 'resolved';
      context: MessagingConversationRouteContext;
    }
  | {
      kind: 'conversation_not_found';
    }
  | {
      kind: 'space_unavailable';
    }
  | {
      kind: 'requested_space_invalid';
    };

function buildV1TestBypassSource(source: string) {
  return `${source}-explicit-v1-test-bypass`;
}

async function resolveV1TestMessagingSpaceContext(input: {
  requestedSpaceId?: string | null;
  source: string;
}): Promise<MessagingRouteSpaceContext | null> {
  const fallbackSpace = await resolveV1TestSpaceFallback({
    requestedSpaceId: input.requestedSpaceId,
    source: buildV1TestBypassSource(input.source),
  });

  if (!fallbackSpace) {
    return null;
  }

  return {
    activeSpaceId: fallbackSpace.id,
    activeSpaceName: fallbackSpace.name,
    activeSpaceProfile: 'keepcozy_ops',
    canManageMembers: false,
    isV1TestBypass: true,
  };
}

/**
 * Shared messaging capability seam for active-space access.
 *
 * Messenger routes consume this today, but later product surfaces should use
 * this capability boundary instead of re-implementing active-space + v1 TEST
 * fallback logic inside route files.
 */
export async function resolveMessagingRouteSpaceContextForUser(input: {
  requestedSpaceId?: string | null;
  source: string;
  userEmail?: string | null;
  userId: string;
}): Promise<MessagingRouteSpaceContextResolution> {
  const explicitTestSpace = await resolveV1TestMessagingSpaceContext(input);

  if (explicitTestSpace) {
    return {
      kind: 'resolved',
      context: explicitTestSpace,
    };
  }

  try {
    const activeSpaceState = await resolveActiveSpaceForUser({
      requestedSpaceId: input.requestedSpaceId,
      source: input.source,
      userEmail: input.userEmail ?? null,
      userId: input.userId,
    });

    if (activeSpaceState.requestedSpaceWasInvalid) {
      return {
        kind: 'requested_space_invalid',
      };
    }

    if (!activeSpaceState.activeSpace) {
      return {
        kind: 'missing_space',
      };
    }

    return {
      kind: 'resolved',
      context: {
        activeSpaceId: activeSpaceState.activeSpace.id,
        activeSpaceName: activeSpaceState.activeSpace.name,
        activeSpaceProfile: activeSpaceState.activeSpace.profile,
        canManageMembers: activeSpaceState.activeSpace.canManageMembers,
        isV1TestBypass: false,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (!isSpaceMembersSchemaCacheErrorMessage(message)) {
      throw error;
    }

    const fallbackSpace = await resolveV1TestMessagingSpaceContext(input);

    if (!fallbackSpace) {
      return {
        kind: 'missing_space',
      };
    }

    return {
      kind: 'resolved',
      context: fallbackSpace,
    };
  }
}

/**
 * Shared messaging capability seam for access-checked conversation routes.
 *
 * This keeps conversation access and active-space canonicalization in
 * `src/modules/messaging`, rather than making Messenger pages own the full
 * route-resolution flow themselves.
 */
export async function resolveMessagingConversationRouteContextForUser(input: {
  conversationId: string;
  requestedSpaceId?: string | null;
  source: string;
  userEmail?: string | null;
  userId: string;
}): Promise<MessagingConversationRouteContextResolution> {
  let activeSpaceId: string | null = null;
  let conversation =
    null as Awaited<ReturnType<typeof getConversationForUser>> | null;
  let isV1TestBypass = false;
  const requestedSpaceId = input.requestedSpaceId?.trim() || null;

  if (requestedSpaceId) {
    const explicitTestSpace = await resolveV1TestMessagingSpaceContext({
      requestedSpaceId,
      source: input.source,
    });

    if (explicitTestSpace) {
      activeSpaceId = explicitTestSpace.activeSpaceId;
      isV1TestBypass = true;
      conversation = await getConversationForUser(
        input.conversationId,
        input.userId,
        {
          spaceId: activeSpaceId,
        },
      );
    } else {
      conversation = await getConversationForUser(input.conversationId, input.userId, {
        spaceId: requestedSpaceId,
      });

      if (conversation) {
        activeSpaceId = requestedSpaceId;
      }
    }
  }

  if (!conversation || !activeSpaceId) {
    const baseConversation =
      conversation ??
      (await getConversationForUser(input.conversationId, input.userId));

    if (!baseConversation) {
      return {
        kind: 'conversation_not_found',
      };
    }

    if (!baseConversation.spaceId) {
      throw new Error(
        'Active space routing requires public.conversations.space_id.',
      );
    }

    const fallbackRequestedSpaceId = requestedSpaceId || baseConversation.spaceId;
    const spaceContext = await resolveMessagingRouteSpaceContextForUser({
      requestedSpaceId: fallbackRequestedSpaceId,
      source: input.source,
      userEmail: input.userEmail ?? null,
      userId: input.userId,
    });

    if (spaceContext.kind === 'requested_space_invalid') {
      return {
        kind: 'requested_space_invalid',
      };
    }

    if (spaceContext.kind !== 'resolved') {
      return {
        kind: 'space_unavailable',
      };
    }

    activeSpaceId = spaceContext.context.activeSpaceId;
    isV1TestBypass = spaceContext.context.isV1TestBypass;
    conversation = await getConversationForUser(input.conversationId, input.userId, {
      spaceId: activeSpaceId,
    });

    if (!conversation) {
      return {
        kind: 'conversation_not_found',
      };
    }
  }

  return {
    kind: 'resolved',
    context: {
      activeSpaceId,
      conversation,
      isV1TestBypass,
      shouldRedirectToCanonicalSpace: requestedSpaceId !== activeSpaceId,
    },
  };
}
