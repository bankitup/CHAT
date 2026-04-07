import 'server-only';

import {
  getConversationCompanionMetadataWithoutAccessCheck,
} from '@/modules/messaging/data/conversation-companion-metadata';
import { getConversationForUser } from '@/modules/messaging/data/server';
import type {
  KeepCozyOperationalObjectRef,
  KeepCozyThreadCompanionMetadata,
} from '@/modules/spaces/types';

export type ConversationThreadContextConversation = NonNullable<
  Awaited<ReturnType<typeof getConversationForUser>>
>;

/**
 * Nullable operational-thread context wrapper for one access-checked
 * conversation.
 *
 * This is the first safe backend composition seam for future KeepCozy-aware
 * thread context. It keeps current DM/group shell loading intact and layers
 * optional companion metadata beside it rather than widening the base
 * conversation contract.
 */
export type ConversationOperationalThreadContext = {
  conversation: ConversationThreadContextConversation;
  companionMetadata: KeepCozyThreadCompanionMetadata | null;
  primaryOperationalObjectRef: KeepCozyOperationalObjectRef | null;
  hasCompanionMetadata: boolean;
  hasPrimaryOperationalObjectRef: boolean;
};

function assertConversationOperationalThreadContextConsistency(input: {
  conversation: ConversationThreadContextConversation;
  companionMetadata: KeepCozyThreadCompanionMetadata;
}) {
  if (
    input.companionMetadata.conversationId !== input.conversation.conversationId
  ) {
    throw new Error(
      'Conversation companion metadata conversationId does not match the access-checked conversation shell.',
    );
  }

  if (
    input.conversation.spaceId &&
    input.companionMetadata.spaceId !== input.conversation.spaceId
  ) {
    throw new Error(
      'Conversation companion metadata spaceId does not match the access-checked conversation shell.',
    );
  }
}

/**
 * Access-checked conversation-level read wrapper for future operational thread
 * context.
 *
 * Important:
 *
 * - conversation access is still resolved by `getConversationForUser(...)`
 * - direct companion-table access remains isolated in
 *   `conversation-companion-metadata.ts`
 * - this helper is additive and optional; it does not change current inbox,
 *   chat history, or message payload shapes
 * - this helper must not become a policy engine or timeline/event writer;
 *   later branches own access mapping and timeline semantics
 */
export async function getConversationOperationalThreadContextForUser(
  conversationId: string,
  userId: string,
  options?: {
    spaceId?: string | null;
  },
): Promise<ConversationOperationalThreadContext | null> {
  const conversation = await getConversationForUser(
    conversationId,
    userId,
    options,
  );

  if (!conversation) {
    return null;
  }

  const companionMetadata =
    await getConversationCompanionMetadataWithoutAccessCheck({
      conversationId: conversation.conversationId,
    });

  if (companionMetadata) {
    assertConversationOperationalThreadContextConsistency({
      conversation,
      companionMetadata,
    });
  }

  const primaryOperationalObjectRef =
    companionMetadata?.primaryOperationalObjectRef ?? null;

  return {
    conversation,
    companionMetadata,
    primaryOperationalObjectRef,
    hasCompanionMetadata: companionMetadata !== null,
    hasPrimaryOperationalObjectRef: primaryOperationalObjectRef !== null,
  };
}
