'use client';

import { useSyncExternalStore } from 'react';

type ThreadMessagePatch = {
  body: string | null;
  editedAt: string | null;
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
  body: string | null;
  conversationId: string;
  editedAt: string | null;
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

  conversationPatches.set(normalizedMessageId, {
    body: input.body,
    editedAt: input.editedAt,
  });
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
    () =>
      getThreadMessagePatchMap(conversationId).get(messageId)?.body ?? fallback,
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
    () =>
      getThreadMessagePatchMap(conversationId).get(messageId)?.editedAt ?? fallback,
    () => fallback,
  );
}
