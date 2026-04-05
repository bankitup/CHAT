'use client';

import { useEffect } from 'react';

type DmThreadHydrationProbeProps = {
  conversationId: string;
  debugRequestId?: string | null;
  firstMessageId: string | null;
  historyWindowLimit: number;
  initialServerMessageCount: number;
  kind: 'dm' | 'group';
  renderedEmptyState: boolean;
};

declare global {
  interface Window {
    __chatDmThreadLastHydrationSnapshot?: Record<string, unknown>;
  }
}

function isHydrationDiagnosticsEnabled() {
  return (
    process.env.NEXT_PUBLIC_CHAT_DEBUG_DM_THREAD_CLIENT === '1' ||
    process.env.NEXT_PUBLIC_CHAT_DEBUG_DM_E2EE_BOOTSTRAP === '1'
  );
}

export function readLastDmThreadHydrationSnapshot() {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.__chatDmThreadLastHydrationSnapshot ?? null;
}

export function DmThreadHydrationProbe({
  conversationId,
  debugRequestId = null,
  firstMessageId,
  historyWindowLimit,
  initialServerMessageCount,
  kind,
  renderedEmptyState,
}: DmThreadHydrationProbeProps) {
  useEffect(() => {
    if (!isHydrationDiagnosticsEnabled()) {
      return;
    }

    const snapshot = {
      clientPostNormalizationMessageCount: initialServerMessageCount,
      clientPostWindowMessageCount: initialServerMessageCount,
      clientReceivedMessageCount: initialServerMessageCount,
      conversationId,
      debugRequestId,
      firstMessageId,
      historyWindowLimit,
      kind,
      loggedAt: new Date().toISOString(),
      renderedEmptyState,
      serverProvidedInitialMessageCount: initialServerMessageCount,
    };

    window.__chatDmThreadLastHydrationSnapshot = snapshot;
    console.info('[dm-thread-hydration]', 'client:mount', snapshot);
  }, [
    conversationId,
    debugRequestId,
    firstMessageId,
    historyWindowLimit,
    initialServerMessageCount,
    kind,
    renderedEmptyState,
  ]);

  return null;
}
