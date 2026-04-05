'use client';

import { useEffect, useSyncExternalStore } from 'react';
import type { MessageReactionGroup } from '@/modules/messaging/data/server';

type ThreadConversationLiveState = {
  currentUserReadSeq: number | null;
  otherParticipantReadSeq: number | null;
  reactionsByMessage: Record<string, MessageReactionGroup[]>;
};

const threadLiveStateStore = new Map<string, ThreadConversationLiveState>();
const threadLiveStateListeners = new Map<string, Set<() => void>>();

function emitThreadLiveStateChange(conversationId: string) {
  const listeners = threadLiveStateListeners.get(conversationId);

  if (!listeners) {
    return;
  }

  for (const listener of listeners) {
    listener();
  }
}

function getEmptyThreadConversationLiveState(): ThreadConversationLiveState {
  return {
    currentUserReadSeq: null,
    otherParticipantReadSeq: null,
    reactionsByMessage: {},
  };
}

function getThreadConversationLiveState(conversationId: string) {
  return (
    threadLiveStateStore.get(conversationId) ??
    getEmptyThreadConversationLiveState()
  );
}

function normalizeReactionGroups(reactions: MessageReactionGroup[]) {
  return [...reactions]
    .filter((reaction) => reaction.count > 0)
    .sort((left, right) => {
      if (left.selectedByCurrentUser !== right.selectedByCurrentUser) {
        return left.selectedByCurrentUser ? -1 : 1;
      }

      if (left.count !== right.count) {
        return right.count - left.count;
      }

      return left.emoji.localeCompare(right.emoji);
    })
    .slice(0, 5);
}

export function subscribeToThreadLiveState(
  conversationId: string,
  listener: () => void,
) {
  const normalizedConversationId = conversationId.trim();

  if (!normalizedConversationId) {
    return () => undefined;
  }

  const listeners =
    threadLiveStateListeners.get(normalizedConversationId) ?? new Set<() => void>();
  listeners.add(listener);
  threadLiveStateListeners.set(normalizedConversationId, listeners);

  return () => {
    const currentListeners = threadLiveStateListeners.get(normalizedConversationId);

    if (!currentListeners) {
      return;
    }

    currentListeners.delete(listener);

    if (currentListeners.size === 0) {
      threadLiveStateListeners.delete(normalizedConversationId);
    }
  };
}

export function getThreadLiveStateSnapshot(conversationId: string) {
  return getThreadConversationLiveState(conversationId.trim());
}

export function hydrateThreadLiveState(input: {
  conversationId: string;
  currentUserReadSeq: number | null;
  otherParticipantReadSeq: number | null;
  reactionsByMessage: Array<{
    messageId: string;
    reactions: MessageReactionGroup[];
  }>;
}) {
  const normalizedConversationId = input.conversationId.trim();

  if (!normalizedConversationId) {
    return;
  }

  threadLiveStateStore.set(normalizedConversationId, {
    currentUserReadSeq: input.currentUserReadSeq,
    otherParticipantReadSeq: input.otherParticipantReadSeq,
    reactionsByMessage: Object.fromEntries(
      input.reactionsByMessage.map((entry) => [
        entry.messageId,
        normalizeReactionGroups(entry.reactions),
      ]),
    ),
  });
  emitThreadLiveStateChange(normalizedConversationId);
}

export function patchThreadConversationReadState(input: {
  conversationId: string;
  isCurrentUser: boolean;
  lastReadMessageSeq: number | null;
}) {
  const normalizedConversationId = input.conversationId.trim();

  if (!normalizedConversationId) {
    return;
  }

  const currentState = getThreadConversationLiveState(normalizedConversationId);
  const nextState = {
    ...currentState,
    currentUserReadSeq: input.isCurrentUser
      ? input.lastReadMessageSeq
      : currentState.currentUserReadSeq,
    otherParticipantReadSeq: input.isCurrentUser
      ? currentState.otherParticipantReadSeq
      : input.lastReadMessageSeq,
  };

  threadLiveStateStore.set(normalizedConversationId, nextState);
  emitThreadLiveStateChange(normalizedConversationId);
}

export function applyThreadReactionRealtimeEvent(input: {
  conversationId: string;
  currentUserId: string;
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  newRow?: {
    emoji?: string | null;
    message_id?: string | null;
    user_id?: string | null;
  } | null;
  oldRow?: {
    emoji?: string | null;
    message_id?: string | null;
    user_id?: string | null;
  } | null;
}) {
  const normalizedConversationId = input.conversationId.trim();

  if (!normalizedConversationId) {
    return;
  }

  const currentState = getThreadConversationLiveState(normalizedConversationId);
  const reactionsByMessage = {
    ...currentState.reactionsByMessage,
  };

  const applyRow = (
    row: {
      emoji?: string | null;
      message_id?: string | null;
      user_id?: string | null;
    } | null | undefined,
    direction: 'increment' | 'decrement',
  ) => {
    const messageId = row?.message_id?.trim();
    const emoji = row?.emoji?.trim();
    const userId = row?.user_id?.trim();

    if (!messageId || !emoji || !userId) {
      return;
    }

    const currentGroups = reactionsByMessage[messageId] ?? [];
    const existingGroup = currentGroups.find((group) => group.emoji === emoji);
    const nextCount =
      (existingGroup?.count ?? 0) + (direction === 'increment' ? 1 : -1);
    const selectedByCurrentUser =
      direction === 'increment'
        ? existingGroup?.selectedByCurrentUser || userId === input.currentUserId
        : userId === input.currentUserId
          ? false
          : existingGroup?.selectedByCurrentUser ?? false;

    const nextGroups = currentGroups
      .filter((group) => group.emoji !== emoji)
      .concat(
        nextCount > 0
          ? [
              {
                emoji,
                count: nextCount,
                selectedByCurrentUser,
              } satisfies MessageReactionGroup,
            ]
          : [],
      );

    reactionsByMessage[messageId] = normalizeReactionGroups(nextGroups);
  };

  if (input.eventType === 'UPDATE') {
    applyRow(input.oldRow, 'decrement');
    applyRow(input.newRow, 'increment');
  } else if (input.eventType === 'INSERT') {
    applyRow(input.newRow, 'increment');
  } else {
    applyRow(input.oldRow, 'decrement');
  }

  threadLiveStateStore.set(normalizedConversationId, {
    ...currentState,
    reactionsByMessage,
  });
  emitThreadLiveStateChange(normalizedConversationId);
}

export function useThreadLiveReactionGroups(
  conversationId: string,
  messageId: string,
  fallback: MessageReactionGroup[],
) {
  return useSyncExternalStore(
    (listener) => subscribeToThreadLiveState(conversationId, listener),
    () =>
      getThreadLiveStateSnapshot(conversationId).reactionsByMessage[messageId] ??
      fallback,
    () => fallback,
  );
}

export function useThreadOtherParticipantReadSeq(
  conversationId: string,
  fallback: number | null,
) {
  return useSyncExternalStore(
    (listener) => subscribeToThreadLiveState(conversationId, listener),
    () => {
      const snapshot = getThreadLiveStateSnapshot(conversationId);
      return snapshot.otherParticipantReadSeq ?? fallback;
    },
    () => fallback,
  );
}

type ThreadLiveStateHydratorProps = {
  conversationId: string;
  currentUserReadSeq: number | null;
  otherParticipantReadSeq: number | null;
  reactionsByMessage: Array<{
    messageId: string;
    reactions: MessageReactionGroup[];
  }>;
};

export function ThreadLiveStateHydrator({
  conversationId,
  currentUserReadSeq,
  otherParticipantReadSeq,
  reactionsByMessage,
}: ThreadLiveStateHydratorProps) {
  useEffect(() => {
    hydrateThreadLiveState({
      conversationId,
      currentUserReadSeq,
      otherParticipantReadSeq,
      reactionsByMessage,
    });
  }, [
    conversationId,
    currentUserReadSeq,
    otherParticipantReadSeq,
    reactionsByMessage,
  ]);

  return null;
}
