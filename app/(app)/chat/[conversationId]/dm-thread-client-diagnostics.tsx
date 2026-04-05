'use client';

import { useRouter } from 'next/navigation';
import React, { useTransition, type ReactNode } from 'react';
import { ConversationPresenceProvider } from './conversation-presence-provider';

type DmThreadClientSubtreeProps = {
  children: ReactNode;
  conversationId: string;
  debugRequestId?: string | null;
  deploymentId?: string | null;
  fallback?: ReactNode;
  gitCommitSha?: string | null;
  messageId?: string | null;
  surface: string;
  vercelUrl?: string | null;
};

export type DmThreadClientDiagnostics = Omit<
  DmThreadClientSubtreeProps,
  'children' | 'conversationId' | 'fallback' | 'messageId' | 'surface'
>;

type DmThreadClientBoundaryState = {
  error: Error | null;
};

type DmThreadClientDiagnosticDetails = {
  conversationId: string;
  debugRequestId?: string | null;
  deploymentId?: string | null;
  fallbackUsed?: boolean;
  gitCommitSha?: string | null;
  loggedAt: string;
  messageId: string | null;
  surface: string;
  vercelUrl?: string | null;
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
    const details = {
      componentStack: errorInfo.componentStack ?? null,
      conversationId: this.props.conversationId,
      debugRequestId: this.props.debugRequestId ?? null,
      deploymentId: this.props.deploymentId ?? null,
      errorMessage: error.message,
      fallbackUsed: Boolean(this.props.fallback),
      gitCommitSha: this.props.gitCommitSha ?? null,
      loggedAt: new Date().toISOString(),
      messageId: this.props.messageId ?? null,
      surface: this.props.surface,
      vercelUrl: this.props.vercelUrl ?? null,
    };

    logClientSubtree('render:error', details);

    if (this.props.fallback !== undefined) {
      logClientSubtree('render:fallback', details);
    }
  }

  render() {
    if (this.state.error) {
      if (this.props.fallback !== undefined) {
        return this.props.fallback;
      }

      throw this.state.error;
    }

    return this.props.children;
  }
}

export function DmThreadClientSubtree({
  children,
  conversationId,
  debugRequestId = null,
  deploymentId = null,
  fallback,
  gitCommitSha = null,
  messageId = null,
  surface,
  vercelUrl = null,
}: DmThreadClientSubtreeProps) {
  logClientSubtree('render:start', {
    conversationId,
    debugRequestId,
    deploymentId,
    fallbackUsed: false,
    gitCommitSha,
    loggedAt: new Date().toISOString(),
    messageId,
    surface,
    vercelUrl,
  });

  return (
    <DmThreadClientErrorBoundary
      conversationId={conversationId}
      debugRequestId={debugRequestId}
      deploymentId={deploymentId}
      fallback={fallback}
      gitCommitSha={gitCommitSha}
      messageId={messageId}
      surface={surface}
      vercelUrl={vercelUrl}
    >
      {children}
    </DmThreadClientErrorBoundary>
  );
}

type DmSafeConversationPresenceProviderProps = {
  children: ReactNode;
  conversationId: string;
  currentUserId: string;
  debugRequestId?: string | null;
  deploymentId?: string | null;
  gitCommitSha?: string | null;
  otherUserId: string;
  vercelUrl?: string | null;
};

export function DmSafeConversationPresenceProvider({
  children,
  conversationId,
  currentUserId,
  debugRequestId = null,
  deploymentId = null,
  gitCommitSha = null,
  otherUserId,
  vercelUrl = null,
}: DmSafeConversationPresenceProviderProps) {
  return (
    <DmThreadClientSubtree
      conversationId={conversationId}
      debugRequestId={debugRequestId}
      deploymentId={deploymentId}
      fallback={children}
      gitCommitSha={gitCommitSha}
      surface="conversation-presence-provider"
      vercelUrl={vercelUrl}
    >
      <ConversationPresenceProvider
        conversationId={conversationId}
        currentUserId={currentUserId}
        otherUserId={otherUserId}
      >
        {children}
      </ConversationPresenceProvider>
    </DmThreadClientSubtree>
  );
}

type DmThreadPresenceScopeProps = Omit<
  DmSafeConversationPresenceProviderProps,
  'otherUserId'
> & {
  otherUserId: string | null;
};

export function DmThreadPresenceScope({
  children,
  conversationId,
  currentUserId,
  debugRequestId = null,
  deploymentId = null,
  gitCommitSha = null,
  otherUserId,
  vercelUrl = null,
}: DmThreadPresenceScopeProps) {
  if (!otherUserId) {
    return <>{children}</>;
  }

  return (
    <DmSafeConversationPresenceProvider
      conversationId={conversationId}
      currentUserId={currentUserId}
      debugRequestId={debugRequestId}
      deploymentId={deploymentId}
      gitCommitSha={gitCommitSha}
      otherUserId={otherUserId}
      vercelUrl={vercelUrl}
    >
      {children}
    </DmSafeConversationPresenceProvider>
  );
}

type DmThreadComposerFallbackProps = {
  copy: string;
  reloadLabel: string;
};

export function DmThreadComposerFallback({
  copy,
  reloadLabel,
}: DmThreadComposerFallbackProps) {
  const router = useRouter();
  const [isPending, startRefreshTransition] = useTransition();

  return (
    <div className="composer-encryption-status composer-encryption-status-error">
      <p className="attachment-helper attachment-helper-error">{copy}</p>
      <div className="composer-encryption-actions">
        <button
          className="button button-secondary button-compact composer-recovery-button"
          disabled={isPending}
          onClick={() => {
            startRefreshTransition(() => {
              router.refresh();
            });
          }}
          type="button"
        >
          {reloadLabel}
        </button>
      </div>
    </div>
  );
}
