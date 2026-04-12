'use client';

import { useSyncExternalStore } from 'react';
import {
  logBrokenThreadHistoryProof,
  shouldLogBrokenThreadHistoryProof,
  summarizeBrokenThreadMessagePatches,
} from '@/modules/messaging/diagnostics/thread-history-proof';

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

export function readThreadMessagePatchSnapshot(conversationId: string) {
  return Array.from(getThreadMessagePatchMap(conversationId).entries()).map(
    ([messageId, patch]) => ({
      body: patch.body,
      deletedAt: patch.deletedAt,
      editedAt: patch.editedAt,
      messageId,
    }),
  );
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
    if (shouldLogBrokenThreadHistoryProof(normalizedConversationId)) {
      logBrokenThreadHistoryProof('patch:noop', {
        conversationId: normalizedConversationId,
        details: {
          bodyType:
            nextPatch.body === null ? 'null' : typeof nextPatch.body,
          deletedAtType:
            nextPatch.deletedAt === null ? 'null' : typeof nextPatch.deletedAt,
          editedAtType:
            nextPatch.editedAt === null ? 'null' : typeof nextPatch.editedAt,
          messageId: normalizedMessageId,
        },
      });
    }
    return;
  }

  conversationPatches.set(normalizedMessageId, nextPatch);
  threadMessagePatchStore.set(normalizedConversationId, conversationPatches);
  if (shouldLogBrokenThreadHistoryProof(normalizedConversationId)) {
    const patchSnapshot = readThreadMessagePatchSnapshot(normalizedConversationId);

    logBrokenThreadHistoryProof('patch:applied', {
      conversationId: normalizedConversationId,
      details: {
        bodyType: nextPatch.body === null ? 'null' : typeof nextPatch.body,
        deletedAtType:
          nextPatch.deletedAt === null ? 'null' : typeof nextPatch.deletedAt,
        editedAtType:
          nextPatch.editedAt === null ? 'null' : typeof nextPatch.editedAt,
        messageId: normalizedMessageId,
        summary: summarizeBrokenThreadMessagePatches(patchSnapshot),
      },
      level: 'info',
    });
  }
  emitThreadMessagePatchChange(normalizedConversationId);
}

export function reconcileThreadMessagePatchesWithAuthoritativeMessages(input: {
  conversationId: string;
  messages: Array<{
    body?: string | null;
    content_mode?: string | null;
    deleted_at?: string | null;
    edited_at?: string | null;
    id: string;
  }>;
}) {
  const normalizedConversationId = input.conversationId.trim();

  if (!normalizedConversationId) {
    return;
  }

  const currentPatches = getThreadMessagePatchMap(normalizedConversationId);

  if (currentPatches.size === 0) {
    return;
  }

  const nextPatches = new Map(currentPatches);
  let didChange = false;

  for (const message of input.messages) {
    const normalizedMessageId = message.id.trim();

    if (!normalizedMessageId || !nextPatches.has(normalizedMessageId)) {
      continue;
    }

    const existingPatch = nextPatches.get(normalizedMessageId) ?? null;
    const shouldPreserveLocalEncryptedBody =
      message.content_mode === 'dm_e2ee_v1' && existingPatch?.body !== undefined;

    if (!shouldPreserveLocalEncryptedBody) {
      nextPatches.delete(normalizedMessageId);
      didChange = true;
      continue;
    }

    const nextPatch: ThreadMessagePatch = {
      body: existingPatch?.body,
      deletedAt: message.deleted_at ?? null,
      editedAt: message.edited_at ?? null,
    };

    if (
      existingPatch?.body === nextPatch.body &&
      existingPatch?.deletedAt === nextPatch.deletedAt &&
      existingPatch?.editedAt === nextPatch.editedAt
    ) {
      continue;
    }

    nextPatches.set(normalizedMessageId, nextPatch);
    didChange = true;
  }

  if (!didChange) {
    return;
  }

  threadMessagePatchStore.set(normalizedConversationId, nextPatches);
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
