import 'server-only';

import {
  getConversationOperationalThreadContextForUser,
  type ConversationOperationalThreadContext,
} from '@/modules/messaging/data/conversation-thread-context';

export type MessagingOperationalThreadContext =
  ConversationOperationalThreadContext;

/**
 * Product-neutral operational thread read seam for non-Messenger consumers.
 *
 * This keeps KeepCozy and future product integrations out of `data/**` even
 * while the underlying companion metadata still lives there.
 */
export async function getMessagingOperationalThreadContextForUser(input: {
  conversationId: string;
  spaceId?: string | null;
  userId: string;
}): Promise<MessagingOperationalThreadContext | null> {
  return getConversationOperationalThreadContextForUser(
    input.conversationId,
    input.userId,
    {
      spaceId: input.spaceId,
    },
  );
}
