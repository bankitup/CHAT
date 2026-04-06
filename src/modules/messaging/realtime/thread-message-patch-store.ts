'use client';

import { useSyncExternalStore } from 'react';

type ThreadMessagePatch = {
  body?: string | null;
  deletedAt?: string | null;
  editedAt?: string | null;
};

const threadMessagePatchStore = new Map<string, Map<string, ThreadMessagePatch>>();
const threadMessagePatchListeners = new Map<string, Set<() => void>>();

function emitThreadMessagePatchChange(conversationId: string) {
  const listeners = threadMessagePatchListeners.get(conversationId);

  if (!listeners) {
    return;
  }

  for (const listener of listeners) {
    listener();
  }
}

function getThreadMessagePatchMap(conversationId: string) {
  return threadMessagePatchStore.get(conversationId) ?? new Map<string, ThreadMessagePatch>();
}

export function subscribeToThreadMessagePatches(
  conversationId: string,
  listener: () => void,
) {
  const normalizedConversationId = conversationId.trim();

  if (!normalizedConversationId) {
    return () => undefined;
  }

  const listeners =
    threadMessagePatchListeners.get(normalizedConversationId) ?? new Set<() => void>();
  listeners.add(listener);
  threadMessagePatchListeners.set(normalizedConversationId, listeners);

  return () => {
    const currentListeners =
      threadMessagePatchListeners.get(normalizedConversationId);

    if (!currentListeners) {
      return;
    }

    currentListeners.delete(listener);

    if (currentListeners.size === 0) {
      threadMessagePatchListeners.delete(normalizedConversationId);
    }
  };
}

export function patchThreadMessageContent(input: {
  body?: string | null;
  conversationId: string;
  deletedAt?: string | null;
  editedAt?: string | null;
  messageId: string;
}) {
  const normalizedConversationId = input.conversationId.trim();
  const normalizedMessageId = input.messageId.trim();

  if (!normalizedConversationId || !normalizedMessageId) {
    return;
  }

  const conversationPatches = new Map(
    getThreadMessagePatchMap(normalizedConversationId),
  );
  const existingPatch = conversationPatches.get(normalizedMessageId);
  const nextPatch = {
    ...(input.body !== undefined ? { body: input.body } : null),
    ...(input.deletedAt !== undefined ? { deletedAt: input.deletedAt } : null),
    ...(input.editedAt !== undefined ? { editedAt: input.editedAt } : null),
  } satisfies ThreadMessagePatch;

  if (
    existingPatch?.body === nextPatch.body &&
    existingPatch?.deletedAt === nextPatch.deletedAt &&
    existingPatch?.editedAt === nextPatch.editedAt
  ) {
    return;
  }

  conversationPatches.set(normalizedMessageId, nextPatch);
  threadMessagePatchStore.set(normalizedConversationId, conversationPatches);
  emitThreadMessagePatchChange(normalizedConversationId);
}

export function useThreadMessagePatchedBody(
  conversationId: string,
  messageId: string,
  fallback: string | null,
) {
  return useSyncExternalStore(
    (listener) => subscribeToThreadMessagePatches(conversationId, listener),
    () => {
      const patch = getThreadMessagePatchMap(conversationId).get(messageId);
      return patch?.body !== undefined ? patch.body : fallback;
    },
    () => fallback,
  );
}

export function useThreadMessagePatchedEditedAt(
  conversationId: string,
  messageId: string,
  fallback: string | null,
) {
  return useSyncExternalStore(
    (listener) => subscribeToThreadMessagePatches(conversationId, listener),
    () => {
      const patch = getThreadMessagePatchMap(conversationId).get(messageId);
      return patch?.editedAt !== undefined ? patch.editedAt : fallback;
    },
    () => fallback,
  );
}

export function useThreadMessagePatchedDeletedAt(
  conversationId: string,
  messageId: string,
  fallback: string | null,
) {
  return useSyncExternalStore(
    (listener) => subscribeToThreadMessagePatches(conversationId, listener),
    () => {
      const patch = getThreadMessagePatchMap(conversationId).get(messageId);
      return patch?.deletedAt !== undefined ? patch.deletedAt : fallback;
    },
    () => fallback,
  );
}
