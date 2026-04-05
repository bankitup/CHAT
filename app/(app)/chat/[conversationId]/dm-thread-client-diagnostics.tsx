'use client';

import React, { type ReactNode } from 'react';

type DmThreadClientSubtreeProps = {
  children: ReactNode;
  conversationId: string;
  messageId?: string | null;
  surface: string;
};

type DmThreadClientBoundaryState = {
  error: Error | null;
};

type DmThreadClientDiagnosticDetails = {
  conversationId: string;
  loggedAt: string;
  messageId: string | null;
  surface: string;
};

declare global {
  interface Window {
    __chatDmThreadLastClientSubtree?: Record<string, unknown>;
  }
}

function isDiagnosticsEnabled() {
  return (
    process.env.NEXT_PUBLIC_CHAT_DEBUG_DM_THREAD_CLIENT === '1' ||
    process.env.NEXT_PUBLIC_CHAT_DEBUG_DM_E2EE_BOOTSTRAP === '1'
  );
}

function writeLastClientSubtree(details: DmThreadClientDiagnosticDetails) {
  if (typeof window === 'undefined') {
    return;
  }

  window.__chatDmThreadLastClientSubtree = details;
}

export function readLastDmThreadClientSubtree() {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.__chatDmThreadLastClientSubtree ?? null;
}

function logClientSubtree(
  stage: string,
  details: DmThreadClientDiagnosticDetails & Record<string, unknown>,
) {
  if (!isDiagnosticsEnabled() || typeof window === 'undefined') {
    return;
  }

  writeLastClientSubtree(details);
  console.info('[dm-thread-client]', stage, details);
}

class DmThreadClientErrorBoundary extends React.Component<
  DmThreadClientSubtreeProps,
  DmThreadClientBoundaryState
> {
  state: DmThreadClientBoundaryState = {
    error: null,
  };

  static getDerivedStateFromError(error: Error) {
    return {
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logClientSubtree('render:error', {
      componentStack: errorInfo.componentStack ?? null,
      conversationId: this.props.conversationId,
      errorMessage: error.message,
      loggedAt: new Date().toISOString(),
      messageId: this.props.messageId ?? null,
      surface: this.props.surface,
    });
  }

  render() {
    if (this.state.error) {
      throw this.state.error;
    }

    return this.props.children;
  }
}

export function DmThreadClientSubtree({
  children,
  conversationId,
  messageId = null,
  surface,
}: DmThreadClientSubtreeProps) {
  logClientSubtree('render:start', {
    conversationId,
    loggedAt: new Date().toISOString(),
    messageId,
    surface,
  });

  return (
    <DmThreadClientErrorBoundary
      conversationId={conversationId}
      messageId={messageId}
      surface={surface}
    >
      {children}
    </DmThreadClientErrorBoundary>
  );
}
