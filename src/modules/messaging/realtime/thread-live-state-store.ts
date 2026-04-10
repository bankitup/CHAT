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
const threadReactionRealtimeSuppressions = new Map<string, number>();

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

function buildThreadReactionSuppressionKey(input: {
  conversationId: string;
  direction: 'increment' | 'decrement';
  emoji: string;
  messageId: string;
  userId: string;
}) {
  return [
    input.conversationId,
    input.messageId,
    input.emoji,
    input.userId,
    input.direction,
  ].join(':');
}

function adjustThreadReactionRealtimeSuppression(input: {
  conversationId: string;
  delta: number;
  direction: 'increment' | 'decrement';
  emoji: string;
  messageId: string;
  userId: string;
}) {
  const suppressionKey = buildThreadReactionSuppressionKey(input);
  const nextCount =
    (threadReactionRealtimeSuppressions.get(suppressionKey) ?? 0) + input.delta;

  if (nextCount > 0) {
    threadReactionRealtimeSuppressions.set(suppressionKey, nextCount);
    return;
  }

  threadReactionRealtimeSuppressions.delete(suppressionKey);
}

function patchThreadReactionSelection(input: {
  conversationId: string;
  emoji: string;
  messageId: string;
  selected: boolean;
}) {
  const currentState = getThreadConversationLiveState(input.conversationId);
  const currentGroups = currentState.reactionsByMessage[input.messageId] ?? [];
  const existingGroup = currentGroups.find(
    (group) => group.emoji === input.emoji,
  );

  if (
    (input.selected && existingGroup?.selectedByCurrentUser) ||
    (!input.selected && !existingGroup?.selectedByCurrentUser)
  ) {
    return false;
  }

  const nextCount =
    (existingGroup?.count ?? 0) + (input.selected ? 1 : -1);
  const nextGroups = currentGroups
    .filter((group) => group.emoji !== input.emoji)
    .concat(
      nextCount > 0
        ? [
            {
              emoji: input.emoji,
              count: nextCount,
              selectedByCurrentUser: input.selected,
            } satisfies MessageReactionGroup,
          ]
        : [],
    );

  threadLiveStateStore.set(input.conversationId, {
    ...currentState,
    reactionsByMessage: {
      ...currentState.reactionsByMessage,
      [input.messageId]: normalizeReactionGroups(nextGroups),
    },
  });

  return true;
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

  if (
    nextState.currentUserReadSeq === currentState.currentUserReadSeq &&
    nextState.otherParticipantReadSeq === currentState.otherParticipantReadSeq
  ) {
    return;
  }

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

    const suppressionKey = buildThreadReactionSuppressionKey({
      conversationId: normalizedConversationId,
      direction,
      emoji,
      messageId,
      userId,
    });
    const suppressionCount =
      threadReactionRealtimeSuppressions.get(suppressionKey) ?? 0;

    if (suppressionCount > 0) {
      if (suppressionCount === 1) {
        threadReactionRealtimeSuppressions.delete(suppressionKey);
      } else {
        threadReactionRealtimeSuppressions.set(
          suppressionKey,
          suppressionCount - 1,
        );
      }
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

export function applyThreadReactionMutationResult(input: {
  conversationId: string;
  currentUserId: string;
  emoji: string;
  messageId: string;
  selected: boolean;
}) {
  const normalizedConversationId = input.conversationId.trim();
  const normalizedMessageId = input.messageId.trim();
  const normalizedEmoji = input.emoji.trim();
  const normalizedUserId = input.currentUserId.trim();

  if (
    !normalizedConversationId ||
    !normalizedMessageId ||
    !normalizedEmoji ||
    !normalizedUserId
  ) {
    return;
  }

  const didChange = patchThreadReactionSelection({
    conversationId: normalizedConversationId,
    emoji: normalizedEmoji,
    messageId: normalizedMessageId,
    selected: input.selected,
  });

  if (!didChange) {
    return;
  }

  adjustThreadReactionRealtimeSuppression({
    conversationId: normalizedConversationId,
    delta: 1,
    direction: input.selected ? 'increment' : 'decrement',
    emoji: normalizedEmoji,
    messageId: normalizedMessageId,
    userId: normalizedUserId,
  });
  emitThreadLiveStateChange(normalizedConversationId);
}

export function rollbackThreadReactionOptimisticMutation(input: {
  conversationId: string;
  currentUserId: string;
  emoji: string;
  messageId: string;
  optimisticSelected: boolean;
}) {
  const normalizedConversationId = input.conversationId.trim();
  const normalizedMessageId = input.messageId.trim();
  const normalizedEmoji = input.emoji.trim();
  const normalizedUserId = input.currentUserId.trim();

  if (
    !normalizedConversationId ||
    !normalizedMessageId ||
    !normalizedEmoji ||
    !normalizedUserId
  ) {
    return;
  }

  adjustThreadReactionRealtimeSuppression({
    conversationId: normalizedConversationId,
    delta: -1,
    direction: input.optimisticSelected ? 'increment' : 'decrement',
    emoji: normalizedEmoji,
    messageId: normalizedMessageId,
    userId: normalizedUserId,
  });

  const didChange = patchThreadReactionSelection({
    conversationId: normalizedConversationId,
    emoji: normalizedEmoji,
    messageId: normalizedMessageId,
    selected: !input.optimisticSelected,
  });

  if (didChange) {
    emitThreadLiveStateChange(normalizedConversationId);
  }
}

export function reconcileThreadReactionOptimisticMutation(input: {
  conversationId: string;
  currentUserId: string;
  emoji: string;
  messageId: string;
  optimisticSelected: boolean;
  selected: boolean;
}) {
  const normalizedConversationId = input.conversationId.trim();
  const normalizedMessageId = input.messageId.trim();
  const normalizedEmoji = input.emoji.trim();
  const normalizedUserId = input.currentUserId.trim();

  if (
    !normalizedConversationId ||
    !normalizedMessageId ||
    !normalizedEmoji ||
    !normalizedUserId ||
    input.optimisticSelected === input.selected
  ) {
    return;
  }

  adjustThreadReactionRealtimeSuppression({
    conversationId: normalizedConversationId,
    delta: -1,
    direction: input.optimisticSelected ? 'increment' : 'decrement',
    emoji: normalizedEmoji,
    messageId: normalizedMessageId,
    userId: normalizedUserId,
  });

  const didChange = patchThreadReactionSelection({
    conversationId: normalizedConversationId,
    emoji: normalizedEmoji,
    messageId: normalizedMessageId,
    selected: input.selected,
  });

  if (didChange) {
    adjustThreadReactionRealtimeSuppression({
      conversationId: normalizedConversationId,
      delta: 1,
      direction: input.selected ? 'increment' : 'decrement',
      emoji: normalizedEmoji,
      messageId: normalizedMessageId,
      userId: normalizedUserId,
    });
    emitThreadLiveStateChange(normalizedConversationId);
  }
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
