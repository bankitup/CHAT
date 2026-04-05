import type { EncryptedDmDiagnosticCode } from '@/modules/messaging/e2ee/ui-policy';

export type DmThreadVisibleMessageState = {
  diagnosticCode: EncryptedDmDiagnosticCode | null;
  plaintextSnippet: string | null;
};

const listeners = new Set<() => void>();
const visibleMessageState = new Map<string, DmThreadVisibleMessageState>();
const MAX_SNIPPET_LENGTH = 120;

function getStateKey(conversationId: string, messageId: string) {
  return `${conversationId}:${messageId}`;
}

function emitChange() {
  listeners.forEach((listener) => listener());
}

function normalizeSnippet(value: string | null) {
  const trimmed = value?.trim().replace(/\s+/g, ' ') ?? '';

  if (!trimmed) {
    return null;
  }

  if (trimmed.length <= MAX_SNIPPET_LENGTH) {
    return trimmed;
  }

  return `${trimmed.slice(0, MAX_SNIPPET_LENGTH).trimEnd()}...`;
}

export function subscribeToDmThreadVisibleMessages(listener: () => void) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function getDmThreadVisibleMessageState(
  conversationId: string,
  messageId: string,
) {
  return (
    visibleMessageState.get(getStateKey(conversationId, messageId)) ?? {
      diagnosticCode: null,
      plaintextSnippet: null,
    }
  );
}

export function setDmThreadVisibleMessageState(input: {
  conversationId: string;
  diagnosticCode: EncryptedDmDiagnosticCode | null;
  messageId: string;
  plaintext: string | null;
}) {
  const key = getStateKey(input.conversationId, input.messageId);
  const nextState: DmThreadVisibleMessageState = {
    diagnosticCode: input.diagnosticCode,
    plaintextSnippet: normalizeSnippet(input.plaintext),
  };
  const previous = visibleMessageState.get(key);

  if (
    previous?.diagnosticCode === nextState.diagnosticCode &&
    previous?.plaintextSnippet === nextState.plaintextSnippet
  ) {
    return;
  }

  visibleMessageState.set(key, nextState);
  emitChange();
}
